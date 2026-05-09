"""
GTFS data downloader and parser.
Downloads TTC GTFS feed from Open Toronto Data Portal (open.toronto.ca),
parses routes, stops, shapes, and trips using pandas + geopandas.
All data is open/public under Open Government Licence – Toronto.
"""

import io
import json
import logging
import os
import zipfile
from pathlib import Path

import geopandas as gpd
import pandas as pd
import requests
from shapely.geometry import LineString, Point

logger = logging.getLogger(__name__)

CACHE_DIR = Path(__file__).parent.parent / "data" / "cache"
GTFS_CACHE = CACHE_DIR / "gtfs"

OPEN_TORONTO_API = (
    "https://ckan0.cf.opendata.inter.prod-toronto.ca/api/3/action/package_show"
    "?id=ttc-routes-and-schedules"
)

# ── fallback direct URL (known good as of 2025) ───────────────────────────────
GTFS_FALLBACK_URL = (
    "https://opendata.toronto.ca/toronto-transit-commission/"
    "ttc-routes-and-schedules/OpenData_TTC_Schedules.zip"
)


def _ensure_cache_dir():
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    GTFS_CACHE.mkdir(parents=True, exist_ok=True)


def _get_gtfs_url() -> str:
    """Resolve live GTFS zip URL from Open Toronto CKAN API."""
    try:
        resp = requests.get(OPEN_TORONTO_API, timeout=10)
        resp.raise_for_status()
        pkg = resp.json()["result"]
        for res in pkg["resources"]:
            name = res.get("name", "").lower()
            fmt  = res.get("format", "").lower()
            if "gtfs" in name or fmt == "zip":
                url = res.get("url") or res.get("package_url")
                if url:
                    logger.info("Resolved GTFS URL from CKAN: %s", url)
                    return url
    except Exception as exc:
        logger.warning("CKAN lookup failed (%s), using fallback URL", exc)
    return GTFS_FALLBACK_URL


def _download_gtfs() -> dict[str, pd.DataFrame]:
    """Download GTFS zip and return dict of DataFrames, one per .txt file."""
    _ensure_cache_dir()

    # return cached version if all key files exist
    required = ["routes", "stops", "trips", "stop_times", "shapes"]
    if all((GTFS_CACHE / f"{f}.parquet").exists() for f in required):
        logger.info("Loading GTFS from local cache")
        return {f: pd.read_parquet(GTFS_CACHE / f"{f}.parquet") for f in required}

    url = _get_gtfs_url()
    logger.info("Downloading TTC GTFS from %s …", url)
    resp = requests.get(url, timeout=60)
    resp.raise_for_status()

    frames: dict[str, pd.DataFrame] = {}
    with zipfile.ZipFile(io.BytesIO(resp.content)) as zf:
        for name in zf.namelist():
            key = name.replace(".txt", "").split("/")[-1]
            if key in required:
                with zf.open(name) as f:
                    frames[key] = pd.read_csv(f, dtype=str, low_memory=False)
                    frames[key].to_parquet(GTFS_CACHE / f"{key}.parquet", index=False)
                    logger.info("  Parsed %s — %d rows", key, len(frames[key]))

    return frames


# ── Public API ────────────────────────────────────────────────────────────────

def load_routes(frames: dict) -> pd.DataFrame:
    """Return cleaned routes DataFrame."""
    df = frames["routes"].copy()
    # route_type: 0=tram/streetcar, 1=subway, 3=bus
    df["route_type"] = pd.to_numeric(df["route_type"], errors="coerce").fillna(3).astype(int)
    df["route_short_name"] = df.get("route_short_name", df["route_id"])
    df["route_long_name"]  = df.get("route_long_name",  df["route_id"])
    return df[["route_id", "route_short_name", "route_long_name", "route_type"]].drop_duplicates()


def load_stops(frames: dict) -> gpd.GeoDataFrame:
    """Return stops as GeoDataFrame with Point geometry."""
    df = frames["stops"].copy()
    df["stop_lat"] = pd.to_numeric(df["stop_lat"], errors="coerce")
    df["stop_lon"] = pd.to_numeric(df["stop_lon"], errors="coerce")
    df = df.dropna(subset=["stop_lat", "stop_lon"])
    gdf = gpd.GeoDataFrame(
        df,
        geometry=gpd.points_from_xy(df["stop_lon"], df["stop_lat"]),
        crs="EPSG:4326",
    )
    return gdf[["stop_id", "stop_name", "stop_lat", "stop_lon", "geometry"]]


def load_shapes(frames: dict) -> gpd.GeoDataFrame:
    """Aggregate shape points into LineString per shape_id."""
    df = frames["shapes"].copy()
    df["shape_pt_lat"]      = pd.to_numeric(df["shape_pt_lat"],      errors="coerce")
    df["shape_pt_lon"]      = pd.to_numeric(df["shape_pt_lon"],      errors="coerce")
    df["shape_pt_sequence"] = pd.to_numeric(df["shape_pt_sequence"], errors="coerce")
    df = df.dropna().sort_values(["shape_id", "shape_pt_sequence"])

    lines = (
        df.groupby("shape_id")
        .apply(lambda g: LineString(zip(g["shape_pt_lon"], g["shape_pt_lat"])))
        .reset_index()
        .rename(columns={0: "geometry"})
    )
    return gpd.GeoDataFrame(lines, geometry="geometry", crs="EPSG:4326")


def load_stop_times(frames: dict) -> pd.DataFrame:
    """Return stop_times with numeric departure hour."""
    df = frames["stop_times"].copy()
    # GTFS allows 25:xx etc for after-midnight — coerce to int mod 24
    def _parse_hour(t):
        try:
            return int(str(t).split(":")[0]) % 24
        except Exception:
            return None
    df["departure_hour"] = df["departure_time"].apply(_parse_hour)
    return df[["trip_id", "stop_id", "departure_hour", "stop_sequence"]].dropna()


def load_route_stops(frames: dict) -> pd.DataFrame:
    """Join trips + stop_times to get route_id → stop_id mapping."""
    trips      = frames["trips"][["route_id", "trip_id"]].drop_duplicates()
    stop_times = load_stop_times(frames)[["trip_id", "stop_id"]].drop_duplicates()
    return trips.merge(stop_times, on="trip_id")[["route_id", "stop_id"]].drop_duplicates()


# ── Singleton loader ──────────────────────────────────────────────────────────

_gtfs_cache: dict | None = None


def get_gtfs() -> dict:
    """Return loaded GTFS frames (downloaded once, then cached in memory)."""
    global _gtfs_cache
    if _gtfs_cache is None:
        _gtfs_cache = _download_gtfs()
    return _gtfs_cache


def get_processed() -> dict:
    """Return all processed GTFS objects."""
    frames = get_gtfs()
    return {
        "routes":       load_routes(frames),
        "stops":        load_stops(frames),
        "shapes":       load_shapes(frames),
        "route_stops":  load_route_stops(frames),
    }
