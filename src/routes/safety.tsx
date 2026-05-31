import { createFileRoute } from "@tanstack/react-router";
import { ShieldAlert, Activity, AlertTriangle } from "lucide-react";
import { useSafety, useNetwork } from "@/mock/api";
import { PageSkeleton } from "@/components/ui-ext/Skeleton";
import { PageError } from "@/components/ui-ext/QueryError";
import { ChartCard, PageHeader } from "@/components/ui-ext/ChartCard";
import { KpiCard } from "@/components/ui-ext/KpiCard";
import { InsightStrip } from "@/components/ui-ext/InsightStrip";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip } from "recharts";

export const Route = createFileRoute("/safety")({
  head: () => ({ meta: [{ title: "Safety / Vision Zero — TransitLens" }] }),
  component: SafetyPage,
});

function SafetyPage() {
  const { data: events = [], isLoading, isError, refetch } = useSafety();
  const { data: net } = useNetwork();
  if (isLoading) return <PageSkeleton />;
  if (isError && !events.length) return <PageError onRetry={refetch} />;
  const critical = events.filter((e) => e.severity === "critical").length;
  const byType = ["near-miss","collision","pedestrian","cyclist"].map((t) => ({
    type: t, count: events.filter((e) => e.type === t).length,
  }));
  const byLoc = Array.from(new Set(events.map((e) => e.location))).map((loc) => ({
    loc, count: events.filter((e) => e.location === loc).length,
  })).sort((a, b) => b.count - a.count);

  // Derive actionable insights from live data
  const topHotspot = byLoc[0];
  const topRouteEvents = Object.entries(
    events.reduce<Record<string, number>>((acc, e) => { acc[e.routeId] = (acc[e.routeId] ?? 0) + 1; return acc; }, {})
  ).sort(([, a], [, b]) => b - a)[0];
  const pedestrianCount = events.filter(e => e.type === "pedestrian" || e.type === "cyclist").length;
  const recentCritical = events.filter(e => e.severity === "critical" && e.daysAgo <= 7).length;

  const safetyInsights = [
    ...(topHotspot ? [{
      kind: "warn" as const,
      headline: `Hotspot: ${topHotspot.loc}`,
      detail: `${topHotspot.count} incident${topHotspot.count > 1 ? "s" : ""} recorded at this location in the last 30 days.`,
      action: "Review signal timing and transit stop placement",
    }] : []),
    ...(topRouteEvents ? [{
      kind: critical > 3 ? "critical" as const : "warn" as const,
      headline: `Route ${topRouteEvents[0]} — highest incident count`,
      detail: `${topRouteEvents[1]} safety event${topRouteEvents[1] > 1 ? "s" : ""} linked to this route. Consider proactive safety audit.`,
      action: "Flag for Vision Zero corridor review",
    }] : []),
    {
      kind: pedestrianCount > 5 ? "critical" as const : pedestrianCount > 2 ? "warn" as const : "success" as const,
      headline: `${pedestrianCount} vulnerable road user event${pedestrianCount !== 1 ? "s" : ""}`,
      detail: pedestrianCount > 5
        ? "Elevated pedestrian/cyclist incidents. Infrastructure redesign recommended at crossings."
        : pedestrianCount > 2
        ? "Moderate vulnerable user exposure. Monitor crossing signal compliance."
        : "Vulnerable road user incidents within acceptable range this period.",
      action: pedestrianCount > 2 ? "Coordinate with City Traffic Management" : undefined,
    },
    ...(recentCritical > 0 ? [{
      kind: "critical" as const,
      headline: `${recentCritical} critical event${recentCritical > 1 ? "s" : ""} in last 7 days`,
      detail: "Recent critical incidents require immediate operator briefing and route monitoring.",
      action: "Escalate to TTC Operations Control Centre",
    }] : []),
  ].slice(0, 3);

  return (
    <div className="px-4 md:px-6 py-6 max-w-[1600px] mx-auto">
      <PageHeader title="Vision Zero · Safety" subtitle="Collision & near-miss density · last 30 days" />
      <InsightStrip insights={safetyInsights} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6">
        <KpiCard label="Total events" value={events.length} format="raw" icon={Activity} accent="cyan" />
        <KpiCard label="Critical" value={critical} format="raw" icon={AlertTriangle} accent="warn" />
        <KpiCard label="Pedestrian / Cyclist" value={events.filter(e => e.type === "pedestrian" || e.type === "cyclist").length} format="raw" icon={ShieldAlert} accent="warn" />
        <KpiCard label="Network safety score" value="84/100" delta={2.1} icon={ShieldAlert} accent="success" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <ChartCard title="Events by type" className="h-[320px]">
          <ResponsiveContainer>
            <BarChart data={byType}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="type" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
              <RTooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12 }} />
              <Bar dataKey="count" radius={[8, 8, 0, 0]} fill="var(--warn)" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Hotspots" subtitle="Top corridors by event density" className="h-[320px]">
          <ul className="space-y-2 overflow-y-auto h-full pr-1 scrollbar-thin">
            {byLoc.map((l) => {
              const max = Math.max(...byLoc.map(x => x.count));
              return (
                <li key={l.loc} className="rounded-xl border border-border bg-surface/40 p-3">
                  <div className="flex justify-between mb-1.5"><span className="text-sm font-medium">{l.loc}</span><span className="text-xs text-muted-foreground">{l.count}</span></div>
                  <div className="h-1.5 rounded-full bg-surface overflow-hidden">
                    <div className="h-full" style={{ width: `${(l.count / max) * 100}%`, background: "var(--gradient-warn, var(--warn))" }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </ChartCard>
      </div>

      <ChartCard title="Recent events" subtitle="Linked to affected routes">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-muted-foreground">
              <tr className="border-b border-border">
                {["ID","Type","Severity","Location","Route","When"].map(h => <th key={h} className="text-left font-medium py-2 px-2">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {events.map((e) => {
                const r = net?.routes.find((x) => x.id === e.routeId);
                return (
                  <tr key={e.id} className="border-b border-border/50 hover:bg-surface/40">
                    <td className="py-2 px-2 font-mono">{e.id}</td>
                    <td className="py-2 px-2">{e.type}</td>
                    <td className="py-2 px-2">
                      <span className={`text-[10px] uppercase px-2 py-0.5 rounded-full ${e.severity === "critical" ? "bg-destructive/15 text-destructive" : e.severity === "major" ? "bg-warn/15 text-warn" : "bg-cyan/15 text-cyan"}`}>{e.severity}</span>
                    </td>
                    <td className="py-2 px-2">{e.location}</td>
                    <td className="py-2 px-2">{r?.shortName ?? e.routeId}</td>
                    <td className="py-2 px-2 text-muted-foreground">{e.daysAgo}d ago</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </ChartCard>
    </div>
  );
}