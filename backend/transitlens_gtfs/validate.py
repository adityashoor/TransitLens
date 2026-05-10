from __future__ import annotations

from pathlib import Path

from sqlalchemy import text
from sqlalchemy.engine import Engine


VALIDATION_SQL = {
    "missing_stop_times_trips": """
        SELECT COUNT(*)
        FROM stop_times st
        LEFT JOIN trips t ON t.trip_id = st.trip_id
        WHERE t.trip_id IS NULL
    """,
    "missing_stop_times_stops": """
        SELECT COUNT(*)
        FROM stop_times st
        LEFT JOIN stops s ON s.stop_id = st.stop_id
        WHERE s.stop_id IS NULL
    """,
    "missing_trips_routes": """
        SELECT COUNT(*)
        FROM trips t
        LEFT JOIN routes r ON r.route_id = t.route_id
        WHERE r.route_id IS NULL
    """,
    "missing_trips_calendar": """
        SELECT COUNT(*)
        FROM trips t
        LEFT JOIN calendar c ON c.service_id = t.service_id
        LEFT JOIN calendar_dates cd ON cd.service_id = t.service_id
        WHERE c.service_id IS NULL AND cd.service_id IS NULL
    """,
    "stops_without_geom": "SELECT COUNT(*) FROM stops WHERE geom IS NULL",
    "shapes_without_geom": "SELECT COUNT(*) FROM shapes WHERE geom IS NULL",
    "invalid_stop_coordinates": """
        SELECT COUNT(*)
        FROM stops
        WHERE stop_lat NOT BETWEEN -90 AND 90
           OR stop_lon NOT BETWEEN -180 AND 180
    """,
    "invalid_shape_coordinates": """
        SELECT COUNT(*)
        FROM shapes
        WHERE shape_pt_lat NOT BETWEEN -90 AND 90
           OR shape_pt_lon NOT BETWEEN -180 AND 180
    """,
    "empty_shape_lines": "SELECT COUNT(*) FROM shape_geometries WHERE ST_IsEmpty(geom)",
}


def database_row_counts(engine: Engine) -> dict[str, int]:
    tables = [
        "agency",
        "routes",
        "stops",
        "trips",
        "stop_times",
        "shapes",
        "calendar",
        "calendar_dates",
        "shape_geometries",
    ]
    with engine.connect() as conn:
        return {
            table: int(conn.execute(text(f"SELECT COUNT(*) FROM {table}")).scalar_one())
            for table in tables
        }


def file_row_counts(extract_dir: Path) -> dict[str, int]:
    counts: dict[str, int] = {}
    for path in extract_dir.glob("*.txt"):
        with path.open("rb") as handle:
            line_count = sum(1 for _ in handle)
        counts[path.stem] = max(line_count - 1, 0)
    return counts


def run_validations(engine: Engine, extract_dir: Path | None = None) -> dict[str, int | dict[str, int]]:
    results: dict[str, int | dict[str, int]] = {}
    with engine.connect() as conn:
        for name, sql in VALIDATION_SQL.items():
            results[name] = int(conn.execute(text(sql)).scalar_one())
    results["database_row_counts"] = database_row_counts(engine)
    if extract_dir is not None:
        results["file_row_counts"] = file_row_counts(extract_dir)
    return results


def assert_valid(results: dict[str, int | dict[str, int]]) -> None:
    failures = {key: value for key, value in results.items() if isinstance(value, int) and value != 0}
    if failures:
        raise RuntimeError(f"GTFS validation failed: {failures}")
