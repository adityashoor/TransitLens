CREATE TABLE IF NOT EXISTS ridership_ingestion_runs (
    ridership_ingestion_id BIGSERIAL PRIMARY KEY,
    source_name TEXT NOT NULL,
    source_url TEXT NOT NULL,
    portal_resource_id TEXT,
    portal_last_modified TIMESTAMPTZ,
    ingested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    file_sha256 TEXT NOT NULL UNIQUE,
    archive_path TEXT NOT NULL,
    row_count INTEGER NOT NULL,
    notes TEXT
);

CREATE TABLE IF NOT EXISTS ridership_matrix (
    year INTEGER NOT NULL,
    media TEXT NOT NULL,
    rider_type TEXT NOT NULL,
    count BIGINT NOT NULL,
    source_file TEXT,
    ingested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (year, media, rider_type),
    CONSTRAINT ridership_matrix_count_nonnegative CHECK (count >= 0)
);

CREATE TABLE IF NOT EXISTS surface_route_ridership (
    route_id TEXT PRIMARY KEY,
    route_name TEXT NOT NULL,
    rank INTEGER,
    all_day_riders BIGINT,
    sample_date DATE NOT NULL,
    source_file TEXT,
    ingested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT surface_route_ridership_nonnegative CHECK (
        all_day_riders IS NULL OR all_day_riders >= 0
    )
);

CREATE INDEX IF NOT EXISTS idx_ridership_matrix_year ON ridership_matrix(year);
CREATE INDEX IF NOT EXISTS idx_ridership_matrix_rider_type ON ridership_matrix(rider_type);
CREATE INDEX IF NOT EXISTS idx_surface_route_ridership_rank ON surface_route_ridership(rank);
CREATE INDEX IF NOT EXISTS idx_surface_route_ridership_sample_date ON surface_route_ridership(sample_date);

CREATE OR REPLACE VIEW surface_route_ridership_with_gtfs AS
SELECT
    srr.route_id,
    srr.route_name,
    srr.rank,
    srr.all_day_riders,
    srr.sample_date,
    r.route_short_name,
    r.route_long_name,
    r.route_type
FROM surface_route_ridership srr
LEFT JOIN routes r ON r.route_id = srr.route_id;

CREATE OR REPLACE VIEW surface_route_ridership_unmatched_gtfs AS
SELECT
    srr.route_id,
    srr.route_name,
    srr.rank,
    srr.all_day_riders,
    srr.sample_date
FROM surface_route_ridership srr
LEFT JOIN routes r ON r.route_id = srr.route_id
WHERE r.route_id IS NULL;
