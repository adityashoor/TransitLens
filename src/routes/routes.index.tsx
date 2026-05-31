import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { motion } from "framer-motion";
import { Search, Filter, Wifi, AlertTriangle, CheckCircle, Clock } from "lucide-react";
import { useNetwork, useRouteStats } from "@/mock/api";
import { PageHeader } from "@/components/ui-ext/ChartCard";
import { fmtCompact } from "@/lib/format";
import type { RouteStats } from "@/mock/api";

export const Route = createFileRoute("/routes/")({
  head: () => ({
    meta: [
      { title: "Route Explorer — TransitLens" },
      { name: "description", content: "Browse and analyze every TTC route: ridership, congestion, AI performance scores, and trends." },
    ],
  }),
  component: RouteExplorer,
});

function StatusBadge({ status }: { status: "normal" | "delayed" | "disrupted" }) {
  if (status === "disrupted") return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-destructive/15 text-destructive">
      <AlertTriangle className="size-2.5" /> Disrupted
    </span>
  );
  if (status === "delayed") return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-warn/15 text-warn">
      <Clock className="size-2.5" /> Delayed
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-success/15 text-success">
      <CheckCircle className="size-2.5" /> On time
    </span>
  );
}

function CongestionBar({ pct, status }: { pct: number; status: RouteStats["status"] }) {
  const color = status === "disrupted" ? "var(--destructive)" : status === "delayed" ? "var(--warn)" : "var(--success)";
  return (
    <div className="mt-3">
      <div className="flex justify-between items-center mb-1">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Congestion</span>
        <span className="text-[10px] text-muted-foreground">{pct}/100</span>
      </div>
      <div className="h-1.5 rounded-full bg-surface-2 overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, delay: 0.1 }}
          className="h-full rounded-full"
          style={{ background: color }}
        />
      </div>
    </div>
  );
}

function RouteExplorer() {
  const { data: net, isLoading: netLoading } = useNetwork();
  const { data: stats = {}, isLoading: statsLoading } = useRouteStats();
  const [q, setQ] = useState("");
  const [mode, setMode] = useState<string>("all");

  const filtered = (net?.routes ?? [])
    .filter((r) => mode === "all" || r.mode === mode)
    .filter((r) => !q || `${r.shortName} ${r.longName}`.toLowerCase().includes(q.toLowerCase()));

  const liveCount = Object.values(stats).reduce((s, v) => s + v.liveVehicles, 0);
  const hasRealStats = Object.keys(stats).length > 0;

  return (
    <div className="px-4 md:px-6 py-6 max-w-[1600px] mx-auto">
      <PageHeader
        title="Route Explorer"
        subtitle={`${filtered.length} of ${net?.routes.length ?? 0} routes`}
        action={
          <div className="flex items-center gap-2 text-xs">
            {liveCount > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl glass-card">
                <Wifi className="size-3.5 text-success animate-pulse" />
                <span className="text-success font-medium">{liveCount} vehicles live</span>
              </div>
            )}
            {hasRealStats && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl glass-card text-muted-foreground">
                <span className="size-1.5 rounded-full bg-cyan animate-pulse" />
                Real on-time data · CKAN 2025
              </div>
            )}
          </div>
        }
      />

      {/* Search + filter bar */}
      <div className="glass-card rounded-2xl p-4 mb-4 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name or number…"
            className="w-full h-10 pl-9 pr-3 rounded-xl bg-surface/60 border border-border text-sm outline-none focus:ring-2 focus:ring-ring/40"
          />
        </div>
        <div className="flex items-center gap-1 text-xs">
          <Filter className="size-3.5 text-muted-foreground mr-1" />
          {["all", "subway", "streetcar", "bus"].map((m) => {
            const count = m === "all"
              ? net?.routes.length ?? 0
              : net?.routes.filter((r) => r.mode === m).length ?? 0;
            return (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`h-9 px-3 rounded-lg capitalize transition-colors ${mode === m ? "bg-primary text-primary-foreground" : "bg-surface/60 hover:bg-surface text-muted-foreground"}`}
              >
                {m} {count > 0 && <span className="ml-1 opacity-60">({count})</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Route grid */}
      {netLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="glass-card rounded-2xl p-4 space-y-3 animate-pulse">
              <div className="flex items-start gap-3">
                <div className="size-12 rounded-xl bg-surface/60" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-surface/60 rounded w-3/4" />
                  <div className="h-3 bg-surface/60 rounded w-1/3" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[0,1,2].map((j) => <div key={j} className="h-8 bg-surface/60 rounded" />)}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {filtered.map((r, i) => {
            const s          = stats[r.id];
            const rawOnTime  = s?.onTimePct ?? -1;
            const hasReal    = rawOnTime >= 0 && (s?.incidentCount ?? 0) >= 15;
            const onTime     = hasReal ? rawOnTime : r.onTime;
            const congestion = hasReal ? (s?.congestionIdx ?? r.congestion) : r.congestion;
            const status     = hasReal ? (s?.status ?? r.status) : r.status;
            const liveVeh    = s?.liveVehicles ?? 0;
            const incidents  = s?.incidentCount ?? 0;
            const avgDelay   = s?.avgDelayMin  ?? 0;
            const isReal     = hasReal;

            return (
              <motion.div
                key={r.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.015, 0.25) }}
              >
                <Link
                  to="/routes/$id"
                  params={{ id: r.id }}
                  className="block glass-card rounded-2xl p-4 hover:translate-y-[-2px] transition-transform h-full"
                >
                  {/* Header */}
                  <div className="flex items-start gap-3">
                    <span
                      className="size-12 rounded-xl text-base font-bold flex items-center justify-center text-white shrink-0 shadow-md"
                      style={{ background: r.color }}
                    >
                      {r.shortName}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm truncate">{r.longName}</div>
                      <div className="text-xs text-muted-foreground capitalize mt-0.5">{r.mode}</div>
                    </div>
                    <StatusBadge status={status} />
                  </div>

                  {/* KPI row */}
                  <div className="grid grid-cols-3 gap-2 mt-4 text-center">
                    <div className="rounded-xl bg-surface/40 py-2">
                      <div className="text-sm font-semibold">{fmtCompact(r.ridership)}</div>
                      <div className="text-[10px] text-muted-foreground uppercase">riders</div>
                    </div>
                    <div className="rounded-xl bg-surface/40 py-2">
                      <div className={`text-sm font-semibold ${onTime < 70 ? "text-destructive" : onTime < 80 ? "text-warn" : "text-success"}`}>
                        {onTime}%
                      </div>
                      <div className="text-[10px] text-muted-foreground uppercase">on time</div>
                    </div>
                    <div className="rounded-xl bg-surface/40 py-2">
                      <div className="text-sm font-semibold">{r.headway} min</div>
                      <div className="text-[10px] text-muted-foreground uppercase">headway</div>
                    </div>
                  </div>

                  <CongestionBar pct={congestion} status={status} />

                  {/* Live data footer */}
                  <div className="flex items-center justify-between mt-3 pt-2 border-t border-border/50">
                    {liveVeh > 0 ? (
                      <span className="text-[10px] text-success flex items-center gap-1">
                        <span className="size-1.5 rounded-full bg-success animate-pulse inline-block" />
                        {liveVeh} vehicle{liveVeh > 1 ? "s" : ""} live
                      </span>
                    ) : (
                      <span className="text-[10px] text-muted-foreground">No live vehicles</span>
                    )}
                    {isReal ? (
                      <span className="text-[10px] text-muted-foreground">
                        {incidents} incidents · avg {avgDelay}m delay
                      </span>
                    ) : (
                      <span className="text-[10px] text-muted-foreground italic">
                        {statsLoading ? "Loading stats…" : "Est. data"}
                      </span>
                    )}
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
