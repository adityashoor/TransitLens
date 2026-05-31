import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Siren, AlertTriangle, ShieldCheck, Activity as ActIcon, Bus, Train } from "lucide-react";
import { useIncidents, useNetwork } from "@/mock/api";
import { ChartCard, PageHeader } from "@/components/ui-ext/ChartCard";
import { KpiCard } from "@/components/ui-ext/KpiCard";
import { fmtCompact } from "@/lib/format";

export const Route = createFileRoute("/incidents")({
  head: () => ({
    meta: [
      { title: "Incidents — TransitLens" },
      { name: "description", content: "Live TTC delay incidents from Toronto Open Data." },
    ],
  }),
  component: IncidentsPage,
});

const sevColor: Record<string, string> = {
  low:      "bg-cyan/15 text-cyan border-cyan/20",
  medium:   "bg-warn/15 text-warn border-warn/20",
  high:     "bg-destructive/15 text-destructive border-destructive/30",
  critical: "bg-destructive/25 text-destructive border-destructive/30",
};

function IncidentsPage() {
  const { data: incidents = [] } = useIncidents();
  const { data: net } = useNetwork();

  const high    = incidents.filter((i) => i.severity === "high" || i.severity === "critical");
  const byType  = incidents.reduce<Record<string, number>>((acc, i) => {
    acc[i.type] = (acc[i.type] ?? 0) + 1;
    return acc;
  }, {});
  const avgDelay = incidents.length
    ? Math.round(incidents.reduce((s, i) => s + (i.minDelay ?? 0), 0) / incidents.length)
    : 0;

  // Sort by delay descending (most severe first)
  const sorted = [...incidents].sort((a, b) => (b.minDelay ?? 0) - (a.minDelay ?? 0));

  return (
    <div className="px-4 md:px-6 py-6 max-w-[1600px] mx-auto">
      <PageHeader
        title="Incident Operations"
        subtitle="Live TTC delays · Toronto Open Data · Bus & Subway 2025"
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6">
        <KpiCard label="Total Incidents" value={incidents.length} icon={Siren} format="raw" accent="warn" />
        <KpiCard label="High / Critical" value={high.length} icon={AlertTriangle} format="raw" accent="danger" />
        <KpiCard label="Avg Delay" value={`${avgDelay} min`} icon={ActIcon} format="raw" accent="cyan" />
        <KpiCard label="Resolved" value={`${incidents.length - high.length}`} icon={ShieldCheck} format="raw" accent="success" />
      </div>

      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="glass-card rounded-2xl p-4 flex items-center gap-3">
          <Bus className="size-8 text-primary" />
          <div>
            <div className="text-2xl font-bold">{byType["bus"] ?? 0}</div>
            <div className="text-xs text-muted-foreground">Bus delays</div>
          </div>
        </div>
        <div className="glass-card rounded-2xl p-4 flex items-center gap-3">
          <Train className="size-8 text-electric" />
          <div>
            <div className="text-2xl font-bold">{byType["subway"] ?? 0}</div>
            <div className="text-xs text-muted-foreground">Subway delays</div>
          </div>
        </div>
      </div>

      <ChartCard title="Delay timeline" subtitle="Sorted by severity · Real data from Toronto Open Data 2025">
        <div className="space-y-2 max-h-[560px] overflow-y-auto pr-1">
          {sorted.map((i, idx) => {
            const r = net?.routes.find((x) => x.id === i.routeId);
            const color = sevColor[i.severity] ?? sevColor.low;
            const TypeIcon = i.type === "subway" ? Train : Bus;
            return (
              <motion.div
                key={i.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: Math.min(idx * 0.015, 0.4) }}
                className="rounded-xl border border-border bg-surface/40 p-3 flex flex-wrap items-center gap-3"
              >
                {/* Type icon */}
                <TypeIcon className={`size-4 shrink-0 ${i.type === "subway" ? "text-electric" : "text-primary"}`} />

                {/* Severity badge */}
                <span className={`text-[10px] uppercase px-2 py-0.5 rounded-full border shrink-0 ${color}`}>
                  {i.severity}
                </span>

                {/* Route badge */}
                {r ? (
                  <span className="size-7 rounded-md text-[10px] font-bold flex items-center justify-center text-primary-foreground shrink-0"
                        style={{ background: r.color }}>{r.shortName}</span>
                ) : (
                  <span className="text-[10px] font-mono text-muted-foreground shrink-0">{i.routeId}</span>
                )}

                {/* Message */}
                <div className="flex-1 min-w-[180px]">
                  <div className="text-sm font-medium leading-snug">{i.message}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">{i.timestamp}</div>
                </div>

                {/* Delay */}
                <div className="text-right shrink-0">
                  <div className="text-sm font-bold text-warn">{i.minDelay} min</div>
                  <div className="text-[10px] text-muted-foreground">delay</div>
                </div>
              </motion.div>
            );
          })}
          {incidents.length === 0 && (
            <div className="text-center py-12 text-muted-foreground text-sm">
              No incidents found — all systems running normally
            </div>
          )}
        </div>
      </ChartCard>
    </div>
  );
}
