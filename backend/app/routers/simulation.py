from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.schemas import DisruptionRequest, DisruptionResponse
from app.services.disruption import simulate_disruption


router = APIRouter(tags=["simulation"])


@router.post("/simulate-disruption", response_model=DisruptionResponse)
async def disruption(
    request: DisruptionRequest,
    session: AsyncSession = Depends(get_session),
):
    return await simulate_disruption(session, request)
