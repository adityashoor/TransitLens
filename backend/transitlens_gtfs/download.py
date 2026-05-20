from __future__ import annotations

import hashlib
import shutil
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import requests

from .config import Settings


REQUIRED_GTFS_FILES = {
    "agency.txt",
    "routes.txt",
    "stops.txt",
    "trips.txt",
    "stop_times.txt",
    "shapes.txt",
    "calendar.txt",
    "calendar_dates.txt",
}


def discover_gtfs_resource(settings: Settings) -> dict[str, Any]:
    response = requests.get(settings.ckan_package_show_url, timeout=60)
    response.raise_for_status()
    package = response.json()["result"]
    resources = package.get("resources", [])
    for resource in resources:
        if resource.get("name") == settings.gtfs_resource_name:
            return {"package": package, "resource": resource}
    for resource in resources:
        url = resource.get("url", "")
        if url.lower().endswith(".zip"):
            return {"package": package, "resource": resource}
    raise RuntimeError("No GTFS ZIP resource found in CKAN package response.")


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def download_feed(settings: Settings, force: bool = False) -> dict[str, Any]:
    discovered = discover_gtfs_resource(settings)
    resource = discovered["resource"]
    url = resource["url"]
    settings.gtfs_zip_path.parent.mkdir(parents=True, exist_ok=True)
    if settings.gtfs_zip_path.exists() and not force:
        return {
            "zip_path": settings.gtfs_zip_path,
            "sha256": sha256_file(settings.gtfs_zip_path),
            "resource": resource,
            "downloaded": False,
        }

    temp_path = settings.gtfs_zip_path.with_suffix(".zip.part")
    with requests.get(url, stream=True, timeout=180) as response:
        response.raise_for_status()
        with temp_path.open("wb") as handle:
            for chunk in response.iter_content(chunk_size=1024 * 1024):
                if chunk:
                    handle.write(chunk)
    temp_path.replace(settings.gtfs_zip_path)
    return {
        "zip_path": settings.gtfs_zip_path,
        "sha256": sha256_file(settings.gtfs_zip_path),
        "resource": resource,
        "downloaded": True,
    }


def archive_feed(settings: Settings, zip_path: Path, sha256: str) -> Path:
    settings.gtfs_archive_dir.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    archive_path = settings.gtfs_archive_dir / f"ttc_gtfs_{stamp}_{sha256[:12]}.zip"
    if not archive_path.exists():
        shutil.copy2(zip_path, archive_path)
    return archive_path


def extract_feed(settings: Settings, zip_path: Path | None = None) -> Path:
    source = zip_path or settings.gtfs_zip_path
    if settings.gtfs_extract_dir.exists():
        shutil.rmtree(settings.gtfs_extract_dir)
    settings.gtfs_extract_dir.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(source) as archive:
        names = {Path(info.filename).name for info in archive.infolist()}
        missing = REQUIRED_GTFS_FILES - names
        if missing:
            raise RuntimeError(f"GTFS feed is missing required files: {sorted(missing)}")
        archive.extractall(settings.gtfs_extract_dir)
    return settings.gtfs_extract_dir
