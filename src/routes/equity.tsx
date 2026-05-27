import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { motion } from "framer-motion";
import { ChartCard, PageHeader } from "../components/ui-ext/ChartCard";
import { useLiveEquity, type EquityScore } from "../mock/api";
import { Lightbulb, MapPin } from "lucide-react";
import { fmtCompact } from "../lib/format";

export const Route = createFileRoute("/equity")({
  component: Equity,
});

function scoreColor(v: number) {
  if (v >= 80) return "bg-cyan/20 text-cyan";
  if (v >= 65) return "bg-teal/20 text-teal";
  if (v >= 50) return "bg-warn/20 text-warn";
  return "bg-destructive/20 text-destructive";
}

function incomeLabel(v: number | null) {
  if (v == null) return "—";
  if (v >= 90000) return "high";
  if (v >= 60000) return "mid-high";
  if (v >= 40000) return "medium";
  return "low";
}

function Equity() {
  const [sort, setSort] = useState<"lowest" | "highest" | "name">("lowest");
  const { data: scores = [], isLoading } = useLiveEquity(sort, 200);
  const [selected, setSelected] = useState<EquityScore | null>(null);

  const underserved = [...scores].sort((a, b) => a.score - b.score).slice(0, 5);
  const tableRows = sort === "highest"
    ? [...scores].sort((a, b) => b.score - a.score)
    : sort === "name"
    ? [...scores].sort((a, b) => (a.geography_name ?? "").localeCompare(b.geography_name ?? ""))
    : [...scores].sort((a, b) => a.score - b.score);

  return (
    <div className="px-4 md:px-6 py-6 max-w-[1600px] mx-auto">
      <PageHeader
        title="Equity Heatmap"
        subtitle={`Mobility access across ${scores.length} Toronto neighbourhoods`}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Score breakdown cards */}
        <div className="lg:col-span-2 grid grid-cols-2 md:grid-cols-3 gap-3">
          {scores.slice(0, 12).map((s, i) => (
            <motion.button
              key={s.geography_id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              onClick={() => setSelected(s === selected ? null : s)}
              className={`glass-card rounded-2xl p-4 text-left transition-all hover:translate-y-[-2px] ${selected?.geography_id === s.geography_id ? "ring-2 ring-primary" : ""}`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-semibold truncate pr-2">{s.geography_name ?? s.geography_id}</div>
                <span className={`text-xs font-bold px-2 py-0.5 rounded shrink-0 ${scoreColor(s.score)}`}>
                  {Math.round(s.score)}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-surface-2 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${s.score}%` }}
                  transition={{ duration: 0.8, delay: i * 0.03 }}
                  className="h-full"
                  style={{
                    background: s.score >= 80 ? "var(--cyan)" : s.score >= 50 ? "var(--warn)" : "var(--destructive)",
                  }}
                />
              </div>
              <div className="text-[10px] text-muted-foreground mt-2 space-y-0.5">
                {s.stop_density != null && <div>Stops/km²: {s.stop_density.toFixed(1)}</div>}
                {s.distance_to_stop != null && <div>Dist to stop: {Math.round(s.distance_to_stop)}m</div>}
              </div>
            </motion.button>
          ))}
          {isLoading && (
            <div className="col-span-full text-sm text-muted-foreground text-center py-8">
              Loading equity data…
            </div>
          )}
        </div>

        <div className="space-y-4">
          {/* Selected area detail */}
          <div className="glass-card rounded-2xl p-5">
            <div className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Selected area</div>
            {selected ? (
              <>
                <div className="flex items-center gap-2 mb-3">
                  <MapPin className="size-4 text-primary" />
                  <span className="font-semibold">{selected.geography_name ?? selected.geography_id}</span>
                  {selected.area_type && (
                    <span className="text-xs text-muted-foreground capitalize ml-auto">{selected.area_type}</span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    ["Equity score", `${Math.round(selected.score)}/100`],
                    ["Stops/km²", selected.stop_density != null ? selected.stop_density.toFixed(1) : "—"],
                    ["Dist to stop", selected.distance_to_stop != null ? `${Math.round(selected.distance_to_stop)}m` : "—"],
                    ["Income", incomeLabel(selected.median_income)],
                    ["Ridership/cap", selected.ridership_per_capita != null ? selected.ridership_per_capita.toFixed(1) : "—"],
                    ["Vulnerable %", selected.vulnerable_share != null ? `${Math.round(selected.vulnerable_share)}%` : "—"],
                  ].map(([k, v]) => (
                    <div key={k as string} className="rounded-lg border border-border bg-surface/40 p-2">
                      <div className="text-[10px] uppercase text-muted-foreground">{k}</div>
                      <div className="text-sm font-semibold capitalize">{v}</div>
                    </div>
                  ))}
                </div>
                {selected.metrics?.priority_level && (
                  <div className="mt-3 text-xs text-muted-foreground">
                    Priority: <span className="font-medium text-foreground">{selected.metrics.priority_level as string}</span>
                  </div>
                )}
              </>
            ) : (
              <div className="text-sm text-muted-foreground">Click a neighbourhood card to see details.</div>
            )}
          </div>

          {/* Top underserved */}
          <ChartCard title="Top underserved" subtitle="Lowest equity scores">
            <ul className="space-y-2">
              {underserved.map((s, i) => (
                <motion.li
                  key={s.geography_id}
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="rounded-xl border border-border bg-surface/40 p-3 flex items-center gap-3"
                >
                  <div className="size-8 rounded-lg bg-destructive/15 text-destructive font-semibold flex items-center justify-center text-sm">{i + 1}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{s.geography_name ?? s.geography_id}</div>
                    <div className="text-xs text-muted-foreground">
                      {s.stop_density != null ? `${s.stop_density.toFixed(1)} stops/km²` : ""}
                      {s.distance_to_stop != null ? ` · ${Math.round(s.distance_to_stop)}m to stop` : ""}
                    </div>
                  </div>
                  <div className={`text-xs font-semibold px-2 py-0.5 rounded ${scoreColor(s.score)}`}>
                    {Math.round(s.score)}
                  </div>
                </motion.li>
              ))}
            </ul>
          </ChartCard>

          {/* AI recommendations */}
          <div className="glass-card rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <Lightbulb className="size-4 text-warn" />
              <div className="text-sm font-semibold">AI recommendations</div>
            </div>
            <ul className="text-xs text-muted-foreground space-y-2">
              {underserved[0] && <li>• Increase stop density in {underserved[0].geography_name ?? "lowest-scored area"} (score: {Math.round(underserved[0].score)}) to improve access.</li>}
              {underserved[1] && <li>• Reduce distance to nearest stop in {underserved[1].geography_name ?? "area 2"} — currently {underserved[1].distance_to_stop != null ? `${Math.round(underserved[1].distance_to_stop)}m` : "unknown"}.</li>}
              <li>• Pilot demand-responsive transit in low-density neighbourhoods to address last-mile coverage.</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Full rankings table */}
      <ChartCard
        title="All neighbourhoods"
        subtitle="Sortable equity rankings"
        className="mt-4"
        action={
          <div className="flex gap-1">
            {(["lowest", "highest", "name"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSort(s)}
                className={`h-7 px-2 rounded text-xs capitalize ${sort === s ? "bg-primary text-primary-foreground" : "bg-surface/60 text-muted-foreground"}`}
              >
                {s}
              </button>
            ))}
          </div>
        }
      >
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground uppercase tracking-wider">
              <tr className="border-b border-border">
                <th className="text-left py-2 px-3 font-medium">#</th>
                <th className="text-left py-2 px-3 font-medium">Neighbourhood</th>
                <th className="text-right py-2 px-3 font-medium">Score</th>
                <th className="text-right py-2 px-3 font-medium">Stops/km²</th>
                <th className="text-right py-2 px-3 font-medium">Dist to stop</th>
                <th className="text-right py-2 px-3 font-medium">Income tier</th>
                <th className="text-right py-2 px-3 font-medium">Ridership/cap</th>
                <th className="text-right py-2 px-3 font-medium">Vulnerable %</th>
              </tr>
            </thead>
            <tbody>
              {tableRows.map((s, i) => (
                <tr
                  key={s.geography_id}
                  className="border-b border-border last:border-0 hover:bg-surface/40 cursor-pointer"
                  onClick={() => setSelected(s === selected ? null : s)}
                >
                  <td className="py-2 px-3 text-muted-foreground">{i + 1}</td>
                  <td className="py-2 px-3 font-medium">{s.geography_name ?? s.geography_id}</td>
                  <td className="py-2 px-3 text-right">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded ${scoreColor(s.score)}`}>
                      {Math.round(s.score)}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-right">{s.stop_density != null ? s.stop_density.toFixed(1) : "—"}</td>
                  <td className="py-2 px-3 text-right">{s.distance_to_stop != null ? `${Math.round(s.distance_to_stop)}m` : "—"}</td>
                  <td className="py-2 px-3 text-right capitalize text-muted-foreground">{incomeLabel(s.median_income)}</td>
                  <td className="py-2 px-3 text-right">{s.ridership_per_capita != null ? s.ridership_per_capita.toFixed(1) : "—"}</td>
                  <td className="py-2 px-3 text-right">{s.vulnerable_share != null ? `${Math.round(s.vulnerable_share)}%` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ChartCard>
    </div>
  );
}
