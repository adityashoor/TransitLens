# Phase 6 Equity Scoring

This module computes TransitLens equity scores for Toronto neighbourhoods.

## Data Sources

- City of Toronto Open Data `Neighbourhoods` GeoJSON, WGS84 158-neighbourhood model.
- City of Toronto Open Data `Neighbourhood Profiles` 2021 workbook.
- Local TransitLens GTFS tables: `stops`, `stop_times`, `trips`, `routes`.
- Local TransitLens ridership table: `surface_route_ridership`.

Downloaded source files are cached under `data/equity/sources/`.

## Database Tables

- `equity_areas`: Toronto neighbourhood polygons.
- `equity_demographics`: population, income, seniors, low-income, vulnerable-share, and car-commute indicators.
- `equity_scores`: API-ready score table with geometry and raw metric columns:
  - `geography_id`
  - `geography_name`
  - `stop_density`
  - `ridership_per_capita`
  - `median_income`
  - `vulnerable_share`
  - `distance_to_stop`
  - `score`
  - `metrics`
  - `geom`

## Score Formula

Each metric is min-max normalised across all neighbourhoods:

- Stop density: 30%
- Ridership per capita: 20%
- Income need, where lower median income means higher need: 20%
- Vulnerable share, using seniors plus low-income prevalence: 20%
- Distance to nearest stop, where shorter distance is better: 10%

Scores are scaled to `0-100`. Higher values indicate stronger equity alignment: transit access is higher in areas with higher measured need. Lower values flag higher improvement need.

## Run

```powershell
.\backend\scripts\build_equity.ps1 -ForceDownload
.\backend\scripts\validate_equity.ps1
```

## Schedule

```powershell
.\backend\scripts\register_equity_annual_task.ps1
```

The scheduled task refreshes source files and recalculates equity scores each February 15 at 04:30 by default.

## API

```text
GET /equity-scores?sort=lowest&limit=20
GET /equity-scores/{area_id}
```

Sorting options:

- `lowest`: areas with lowest equity scores first.
- `highest`: areas with highest equity scores first.
- `name`: alphabetical.

## Notes

The current City neighbourhood profile workbook does not include a direct disability-prevalence row. The implemented vulnerable-share metric uses senior share plus low-income prevalence, and the raw components are preserved in `metrics` for transparent review.
