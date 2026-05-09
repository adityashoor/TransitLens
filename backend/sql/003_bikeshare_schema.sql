CREATE TABLE IF NOT EXISTS bikeshare_ingestion_runs (
    bikeshare_ingestion_id BIGSERIAL PRIMARY KEY,
    resource_name TEXT NOT NULL,
    source_url TEXT NOT NULL,
    portal_resource_id TEXT,
    portal_last_modified TIMESTAMPTZ,
    source_year INTEGER,
    ingested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    file_sha256 TEXT NOT NULL UNIQUE,
    archive_path TEXT NOT NULL,
    row_count INTEGER NOT NULL,
    notes TEXT
);

CREATE TABLE IF NOT EXISTS bikeshare_stations (
    station_id INTEGER PRIMARY KEY,
    name TEXT,
    lat DOUBLE PRECISION,
    lon DOUBLE PRECISION,
    capacity INTEGER,
    source TEXT,
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    geom GEOGRAPHY(Point, 4326),
    CONSTRAINT bikeshare_station_lon_lat_valid CHECK (
        lat IS NULL OR lon IS NULL OR
        (lat BETWEEN -90 AND 90 AND lon BETWEEN -180 AND 180)
    )
);

CREATE TABLE IF NOT EXISTS bikeshare_trips (
    trip_id BIGINT PRIMARY KEY,
    trip_duration INTEGER,
    start_station_id INTEGER,
    start_station_name TEXT,
    start_time TIMESTAMP,
    start_station_lon DOUBLE PRECISION,
    start_station_lat DOUBLE PRECISION,
    end_station_id INTEGER,
    end_station_name TEXT,
    end_time TIMESTAMP,
    end_station_lon DOUBLE PRECISION,
    end_station_lat DOUBLE PRECISION,
    bike_id BIGINT,
    user_type TEXT,
    bike_model TEXT,
    source_year INTEGER,
    source_file TEXT,
    ingested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    geom_start GEOGRAPHY(Point, 4326),
    geom_end GEOGRAPHY(Point, 4326),
    CONSTRAINT bikeshare_trip_duration_reasonable CHECK (
        trip_duration IS NULL OR trip_duration > 0
    ),
    CONSTRAINT bikeshare_start_lon_lat_valid CHECK (
        start_station_lat IS NULL OR start_station_lon IS NULL OR
        (start_station_lat BETWEEN -90 AND 90 AND start_station_lon BETWEEN -180 AND 180)
    ),
    CONSTRAINT bikeshare_end_lon_lat_valid CHECK (
        end_station_lat IS NULL OR end_station_lon IS NULL OR
        (end_station_lat BETWEEN -90 AND 90 AND end_station_lon BETWEEN -180 AND 180)
    )
);

CREATE TABLE IF NOT EXISTS bikeshare_legacy_od_ridership (
    service_month DATE NOT NULL,
    start_station_id INTEGER NOT NULL,
    end_station_id INTEGER NOT NULL,
    casual_trips BIGINT,
    registered_trips BIGINT,
    total_trips BIGINT,
    source_file TEXT,
    ingested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (service_month, start_station_id, end_station_id),
    CONSTRAINT bikeshare_legacy_counts_nonnegative CHECK (
        COALESCE(casual_trips, 0) >= 0
        AND COALESCE(registered_trips, 0) >= 0
        AND COALESCE(total_trips, 0) >= 0
    )
);

CREATE INDEX IF NOT EXISTS idx_bikeshare_trips_start_station_id ON bikeshare_trips(start_station_id);
CREATE INDEX IF NOT EXISTS idx_bikeshare_trips_end_station_id ON bikeshare_trips(end_station_id);
CREATE INDEX IF NOT EXISTS idx_bikeshare_trips_start_time ON bikeshare_trips(start_time);
CREATE INDEX IF NOT EXISTS idx_bikeshare_trips_end_time ON bikeshare_trips(end_time);
CREATE INDEX IF NOT EXISTS idx_bikeshare_trips_source_year ON bikeshare_trips(source_year);
CREATE INDEX IF NOT EXISTS idx_bikeshare_trips_geom_start ON bikeshare_trips USING GIST(geom_start);
CREATE INDEX IF NOT EXISTS idx_bikeshare_trips_geom_end ON bikeshare_trips USING GIST(geom_end);
CREATE INDEX IF NOT EXISTS idx_bikeshare_stations_geom ON bikeshare_stations USING GIST(geom);
CREATE INDEX IF NOT EXISTS idx_bikeshare_legacy_od_start_station_id ON bikeshare_legacy_od_ridership(start_station_id);
CREATE INDEX IF NOT EXISTS idx_bikeshare_legacy_od_end_station_id ON bikeshare_legacy_od_ridership(end_station_id);
CREATE INDEX IF NOT EXISTS idx_bikeshare_legacy_od_service_month ON bikeshare_legacy_od_ridership(service_month);

CREATE OR REPLACE VIEW bikeshare_station_activity AS
SELECT
    s.station_id,
    s.name,
    s.lat,
    s.lon,
    s.geom,
    COUNT(t_start.trip_id) AS starts,
    COUNT(t_end.trip_id) AS ends
FROM bikeshare_stations s
LEFT JOIN bikeshare_trips t_start ON t_start.start_station_id = s.station_id
LEFT JOIN bikeshare_trips t_end ON t_end.end_station_id = s.station_id
GROUP BY s.station_id, s.name, s.lat, s.lon, s.geom;

CREATE OR REPLACE VIEW bikeshare_trips_missing_station_geometry AS
SELECT
    trip_id,
    start_station_id,
    start_station_name,
    end_station_id,
    end_station_name,
    source_year,
    source_file
FROM bikeshare_trips
WHERE geom_start IS NULL OR geom_end IS NULL;

CREATE OR REPLACE VIEW bikeshare_legacy_od_with_stations AS
SELECT
    od.service_month,
    od.start_station_id,
    start_station.name AS start_station_name,
    start_station.geom AS start_geom,
    od.end_station_id,
    end_station.name AS end_station_name,
    end_station.geom AS end_geom,
    od.casual_trips,
    od.registered_trips,
    od.total_trips
FROM bikeshare_legacy_od_ridership od
LEFT JOIN bikeshare_stations start_station ON start_station.station_id = od.start_station_id
LEFT JOIN bikeshare_stations end_station ON end_station.station_id = od.end_station_id;
