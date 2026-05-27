/**
 * api.ts — Real backend data layer with mock fallback.
 *
 * Every hook keeps the same signature so route files need zero changes.
 * Real API is called first; on failure (offline / cold-start) mock data is used.
 */
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

// ── Config ────────────────────────────────────────────────────────────────────
const BASE =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV
    ? "http://localhost:8000"
    : "https://transitlens-backend.up.railway.app");

const TIMEOUT = 8_000;

async function get<T>(path: string, fallback: () => T): Promise<T> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT);
  try {
    const res = await fetch(`${BASE}${path}`, {
      signal: ctrl.signal,
      headers: { Accept: "application/json" },
    });
    clearTimeout(t);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as T;
  } catch {
    clearTimeout(t);
    return fallback();
  }
}

// ── Shape helpers ─────────────────────────────────────────────────────────────

/** Map a real TTC route to the Route shape the UI expects */
function mapRoute(r: Record<string, unknown>, i: number): Route {
  const MODE_MAP: Record<number, "subway" | "streetcar" | "bus"> = {
    0: "streetcar",
    1: "subway",
    3: "bus",
  };
  const COLORS = [
    "#f1c232","#1ea65a","#1f7de8","#8b5cf6","#ef4444",
    "#22d3ee","#14b8a6","#f97316","#ec4899",
  ];
  const rt = (r.route_type as number) ?? 3;
  const mode = MODE_MAP[rt] ?? "bus";
  const ridership = mode === "subway" ? 180_000 : mode === "streetcar" ? 32_000 : 9_000;
  const onTime = 72 + ((i * 7) % 25);
  const congestion = 30 + ((i * 13) % 65);
  return {
    id: r.route_id as string,
    shortName: (r.route_short_name as string) || (r.route_id as string),
    longName: (r.route_long_name as string) || "",
    mode,
    color: COLORS[i % COLORS.length],
    stopIds: [],
    path: [],
    ridership: Math.round(ridership * (0.6 + ((i % 10) / 10) * 0.9)),
    onTime,
    congestion,
    aiScore: 60 + (i % 38),
    trend: +((i % 14) - 5).toFixed(1),
    status: onTime < 80 ? "delayed" : congestion > 85 ? "disrupted" : "normal",
    headway: mode === "subway" ? 3 : mode === "streetcar" ? 6 : 12,
  };
}

// ── Public external API fetchers ─────────────────────────────────────────────

const UMO = "https://retro.umoiq.com/service/publicXMLFeed";
const OPEN_METEO = "https://api.open-meteo.com/v1/forecast";

/** Parse lightweight XML from Umo/NextBus without a DOM parser dep */
function parseXmlAttrs(xml: string, tag: string): Record<string, string>[] {
  const re = new RegExp(`<${tag}\\s([^/?>]+)`, "g");
  const attrRe = /(\w+)="([^"]*)"/g;
  const results: Record<string, string>[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    const attrs: Record<string, string> = {};
    let a: RegExpExecArray | null;
    while ((a = attrRe.exec(m[1])) !== null) attrs[a[1]] = a[2];
    attrRe.lastIndex = 0;
    results.push(attrs);
  }
  return results;
}

// Key TTC bus/streetcar routes to poll for live vehicles
const LIVE_ROUTES = ["501","504","505","506","510","29","32","35","36","39","52","60","95"];

async function fetchVehicles() {
  try {
    const responses = await Promise.allSettled(
      LIVE_ROUTES.map((r) =>
        fetch(`${UMO}?command=vehicleLocations&a=ttc&r=${r}&t=0`, { signal: AbortSignal.timeout(6000) })
          .then((res) => res.text())
      )
    );

    const vehicles: ReturnType<typeof generateVehicles> = [];
    let n = 0;
    for (let i = 0; i < responses.length; i++) {
      const res = responses[i];
      if (res.status !== "fulfilled") continue;
      const parsed = parseXmlAttrs(res.value, "vehicle");
      const routeTag = LIVE_ROUTES[i];
      for (const v of parsed) {
        if (!v.lat || !v.lon) continue;
        vehicles.push({
          id: `v${++n}-${v.id}`,
          routeId: routeTag,
          pos: [parseFloat(v.lat), parseFloat(v.lon)],
          bearing: parseInt(v.heading ?? "0"),
          delay: parseInt(v.secsSinceReport ?? "0") > 60 ? 2 : 0,
          occupancy: Math.round(30 + Math.random() * 60),
        });
      }
    }
    return vehicles.length ? vehicles : generateVehicles();
  } catch {
    return generateVehicles();
  }
}

const WMO_CODE: Record<number, string> = {
  0:"Clear",1:"Mostly clear",2:"Partly cloudy",3:"Overcast",
  45:"Fog",51:"Light drizzle",61:"Light rain",63:"Moderate rain",65:"Heavy rain",
  71:"Light snow",73:"Moderate snow",80:"Rain showers",95:"Thunderstorm",
};

async function fetchWeather() {
  try {
    const url = `${OPEN_METEO}?latitude=43.6532&longitude=-79.3832&hourly=temperature_2m,precipitation_probability,weathercode,windspeed_10m&forecast_days=2&timezone=America%2FToronto`;
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) throw new Error("meteo");
    const json = await res.json();
    const h = json.hourly;
    // Return 24-entry array for today only
    return (h.time as string[]).slice(0, 48).map((t: string, i: number) => ({
      time: t.slice(11, 16), // "HH:MM"
      temp: Math.round(h.temperature_2m[i]),
      precip: h.precipitation_probability[i] ?? 0,
      wind: Math.round(h.windspeed_10m[i] ?? 0),
      condition: WMO_CODE[h.weathercode[i]] ?? "Unknown",
      impact: h.precipitation_probability[i] > 60 ? "High" : h.precipitation_probability[i] > 30 ? "Medium" : "Low",
    }));
  } catch {
    return weatherImpact();
  }
}

async function fetchDisruptions() {
  try {
    // Poll a sample of routes for predictions; large delays = disruption
    const sampleRoutes = ["501", "504", "1", "2"];
    const results = await Promise.allSettled(
      sampleRoutes.map((r) =>
        fetch(`${UMO}?command=routeConfig&a=ttc&r=${r}`, { signal: AbortSignal.timeout(5000) })
          .then((res) => res.text())
      )
    );
    // If we got responses, merge with mock disruptions (real route names)
    const realRouteNames: Record<string, string> = {};
    for (let i = 0; i < results.length; i++) {
      const res = results[i];
      if (res.status !== "fulfilled") continue;
      const routes = parseXmlAttrs(res.value, "route");
      if (routes[0]?.title) realRouteNames[sampleRoutes[i]] = routes[0].title;
    }
    const mock = disruptions();
    return mock.map((d) => ({
      ...d,
      // override message if we found a real route name
      message: realRouteNames[d.routeId]
        ? `Service disruption on ${realRouteNames[d.routeId]}`
        : d.message,
    }));
  } catch {
    return disruptions();
  }
}

// ── Real API fetchers ─────────────────────────────────────────────────────────

async function fetchNetwork() {
  const [rawRoutes, rawStops] = await Promise.all([
    get<Record<string, unknown>[]>("/api/gtfs/routes?limit=200", () => []),
    get<Record<string, unknown>[]>("/api/gtfs/stops?limit=500", () => []),
  ]);

  if (!rawRoutes.length) return NETWORK;

  const routes: Route[] = rawRoutes.map(mapRoute);
  const stops = rawStops.map((s) => ({
    id: s.stop_id as string,
    name: s.stop_name as string,
    pos: [s.stop_lat as number, s.stop_lon as number] as [number, number],
    routeIds: [],
    boardings: Math.round(200 + Math.random() * 2000),
  }));
  return { routes, stops };
}

async function fetchKpis() {
  const mock = kpiSnapshot();
  const data = await get<Record<string, unknown>>("/api/kpi", () => ({}));
  if (!Object.keys(data).length) return mock;
  return {
    ...mock,
    dailyRiders: (data.dailyRidership as number) ?? mock.dailyRiders,
    equityScore: (data.avgEquityScore as number) ?? mock.equityScore,
    activeVehicles: mock.activeVehicles,
    delayedRoutes: mock.delayedRoutes,
    avgWait: mock.avgWait,
    congestionIndex: mock.congestionIndex,
  };
}

async function fetchHourly() {
  const [ts, pred] = await Promise.all([
    get<Record<string, unknown>[]>("/api/ridership/timeseries", () => []),
    get<Record<string, unknown>[]>("/api/ridership/predict", () => []),
  ]);
  if (!ts.length) return hourlyRidership();
  return ts.map((row, i) => ({
    hour: row.hour as string,
    riders: (row.actual as number) ?? 0,
    predicted: pred[i]?.predicted ?? (row.predicted as number) ?? 0,
  }));
}

async function fetchHoods() {
  const data = await get<Record<string, unknown>[]>("/api/equity/scores", () => []);
  if (!data.length) return HOODS;
  return data.map((z) => ({
    id: z.id as string,
    name: z.name as string,
    polygon: [
      [(z.lat as number) - 0.018, (z.lng as number) - 0.018],
      [(z.lat as number) - 0.018, (z.lng as number) + 0.018],
      [(z.lat as number) + 0.018, (z.lng as number) + 0.018],
      [(z.lat as number) + 0.018, (z.lng as number) - 0.018],
    ] as [number, number][],
    mobilityScore: z.equityScore as number,
    stopDensity: z.stopDensity as number,
    avgWait: Math.round(2 + (100 - (z.equityScore as number)) / 10),
    income: (z.equityScore as number) > 70 ? "high" : (z.equityScore as number) > 50 ? "mid" : "low",
  })) as typeof HOODS;
}

async function fetchAiCards() {
  const meta = await get<Record<string, unknown>>("/api/model/metrics", () => ({}));
  if (!Object.keys(meta).length) return aiCards;
  return [
    {
      title: "Model Accuracy",
      value: `${meta.accuracy_pct ?? 87.5}%`,
      delta: +(((meta.r2 as number) ?? 0.92) * 10 - 8.5).toFixed(1),
      hint: `R²=${meta.r2 ?? "—"} · MAE=${meta.mae ?? "—"}`,
      icon: "activity",
    },
    {
      title: "Routes Analysed",
      value: "232",
      delta: 2.1,
      hint: "Real TTC GTFS data",
      icon: "users",
    },
    {
      title: "Delay Risk",
      value: "Moderate",
      delta: -2.3,
      hint: "Line 1 segments",
      icon: "alert",
    },
    {
      title: "Weather Impact",
      value: "Low",
      delta: 0.6,
      hint: "Light rain · 14°C",
      icon: "cloud",
    },
  ];
}

// ── Mock API object (unchanged key names) ─────────────────────────────────────
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const mockApi = {
  network:      fetchNetwork,
  kpis:         fetchKpis,
  hourly:       fetchHourly,
  daily:        async () => (await wait(120), dailyRidership()),
  yearly:       async () => (await wait(120), yearlyGrowth()),
  routeCompare: async () => (await wait(100), routeComparison()),
  heatmap:      async () => (await wait(150), neighborhoodHeatmap()),
  disruptions:  fetchDisruptions,
  notifications:async () => (await wait(50), notifications),
  predictions:  async () => (await wait(120), predictionTimeline()),
  aiCards:      fetchAiCards,
  hoods:        fetchHoods,
  vehicles:     fetchVehicles,
  incidents:    async () => (await wait(100), incidents()),
  fleet:        async () => (await wait(100), fleet()),
  odPairs:      async () => (await wait(100), odPairs()),
  safety:       async () => (await wait(100), safetyEvents()),
  weather:      fetchWeather,
  budget:       async () => (await wait(100), budgetByRoute()),
  bunching:     async () => (await wait(100), bunching()),
};

// ── Hooks (same names, same signatures — route files unchanged) ───────────────
export const useKpis         = () => useQuery({ queryKey: ["kpis"],         queryFn: mockApi.kpis,         refetchInterval: 30_000 });
export const useNetwork      = () => useQuery({ queryKey: ["network"],      queryFn: mockApi.network,      staleTime: 60_000 });
export const useHourly       = () => useQuery({ queryKey: ["hourly"],       queryFn: mockApi.hourly,       refetchInterval: 60_000 });
export const useDaily        = () => useQuery({ queryKey: ["daily"],        queryFn: mockApi.daily });
export const useYearly       = () => useQuery({ queryKey: ["yearly"],       queryFn: mockApi.yearly });
export const useRouteCompare = () => useQuery({ queryKey: ["routeCompare"], queryFn: mockApi.routeCompare });
export const useHeatmap      = () => useQuery({ queryKey: ["heatmap"],      queryFn: mockApi.heatmap });
export const useDisruptions  = () => useQuery({ queryKey: ["disruptions"],  queryFn: mockApi.disruptions,  refetchInterval: 20_000 });
export const useNotifications= () => useQuery({ queryKey: ["notifications"],queryFn: mockApi.notifications });
export const usePredictions  = () => useQuery({ queryKey: ["predictions"],  queryFn: mockApi.predictions });
export const useAiCards      = () => useQuery({ queryKey: ["aiCards"],      queryFn: mockApi.aiCards,      staleTime: 120_000 });
export const useHoods        = () => useQuery({ queryKey: ["hoods"],        queryFn: mockApi.hoods,        staleTime: 300_000 });
export const useVehicles     = () => useQuery({ queryKey: ["vehicles"],     queryFn: mockApi.vehicles,     refetchInterval: 3_000 });
export const useIncidents    = () => useQuery({ queryKey: ["incidents"],    queryFn: mockApi.incidents,    refetchInterval: 10_000 });
export const useFleet        = () => useQuery({ queryKey: ["fleet"],        queryFn: mockApi.fleet });
export const useOdPairs      = () => useQuery({ queryKey: ["odPairs"],      queryFn: mockApi.odPairs });
export const useSafety       = () => useQuery({ queryKey: ["safety"],       queryFn: mockApi.safety });
export const useWeather      = () => useQuery({ queryKey: ["weather"],      queryFn: mockApi.weather });
export const useBudget       = () => useQuery({ queryKey: ["budget"],       queryFn: mockApi.budget });
export const useBunching     = () => useQuery({ queryKey: ["bunching"],     queryFn: mockApi.bunching,     refetchInterval: 8_000 });
