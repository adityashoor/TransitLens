# Railway Deployment

TransitLens runs on Railway as three services in one project:

- `frontend`: the Vite static site, served by Nginx from the repository root.
- `api`: the FastAPI application, built from `backend/Dockerfile`.
- `postgis`: a persistent PostgreSQL service based on a PostGIS template or image.

Do not expose the database directly to website visitors. The browser calls `api`; only
`api` receives the database connection string.

## 1. Create Services

Create an empty Railway project named `TransitLens`, then add:

1. A `frontend` service sourced from this GitHub repository. It uses `/railway.toml`.
2. An `api` service sourced from the same repository. In its service settings, set its
   config file path to `/backend/railway.toml`.
3. A PostGIS service from Railway's PostGIS template. The plain PostgreSQL template is
   not sufficient unless PostGIS can be installed, because `backend/sql/001_gtfs_schema.sql`
   creates the `postgis` extension.

Generate public Railway domains for `frontend` and `api`. Do not generate a public HTTP
domain for `postgis`.

## 2. Configure Variables

Set these variables on `api`:

```text
DATABASE_URL=<the PostGIS connection URL, using postgresql+psycopg://>
ASYNC_DATABASE_URL=<the same PostGIS connection, using postgresql+asyncpg://>
API_CACHE_ENABLED=false
PREDICTION_MODEL_PATH=backend/models/ridership_model.joblib
CORS_ORIGINS=https://${{frontend.RAILWAY_PUBLIC_DOMAIN}}
```

If Railway's database URL starts with `postgresql://`, use it for `DATABASE_URL` by
changing that prefix to `postgresql+psycopg://`; for `ASYNC_DATABASE_URL`, change the
prefix to `postgresql+asyncpg://`.

Set this build variable on `frontend`:

```text
VITE_API_BASE_URL=https://${{api.RAILWAY_PUBLIC_DOMAIN}}
```

Deploy `api` and `frontend` after setting the variables.

## 3. Load Initial Data

Run these inside the `api` service after the PostGIS database is reachable:

```bash
python -m transitlens_gtfs.cli init-db
python -m transitlens_gtfs.cli ingest --download --force-download --strict
python -m transitlens_gtfs.cli ingest-ridership --force-download --strict
python -m transitlens_gtfs.cli build-equity
python -m transitlens_gtfs.cli build-transit-graph
```

Bike Share raw trip ingestion is intentionally not part of the first deployment: local
downloads already exceed 3 GB and trip-level storage can dominate database cost. Load
a selected year later, or publish aggregate tables for the public demo.

## 4. Verify

Open:

```text
https://<api-domain>/health
https://<api-domain>/docs
https://<api-domain>/routes
https://<frontend-domain>/
```

The frontend should call the Railway API URL, and browser requests from any unapproved
origin should be rejected by CORS.

