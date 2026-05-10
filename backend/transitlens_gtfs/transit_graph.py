from __future__ import annotations

import json
from typing import Any

import networkx as nx
from sqlalchemy import text
from sqlalchemy.engine import Engine


TRANSIT_EDGES_SQL = """
WITH representative_trips AS (
    SELECT DISTINCT ON (t.route_id, t.direction_id, t.shape_id)
        t.trip_id,
        t.route_id,
        t.direction_id,
        t.shape_id
    FROM trips t
    WHERE t.shape_id IS NOT NULL
    ORDER BY t.route_id, t.direction_id, t.shape_id, t.trip_id
),
ordered AS (
    SELECT
        st.trip_id,
        t.route_id,
        r.route_short_name,
        r.route_type,
        st.stop_id AS from_stop_id,
        lead(st.stop_id) OVER (PARTITION BY st.trip_id ORDER BY st.stop_sequence) AS to_stop_id,
        st.arrival_time AS from_time,
        lead(st.arrival_time) OVER (PARTITION BY st.trip_id ORDER BY st.stop_sequence) AS to_time
    FROM stop_times st
    JOIN representative_trips t ON t.trip_id = st.trip_id
    JOIN routes r ON r.route_id = t.route_id
),
parsed AS (
    SELECT
        route_id,
        route_short_name,
        route_type,
        from_stop_id,
        to_stop_id,
        (
            (split_part(to_time, ':', 1)::integer * 3600 + split_part(to_time, ':', 2)::integer * 60 + split_part(to_time, ':', 3)::integer)
            -
            (split_part(from_time, ':', 1)::integer * 3600 + split_part(from_time, ':', 2)::integer * 60 + split_part(from_time, ':', 3)::integer)
        ) AS travel_seconds
    FROM ordered
    WHERE to_stop_id IS NOT NULL
      AND from_time IS NOT NULL
      AND to_time IS NOT NULL
      AND from_time ~ '^[0-9]+:[0-9]{2}:[0-9]{2}$'
      AND to_time ~ '^[0-9]+:[0-9]{2}:[0-9]{2}$'
),
valid AS (
    SELECT
        p.*,
        ST_Distance(sf.geom::geography, st.geom::geography) AS distance_m
    FROM parsed p
    JOIN stops sf ON sf.stop_id = p.from_stop_id
    JOIN stops st ON st.stop_id = p.to_stop_id
    WHERE p.travel_seconds > 0
      AND p.travel_seconds <= 7200
)
SELECT
    from_stop_id,
    to_stop_id,
    route_id,
    route_short_name,
    route_type,
    COUNT(*)::integer AS trip_count,
    AVG(travel_seconds)::double precision AS avg_travel_time_seconds,
    MIN(travel_seconds)::double precision AS min_travel_time_seconds,
    AVG(distance_m)::double precision AS distance_m,
    'transit' AS edge_kind
FROM valid
GROUP BY from_stop_id, to_stop_id, route_id, route_short_name, route_type
"""

TRANSFER_EDGES_SQL = """
WITH important_stops AS (
    SELECT from_stop_id AS stop_id
    FROM transit_graph_edges
    WHERE edge_kind = 'transit'
    UNION
    SELECT to_stop_id AS stop_id
    FROM transit_graph_edges
    WHERE edge_kind = 'transit'
),
pairs AS (
    SELECT
        a.stop_id AS from_stop_id,
        b.stop_id AS to_stop_id,
        ST_Distance(a.geom::geography, b.geom::geography) AS distance_m
    FROM stops a
    JOIN stops b
        ON a.stop_id <> b.stop_id
       AND a.geom IS NOT NULL
       AND b.geom IS NOT NULL
       AND a.geom && ST_Expand(b.geom, :radius_degrees)
       AND ST_DWithin(a.geom::geography, b.geom::geography, :radius_m)
    WHERE EXISTS (SELECT 1 FROM important_stops i WHERE i.stop_id = a.stop_id)
      AND EXISTS (SELECT 1 FROM important_stops i WHERE i.stop_id = b.stop_id)
)
SELECT
    from_stop_id,
    to_stop_id,
    'WALK' AS route_id,
    'WALK' AS route_short_name,
    99 AS route_type,
    1 AS trip_count,
    GREATEST(distance_m / :walking_mps, 60)::double precision AS avg_travel_time_seconds,
    GREATEST(distance_m / :walking_mps, 60)::double precision AS min_travel_time_seconds,
    distance_m::double precision AS distance_m,
    'transfer' AS edge_kind
FROM pairs
"""

OD_SAMPLE_SQL = """
WITH ranked_stops AS (
    SELECT
        s.stop_id,
        COUNT(DISTINCT st.trip_id) AS trip_count,
        row_number() OVER (ORDER BY COUNT(DISTINCT st.trip_id) DESC, s.stop_id) AS rn
    FROM stops s
    JOIN stop_times st ON st.stop_id = s.stop_id
    GROUP BY s.stop_id
)
SELECT stop_id
FROM ranked_stops
WHERE rn <= :limit
ORDER BY rn
"""


def build_transit_graph_tables(
    engine: Engine,
    transfer_radius_m: int = 250,
    walking_mps: float = 1.3,
    od_limit: int = 35,
) -> dict[str, Any]:
    graph = nx.MultiDiGraph()
    with engine.begin() as conn:
        conn.execute(text("TRUNCATE TABLE baseline_od_paths"))
        conn.execute(text("TRUNCATE TABLE transit_graph_edges"))
        transit_edges = conn.execute(text(TRANSIT_EDGES_SQL)).mappings().all()
        transit_rows = [dict(row) for row in transit_edges]
        if transit_rows:
            conn.execute(
                text(
                    """
                    INSERT INTO transit_graph_edges (
                        from_stop_id, to_stop_id, route_id, route_short_name, route_type,
                        trip_count, avg_travel_time_seconds, min_travel_time_seconds,
                        distance_m, edge_kind
                    )
                    VALUES (
                        :from_stop_id, :to_stop_id, :route_id, :route_short_name, :route_type,
                        :trip_count, :avg_travel_time_seconds, :min_travel_time_seconds,
                        :distance_m, :edge_kind
                    )
                    """
                ),
                transit_rows,
            )

        transfer_edges = conn.execute(
            text(TRANSFER_EDGES_SQL),
            {
                "radius_m": transfer_radius_m,
                "radius_degrees": transfer_radius_m / 111_320.0,
                "walking_mps": walking_mps,
            },
        ).mappings().all()
        transfer_rows = [dict(row) for row in transfer_edges]
        if transfer_rows:
            conn.execute(
                text(
                    """
                    INSERT INTO transit_graph_edges (
                        from_stop_id, to_stop_id, route_id, route_short_name, route_type,
                        trip_count, avg_travel_time_seconds, min_travel_time_seconds,
                        distance_m, edge_kind
                    )
                    VALUES (
                        :from_stop_id, :to_stop_id, :route_id, :route_short_name, :route_type,
                        :trip_count, :avg_travel_time_seconds, :min_travel_time_seconds,
                        :distance_m, :edge_kind
                    )
                    """
                ),
                transfer_rows,
            )

        rows = transit_rows + transfer_rows

        for row in rows:
            graph.add_edge(
                row["from_stop_id"],
                row["to_stop_id"],
                route_id=row["route_id"],
                weight=float(row["avg_travel_time_seconds"]),
                edge_kind=row["edge_kind"],
            )

        sample_stops = [
            row.stop_id
            for row in conn.execute(text(OD_SAMPLE_SQL), {"limit": od_limit})
        ]
        baseline_rows = []
        for origin in sample_stops:
            lengths, paths = nx.single_source_dijkstra(graph, origin, weight="weight")
            for destination in sample_stops:
                if origin == destination or destination not in lengths:
                    continue
                baseline_rows.append(
                    {
                        "origin_stop_id": origin,
                        "destination_stop_id": destination,
                        "baseline_time_seconds": float(lengths[destination]),
                        "path": json.dumps(paths[destination]),
                    }
                )
        if baseline_rows:
            conn.execute(
                text(
                    """
                    INSERT INTO baseline_od_paths (
                        origin_stop_id, destination_stop_id, baseline_time_seconds, path
                    )
                    VALUES (
                        :origin_stop_id, :destination_stop_id, :baseline_time_seconds,
                        CAST(:path AS jsonb)
                    )
                    """
                ),
                baseline_rows,
            )

        conn.execute(
            text(
                """
                INSERT INTO transit_graph_builds (
                    node_count, edge_count, transit_edge_count, transfer_edge_count, notes
                )
                VALUES (:node_count, :edge_count, :transit_edge_count, :transfer_edge_count, :notes)
                """
            ),
            {
                "node_count": graph.number_of_nodes(),
                "edge_count": len(rows),
                "transit_edge_count": len(transit_edges),
                "transfer_edge_count": len(transfer_edges),
                "notes": f"OD baseline precomputed for top {od_limit} stops; walking transfers within {transfer_radius_m}m.",
            },
        )

    return {
        "node_count": graph.number_of_nodes(),
        "edge_count": len(rows),
        "transit_edge_count": len(transit_edges),
        "transfer_edge_count": len(transfer_edges),
        "baseline_od_paths": len(baseline_rows),
    }


def validate_transit_graph(engine: Engine) -> dict[str, int]:
    with engine.connect() as conn:
        row = conn.execute(
            text(
                """
                SELECT
                    (SELECT COUNT(*) FROM transit_graph_edges) AS edge_rows,
                    (SELECT COUNT(*) FROM transit_graph_edges WHERE avg_travel_time_seconds <= 0) AS invalid_weight_rows,
                    (SELECT COUNT(*) FROM transit_graph_edges WHERE edge_kind = 'transit') AS transit_edge_rows,
                    (SELECT COUNT(*) FROM transit_graph_edges WHERE edge_kind = 'transfer') AS transfer_edge_rows,
                    (SELECT COUNT(*) FROM baseline_od_paths) AS baseline_od_rows
                """
            )
        ).mappings().one()
    return {key: int(value) for key, value in dict(row).items()}
