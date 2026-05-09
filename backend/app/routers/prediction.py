from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.schemas import PredictionResponse
from app.services.cache import cache
from app.services.prediction import prediction_service


router = APIRouter(prefix="/predict", tags=["prediction"])


@router.get("/ridership", response_model=PredictionResponse)
async def predict_ridership(
    route_id: str,
    start_time: datetime,
    end_time: datetime,
    weather: str | None = None,
    temperature_c: float | None = None,
    precipitation_mm: float | None = None,
    snowfall_cm: float | None = None,
    wind_kmh: float | None = None,
    session: AsyncSession = Depends(get_session),
):
    cache_key = (
        f"predict:{route_id}:{start_time.isoformat()}:{end_time.isoformat()}:"
        f"{weather or ''}:{temperature_c}:{precipitation_mm}:{snowfall_cm}:{wind_kmh}"
    )
    cached = await cache.get_json(cache_key)
    if cached:
        return cached
    try:
        result = await prediction_service.predict(
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
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    if result is None:
        raise HTTPException(status_code=404, detail="Route not found")
    await cache.set_json(cache_key, result, ttl_seconds=600)
    return result
