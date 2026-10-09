"""Open API routes protected by access keys."""

from __future__ import annotations

import random
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, select

from ..auth import require_open_api_key
from ..database import get_session
from ..models import AccountSiteUsage, ApiKey, MailMessage, OutlookAccount, SITE_SOURCE_OPEN_API, utcnow
from ..schemas import (
    MessageDetailResponse,
    OpenMailboxLatestResponse,
    OpenMailboxListResponse,
    OperationStatusResponse,
    RandomMailboxRequest,
    RandomMailboxResponse,
)
from ..services.mail_sync_service import SYNC_FOLDERS_INBOUND, maybe_sync_account_mailbox
from ..services.site_usage_service import get_active_account_site_usage, get_site_by_code, release_site_usage
from ..settings import DEFAULT_SYNC_LIMIT
from .messages import _serialize_message


router = APIRouter(prefix="/open", tags=["open-api"])


def _find_account_by_email(session: Session, email: str) -> OutlookAccount:
    """AI by zb: 按邮箱地址查找启用账号。"""
    normalized = str(email or "").strip()
    account = session.exec(
        select(OutlookAccount)
        .where(OutlookAccount.enabled == True)
        .where(OutlookAccount.email == normalized)
    ).first()
    if account:
        return account
    lowered = normalized.lower()
    items = session.exec(select(OutlookAccount).where(OutlookAccount.enabled == True)).all()
    for item in items:
        if item.email.lower() == lowered:
            return item
    raise HTTPException(status_code=404, detail="邮箱不存在")


def _parse_since(value: str | None) -> datetime | None:
    """AI by zb: 解析开放接口传入的 since 时间。"""
    text = str(value or "").strip()
    if not text:
        return None
    try:
        parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="since 时间格式无效，需传 ISO8601") from exc
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def _normalize_dt(value: datetime | None) -> datetime | None:
    """AI by zb: 统一处理数据库里读出的时间字段。"""
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


@router.post("/random-email", response_model=RandomMailboxResponse)
def random_email(
    request: RandomMailboxRequest,
    session: Session = Depends(get_session),
    _api_key: ApiKey = Depends(require_open_api_key),
):
    """AI by zb: 从全局邮箱池中随机分配一个当前站点尚未使用的邮箱。"""
    domain = str(request.domain or "").strip().lower().lstrip("@")
    batch_code = str(request.batch_code or "").strip()
    site = get_site_by_code(session, request.site_code, enabled_only=True)

    for _ in range(3):
        accounts = session.exec(select(OutlookAccount).where(OutlookAccount.enabled == True)).all()
        candidates = [
            account for account in accounts
            if (not domain or account.email.lower().endswith("@" + domain))
            and (not batch_code or account.batch_code == batch_code)
            and not get_active_account_site_usage(session, account.id or 0, site.id or 0)
        ]
        if not candidates:
            raise HTTPException(status_code=404, detail="没有可分配给当前站点的邮箱")

        picked = random.SystemRandom().choice(candidates)
        now = utcnow()
        session.add(
            AccountSiteUsage(
                account_id=picked.id or 0,
                site_id=site.id or 0,
                user_id=0,
                source=SITE_SOURCE_OPEN_API,
                created_at=now,
                updated_at=now,
            )
        )
        picked.updated_at = now
        session.add(picked)
        try:
            session.commit()
        except IntegrityError:
            session.rollback()
            continue
        session.refresh(picked)
        break
    else:
        raise HTTPException(status_code=409, detail="邮箱正在被并发领取，请重试")

    return RandomMailboxResponse(
        id=picked.id or 0,
        email=picked.email,
        domain=picked.email.split("@", 1)[1] if "@" in picked.email else "",
        site_code=site.code,
        site_name=site.name or site.code,
        batch_code=picked.batch_code,
    )


@router.get("/mailboxes/{email}/latest", response_model=OpenMailboxLatestResponse)
def latest_message(
    email: str,
    refresh: bool = Query(default=True),
    session: Session = Depends(get_session),
    _api_key: ApiKey = Depends(require_open_api_key),
):
    """AI by zb: 获取指定邮箱最新一封收件邮件，并按需触发同步。"""
    account = _find_account_by_email(session, email)
    try:
        maybe_sync_account_mailbox(
            session,
            account,
            refresh=refresh,
            limit=DEFAULT_SYNC_LIMIT,
            folders=SYNC_FOLDERS_INBOUND,
            allow_stale_on_error=True,
        )
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    items = session.exec(
        select(MailMessage)
        .where(MailMessage.account_id == (account.id or 0))
        .where(MailMessage.folder.in_(["inbox", "junk"]))
        .order_by(MailMessage.sent_at.desc(), MailMessage.updated_at.desc())
    ).all()
    if not items:
        return OpenMailboxLatestResponse(account_id=account.id or 0, email=account.email, message=None)

    current = items[0]
    return OpenMailboxLatestResponse(
        account_id=account.id or 0,
        email=account.email,
        message=MessageDetailResponse(
            id=current.id or 0,
            folder=current.folder,
            subject=current.subject,
            sender_name=current.sender_name,
            sender_email=current.sender_email,
            recipient_summary=current.recipient_summary,
            preview=current.preview,
            sent_at=current.sent_at,
            body_text=current.body_text,
            body_html=current.body_html,
        ),
    )


@router.get("/mailboxes/{email}/messages", response_model=OpenMailboxListResponse)
def mailbox_messages(
    email: str,
    refresh: bool = Query(default=True),
    since: str = Query(default=""),
    folder: str = Query(default="inbox"),
    session: Session = Depends(get_session),
    _api_key: ApiKey = Depends(require_open_api_key),
):
    """AI by zb: 获取指定邮箱的邮件列表，并支持按时间过滤。"""
    account = _find_account_by_email(session, email)
    try:
        maybe_sync_account_mailbox(
            session,
            account,
            refresh=refresh,
            limit=DEFAULT_SYNC_LIMIT,
            folders=SYNC_FOLDERS_INBOUND,
            allow_stale_on_error=True,
        )
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    folders = [folder]
    if folder == "inbox":
        folders.append("junk")
    threshold = _parse_since(since)

    items = session.exec(
        select(MailMessage)
        .where(MailMessage.account_id == (account.id or 0))
        .where(MailMessage.folder.in_(folders))
        .order_by(MailMessage.sent_at.desc(), MailMessage.updated_at.desc())
    ).all()
    if threshold is not None:
        items = [
            item
            for item in items
            if (_normalize_dt(item.sent_at) or _normalize_dt(item.updated_at) or utcnow()) >= threshold
        ]

    serialized = [_serialize_message(item) for item in items]
    return OpenMailboxListResponse(
        account_id=account.id or 0,
        email=account.email,
        count=len(serialized),
        items=serialized,
    )


@router.post("/mailboxes/{email}/sites/{site_code}/release", response_model=OperationStatusResponse)
def release_mailbox_site_usage(
    email: str,
    site_code: str,
    session: Session = Depends(get_session),
    _api_key: ApiKey = Depends(require_open_api_key),
):
    """AI by zb: 释放指定邮箱在某个站点上的使用记录。"""
    account = _find_account_by_email(session, email)
    site = get_site_by_code(session, site_code, enabled_only=False)
    usage = get_active_account_site_usage(session, account.id or 0, site.id or 0)
    if not usage:
        raise HTTPException(status_code=404, detail="当前邮箱不存在对应站点的有效使用记录")
    release_site_usage(session, usage)
    account.updated_at = utcnow()
    session.add(account)
    session.commit()
    return OperationStatusResponse(ok=True, email=account.email, message=f"邮箱已从站点 {site.name or site.code} 退回")
