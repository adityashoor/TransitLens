/**
 * TransitLens API client.
 * Calls the FastAPI backend; gracefully falls back to mock data
 * if the API is unreachable (e.g. conference Wi-Fi, cold start).
 */

import * as mock from "../data/mockData";

const BASE_URL =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV ? "http://localhost:8000" : "https://transitlens-backend.up.railway.app");

const TIMEOUT_MS = 8000;

async function _get(path, fallback) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    clearTimeout(timer);
    console.warn(`[API] ${path} failed (${err.message}) — using mock data`);
    return typeof fallback === "function" ? fallback() : fallback;
  }
}

// ── KPI ───────────────────────────────────────────────────────────────────────
export const fetchKPI = () =>
  _get("/api/kpi", () => mock.kpiData);

// ── GTFS ──────────────────────────────────────────────────────────────────────
export const fetchRoutes = () =>
  _get("/api/gtfs/routes?limit=200", () => []);

export const fetchStops = () =>
  _get("/api/gtfs/stops?limit=500", () => []);

// ── Equity ────────────────────────────────────────────────────────────────────
export const fetchEquityScores = () =>
  _get("/api/equity/scores", () => mock.equityNeighborhoods);

export const fetchEquityRoutes = () =>
  _get("/api/equity/routes", () =>
    mock.equityRoutes.map((r) => ({ id: r.id, name: r.name, score: r.score, route_type: 3 }))
  );

export const fetchEquitySummary = () =>
  _get("/api/equity/summary", () => ({
    average: mock.kpiData.avgEquityScore,
    min: 31,
    max: 89,
    underserved: 4,
    total_zones: mock.equityNeighborhoods.length,
  }));

// ── Ridership ─────────────────────────────────────────────────────────────────
export const fetchTimeSeries = (params = {}) => {
  const qs = new URLSearchParams({
    route_type: params.routeType ?? 1,
    day_of_week: params.dayOfWeek ?? 1,
    month: params.month ?? 3,
    temp_c: params.tempC ?? 5,
    precip_mm: params.precipMm ?? 0,
  });
  return _get(`/api/ridership/timeseries?${qs}`, () => mock.ridershipTimeSeries);
};

export const fetchHeatmap = () =>
  _get("/api/ridership/heatmap", () => mock.stationHeatmap);

export const fetchDemandByRoute = () =>
  _get("/api/ridership/demand", () => mock.demandByRoute);

// ── Model metrics ─────────────────────────────────────────────────────────────
export const fetchModelMetrics = () =>
  _get("/api/model/metrics", () => ({
    r2: 0.921,
    mae: 312,
    mape: 12.5,
    accuracy_pct: 87.5,
    n_train: 74000,
    n_test: 13000,
    features: ["hour", "day_of_week", "month", "route_type", "temp_c"],
    importances: { hour: 0.38, day_of_week: 0.22, route_type: 0.18, month: 0.12, temp_c: 0.10 },
  }));

// ── Disruption ────────────────────────────────────────────────────────────────
export const fetchDisruptionStations = () =>
  _get("/api/disruption/stations", () =>
    mock.transitNetwork.stations.map((s) => ({
      stop_id:   s.id,
      stop_name: s.name,
      lat:       s.lat,
      lng:       s.lng,
      routes:    s.lines,
    }))
  );

export const fetchDisruptionSimulation = (stopId) =>
  _get(`/api/disruption/simulate/${stopId}`, () => {
    const scenario =
      mock.disruptionScenarios[stopId] ?? mock.disruptionScenarios.default;
    const station = mock.transitNetwork.stations.find((s) => s.id === stopId);
    return {
      stop_id:          stopId,
      stop_name:        station?.name ?? stopId,
      affected_routes:  scenario.affectedRoutes.map((r) => ({ route_id: r, route_name: r })),
      alternatives:     scenario.alternatives,
      recovery_time:    scenario.recoveryTime,
      impacted_riders:  scenario.impactedRiders,
    };
  });

// ── Service Gap ───────────────────────────────────────────────────────────────
export const fetchGapZones = () =>
  _get("/api/servicegap/zones", () => mock.serviceGapZones);

export const fetchCoverageStats = () =>
  _get("/api/servicegap/coverage", () => mock.coverageStats);

// ── Health check ──────────────────────────────────────────────────────────────
export const fetchHealth = () =>
  _get("/health", () => ({ status: "offline" }));
