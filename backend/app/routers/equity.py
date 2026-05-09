from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.schemas import EquityScore
from app.services import equity


router = APIRouter(prefix="/equity-scores", tags=["equity"])


@router.get("", response_model=list[EquityScore])
async def list_equity_scores(
    geography: str | None = None,
    sort: str = "lowest",
    limit: int = 200,
    session: AsyncSession = Depends(get_session),
):
    if sort not in {"lowest", "highest", "name"}:
        raise HTTPException(status_code=422, detail="sort must be one of: lowest, highest, name")
    limit = max(1, min(limit, 500))
    scores = await equity.list_equity_scores(
        session, geography=geography, sort=sort, limit=limit
    )
    if scores is None:
        raise HTTPException(
            status_code=501,
            detail="Equity score table is not available yet. Run the document 06 equity pipeline first.",
        )
    return scores


@router.get("/{neighbourhood_id}", response_model=EquityScore)
async def get_equity_score(
    neighbourhood_id: str,
    session: AsyncSession = Depends(get_session),
):
    score = await equity.get_equity_score(session, neighbourhood_id)
    if score is None:
        raise HTTPException(
            status_code=501,
            detail="Equity score table is not available yet. Run the document 06 equity pipeline first.",
        )
    if not score:
        raise HTTPException(status_code=404, detail="Equity geography not found")
    return score
