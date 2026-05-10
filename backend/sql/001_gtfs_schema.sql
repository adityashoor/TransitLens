CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS feed_versions (
    feed_version_id BIGSERIAL PRIMARY KEY,
    source_name TEXT NOT NULL,
    source_url TEXT NOT NULL,
    portal_resource_id TEXT,
    portal_last_modified TIMESTAMPTZ,
    ingested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    zip_sha256 TEXT NOT NULL UNIQUE,
    archive_path TEXT NOT NULL,
    row_counts JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS agency (
    agency_id TEXT PRIMARY KEY,
    agency_name TEXT NOT NULL,
    agency_url TEXT,
    agency_timezone TEXT,
    agency_lang TEXT,
    agency_phone TEXT,
    agency_fare_url TEXT,
    cemv_support INTEGER
);

CREATE TABLE IF NOT EXISTS routes (
    route_id TEXT PRIMARY KEY,
    agency_id TEXT REFERENCES agency(agency_id),
    route_short_name TEXT,
    route_long_name TEXT,
    route_desc TEXT,
    route_type INTEGER,
    route_url TEXT,
    route_color TEXT,
    route_text_color TEXT
);

CREATE TABLE IF NOT EXISTS calendar (
    service_id TEXT PRIMARY KEY,
    monday INTEGER NOT NULL,
    tuesday INTEGER NOT NULL,
    wednesday INTEGER NOT NULL,
    thursday INTEGER NOT NULL,
    friday INTEGER NOT NULL,
    saturday INTEGER NOT NULL,
    sunday INTEGER NOT NULL,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS calendar_dates (
    service_id TEXT NOT NULL,
    date TEXT NOT NULL,
    exception_type INTEGER NOT NULL,
    PRIMARY KEY (service_id, date, exception_type)
);

CREATE TABLE IF NOT EXISTS stops (
    stop_id TEXT PRIMARY KEY,
    stop_code TEXT,
    stop_name TEXT NOT NULL,
    stop_desc TEXT,
    stop_lat DOUBLE PRECISION,
    stop_lon DOUBLE PRECISION,
    zone_id TEXT,
    stop_url TEXT,
    location_type INTEGER,
    parent_station TEXT,
    stop_timezone TEXT,
    wheelchair_boarding INTEGER,
    geom geometry(Point, 4326),
    CONSTRAINT stops_lon_lat_valid CHECK (
        stop_lat IS NULL OR stop_lon IS NULL OR
        (stop_lat BETWEEN -90 AND 90 AND stop_lon BETWEEN -180 AND 180)
    )
);

CREATE TABLE IF NOT EXISTS shapes (
    shape_id TEXT NOT NULL,
    shape_pt_lat DOUBLE PRECISION NOT NULL,
    shape_pt_lon DOUBLE PRECISION NOT NULL,
    shape_pt_sequence INTEGER NOT NULL,
    shape_dist_traveled DOUBLE PRECISION,
    geom geometry(Point, 4326),
    PRIMARY KEY (shape_id, shape_pt_sequence),
    CONSTRAINT shapes_lon_lat_valid CHECK (
        shape_pt_lat BETWEEN -90 AND 90 AND shape_pt_lon BETWEEN -180 AND 180
    )
);

CREATE TABLE IF NOT EXISTS shape_geometries (
    shape_id TEXT PRIMARY KEY,
    geom geometry(LineString, 4326) NOT NULL,
    point_count INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS trips (
    trip_id TEXT PRIMARY KEY,
    route_id TEXT NOT NULL REFERENCES routes(route_id),
    service_id TEXT NOT NULL,
    trip_headsign TEXT,
    trip_short_name TEXT,
    direction_id INTEGER,
    block_id TEXT,
    shape_id TEXT,
    wheelchair_accessible INTEGER,
    bikes_allowed INTEGER
);

CREATE TABLE IF NOT EXISTS stop_times (
    trip_id TEXT NOT NULL REFERENCES trips(trip_id),
    arrival_time TEXT,
    departure_time TEXT,
    stop_id TEXT NOT NULL REFERENCES stops(stop_id),
    stop_sequence INTEGER NOT NULL,
    stop_headsign TEXT,
    pickup_type INTEGER,
    drop_off_type INTEGER,
    shape_dist_traveled DOUBLE PRECISION,
    PRIMARY KEY (trip_id, stop_sequence)
);

CREATE INDEX IF NOT EXISTS idx_routes_agency_id ON routes(agency_id);
CREATE INDEX IF NOT EXISTS idx_trips_route_id ON trips(route_id);
CREATE INDEX IF NOT EXISTS idx_trips_service_id ON trips(service_id);
CREATE INDEX IF NOT EXISTS idx_trips_shape_id ON trips(shape_id);
CREATE INDEX IF NOT EXISTS idx_stop_times_trip_id ON stop_times(trip_id);
CREATE INDEX IF NOT EXISTS idx_stop_times_stop_id ON stop_times(stop_id);
CREATE INDEX IF NOT EXISTS idx_stop_times_stop_sequence ON stop_times(stop_sequence);
CREATE INDEX IF NOT EXISTS idx_shapes_shape_id ON shapes(shape_id);
CREATE INDEX IF NOT EXISTS idx_calendar_dates_service_id ON calendar_dates(service_id);
CREATE INDEX IF NOT EXISTS idx_stops_geom ON stops USING GIST(geom);
CREATE INDEX IF NOT EXISTS idx_shapes_geom ON shapes USING GIST(geom);
CREATE INDEX IF NOT EXISTS idx_shape_geometries_geom ON shape_geometries USING GIST(geom);

CREATE OR REPLACE VIEW route_shape_summary AS
SELECT
    r.route_id,
    r.route_short_name,
    r.route_long_name,
    COUNT(DISTINCT t.trip_id) AS trip_count,
    COUNT(DISTINCT t.shape_id) AS shape_count,
    ST_Extent(sg.geom) AS extent
FROM routes r
LEFT JOIN trips t ON t.route_id = r.route_id
LEFT JOIN shape_geometries sg ON sg.shape_id = t.shape_id
GROUP BY r.route_id, r.route_short_name, r.route_long_name;

CREATE OR REPLACE VIEW stop_route_summary AS
SELECT
    s.stop_id,
    s.stop_code,
    s.stop_name,
    s.geom,
    COUNT(DISTINCT t.route_id) AS route_count,
    COUNT(DISTINCT st.trip_id) AS trip_count
FROM stops s
LEFT JOIN stop_times st ON st.stop_id = s.stop_id
LEFT JOIN trips t ON t.trip_id = st.trip_id
GROUP BY s.stop_id, s.stop_code, s.stop_name, s.geom;
