import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  Users, Bus, AlarmClock, Timer, Scale, Activity, ArrowRight, AlertTriangle, Sparkles, MapPin,
} from "lucide-react";
import { useKpis, useDisruptions, useHourly, useNetwork, useAiCards, useLiveRoutes, useSurfaceRidership } from "../mock/api";
import { KpiCard } from "../components/ui-ext/KpiCard";
import { ChartCard, PageHeader, StatusPill } from "../components/ui-ext/ChartCard";
import { MapBox } from "../components/map/MapBox";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip as RTooltip, CartesianGrid, BarChart, Bar,
} from "recharts";
import { fmtCompact } from "../lib/format";

export const Route = createFileRoute("/")({
  component: Dashboard,
});

function Dashboard() {
  const { data: kpis } = useKpis();
  const { data: disruptions = [] } = useDisruptions();
  const { data: hourly = [] } = useHourly();
  const { data: net } = useNetwork();
  const { data: aiCards = [] } = useAiCards();
  const { data: liveRoutes = [] } = useLiveRoutes();
  const { data: surfaceRidership = [] } = useSurfaceRidership(6);

  const sparkA = hourly.map((h) => h.riders / 1000);

  // Top routes: prefer real surface ridership from backend, fall back to mock routes
  const topRoutes = surfaceRidership.length > 0
    ? surfaceRidership.slice(0, 6).map((s) => {
        const live = liveRoutes.find((r) => r.id === s.route_id);
        return {
          shortName: s.route_short_name ?? s.route_name ?? s.route_id,
          ridership: s.all_day_riders ?? 0,
          color: live?.color ?? "var(--electric)",
        };
      })
    : [...(net?.routes ?? [])].sort((a, b) => b.ridership - a.ridership).slice(0, 6).map((r) => ({
        shortName: r.shortName,
        ridership: r.ridership,
        color: r.color,
      }));

  return (
    <div className="px-4 md:px-6 py-6 max-w-[1600px] mx-auto">
      <PageHeader
        title="Network Operations"
        subtitle="Real-time view of the TTC network · Saturday, May 9, 2026"
        action={
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl glass-card text-xs">
            <span className="size-2 rounded-full bg-success animate-pulse-glow" />
            All systems operational · refreshed just now
          </div>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 md:gap-4 mb-6">
        <KpiCard label="Daily Riders" value={kpis?.dailyRiders ?? 0} delta={3.2} hint="vs last Saturday" icon={Users} spark={sparkA} accent="primary" />
        <KpiCard label="Active Vehicles" value={kpis?.activeVehicles ?? 0} delta={1.1} hint="across 20 routes" icon={Bus} format="raw" spark={sparkA.slice().reverse()} accent="cyan" />
        <KpiCard label="Delayed Routes" value={kpis?.delayedRoutes ?? 0} delta={-12.4} hint="vs same hour" icon={AlarmClock} format="raw" accent="warn" />
        <KpiCard label="Avg Wait Time" value={`${kpis?.avgWait ?? 0} min`} delta={-4.7} hint="all modes" icon={Timer} accent="teal" />
        <KpiCard label="Equity Score" value={`${kpis?.equityScore ?? 0}/100`} delta={1.6} hint="city-wide mobility" icon={Scale} accent="success" />
        <KpiCard label="Congestion Index" value={`${kpis?.congestionIndex ?? 0}/100`} delta={6.3} hint="rush window" icon={Activity} accent="warn" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <ChartCard title="24-hour ridership" subtitle="Actual vs AI predicted · live" className="lg:col-span-2 h-[340px]">
          <ResponsiveContainer>
            <AreaChart data={hourly}>
              <defs>
                <linearGradient id="rg1" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--electric)" stopOpacity={0.6} />
                  <stop offset="100%" stopColor="var(--electric)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="rg2" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--cyan)" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="var(--cyan)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="hour" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false}
                     tickFormatter={(v) => fmtCompact(v as number)} />
              <RTooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12 }} />
              <Area dataKey="riders" stroke="var(--electric)" fill="url(#rg1)" strokeWidth={2} />
              <Area dataKey="predicted" stroke="var(--cyan)" fill="url(#rg2)" strokeWidth={1.5} strokeDasharray="4 4" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="AI summary"
          subtitle="Forecast confidence 92%"
          action={<Sparkles className="size-4 text-primary animate-pulse-glow" />}
          className="h-[340px]"
        >
          <div className="space-y-3 overflow-y-auto pr-1 scrollbar-thin h-full">
            {aiCards.map((c, i) => (
              <motion.div
                key={c.title}
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="rounded-xl border border-border bg-surface/40 p-3"
              >
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{c.title}</div>
                <div className="flex items-end justify-between mt-1">
                  <div className="text-xl font-semibold">{c.value}</div>
                  <div className={`text-xs ${c.delta >= 0 ? "text-success" : "text-destructive"}`}>
                    {c.delta >= 0 ? "▲" : "▼"} {Math.abs(c.delta)}%
                  </div>
                </div>
                <div className="text-xs text-muted-foreground mt-1">{c.hint}</div>
              </motion.div>
            ))}
          </div>
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <ChartCard
          title="Active disruptions"
          subtitle={`${disruptions.length} ongoing`}
          action={<AlertTriangle className="size-4 text-warn" />}
          className="lg:col-span-1"
        >
          <ul className="space-y-2">
            {disruptions.map((d) => {
              const r = net?.routes.find((x) => x.id === d.routeId);
              return (
                <li key={d.id} className="rounded-xl border border-border bg-surface/40 p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="size-6 rounded-md text-[10px] font-bold flex items-center justify-center text-primary-foreground" style={{ background: r?.color }}>
                      {r?.shortName}
                    </span>
                    <span className="text-sm font-medium truncate">{r?.longName}</span>
                    <span className={`ml-auto text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full
                      ${d.severity === "high" ? "bg-destructive/15 text-destructive" : d.severity === "medium" ? "bg-warn/15 text-warn" : "bg-cyan/15 text-cyan"}`}>
                      {d.severity}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">{d.message}</div>
                  <div className="text-[11px] text-muted-foreground mt-1">~{fmtCompact(d.affectedRiders)} riders affected · {d.startedAt}</div>
                </li>
              );
            })}
          </ul>
        </ChartCard>

        <ChartCard
          title="Top busiest routes"
          subtitle="Today's ridership"
          action={<Link to="/routes" className="text-xs text-primary inline-flex items-center gap-1">View all <ArrowRight className="size-3" /></Link>}
        >
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={topRoutes.map((r) => ({ name: r.shortName, riders: Math.round(r.ridership / 1000), color: r.color }))} layout="vertical" margin={{ left: 12 }}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis dataKey="name" type="category" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} width={36} />
              <RTooltip cursor={{ fill: "var(--surface-2)" }} contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12 }} />
              <Bar dataKey="riders" radius={[0, 8, 8, 0]} fill="var(--electric)" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Network preview"
          subtitle="Click any route for analytics"
          action={<Link to="/map" className="text-xs text-primary inline-flex items-center gap-1"><MapPin className="size-3" /> Full map</Link>}
        >
          <div className="h-[260px]">
            <MapBox showVehicles={false} showStops={false} />
          </div>
        </ChartCard>
      </div>

      <ChartCard title="Route status board" subtitle={`${liveRoutes.length || net?.routes.length || 0} routes · live`} className="mb-6">
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-5 gap-3">
          {(liveRoutes.length > 0 ? liveRoutes : net?.routes ?? []).map((r) => (
            <Link
              key={r.id}
              to="/routes/$id"
              params={{ id: r.id }}
              className="rounded-xl border border-border bg-surface/40 p-3 hover:bg-surface transition-colors"
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="size-7 rounded-md text-[11px] font-bold flex items-center justify-center text-primary-foreground"
                      style={{ background: r.color }}>{r.shortName}</span>
                <span className="text-sm font-medium truncate">{r.longName}</span>
                <StatusPill status={r.status} />
              </div>
              <div className="grid grid-cols-3 gap-1 text-center text-[10px]">
                <div>
                  <div className="font-semibold text-sm">{fmtCompact(r.ridership)}</div>
                  <div className="text-muted-foreground">riders</div>
                </div>
                <div>
                  <div className="font-semibold text-sm">{r.onTime}%</div>
                  <div className="text-muted-foreground">on time</div>
                </div>
                <div>
                  <div className="font-semibold text-sm">{r.aiScore}</div>
                  <div className="text-muted-foreground">AI score</div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </ChartCard>
    </div>
  );
}
