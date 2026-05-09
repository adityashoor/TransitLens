from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.schemas import RouteDetail, RouteSummary, StopDetail, StopSummary
from app.services import transit


router = APIRouter(tags=["routes-and-stops"])


@router.get("/routes", response_model=list[RouteSummary])
async def list_routes(
    route_type: int | None = None,
    agency_id: str | None = None,
    session: AsyncSession = Depends(get_session),
):
    return await transit.list_routes(session, route_type=route_type, agency_id=agency_id)


@router.get("/routes/{route_id}", response_model=RouteDetail)
async def route_detail(route_id: str, session: AsyncSession = Depends(get_session)):
    route = await transit.get_route(session, route_id)
    if not route:
        raise HTTPException(status_code=404, detail="Route not found")
    return route


@router.get("/stops", response_model=list[StopSummary])
async def list_stops(
    min_lat: float | None = None,
    min_lon: float | None = None,
    max_lat: float | None = None,
    max_lon: float | None = None,
    lat: float | None = None,
    lon: float | None = None,
    radius_m: int | None = Query(default=None, ge=1, le=10000),
    limit: int = Query(default=500, ge=1, le=5000),
    session: AsyncSession = Depends(get_session),
):
    return await transit.list_stops(
        session,
        min_lat=min_lat,
        min_lon=min_lon,
        max_lat=max_lat,
        max_lon=max_lon,
        lat=lat,
        lon=lon,
        radius_m=radius_m,
        limit=limit,
    )


@router.get("/stops/{stop_id}", response_model=StopDetail)
async def stop_detail(stop_id: str, session: AsyncSession = Depends(get_session)):
    stop = await transit.get_stop(session, stop_id)
    if not stop:
        raise HTTPException(status_code=404, detail="Stop not found")
    return stop
