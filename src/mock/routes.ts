import { seeded } from "../lib/format";

export type LatLng = [number, number];
export type TransitMode = "subway" | "streetcar" | "bus";

export interface Stop {
  id: string;
  name: string;
  pos: LatLng;
  routeIds: string[];
  boardings: number;
}

export interface Route {
  id: string;
  shortName: string;
  longName: string;
  mode: TransitMode;
  color: string;
  stopIds: string[];
  path: LatLng[];
  ridership: number; // daily
  onTime: number; // %
  congestion: number; // 0-100
  aiScore: number; // 0-100
  trend: number; // % vs last week
  status: "normal" | "delayed" | "disrupted";
  headway: number; // min
}

// Toronto downtown anchored
const TO: LatLng = [43.6532, -79.3832];

function path(rng: () => number, n: number, jitter = 0.04, base?: LatLng): LatLng[] {
  const start: LatLng = base ?? [TO[0] + (rng() - 0.5) * 0.08, TO[1] + (rng() - 0.5) * 0.1];
  const dirLat = (rng() - 0.5) * 0.005;
  const dirLng = (rng() - 0.5) * 0.008;
  const pts: LatLng[] = [start];
  for (let i = 1; i < n; i++) {
    const prev = pts[i - 1];
    pts.push([
      prev[0] + dirLat + (rng() - 0.5) * jitter * 0.05,
      prev[1] + dirLng + (rng() - 0.5) * jitter * 0.05,
    ]);
  }
  return pts;
}

const COLORS = {
  yellow: "#f1c232",
  green: "#1ea65a",
  blue: "#1f7de8",
  purple: "#8b5cf6",
  red: "#ef4444",
  cyan: "#22d3ee",
  teal: "#14b8a6",
  orange: "#f97316",
  pink: "#ec4899",
};

const SUBWAY: Array<Partial<Route> & Pick<Route, "shortName" | "longName" | "color">> = [
  { shortName: "1", longName: "Yonge–University", color: COLORS.yellow },
  { shortName: "2", longName: "Bloor–Danforth", color: COLORS.green },
  { shortName: "4", longName: "Sheppard", color: COLORS.purple },
];

const STREETCAR_NAMES = ["501 Queen", "504 King", "505 Dundas", "506 Carlton", "510 Spadina", "511 Bathurst"];
const BUS_NAMES = [
  "29 Dufferin", "32 Eglinton W", "35 Jane", "36 Finch W", "39 Finch E",
  "44 Kipling S", "52 Lawrence W", "60 Steeles W", "84 Sheppard W",
  "95 York Mills", "116 Morningside",
];

export function generateNetwork() {
  const rng = seeded(42);
  const routes: Route[] = [];
  const stops: Stop[] = [];
  let stopCounter = 0;

  const addRoute = (
    base: Partial<Route> & Pick<Route, "shortName" | "longName" | "color">,
    mode: TransitMode,
    stopCount: number,
    anchor?: LatLng,
  ) => {
    const id = `${mode}-${base.shortName}`;
    const pts = path(rng, stopCount, mode === "subway" ? 0.02 : 0.06, anchor);
    const stopIds: string[] = [];
    pts.forEach((p, i) => {
      const sid = `s${++stopCounter}`;
      stopIds.push(sid);
      stops.push({
        id: sid,
        name: `${base.shortName} · Stop ${i + 1}`,
        pos: p,
        routeIds: [id],
        boardings: Math.round(200 + rng() * (mode === "subway" ? 9000 : mode === "streetcar" ? 2200 : 800)),
      });
    });
    const ridership = Math.round(
      (mode === "subway" ? 180000 : mode === "streetcar" ? 32000 : 9000) * (0.6 + rng() * 0.9),
    );
    const congestion = Math.round(30 + rng() * 65);
    const onTime = Math.round(72 + rng() * 25);
    const status: Route["status"] = onTime < 80 ? "delayed" : congestion > 85 ? "disrupted" : "normal";
    routes.push({
      id,
      shortName: base.shortName,
      longName: base.longName,
      mode,
      color: base.color,
      stopIds,
      path: pts,
      ridership,
      onTime,
      congestion,
      aiScore: Math.round(60 + rng() * 38),
      trend: +(rng() * 14 - 5).toFixed(1),
      status,
      headway: mode === "subway" ? 3 : mode === "streetcar" ? 6 : 12,
    });
  };

  SUBWAY.forEach((s, i) => addRoute(s, "subway", 16 + i, [TO[0] + i * 0.01, TO[1] - i * 0.02]));
  STREETCAR_NAMES.forEach((n, i) => {
    const [num, ...rest] = n.split(" ");
    addRoute({ shortName: num, longName: rest.join(" "), color: Object.values(COLORS)[i % 9] }, "streetcar", 14);
  });
  BUS_NAMES.forEach((n, i) => {
    const [num, ...rest] = n.split(" ");
    addRoute({ shortName: num, longName: rest.join(" "), color: Object.values(COLORS)[(i + 3) % 9] }, "bus", 12);
  });

  return { routes, stops };
}

export const NETWORK = generateNetwork();
