from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pandas as pd
from sqlalchemy import text
from sqlalchemy.engine import Engine

from .download import REQUIRED_GTFS_FILES


LOAD_ORDER = [
    ("agency.txt", "agency"),
    ("calendar.txt", "calendar"),
    ("calendar_dates.txt", "calendar_dates"),
    ("routes.txt", "routes"),
    ("stops.txt", "stops"),
    ("shapes.txt", "shapes"),
    ("trips.txt", "trips"),
    ("stop_times.txt", "stop_times"),
]

INTEGER_COLUMNS = {
    "agency": ["cemv_support"],
    "routes": ["route_type"],
    "stops": ["location_type", "wheelchair_boarding"],
    "calendar": [
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
        "sunday",
    ],
    "calendar_dates": ["exception_type"],
    "trips": ["direction_id", "wheelchair_accessible", "bikes_allowed"],
    "stop_times": ["stop_sequence", "pickup_type", "drop_off_type"],
    "shapes": ["shape_pt_sequence"],
}

FLOAT_COLUMNS = {
    "stops": ["stop_lat", "stop_lon"],
    "shapes": ["shape_pt_lat", "shape_pt_lon", "shape_dist_traveled"],
    "stop_times": ["shape_dist_traveled"],
}


def _read_chunks(path: Path, table: str, chunksize: int):
    for chunk in pd.read_csv(
        path,
        dtype=str,
        keep_default_na=False,
        na_values=[],
        encoding="utf-8-sig",
        chunksize=chunksize,
    ):
        chunk = chunk.replace({"": None})
        for column in INTEGER_COLUMNS.get(table, []):
            if column in chunk.columns:
                chunk[column] = pd.to_numeric(chunk[column], errors="coerce").astype(
                    "Int64"
                )
        for column in FLOAT_COLUMNS.get(table, []):
            if column in chunk.columns:
                chunk[column] = pd.to_numeric(chunk[column], errors="coerce")
        yield chunk


def load_gtfs_tables(engine: Engine, extract_dir: Path, chunksize: int = 100_000) -> dict[str, int]:
    present = {path.name for path in extract_dir.glob("*.txt")}
    missing = REQUIRED_GTFS_FILES - present
    if missing:
        raise RuntimeError(f"Extracted feed is missing required files: {sorted(missing)}")

    row_counts: dict[str, int] = {}
    with engine.begin() as conn:
        conn.execute(
            text(
                """
                TRUNCATE TABLE
                    stop_times,
                    trips,
                    shapes,
                    shape_geometries,
                    stops,
                    routes,
                    calendar_dates,
                    calendar,
                    agency
                RESTART IDENTITY CASCADE
                """
            )
        )

    for filename, table in LOAD_ORDER:
        path = extract_dir / filename
        row_counts[table] = _copy_csv(engine, path, table)
    return row_counts


def _copy_csv(engine: Engine, path: Path, table: str) -> int:
    # Pandas is still used for schema inspection; PostgreSQL COPY handles the
    # actual bulk insert because stop_times has millions of rows.
    header = list(pd.read_csv(path, nrows=0, encoding="utf-8-sig").columns)
    columns = ", ".join(f'"{column}"' for column in header)
    sql = f"COPY {table} ({columns}) FROM STDIN WITH (FORMAT csv, HEADER true, NULL '')"

    raw_connection = engine.raw_connection()
    try:
        with raw_connection.cursor() as cursor:
            with cursor.copy(sql) as copy:
                with path.open("rb") as handle:
                    for chunk in iter(lambda: handle.read(1024 * 1024), b""):
                        copy.write(chunk)
        raw_connection.commit()
    except Exception:
        raw_connection.rollback()
        raise
    finally:
        raw_connection.close()

    with path.open("rb") as handle:
        return max(sum(1 for _ in handle) - 1, 0)


def populate_spatial_columns(engine: Engine) -> None:
    sql = """
    UPDATE stops
    SET geom = ST_SetSRID(ST_MakePoint(stop_lon, stop_lat), 4326)
    WHERE stop_lon IS NOT NULL AND stop_lat IS NOT NULL;

    UPDATE shapes
    SET geom = ST_SetSRID(ST_MakePoint(shape_pt_lon, shape_pt_lat), 4326)
    WHERE shape_pt_lon IS NOT NULL AND shape_pt_lat IS NOT NULL;

    TRUNCATE TABLE shape_geometries;
    INSERT INTO shape_geometries (shape_id, geom, point_count)
    SELECT
        shape_id,
        ST_MakeLine(geom ORDER BY shape_pt_sequence)::geometry(LineString, 4326) AS geom,
        COUNT(*) AS point_count
    FROM shapes
    WHERE geom IS NOT NULL
    GROUP BY shape_id
    HAVING COUNT(*) > 1;
    """
    with engine.begin() as conn:
        conn.execute(text(sql))


def upsert_feed_version(
    engine: Engine,
    resource: dict[str, Any],
    zip_sha256: str,
    archive_path: Path,
    row_counts: dict[str, int],
) -> int:
    sql = text(
        """
        INSERT INTO feed_versions (
            source_name,
            source_url,
            portal_resource_id,
            portal_last_modified,
            zip_sha256,
            archive_path,
            row_counts
        )
        VALUES (
            :source_name,
            :source_url,
            :portal_resource_id,
            NULLIF(:portal_last_modified, '')::timestamptz,
            :zip_sha256,
            :archive_path,
            CAST(:row_counts AS jsonb)
        )
        ON CONFLICT (zip_sha256)
        DO UPDATE SET
            ingested_at = now(),
            archive_path = EXCLUDED.archive_path,
            row_counts = EXCLUDED.row_counts
        RETURNING feed_version_id
        """
    )
    with engine.begin() as conn:
        return int(
            conn.execute(
                sql,
                {
                    "source_name": resource.get("name", "TTC Routes and Schedules Data"),
                    "source_url": resource.get("url", ""),
                    "portal_resource_id": resource.get("id", ""),
                    "portal_last_modified": resource.get("last_modified")
                    or resource.get("metadata_modified")
                    or "",
                    "zip_sha256": zip_sha256,
                    "archive_path": str(archive_path),
                    "row_counts": json.dumps(row_counts, sort_keys=True),
                },
            ).scalar_one()
        )
