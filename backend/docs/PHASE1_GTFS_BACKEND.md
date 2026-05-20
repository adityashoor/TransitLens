# Phase 1 GTFS Backend

TransitLens Phase 1 ingests the TTC static GTFS feed from the City of Toronto Open Data portal into PostgreSQL/PostGIS.

## Source

- Portal: https://open.toronto.ca/dataset/ttc-routes-and-schedules/
- CKAN API: https://ckan0.cf.opendata.inter.prod-toronto.ca/api/3/action/package_show?id=ttc-routes-and-schedules
- Resource name: `TTC Routes and Schedules Data`
- Confirmed latest portal metadata during implementation: `2026-04-24T01:23:03`
- Downloaded local feed: `data/gtfs/latest.zip`
- Downloaded SHA-256: `f1c40c5b43019ac26c3892c6f3ad1664d674686bbe5bf321fa0605c179df797d`

The ZIP contains `agency.txt`, `calendar.txt`, `calendar_dates.txt`, `routes.txt`, `shapes.txt`, `stops.txt`, `stop_times.txt`, and `trips.txt`.

## Database

The default database is `transitlens`. The schema creates:

- Core GTFS tables: `agency`, `routes`, `stops`, `trips`, `stop_times`, `shapes`, `calendar`, `calendar_dates`
- Version tracking: `feed_versions`
- Spatial convenience table: `shape_geometries`
- Views: `route_shape_summary`, `stop_route_summary`
- GIST indexes on `stops.geom`, `shapes.geom`, and `shape_geometries.geom`

`stops.geom` and `shapes.geom` are `geometry(Point, 4326)`. `shape_geometries.geom` is a `geometry(LineString, 4326)` generated from ordered shape points.

## Setup

From the repository root:

```powershell
.\backend\scripts\setup.ps1
```

This creates `.venv`, installs Python dependencies, starts PostGIS through Docker Compose, creates the `transitlens` database, enables PostGIS, and applies the schema.

If PostgreSQL/PostGIS is already running locally, copy `backend/.env.example` to `backend/.env`, edit `DATABASE_URL` and `POSTGRES_ADMIN_URL`, then run:

```powershell
.\backend\scripts\setup.ps1 -SkipDocker
```

## Ingest

Download the latest feed, extract it, load the tables, populate geometry, archive the ZIP, and validate:

```powershell
.\backend\scripts\ingest.ps1 -Download -ForceDownload -Strict
```

Validate an existing loaded database:

```powershell
.\backend\scripts\validate.ps1
```

Equivalent Python commands:

```powershell
.\.venv\Scripts\python.exe -m transitlens_gtfs.cli download --force
.\.venv\Scripts\python.exe -m transitlens_gtfs.cli ingest --download --force-download --strict
.\.venv\Scripts\python.exe -m transitlens_gtfs.cli validate
```

## Automation

Windows Task Scheduler:

```powershell
.\backend\scripts\register_windows_task.ps1 -Time "03:00"
```

Linux cron example:

```cron
0 3 1 * * /path/to/TransitLens/backend/scripts/cron_ingest.sh >> /path/to/TransitLens/data/logs/gtfs_cron.log 2>&1
```

## Validation

The validator checks:

- Database row counts against file row counts
- `stop_times.trip_id` references `trips.trip_id`
- `stop_times.stop_id` references `stops.stop_id`
- `trips.route_id` references `routes.route_id`
- `trips.service_id` appears in `calendar` or `calendar_dates`
- Stop and shape coordinate ranges
- Missing geometry values
- Empty generated shape lines
