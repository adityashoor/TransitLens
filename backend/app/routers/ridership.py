from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.schemas import AnnualRidershipRow, BikeShareStats, SurfaceRidershipRow
from app.services import ridership


router = APIRouter(prefix="/ridership", tags=["ridership"])


@router.get("/annual", response_model=list[AnnualRidershipRow])
async def annual(
    media: str | None = None,
    rider_type: str | None = None,
    year: int | None = Query(default=None, ge=1900, le=2100),
    session: AsyncSession = Depends(get_session),
):
    return await ridership.annual_ridership(session, media=media, rider_type=rider_type, year=year)


@router.get("/surface", response_model=list[SurfaceRidershipRow])
async def surface(
    limit: int = Query(default=250, ge=1, le=1000),
    session: AsyncSession = Depends(get_session),
):
    return await ridership.surface_ridership(session, limit=limit)


@router.get("/bike-share", response_model=BikeShareStats)
async def bike_share(
    group_by: str = Query(default="station", pattern="^(station|day|month|user_type)$"),
    limit: int = Query(default=50, ge=1, le=1000),
    session: AsyncSession = Depends(get_session),
):
    rows = await ridership.bike_share_stats(session, group_by=group_by, limit=limit)
    return {"group_by": group_by, "rows": rows}
