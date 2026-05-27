import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { motion } from "framer-motion";
import { Search, Filter } from "lucide-react";
import { useNetwork } from "@/mock/api";
import { PageHeader, StatusPill } from "@/components/ui-ext/ChartCard";
import { fmtCompact } from "@/lib/format";

export const Route = createFileRoute("/routes/")({
  head: () => ({
    meta: [
      { title: "Route Explorer — TransitLens" },
      { name: "description", content: "Browse and analyze every TTC route: ridership, congestion, AI performance scores, and trends." },
    ],
  }),
  component: RouteExplorer,
});

function RouteExplorer() {
  const { data: net } = useNetwork();
  const [q, setQ] = useState("");
  const [mode, setMode] = useState<string>("all");

  const filtered = (net?.routes ?? [])
    .filter((r) => mode === "all" || r.mode === mode)
    .filter((r) => !q || `${r.shortName} ${r.longName}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="px-4 md:px-6 py-6 max-w-[1600px] mx-auto">
      <PageHeader title="Route Explorer" subtitle={`${filtered.length} of ${net?.routes.length ?? 0} routes`} />

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
          {["all", "subway", "streetcar", "bus"].map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`h-9 px-3 rounded-lg capitalize transition-colors ${mode === m ? "bg-primary text-primary-foreground" : "bg-surface/60 hover:bg-surface text-muted-foreground"}`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {filtered.map((r, i) => (
          <motion.div
            key={r.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(i * 0.02, 0.3) }}
          >
            <Link
              to="/routes/$id"
              params={{ id: r.id }}
              className="block glass-card rounded-2xl p-4 hover:translate-y-[-2px] transition-transform"
            >
              <div className="flex items-start gap-3">
                <span
                  className="size-12 rounded-xl text-base font-bold flex items-center justify-center text-primary-foreground shrink-0"
                  style={{ background: r.color }}
                >
                  {r.shortName}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">{r.longName}</div>
                  <div className="text-xs text-muted-foreground capitalize">{r.mode}</div>
                </div>
                <StatusPill status={r.status} />
              </div>
              <div className="grid grid-cols-3 gap-2 mt-4 text-center">
                <div>
                  <div className="text-sm font-semibold">{fmtCompact(r.ridership)}</div>
                  <div className="text-[10px] text-muted-foreground uppercase">riders</div>
                </div>
                <div>
                  <div className="text-sm font-semibold">{r.onTime}%</div>
                  <div className="text-[10px] text-muted-foreground uppercase">on time</div>
                </div>
                <div>
                  <div className="text-sm font-semibold">{r.aiScore}</div>
                  <div className="text-[10px] text-muted-foreground uppercase">AI score</div>
                </div>
              </div>
              <div className="mt-3">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Congestion</div>
                <div className="h-1.5 rounded-full bg-surface-2 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${r.congestion}%` }}
                    transition={{ duration: 0.8, delay: 0.1 }}
                    className="h-full"
                    style={{ background: r.congestion > 75 ? "var(--destructive)" : r.congestion > 55 ? "var(--warn)" : "var(--success)" }}
                  />
                </div>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
