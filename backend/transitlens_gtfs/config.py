from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv


PROJECT_ROOT = Path(__file__).resolve().parents[2]


@dataclass(frozen=True)
class Settings:
    database_url: str
    admin_database_url: str
    ckan_package_show_url: str
    gtfs_resource_name: str
    gtfs_zip_path: Path
    gtfs_extract_dir: Path
    gtfs_archive_dir: Path


def _path_from_env(name: str, default: str) -> Path:
    value = os.getenv(name, default)
    path = Path(value)
    return path if path.is_absolute() else PROJECT_ROOT / path


def load_settings() -> Settings:
    load_dotenv(PROJECT_ROOT / "backend" / ".env")
    return Settings(
        database_url=os.getenv(
            "DATABASE_URL",
            "postgresql+psycopg://postgres:postgres@localhost:5432/transitlens",
        ),
        admin_database_url=os.getenv(
            "POSTGRES_ADMIN_URL",
            "postgresql+psycopg://postgres:postgres@localhost:5432/postgres",
        ),
        ckan_package_show_url=os.getenv(
            "CKAN_PACKAGE_SHOW_URL",
            "https://ckan0.cf.opendata.inter.prod-toronto.ca/api/3/action/package_show?id=ttc-routes-and-schedules",
        ),
        gtfs_resource_name=os.getenv(
            "GTFS_RESOURCE_NAME", "TTC Routes and Schedules Data"
        ),
        gtfs_zip_path=_path_from_env("GTFS_ZIP_PATH", "data/gtfs/latest.zip"),
        gtfs_extract_dir=_path_from_env(
            "GTFS_EXTRACT_DIR", "data/gtfs/extracted/latest"
        ),
        gtfs_archive_dir=_path_from_env("GTFS_ARCHIVE_DIR", "data/gtfs/archives"),
    )
