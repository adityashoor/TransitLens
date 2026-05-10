CREATE TABLE IF NOT EXISTS transit_graph_edges (
    from_stop_id TEXT NOT NULL REFERENCES stops(stop_id),
    to_stop_id TEXT NOT NULL REFERENCES stops(stop_id),
    route_id TEXT NOT NULL,
    route_short_name TEXT,
    route_type INTEGER,
    trip_count INTEGER NOT NULL,
    avg_travel_time_seconds DOUBLE PRECISION NOT NULL,
    min_travel_time_seconds DOUBLE PRECISION NOT NULL,
    distance_m DOUBLE PRECISION,
    edge_kind TEXT NOT NULL DEFAULT 'transit',
    built_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (from_stop_id, to_stop_id, route_id, edge_kind)
);

ALTER TABLE transit_graph_edges DROP CONSTRAINT IF EXISTS transit_graph_edges_route_id_fkey;

CREATE INDEX IF NOT EXISTS idx_transit_graph_edges_from_stop ON transit_graph_edges(from_stop_id);
CREATE INDEX IF NOT EXISTS idx_transit_graph_edges_to_stop ON transit_graph_edges(to_stop_id);
CREATE INDEX IF NOT EXISTS idx_transit_graph_edges_route ON transit_graph_edges(route_id);

CREATE TABLE IF NOT EXISTS transit_graph_builds (
    graph_build_id BIGSERIAL PRIMARY KEY,
    built_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    node_count INTEGER NOT NULL,
    edge_count INTEGER NOT NULL,
    transit_edge_count INTEGER NOT NULL,
    transfer_edge_count INTEGER NOT NULL,
    notes TEXT
);

CREATE TABLE IF NOT EXISTS baseline_od_paths (
    origin_stop_id TEXT NOT NULL REFERENCES stops(stop_id),
    destination_stop_id TEXT NOT NULL REFERENCES stops(stop_id),
    baseline_time_seconds DOUBLE PRECISION NOT NULL,
    path JSONB NOT NULL DEFAULT '[]'::jsonb,
    computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (origin_stop_id, destination_stop_id)
);

CREATE INDEX IF NOT EXISTS idx_baseline_od_paths_origin ON baseline_od_paths(origin_stop_id);
CREATE INDEX IF NOT EXISTS idx_baseline_od_paths_destination ON baseline_od_paths(destination_stop_id);
