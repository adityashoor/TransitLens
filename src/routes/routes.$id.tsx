import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, Train, TramFront, Bus } from "lucide-react";
import { useLiveRoutes, useLiveRouteDetail, useLivePredict } from "../mock/api";
import { ChartCard, StatusPill } from "../components/ui-ext/ChartCard";
import { MapBox } from "../components/map/MapBox";
import { fmtCompact } from "../lib/format";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip as RTooltip, CartesianGrid,
} from "recharts";

export const Route = createFileRoute("/routes/$id")({
  component: RouteDetail,
  notFoundComponent: () => (
    <div className="p-10 text-center">
      <p className="text-sm text-muted-foreground">Route not found.</p>
      <Link to="/routes" className="text-primary text-sm">Back to explorer</Link>
    </div>
  ),
});

function RouteDetail() {
  const { id } = Route.useParams();
  const { data: routes = [], isLoading: routesLoading } = useLiveRoutes();
  const { data: detail } = useLiveRouteDetail(id);

  const r = routes.find((x) => x.id === id);
  if (!routesLoading && routes.length > 0 && !r) throw notFound();
  if (!r) return <div className="p-10 text-sm text-muted-foreground">Loading…</div>;

  // Use real shape from backend detail if available
  const shape: [number, number][] = detail?.shape && detail.shape.length > 0
    ? detail.shape
    : (r.path as [number, number][]);

  // Build prediction params: today 06:00 → tomorrow 06:00
  const start = new Date(); start.setHours(6, 0, 0, 0);
  const end = new Date(start); end.setDate(end.getDate() + 1);
  const { data: prediction } = useLivePredict({
    routeId: id,
    start: start.toISOString(),
    end: end.toISOString(),
  });

  // Demand chart data — from backend prediction or fallback hourly curve
  const demandData = prediction?.points.map((p) => ({
    hour: new Date(p.timestamp).getHours() + ":00",
    riders: Math.round(p.predicted_riders),
    lower: Math.round(p.lower_bound),
    upper: Math.round(p.upper_bound),
  })) ?? [];

  const ModeIcon = r.mode === "subway" ? Train : r.mode === "streetcar" ? TramFront : Bus;

  return (
    <div className="px-4 md:px-6 py-6 max-w-[1600px] mx-auto">
      <Link to="/routes" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-3">
        <ArrowLeft className="size-3" /> Back to routes
      </Link>

      <div className="glass-card rounded-2xl p-5 mb-4 flex flex-wrap items-center gap-4">
        <span
          className="size-14 rounded-2xl text-xl font-bold flex items-center justify-center text-primary-foreground shrink-0"
          style={{ background: r.color }}
        >
          {r.shortName}
        </span>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight truncate">{r.longName}</h1>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
            <ModeIcon className="size-4" />
            <span className="capitalize">{r.mode}</span>
            <span>·</span>
            {r.stopIds.length > 0 ? `${r.stopIds.length} stops · ` : ""}headway {r.headway}m
          </div>
        </div>
        <div className="flex items-center gap-3">
          {prediction && (
            <div className="text-xs text-muted-foreground">
              Model: <span className="text-foreground font-medium">{prediction.model}</span>
            </div>
          )}
          <StatusPill status={r.status} />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        {[
          ["Daily riders", fmtCompact(r.ridership)],
          ["On time", `${r.onTime}%`],
          ["Congestion", `${r.congestion}/100`],
          ["AI score", `${r.aiScore}`],
        ].map(([k, v]) => (
          <div key={k} className="glass-card rounded-2xl p-4">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{k}</div>
            <div className="text-xl font-semibold mt-1">{v}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <ChartCard title="Route map" subtitle="Path & stops" className="lg:col-span-2 h-[420px]">
          <MapBox
            highlightRouteId={r.id}
            showVehicles
            overridePath={shape.length > 0 ? shape : undefined}
          />
        </ChartCard>

        <ChartCard
          title="Demand forecast"
          subtitle={prediction ? `${prediction.model} · next 24h` : "Hourly ridership"}
          className="h-[420px]"
        >
          {demandData.length > 0 ? (
            <ResponsiveContainer>
              <AreaChart data={demandData}>
                <defs>
                  <linearGradient id="dc" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={r.color} stopOpacity={0.6} />
                    <stop offset="100%" stopColor={r.color} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="dc-band" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={r.color} stopOpacity={0.15} />
                    <stop offset="100%" stopColor={r.color} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="hour" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => fmtCompact(v as number)} />
                <RTooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12 }} />
                <Area dataKey="upper" stroke="none" fill="url(#dc-band)" />
                <Area dataKey="lower" stroke="none" fill="var(--background)" />
                <Area dataKey="riders" stroke={r.color} fill="url(#dc)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="size-full grid place-items-center text-xs text-muted-foreground">
              Loading forecast…
            </div>
          )}
        </ChartCard>
      </div>

      {/* Prediction model metrics */}
      {prediction?.model_metrics && Object.keys(prediction.model_metrics).length > 0 && (
        <ChartCard title="Prediction model metrics" subtitle={prediction.model} className="mb-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {Object.entries(prediction.model_metrics).map(([k, v]) => (
              <div key={k} className="rounded-xl border border-border bg-surface/40 p-3">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{k.toUpperCase()}</div>
                <div className="text-lg font-semibold mt-1">{typeof v === "number" ? v.toFixed(3) : String(v)}</div>
              </div>
            ))}
          </div>
        </ChartCard>
      )}

      {/* Stop sequence (from GTFS stops if available, else show shape point count) */}
      {r.stopIds.length > 0 ? (
        <ChartCard title="Stop sequence" subtitle={`${r.stopIds.length} stops along the corridor`}>
          <div className="relative pl-4">
            <div className="absolute left-[7px] top-2 bottom-2 w-px" style={{ background: r.color, opacity: 0.5 }} />
            <ul className="space-y-2">
              {r.stopIds.map((sid, i) => {
                const boardings = Math.round(300 + Math.abs(Math.sin(i * 0.7)) * 4000);
                return (
                  <li key={sid} className="flex items-center gap-3">
                    <span className="size-3 rounded-full border-2 bg-background relative -ml-[5px] shrink-0" style={{ borderColor: r.color }} />
                    <span className="text-sm flex-1">{r.shortName} · Stop {i + 1}</span>
                    <span className="text-xs text-muted-foreground">{fmtCompact(boardings)} boardings</span>
                    <div className="w-24 h-1.5 rounded-full bg-surface-2 overflow-hidden">
                      <div className="h-full" style={{ width: `${(boardings / 4500) * 100}%`, background: r.color }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </ChartCard>
      ) : shape.length > 0 ? (
        <ChartCard title="Route shape" subtitle="GTFS polyline from backend">
          <div className="text-sm text-muted-foreground">
            {shape.length} shape points loaded from backend · displayed on map above.
          </div>
        </ChartCard>
      ) : null}
    </div>
  );
}
