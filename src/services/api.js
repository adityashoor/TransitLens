// Optional legacy backend client. Current route pages use `src/mock/api.ts`,
// which is the active hybrid adapter for Supabase, public APIs, and fallbacks.
const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

async function request(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (options.body && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }
  const response = await fetch(`${API_BASE}${path}`, {
    headers,
    ...options,
  });
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed: ${response.status}`);
  }
  return response.json();
}

export const api = {
  baseUrl: API_BASE,
  health: () => request("/health/details").catch(() => request("/health")),
  routes: () => request("/routes"),
  route: (routeId) => request(`/routes/${encodeURIComponent(routeId)}`),
  stopsNear: ({ lat = 43.6532, lon = -79.3832, radius = 800, limit = 60 } = {}) =>
    request(`/stops?lat=${lat}&lon=${lon}&radius_m=${radius}&limit=${limit}`),
  annualRidership: (year = 2019) => request(`/ridership/annual?year=${year}`),
  surfaceRidership: (limit = 12) => request(`/ridership/surface?limit=${limit}`),
  bikeShare: (groupBy = "month", limit = 8) =>
    request(`/ridership/bike-share?group_by=${groupBy}&limit=${limit}`),
  prediction: ({ routeId = "504", start, end, weather = "" }) => {
    const params = new URLSearchParams({
      route_id: routeId,
      start_time: start,
      end_time: end,
    });
    if (weather) params.set("weather", weather);
    return request(`/predict/ridership?${params}`);
  },
  equity: (sort = "lowest", limit = 20) => request(`/equity-scores?sort=${sort}&limit=${limit}`),
  simulate: (payload) =>
    request("/simulate-disruption", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
};

export function formatNumber(value, fallback = "-") {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return fallback;
  return Number(value).toLocaleString();
}

export function compactNumber(value) {
  if (value === null || value === undefined) return "-";
  return Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}
