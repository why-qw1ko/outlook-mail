"""Account management routes for Outlook Mail Station."""

from __future__ import annotations

import csv
import io
import json
import random
import re
from datetime import datetime, timezone
from math import ceil

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from fastapi.responses import JSONResponse, StreamingResponse
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm.attributes import flag_modified
from sqlmodel import Session, select

from ..auth import require_admin_authorization
from ..database import get_session
from ..models import AccountSiteUsage, MailMessage, OutlookAccount, SITE_SOURCE_MANUAL, Site, utcnow
from ..schemas import (
    AccountDetailResponse,
    AccountListItem,
    AccountListResponse,
    AccountSiteUsageSummary,
    BatchDeleteAccountsRequest,
    BatchUpdateAccountsRequest,
    ImportAccountsRequest,
    ImportAccountsResponse,
    ImportResultItem,
    ManualConsumeAccountRequest,
    OperationStatusResponse,
    PoolSummaryResponse,
    RandomConsumeAccountRequest,
    RandomConsumeAccountResponse,
    ReleaseAccountUsageRequest,
    UpdateAccountRequest,
)
from ..services.mail_sync_service import persist_rotated_refresh_token
from ..services.site_usage_service import (
    count_pool_and_consumed_accounts,
    get_active_account_site_usage,
    get_active_account_site_usages,
    get_site_by_code,
    load_site_map,
    release_all_account_site_usages,
    release_site_usage,
)
from ..services.outlook_service import OutlookService


router = APIRouter(prefix="/accounts", tags=["accounts"])


def _normalize_datetime(value: datetime | None) -> datetime | None:
    """AI by zb: 把数据库中的时间统一转换为 UTC。"""
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _parse_import_line(raw_line: str) -> tuple[str, str, str, str] | None:
    """AI by zb: 解析单行导入文本并提取邮箱凭证，兼容 ---- 与逗号格式。"""
    line = raw_line.strip()
    if not line:
        return None
    if "----" in line:
        parts = [item.strip() for item in re.split(r"-{4,}", line)]
    else:
        parts = [item.strip() for item in line.replace("\t", ",").split(",")]
    if len(parts) == 2 and all(parts):
        return parts[0], parts[1], "", ""
    if len(parts) == 3 and all(parts):
        return parts[0], "", parts[1], parts[2]
    if len(parts) < 4:
        return None
    email, password, client_id, refresh_token = parts[:4]
    if not email or bool(client_id) != bool(refresh_token) or not (password or client_id):
        return None
    return email, password, client_id, refresh_token


def _parse_import_records(data: str) -> list[tuple[int, tuple[str, str, str, str] | None]]:
    """Parse text rows or a JSON array of mailbox credential objects."""
    stripped = data.strip()
    if not stripped.startswith(("[", "{")):
        return [(index, _parse_import_line(line)) for index, line in enumerate(data.splitlines(), start=1) if line.strip()]
    try:
        parsed = json.loads(stripped)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail="导入 JSON 格式无效") from exc
    records = parsed if isinstance(parsed, list) else [parsed]
    result: list[tuple[int, tuple[str, str, str, str] | None]] = []
    for index, item in enumerate(records, start=1):
        if not isinstance(item, dict):
            result.append((index, None))
            continue
        email = str(item.get("email") or "").strip()
        password = str(item.get("password") or "").strip()
        client_id = str(item.get("clientId") or item.get("client_id") or "").strip()
        refresh_token = str(item.get("refreshToken") or item.get("refresh_token") or "").strip()
        valid = email and (password or (client_id and refresh_token)) and bool(client_id) == bool(refresh_token)
        result.append((index, (email, password, client_id, refresh_token) if valid else None))
    return result


def _get_account_or_404(session: Session, account_id: int) -> OutlookAccount:
    """AI by zb: 获取账号，不存在时抛出 404。"""
    account = session.get(OutlookAccount, account_id)
    if not account:
        raise HTTPException(status_code=404, detail="邮箱不存在")
    return account


def _get_message_counts(session: Session, account_id: int) -> tuple[int, int]:
    """AI by zb: 汇总指定邮箱的收件与发件数量。"""
    from ..models import MailMessage

    inbox = session.exec(
        select(func.count())
        .select_from(MailMessage)
        .where(MailMessage.account_id == account_id)
        .where(MailMessage.folder.in_(["inbox", "junk"]))
    ).one()
    sent = session.exec(
        select(func.count())
        .select_from(MailMessage)
        .where(MailMessage.account_id == account_id)
        .where(MailMessage.folder == "sent")
    ).one()
    return int(inbox or 0), int(sent or 0)


def _serialize_active_sites(
    usages: list[AccountSiteUsage],
    site_map: dict[int, Site],
) -> list[AccountSiteUsageSummary]:
    """AI by zb: 将活跃站点使用记录转换为前端可用结构。"""
    serialized: list[AccountSiteUsageSummary] = []
    for usage in usages:
        site = site_map.get(usage.site_id)
        if not site:
            continue
        serialized.append(
            AccountSiteUsageSummary(
                id=usage.id or 0,
                site_id=site.id or 0,
                site_code=site.code,
                site_name=site.name or site.code,
                source=usage.source,
                used_at=usage.created_at,
            )
        )
    return serialized


def _derive_auth_fields(account: OutlookAccount) -> dict[str, bool | str]:
    """AI by zb: 根据凭据字段推导认证类型、令牌状态与权限类型。"""
    has_password = bool(account.password.strip())
    has_oauth = bool(account.client_id.strip() and account.refresh_token.strip())
    if has_password and has_oauth:
        auth_type = "password+oauth"
        permission_type = "OAuth (IMAP/SMTP)+密码"
    elif has_oauth:
        auth_type = "oauth"
        permission_type = "OAuth (IMAP/SMTP)"
    elif has_password:
        auth_type = "password"
        permission_type = "密码"
    else:
        auth_type = "none"
        permission_type = "未知"
    token_status = "已配置（未验证）" if has_oauth else "未配置"
    return {
        "has_password": has_password,
        "has_oauth": has_oauth,
        "auth_type": auth_type,
        "token_status": token_status,
        "permission_type": permission_type,
    }


def _serialize_account(
    session: Session,
    account: OutlookAccount,
    site_map: dict[int, Site],
    include_password: bool = False,
) -> AccountListItem:
    """AI by zb: 统一序列化邮箱列表项。"""
    active_usages = get_active_account_site_usages(session, account.id or 0)
    inbox_count, sent_count = _get_message_counts(session, account.id or 0)
    auth_fields = _derive_auth_fields(account)
    group_site = site_map.get(account.group_site_id or 0)
    return AccountListItem(
        id=account.id or 0,
        email=account.email,
        password=account.password if include_password else "",
        enabled=account.enabled,
        show_in_station=account.show_in_station,
        is_pinned=account.is_pinned,
        batch_code=account.batch_code,
        group_site_id=account.group_site_id,
        group_site_code=group_site.code if group_site else "",
        group_site_name=(group_site.name or group_site.code) if group_site else "",
        note=account.note,
        is_consumed=bool(active_usages),
        created_at=account.created_at,
        updated_at=account.updated_at,
        last_synced_at=account.last_synced_at,
        last_error=account.last_error,
        inbox_count=inbox_count,
        sent_count=sent_count,
        active_sites=_serialize_active_sites(active_usages, site_map),
        **auth_fields,
    )


def _serialize_detail(
    session: Session,
    account: OutlookAccount,
    site_map: dict[int, Site],
) -> AccountDetailResponse:
    """AI by zb: 统一序列化邮箱详情。"""
    item = _serialize_account(session, account, site_map)
    return AccountDetailResponse(**item.model_dump())


def _hard_delete_account(session: Session, account: OutlookAccount) -> None:
    """AI by zb: 硬删除邮箱及其邮件缓存与站点占用。"""
    account_id = account.id or 0
    release_all_account_site_usages(session, account_id)
    for usage in session.exec(select(AccountSiteUsage).where(AccountSiteUsage.account_id == account_id)).all():
        session.delete(usage)
    for message in session.exec(select(MailMessage).where(MailMessage.account_id == account_id)).all():
        session.delete(message)
    session.delete(account)


def _resolve_group_site(session: Session, site_id: int | None) -> Site | None:
    """Validate a site selected for mailbox management grouping."""
    if site_id is None:
        return None
    site = session.get(Site, site_id)
    if not site or not site.enabled:
        raise HTTPException(status_code=400, detail="分组站点不存在或已停用")
    return site


def _collect_visible_accounts(
    session: Session,
    keyword: str,
    scope: str,
    batch_code: str,
    site_code: str,
    group_site_id: int | None = None,
    include_disabled: bool = False,
    station_only: bool = False,
    include_password: bool = False,
) -> list[AccountListItem]:
    """AI by zb: 按范围和批次筛选可见邮箱列表。"""
    site_map = load_site_map(session)
    stmt = select(OutlookAccount)
    if not include_disabled:
        stmt = stmt.where(OutlookAccount.enabled == True)
    if station_only:
        stmt = stmt.where(OutlookAccount.show_in_station == True)
    current_site = get_site_by_code(session, site_code, enabled_only=True) if site_code.strip() else None

    normalized_scope = scope if scope in {"consumed", "pool", "all"} else "consumed"

    if keyword.strip():
        stmt = stmt.where(OutlookAccount.email.contains(keyword.strip()))
    if batch_code.strip():
        stmt = stmt.where(OutlookAccount.batch_code == batch_code.strip())
    if group_site_id is not None:
        stmt = stmt.where(OutlookAccount.group_site_id == group_site_id)
    stmt = stmt.order_by(OutlookAccount.is_pinned.desc(), OutlookAccount.pinned_at.desc(), OutlookAccount.id.asc())

    items: list[AccountListItem] = []
    for account in list(session.exec(stmt).all()):
        serialized = _serialize_account(session, account, site_map, include_password=include_password)
        consumed_for_site = any(site.site_code == current_site.code for site in serialized.active_sites) if current_site else serialized.is_consumed
        if normalized_scope == "consumed" and not consumed_for_site:
            continue
        if normalized_scope == "pool" and consumed_for_site:
            continue
        serialized.is_consumed = consumed_for_site
        items.append(serialized)
    return items


def _build_export_csv(items: list[AccountListItem]) -> str:
    """AI by zb: 将邮箱列表转换为 CSV 文本。"""
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["email", "password", "status", "scope", "sites", "inbox_count", "sent_count", "batch_code", "permission_type", "token_status"])
    for item in items:
        writer.writerow(
            [
                item.email,
                item.password,
                "启用" if item.enabled else "禁用",
                "consumed" if item.is_consumed else "pool",
                " / ".join(site.site_code for site in item.active_sites) or "",
                item.inbox_count,
                item.sent_count,
                item.batch_code or "",
                item.permission_type,
                item.token_status,
            ]
        )
    return "\ufeff" + output.getvalue()


@router.post("/import", response_model=ImportAccountsResponse)
def import_accounts(
    request: ImportAccountsRequest,
    authorization: str | None = Header(default=None),
    session: Session = Depends(get_session),
):
    """AI by zb: 将批量导入的邮箱账号写入全局邮箱池。"""
    require_admin_authorization(authorization)
    group_site = _resolve_group_site(session, request.group_site_id)

    items: list[ImportResultItem] = []
    errors: list[str] = []
    created = 0
    updated = 0

    for index, parsed in _parse_import_records(request.data):
        if not parsed:
            errors.append(f"第 {index} 条格式无效")
            continue
        email, password, client_id, refresh_token = parsed
        existing = session.exec(select(OutlookAccount).where(OutlookAccount.email == email)).first()
        now = utcnow()
        if existing:
            if password:
                existing.password = password
            if client_id and refresh_token:
                existing.client_id = client_id
                existing.refresh_token = refresh_token
            existing.updated_at = now
            session.add(existing)
            updated += 1
            items.append(ImportResultItem(email=email, action="updated", id=existing.id))
            continue
        account = OutlookAccount(
            email=email,
            password=password,
            client_id=client_id,
            refresh_token=refresh_token,
            enabled=request.enabled,
            batch_code=request.batch_code,
            group_site_id=group_site.id if group_site else None,
            created_at=now,
            updated_at=now,
        )
        session.add(account)
        session.flush()
        created += 1
        items.append(ImportResultItem(email=email, action="created", id=account.id))

    session.commit()
    return ImportAccountsResponse(
        total=len(items) + len(errors),
        created=created,
        updated=updated,
        failed=len(errors),
        items=items,
        errors=errors,
    )


@router.get("", response_model=AccountListResponse)
def list_accounts(
    authorization: str | None = Header(default=None),
    session: Session = Depends(get_session),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=200),
    keyword: str = Query(default=""),
    scope: str = Query(default="consumed"),
    batch_code: str = Query(default=""),
    site_code: str = Query(default=""),
    group_site_id: int | None = Query(default=None),
    include_disabled: bool = Query(default=False),
    station_only: bool = Query(default=False),
):
    """AI by zb: 返回池内或已使用邮箱列表。"""
    require_admin_authorization(authorization)
    visible_items = _collect_visible_accounts(session, keyword, scope, batch_code, site_code, group_site_id, include_disabled, station_only)
    total = len(visible_items)
    total_pages = max(1, ceil(total / page_size)) if total else 1
    start = (page - 1) * page_size
    paged_items = visible_items[start : start + page_size]
    return AccountListResponse(items=paged_items, total=total, page=page, page_size=page_size, total_pages=total_pages)


@router.get("/export")
def export_accounts(
    authorization: str | None = Header(default=None),
    session: Session = Depends(get_session),
    keyword: str = Query(default=""),
    scope: str = Query(default="all"),
    batch_code: str = Query(default=""),
    site_code: str = Query(default=""),
):
    """AI by zb: 导出指定范围内的邮箱 CSV。"""
    require_admin_authorization(authorization)
    visible_items = _collect_visible_accounts(session, keyword, scope, batch_code, site_code, include_password=True)
    csv_content = _build_export_csv(visible_items)
    filename_parts = ["accounts"]
    filename_parts.append(scope if scope in {"consumed", "pool", "all"} else "all")
    if batch_code.strip():
        filename_parts.append(batch_code.strip())
    filename = "-".join(filename_parts) + ".csv"
    headers = {"Content-Disposition": f'attachment; filename="{filename}"', "Cache-Control": "no-store"}
    return StreamingResponse(iter([csv_content.encode("utf-8")]), media_type="text/csv; charset=utf-8", headers=headers)


@router.get("/export-txt")
def export_accounts_txt(
    authorization: str | None = Header(default=None),
    session: Session = Depends(get_session),
    keyword: str = Query(default=""),
    scope: str = Query(default="all"),
    group_site_id: int | None = Query(default=None),
):
    """Export all visible accounts matching the mailbox management filters."""
    require_admin_authorization(authorization)
    items = _collect_visible_accounts(session, keyword, scope, "", "", group_site_id, include_disabled=True, include_password=True)
    content = "\n".join(f"{item.email}----{item.password}" for item in items)
    headers = {"Content-Disposition": f'attachment; filename="accounts-{len(items)}.txt"', "Cache-Control": "no-store"}
    return StreamingResponse(iter([content.encode("utf-8")]), media_type="text/plain; charset=utf-8", headers=headers)


@router.post("/batch-update", response_model=OperationStatusResponse)
def batch_update_accounts(
    request: BatchUpdateAccountsRequest,
    authorization: str | None = Header(default=None),
    session: Session = Depends(get_session),
):
    """AI by zb: 批量修改邮箱分组或启停状态。"""
    require_admin_authorization(authorization)
    if request.batch_code is None and request.enabled is None and request.show_in_station is None and "group_site_id" not in request.model_fields_set:
        raise HTTPException(status_code=400, detail="请指定要修改的字段")

    accounts = session.exec(select(OutlookAccount).where(OutlookAccount.id.in_(request.account_ids))).all()
    if len(accounts) != len(set(request.account_ids)):
        raise HTTPException(status_code=404, detail="部分邮箱不存在，无法完成批量修改")

    group_site = _resolve_group_site(session, request.group_site_id) if "group_site_id" in request.model_fields_set else None
    now = utcnow()
    for account in accounts:
        if request.show_in_station is not None:
            account.show_in_station = request.show_in_station
        if request.batch_code is not None:
            account.batch_code = request.batch_code.strip()
        if "group_site_id" in request.model_fields_set:
            account.group_site_id = group_site.id if group_site else None
        if request.enabled is not None:
            account.enabled = request.enabled
            if not request.enabled:
                release_all_account_site_usages(session, account.id or 0)
                account.is_pinned = False
                account.pinned_at = None
        account.updated_at = now
        session.add(account)
    session.commit()
    return OperationStatusResponse(ok=True, email="", message=f"已更新 {len(accounts)} 个邮箱")


@router.post("/credentials")
def get_account_credentials(
    request: BatchDeleteAccountsRequest,
    authorization: str | None = Header(default=None),
    session: Session = Depends(get_session),
):
    """Return passwords only for an explicit administrator action."""
    require_admin_authorization(authorization)
    accounts = session.exec(select(OutlookAccount).where(OutlookAccount.id.in_(request.account_ids))).all()
    if len(accounts) != len(set(request.account_ids)):
        raise HTTPException(status_code=404, detail="部分邮箱不存在")
    return JSONResponse(
        content=[{"id": account.id, "password": account.password} for account in accounts],
        headers={"Cache-Control": "no-store"},
    )


@router.post("/batch-delete", response_model=OperationStatusResponse)
def batch_delete_accounts(
    request: BatchDeleteAccountsRequest,
    authorization: str | None = Header(default=None),
    session: Session = Depends(get_session),
):
    """AI by zb: 批量硬删除邮箱及其关联数据。"""
    require_admin_authorization(authorization)
    accounts = session.exec(select(OutlookAccount).where(OutlookAccount.id.in_(request.account_ids))).all()
    if len(accounts) != len(set(request.account_ids)):
        raise HTTPException(status_code=404, detail="部分邮箱不存在，无法完成批量删除")

    for account in accounts:
        _hard_delete_account(session, account)
    session.commit()
    return OperationStatusResponse(ok=True, email="", message=f"已删除 {len(accounts)} 个邮箱")


@router.post("/random-consume", response_model=RandomConsumeAccountResponse)
def random_consume_account(
    request: RandomConsumeAccountRequest,
    authorization: str | None = Header(default=None),
    session: Session = Depends(get_session),
):
    """AI by zb: 从当前站点对应的账号池中随机使用一个邮箱，并返回其在已消费视图中的分页位置。"""
    require_admin_authorization(authorization)
    pool_items = _collect_visible_accounts(
        session,
        keyword="",
        scope="pool",
        batch_code="",
        site_code=request.site_code,
    )
    if not pool_items:
        raise HTTPException(status_code=404, detail="当前站点下没有可随机使用的账号池邮箱")

    picked = random.SystemRandom().choice(pool_items)
    account = _get_account_or_404(session, picked.id)
    site = get_site_by_code(session, request.site_code, enabled_only=True)
    if get_active_account_site_usage(session, account.id or 0, site.id or 0):
        raise HTTPException(status_code=400, detail=f"该邮箱已被站点 {site.name or site.code} 使用")

    now = utcnow()
    session.add(
        AccountSiteUsage(
            account_id=account.id or 0,
            site_id=site.id or 0,
            user_id=0,
            source=SITE_SOURCE_MANUAL,
            created_at=now,
            updated_at=now,
        )
    )
    account.updated_at = now
    session.add(account)
    try:
        session.commit()
    except IntegrityError as exc:
        session.rollback()
        raise HTTPException(status_code=409, detail="该邮箱已被当前站点并发领取，请重试") from exc

    consumed_items = _collect_visible_accounts(
        session,
        keyword="",
        scope="consumed",
        batch_code="",
        site_code=request.site_code,
    )
    consumed_index = next((idx for idx, item in enumerate(consumed_items) if item.id == picked.id), 0)
    page = consumed_index // request.page_size + 1
    consumed_item = consumed_items[consumed_index]
    return RandomConsumeAccountResponse(item=consumed_item, page=page)


@router.get("/pool-summary", response_model=PoolSummaryResponse)
def pool_summary(
    authorization: str | None = Header(default=None),
    session: Session = Depends(get_session),
    site_code: str = Query(default=""),
):
    """AI by zb: 返回全局或指定站点下的池内与已使用数量概览。"""
    require_admin_authorization(authorization)
    current_site = get_site_by_code(session, site_code, enabled_only=True) if site_code.strip() else None
    pool_count, consumed_count = count_pool_and_consumed_accounts(
        session,
        site_id=current_site.id if current_site else None,
    )
    return PoolSummaryResponse(pool_count=pool_count, consumed_count=consumed_count)


@router.get("/{account_id}", response_model=AccountDetailResponse)
def get_account(
    account_id: int,
    authorization: str | None = Header(default=None),
    session: Session = Depends(get_session),
):
    """AI by zb: 获取指定邮箱详情。"""
    require_admin_authorization(authorization)
    site_map = load_site_map(session)
    account = _get_account_or_404(session, account_id)
    return _serialize_detail(session, account, site_map)


@router.patch("/{account_id}", response_model=AccountDetailResponse)
def update_account(
    account_id: int,
    request: UpdateAccountRequest,
    authorization: str | None = Header(default=None),
    session: Session = Depends(get_session),
):
    """Update one mailbox's settings or replace its credentials."""
    require_admin_authorization(authorization)
    site_map = load_site_map(session)
    account = _get_account_or_404(session, account_id)

    password = request.password.get_secret_value().strip() if request.password is not None else ""
    client_id = (request.client_id or "").strip()
    refresh_token = request.refresh_token.get_secret_value().strip() if request.refresh_token is not None else ""
    if bool(client_id) != bool(refresh_token):
        raise HTTPException(status_code=400, detail="Client ID 和 Refresh Token 必须同时填写")

    if "group_site_id" in request.model_fields_set:
        group_site = _resolve_group_site(session, request.group_site_id)
        account.group_site_id = group_site.id if group_site else None

    now = utcnow()

    if password:
        account.password = password
    if client_id:
        account.client_id = client_id
        account.refresh_token = refresh_token
        # Write both columns even if one matches the value originally loaded by this session.
        flag_modified(account, "client_id")
        flag_modified(account, "refresh_token")

    if request.note is not None:
        account.note = request.note.strip()

    if request.show_in_station is not None:
        account.show_in_station = request.show_in_station

    if request.enabled is not None:
        account.enabled = request.enabled
        if not request.enabled:
            release_all_account_site_usages(session, account.id or 0)
            account.is_pinned = False
            account.pinned_at = None

    if request.is_pinned is not None:
        account.is_pinned = bool(request.is_pinned and account.enabled)
        account.pinned_at = now if account.is_pinned else None

    if request.batch_code is not None:
        account.batch_code = request.batch_code.strip()

    account.updated_at = now
    session.add(account)
    session.commit()
    session.refresh(account)
    return _serialize_detail(session, account, site_map)


@router.post("/{account_id}/validate-oauth", response_model=OperationStatusResponse)
def validate_account_oauth(
    account_id: int,
    authorization: str | None = Header(default=None),
    session: Session = Depends(get_session),
):
    """Verify OAuth and IMAP without downloading any messages."""
    require_admin_authorization(authorization)
    account = _get_account_or_404(session, account_id)
    service = OutlookService(account)
    try:
        connection = service._open_imap_connection()
        service._safe_logout(connection)
        if persist_rotated_refresh_token(session, account, service.refresh_token_for_storage()):
            session.commit()
    except RuntimeError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return OperationStatusResponse(ok=True, email=account.email, message="OAuth 和 IMAP 连接验证成功")


@router.post("/{account_id}/consume", response_model=OperationStatusResponse)
def consume_account(
    account_id: int,
    request: ManualConsumeAccountRequest,
    authorization: str | None = Header(default=None),
    session: Session = Depends(get_session),
):
    """AI by zb: 手动将指定邮箱标记为某个站点已使用。"""
    require_admin_authorization(authorization)
    account = _get_account_or_404(session, account_id)

    if not account.enabled:
        raise HTTPException(status_code=400, detail="该邮箱已不可用，无法继续使用")

    site = get_site_by_code(session, request.site_code, enabled_only=True)
    existing_usage = get_active_account_site_usage(session, account.id or 0, site.id or 0)
    if existing_usage:
        raise HTTPException(status_code=400, detail=f"该邮箱已被站点 {site.name or site.code} 使用")

    now = utcnow()
    usage = AccountSiteUsage(
        account_id=account.id or 0,
        site_id=site.id or 0,
        user_id=0,
        source=SITE_SOURCE_MANUAL,
        created_at=now,
        updated_at=now,
    )
    account.updated_at = now
    session.add(usage)
    session.add(account)
    try:
        session.commit()
    except IntegrityError as exc:
        session.rollback()
        raise HTTPException(status_code=409, detail="该邮箱已被当前站点使用") from exc
    return OperationStatusResponse(ok=True, email=account.email, message=f"已标记为站点 {site.name or site.code} 使用")


@router.post("/{account_id}/release", response_model=OperationStatusResponse)
def release_account(
    account_id: int,
    request: ReleaseAccountUsageRequest,
    authorization: str | None = Header(default=None),
    session: Session = Depends(get_session),
):
    """AI by zb: 退回指定邮箱在某个站点上的使用记录。"""
    require_admin_authorization(authorization)
    account = _get_account_or_404(session, account_id)

    site = get_site_by_code(session, request.site_code, enabled_only=False)
    usage = get_active_account_site_usage(session, account.id or 0, site.id or 0)
    if not usage:
        raise HTTPException(status_code=400, detail=f"该邮箱当前未被站点 {site.name or site.code} 使用")

    release_site_usage(session, usage)
    account.updated_at = utcnow()
    session.add(account)
    session.commit()
    return OperationStatusResponse(ok=True, email=account.email, message=f"邮箱已从站点 {site.name or site.code} 退回")


@router.delete("/{account_id}", response_model=OperationStatusResponse)
def delete_account(
    account_id: int,
    authorization: str | None = Header(default=None),
    session: Session = Depends(get_session),
):
    """AI by zb: 硬删除指定邮箱及其邮件缓存与站点占用。"""
    require_admin_authorization(authorization)
    account = _get_account_or_404(session, account_id)
    email = account.email
    _hard_delete_account(session, account)
    session.commit()
    return OperationStatusResponse(ok=True, email=email, message="邮箱及其邮件缓存已删除")
