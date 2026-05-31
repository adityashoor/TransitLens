# TransitLens

**Real-time transit intelligence and equity platform for the Toronto Transit Commission (TTC).**

> Transit Data Conference 2026 · Data Challenge submission · Toronto, ON · June 23–25 2026

---

## Live Demo

**[https://transit-lens.vercel.app](https://transit-lens.vercel.app)**

No login required. Works in any modern browser. Hosted on Vercel; remains accessible until July 31 2026.

---

## What It Does

TransitLens integrates live public data feeds into a single decision-support dashboard. It is designed for transit planners, equity researchers, and operations staff — not just data engineers.

| Page | Analytical purpose | Primary data source |
|---|---|---|
| **Dashboard** | Network health KPIs + live disruption feed | Supabase · Umo/NextBus XML |
| **Map** | Real-time vehicles, route shapes, **bus bunching detection** | TTC GTFS-RT · GTFS Static |
| **Analytics** | Daily trend, on-time rates by route, year-over-year growth | TTC Bus Delay Data (CKAN) · TTC Operating Stats |
| **Incidents** | Bus & subway delay events ranked by severity | Toronto Open Data 2025 delay CSVs |
| **Safety / Vision Zero** | Collision & near-miss events from delay data + KSI collisions | TTC Delay Data · Toronto Police KSI (ArcGIS) |
| **Equity** | Neighbourhood mobility scores, underserved area ranking + actionable service recommendations | Supabase `tl_equity` · GTFS stops |
| **Predictions** | 24 h demand-index forecast with confidence bands anchored to live GTFS-RT delay signal | TTC GTFS-RT trip updates |
| **Fleet** | Vehicle roster with live in-service status from GTFS-RT vehicle positions feed | TTC GTFS-RT vehicles |
| **Budget** | Cost-per-rider and subsidy gap by route; equity-income scatter chart | FAO Ontario 2024 report · Supabase equity |
| **Weather** | 48 h Toronto forecast with transit ridership impact rating | Open-Meteo API |
| **Routes** | Per-route stop map and hourly ridership detail | Supabase `tl_routes` / `tl_stops` |
| **Simulator** | Disruption scenario modelling with cascading ridership impact estimates | GTFS network + parametric model |

### Novel feature: real-time bunching detection

The Map page detects **bus bunching** live: when two vehicles on the same route are within 200 m of each other (computed via the Haversine formula against GTFS-RT vehicle positions), both are flagged with a pulsing amber warning on the map. This is surfaced as an operational alert that operators can act on immediately.

---

## Running Locally

### Prerequisites

- Node.js ≥ 20

### Quick start (no backend required)

Every data hook has a graceful mock fallback. The app is fully functional without Supabase — all external APIs (GTFS-RT, Open-Meteo, Toronto Open Data CKAN) are called directly from the browser.

```bash
git clone https://github.com/AdityaShoor/transitlens.git
cd transitlens
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

### With Supabase (for full real-data mode)

Create `.env.local`:

```env
VITE_SUPABASE_URL=https://<your-project>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-key>
```

Then `npm run dev` as above.

### Production build

```bash
npm run build    # outputs dist/
npm run preview  # test locally
npm run start    # serves on $PORT — used by Railway
```

---

## Supabase Schema

```sql
create table tl_routes (
  route_id text primary key,
  route_short_name text,
  route_long_name text,
  route_type int,
  route_color text
);

create table tl_stops (
  stop_id text primary key,
  stop_name text,
  stop_lat float,
  stop_lon float
);

create table tl_kpi (
  id int primary key default 1,
  daily_ridership int,
  active_vehicles int,
  delayed_routes int,
  avg_wait float,
  congestion_index float,
  equity_score float
);

create table tl_ridership_hourly (
  hour text primary key,
  actual int,
  predicted int
);

create table tl_equity (
  id text primary key,
  name text,
  lat float,
  lng float,
  equity_score float,
  stop_density float
);

create table tl_vehicles (
  id text primary key,
  route_id text,
  lat float,
  lon float,
  bearing int,
  delay int,
  occupancy int,
  updated_at timestamptz default now()
);

create table tl_model_metrics (
  id int primary key default 1,
  accuracy_pct float,
  r2 float,
  mae float,
  routes_analysed int
);
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 19 + TanStack Router v1 + TanStack Query v5 |
| Styling | Tailwind CSS v4 + custom CSS design tokens |
| Maps | React Leaflet 5 + CARTO dark basemap tiles |
| Charts | Recharts 3 |
| Backend / DB | Supabase (Postgres + Realtime subscriptions) |
| Animation | Framer Motion 12 |
| Build | Vite 8 + Rolldown bundler |
| Hosting | Railway (production) |

---

## Data Sources

See [DATA_SOURCES.md](DATA_SOURCES.md) for the complete Data Sources Statement (Section 4.4 of the Transit Data Challenge rules), including dataset origins, licences, and PII confirmation for every source used.

**All data used is open/public or synthetically generated. No PII is present in any dataset.**

---

## Competition Themes Addressed

- **Advanced data analytics and AI in public transit** — demand-index forecasting using GTFS-RT delay signal; real-time bunching detection algorithm
- **Strategic/service planning, performance measurement, equity analysis** — neighbourhood mobility scoring, subsidy equity analysis, route-level on-time rates
- **Operations control and incident management** — live GTFS-RT integration, TTC delay incident feed, Vision Zero KSI collision overlay
- **Demand and travel pattern understanding** — hourly ridership curves, origin-destination pair visualization, disruption simulation
- **Visualization tools for transit data communication** — interactive map, live charts, scenario simulation
- **Practical use of GTFS / GTFS-RT specifications** — static GTFS for route shapes; GTFS-RT for vehicle positions, trip updates, and service alerts

---

## Licence

MIT © 2026 TransitLens Team
