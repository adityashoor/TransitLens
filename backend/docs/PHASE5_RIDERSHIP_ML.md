# Phase 5 Ridership Demand Forecasting

This module trains and deploys the TransitLens ridership forecasting model used by `GET /predict/ridership`.

## Implemented

- Builds hourly route-level training samples from loaded TTC surface route ridership and GTFS route context.
- Adds calendar features: hour, day of week, month, weekend, peak period, holiday, and school-term flags.
- Downloads historical Toronto weather from Open-Meteo when available, with local defaults if the API is unavailable.
- Adds weather features: temperature, precipitation, snowfall, and wind speed.
- Adds lag features: 24-hour and 168-hour expected ridership lags.
- Uses chronological train, validation, and test splits.
- Tunes a compact `HistGradientBoostingRegressor`.
- Saves the model bundle to `backend/models/ridership_model.joblib`.
- Registers model metadata and metrics in `ml_model_versions`.
- Logs API prediction requests in `ridership_prediction_requests` for monitoring and later drift checks.

## Train

```powershell
.\backend\scripts\train_prediction_model.ps1
```

The command applies SQL schema files, trains the model, saves the artifact, and registers a new active model version.

## Serve

```powershell
.\backend\scripts\run_api.ps1
```

Example:

```powershell
Invoke-RestMethod "http://127.0.0.1:8000/predict/ridership?route_id=504&start_time=2026-05-09T08:00:00&end_time=2026-05-09T11:00:00&temperature_c=8&precipitation_mm=1.5&wind_kmh=20"
```

## Model Registry

```sql
SELECT model_version_id, model_name, active, metrics
FROM ml_model_versions
ORDER BY model_version_id DESC;
```

## Monitoring

Every prediction request is stored in `ridership_prediction_requests` with route, time window, model name, point count, and prediction sum. When actual ridership observations become available, populate `actual_sum` and `absolute_error` to monitor drift.

```sql
SELECT route_id, model_name, point_count, prediction_sum, requested_at
FROM ridership_prediction_requests
ORDER BY requested_at DESC
LIMIT 20;
```

## Current Limitation

The source TTC dataset has annual and route-level surface ridership, not observed hourly route counts. The trainer therefore creates hourly route-level samples from TTC route totals, GTFS context, weather, and calendar profiles. When true hourly APC/PRESTO observations are available, replace the generated target construction with those actual observations; the model registry, API loading, and monitoring tables are already ready for that upgrade.
