# Phase 3 Bike Share Backend

This phase ingests Bike Share Toronto trip-level ridership data into `transitlens`.

## Sources

- Ridership dataset: https://ckan0.cf.opendata.inter.prod-toronto.ca/dataset/bike-share-toronto-ridership-data
- Station metadata: https://ckan0.cf.opendata.inter.prod-toronto.ca/dataset/bike-share-toronto
- Live station information is loaded from the GBFS `station_information` feed.

The CKAN ridership dataset currently lists annual resources from `bikeshare-ridership-2014-2015` through `bikeshare-ridership-2026`.

## Tables

- `bikeshare_trips`: trip-level records with start/end timestamps, station IDs, station names, user type, bike ID/model, source year, and start/end geography points
- `bikeshare_stations`: station lookup table loaded from GBFS station metadata
- `bikeshare_ingestion_runs`: resource metadata, SHA-256, archive path, and row count
- `bikeshare_legacy_od_ridership`: 2014-2015 monthly origin-destination aggregate records, because that workbook is not trip-level
- `bikeshare_station_activity`: station start/end activity summary
- `bikeshare_trips_missing_station_geometry`: QA view for trips missing start or end geometry
- `bikeshare_legacy_od_with_stations`: 2014-2015 aggregate records joined to station geometry

Recent trip files contain station IDs and names but not coordinates. The ETL fills coordinates and geometry by joining `start_station_id` and `end_station_id` to `bikeshare_stations`.

The `bikeshare-ridership-2014-2015.xlsx` resource is not trip-level data. It contains monthly origin-destination aggregate matrices and a station key. The ETL preserves those records in `bikeshare_legacy_od_ridership` instead of inventing fake trip IDs for `bikeshare_trips`.

## Run

Test with one smaller year:

```powershell
.\backend\scripts\ingest_bikeshare.ps1 -Years "2026" -ForceDownload -Strict
.\backend\scripts\validate_bikeshare.ps1
```

Ingest all available years:

```powershell
.\backend\scripts\ingest_bikeshare.ps1 -ForceDownload -Strict
```

The full historical load downloads large ZIP files and can take a long time. The loader is resumable by year through `-Years`.

Register a monthly latest-year refresh:

```powershell
.\backend\scripts\register_bikeshare_monthly_task.ps1
```

## Validation

The validator checks:

- Trip and station row counts
- Nonpositive trip durations
- Trips over 24 hours
- Missing start/end geometry
- Zero coordinates
- Duplicate trip IDs

Trips over 24 hours are reported as QA rows, not strict failures, because long rentals can exist in raw operational data.
