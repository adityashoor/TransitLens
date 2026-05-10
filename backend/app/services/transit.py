from __future__ import annotations

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


async def list_routes(session: AsyncSession, route_type: int | None, agency_id: str | None):
    filters = []
    params = {}
    if route_type is not None:
        filters.append("r.route_type = :route_type")
        params["route_type"] = route_type
    if agency_id is not None:
        filters.append("r.agency_id = :agency_id")
        params["agency_id"] = agency_id
    where_sql = f"WHERE {' AND '.join(filters)}" if filters else ""
    sql = """
        SELECT
            r.route_id,
            r.route_short_name AS short_name,
            r.route_long_name AS long_name,
            r.route_type,
            r.agency_id,
            a.agency_name
        FROM routes r
        LEFT JOIN agency a ON a.agency_id = r.agency_id
        {where_sql}
        ORDER BY r.route_short_name, r.route_id
    """.format(where_sql=where_sql)
    result = await session.execute(text(sql), params)
    return [dict(row) for row in result.mappings()]


async def get_route(session: AsyncSession, route_id: str):
    route_result = await session.execute(
        text(
            """
            SELECT
                r.route_id,
                r.route_short_name AS short_name,
                r.route_long_name AS long_name,
                r.route_type,
                r.agency_id,
                a.agency_name,
                r.route_color,
                (
                    SELECT t.shape_id
                    FROM trips t
                    WHERE t.route_id = r.route_id AND t.shape_id IS NOT NULL
                    GROUP BY t.shape_id
                    ORDER BY COUNT(*) DESC
                    LIMIT 1
                ) AS shape_id
            FROM routes r
            LEFT JOIN agency a ON a.agency_id = r.agency_id
            WHERE r.route_id = :route_id
            """
        ),
        {"route_id": route_id},
    )
    route = route_result.mappings().first()
    if not route:
        return None
    route_dict = dict(route)
    if route_dict["shape_id"]:
        shape_result = await session.execute(
            text(
                """
                SELECT shape_pt_lat, shape_pt_lon
                FROM shapes
                WHERE shape_id = :shape_id
                ORDER BY shape_pt_sequence
                LIMIT 5000
                """
            ),
            {"shape_id": route_dict["shape_id"]},
        )
        route_dict["shape"] = [
            (float(row.shape_pt_lat), float(row.shape_pt_lon)) for row in shape_result
        ]
    else:
        route_dict["shape"] = []
    return route_dict


async def list_stops(
    session: AsyncSession,
    min_lat: float | None,
    min_lon: float | None,
    max_lat: float | None,
    max_lon: float | None,
    lat: float | None,
    lon: float | None,
    radius_m: int | None,
    limit: int,
):
    params = {"limit": limit}
    filters = []
    if min_lat is not None:
        filters.append("stop_lat >= :min_lat")
        params["min_lat"] = min_lat
    if max_lat is not None:
        filters.append("stop_lat <= :max_lat")
        params["max_lat"] = max_lat
    if min_lon is not None:
        filters.append("stop_lon >= :min_lon")
        params["min_lon"] = min_lon
    if max_lon is not None:
        filters.append("stop_lon <= :max_lon")
        params["max_lon"] = max_lon

    distance_sql = "NULL::double precision AS distance_m"
    order_sql = "stop_name"
    if lat is not None and lon is not None:
        params["lat"] = lat
        params["lon"] = lon
        distance_expr = (
            "ST_Distance(geom::geography, "
            "ST_SetSRID(ST_MakePoint(:lon, :lat), 4326)::geography)"
        )
        distance_sql = f"{distance_expr} AS distance_m"
        order_sql = "distance_m NULLS LAST, stop_name"
        if radius_m is not None:
            filters.append(
                "ST_DWithin(geom::geography, "
                "ST_SetSRID(ST_MakePoint(:lon, :lat), 4326)::geography, :radius_m)"
            )
            params["radius_m"] = radius_m

    where_sql = f"WHERE {' AND '.join(filters)}" if filters else ""
    sql = """
        SELECT
            stop_id,
            stop_code,
            stop_name,
            stop_lat AS lat,
            stop_lon AS lon,
            {distance_sql}
        FROM stops
        {where_sql}
        ORDER BY {order_sql}
        LIMIT :limit
    """.format(distance_sql=distance_sql, where_sql=where_sql, order_sql=order_sql)
    result = await session.execute(text(sql), params)
    return [dict(row) for row in result.mappings()]


async def get_stop(session: AsyncSession, stop_id: str):
    stop_result = await session.execute(
        text(
            """
            SELECT stop_id, stop_code, stop_name, stop_lat AS lat, stop_lon AS lon
            FROM stops
            WHERE stop_id = :stop_id
            """
        ),
        {"stop_id": stop_id},
    )
    stop = stop_result.mappings().first()
    if not stop:
        return None
    routes_result = await session.execute(
        text(
            """
            SELECT DISTINCT
                r.route_id,
                r.route_short_name AS short_name,
                r.route_long_name AS long_name,
                r.route_type,
                r.agency_id,
                a.agency_name
            FROM stop_times st
            JOIN trips t ON t.trip_id = st.trip_id
            JOIN routes r ON r.route_id = t.route_id
            LEFT JOIN agency a ON a.agency_id = r.agency_id
            WHERE st.stop_id = :stop_id
            ORDER BY r.route_short_name, r.route_id
            """
        ),
        {"stop_id": stop_id},
    )
    stop_dict = dict(stop)
    stop_dict["routes"] = [dict(row) for row in routes_result.mappings()]
    return stop_dict
