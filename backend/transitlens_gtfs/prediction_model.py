from __future__ import annotations

import json
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any

import joblib
import pandas as pd
import requests
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.inspection import permutation_importance
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

from sqlalchemy import text
from sqlalchemy.engine import Engine


FEATURE_COLUMNS = [
    "route_type",
    "route_number",
    "stop_count",
    "trip_count",
    "shape_count",
    "avg_shape_length_km",
    "hour",
    "day_of_week",
    "month",
    "is_weekend",
    "is_peak",
    "is_holiday",
    "is_school_term",
    "temperature_c",
    "precipitation_mm",
    "snowfall_cm",
    "wind_kmh",
    "lag_24h",
    "lag_168h",
]

ROUTE_FEATURE_SQL = """
WITH route_stop_counts AS (
    SELECT
        t.route_id,
        COUNT(DISTINCT st.stop_id) AS stop_count,
        COUNT(DISTINCT st.trip_id) AS trip_count
    FROM trips t
    JOIN stop_times st ON st.trip_id = t.trip_id
    GROUP BY t.route_id
),
route_shape_counts AS (
    SELECT
        t.route_id,
        COUNT(DISTINCT t.shape_id) AS shape_count,
        AVG(ST_Length(sg.geom::geography) / 1000.0) AS avg_shape_length_km
    FROM trips t
    LEFT JOIN shape_geometries sg ON sg.shape_id = t.shape_id
    GROUP BY t.route_id
)
SELECT
    r.route_id,
    COALESCE(r.route_type, 3) AS route_type,
    COALESCE(NULLIF(regexp_replace(COALESCE(r.route_short_name, r.route_id), '[^0-9]', '', 'g'), '')::integer, 0) AS route_number,
    COALESCE(rsc.stop_count, 0) AS stop_count,
    COALESCE(rsc.trip_count, 0) AS trip_count,
    COALESCE(rsh.shape_count, 0) AS shape_count,
    COALESCE(rsh.avg_shape_length_km, 0) AS avg_shape_length_km,
    srr.all_day_riders::double precision AS all_day_riders,
    srr.sample_date
FROM routes r
JOIN surface_route_ridership srr ON srr.route_id = r.route_id
LEFT JOIN route_stop_counts rsc ON rsc.route_id = r.route_id
LEFT JOIN route_shape_counts rsh ON rsh.route_id = r.route_id
WHERE srr.all_day_riders IS NOT NULL AND srr.all_day_riders > 0
"""


def _hour_weight(hour: int) -> float:
    weights = {
        0: 0.010,
        1: 0.006,
        2: 0.004,
        3: 0.003,
        4: 0.004,
        5: 0.020,
        6: 0.045,
        7: 0.075,
        8: 0.085,
        9: 0.070,
        10: 0.050,
        11: 0.045,
        12: 0.048,
        13: 0.050,
        14: 0.053,
        15: 0.060,
        16: 0.075,
        17: 0.085,
        18: 0.070,
        19: 0.047,
        20: 0.035,
        21: 0.026,
        22: 0.018,
        23: 0.011,
    }
    return weights[hour] / sum(weights.values())


def _ontario_holidays(year: int) -> set[date]:
    return {
        date(year, 1, 1),
        date(year, 7, 1),
        date(year, 12, 25),
        date(year, 12, 26),
    }


def _is_school_term(day: date) -> int:
    return int(day.month in {1, 2, 3, 4, 5, 9, 10, 11, 12})


def _fetch_weather(start: date, end: date) -> pd.DataFrame:
    url = "https://archive-api.open-meteo.com/v1/archive"
    params = {
        "latitude": 43.6532,
        "longitude": -79.3832,
        "start_date": start.isoformat(),
        "end_date": end.isoformat(),
        "hourly": "temperature_2m,precipitation,snowfall,wind_speed_10m",
        "timezone": "America/Toronto",
    }
    try:
        response = requests.get(url, params=params, timeout=45)
        response.raise_for_status()
        hourly = response.json()["hourly"]
        frame = pd.DataFrame(
            {
                "timestamp": pd.to_datetime(hourly["time"]),
                "temperature_c": hourly["temperature_2m"],
                "precipitation_mm": hourly["precipitation"],
                "snowfall_cm": hourly["snowfall"],
                "wind_kmh": hourly["wind_speed_10m"],
            }
        )
    except Exception:
        timestamps = pd.date_range(start=start, end=end + timedelta(days=1), freq="h")[:-1]
        frame = pd.DataFrame(
            {
                "timestamp": timestamps,
                "temperature_c": 4.0,
                "precipitation_mm": 0.0,
                "snowfall_cm": 0.0,
                "wind_kmh": 12.0,
            }
        )
    return frame.ffill().fillna(
        {"temperature_c": 4.0, "precipitation_mm": 0.0, "snowfall_cm": 0.0, "wind_kmh": 12.0}
    )


def _calendar_weather_factor(row: pd.Series) -> float:
    factor = 1.0
    if row["is_weekend"]:
        factor *= 0.72
    if row["is_holiday"]:
        factor *= 0.62
    if row["precipitation_mm"] > 0:
        factor *= max(0.88, 1.0 - min(float(row["precipitation_mm"]), 10.0) * 0.01)
    if row["snowfall_cm"] > 0:
        factor *= max(0.78, 1.0 - min(float(row["snowfall_cm"]), 8.0) * 0.025)
    if row["temperature_c"] < -10 or row["temperature_c"] > 30:
        factor *= 0.94
    return factor


def _training_frame(routes: pd.DataFrame) -> tuple[pd.DataFrame, datetime, datetime]:
    sample_end = pd.to_datetime(routes["sample_date"].max()).date()
    start = sample_end - timedelta(days=120)
    weather = _fetch_weather(start, sample_end)
    weather["day"] = weather["timestamp"].dt.date
    weather["hour"] = weather["timestamp"].dt.hour
    weather["day_of_week"] = weather["timestamp"].dt.dayofweek
    weather["month"] = weather["timestamp"].dt.month
    holidays = set().union(*(_ontario_holidays(year) for year in weather["timestamp"].dt.year.unique()))
    weather["is_weekend"] = (weather["day_of_week"] >= 5).astype(int)
    weather["is_peak"] = weather["hour"].isin([7, 8, 9, 16, 17, 18]).astype(int)
    weather["is_holiday"] = weather["day"].isin(holidays).astype(int)
    weather["is_school_term"] = weather["day"].map(_is_school_term)
    weather["calendar_weather_factor"] = weather.apply(_calendar_weather_factor, axis=1)

    rows: list[dict[str, Any]] = []
    for route in routes.to_dict("records"):
        for weather_row in weather.to_dict("records"):
            target = (
                float(route["all_day_riders"])
                * _hour_weight(int(weather_row["hour"]))
                * float(weather_row["calendar_weather_factor"])
            )
            rows.append(
                {
                    "route_id": route["route_id"],
                    "timestamp": weather_row["timestamp"],
                    "route_type": route["route_type"],
                    "route_number": route["route_number"],
                    "stop_count": route["stop_count"],
                    "trip_count": route["trip_count"],
                    "shape_count": route["shape_count"],
                    "avg_shape_length_km": route["avg_shape_length_km"],
                    "hour": weather_row["hour"],
                    "day_of_week": weather_row["day_of_week"],
                    "month": weather_row["month"],
                    "is_weekend": weather_row["is_weekend"],
                    "is_peak": weather_row["is_peak"],
                    "is_holiday": weather_row["is_holiday"],
                    "is_school_term": weather_row["is_school_term"],
                    "temperature_c": weather_row["temperature_c"],
                    "precipitation_mm": weather_row["precipitation_mm"],
                    "snowfall_cm": weather_row["snowfall_cm"],
                    "wind_kmh": weather_row["wind_kmh"],
                    "target": target,
                }
            )

    frame = pd.DataFrame(rows).sort_values(["route_id", "timestamp"])
    frame["lag_24h"] = frame.groupby("route_id")["target"].shift(24)
    frame["lag_168h"] = frame.groupby("route_id")["target"].shift(168)
    frame["lag_24h"] = frame["lag_24h"].fillna(frame["target"])
    frame["lag_168h"] = frame["lag_168h"].fillna(frame["lag_24h"])
    return frame, datetime.combine(start, datetime.min.time()), datetime.combine(sample_end, datetime.max.time())


def _metrics(actual: pd.Series, predicted: pd.Series) -> dict[str, float]:
    mae = float(mean_absolute_error(actual, predicted))
    rmse = float(mean_squared_error(actual, predicted) ** 0.5)
    denominator = actual.where(actual.abs() > 1, 1)
    mape = float(((actual - predicted).abs() / denominator).mean() * 100.0)
    return {
        "mae": round(mae, 3),
        "rmse": round(rmse, 3),
        "mape": round(mape, 3),
        "r2": round(float(r2_score(actual, predicted)), 5),
    }


def _chronological_split(frame: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    timestamps = sorted(frame["timestamp"].unique())
    train_cutoff = timestamps[int(len(timestamps) * 0.70)]
    validation_cutoff = timestamps[int(len(timestamps) * 0.85)]
    train = frame[frame["timestamp"] < train_cutoff]
    validation = frame[(frame["timestamp"] >= train_cutoff) & (frame["timestamp"] < validation_cutoff)]
    test = frame[frame["timestamp"] >= validation_cutoff]
    return train, validation, test


def train_ridership_model(engine: Engine, output_path: Path) -> dict[str, object]:
    with engine.connect() as conn:
        route_features = pd.read_sql(text(ROUTE_FEATURE_SQL), conn)
    if route_features.empty:
        raise RuntimeError("No surface route ridership rows are available for model training.")

    frame, training_start, training_end = _training_frame(route_features)
    train, validation, test = _chronological_split(frame)
    candidates = [
        {"max_iter": 180, "learning_rate": 0.08, "max_leaf_nodes": 31, "l2_regularization": 0.05},
        {"max_iter": 260, "learning_rate": 0.06, "max_leaf_nodes": 31, "l2_regularization": 0.05},
        {"max_iter": 220, "learning_rate": 0.08, "max_leaf_nodes": 45, "l2_regularization": 0.10},
    ]
    best_model = None
    best_params = None
    best_validation_rmse = float("inf")
    for params in candidates:
        candidate = HistGradientBoostingRegressor(random_state=42, **params)
        candidate.fit(train[FEATURE_COLUMNS], train["target"])
        validation_predictions = pd.Series(candidate.predict(validation[FEATURE_COLUMNS]))
        validation_metrics = _metrics(validation["target"].reset_index(drop=True), validation_predictions)
        if validation_metrics["rmse"] < best_validation_rmse:
            best_validation_rmse = validation_metrics["rmse"]
            best_model = candidate
            best_params = params

    assert best_model is not None and best_params is not None
    train_validation = pd.concat([train, validation], ignore_index=True)
    model = HistGradientBoostingRegressor(random_state=42, **best_params)
    model.fit(train_validation[FEATURE_COLUMNS], train_validation["target"])

    test_predictions = pd.Series(model.predict(test[FEATURE_COLUMNS]))
    test_metrics = _metrics(test["target"].reset_index(drop=True), test_predictions)
    validation_predictions = pd.Series(best_model.predict(validation[FEATURE_COLUMNS]))
    validation_metrics = _metrics(validation["target"].reset_index(drop=True), validation_predictions)
    importances = permutation_importance(
        model,
        test[FEATURE_COLUMNS],
        test["target"],
        n_repeats=5,
        random_state=42,
        n_jobs=-1,
    )
    feature_importance = dict(
        sorted(
            zip(FEATURE_COLUMNS, importances.importances_mean, strict=True),
            key=lambda item: item[1],
            reverse=True,
        )
    )

    bundle = {
        "model": model,
        "model_name": "hist_gradient_boosting_weather_calendar_ridership",
        "algorithm": "HistGradientBoostingRegressor",
        "feature_columns": FEATURE_COLUMNS,
        "route_feature_sql": ROUTE_FEATURE_SQL,
        "hyperparameters": best_params,
        "metrics": {"validation": validation_metrics, "test": test_metrics},
        "feature_importance": {key: round(float(value), 6) for key, value in feature_importance.items()},
        "training_start": training_start.isoformat(),
        "training_end": training_end.isoformat(),
        "training_rows": int(len(train_validation)),
        "validation_rows": int(len(validation)),
        "test_rows": int(len(test)),
        "source_route_rows": int(len(route_features)),
        "default_weather": {
            "temperature_c": float(frame["temperature_c"].median()),
            "precipitation_mm": 0.0,
            "snowfall_cm": 0.0,
            "wind_kmh": float(frame["wind_kmh"].median()),
        },
    }
    output_path.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(bundle, output_path)

    with engine.begin() as conn:
        conn.execute(text("UPDATE ml_model_versions SET active = false WHERE active = true"))
        model_version_id = conn.execute(
            text(
                """
                INSERT INTO ml_model_versions (
                    model_name, model_path, algorithm, training_start, training_end,
                    source_route_rows, training_rows, validation_rows, test_rows,
                    metrics, feature_columns, hyperparameters, active
                )
                VALUES (
                    :model_name, :model_path, :algorithm, :training_start, :training_end,
                    :source_route_rows, :training_rows, :validation_rows, :test_rows,
                    CAST(:metrics AS jsonb), CAST(:feature_columns AS jsonb), CAST(:hyperparameters AS jsonb), true
                )
                RETURNING model_version_id
                """
            ),
            {
                "model_name": bundle["model_name"],
                "model_path": str(output_path),
                "algorithm": bundle["algorithm"],
                "training_start": training_start,
                "training_end": training_end,
                "source_route_rows": bundle["source_route_rows"],
                "training_rows": bundle["training_rows"],
                "validation_rows": bundle["validation_rows"],
                "test_rows": bundle["test_rows"],
                "metrics": json.dumps(bundle["metrics"]),
                "feature_columns": json.dumps(FEATURE_COLUMNS),
                "hyperparameters": json.dumps(best_params),
            },
        ).scalar_one()

    return {
        "model_version_id": int(model_version_id),
        "model_path": str(output_path),
        "model_name": bundle["model_name"],
        "training_start": bundle["training_start"],
        "training_end": bundle["training_end"],
        "training_rows": bundle["training_rows"],
        "validation_rows": bundle["validation_rows"],
        "test_rows": bundle["test_rows"],
        "source_route_rows": bundle["source_route_rows"],
        "validation": validation_metrics,
        "test": test_metrics,
        "top_features": list(bundle["feature_importance"].keys())[:8],
    }
