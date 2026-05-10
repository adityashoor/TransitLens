CREATE TABLE IF NOT EXISTS equity_areas (
    area_id TEXT PRIMARY KEY,
    area_name TEXT NOT NULL,
    area_type TEXT NOT NULL DEFAULT 'neighbourhood',
    source_area_id TEXT,
    classification TEXT,
    geom geometry(MultiPolygon, 4326) NOT NULL,
    source_url TEXT,
    loaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_equity_areas_geom ON equity_areas USING GIST(geom);
CREATE INDEX IF NOT EXISTS idx_equity_areas_name ON equity_areas(area_name);

CREATE TABLE IF NOT EXISTS equity_demographics (
    area_id TEXT PRIMARY KEY REFERENCES equity_areas(area_id) ON DELETE CASCADE,
    population DOUBLE PRECISION,
    median_income DOUBLE PRECISION,
    senior_share DOUBLE PRECISION,
    low_income_share DOUBLE PRECISION,
    vulnerable_share DOUBLE PRECISION,
    car_commute_share DOUBLE PRECISION,
    source_year INTEGER NOT NULL DEFAULT 2021,
    source_url TEXT,
    loaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS equity_scores (
    geography_id TEXT PRIMARY KEY REFERENCES equity_areas(area_id) ON DELETE CASCADE,
    geography_name TEXT NOT NULL,
    area_type TEXT NOT NULL DEFAULT 'neighbourhood',
    stop_density DOUBLE PRECISION NOT NULL,
    ridership_per_capita DOUBLE PRECISION NOT NULL,
    median_income DOUBLE PRECISION,
    vulnerable_share DOUBLE PRECISION,
    distance_to_stop DOUBLE PRECISION,
    score DOUBLE PRECISION NOT NULL,
    metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
    geom geometry(MultiPolygon, 4326) NOT NULL,
    computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT equity_scores_score_range CHECK (score >= 0 AND score <= 100)
);

ALTER TABLE equity_scores ADD COLUMN IF NOT EXISTS area_type TEXT NOT NULL DEFAULT 'neighbourhood';
ALTER TABLE equity_scores ADD COLUMN IF NOT EXISTS stop_density DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE equity_scores ADD COLUMN IF NOT EXISTS ridership_per_capita DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE equity_scores ADD COLUMN IF NOT EXISTS median_income DOUBLE PRECISION;
ALTER TABLE equity_scores ADD COLUMN IF NOT EXISTS vulnerable_share DOUBLE PRECISION;
ALTER TABLE equity_scores ADD COLUMN IF NOT EXISTS distance_to_stop DOUBLE PRECISION;
ALTER TABLE equity_scores
    ALTER COLUMN geom TYPE geometry(MultiPolygon, 4326)
    USING ST_Multi(geom);

CREATE INDEX IF NOT EXISTS idx_equity_scores_score ON equity_scores(score);
CREATE INDEX IF NOT EXISTS idx_equity_scores_geom ON equity_scores USING GIST(geom);

DROP VIEW IF EXISTS equity_scores_summary;

CREATE OR REPLACE VIEW equity_scores_summary AS
SELECT
    geography_id,
    geography_name,
    area_type,
    score,
    stop_density,
    ridership_per_capita,
    median_income,
    vulnerable_share,
    distance_to_stop,
    metrics ->> 'priority_level' AS priority_level,
    (metrics ->> 'stop_count')::integer AS stop_count,
    (metrics ->> 'route_count')::integer AS route_count,
    (metrics ->> 'trip_count')::integer AS trip_count,
    computed_at
FROM equity_scores;
