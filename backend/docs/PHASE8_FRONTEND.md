# Phase 8 Frontend Dashboard

TransitLens now includes a Vite React frontend for the FastAPI/PostGIS backend.

## Implemented

- Premium SaaS dashboard shell inspired by the Spruha admin template: sidebar navigation, sticky topbar, cards, KPI panels, tables, charts, and responsive spacing.
- Live API integration through `src/services/api.js`.
- Reusable request hook in `src/hooks/useApi.js`.
- Overview dashboard for GTFS route count, surface ridership, equity watchlist, and trained ridership model metrics.
- Equity scoring screen with Leaflet map points, score ranking chart, selected-area details, and neighbourhood table.
- Ridership demand screen with route/weather controls, model forecast chart, surface ridership ranking, and model quality metrics.
- Disruption lab screen wired to `/simulate-disruption` with event form, result KPIs, affected OD table, and route preview map.
- Network map screen with TTC route selection, route shape overlay, nearby stops, stop-density chart, and layer toggles.

## Run Locally

Start the backend first:

```powershell
cd "C:\Users\Owner\OneDrive\Desktop\web for disgne\New folder\TransitLens\backend"
..\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Start the frontend:

```powershell
cd "C:\Users\Owner\OneDrive\Desktop\web for disgne\New folder\TransitLens"
npm.cmd run dev -- --host 127.0.0.1
```

Open:

```text
http://localhost:5173
```

The frontend defaults to:

```text
http://127.0.0.1:8000
```

Override it with:

```text
VITE_API_BASE_URL=http://127.0.0.1:8000
```

## Verification

```powershell
npm.cmd run lint
npm.cmd run build
```

Both commands pass. The Vite build may need to run outside the Codex sandbox on Windows because Tailwind/Vite loads native Windows binaries.
