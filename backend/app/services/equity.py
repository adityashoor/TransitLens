from __future__ import annotations

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


async def equity_table_available(session: AsyncSession) -> bool:
    result = await session.execute(
        text("SELECT to_regclass('public.equity_scores') IS NOT NULL")
    )
    return bool(result.scalar_one())


async def list_equity_scores(
    session: AsyncSession,
    geography: str | None,
    sort: str,
    limit: int,
):
    if not await equity_table_available(session):
        return None
    params = {}
    where_sql = ""
    if geography is not None:
        where_sql = "WHERE geography_name ILIKE '%' || :geography || '%'"
        params["geography"] = geography
    params["limit"] = limit
    order_sql = {
        "lowest": "score ASC, geography_name",
        "highest": "score DESC, geography_name",
        "name": "geography_name ASC",
    }.get(sort, "score ASC, geography_name")
    result = await session.execute(
        text(
            f"""
            SELECT
                geography_id,
                geography_name,
                area_type,
                stop_density,
                ridership_per_capita,
                median_income,
                vulnerable_share,
                distance_to_stop,
                score,
                metrics
            FROM equity_scores
            {where_sql}
            ORDER BY {order_sql}
            LIMIT :limit
            """
        ),
        params,
    )
    return [dict(row) for row in result.mappings()]


async def get_equity_score(session: AsyncSession, neighbourhood_id: str):
    if not await equity_table_available(session):
        return None
    result = await session.execute(
        text(
            """
            SELECT
                geography_id,
                geography_name,
                area_type,
                stop_density,
                ridership_per_capita,
                median_income,
                vulnerable_share,
                distance_to_stop,
                score,
                metrics
            FROM equity_scores
            WHERE geography_id = :neighbourhood_id
            """
        ),
        {"neighbourhood_id": neighbourhood_id},
    )
    row = result.mappings().first()
    return dict(row) if row else {}
