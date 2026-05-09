CREATE TABLE IF NOT EXISTS ml_model_versions (
    model_version_id BIGSERIAL PRIMARY KEY,
    model_name TEXT NOT NULL,
    model_path TEXT NOT NULL,
    algorithm TEXT NOT NULL,
    trained_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    training_start TIMESTAMPTZ,
    training_end TIMESTAMPTZ,
    source_route_rows INTEGER NOT NULL,
    training_rows INTEGER NOT NULL,
    validation_rows INTEGER NOT NULL,
    test_rows INTEGER NOT NULL,
    metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
    feature_columns JSONB NOT NULL DEFAULT '[]'::jsonb,
    hyperparameters JSONB NOT NULL DEFAULT '{}'::jsonb,
    active BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_ml_model_versions_active ON ml_model_versions(active);
CREATE INDEX IF NOT EXISTS idx_ml_model_versions_trained_at ON ml_model_versions(trained_at);

CREATE TABLE IF NOT EXISTS ridership_prediction_requests (
    prediction_request_id BIGSERIAL PRIMARY KEY,
    requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    route_id TEXT NOT NULL,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    weather TEXT,
    model_name TEXT NOT NULL,
    point_count INTEGER NOT NULL,
    prediction_sum DOUBLE PRECISION NOT NULL,
    actual_sum DOUBLE PRECISION,
    absolute_error DOUBLE PRECISION,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_ridership_prediction_requests_route ON ridership_prediction_requests(route_id);
CREATE INDEX IF NOT EXISTS idx_ridership_prediction_requests_requested_at ON ridership_prediction_requests(requested_at);
