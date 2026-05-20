from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pandas as pd
import requests
from sqlalchemy import text
from sqlalchemy.engine import Engine

from .config import PROJECT_ROOT


NEIGHBOURHOODS_URL = (
    "https://ckan0.cf.opendata.inter.prod-toronto.ca/dataset/"
    "fc443770-ef0a-4025-9c2c-2cb558bfab00/resource/"
    "0719053b-28b7-48ea-b863-068823a93aaa/download/neighbourhoods-4326.geojson"
)
PROFILES_URL = (
    "https://ckan0.cf.opendata.inter.prod-toronto.ca/dataset/"
    "6e19a90f-971c-46b3-852c-0c48c436d1fc/resource/"
    "19d4a806-7385-4889-acf2-256f1e079060/download/nbhd_2021_census_profile_full_158model.xlsx"
)

SOURCE_DIR = PROJECT_ROOT / "data" / "equity" / "sources"
NEIGHBOURHOODS_PATH = SOURCE_DIR / "neighbourhoods.geojson"
PROFILES_PATH = SOURCE_DIR / "neighbourhood_profiles_2021.xlsx"


def _download(url: str, path: Path, force: bool) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists() and not force:
        return
    response = requests.get(url, timeout=120)
    response.raise_for_status()
    path.write_bytes(response.content)


def download_equity_sources(force: bool = False) -> dict[str, str]:
    _download(NEIGHBOURHOODS_URL, NEIGHBOURHOODS_PATH, force)
    _download(PROFILES_URL, PROFILES_PATH, force)
    return {
        "neighbourhoods_geojson": str(NEIGHBOURHOODS_PATH),
        "neighbourhood_profiles_2021": str(PROFILES_PATH),
    }


def _clean_number(value: Any) -> float | None:
    if pd.isna(value):
        return None
    if isinstance(value, str):
        value = value.replace(",", "").strip()
        if value in {"", "x", "F", ".."}:
            return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _profile_lookup(
    frame: pd.DataFrame, row_label: str, occurrence: int = 0
) -> dict[str, float | None]:
    labels = frame.iloc[:, 0].astype(str).str.strip()
    matches = frame[labels == row_label.strip()]
    if matches.empty:
        raise RuntimeError(f"Could not find profile row: {row_label}")
    row = matches.iloc[occurrence]
    numbers = frame.iloc[1, 1:]
    values = row.iloc[1:]
    return {
        str(int(number)).zfill(3): _clean_number(value)
        for number, value in zip(numbers, values, strict=True)
        if not pd.isna(number)
    }


def _load_demographic_rows() -> list[dict[str, Any]]:
    frame = pd.read_excel(PROFILES_PATH, sheet_name="hd2021_census_profile", header=None)
    population = _profile_lookup(frame, "Total - Age groups of the population - 25% sample data")
    median_income = _profile_lookup(frame, "  Median total income in 2020 ($)")
    senior_share = _profile_lookup(frame, "65 years and over", occurrence=1)
    low_income_share = _profile_lookup(
        frame, "Prevalence of low income based on the Low-income measure, after tax (LIM-AT) (%)"
    )
    commute_total = _profile_lookup(
        frame,
        "Total - Main mode of commuting for the employed labour force aged 15 years and over with a usual place of work or no fixed workplace address - 25% sample data",
    )
    car_commute = _profile_lookup(frame, "  Car, truck or van")
    rows = []
    for area_id, pop in population.items():
        seniors = senior_share.get(area_id) or 0.0
        low_income = low_income_share.get(area_id) or 0.0
        commute_denominator = commute_total.get(area_id) or 0.0
        car_share = (
            ((car_commute.get(area_id) or 0.0) / commute_denominator) * 100.0
            if commute_denominator
            else None
        )
        vulnerable = max(0.0, min(100.0, seniors + low_income))
        rows.append(
            {
                "area_id": area_id,
                "population": pop,
                "median_income": median_income.get(area_id),
                "senior_share": seniors,
                "low_income_share": low_income,
                "vulnerable_share": vulnerable,
                "car_commute_share": car_share,
                "source_year": 2021,
                "source_url": PROFILES_URL,
            }
        )
    return rows


def _load_area_rows() -> list[dict[str, Any]]:
    data = json.loads(NEIGHBOURHOODS_PATH.read_text(encoding="utf-8"))
    rows = []
    for feature in data["features"]:
        props = feature["properties"]
        area_id = str(props["AREA_SHORT_CODE"])
        rows.append(
            {
                "area_id": area_id,
                "area_name": props["AREA_NAME"],
                "area_type": "neighbourhood",
                "source_area_id": str(props.get("AREA_ID") or ""),
                "classification": props.get("CLASSIFICATION"),
                "geojson": json.dumps(feature["geometry"]),
                "source_url": NEIGHBOURHOODS_URL,
            }
        )
    return rows


def load_equity_sources(engine: Engine, force_download: bool = False) -> dict[str, int]:
    download_equity_sources(force=force_download)
    area_rows = _load_area_rows()
    demographic_rows = _load_demographic_rows()
    with engine.begin() as conn:
        conn.execute(text("TRUNCATE TABLE equity_scores"))
        conn.execute(text("TRUNCATE TABLE equity_demographics"))
        conn.execute(text("TRUNCATE TABLE equity_areas CASCADE"))
        conn.execute(
            text(
                """
                INSERT INTO equity_areas (
                    area_id, area_name, area_type, source_area_id, classification, geom, source_url
                )
                VALUES (
                    :area_id, :area_name, :area_type, :source_area_id, :classification,
                    ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON(:geojson), 4326)),
                    :source_url
                )
                """
            ),
            area_rows,
        )
        conn.execute(
            text(
                """
                INSERT INTO equity_demographics (
                    area_id, population, median_income, senior_share, low_income_share,
                    vulnerable_share, car_commute_share, source_year, source_url
                )
                VALUES (
                    :area_id, :population, :median_income, :senior_share, :low_income_share,
                    :vulnerable_share, :car_commute_share, :source_year, :source_url
                )
                """
            ),
            demographic_rows,
        )
    return {"area_rows": len(area_rows), "demographic_rows": len(demographic_rows)}


BUILD_EQUITY_SQL = """
TRUNCATE TABLE equity_scores;

WITH area_base AS (
    SELECT
        a.area_id,
        a.area_name,
        a.area_type,
        a.classification,
        a.geom,
        GREATEST(ST_Area(a.geom::geography) / 1000000.0, 0.01) AS area_sq_km,
        ST_PointOnSurface(a.geom) AS representative_point
    FROM equity_areas a
),
stop_metrics AS (
    SELECT
        ab.area_id,
        COUNT(DISTINCT s.stop_id)::double precision AS stop_count,
        COUNT(DISTINCT t.route_id)::double precision AS route_count,
        COUNT(DISTINCT st.trip_id)::double precision AS trip_count,
        COUNT(DISTINCT s.stop_id) FILTER (WHERE t.route_id IN (
            SELECT route_id FROM routes WHERE route_type IN (0, 1)
        ))::double precision AS rapid_stop_count
    FROM area_base ab
    LEFT JOIN stops s ON s.geom IS NOT NULL AND ST_Intersects(s.geom, ab.geom)
    LEFT JOIN stop_times st ON st.stop_id = s.stop_id
    LEFT JOIN trips t ON t.trip_id = st.trip_id
    GROUP BY ab.area_id
),
area_routes AS (
    SELECT DISTINCT
        ab.area_id,
        t.route_id
    FROM area_base ab
    JOIN stops s ON s.geom IS NOT NULL AND ST_Intersects(s.geom, ab.geom)
    JOIN stop_times st ON st.stop_id = s.stop_id
    JOIN trips t ON t.trip_id = st.trip_id
),
ridership_metrics AS (
    SELECT
        ar.area_id,
        COALESCE(SUM(srr.all_day_riders), 0)::double precision AS surface_all_day_riders
    FROM area_routes ar
    LEFT JOIN surface_route_ridership srr ON srr.route_id = ar.route_id
    GROUP BY ar.area_id
),
distance_metrics AS (
    SELECT
        ab.area_id,
        MIN(ST_Distance(ab.representative_point::geography, s.geom::geography))::double precision AS distance_to_stop
    FROM area_base ab
    CROSS JOIN stops s
    WHERE s.geom IS NOT NULL
    GROUP BY ab.area_id
),
raw_metrics AS (
    SELECT
        ab.area_id,
        ab.area_name,
        ab.area_type,
        ab.classification,
        ab.geom,
        ab.area_sq_km,
        COALESCE(sm.stop_count, 0) AS stop_count,
        COALESCE(sm.route_count, 0) AS route_count,
        COALESCE(sm.trip_count, 0) AS trip_count,
        COALESCE(sm.rapid_stop_count, 0) AS rapid_stop_count,
        COALESCE(rm.surface_all_day_riders, 0) AS surface_all_day_riders,
        COALESCE(dm.distance_to_stop, 0) AS distance_to_stop,
        COALESCE(ed.population, 0) AS population,
        ed.median_income,
        COALESCE(ed.senior_share, 0) AS senior_share,
        COALESCE(ed.low_income_share, 0) AS low_income_share,
        COALESCE(ed.vulnerable_share, 0) AS vulnerable_share,
        ed.car_commute_share
    FROM area_base ab
    LEFT JOIN stop_metrics sm ON sm.area_id = ab.area_id
    LEFT JOIN ridership_metrics rm ON rm.area_id = ab.area_id
    LEFT JOIN distance_metrics dm ON dm.area_id = ab.area_id
    LEFT JOIN equity_demographics ed ON ed.area_id = ab.area_id
),
densities AS (
    SELECT
        *,
        stop_count / area_sq_km AS stop_density,
        route_count / area_sq_km AS route_density,
        trip_count / area_sq_km AS trip_density,
        CASE WHEN population > 0 THEN surface_all_day_riders / population ELSE 0 END AS ridership_per_capita,
        CASE WHEN rapid_stop_count > 0 THEN 1.0 ELSE 0.0 END AS rapid_transit_access
    FROM raw_metrics
),
normalized AS (
    SELECT
        *,
        COALESCE((stop_density - MIN(stop_density) OVER ()) / NULLIF(MAX(stop_density) OVER () - MIN(stop_density) OVER (), 0), 0) AS stop_density_norm,
        COALESCE((ridership_per_capita - MIN(ridership_per_capita) OVER ()) / NULLIF(MAX(ridership_per_capita) OVER () - MIN(ridership_per_capita) OVER (), 0), 0) AS ridership_norm,
        COALESCE(1.0 - ((median_income - MIN(median_income) OVER ()) / NULLIF(MAX(median_income) OVER () - MIN(median_income) OVER (), 0)), 0) AS income_need_norm,
        COALESCE((vulnerable_share - MIN(vulnerable_share) OVER ()) / NULLIF(MAX(vulnerable_share) OVER () - MIN(vulnerable_share) OVER (), 0), 0) AS vulnerable_norm,
        COALESCE(1.0 - ((distance_to_stop - MIN(distance_to_stop) OVER ()) / NULLIF(MAX(distance_to_stop) OVER () - MIN(distance_to_stop) OVER (), 0)), 0) AS distance_norm
    FROM densities
),
scored AS (
    SELECT
        *,
        LEAST(
            100.0,
            GREATEST(
                0.0,
                100.0 * (
                    0.30 * stop_density_norm
                    + 0.20 * ridership_norm
                    + 0.20 * income_need_norm
                    + 0.20 * vulnerable_norm
                    + 0.10 * distance_norm
                )
            )
        ) AS equity_score
    FROM normalized
)
INSERT INTO equity_scores (
    geography_id,
    geography_name,
    area_type,
    stop_density,
    ridership_per_capita,
    median_income,
    vulnerable_share,
    distance_to_stop,
    score,
    metrics,
    geom,
    computed_at
)
SELECT
    area_id,
    area_name,
    area_type,
    round(stop_density::numeric, 3)::double precision,
    round(ridership_per_capita::numeric, 3)::double precision,
    median_income,
    round(vulnerable_share::numeric, 3)::double precision,
    round(distance_to_stop::numeric, 1)::double precision,
    round(equity_score::numeric, 2)::double precision,
    jsonb_build_object(
        'method', 'Toronto neighbourhood equity score using City neighbourhoods and 2021 neighbourhood profiles',
        'score_meaning', 'Higher score indicates stronger equity alignment: transit access is higher in areas with higher measured need.',
        'priority_level',
        CASE
            WHEN equity_score < 40 THEN 'high_improvement_need'
            WHEN equity_score < 65 THEN 'medium_improvement_need'
            ELSE 'better_served'
        END,
        'classification', classification,
        'area_sq_km', round(area_sq_km::numeric, 3),
        'population', population::integer,
        'stop_count', stop_count::integer,
        'route_count', route_count::integer,
        'trip_count', trip_count::integer,
        'rapid_stop_count', rapid_stop_count::integer,
        'rapid_transit_access', rapid_transit_access,
        'surface_all_day_riders', surface_all_day_riders::integer,
        'route_density_per_sq_km', round(route_density::numeric, 3),
        'trip_density_per_sq_km', round(trip_density::numeric, 3),
        'senior_share', senior_share,
        'low_income_share', low_income_share,
        'car_commute_share', car_commute_share,
        'normalised_components', jsonb_build_object(
            'stop_density', round(stop_density_norm::numeric, 4),
            'ridership_per_capita', round(ridership_norm::numeric, 4),
            'income_need', round(income_need_norm::numeric, 4),
            'vulnerable_share', round(vulnerable_norm::numeric, 4),
            'distance_to_stop', round(distance_norm::numeric, 4)
        ),
        'weights', jsonb_build_object(
            'stop_density', 0.30,
            'ridership_per_capita', 0.20,
            'income_need', 0.20,
            'vulnerable_share', 0.20,
            'distance_to_stop', 0.10
        )
    ),
    geom,
    now()
FROM scored
ORDER BY area_id;
"""


def build_equity_scores(engine: Engine, force_download: bool = False) -> dict[str, object]:
    source_counts = load_equity_sources(engine, force_download=force_download)
    with engine.begin() as conn:
        conn.execute(text(BUILD_EQUITY_SQL))
        summary = conn.execute(
            text(
                """
                SELECT
                    COUNT(*) AS geography_count,
                    round(MIN(score)::numeric, 2)::double precision AS min_score,
                    round(AVG(score)::numeric, 2)::double precision AS avg_score,
                    round(MAX(score)::numeric, 2)::double precision AS max_score,
                    COUNT(*) FILTER (WHERE metrics ->> 'priority_level' = 'high_improvement_need') AS high_improvement_need_count,
                    COUNT(*) FILTER (WHERE metrics ->> 'priority_level' = 'medium_improvement_need') AS medium_improvement_need_count,
                    COUNT(*) FILTER (WHERE metrics ->> 'priority_level' = 'better_served') AS better_served_count
                FROM equity_scores
                """
            )
        ).mappings().one()
    return {**source_counts, **dict(summary)}


def validate_equity_scores(engine: Engine) -> dict[str, int]:
    with engine.connect() as conn:
        row = conn.execute(
            text(
                """
                SELECT
                    COUNT(*) AS equity_score_rows,
                    COUNT(*) FILTER (WHERE es.score < 0 OR es.score > 100) AS invalid_score_rows,
                    COUNT(*) FILTER (WHERE es.geom IS NULL OR NOT ST_IsValid(es.geom)) AS invalid_geometry_rows,
                    COUNT(*) FILTER (WHERE es.metrics IS NULL OR es.metrics = '{}'::jsonb) AS missing_metrics_rows,
                    COUNT(*) FILTER (WHERE ed.population IS NULL OR ed.population <= 0) AS missing_population_rows,
                    COUNT(*) FILTER (WHERE es.median_income IS NULL) AS missing_income_rows,
                    COUNT(*) FILTER (WHERE es.distance_to_stop IS NULL) AS missing_distance_rows
                FROM equity_scores es
                LEFT JOIN equity_demographics ed ON ed.area_id = es.geography_id
                """
            )
        ).mappings().one()
    return {key: int(value) for key, value in dict(row).items()}
