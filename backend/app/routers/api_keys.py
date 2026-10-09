"""Open API key management routes."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlmodel import Session, select

from ..auth import require_admin_user
from ..database import generate_unique_api_key, get_session
from ..models import ApiKey, utcnow
from ..schemas import ApiKeyCreateRequest, ApiKeyItemResponse, ApiKeyListResponse, ApiKeyUpdateRequest, OperationStatusResponse


router = APIRouter(prefix="/api-keys", tags=["api-keys"])


def _get_api_key_or_404(session: Session, key_id: int) -> ApiKey:
    api_key = session.get(ApiKey, key_id)
    if not api_key:
        raise HTTPException(status_code=404, detail="接入密钥不存在")
    return api_key


def _serialize_api_key(api_key: ApiKey) -> ApiKeyItemResponse:
    return ApiKeyItemResponse(
        id=api_key.id or 0,
        name=api_key.name,
        key=api_key.key,
        enabled=api_key.enabled,
        created_at=api_key.created_at,
        updated_at=api_key.updated_at,
    )


@router.get("", response_model=ApiKeyListResponse)
def list_api_keys(
    authorization: str | None = Header(default=None),
    session: Session = Depends(get_session),
):
    """AI by zb: 列出全部开放接口接入密钥。"""
    require_admin_user(authorization)
    items = session.exec(select(ApiKey).order_by(ApiKey.created_at.desc(), ApiKey.id.desc())).all()
    return ApiKeyListResponse(items=[_serialize_api_key(item) for item in items])


@router.post("", response_model=ApiKeyItemResponse)
def create_api_key(
    request: ApiKeyCreateRequest,
    authorization: str | None = Header(default=None),
    session: Session = Depends(get_session),
):
    """AI by zb: 创建开放接口接入密钥。"""
    require_admin_user(authorization)
    now = utcnow()
    api_key = ApiKey(
        name=request.name.strip(),
        key=generate_unique_api_key(session),
        enabled=request.enabled,
        created_at=now,
        updated_at=now,
    )
    session.add(api_key)
    session.commit()
    session.refresh(api_key)
    return _serialize_api_key(api_key)


@router.patch("/{key_id}", response_model=ApiKeyItemResponse)
def update_api_key(
    key_id: int,
    request: ApiKeyUpdateRequest,
    authorization: str | None = Header(default=None),
    session: Session = Depends(get_session),
):
    """AI by zb: 更新接入密钥名称或启停状态。"""
    require_admin_user(authorization)
    api_key = _get_api_key_or_404(session, key_id)
    if request.name is not None:
        api_key.name = request.name.strip()
    if request.enabled is not None:
        api_key.enabled = request.enabled
    api_key.updated_at = utcnow()
    session.add(api_key)
    session.commit()
    session.refresh(api_key)
    return _serialize_api_key(api_key)


@router.post("/{key_id}/regenerate", response_model=ApiKeyItemResponse)
def regenerate_api_key(
    key_id: int,
    authorization: str | None = Header(default=None),
    session: Session = Depends(get_session),
):
    """AI by zb: 轮换接入密钥明文。"""
    require_admin_user(authorization)
    api_key = _get_api_key_or_404(session, key_id)
    api_key.key = generate_unique_api_key(session)
    api_key.updated_at = utcnow()
    session.add(api_key)
    session.commit()
    session.refresh(api_key)
    return _serialize_api_key(api_key)


@router.delete("/{key_id}", response_model=OperationStatusResponse)
def delete_api_key(
    key_id: int,
    authorization: str | None = Header(default=None),
    session: Session = Depends(get_session),
):
    """AI by zb: 删除接入密钥。"""
    require_admin_user(authorization)
    api_key = _get_api_key_or_404(session, key_id)
    session.delete(api_key)
    session.commit()
    return OperationStatusResponse(ok=True, message=f"接入密钥 {api_key.name or api_key.id} 已删除")
