# Phase 4 Backend API

TransitLens exposes a FastAPI service over the loaded `transitlens` PostgreSQL/PostGIS database.

## Run

```powershell
.\backend\scripts\run_api.ps1
```

Open:

- API: http://127.0.0.1:8000
- OpenAPI docs: http://127.0.0.1:8000/docs
- Health: http://127.0.0.1:8000/health

## Implemented Endpoints

- `GET /routes`
- `GET /routes/{route_id}`
- `GET /stops`
- `GET /stops/{stop_id}`
- `GET /ridership/annual`
- `GET /ridership/surface`
- `GET /ridership/bike-share`
- `GET /predict/ridership`
- `GET /equity-scores`
- `GET /equity-scores/{neighbourhood_id}`
- `POST /simulate-disruption`

## Notes

- Build equity scores from the loaded GTFS, TTC ridership, and Bike Share data:

```powershell
.\backend\scripts\build_equity.ps1
.\backend\scripts\validate_equity.ps1
```

- Train the ridership model artifact used by `GET /predict/ridership`. See `PHASE5_RIDERSHIP_ML.md` for model details:

```powershell
.\backend\scripts\train_prediction_model.ps1
```

- Redis caching is optional. Start Redis with Docker and set `API_CACHE_ENABLED=true` in `backend/.env`:

```powershell
.\backend\scripts\start_redis.ps1
```

- `GET /predict/ridership` loads `backend/models/ridership_model.joblib` by default.
- Equity endpoints read the generated `equity_scores` table.
- Disruption simulation uses GTFS stop-route topology, spatial transfers, affected trip counts, and estimated added minutes.
