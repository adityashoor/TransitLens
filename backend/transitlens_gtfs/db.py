from __future__ import annotations

from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine

from .config import PROJECT_ROOT, Settings


def make_engine(database_url: str) -> Engine:
    return create_engine(database_url, future=True, pool_pre_ping=True)


def create_database(settings: Settings) -> None:
    admin_engine = make_engine(settings.admin_database_url)
    db_name = settings.database_url.rsplit("/", 1)[-1].split("?", 1)[0]
    with admin_engine.connect().execution_options(isolation_level="AUTOCOMMIT") as conn:
        exists = conn.execute(
            text("SELECT 1 FROM pg_database WHERE datname = :name"), {"name": db_name}
        ).scalar()
        if not exists:
            conn.execute(text(f'CREATE DATABASE "{db_name}"'))


def apply_schema(engine: Engine) -> None:
    with engine.begin() as conn:
        for schema_path in sorted((PROJECT_ROOT / "backend" / "sql").glob("*.sql")):
            conn.exec_driver_sql(schema_path.read_text(encoding="utf-8"))
