from __future__ import annotations

import json
from datetime import date, datetime, timedelta
from pathlib import Path

import joblib
import pandas as pd
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings

DEFAULT_MODEL_PATH = Path(__file__).resolve().parents[2] / "models" / "ridership_model.joblib"


class PredictionService:
    def __init__(self) -> None:
        settings = get_settings()
        self.model = None
        self.bundle = None
        self.feature_columns: list[str] = []
        self.route_feature_sql: str | None = None
        self.mae: float | None = None
        self.metrics: dict = {}
        self.default_weather = {
            "temperature_c": 4.0,
            "precipitation_mm": 0.0,
            "snowfall_cm": 0.0,
            "wind_kmh": 12.0,
        }
        self.model_name = "baseline_surface_ridership"
        candidate = Path(settings.prediction_model_path) if settings.prediction_model_path else DEFAULT_MODEL_PATH
        if candidate.exists():
            self.bundle = joblib.load(candidate)
            if isinstance(self.bundle, dict) and "model" in self.bundle:
                self.model = self.bundle["model"]
                self.feature_columns = list(self.bundle.get("feature_columns", []))
                self.route_feature_sql = self.bundle.get("route_feature_sql")
                self.metrics = dict(self.bundle.get("metrics", {}))
                self.mae = self.metrics.get("test", {}).get("mae") or self.bundle.get("mae")
                self.default_weather.update(self.bundle.get("default_weather", {}))
                self.model_name = self.bundle.get("model_name", candidate.name)
            else:
                self.model = self.bundle
                self.model_name = candidate.name

    async def predict(
        self,
        session: AsyncSession,
        route_id: str,
        start_time: datetime,
        end_time: datetime,
        weather: str | None,
        temperature_c: float | None = None,
        precipitation_mm: float | None = None,
        snowfall_cm: float | None = None,
        wind_kmh: float | None = None,
    ):
        if end_time <= start_time:
            raise ValueError("end_time must be after start_time")
        if self.model is not None and self.route_feature_sql and self.feature_columns:
            model_result = await self._predict_with_model(
                session,
                route_id,
                start_time,
                end_time,
                weather,
                temperature_c=temperature_c,
                precipitation_mm=precipitation_mm,
                snowfall_cm=snowfall_cm,
                wind_kmh=wind_kmh,
            )
            if model_result is not None:
                await self._record_prediction(session, model_result, start_time, end_time, weather)
                return model_result

        surface = await session.execute(
            text(
                """
                SELECT all_day_riders
                FROM surface_route_ridership
                WHERE route_id = :route_id
                """
            ),
            {"route_id": route_id},
        )
        base = surface.scalar_one_or_none()
        if base is None:
            route_exists = await session.execute(
                text("SELECT 1 FROM routes WHERE route_id = :route_id"), {"route_id": route_id}
            )
            if route_exists.scalar_one_or_none() is None:
                return None
            base = 1000
        hourly_base = max(float(base) / 18.0, 1.0)
        points = []
        current = start_time.replace(minute=0, second=0, microsecond=0)
        while current < end_time:
            hour_factor = 1.0
            if 7 <= current.hour <= 9 or 16 <= current.hour <= 18:
                hour_factor = 1.35
            elif current.hour < 6 or current.hour > 22:
                hour_factor = 0.35
            weekend_factor = 0.72 if current.weekday() >= 5 else 1.0
            weather_factor = 0.92 if weather and weather.lower() in {"rain", "snow"} else 1.0
            predicted = hourly_base * hour_factor * weekend_factor * weather_factor
            points.append(
                {
                    "timestamp": current,
                    "predicted_riders": round(predicted, 2),
                    "lower_bound": round(predicted * 0.85, 2),
                    "upper_bound": round(predicted * 1.15, 2),
                }
            )
            current += timedelta(hours=1)
        result = {"route_id": route_id, "model": self.model_name, "model_metrics": {}, "points": points}
        await self._record_prediction(session, result, start_time, end_time, weather)
        return result

    async def _predict_with_model(
        self,
        session: AsyncSession,
        route_id: str,
        start_time: datetime,
        end_time: datetime,
        weather: str | None,
        temperature_c: float | None = None,
        precipitation_mm: float | None = None,
        snowfall_cm: float | None = None,
        wind_kmh: float | None = None,
    ):
        route_result = await session.execute(
            text(f"SELECT * FROM ({self.route_feature_sql}) route_features WHERE route_id = :route_id"),
            {"route_id": route_id},
        )
        route = route_result.mappings().first()
        if route is None:
            route_exists = await session.execute(
                text("SELECT 1 FROM routes WHERE route_id = :route_id"), {"route_id": route_id}
            )
            return None if route_exists.scalar_one_or_none() is None else None

        weather_features = self._weather_features(
            weather,
            temperature_c=temperature_c,
            precipitation_mm=precipitation_mm,
            snowfall_cm=snowfall_cm,
            wind_kmh=wind_kmh,
        )
        rows = []
        timestamps = []
        current = start_time.replace(minute=0, second=0, microsecond=0)
        while current < end_time:
            timestamps.append(current)
            lag_24h = self._expected_hourly(float(route["all_day_riders"]), current - timedelta(hours=24), weather_features)
            lag_168h = self._expected_hourly(float(route["all_day_riders"]), current - timedelta(hours=168), weather_features)
            rows.append(
                {
                    "route_type": route["route_type"],
                    "route_number": route["route_number"],
                    "stop_count": route["stop_count"],
                    "trip_count": route["trip_count"],
                    "shape_count": route["shape_count"],
                    "avg_shape_length_km": float(route["avg_shape_length_km"] or 0),
                    "hour": current.hour,
                    "day_of_week": current.weekday(),
                    "month": current.month,
                    "is_weekend": 1 if current.weekday() >= 5 else 0,
                    "is_peak": 1 if 7 <= current.hour <= 9 or 16 <= current.hour <= 18 else 0,
                    "is_holiday": 1 if self._is_holiday(current.date()) else 0,
                    "is_school_term": self._is_school_term(current.date()),
                    "temperature_c": weather_features["temperature_c"],
                    "precipitation_mm": weather_features["precipitation_mm"],
                    "snowfall_cm": weather_features["snowfall_cm"],
                    "wind_kmh": weather_features["wind_kmh"],
                    "lag_24h": lag_24h,
                    "lag_168h": lag_168h,
                }
            )
            current += timedelta(hours=1)

        frame = pd.DataFrame(rows, columns=self.feature_columns)
        predictions = self.model.predict(frame)
        spread = max(float(self.mae or 0), 1.0)
        points = []
        for timestamp, predicted in zip(timestamps, predictions, strict=True):
            value = max(float(predicted), 0.0)
            points.append(
                {
                    "timestamp": timestamp,
                    "predicted_riders": round(value, 2),
                    "lower_bound": round(max(value - spread, value * 0.80, 0.0), 2),
                    "upper_bound": round(value + spread, 2),
                }
            )
        return {
            "route_id": route_id,
            "model": self.model_name,
            "model_metrics": self.metrics.get("test", self.metrics),
            "points": points,
        }

    def _weather_features(
        self,
        weather: str | None,
        temperature_c: float | None,
        precipitation_mm: float | None,
        snowfall_cm: float | None,
        wind_kmh: float | None,
    ) -> dict[str, float]:
        features = dict(self.default_weather)
        if weather:
            normalized = weather.lower()
            if normalized == "rain":
                features["precipitation_mm"] = max(float(features["precipitation_mm"]), 2.0)
            elif normalized == "snow":
                features["snowfall_cm"] = max(float(features["snowfall_cm"]), 1.0)
                features["temperature_c"] = min(float(features["temperature_c"]), -1.0)
        if temperature_c is not None:
            features["temperature_c"] = temperature_c
        if precipitation_mm is not None:
            features["precipitation_mm"] = precipitation_mm
        if snowfall_cm is not None:
            features["snowfall_cm"] = snowfall_cm
        if wind_kmh is not None:
            features["wind_kmh"] = wind_kmh
        return {key: float(value) for key, value in features.items()}

    def _expected_hourly(self, all_day_riders: float, timestamp: datetime, weather_features: dict[str, float]) -> float:
        factor = 1.0
        if timestamp.weekday() >= 5:
            factor *= 0.72
        if self._is_holiday(timestamp.date()):
            factor *= 0.62
        if weather_features["precipitation_mm"] > 0:
            factor *= max(0.88, 1.0 - min(weather_features["precipitation_mm"], 10.0) * 0.01)
        if weather_features["snowfall_cm"] > 0:
            factor *= max(0.78, 1.0 - min(weather_features["snowfall_cm"], 8.0) * 0.025)
        if weather_features["temperature_c"] < -10 or weather_features["temperature_c"] > 30:
            factor *= 0.94
        return all_day_riders * self._hour_weight(timestamp.hour) * factor

    @staticmethod
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

    @staticmethod
    def _is_holiday(day: date) -> bool:
        return day in {date(day.year, 1, 1), date(day.year, 7, 1), date(day.year, 12, 25), date(day.year, 12, 26)}

    @staticmethod
    def _is_school_term(day: date) -> int:
        return int(day.month in {1, 2, 3, 4, 5, 9, 10, 11, 12})

    async def _record_prediction(
        self,
        session: AsyncSession,
        result: dict,
        start_time: datetime,
        end_time: datetime,
        weather: str | None,
    ) -> None:
        points = result.get("points", [])
        prediction_sum = sum(float(point["predicted_riders"]) for point in points)
        try:
            await session.execute(
                text(
                    """
                    INSERT INTO ridership_prediction_requests (
                        route_id, start_time, end_time, weather, model_name,
                        point_count, prediction_sum, metadata
                    )
                    VALUES (
                        :route_id, :start_time, :end_time, :weather, :model_name,
                        :point_count, :prediction_sum, CAST(:metadata AS jsonb)
                    )
                    """
                ),
                {
                    "route_id": result["route_id"],
                    "start_time": start_time,
                    "end_time": end_time,
                    "weather": weather,
                    "model_name": result["model"],
                    "point_count": len(points),
                    "prediction_sum": prediction_sum,
                    "metadata": json.dumps({"model_metrics": result.get("model_metrics", {})}),
                },
            )
            await session.commit()
        except Exception:
            await session.rollback()


prediction_service = PredictionService()
