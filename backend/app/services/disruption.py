from __future__ import annotations

from statistics import mean
from typing import Any

import networkx as nx
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas import DisruptionRequest


async def _graph_available(session: AsyncSession) -> bool:
    result = await session.execute(
        text("SELECT to_regclass('public.transit_graph_edges') IS NOT NULL")
    )
    if not result.scalar_one():
        return False
    count = await session.execute(text("SELECT COUNT(*) FROM transit_graph_edges"))
    return int(count.scalar_one()) > 0


async def _load_graph(session: AsyncSession) -> nx.MultiDiGraph:
    result = await session.execute(
        text(
            """
            SELECT
                from_stop_id,
                to_stop_id,
                route_id,
                route_short_name,
                route_type,
                avg_travel_time_seconds,
                distance_m,
                edge_kind
            FROM transit_graph_edges
            """
        )
    )
    graph = nx.MultiDiGraph()
    for row in result.mappings():
        graph.add_edge(
            row["from_stop_id"],
            row["to_stop_id"],
            route_id=row["route_id"],
            route_short_name=row["route_short_name"],
            route_type=row["route_type"],
            weight=float(row["avg_travel_time_seconds"]),
            baseline_weight=float(row["avg_travel_time_seconds"]),
            distance_m=float(row["distance_m"] or 0),
            edge_kind=row["edge_kind"],
        )
    return graph


async def _baseline_pairs(session: AsyncSession, request: DisruptionRequest, limit: int = 30):
    if request.type == "station_closure":
        result = await session.execute(
            text(
                """
                SELECT DISTINCT b.origin_stop_id, b.destination_stop_id, b.baseline_time_seconds, b.path
                FROM baseline_od_paths b
                WHERE b.path ?| :ids
                ORDER BY b.baseline_time_seconds DESC
                LIMIT :limit
                """
            ),
            {"ids": request.affected_ids, "limit": limit},
        )
    else:
        result = await session.execute(
            text(
                """
                WITH affected_stops AS (
                    SELECT DISTINCT st.stop_id
                    FROM trips t
                    JOIN stop_times st ON st.trip_id = t.trip_id
                    WHERE t.route_id = ANY(:ids)
                )
                SELECT DISTINCT b.origin_stop_id, b.destination_stop_id, b.baseline_time_seconds, b.path
                FROM baseline_od_paths b
                WHERE EXISTS (
                    SELECT 1 FROM affected_stops s WHERE b.path ? s.stop_id
                )
                ORDER BY b.baseline_time_seconds DESC
                LIMIT :limit
                """
            ),
            {"ids": request.affected_ids, "limit": limit},
        )
    rows = [dict(row) for row in result.mappings()]
    if rows:
        return rows
    fallback = await session.execute(
        text(
            """
            SELECT origin_stop_id, destination_stop_id, baseline_time_seconds, path
            FROM baseline_od_paths
            ORDER BY baseline_time_seconds DESC
            LIMIT :limit
            """
        ),
        {"limit": limit},
    )
    return [dict(row) for row in fallback.mappings()]


async def _event_pairs(session: AsyncSession, request: DisruptionRequest, limit: int = 30):
    if request.type == "station_closure":
        result = await session.execute(
            text(
                """
                WITH affected_trips AS (
                    SELECT DISTINCT trip_id
                    FROM stop_times
                    WHERE stop_id = ANY(:ids)
                    LIMIT 300
                ),
                endpoints AS (
                    SELECT DISTINCT ON (st.trip_id)
                        st.trip_id,
                        first_value(st.stop_id) OVER (PARTITION BY st.trip_id ORDER BY st.stop_sequence) AS origin_stop_id,
                        first_value(st.stop_id) OVER (PARTITION BY st.trip_id ORDER BY st.stop_sequence DESC) AS destination_stop_id
                    FROM stop_times st
                    JOIN affected_trips at ON at.trip_id = st.trip_id
                )
                SELECT DISTINCT origin_stop_id, destination_stop_id
                FROM endpoints
                WHERE origin_stop_id <> destination_stop_id
                LIMIT :limit
                """
            ),
            {"ids": request.affected_ids, "limit": limit},
        )
    else:
        result = await session.execute(
            text(
                """
                WITH representative_trips AS (
                    SELECT DISTINCT ON (t.route_id, t.direction_id, t.shape_id)
                        t.trip_id
                    FROM trips t
                    WHERE t.route_id = ANY(:ids)
                    ORDER BY t.route_id, t.direction_id, t.shape_id, t.trip_id
                    LIMIT 300
                ),
                endpoints AS (
                    SELECT DISTINCT ON (st.trip_id)
                        st.trip_id,
                        first_value(st.stop_id) OVER (PARTITION BY st.trip_id ORDER BY st.stop_sequence) AS origin_stop_id,
                        first_value(st.stop_id) OVER (PARTITION BY st.trip_id ORDER BY st.stop_sequence DESC) AS destination_stop_id
                    FROM stop_times st
                    JOIN representative_trips rt ON rt.trip_id = st.trip_id
                )
                SELECT DISTINCT origin_stop_id, destination_stop_id
                FROM endpoints
                WHERE origin_stop_id <> destination_stop_id
                LIMIT :limit
                """
            ),
            {"ids": request.affected_ids, "limit": limit},
        )
    return [dict(row) for row in result.mappings()]


async def _affected_counts(session: AsyncSession, request: DisruptionRequest) -> dict[str, int]:
    if request.type == "station_closure":
        result = await session.execute(
            text(
                """
                SELECT
                    COUNT(DISTINCT st.trip_id) AS affected_trip_count,
                    COUNT(DISTINCT t.route_id) AS affected_routes,
                    COUNT(DISTINCT st.stop_id) AS affected_stops
                FROM stop_times st
                JOIN trips t ON t.trip_id = st.trip_id
                WHERE st.stop_id = ANY(:ids)
                """
            ),
            {"ids": request.affected_ids},
        )
    else:
        result = await session.execute(
            text(
                """
                SELECT
                    COUNT(DISTINCT t.trip_id) AS affected_trip_count,
                    COUNT(DISTINCT t.route_id) AS affected_routes,
                    COUNT(DISTINCT st.stop_id) AS affected_stops
                FROM trips t
                JOIN stop_times st ON st.trip_id = t.trip_id
                WHERE t.route_id = ANY(:ids)
                """
            ),
            {"ids": request.affected_ids},
        )
    row = result.mappings().one()
    return {key: int(value or 0) for key, value in dict(row).items()}


async def _route_daily_riders(session: AsyncSession, request: DisruptionRequest) -> float:
    if request.type in {"route_delay", "line_closure"}:
        result = await session.execute(
            text(
                """
                SELECT COALESCE(SUM(all_day_riders), 0)
                FROM surface_route_ridership
                WHERE route_id = ANY(:ids)
                """
            ),
            {"ids": request.affected_ids},
        )
        return float(result.scalar_one() or 0)
    result = await session.execute(
        text(
            """
            WITH affected_routes AS (
                SELECT DISTINCT t.route_id
                FROM stop_times st
                JOIN trips t ON t.trip_id = st.trip_id
                WHERE st.stop_id = ANY(:ids)
            )
            SELECT COALESCE(SUM(srr.all_day_riders), 0)
            FROM affected_routes ar
            JOIN surface_route_ridership srr ON srr.route_id = ar.route_id
            """
        ),
        {"ids": request.affected_ids},
    )
    return float(result.scalar_one() or 0)


def _apply_disruption(graph: nx.MultiDiGraph, request: DisruptionRequest) -> None:
    if request.type == "station_closure":
        for stop_id in request.affected_ids:
            if graph.has_node(stop_id):
                graph.remove_node(stop_id)
        return

    delay_seconds = float((request.delay_minutes or 10) * 60)
    affected = set(request.affected_ids)
    to_remove = []
    for u, v, key, data in graph.edges(keys=True, data=True):
        if data.get("route_id") not in affected:
            continue
        if request.type == "line_closure":
            to_remove.append((u, v, key))
        else:
            data["weight"] = float(data["weight"]) + delay_seconds
    for edge in to_remove:
        graph.remove_edge(*edge)


def _path_routes(graph: nx.MultiDiGraph, path: list[str]) -> list[str]:
    routes = []
    for u, v in zip(path, path[1:], strict=False):
        edge_data = graph.get_edge_data(u, v) or {}
        best = min(edge_data.values(), key=lambda item: item.get("weight", 999999))
        route = best.get("route_short_name") or best.get("route_id")
        if route and (not routes or routes[-1] != route):
            routes.append(str(route))
    return routes


async def simulate_disruption(session: AsyncSession, request: DisruptionRequest):
    counts = await _affected_counts(session, request)
    if not await _graph_available(session):
        return {
            "type": request.type,
            "affected_ids": request.affected_ids,
            "affected_trip_count": counts["affected_trip_count"],
            "affected_routes": counts["affected_routes"],
            "affected_stops": counts["affected_stops"],
            "alternatives": [],
            "impact_summary": {"graph_available": False},
            "notes": ["Run backend/scripts/build_transit_graph.ps1 before graph-based simulation."],
        }

    graph = await _load_graph(session)
    event_pairs = await _event_pairs(session, request)
    baseline_pairs = []
    for pair in event_pairs:
        origin = pair["origin_stop_id"]
        destination = pair["destination_stop_id"]
        if origin in graph and destination in graph:
            try:
                baseline_seconds, path = nx.single_source_dijkstra(
                    graph, origin, destination, weight="weight"
                )
                baseline_pairs.append(
                    {
                        "origin_stop_id": origin,
                        "destination_stop_id": destination,
                        "baseline_time_seconds": baseline_seconds,
                        "path": path,
                    }
                )
            except nx.NetworkXNoPath:
                continue
    if not baseline_pairs:
        baseline_pairs = await _baseline_pairs(session, request)
    modified = graph.copy()
    _apply_disruption(modified, request)

    alternatives: list[dict[str, Any]] = []
    delays = []
    disconnected = 0
    for pair in baseline_pairs:
        origin = pair["origin_stop_id"]
        destination = pair["destination_stop_id"]
        baseline_seconds = float(pair["baseline_time_seconds"])
        if origin not in modified or destination not in modified:
            disconnected += 1
            alternatives.append(
                {
                    "origin": origin,
                    "destination": destination,
                    "baseline_time": round(baseline_seconds / 60.0, 1),
                    "new_time": None,
                    "delay": None,
                    "path": [],
                    "status": "no alternative available",
                }
            )
            continue
        try:
            new_seconds, path = nx.single_source_dijkstra(
                modified, origin, destination, weight="weight"
            )
        except nx.NetworkXNoPath:
            disconnected += 1
            alternatives.append(
                {
                    "origin": origin,
                    "destination": destination,
                    "baseline_time": round(baseline_seconds / 60.0, 1),
                    "new_time": None,
                    "delay": None,
                    "path": [],
                    "status": "no alternative available",
                }
            )
            continue
        delay_minutes = max((float(new_seconds) - baseline_seconds) / 60.0, 0.0)
        delays.append(delay_minutes)
        alternatives.append(
            {
                "origin": origin,
                "destination": destination,
                "baseline_time": round(baseline_seconds / 60.0, 1),
                "new_time": round(float(new_seconds) / 60.0, 1),
                "delay": round(delay_minutes, 1),
                "path": _path_routes(modified, path),
                "stop_path": path[:20],
                "status": "alternative available",
            }
        )

    alternatives.sort(key=lambda row: row["delay"] if row["delay"] is not None else 9999, reverse=True)
    average_delay = mean(delays) if delays else 0.0
    daily_riders = await _route_daily_riders(session, request)
    window_hours = max((request.end_time - request.start_time).total_seconds() / 3600.0, 0.0)
    affected_passengers = daily_riders * min(window_hours / 18.0, 1.0)
    passenger_impact = average_delay * affected_passengers

    return {
        "type": request.type,
        "affected_ids": request.affected_ids,
        "affected_trip_count": counts["affected_trip_count"],
        "affected_routes": counts["affected_routes"],
        "affected_stops": counts["affected_stops"],
        "average_delay_minutes": round(average_delay, 2),
        "passenger_impact_minutes": round(passenger_impact, 2),
        "alternatives": alternatives[:12],
        "impact_summary": {
            "sampled_od_pairs": len(baseline_pairs),
            "computed_od_pairs": len(alternatives),
            "disconnected_od_pairs": disconnected,
            "estimated_affected_passengers": round(affected_passengers, 2),
            "graph_nodes": modified.number_of_nodes(),
            "graph_edges": modified.number_of_edges(),
            "window": {
                "start_time": request.start_time.isoformat(),
                "end_time": request.end_time.isoformat(),
            },
        },
        "notes": [
            "Simulation uses a GTFS-derived directed stop graph with walking-transfer edges.",
            "Passenger impact uses surface route ridership and the requested disruption window as a planning estimate.",
        ],
    }
