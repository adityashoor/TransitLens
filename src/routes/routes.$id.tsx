import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, Train, TramFront, Bus } from "lucide-react";
import { useNetwork, useHourly } from "@/mock/api";
import { ChartCard, StatusPill } from "@/components/ui-ext/ChartCard";
import { MapBox } from "@/components/map/MapBox";
import { fmtCompact } from "@/lib/format";
import {
  ResponsiveContainer, AreaChart, Area, LineChart, Line, XAxis, YAxis, Tooltip as RTooltip, CartesianGrid,
} from "recharts";

export const Route = createFileRoute("/routes/$id")({
  head: ({ params }) => ({
    meta: [
      { title: `Route ${params.id} — TransitLens` },
      { name: "description", content: `Detailed analytics for route ${params.id}: ridership, demand curve, stop sequence.` },
    ],
  }),
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
  const { data: net } = useNetwork();
  const { data: hourly = [] } = useHourly();
  const r = net?.routes.find((x) => x.id === id);
  if (net && !r) throw notFound();
  if (!r) return <div className="p-10 text-sm text-muted-foreground">Loading…</div>;

  const ModeIcon = r.mode === "subway" ? Train : r.mode === "streetcar" ? TramFront : Bus;

  return (
    <div className="px-4 md:px-6 py-6 max-w-[1600px] mx-auto">
      <Link to="/routes" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-3">
        <ArrowLeft className="size-3" /> Back to routes
      </Link>

      <div className="glass-card rounded-2xl p-5 mb-4 flex flex-wrap items-center gap-4">
        <span className="size-14 rounded-2xl text-xl font-bold flex items-center justify-center text-primary-foreground shrink-0" style={{ background: r.color }}>
          {r.shortName}
        </span>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight truncate">{r.longName}</h1>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
            <ModeIcon className="size-4" /> <span className="capitalize">{r.mode}</span>
            <span>·</span> {r.stopIds.length} stops <span>·</span> headway {r.headway}m
          </div>
        </div>
        <StatusPill status={r.status} />
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
          <MapBox highlightRouteId={r.id} showVehicles />
        </ChartCard>
        <ChartCard title="Demand curve" subtitle="Hourly ridership" className="h-[420px]">
          <ResponsiveContainer>
            <AreaChart data={hourly}>
              <defs>
                <linearGradient id="dc" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={r.color} stopOpacity={0.6} />
                  <stop offset="100%" stopColor={r.color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="hour" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => fmtCompact(v as number)} />
              <RTooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12 }} />
              <Area dataKey="riders" stroke={r.color} fill="url(#dc)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

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
    </div>
  );
}
