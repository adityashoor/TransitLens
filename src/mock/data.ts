import { seeded } from "@/lib/format";
import { NETWORK, type Route, type LatLng } from "./routes";

const rng = seeded(7);

// 24h ridership curve
export function hourlyRidership(): { hour: string; riders: number; predicted: number }[] {
  const peaks = [8, 17];
  return Array.from({ length: 24 }, (_, h) => {
    const peak = peaks.reduce((acc, p) => acc + Math.exp(-Math.pow(h - p, 2) / 6), 0);
    const base = 18000 + peak * 60000;
    const noise = (rng() - 0.5) * 6000;
    const riders = Math.max(2000, Math.round(base + noise));
    const predicted = Math.round(riders * (1 + (rng() - 0.5) * 0.08));
    return { hour: `${String(h).padStart(2, "0")}:00`, riders, predicted };
  });
}

export function dailyRidership(days = 14) {
  const out: { date: string; riders: number }[] = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const weekend = d.getDay() === 0 || d.getDay() === 6;
    out.push({
      date: d.toLocaleDateString("en-CA", { month: "short", day: "numeric" }),
      riders: Math.round((weekend ? 1.4 : 2.2) * 1_000_000 + (rng() - 0.5) * 250_000),
    });
  }
  return out;
}

export function yearlyGrowth() {
  return Array.from({ length: 12 }, (_, i) => ({
    month: ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][i],
    "2024": Math.round(40 + i * 1.2 + rng() * 4),
    "2025": Math.round(48 + i * 1.6 + rng() * 5),
  }));
}

export function routeComparison() {
  return NETWORK.routes.slice(0, 6).map((r) => ({
    name: r.shortName,
    riders: Math.round(r.ridership / 1000),
    onTime: r.onTime,
    congestion: r.congestion,
  }));
}

export function neighborhoodHeatmap() {
  const hoods = [
    "Downtown","North York","Scarborough","Etobicoke","East York",
    "Don Valley","Riverdale","Junction","Annex","Liberty Village","Leslieville","Parkdale",
  ];
  return hoods.map((name) => ({
    name,
    hours: Array.from({ length: 24 }, () => Math.round(rng() * 100)),
  }));
}

export interface Disruption {
  id: string;
  routeId: string;
  type: "delay" | "closure" | "diversion" | "incident";
  severity: "low" | "medium" | "high";
  message: string;
  startedAt: string;
  affectedRiders: number;
}

export function disruptions(): Disruption[] {
  const types = ["delay", "closure", "diversion", "incident"] as const;
  const messages = [
    "Signal issue at midpoint",
    "Vehicle held due to police investigation",
    "Track maintenance — single track operation",
    "Diversion via parallel route",
    "Mechanical issue — replacement vehicle inbound",
  ];
  return NETWORK.routes
    .filter((r) => r.status !== "normal")
    .slice(0, 6)
    .map((r, i) => ({
      id: `d${i}`,
      routeId: r.id,
      type: types[i % types.length],
      severity: r.congestion > 85 ? "high" : r.onTime < 80 ? "medium" : "low",
      message: messages[i % messages.length],
      startedAt: `${5 + i * 7}m ago`,
      affectedRiders: Math.round(r.ridership * 0.04 + i * 1200),
    }));
}

export interface Notification {
  id: string;
  title: string;
  body: string;
  type: "info" | "warn" | "alert" | "ai";
  time: string;
  href?: string; // in-app route to navigate to when clicked
}
export const notifications: Notification[] = [
  { id: "n1", title: "AI Forecast",    body: "Line 1 ridership +14% vs typical Saturday.",   type: "ai",    time: "2m",  href: "/predictions" },
  { id: "n2", title: "Disruption",     body: "504 King held at Yonge — 8 min delay.",        type: "alert", time: "6m",  href: "/incidents"   },
  { id: "n3", title: "Equity Alert",   body: "Mobility score dropped in Mount Dennis.",       type: "warn",  time: "22m", href: "/equity"      },
  { id: "n4", title: "Network",        body: "All subway lines resumed normal service.",      type: "info",  time: "1h",  href: "/map"         },
];

// AI predictions
export function predictionTimeline() {
  return Array.from({ length: 24 }, (_, h) => {
    const peak = Math.exp(-Math.pow(h - 17, 2) / 8) + 0.6 * Math.exp(-Math.pow(h - 8, 2) / 6);
    const v = 30 + peak * 60 + (rng() - 0.5) * 6;
    return {
      t: `+${h}h`,
      forecast: +v.toFixed(1),
      lower: +(v - 6 - rng() * 4).toFixed(1),
      upper: +(v + 6 + rng() * 4).toFixed(1),
    };
  });
}

export const aiCards = [
  { title: "Predicted Peak Ridership", value: "1.2M", delta: 8.4, hint: "Tomorrow · 5:30 PM", icon: "users" },
  { title: "Congestion Forecast", value: "73 / 100", delta: 4.1, hint: "Next 3 hours", icon: "activity" },
  { title: "Delay Risk", value: "Moderate", delta: -2.3, hint: "Line 1 segments", icon: "alert" },
  { title: "Weather Impact", value: "Low", delta: 0.6, hint: "Light rain · 14°C", icon: "cloud" },
];

// Equity (mock neighborhoods as polygons around TO)
export interface Hood {
  id: string;
  name: string;
  polygon: LatLng[];
  mobilityScore: number; // 0-100
  stopDensity: number;
  avgWait: number;
  income: "low" | "mid" | "high";
}

function squarePoly(center: LatLng, r: number): LatLng[] {
  return [
    [center[0] - r, center[1] - r],
    [center[0] - r, center[1] + r],
    [center[0] + r, center[1] + r],
    [center[0] + r, center[1] - r],
  ];
}

export const HOODS: Hood[] = (() => {
  const names = [
    "Downtown","Annex","Liberty Village","Parkdale","Junction","Leslieville",
    "Riverdale","East York","North York","Don Mills","Scarborough Centre",
    "Malvern","Mount Dennis","Weston","Etobicoke North","Long Branch",
    "Mimico","High Park","Forest Hill","Lawrence Park","Don Valley","Beaches",
    "Cliffside","Rouge","Agincourt",
  ];
  const r2 = seeded(99);
  return names.map((n, i) => {
    const cx = 43.65 + ((i % 5) - 2) * 0.04 + (r2() - 0.5) * 0.01;
    const cy = -79.4 + (Math.floor(i / 5) - 2) * 0.06 + (r2() - 0.5) * 0.02;
    const score = Math.round(35 + r2() * 60);
    return {
      id: `h${i}`,
      name: n,
      polygon: squarePoly([cx, cy], 0.018),
      mobilityScore: score,
      stopDensity: Math.round(r2() * 30 + 5),
      avgWait: +(2 + r2() * 14).toFixed(1),
      income: score > 70 ? "high" : score > 50 ? "mid" : "low",
    };
  });
})();

// Vehicles for live map (interpolated along route paths)
export interface Vehicle {
  id: string;
  routeId: string;
  pos: LatLng;
  bearing: number;
  delay: number;
  occupancy: number;
}

export function generateVehicles(): Vehicle[] {
  const out: Vehicle[] = [];
  let n = 0;
  NETWORK.routes.forEach((r) => {
    const count = r.mode === "subway" ? 8 : r.mode === "streetcar" ? 5 : 3;
    for (let i = 0; i < count; i++) {
      const t = (i / count + rng() * 0.05) % 1;
      const idx = Math.floor(t * (r.path.length - 1));
      const next = Math.min(idx + 1, r.path.length - 1);
      const f = t * (r.path.length - 1) - idx;
      const a = r.path[idx];
      const b = r.path[next];
      out.push({
        id: `v${++n}`,
        routeId: r.id,
        pos: [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f],
        bearing: Math.atan2(b[1] - a[1], b[0] - a[0]) * (180 / Math.PI),
        delay: Math.round((rng() - 0.6) * 8),
        occupancy: Math.round(rng() * 100),
      });
    }
  });
  return out;
}

// Top KPI snapshot
export const kpiSnapshot = () => ({
  dailyRiders: 2_730_000 + Math.round((rng() - 0.5) * 80_000),
  activeVehicles: 1842,
  delayedRoutes: NETWORK.routes.filter((r) => r.status !== "normal").length,
  avgWait: 4.2,
  equityScore: 71,
  congestionIndex: 64,
});

export type { Route };
export { NETWORK };

// ===================== Incidents =====================
export interface Incident {
  id: string;
  routeId: string;
  category: "mechanical" | "medical" | "police" | "weather" | "signal" | "collision";
  severity: "low" | "medium" | "high" | "critical";
  title: string;
  detail: string;
  startedAt: string; // ISO
  resolvedAt?: string;
  location: string;
  responders: number;
  affectedRiders: number;
  status: "active" | "monitoring" | "resolved";
}

export function incidents(): Incident[] {
  const cats = ["mechanical","medical","police","weather","signal","collision"] as const;
  const sevs = ["low","medium","high","critical"] as const;
  const locs = ["Bloor & Yonge","Union Station","King & Bathurst","Finch Stn","Spadina & College","Kennedy Stn","Pape & Danforth","Queen & Sherbourne"];
  const titles: Record<typeof cats[number], string> = {
    mechanical: "Vehicle held — mechanical fault",
    medical: "Medical emergency on board",
    police: "Police investigation at platform",
    weather: "Severe weather slow-order",
    signal: "Signal system fault",
    collision: "Vehicle collision blocking lane",
  };
  const now = Date.now();
  return Array.from({ length: 14 }, (_, i) => {
    const c = cats[Math.floor(rng() * cats.length)];
    const sev = sevs[Math.floor(rng() * sevs.length)];
    const r = NETWORK.routes[Math.floor(rng() * NETWORK.routes.length)];
    const startedAt = new Date(now - rng() * 1000 * 60 * 60 * 6).toISOString();
    const resolved = rng() > 0.55;
    return {
      id: `INC-${1000 + i}`,
      routeId: r.id,
      category: c,
      severity: sev,
      title: titles[c],
      detail: "AI clustered with 3 similar events in past 30d. Suggested action: dispatch supervisor.",
      startedAt,
      resolvedAt: resolved ? new Date(now - rng() * 1000 * 60 * 30).toISOString() : undefined,
      location: locs[Math.floor(rng() * locs.length)],
      responders: Math.ceil(rng() * 4),
      affectedRiders: Math.round(200 + rng() * 4500),
      status: resolved ? "resolved" : rng() > 0.5 ? "active" : "monitoring",
    };
  });
}

// ===================== Fleet =====================
export interface FleetVehicle {
  id: string;
  type: "Bus" | "Streetcar" | "Subway" | "eBus";
  routeId: string;
  mileage: number;
  battery?: number;
  fuel?: number;
  health: number; // 0-100
  accessible: boolean;
  lowFloor: boolean;
  lastService: string;
  nextService: string;
  status: "in-service" | "charging" | "maintenance" | "depot";
}
export function fleet(): FleetVehicle[] {
  const types = ["Bus","Streetcar","Subway","eBus"] as const;
  return Array.from({ length: 64 }, (_, i) => {
    const t = types[i % types.length];
    const r = NETWORK.routes[Math.floor(rng() * NETWORK.routes.length)];
    const isElectric = t === "eBus" || t === "Streetcar" || t === "Subway";
    return {
      id: `${t.slice(0,2).toUpperCase()}-${4000 + i}`,
      type: t,
      routeId: r.id,
      mileage: Math.round(80_000 + rng() * 420_000),
      battery: isElectric ? Math.round(20 + rng() * 80) : undefined,
      fuel: !isElectric ? Math.round(10 + rng() * 90) : undefined,
      health: Math.round(55 + rng() * 45),
      accessible: rng() > 0.05,
      lowFloor: rng() > 0.1,
      lastService: `${Math.ceil(rng() * 30)}d ago`,
      nextService: `${Math.ceil(rng() * 60)}d`,
      status: ["in-service","in-service","in-service","charging","maintenance","depot"][Math.floor(rng()*6)] as FleetVehicle["status"],
    };
  });
}

// ===================== Demand (OD) =====================
export function odPairs() {
  const hubs = ["Union","Bloor-Yonge","St George","Sheppard-Yonge","Kennedy","Kipling","Finch","Spadina","Dundas West","Pape","Eglinton","Don Mills"];
  return hubs.flatMap((from) =>
    hubs.filter((h) => h !== from).slice(0, 5).map((to) => ({
      from, to, riders: Math.round(800 + rng() * 9000), shift: Math.round((rng() - 0.5) * 22),
    })),
  );
}

// ===================== Safety / Vision Zero =====================
export function safetyEvents() {
  return Array.from({ length: 22 }, (_, i) => ({
    id: `SAF-${i}`,
    type: (["near-miss","collision","pedestrian","cyclist"] as const)[Math.floor(rng() * 4)],
    severity: (["minor","major","critical"] as const)[Math.floor(rng() * 3)],
    location: ["Spadina","King","Queen","Bloor","Yonge","Lakeshore","Eglinton"][Math.floor(rng() * 7)],
    routeId: NETWORK.routes[Math.floor(rng() * NETWORK.routes.length)].id,
    daysAgo: Math.floor(rng() * 30),
  }));
}

// ===================== Weather × ridership =====================
export function weatherImpact() {
  const conds = ["Clear","Cloudy","Rain","Snow","Storm"] as const;
  return Array.from({ length: 14 }, (_, i) => {
    const c = conds[Math.floor(rng() * conds.length)];
    const base = 2_400_000;
    const mult = c === "Snow" ? 0.74 : c === "Storm" ? 0.62 : c === "Rain" ? 0.88 : c === "Cloudy" ? 0.97 : 1.05;
    return {
      day: `D-${14 - i}`,
      condition: c,
      temp: Math.round(-8 + rng() * 30),
      precip: c === "Rain" || c === "Snow" || c === "Storm" ? Math.round(rng() * 40) : 0,
      ridership: Math.round(base * mult + (rng() - 0.5) * 100_000),
    };
  });
}

// ===================== Budget / cost-per-rider =====================
export function budgetByRoute() {
  return NETWORK.routes.slice(0, 12).map((r) => {
    const cost = 0.8 + rng() * 4.4;
    const subsidy = cost - (1.2 + rng() * 1.6);
    return {
      id: r.id,
      name: r.shortName,
      longName: r.longName,
      costPerRider: +cost.toFixed(2),
      subsidy: +subsidy.toFixed(2),
      ridership: r.ridership,
      equityIncome: Math.round(38000 + rng() * 80_000),
    };
  });
}

// ===================== Bunching detector =====================
export function bunching() {
  return NETWORK.routes.slice(0, 8).map((r) => ({
    id: r.id,
    name: r.shortName,
    headway: +(rng() * 12).toFixed(1),
    target: 6,
    bunched: rng() > 0.6,
  }));
}
