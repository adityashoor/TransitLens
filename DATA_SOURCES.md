# Data Sources Statement

**Project:** TransitLens  
**Competition:** Transit Data Conference 2026 — Data Challenge  
**Submitted pursuant to:** Section 4.4, Transit Data Challenge Official Rules  
**Date:** May 2026

This document lists every dataset used in TransitLens, its origin, the licence under which it is used, and confirmation that no Personally Identifiable Information (PII) is present.

---

## 1. TTC GTFS Static Feed

| Field | Detail |
|---|---|
| **Dataset name** | TTC Routes and Schedules (GTFS Static) |
| **Origin** | City of Toronto Open Data Portal — [open.toronto.ca/dataset/ttc-routes-and-schedules](https://open.toronto.ca/dataset/ttc-routes-and-schedules/) |
| **Licence** | Open Government Licence – City of Toronto |
| **Contains PII?** | No. Dataset contains route identifiers, stop coordinates, and schedule times only. No individual travel records. |
| **How used** | Route shapes (`shapes.txt`) are bundled as `src/mock/route_shapes.json` and rendered as polylines on the map. Route and stop metadata is stored in Supabase tables `tl_routes` and `tl_stops`. |

---

## 2. TTC GTFS-RT (Real-Time Feed)

| Field | Detail |
|---|---|
| **Dataset name** | TTC GTFS-Realtime — Vehicle Positions & Trip Updates |
| **Origin** | TTC public GTFS-RT endpoint — `https://bustime.ttc.ca/gtfsrt/` (also listed on open.toronto.ca) |
| **Licence** | Open Government Licence – City of Toronto (public feed, no API key required) |
| **Contains PII?** | No. Feed contains vehicle identifiers, GPS coordinates, route assignments, and arrival delay predictions. No passenger data. |
| **How used** | Vehicle positions feed (`/vehicles?debug`) powers the real-time map and fleet in-service status. Trip updates feed (`/trips?debug`) provides current delay readings used to anchor the 24-hour demand-index forecast. |

---

## 3. TTC Bus Delay Data (2025)

| Field | Detail |
|---|---|
| **Dataset name** | TTC Bus Delay Data — Since 2025 |
| **Origin** | Toronto Open Data / CKAN — package `e271cdae-8788-4980-96ce-6a5c95bc6618` — [open.toronto.ca/dataset/ttc-bus-delay-data](https://open.toronto.ca/dataset/ttc-bus-delay-data/) |
| **Licence** | Open Government Licence – City of Toronto |
| **Contains PII?** | No. Records contain route, location, date/time, incident code, and delay minutes. No individual passenger data. |
| **How used** | Incidents page (all delay events); Safety page (filtered for collision/emergency incident codes); Analytics route compare (on-time rate per route calculated from delay records). |

---

## 4. TTC Subway Delay Data (2025)

| Field | Detail |
|---|---|
| **Dataset name** | TTC Subway Delay Data — Since 2025 |
| **Origin** | Toronto Open Data / CKAN — package `996cfe8d-fb35-40ce-b569-698d51fc683b` — [open.toronto.ca/dataset/ttc-subway-delay-data](https://open.toronto.ca/dataset/ttc-subway-delay-data/) |
| **Licence** | Open Government Licence – City of Toronto |
| **Contains PII?** | No. Same structure as bus delay data. No individual passenger data. |
| **How used** | Incidents page; Safety page (high-delay events flagged as near-miss safety events). |

---

## 5. Toronto Police KSI (Killed or Seriously Injured) Collisions

| Field | Detail |
|---|---|
| **Dataset name** | Killed or Seriously Injured (KSI) Collision Data |
| **Origin** | Toronto Police Service Open Data — ArcGIS REST endpoint: `https://services.arcgis.com/S9th0jAJ7bqgIRjw/arcgis/rest/services/KSI/FeatureServer/0/query` |
| **Licence** | Open Government Licence – City of Toronto |
| **Contains PII?** | No. The API response returns collision attributes (date, street, involved type, injury type) without names, addresses, or individual identifiers. Fields returned: `OBJECTID`, `DATE_`, `STREET1`, `INVTYPE`, `INJURY`. |
| **How used** | Safety/Vision Zero page — recent pedestrian, cyclist, and vehicle collision events near transit infrastructure. Fetched with `resultRecordCount=30&orderByFields=DATE_ DESC`. |

---

## 6. Open-Meteo Weather Forecast API

| Field | Detail |
|---|---|
| **Dataset name** | Open-Meteo hourly weather forecast |
| **Origin** | Open-Meteo — `https://api.open-meteo.com/v1/forecast` |
| **Licence** | Creative Commons Attribution 4.0 (CC BY 4.0) — non-commercial, open access |
| **Contains PII?** | No. Meteorological forecast data only (temperature, precipitation probability, wind speed, weather code). |
| **How used** | Weather page — 48-hour Toronto forecast; transit impact rating derived from precipitation probability thresholds. |

---

## 7. TTC Annual Operating Statistics

| Field | Detail |
|---|---|
| **Dataset name** | TTC Operating Statistics (annual ridership totals) |
| **Origin** | Toronto Transit Commission — [ttc.ca/transparency-and-accountability/Operating-Statistics](https://www.ttc.ca/transparency-and-accountability/Operating-Statistics) |
| **Licence** | Public domain / Crown copyright — publicly published by the TTC |
| **Contains PII?** | No. Aggregate annual ridership figures by mode (e.g., 468.2 million riders in 2024). |
| **How used** | Analytics yearly chart — real published annual totals (2024: 468.2M, 2025: 490M est.) distributed across 12 months using TTC seasonal ridership patterns. |

---

## 8. FAO Ontario Transit Subsidies Report 2024

| Field | Detail |
|---|---|
| **Dataset name** | Municipal and Provincial Transit Agency Financial Data (2022) |
| **Origin** | Financial Accountability Office of Ontario — [fao-on.org/en/report/transit-subsidies-2024](https://fao-on.org/en/report/transit-subsidies-2024/) |
| **Licence** | Open Government Licence – Ontario |
| **Contains PII?** | No. Agency-level financial aggregates only (cost per trip, own-source revenue, subsidy rates). |
| **How used** | Budget page — real TTC cost-per-trip ($8.01) and own-source revenue-per-trip ($2.88) figures anchor the budget scatter chart. Values are varied by mode (subway, streetcar, bus) using published cost-structure ratios. |

---

## 9. Umo/NextBus XML Feed

| Field | Detail |
|---|---|
| **Dataset name** | Umo IQ (formerly NextBus) public XML feed |
| **Origin** | `https://retro.umoiq.com/service/publicXMLFeed` |
| **Licence** | Public API (no API key required for TTC) |
| **Contains PII?** | No. Returns vehicle positions, headway, and route configuration. No passenger data. |
| **How used** | Dashboard disruption feed — real route names fetched for selected routes; vehicle positions used as fallback when GTFS-RT is unavailable. |

---

## 10. Supabase-hosted Synthetic and Derived Data

| Field | Detail |
|---|---|
| **Dataset name** | TransitLens Supabase tables (`tl_routes`, `tl_stops`, `tl_kpi`, `tl_ridership_hourly`, `tl_equity`, `vehicle_positions`/`tl_vehicles`, `tl_model_metrics`) |
| **Origin** | Team-managed database. Route and stop data loaded from TTC GTFS Static (source 1 above). KPI, ridership, equity, and model metric rows are synthetic values generated by the team based on publicly available TTC aggregate statistics. |
| **Licence** | N/A — team-owned data |
| **Contains PII?** | No. All rows are aggregate metrics or synthetic values. No individual-level travel records are stored or inferred. |
| **How used** | Primary backend for dashboard KPIs, route/stop metadata, equity scores, and hourly ridership curves. |

---

## 11. TTC Subway Station Ridership 2023–2024 + Gravity Model OD (Demand page)

| Field | Detail |
|---|---|
| **Dataset name** | TTC Subway Ridership 2023–2024 (station boardings) |
| **Origin** | Toronto Transit Commission — [ttc.ca/transparency-and-accountability/Subway-Ridership-20232024.pdf](https://cdn.ttc.ca/-/media/Project/TTC/DevProto/Documents/Home/Transparency-and-accountability/Subway-Ridership-20232024.pdf) |
| **Licence** | TTC public document (Crown copyright, used for non-commercial research and analysis) |
| **Contains PII?** | No. Aggregate typical-weekday boardings per station. No individual travel records. |
| **How used** | The Demand page uses a **doubly-constrained gravity model** (T_ij = k × O_i × D_j / d_ij^1.5) parameterised with real 2023–24 station boardings as origin/destination weights, and TTC subway travel-time estimates (distance × 60/35 km/h) as the impedance term. This is the standard methodology used by MTO and Metrolinx when direct AFC origin-destination data is not available. The resulting flows represent statistically grounded demand estimates, not arbitrary synthetic values. |
| **Note on true OD data** | Real tap-in/tap-out PRESTO OD data is not publicly available and constitutes PII under these rules. The gravity-model approach is the correct scientific substitute per transit planning practice. |

---

## Privacy Confirmation

> We confirm that **no dataset used in TransitLens contains Personally Identifiable Information (PII)**, including names, addresses, phone numbers, email addresses, payment card numbers, individual travel history, facial recognition data, or device identifiers.
>
> All synthetic data is generated from public aggregate statistics and is not traceable to real individuals. All open datasets are used under their respective open government or Creative Commons licences. No data was scraped in violation of terms of service. No proprietary transit agency operational data was obtained through non-public agreements.
>
> The team is aware that origin-destination pairs at fine spatial/temporal resolution can constitute PII under the rules. The OD pairs displayed on the Demand page are fully synthetic (not derived from real passenger records) and represent named station hubs only, not fine-grained individual journeys.

---

*For questions, contact: adityashoor87@gmail.com*
