"""Database utilities for Outlook Mail Station."""

from __future__ import annotations

from contextlib import contextmanager
from pathlib import Path
from typing import Iterator

from sqlalchemy import inspect
from sqlmodel import Session, SQLModel, create_engine, select

from .models import AccountSiteUsage, ApiKey, StationUser, USER_ROLE_ADMIN, generate_api_key, utcnow
from .passwords import hash_password, is_password_hash, verify_password
from .settings import ADMIN_PASSWORD, DATABASE_URL


engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})


def _ensure_sqlite_parent_dir() -> None:
    """AI by zb: 在 SQLite 文件模式下提前创建数据库父目录。"""
    if not DATABASE_URL.startswith("sqlite:///"):
        return
    raw_path = DATABASE_URL.removeprefix("sqlite:///")
    if not raw_path or raw_path == ":memory:":
        return
    db_path = Path(raw_path)
    db_path.parent.mkdir(parents=True, exist_ok=True)


def _ensure_outlook_account_columns() -> None:
    """AI by zb: 为旧数据库补齐账号相关字段。"""
    inspector = inspect(engine)
    if "outlook_accounts" not in inspector.get_table_names():
        return

    columns = {item["name"] for item in inspector.get_columns("outlook_accounts")}
    statements: list[str] = []
    if "is_pinned" not in columns:
        statements.append("ALTER TABLE outlook_accounts ADD COLUMN is_pinned BOOLEAN NOT NULL DEFAULT 0")
    if "pinned_at" not in columns:
        statements.append("ALTER TABLE outlook_accounts ADD COLUMN pinned_at TIMESTAMP")
    if "batch_code" not in columns:
        statements.append("ALTER TABLE outlook_accounts ADD COLUMN batch_code VARCHAR NOT NULL DEFAULT ''")
    if "group_site_id" not in columns:
        statements.append("ALTER TABLE outlook_accounts ADD COLUMN group_site_id INTEGER")
    added_group_site_column = "group_site_id" not in columns
    if "inbox_last_uid" not in columns:
        statements.append("ALTER TABLE outlook_accounts ADD COLUMN inbox_last_uid INTEGER")
    if "junk_last_uid" not in columns:
        statements.append("ALTER TABLE outlook_accounts ADD COLUMN junk_last_uid INTEGER")
    if "sent_last_uid" not in columns:
        statements.append("ALTER TABLE outlook_accounts ADD COLUMN sent_last_uid INTEGER")
    with engine.begin() as connection:
        for statement in statements:
            connection.exec_driver_sql(statement)
        if added_group_site_column:
            connection.exec_driver_sql(
                "UPDATE outlook_accounts SET group_site_id = ("
                "SELECT sites.id FROM sites WHERE UPPER(sites.code) = UPPER(TRIM(outlook_accounts.batch_code))"
                ") WHERE TRIM(outlook_accounts.batch_code) <> ''"
            )
        connection.exec_driver_sql("CREATE INDEX IF NOT EXISTS ix_outlook_accounts_inbox_last_uid ON outlook_accounts(inbox_last_uid)")
        connection.exec_driver_sql("CREATE INDEX IF NOT EXISTS ix_outlook_accounts_junk_last_uid ON outlook_accounts(junk_last_uid)")
        connection.exec_driver_sql("CREATE INDEX IF NOT EXISTS ix_outlook_accounts_sent_last_uid ON outlook_accounts(sent_last_uid)")
        connection.exec_driver_sql("CREATE INDEX IF NOT EXISTS ix_outlook_accounts_group_site_id ON outlook_accounts(group_site_id)")


def generate_unique_api_key(session: Session) -> str:
    """AI by zb: 生成数据库内唯一的接入密钥。"""
    while True:
        candidate = generate_api_key()
        pending_keys = {
            item.key
            for item in [*session.identity_map.values(), *session.new]
            if isinstance(item, ApiKey) and item.key
        }
        if candidate in pending_keys:
            continue
        existing = session.exec(select(ApiKey).where(ApiKey.key == candidate)).first()
        if not existing:
            return candidate


def _ensure_default_admin_user() -> None:
    """AI by zb: 根据环境变量预置默认管理员账号。"""
    password = str(ADMIN_PASSWORD or "").strip()
    if not password:
        return
    with Session(engine) as session:
        existing = session.exec(select(StationUser).where(StationUser.username == "admin")).first()
        if existing:
            changed = False
            if not verify_password(password, existing.password):
                existing.password = hash_password(password)
                changed = True
            if existing.role != USER_ROLE_ADMIN:
                existing.role = USER_ROLE_ADMIN
                changed = True
            if not existing.enabled:
                existing.enabled = True
                changed = True
            if changed:
                existing.updated_at = utcnow()
                session.add(existing)
                session.commit()
            return
        session.add(
            StationUser(
                username="admin",
                password=hash_password(password),
                role=USER_ROLE_ADMIN,
                enabled=True,
                created_at=utcnow(),
                updated_at=utcnow(),
            )
        )
        session.commit()


def _migrate_legacy_user_api_keys() -> None:
    """AI by zb: 将历史用户级 API Key 迁移为独立接入密钥。"""
    inspector = inspect(engine)
    if "station_users" not in inspector.get_table_names():
        return
    columns = {item["name"] for item in inspector.get_columns("station_users")}
    if "api_key" not in columns:
        return

    with Session(engine) as session:
        rows = session.exec(
            select(StationUser.username, StationUser.api_key).where(StationUser.api_key.is_not(None))
        ).all()
        for username, api_key in rows:
            if not api_key:
                continue
            existing = session.exec(select(ApiKey).where(ApiKey.key == api_key)).first()
            if existing:
                continue
            session.add(
                ApiKey(
                    name=str(username or "legacy"),
                    key=str(api_key),
                    enabled=True,
                    created_at=utcnow(),
                    updated_at=utcnow(),
                )
            )
        session.commit()


def _migrate_station_user_passwords() -> None:
    """Convert legacy plaintext login passwords after default users are initialized."""
    with Session(engine) as session:
        users = session.exec(select(StationUser)).all()
        for user in users:
            if is_password_hash(user.password):
                continue
            user.password = hash_password(user.password or "")
            user.updated_at = utcnow()
            session.add(user)
        session.commit()


def _ensure_unique_active_site_usages() -> None:
    """Keep one active usage per account and site, then enforce it in SQLite."""
    with Session(engine) as session:
        active = session.exec(
            select(AccountSiteUsage)
            .where(AccountSiteUsage.released_at.is_(None))
            .order_by(AccountSiteUsage.id.asc())
        ).all()
        seen: set[tuple[int, int]] = set()
        for usage in active:
            key = (usage.account_id, usage.site_id)
            if key in seen:
                usage.released_at = utcnow()
                usage.updated_at = usage.released_at
                session.add(usage)
            else:
                seen.add(key)
        session.commit()
    with engine.begin() as connection:
        connection.exec_driver_sql(
            "CREATE UNIQUE INDEX IF NOT EXISTS uq_active_account_site_usage "
            "ON account_site_usages(account_id, site_id) WHERE released_at IS NULL"
        )


def init_db() -> None:
    """AI by zb: 初始化新站点使用的全部数据库表。"""
    _ensure_sqlite_parent_dir()
    SQLModel.metadata.create_all(engine)
    _ensure_outlook_account_columns()
    _ensure_default_admin_user()
    _migrate_legacy_user_api_keys()
    _migrate_station_user_passwords()
    _ensure_unique_active_site_usages()


@contextmanager
def session_scope() -> Iterator[Session]:
    """AI by zb: 提供带自动关闭能力的数据库会话上下文。"""
    session = Session(engine)
    try:
        yield session
    finally:
        session.close()


def get_session() -> Iterator[Session]:
    """AI by zb: 提供 FastAPI 依赖注入使用的数据库会话。"""
    with Session(engine) as session:
        yield session
