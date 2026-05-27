import { useQuery } from "@tanstack/react-query";
import {
  NETWORK,
  hourlyRidership,
  dailyRidership,
  yearlyGrowth,
  routeComparison,
  neighborhoodHeatmap,
  disruptions,
  notifications,
  predictionTimeline,
  aiCards,
  HOODS,
  generateVehicles,
  kpiSnapshot,
  incidents,
  fleet,
  odPairs,
  safetyEvents,
  weatherImpact,
  budgetByRoute,
  bunching,
} from "./data";
import type { Route } from "./routes";

export const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ─── Backend response types ──────────────────────────────────────────────────

export interface BackendRoute {
  route_id: string;
  short_name: string | null;
  long_name: string | null;
  route_type: number | null;
  agency_id: string | null;
  agency_name: string | null;
  route_color?: string | null;
  shape?: [number, number][];
}

export interface BackendStop {
  stop_id: string;
  stop_code: string | null;
  stop_name: string;
  lat: number | null;
  lon: number | null;
  distance_m?: number | null;
  routes?: BackendRoute[];
}

export interface AnnualRidershipRow {
  year: number;
  media: string;
  rider_type: string;
  count: number;
}

export interface SurfaceRidershipRow {
  route_id: string;
  route_name: string;
  rank: number | null;
  all_day_riders: number | null;
  sample_date: string;
  route_short_name: string | null;
  route_long_name: string | null;
}

export interface BikeShareStats {
  group_by: string;
  rows: { key: string; label: string; trip_count: number; avg_duration_seconds: number }[];
}

export interface EquityScore {
  geography_id: string;
  geography_name: string | null;
  area_type: string | null;
  stop_density: number | null;
  ridership_per_capita: number | null;
  median_income: number | null;
  vulnerable_share: number | null;
  distance_to_stop: number | null;
  score: number;
  metrics: Record<string, unknown>;
}

export interface PredictionPoint {
  timestamp: string;
  predicted_riders: number;
  lower_bound: number;
  upper_bound: number;
}

export interface PredictionResponse {
  route_id: string;
  model: string;
  model_metrics: Record<string, unknown>;
  points: PredictionPoint[];
}

// ─── Core fetch helper ───────────────────────────────────────────────────────

async function tryLive<T>(
  path: string,
  fallback: () => Promise<T>,
  options?: RequestInit,
): Promise<T> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      signal: AbortSignal.timeout(2500),
      ...options,
    });
    if (!res.ok) return fallback();
    return res.json() as Promise<T>;
  } catch {
    return fallback();
  }
}

// ─── Route normalizer ────────────────────────────────────────────────────────

function routeTypeToMode(t: number | null): "subway" | "streetcar" | "bus" {
  if (t === 1) return "subway";
  if (t === 0) return "streetcar";
  return "bus";
}

const MODE_COLORS: Record<string, string> = {
  subway: "#f1c232",
  streetcar: "#ef4444",
  bus: "#1f7de8",
};

function normalizeRoute(r: BackendRoute, ridership = 0): Route {
  const mode = routeTypeToMode(r.route_type);
  const rawColor = r.route_color ? `#${r.route_color.replace(/^#/, "")}` : null;
  const color = rawColor && /^#[0-9a-fA-F]{6}$/.test(rawColor) ? rawColor : MODE_COLORS[mode];
  return {
    id: r.route_id,
    shortName: r.short_name ?? r.route_id,
    longName: r.long_name ?? r.short_name ?? r.route_id,
    mode,
    color,
    stopIds: [],
    path: r.shape ?? [],
    ridership: ridership || 500,
    onTime: 85,
    congestion: 40,
    aiScore: 78,
    trend: 0,
    status: "normal",
    headway: mode === "subway" ? 4 : mode === "streetcar" ? 8 : 12,
  };
}

// ─── mockApi: all API calls (live-first, mock fallback) ──────────────────────

export const mockApi = {
  // Mock-only endpoints (no backend equivalent)
  network: async () => (await wait(50), NETWORK),
  kpis: async () => (await wait(80), kpiSnapshot()),
  hourly: async () => (await wait(120), hourlyRidership()),
  daily: async () => (await wait(120), dailyRidership()),
  yearly: async () => (await wait(120), yearlyGrowth()),
  routeCompare: async () => (await wait(100), routeComparison()),
  heatmap: async () => (await wait(150), neighborhoodHeatmap()),
  disruptions: async () => (await wait(80), disruptions()),
  notifications: async () => (await wait(50), notifications),
  predictions: async () => (await wait(120), predictionTimeline()),
  aiCards: async () => (await wait(80), aiCards),
  hoods: async () => (await wait(80), HOODS),
  vehicles: async () => (await wait(80), generateVehicles()),
  incidents: async () => (await wait(100), incidents()),
  fleet: async () => (await wait(100), fleet()),
  odPairs: async () => (await wait(100), odPairs()),
  safety: async () => (await wait(100), safetyEvents()),
  weather: async () => (await wait(100), weatherImpact()),
  budget: async () => (await wait(100), budgetByRoute()),
  bunching: async () => (await wait(100), bunching()),

  // ── Live: GET /routes (normalized to Route[]) ──────────────────────────────
  liveRoutes: async (): Promise<Route[]> => {
    try {
      const [routesRaw, surfaceRaw] = await Promise.all([
        fetch(`${API_BASE}/routes`, { signal: AbortSignal.timeout(2500) }).then((r) =>
          r.ok ? (r.json() as Promise<BackendRoute[]>) : Promise.reject(),
        ),
        fetch(`${API_BASE}/ridership/surface?limit=1000`, { signal: AbortSignal.timeout(2500) }).then(
          (r) => (r.ok ? (r.json() as Promise<SurfaceRidershipRow[]>) : Promise.resolve([])),
        ),
      ]);
      const ridershipMap = new Map<string, number>(
        (surfaceRaw as SurfaceRidershipRow[]).map((s) => [s.route_id, s.all_day_riders ?? 0]),
      );
      return (routesRaw as BackendRoute[]).map((r) =>
        normalizeRoute(r, ridershipMap.get(r.route_id) ?? 0),
      );
    } catch {
      await wait(60);
      return NETWORK.routes;
    }
  },

  // ── Live: GET /routes/{id} (with shape polyline) ──────────────────────────
  liveRouteDetail: async (routeId: string): Promise<BackendRoute | null> =>
    tryLive(`/routes/${encodeURIComponent(routeId)}`, async () => null),

  // ── Live: GET /stops ───────────────────────────────────────────────────────
  liveStops: async (params?: {
    min_lat?: number; max_lat?: number;
    min_lon?: number; max_lon?: number;
    lat?: number; lon?: number;
    radius_m?: number; limit?: number;
  }): Promise<BackendStop[]> => {
    const qs = new URLSearchParams();
    if (params?.min_lat != null) qs.set("min_lat", String(params.min_lat));
    if (params?.max_lat != null) qs.set("max_lat", String(params.max_lat));
    if (params?.min_lon != null) qs.set("min_lon", String(params.min_lon));
    if (params?.max_lon != null) qs.set("max_lon", String(params.max_lon));
    if (params?.lat != null) qs.set("lat", String(params.lat));
    if (params?.lon != null) qs.set("lon", String(params.lon));
    if (params?.radius_m != null) qs.set("radius_m", String(params.radius_m));
    qs.set("limit", String(params?.limit ?? 500));
    return tryLive(`/stops?${qs}`, async () => []);
  },

  // ── Live: GET /stops/{id} ─────────────────────────────────────────────────
  liveStopDetail: async (stopId: string): Promise<BackendStop | null> =>
    tryLive(`/stops/${encodeURIComponent(stopId)}`, async () => null),

  // ── Live: GET /ridership/annual ────────────────────────────────────────────
  liveAnnualRidership: async (params?: {
    media?: string; rider_type?: string; year?: number;
  }): Promise<AnnualRidershipRow[]> => {
    const qs = new URLSearchParams();
    if (params?.media) qs.set("media", params.media);
    if (params?.rider_type) qs.set("rider_type", params.rider_type);
    if (params?.year) qs.set("year", String(params.year));
    return tryLive(`/ridership/annual${qs.toString() ? "?" + qs : ""}`, async () => []);
  },

  // ── Live: GET /ridership/surface ───────────────────────────────────────────
  liveSurfaceRidership: async (limit = 250): Promise<SurfaceRidershipRow[]> =>
    tryLive(`/ridership/surface?limit=${limit}`, async () => []),

  // ── Live: GET /ridership/bike-share ───────────────────────────────────────
  liveBikeShare: async (group_by: "station" | "day" | "month" | "user_type" = "station", limit = 50): Promise<BikeShareStats> =>
    tryLive(`/ridership/bike-share?group_by=${group_by}&limit=${limit}`, async () => ({
      group_by,
      rows: [],
    })),

  // ── Live: GET /equity-scores ───────────────────────────────────────────────
  liveEquity: async (sort = "lowest", limit = 200): Promise<EquityScore[]> =>
    tryLive(`/equity-scores?sort=${sort}&limit=${limit}`, async () => {
      await wait(80);
      return HOODS.map((h, i) => ({
        geography_id: h.id,
        geography_name: h.name,
        area_type: "neighbourhood",
        score: h.mobilityScore,
        median_income: 35000 + i * 4000,
        stop_density: h.stopDensity,
        distance_to_stop: Math.round(100 + (100 - h.mobilityScore) * 8),
        ridership_per_capita: +(h.stopDensity * 2.4).toFixed(1),
        vulnerable_share: Math.round(100 - h.mobilityScore),
        metrics: { priority_level: h.mobilityScore < 50 ? "High" : h.mobilityScore < 70 ? "Medium" : "Low" },
      }));
    }),

  // ── Live: GET /predict/ridership ──────────────────────────────────────────
  livePredict: async (params: {
    routeId: string; start: string; end: string; weather?: string;
  }): Promise<PredictionResponse> => {
    const qs = new URLSearchParams({
      route_id: params.routeId,
      start_time: params.start,
      end_time: params.end,
    });
    if (params.weather) qs.set("weather", params.weather);
    return tryLive(`/predict/ridership?${qs}`, async () => {
      await wait(100);
      const pts = Array.from({ length: 16 }, (_, i) => {
        const base = 800 + Math.sin((i / 15) * Math.PI) * 1200;
        return {
          timestamp: new Date(Date.now() + i * 3_600_000).toISOString(),
          predicted_riders: Math.round(base),
          lower_bound: Math.round(base * 0.85),
          upper_bound: Math.round(base * 1.15),
        };
      });
      return {
        route_id: params.routeId,
        model: "baseline_surface_ridership",
        model_metrics: {},
        points: pts,
      };
    });
  },

  // ── Live: POST /simulate-disruption ───────────────────────────────────────
  liveSimulate: async (payload: Record<string, unknown>) => {
    const mockFallback = async () => {
      await wait(300);
      const delay = (payload.delay_minutes as number) || 10;
      const affected = (payload.affected_ids as string[]) || [];
      return {
        type: String(payload.type ?? "route_delay"),
        affected_ids: affected,
        affected_trip_count: Math.round(delay * 12 + 80),
        affected_routes: 1,
        affected_stops: Math.round(delay * 3 + 15),
        average_delay_minutes: delay,
        passenger_impact_minutes: Math.round(delay * 42000),
        alternatives: affected.flatMap((id: string) => [
          { origin: "Union", destination: "Bloor-Yonge", baseline_time: 18, new_time: 18 + delay, delay, path: [`${id} → Alt-1 → Bloor-Yonge`], status: "rerouted" },
          { origin: "King", destination: "Spadina", baseline_time: 12, new_time: 12 + Math.round(delay * 0.6), delay: Math.round(delay * 0.6), path: [`${id} → Alt-2 → Spadina`], status: "rerouted" },
        ]),
        impact_summary: { graph_available: false },
        notes: ["Mock fallback — start backend for graph-based simulation."],
      };
    };
    return tryLive("/simulate-disruption", mockFallback, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  },

  // ── Live: GET /health ──────────────────────────────────────────────────────
  liveHealth: () =>
    tryLive("/health", async () => ({ status: "offline" })).catch(() => ({ status: "offline" })),
};

// ─── React Query hooks ────────────────────────────────────────────────────────

// Mock-data hooks (always use local data)
export const useKpis = () => useQuery({ queryKey: ["kpis"], queryFn: mockApi.kpis, refetchInterval: 8000 });
export const useNetwork = () => useQuery({ queryKey: ["network"], queryFn: mockApi.network });
export const useHourly = () => useQuery({ queryKey: ["hourly"], queryFn: mockApi.hourly });
export const useDaily = () => useQuery({ queryKey: ["daily"], queryFn: mockApi.daily });
export const useYearly = () => useQuery({ queryKey: ["yearly"], queryFn: mockApi.yearly });
export const useRouteCompare = () => useQuery({ queryKey: ["routeCompare"], queryFn: mockApi.routeCompare });
export const useHeatmap = () => useQuery({ queryKey: ["heatmap"], queryFn: mockApi.heatmap });
export const useDisruptions = () => useQuery({ queryKey: ["disruptions"], queryFn: mockApi.disruptions });
export const useNotifications = () => useQuery({ queryKey: ["notifications"], queryFn: mockApi.notifications });
export const usePredictions = () => useQuery({ queryKey: ["predictions"], queryFn: mockApi.predictions });
export const useAiCards = () => useQuery({ queryKey: ["aiCards"], queryFn: mockApi.aiCards });
export const useHoods = () => useQuery({ queryKey: ["hoods"], queryFn: mockApi.hoods });
export const useVehicles = () => useQuery({ queryKey: ["vehicles"], queryFn: mockApi.vehicles, refetchInterval: 3000 });
export const useIncidents = () => useQuery({ queryKey: ["incidents"], queryFn: mockApi.incidents, refetchInterval: 10000 });
export const useFleet = () => useQuery({ queryKey: ["fleet"], queryFn: mockApi.fleet });
export const useOdPairs = () => useQuery({ queryKey: ["odPairs"], queryFn: mockApi.odPairs });
export const useSafety = () => useQuery({ queryKey: ["safety"], queryFn: mockApi.safety });
export const useWeather = () => useQuery({ queryKey: ["weather"], queryFn: mockApi.weather });
export const useBudget = () => useQuery({ queryKey: ["budget"], queryFn: mockApi.budget });
export const useBunching = () => useQuery({ queryKey: ["bunching"], queryFn: mockApi.bunching, refetchInterval: 8000 });

// Live-first hooks (try backend, fall back to mock)
export const useLiveRoutes = () =>
  useQuery({ queryKey: ["liveRoutes"], queryFn: mockApi.liveRoutes, staleTime: 60_000 });

export const useLiveRouteDetail = (routeId: string) =>
  useQuery({
    queryKey: ["liveRouteDetail", routeId],
    queryFn: () => mockApi.liveRouteDetail(routeId),
    enabled: !!routeId,
    staleTime: 120_000,
  });

export const useLiveStops = (params?: Parameters<typeof mockApi.liveStops>[0]) =>
  useQuery({
    queryKey: ["liveStops", params],
    queryFn: () => mockApi.liveStops(params),
    staleTime: 120_000,
  });

export const useLiveStopDetail = (stopId: string) =>
  useQuery({
    queryKey: ["liveStopDetail", stopId],
    queryFn: () => mockApi.liveStopDetail(stopId),
    enabled: !!stopId,
    staleTime: 120_000,
  });

export const useAnnualRidership = (params?: Parameters<typeof mockApi.liveAnnualRidership>[0]) =>
  useQuery({
    queryKey: ["annualRidership", params],
    queryFn: () => mockApi.liveAnnualRidership(params),
    staleTime: 300_000,
  });

export const useSurfaceRidership = (limit = 250) =>
  useQuery({
    queryKey: ["surfaceRidership", limit],
    queryFn: () => mockApi.liveSurfaceRidership(limit),
    staleTime: 300_000,
  });

export const useBikeShare = (
  group_by: "station" | "day" | "month" | "user_type" = "station",
  limit = 50,
) =>
  useQuery({
    queryKey: ["bikeShare", group_by, limit],
    queryFn: () => mockApi.liveBikeShare(group_by, limit),
    staleTime: 300_000,
  });

export const useLiveEquity = (sort: "lowest" | "highest" | "name" = "lowest", limit = 200) =>
  useQuery({
    queryKey: ["liveEquity", sort, limit],
    queryFn: () => mockApi.liveEquity(sort, limit),
    staleTime: 120_000,
  });

export const useLivePredict = (params: Parameters<typeof mockApi.livePredict>[0] | null) =>
  useQuery({
    queryKey: ["livePredict", params],
    queryFn: () => mockApi.livePredict(params!),
    enabled: !!params?.routeId,
    staleTime: 300_000,
  });

export const useLiveHealth = () =>
  useQuery({ queryKey: ["liveHealth"], queryFn: mockApi.liveHealth, refetchInterval: 15000 });
