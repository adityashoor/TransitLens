from __future__ import annotations

import hashlib
import io
import re
import shutil
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable

import pandas as pd
import requests
from sqlalchemy import text
from sqlalchemy.engine import Engine

from .config import PROJECT_ROOT


RIDERSHIP_PACKAGE_URL = "https://ckan0.cf.opendata.inter.prod-toronto.ca/api/3/action/package_show?id=bike-share-toronto-ridership-data"
STATIONS_URL = "https://tor.publicbikesystem.net/ube/gbfs/v1/en/station_information"


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def bikeshare_resources() -> list[dict[str, Any]]:
    response = requests.get(RIDERSHIP_PACKAGE_URL, timeout=60)
    response.raise_for_status()
    resources = response.json()["result"].get("resources", [])
    return [
        resource
        for resource in resources
        if re.search(r"bikeshare-ridership-\d{4}", resource.get("name", ""))
    ]


def resource_year(resource: dict[str, Any]) -> int | None:
    match = re.search(r"(20\d{2}|2014)", resource.get("name", ""))
    return int(match.group(1)) if match else None


def select_resources(years: Iterable[int] | None = None) -> list[dict[str, Any]]:
    wanted = set(years or [])
    resources = bikeshare_resources()
    if wanted:
        resources = [resource for resource in resources if resource_year(resource) in wanted]
    return sorted(resources, key=lambda resource: resource_year(resource) or 0)


def download_resource(resource: dict[str, Any], force: bool = False) -> Path:
    raw_dir = PROJECT_ROOT / "data" / "bikeshare" / "raw"
    raw_dir.mkdir(parents=True, exist_ok=True)
    filename = Path(resource["url"].split("?")[0]).name or f"{resource['name']}.dat"
    path = raw_dir / filename
    expected_size = int(resource.get("size") or 0)
    if path.exists() and not force and (expected_size == 0 or path.stat().st_size == expected_size):
        return path
    temp_path = path.with_suffix(path.suffix + ".part")
    if temp_path.exists():
        temp_path.unlink()
    last_error: Exception | None = None
    for _ in range(3):
        try:
            with requests.get(resource["url"], stream=True, timeout=300) as response:
                response.raise_for_status()
                with temp_path.open("wb") as handle:
                    for chunk in response.iter_content(1024 * 1024):
                        if chunk:
                            handle.write(chunk)
            if expected_size and temp_path.stat().st_size != expected_size:
                raise RuntimeError(
                    f"Downloaded {temp_path.stat().st_size} bytes for {filename}; expected {expected_size}."
                )
            temp_path.replace(path)
            return path
        except Exception as exc:
            last_error = exc
            if temp_path.exists():
                temp_path.unlink()
    raise RuntimeError(f"Failed to download {resource['url']} after 3 attempts: {last_error}")
    return path


def archive_file(path: Path, year: int | None) -> Path:
    archive_dir = PROJECT_ROOT / "data" / "bikeshare" / "archives"
    archive_dir.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    digest = sha256_file(path)
    label = str(year) if year else "unknown"
    archive_path = archive_dir / f"bikeshare_{label}_{stamp}_{digest[:12]}{path.suffix}"
    if not archive_path.exists():
        shutil.copy2(path, archive_path)
    return archive_path


def load_stations(engine: Engine) -> int:
    response = requests.get(STATIONS_URL, timeout=60)
    response.raise_for_status()
    stations = response.json()["data"]["stations"]
    rows = [
        {
            "station_id": int(station["station_id"]),
            "name": station.get("name"),
            "lat": station.get("lat"),
            "lon": station.get("lon"),
            "capacity": station.get("capacity"),
            "source": "GBFS station_information",
        }
        for station in stations
        if str(station.get("station_id", "")).isdigit()
    ]
    df = pd.DataFrame.from_records(rows)
    with engine.begin() as conn:
        conn.execute(text("DROP TABLE IF EXISTS staging_bikeshare_stations"))
        conn.execute(
            text(
                "CREATE UNLOGGED TABLE staging_bikeshare_stations "
                "(LIKE bikeshare_stations INCLUDING DEFAULTS)"
            )
        )
    df.to_sql("staging_bikeshare_stations", engine, if_exists="append", index=False, method="multi")
    with engine.begin() as conn:
        conn.execute(
            text(
                """
                INSERT INTO bikeshare_stations (station_id, name, lat, lon, capacity, source, geom)
                SELECT
                    station_id,
                    name,
                    lat,
                    lon,
                    capacity,
                    source,
                    CASE
                        WHEN lon IS NOT NULL AND lat IS NOT NULL
                        THEN ST_SetSRID(ST_MakePoint(lon, lat), 4326)::geography
                        ELSE NULL
                    END
                FROM staging_bikeshare_stations
                ON CONFLICT (station_id)
                DO UPDATE SET
                    name = EXCLUDED.name,
                    lat = EXCLUDED.lat,
                    lon = EXCLUDED.lon,
                    capacity = EXCLUDED.capacity,
                    source = EXCLUDED.source,
                    last_seen_at = now(),
                    geom = EXCLUDED.geom
                """
            )
        )
        conn.execute(text("DROP TABLE IF EXISTS staging_bikeshare_stations"))
    return len(df)


def _canonical_column(column: str) -> str:
    normalized = re.sub(r"[^a-z0-9]+", "_", column.strip().lower()).strip("_")
    aliases = {
        "trip_id": "trip_id",
        "tripid": "trip_id",
        "trip_duration": "trip_duration",
        "trip_duration_seconds": "trip_duration",
        "duration": "trip_duration",
        "start_station_id": "start_station_id",
        "trip_start_station_id": "start_station_id",
        "from_station_id": "start_station_id",
        "start_time": "start_time",
        "trip_start_time": "start_time",
        "start_station_name": "start_station_name",
        "from_station_name": "start_station_name",
        "trip_start_station_location": "start_station_location",
        "start_station_location": "start_station_location",
        "end_station_id": "end_station_id",
        "trip_end_station_id": "end_station_id",
        "to_station_id": "end_station_id",
        "end_time": "end_time",
        "trip_stop_time": "end_time",
        "trip_end_time": "end_time",
        "end_station_name": "end_station_name",
        "to_station_name": "end_station_name",
        "trip_end_station_location": "end_station_location",
        "end_station_location": "end_station_location",
        "bike_id": "bike_id",
        "bike": "bike_id",
        "user_type": "user_type",
        "user": "user_type",
        "bike_model": "bike_model",
    }
    return aliases.get(normalized, normalized)


def _parse_location(value: Any) -> tuple[float | None, float | None]:
    if value is None or pd.isna(value):
        return None, None
    numbers = re.findall(r"-?\d+(?:\.\d+)?", str(value))
    if len(numbers) < 2:
        return None, None
    first, second = float(numbers[0]), float(numbers[1])
    # Toronto lon/lat strings usually include a negative longitude.
    if first < -70:
        return first, second
    return second, first


def normalize_chunk(chunk: pd.DataFrame, source_year: int | None, source_file: str) -> pd.DataFrame:
    chunk = chunk.rename(columns={column: _canonical_column(str(column)) for column in chunk.columns})
    output = pd.DataFrame()
    for column in [
        "trip_id",
        "trip_duration",
        "start_station_id",
        "end_station_id",
        "bike_id",
    ]:
        output[column] = pd.to_numeric(chunk.get(column), errors="coerce")

    output["start_time"] = _parse_datetime_series(chunk.get("start_time"))
    output["end_time"] = _parse_datetime_series(chunk.get("end_time"))
    output["start_station_name"] = chunk.get("start_station_name")
    output["end_station_name"] = chunk.get("end_station_name")
    output["user_type"] = chunk.get("user_type")
    output["bike_model"] = chunk.get("bike_model")
    output["source_year"] = source_year
    output["source_file"] = source_file

    if "start_station_location" in chunk:
        locations = chunk["start_station_location"].map(_parse_location)
        output["start_station_lon"] = pd.to_numeric([lon for lon, _ in locations], errors="coerce")
        output["start_station_lat"] = pd.to_numeric([lat for _, lat in locations], errors="coerce")
    else:
        output["start_station_lon"] = pd.Series([float("nan")] * len(output), dtype="float64")
        output["start_station_lat"] = pd.Series([float("nan")] * len(output), dtype="float64")

    if "end_station_location" in chunk:
        locations = chunk["end_station_location"].map(_parse_location)
        output["end_station_lon"] = pd.to_numeric([lon for lon, _ in locations], errors="coerce")
        output["end_station_lat"] = pd.to_numeric([lat for _, lat in locations], errors="coerce")
    else:
        output["end_station_lon"] = pd.Series([float("nan")] * len(output), dtype="float64")
        output["end_station_lat"] = pd.Series([float("nan")] * len(output), dtype="float64")

    for column in ["trip_id", "trip_duration", "start_station_id", "end_station_id", "bike_id"]:
        output[column] = output[column].astype("Int64")
    output = output.dropna(subset=["trip_id"])
    output = output[output["trip_duration"].isna() | (output["trip_duration"] > 0)]
    output = output.drop_duplicates(subset=["trip_id"])
    return output


def _parse_datetime_series(series: pd.Series | None) -> pd.Series:
    if series is None:
        return pd.Series(dtype="datetime64[ns]")
    values = series.astype("string")
    iso_mask = values.str.match(r"^\d{4}-\d{2}-\d{2}", na=False)
    parsed = pd.Series(pd.NaT, index=series.index, dtype="datetime64[ns]")
    if iso_mask.any():
        parsed.loc[iso_mask] = pd.to_datetime(values.loc[iso_mask], errors="coerce")
    if (~iso_mask).any():
        parsed.loc[~iso_mask] = pd.to_datetime(
            values.loc[~iso_mask], errors="coerce", dayfirst=False
        )
    return parsed


def _dataframes_from_path(path: Path, year: int | None, chunksize: int):
    if path.suffix.lower() == ".zip":
        with zipfile.ZipFile(path) as archive:
            for name in archive.namelist():
                if not name.lower().endswith(".csv"):
                    continue
                with archive.open(name) as handle:
                    for chunk in pd.read_csv(
                        handle,
                        chunksize=chunksize,
                        low_memory=False,
                        encoding="utf-8-sig",
                        encoding_errors="replace",
                    ):
                        yield normalize_chunk(chunk, year, Path(name).name)
    elif path.suffix.lower() in {".xlsx", ".xls"}:
        workbook = pd.read_excel(path, sheet_name=None)
        for sheet_name, df in workbook.items():
            yield normalize_chunk(df, year, f"{path.name}:{sheet_name}")
    elif path.suffix.lower() == ".csv":
        for chunk in pd.read_csv(
            path,
            chunksize=chunksize,
            low_memory=False,
            encoding="utf-8-sig",
            encoding_errors="replace",
        ):
            yield normalize_chunk(chunk, year, path.name)
    else:
        raise RuntimeError(f"Unsupported Bike Share file type: {path}")


def _ensure_staging(engine: Engine) -> None:
    with engine.begin() as conn:
        conn.execute(text("DROP TABLE IF EXISTS staging_bikeshare_trips"))
        conn.execute(text("CREATE UNLOGGED TABLE staging_bikeshare_trips (LIKE bikeshare_trips INCLUDING DEFAULTS)"))


def _copy_dataframe(engine: Engine, table: str, frame: pd.DataFrame) -> None:
    buffer = io.StringIO()
    frame.to_csv(buffer, index=False, na_rep="")
    buffer.seek(0)
    columns = ", ".join(f'"{column}"' for column in frame.columns)
    sql = f"COPY {table} ({columns}) FROM STDIN WITH (FORMAT csv, HEADER true, NULL '')"
    raw_connection = engine.raw_connection()
    try:
        with raw_connection.cursor() as cursor:
            with cursor.copy(sql) as copy:
                copy.write(buffer.getvalue())
        raw_connection.commit()
    except Exception:
        raw_connection.rollback()
        raise
    finally:
        raw_connection.close()


def ingest_legacy_2014_2015(engine: Engine, path: Path) -> int:
    workbook = pd.ExcelFile(path)
    station_rows: list[dict[str, Any]] = []
    if "Station Key" in workbook.sheet_names:
        station_key = pd.read_excel(path, sheet_name="Station Key")
        station_key = station_key.rename(
            columns={
                "Terminal": "station_id",
                "Station": "name",
                "Latitude": "lat",
                "Longitude": "lon",
                "Docks": "capacity",
            }
        )
        for _, row in station_key.iterrows():
            if pd.isna(row.get("station_id")):
                continue
            station_rows.append(
                {
                    "station_id": int(row["station_id"]),
                    "name": row.get("name"),
                    "lat": pd.to_numeric(row.get("lat"), errors="coerce"),
                    "lon": pd.to_numeric(row.get("lon"), errors="coerce"),
                    "capacity": pd.to_numeric(row.get("capacity"), errors="coerce"),
                    "source": "2014-2015 Station Key",
                }
            )
    if station_rows:
        stations = pd.DataFrame.from_records(station_rows)
        with engine.begin() as conn:
            conn.execute(text("DROP TABLE IF EXISTS staging_bikeshare_stations"))
            conn.execute(
                text(
                    "CREATE UNLOGGED TABLE staging_bikeshare_stations "
                    "(LIKE bikeshare_stations INCLUDING DEFAULTS)"
                )
            )
        _copy_dataframe(engine, "staging_bikeshare_stations", stations)
        with engine.begin() as conn:
            conn.execute(
                text(
                    """
                    INSERT INTO bikeshare_stations (station_id, name, lat, lon, capacity, source, geom)
                    SELECT
                        station_id,
                        name,
                        lat,
                        lon,
                        capacity,
                        source,
                        ST_SetSRID(ST_MakePoint(lon, lat), 4326)::geography
                    FROM staging_bikeshare_stations
                    WHERE lat IS NOT NULL AND lon IS NOT NULL
                    ON CONFLICT (station_id)
                    DO UPDATE SET
                        name = COALESCE(bikeshare_stations.name, EXCLUDED.name),
                        lat = COALESCE(bikeshare_stations.lat, EXCLUDED.lat),
                        lon = COALESCE(bikeshare_stations.lon, EXCLUDED.lon),
                        capacity = COALESCE(bikeshare_stations.capacity, EXCLUDED.capacity),
                        source = CASE
                            WHEN bikeshare_stations.geom IS NULL THEN EXCLUDED.source
                            ELSE bikeshare_stations.source
                        END,
                        geom = COALESCE(bikeshare_stations.geom, EXCLUDED.geom),
                        last_seen_at = now()
                    """
                )
            )
            conn.execute(text("DROP TABLE IF EXISTS staging_bikeshare_stations"))

    od_frames: list[pd.DataFrame] = []
    for sheet_name in workbook.sheet_names:
        if not re.search(r"20\d{2}-\d{2}", sheet_name):
            continue
        raw = pd.read_excel(path, sheet_name=sheet_name, header=None)
        service_month_raw = str(raw.iloc[0, 0])
        match = re.search(r"(20\d{2})-(\d{2})", service_month_raw)
        if not match:
            continue
        service_month = datetime(int(match.group(1)), int(match.group(2)), 1).date()
        frame = pd.read_excel(path, sheet_name=sheet_name, header=1)
        frame = frame.rename(
            columns={
                "Start Terminal": "start_station_id",
                "End Terminal": "end_station_id",
                "Casual": "casual_trips",
                "Registered": "registered_trips",
                "Total": "total_trips",
            }
        )
        needed = [
            "start_station_id",
            "end_station_id",
            "casual_trips",
            "registered_trips",
            "total_trips",
        ]
        if not set(needed).issubset(frame.columns):
            continue
        frame = frame[needed]
        frame["service_month"] = service_month
        frame["source_file"] = f"{path.name}:{sheet_name}"
        for column in [
            "start_station_id",
            "end_station_id",
            "casual_trips",
            "registered_trips",
            "total_trips",
        ]:
            frame[column] = pd.to_numeric(frame[column], errors="coerce").astype("Int64")
        frame = frame.dropna(subset=["start_station_id", "end_station_id"])
        od_frames.append(frame)

    if not od_frames:
        return 0
    od = pd.concat(od_frames, ignore_index=True)
    columns = [
        "service_month",
        "start_station_id",
        "end_station_id",
        "casual_trips",
        "registered_trips",
        "total_trips",
        "source_file",
    ]
    od = od[columns]
    od["source_file"] = od["source_file"].astype(str)
    od = (
        od.groupby(["service_month", "start_station_id", "end_station_id"], as_index=False)
        .agg(
            casual_trips=("casual_trips", "sum"),
            registered_trips=("registered_trips", "sum"),
            total_trips=("total_trips", "sum"),
            source_file=("source_file", "; ".join),
        )
    )
    with engine.begin() as conn:
        conn.execute(text("DROP TABLE IF EXISTS staging_bikeshare_legacy_od_ridership"))
        conn.execute(
            text(
                "CREATE UNLOGGED TABLE staging_bikeshare_legacy_od_ridership "
                "(LIKE bikeshare_legacy_od_ridership INCLUDING DEFAULTS)"
            )
        )
    _copy_dataframe(engine, "staging_bikeshare_legacy_od_ridership", od)
    with engine.begin() as conn:
        conn.execute(
            text(
                """
                INSERT INTO bikeshare_legacy_od_ridership (
                    service_month,
                    start_station_id,
                    end_station_id,
                    casual_trips,
                    registered_trips,
                    total_trips,
                    source_file
                )
                SELECT
                    service_month,
                    start_station_id,
                    end_station_id,
                    casual_trips,
                    registered_trips,
                    total_trips,
                    source_file
                FROM staging_bikeshare_legacy_od_ridership
                ON CONFLICT (service_month, start_station_id, end_station_id)
                DO UPDATE SET
                    casual_trips = EXCLUDED.casual_trips,
                    registered_trips = EXCLUDED.registered_trips,
                    total_trips = EXCLUDED.total_trips,
                    source_file = EXCLUDED.source_file,
                    ingested_at = now()
                """
            )
        )
        conn.execute(text("DROP TABLE IF EXISTS staging_bikeshare_legacy_od_ridership"))
    return len(od)


def _upsert_stations_from_staging(conn) -> None:
    conn.execute(
        text(
            """
            INSERT INTO bikeshare_stations (station_id, name, lat, lon, source, geom)
            SELECT DISTINCT ON (station_id)
                station_id,
                station_name,
                lat,
                lon,
                'derived from trip file',
                ST_SetSRID(ST_MakePoint(lon, lat), 4326)::geography
            FROM (
                SELECT
                    start_station_id AS station_id,
                    start_station_name AS station_name,
                    start_station_lat AS lat,
                    start_station_lon AS lon
                FROM staging_bikeshare_trips
                WHERE start_station_id IS NOT NULL
                  AND start_station_lat IS NOT NULL
                  AND start_station_lon IS NOT NULL
                UNION ALL
                SELECT
                    end_station_id AS station_id,
                    end_station_name AS station_name,
                    end_station_lat AS lat,
                    end_station_lon AS lon
                FROM staging_bikeshare_trips
                WHERE end_station_id IS NOT NULL
                  AND end_station_lat IS NOT NULL
                  AND end_station_lon IS NOT NULL
            ) station_candidates
            WHERE lat BETWEEN -90 AND 90 AND lon BETWEEN -180 AND 180
            ORDER BY station_id, station_name NULLS LAST
            ON CONFLICT (station_id)
            DO UPDATE SET
                name = COALESCE(bikeshare_stations.name, EXCLUDED.name),
                lat = COALESCE(bikeshare_stations.lat, EXCLUDED.lat),
                lon = COALESCE(bikeshare_stations.lon, EXCLUDED.lon),
                source = CASE
                    WHEN bikeshare_stations.geom IS NULL THEN EXCLUDED.source
                    ELSE bikeshare_stations.source
                END,
                geom = COALESCE(bikeshare_stations.geom, EXCLUDED.geom),
                last_seen_at = now()
            """
        )
    )


def _flush_staging(engine: Engine) -> None:
    with engine.begin() as conn:
        _upsert_stations_from_staging(conn)
        conn.execute(
            text(
                """
                INSERT INTO bikeshare_trips (
                    trip_id,
                    trip_duration,
                    start_station_id,
                    start_station_name,
                    start_time,
                    start_station_lon,
                    start_station_lat,
                    end_station_id,
                    end_station_name,
                    end_time,
                    end_station_lon,
                    end_station_lat,
                    bike_id,
                    user_type,
                    bike_model,
                    source_year,
                    source_file,
                    geom_start,
                    geom_end
                )
                SELECT
                    trip_id,
                    trip_duration,
                    start_station_id,
                    start_station_name,
                    start_time,
                    COALESCE(start_station_lon, start_station.lon),
                    COALESCE(start_station_lat, start_station.lat),
                    end_station_id,
                    end_station_name,
                    end_time,
                    COALESCE(end_station_lon, end_station.lon),
                    COALESCE(end_station_lat, end_station.lat),
                    bike_id,
                    user_type,
                    bike_model,
                    source_year,
                    source_file,
                    CASE
                        WHEN COALESCE(start_station_lon, start_station.lon) IS NOT NULL
                         AND COALESCE(start_station_lat, start_station.lat) IS NOT NULL
                        THEN ST_SetSRID(
                            ST_MakePoint(
                                COALESCE(start_station_lon, start_station.lon),
                                COALESCE(start_station_lat, start_station.lat)
                            ),
                            4326
                        )::geography
                        ELSE NULL
                    END,
                    CASE
                        WHEN COALESCE(end_station_lon, end_station.lon) IS NOT NULL
                         AND COALESCE(end_station_lat, end_station.lat) IS NOT NULL
                        THEN ST_SetSRID(
                            ST_MakePoint(
                                COALESCE(end_station_lon, end_station.lon),
                                COALESCE(end_station_lat, end_station.lat)
                            ),
                            4326
                        )::geography
                        ELSE NULL
                    END
                FROM staging_bikeshare_trips staged
                LEFT JOIN bikeshare_stations start_station
                    ON start_station.station_id = staged.start_station_id
                LEFT JOIN bikeshare_stations end_station
                    ON end_station.station_id = staged.end_station_id
                ON CONFLICT (trip_id)
                DO UPDATE SET
                    trip_duration = EXCLUDED.trip_duration,
                    start_station_id = EXCLUDED.start_station_id,
                    start_station_name = EXCLUDED.start_station_name,
                    start_time = EXCLUDED.start_time,
                    start_station_lon = EXCLUDED.start_station_lon,
                    start_station_lat = EXCLUDED.start_station_lat,
                    end_station_id = EXCLUDED.end_station_id,
                    end_station_name = EXCLUDED.end_station_name,
                    end_time = EXCLUDED.end_time,
                    end_station_lon = EXCLUDED.end_station_lon,
                    end_station_lat = EXCLUDED.end_station_lat,
                    bike_id = EXCLUDED.bike_id,
                    user_type = EXCLUDED.user_type,
                    bike_model = EXCLUDED.bike_model,
                    source_year = EXCLUDED.source_year,
                    source_file = EXCLUDED.source_file,
                    ingested_at = now(),
                    geom_start = EXCLUDED.geom_start,
                    geom_end = EXCLUDED.geom_end
                """
            )
        )
        conn.execute(text("TRUNCATE TABLE staging_bikeshare_trips"))


def refresh_missing_trip_geometry(engine: Engine) -> None:
    with engine.begin() as conn:
        conn.execute(
            text(
                """
                DROP TABLE IF EXISTS staging_bikeshare_station_names;
                CREATE TEMP TABLE staging_bikeshare_station_names AS
                SELECT DISTINCT ON (lower(trim(name)))
                    lower(trim(name)) AS station_name_key,
                    station_id,
                    lat,
                    lon,
                    geom
                FROM bikeshare_stations
                WHERE name IS NOT NULL AND geom IS NOT NULL
                ORDER BY lower(trim(name)), last_seen_at DESC;
                CREATE INDEX ON staging_bikeshare_station_names(station_name_key);
                """
            )
        )
        conn.execute(
            text(
                """
                UPDATE bikeshare_trips trips
                SET
                    start_station_lon = COALESCE(trips.start_station_lon, stations.lon),
                    start_station_lat = COALESCE(trips.start_station_lat, stations.lat),
                    geom_start = COALESCE(
                        trips.geom_start,
                        CASE
                            WHEN stations.lon IS NOT NULL AND stations.lat IS NOT NULL
                            THEN ST_SetSRID(ST_MakePoint(stations.lon, stations.lat), 4326)::geography
                            ELSE NULL
                        END
                    )
                FROM bikeshare_stations stations
                WHERE trips.start_station_id = stations.station_id
                  AND trips.geom_start IS NULL
                """
            )
        )
        conn.execute(
            text(
                """
                UPDATE bikeshare_trips trips
                SET
                    start_station_id = COALESCE(trips.start_station_id, stations.station_id),
                    start_station_lon = COALESCE(trips.start_station_lon, stations.lon),
                    start_station_lat = COALESCE(trips.start_station_lat, stations.lat),
                    geom_start = COALESCE(trips.geom_start, stations.geom)
                FROM staging_bikeshare_station_names stations
                WHERE lower(trim(trips.start_station_name)) = stations.station_name_key
                  AND trips.geom_start IS NULL
                """
            )
        )
        conn.execute(
            text(
                """
                UPDATE bikeshare_trips trips
                SET
                    end_station_id = COALESCE(trips.end_station_id, stations.station_id),
                    end_station_lon = COALESCE(trips.end_station_lon, stations.lon),
                    end_station_lat = COALESCE(trips.end_station_lat, stations.lat),
                    geom_end = COALESCE(trips.geom_end, stations.geom)
                FROM staging_bikeshare_station_names stations
                WHERE lower(trim(trips.end_station_name)) = stations.station_name_key
                  AND trips.geom_end IS NULL
                """
            )
        )
        conn.execute(
            text(
                """
                UPDATE bikeshare_trips trips
                SET
                    end_station_lon = COALESCE(trips.end_station_lon, stations.lon),
                    end_station_lat = COALESCE(trips.end_station_lat, stations.lat),
                    geom_end = COALESCE(
                        trips.geom_end,
                        CASE
                            WHEN stations.lon IS NOT NULL AND stations.lat IS NOT NULL
                            THEN ST_SetSRID(ST_MakePoint(stations.lon, stations.lat), 4326)::geography
                            ELSE NULL
                        END
                    )
                FROM bikeshare_stations stations
                WHERE trips.end_station_id = stations.station_id
                  AND trips.geom_end IS NULL
                """
            )
        )


def ingest_file(engine: Engine, path: Path, resource: dict[str, Any], chunksize: int = 100_000) -> int:
    year = resource_year(resource)
    if year == 2014 and path.suffix.lower() in {".xlsx", ".xls"}:
        row_count = ingest_legacy_2014_2015(engine, path)
        archive_path = archive_file(path, year)
        record_ingestion_run(engine, resource, path, archive_path, row_count)
        return row_count
    _ensure_staging(engine)
    row_count = 0
    for chunk in _dataframes_from_path(path, year, chunksize):
        if chunk.empty:
            continue
        _copy_dataframe(engine, "staging_bikeshare_trips", chunk)
        row_count += len(chunk)
        _flush_staging(engine)
    with engine.begin() as conn:
        conn.execute(text("DROP TABLE IF EXISTS staging_bikeshare_trips"))
    archive_path = archive_file(path, year)
    record_ingestion_run(engine, resource, path, archive_path, row_count)
    return row_count


def record_ingestion_run(
    engine: Engine,
    resource: dict[str, Any],
    source_path: Path,
    archive_path: Path,
    row_count: int,
) -> int:
    with engine.begin() as conn:
        return int(
            conn.execute(
                text(
                    """
                    INSERT INTO bikeshare_ingestion_runs (
                        resource_name,
                        source_url,
                        portal_resource_id,
                        portal_last_modified,
                        source_year,
                        file_sha256,
                        archive_path,
                        row_count,
                        notes
                    )
                    VALUES (
                        :resource_name,
                        :source_url,
                        :portal_resource_id,
                        NULLIF(:portal_last_modified, '')::timestamptz,
                        :source_year,
                        :file_sha256,
                        :archive_path,
                        :row_count,
                        :notes
                    )
                    ON CONFLICT (file_sha256)
                    DO UPDATE SET
                        ingested_at = now(),
                        archive_path = EXCLUDED.archive_path,
                        row_count = EXCLUDED.row_count
                    RETURNING bikeshare_ingestion_id
                    """
                ),
                {
                    "resource_name": resource.get("name", ""),
                    "source_url": resource.get("url", ""),
                    "portal_resource_id": resource.get("id", ""),
                    "portal_last_modified": resource.get("last_modified")
                    or resource.get("metadata_modified")
                    or "",
                    "source_year": resource_year(resource),
                    "file_sha256": sha256_file(source_path),
                    "archive_path": str(archive_path),
                    "row_count": row_count,
                    "notes": "2014-2015 and 2016 files may differ from later CSV ZIP resources due to provider/software changes.",
                },
            ).scalar_one()
        )


def validate_bikeshare(engine: Engine) -> dict[str, int]:
    checks = {
        "bikeshare_trips_rows": "SELECT COUNT(*) FROM bikeshare_trips",
        "bikeshare_stations_rows": "SELECT COUNT(*) FROM bikeshare_stations",
        "bikeshare_legacy_od_rows": "SELECT COUNT(*) FROM bikeshare_legacy_od_ridership",
        "nonpositive_duration_rows": "SELECT COUNT(*) FROM bikeshare_trips WHERE trip_duration <= 0",
        "over_24_hour_duration_rows": "SELECT COUNT(*) FROM bikeshare_trips WHERE trip_duration >= 86400",
        "missing_start_geometry_rows": "SELECT COUNT(*) FROM bikeshare_trips WHERE geom_start IS NULL",
        "missing_end_geometry_rows": "SELECT COUNT(*) FROM bikeshare_trips WHERE geom_end IS NULL",
        "zero_coordinate_rows": """
            SELECT COUNT(*)
            FROM bikeshare_trips
            WHERE start_station_lon = 0
               OR start_station_lat = 0
               OR end_station_lon = 0
               OR end_station_lat = 0
        """,
        "duplicate_trip_ids": """
            SELECT COUNT(*)
            FROM (
                SELECT trip_id
                FROM bikeshare_trips
                GROUP BY trip_id
                HAVING COUNT(*) > 1
            ) duplicates
        """,
    }
    with engine.connect() as conn:
        return {name: int(conn.execute(text(sql)).scalar_one()) for name, sql in checks.items()}


def ingest_bikeshare(
    engine: Engine,
    years: list[int] | None = None,
    force_download: bool = False,
    chunksize: int = 100_000,
) -> dict[str, Any]:
    station_count = load_stations(engine)
    resources = select_resources(years)
    row_counts: dict[str, int] = {}
    for resource in resources:
        path = download_resource(resource, force=force_download)
        row_counts[resource.get("name", path.name)] = ingest_file(
            engine, path, resource, chunksize=chunksize
        )
    refresh_missing_trip_geometry(engine)
    return {
        "station_count": station_count,
        "row_counts": row_counts,
        "validation": validate_bikeshare(engine),
    }
