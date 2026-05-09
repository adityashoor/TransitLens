from __future__ import annotations

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


async def annual_ridership(
    session: AsyncSession,
    media: str | None,
    rider_type: str | None,
    year: int | None,
):
    filters = []
    params = {}
    if media is not None:
        filters.append("media ILIKE '%' || :media || '%'")
        params["media"] = media
    if rider_type is not None:
        filters.append("rider_type = :rider_type")
        params["rider_type"] = rider_type
    if year is not None:
        filters.append("year = :year")
        params["year"] = year
    where_sql = f"WHERE {' AND '.join(filters)}" if filters else ""
    result = await session.execute(
        text(
            f"""
            SELECT year, media, rider_type, count
            FROM ridership_matrix
            {where_sql}
            ORDER BY year, rider_type, media
            """
        ),
        params,
    )
    return [dict(row) for row in result.mappings()]


async def surface_ridership(session: AsyncSession, limit: int):
    result = await session.execute(
        text(
            """
            SELECT
                srr.route_id,
                srr.route_name,
                srr.rank,
                srr.all_day_riders,
                srr.sample_date,
                r.route_short_name,
                r.route_long_name
            FROM surface_route_ridership srr
            LEFT JOIN routes r ON r.route_id = srr.route_id
            ORDER BY srr.rank NULLS LAST, srr.route_id
            LIMIT :limit
            """
        ),
        {"limit": limit},
    )
    return [dict(row) for row in result.mappings()]


async def bike_share_stats(session: AsyncSession, group_by: str, limit: int):
    group_sql = {
        "station": """
            SELECT
                COALESCE(start_station_id, -1)::text AS key,
                COALESCE(start_station_name, 'Unknown') AS label,
                COUNT(*) AS trip_count,
                AVG(trip_duration)::float AS avg_duration_seconds
            FROM bikeshare_trips
            GROUP BY start_station_id, start_station_name
            ORDER BY trip_count DESC
        """,
        "day": """
            SELECT
                start_time::date::text AS key,
                start_time::date::text AS label,
                COUNT(*) AS trip_count,
                AVG(trip_duration)::float AS avg_duration_seconds
            FROM bikeshare_trips
            WHERE start_time IS NOT NULL
            GROUP BY start_time::date
            ORDER BY key DESC
        """,
        "month": """
            SELECT
                to_char(date_trunc('month', start_time), 'YYYY-MM') AS key,
                to_char(date_trunc('month', start_time), 'YYYY-MM') AS label,
                COUNT(*) AS trip_count,
                AVG(trip_duration)::float AS avg_duration_seconds
            FROM bikeshare_trips
            WHERE start_time IS NOT NULL
            GROUP BY date_trunc('month', start_time)
            ORDER BY key DESC
        """,
        "user_type": """
            SELECT
                COALESCE(user_type, 'Unknown') AS key,
                COALESCE(user_type, 'Unknown') AS label,
                COUNT(*) AS trip_count,
                AVG(trip_duration)::float AS avg_duration_seconds
            FROM bikeshare_trips
            GROUP BY user_type
            ORDER BY trip_count DESC
        """,
    }[group_by]
    result = await session.execute(text(f"{group_sql} LIMIT :limit"), {"limit": limit})
    return [dict(row) for row in result.mappings()]
