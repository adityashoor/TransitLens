# Phase 2 Ridership Backend

This phase ingests TTC ridership workbooks into the existing `transitlens` PostgreSQL/PostGIS database.

## Sources

- TTC Ridership Analysis: https://ckan0.cf.opendata.inter.prod-toronto.ca/dataset/ttc-ridership-analysis
- TTC Ridership - All Day Weekday for Surface Routes: https://ckan0.cf.opendata.inter.prod-toronto.ca/dataset/ttc-ridership-all-day-weekday-for-surface-routes

Confirmed CKAN resources:

- `1985-2019 Analysis of ridership`, last modified `2020-06-01T15:41:53.903776`
- `ranking-surface-routes`, last modified `2019-07-23T18:11:18.477179`

## Tables

- `ridership_matrix`: annual ridership by `year`, `media`, and `rider_type`
- `surface_route_ridership`: all-day weekday ridership by TTC surface route
- `ridership_ingestion_runs`: source file metadata, archive path, SHA-256, and row count
- `surface_route_ridership_with_gtfs`: view joining surface ridership to GTFS `routes`
- `surface_route_ridership_unmatched_gtfs`: QA view for surface ridership routes missing from the current GTFS feed

Historical ridership values are published in thousands, so the ingestion multiplies workbook values by `1,000`.

## Run

```powershell
.\backend\scripts\ingest_ridership.ps1 -ForceDownload -Strict
.\backend\scripts\validate_ridership.ps1
```

## Validation

The validator checks:

- Row counts for both ridership tables
- No negative ridership counts
- Surface route records that do not match a GTFS `routes.route_id`

Some missing GTFS matches can be legitimate when the historical surface route workbook includes routes that are not present in the currently loaded GTFS feed.

The current 2016 surface route workbook has 20 records without a match in the 2026 GTFS feed, including retired Rocket and Downtown Express routes. They remain loaded and are exposed through `surface_route_ridership_unmatched_gtfs`.

## Automation

Register a yearly refresh:

```powershell
.\backend\scripts\register_ridership_yearly_task.ps1
```
