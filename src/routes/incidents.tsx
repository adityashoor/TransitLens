import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Siren, AlertTriangle, ShieldCheck, Activity as ActIcon, Sparkles } from "lucide-react";
import { useIncidents, useNetwork } from "@/mock/api";
import { ChartCard, PageHeader } from "@/components/ui-ext/ChartCard";
import { KpiCard } from "@/components/ui-ext/KpiCard";
import { fmtCompact } from "@/lib/format";

export const Route = createFileRoute("/incidents")({
  head: () => ({
    meta: [
      { title: "Incidents — TransitLens" },
      { name: "description", content: "Live TTC incidents timeline with AI clustering and response status." },
    ],
  }),
  component: IncidentsPage,
});

const sevColor = {
  low: "bg-cyan/15 text-cyan border-cyan/20",
  medium: "bg-warn/15 text-warn border-warn/20",
  high: "bg-destructive/15 text-destructive border-destructive/20",
  critical: "bg-destructive/25 text-destructive border-destructive/30",
} as const;

function IncidentsPage() {
  const { data: incidents = [] } = useIncidents();
  const { data: net } = useNetwork();
  const active = incidents.filter((i) => i.status !== "resolved");
  const critical = incidents.filter((i) => i.severity === "critical" || i.severity === "high");
  const totalAffected = incidents.reduce((s, i) => s + i.affectedRiders, 0);

  return (
    <div className="px-4 md:px-6 py-6 max-w-[1600px] mx-auto">
      <PageHeader
        title="Incident Operations"
        subtitle="Real-time incident timeline · AI root-cause clustering"
        action={
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl glass-card text-xs">
            <Sparkles className="size-3.5 text-primary" />
            AI clustered {incidents.length} events into {Math.max(1, Math.round(incidents.length / 4))} patterns
          </div>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6">
        <KpiCard label="Active Incidents" value={active.length} delta={2.3} hint="ongoing" icon={Siren} format="raw" accent="warn" />
        <KpiCard label="Critical / High" value={critical.length} delta={-8.1} hint="last 6h" icon={AlertTriangle} format="raw" accent="warn" />
        <KpiCard label="Riders Affected" value={fmtCompact(totalAffected)} delta={4.7} hint="last 6h" icon={ActIcon} accent="cyan" />
        <KpiCard label="Mean Time to Resolve" value="18 min" delta={-11.4} hint="trailing 7d" icon={ShieldCheck} accent="success" />
      </div>

      <ChartCard title="Live timeline" subtitle="Sorted by start time · AI prioritized">
        <div className="space-y-2">
          {incidents
            .sort((a, b) => +new Date(b.startedAt) - +new Date(a.startedAt))
            .map((i, idx) => {
              const r = net?.routes.find((x) => x.id === i.routeId);
              return (
                <motion.div
                  key={i.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.02 }}
                  className="rounded-xl border border-border bg-surface/40 p-3 flex flex-wrap items-center gap-3"
                >
                  <div className="flex items-center gap-2 min-w-[140px]">
                    <span className="text-[10px] font-mono text-muted-foreground">{i.id}</span>
                    <span className={`text-[10px] uppercase px-2 py-0.5 rounded-full border ${sevColor[i.severity]}`}>
                      {i.severity}
                    </span>
                  </div>
                  {r && (
                    <span className="size-7 rounded-md text-[10px] font-bold flex items-center justify-center text-primary-foreground"
                          style={{ background: r.color }}>{r.shortName}</span>
                  )}
                  <div className="flex-1 min-w-[200px]">
                    <div className="text-sm font-medium">{i.title}</div>
                    <div className="text-xs text-muted-foreground">{i.location} · {i.detail}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground">{fmtCompact(i.affectedRiders)} riders · {i.responders} responders</div>
                    <div className="text-[10px] uppercase tracking-wide mt-0.5"
                         style={{ color: i.status === "resolved" ? "var(--success)" : i.status === "active" ? "var(--destructive)" : "var(--warn)" }}>
                      {i.status}
                    </div>
                  </div>
                </motion.div>
              );
            })}
        </div>
      </ChartCard>
    </div>
  );
}