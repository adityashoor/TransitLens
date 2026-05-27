"""
data_loader.py — Load TTC GTFS data from local parquet cache.
Falls back to downloading from TTC if cache is missing.
"""
from __future__ import annotations

import io
import logging
import zipfile
from pathlib import Path

import geopandas as gpd
import pandas as pd
import requests
from shapely.geometry import Point

logger = logging.getLogger(__name__)

CACHE_DIR = Path(__file__).parent.parent / "data" / "cache" / "gtfs"
GTFS_URL = "https://transitfeeds.com/p/ttc/33/latest/download"
TTC_GTFS_FALLBACK = "https://opendata.toronto.ca/toronto.transit.commission/ttc-routes-and-schedules/OpenData_TTC_Schedules.zip"

REQUIRED = ["routes", "stops", "trips", "stop_times", "shapes"]


def get_gtfs() -> dict[str, pd.DataFrame]:
    """Return raw GTFS DataFrames, using parquet cache when available."""
    frames: dict[str, pd.DataFrame] = {}
    missing = []

    for name in REQUIRED:
        p = CACHE_DIR / f"{name}.parquet"
        if p.exists():
            frames[name] = pd.read_parquet(p)
        else:
            missing.append(name)

    if missing:
        logger.info("Parquet cache missing %s — downloading GTFS …", missing)
        frames.update(_download_gtfs(missing))

    return frames


def _download_gtfs(needed: list[str]) -> dict[str, pd.DataFrame]:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    for url in [GTFS_URL, TTC_GTFS_FALLBACK]:
        try:
            r = requests.get(url, timeout=30)
            r.raise_for_status()
            zf = zipfile.ZipFile(io.BytesIO(r.content))
            result = {}
            for name in needed:
                if f"{name}.txt" in zf.namelist():
                    df = pd.read_csv(zf.open(f"{name}.txt"), dtype=str, low_memory=False)
                    df.to_parquet(CACHE_DIR / f"{name}.parquet", index=False)
                    result[name] = df
            return result
        except Exception as exc:
            logger.warning("GTFS download failed from %s: %s", url, exc)
    return {}


def load_stop_times(frames: dict[str, pd.DataFrame]) -> pd.DataFrame:
    return frames.get("stop_times", pd.DataFrame())


def get_processed() -> dict:
    """Return processed GeoDataFrame + DataFrames ready for the API."""
    frames = get_gtfs()

    routes = frames.get("routes", pd.DataFrame()).copy()
    stops_raw = frames.get("stops", pd.DataFrame()).copy()
    trips = frames.get("trips", pd.DataFrame()).copy()
    shapes = frames.get("shapes", pd.DataFrame()).copy()

    # numeric coercions
    for col in ["stop_lat", "stop_lon"]:
        if col in stops_raw.columns:
            stops_raw[col] = pd.to_numeric(stops_raw[col], errors="coerce")
    for col in ["route_type"]:
        if col in routes.columns:
            routes[col] = pd.to_numeric(routes[col], errors="coerce").fillna(3).astype(int)

    # Build GeoDataFrame for stops
    stops_raw = stops_raw.dropna(subset=["stop_lat", "stop_lon"])
    stops_gdf = gpd.GeoDataFrame(
        stops_raw,
        geometry=gpd.points_from_xy(stops_raw["stop_lon"], stops_raw["stop_lat"]),
        crs="EPSG:4326",
    )

    # route_stops: join trips → stop_times to get route_id per stop_id
    if not trips.empty and "stop_times" in frames:
        st = frames["stop_times"][["trip_id", "stop_id"]].drop_duplicates()
        route_stops = trips[["route_id", "trip_id"]].drop_duplicates().merge(st, on="trip_id")
        route_stops = route_stops[["route_id", "stop_id"]].drop_duplicates()
    else:
        route_stops = pd.DataFrame(columns=["route_id", "stop_id"])

    return {
        "routes": routes,
        "stops": stops_gdf,
        "shapes": shapes,
        "route_stops": route_stops,
    }
