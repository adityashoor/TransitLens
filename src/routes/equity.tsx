import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { motion } from "framer-motion";
import { ChartCard, PageHeader } from "@/components/ui-ext/ChartCard";
import { HoodsMap } from "@/components/map/TransitMap";
import { ClientOnly } from "@/components/ClientOnly";
import { useHoods } from "@/mock/api";
import type { Hood } from "@/mock/data";
import { MapPin } from "lucide-react";
import { InsightStrip } from "@/components/ui-ext/InsightStrip";

export const Route = createFileRoute("/equity")({
  head: () => ({
    meta: [
      { title: "Equity Heatmap — TransitLens" },
      { name: "description", content: "Geographic transit equity analysis: mobility scores, stop density, and underserved Toronto neighborhoods." },
    ],
  }),
  component: Equity,
});

function colorForScore(v: number) {
  if (v >= 80) return "bg-cyan/20 text-cyan";
  if (v >= 65) return "bg-teal/20 text-teal";
  if (v >= 50) return "bg-warn/20 text-warn";
  return "bg-destructive/20 text-destructive";
}

function Equity() {
  const { data: hoods = [] } = useHoods();
  const [selected, setSelected] = useState<Hood | null>(null);

  const ranked = [...hoods].sort((a, b) => a.mobilityScore - b.mobilityScore);
  const underserved = ranked.slice(0, 5);

  // Derive equity insights from live neighbourhood data
  const critical = ranked.filter(h => h.mobilityScore < 40);
  const longWait  = ranked.filter(h => h.avgWait > 15);
  const lowDensity = ranked.filter(h => h.stopDensity < 3);
  const equityGap = hoods.length > 1
    ? Math.round(ranked[ranked.length - 1].mobilityScore - ranked[0].mobilityScore)
    : 0;

  const equityInsights = [
    ...(critical.length > 0 ? [{
      kind: "critical" as const,
      headline: `${critical.length} neighbourhood${critical.length > 1 ? "s" : ""} below mobility threshold`,
      detail: `${critical.map(h => h.name).slice(0, 2).join(", ")}${critical.length > 2 ? ` +${critical.length - 2} more` : ""} score below 40/100 — classified as transit deserts.`,
      action: "Priority candidates for new route or frequency increase",
    }] : []),
    ...(equityGap > 30 ? [{
      kind: "warn" as const,
      headline: `${equityGap}-point equity gap across the network`,
      detail: `Mobility scores range from ${ranked[0]?.mobilityScore} to ${ranked[ranked.length - 1]?.mobilityScore}. High disparity indicates unequal service distribution.`,
      action: "Review service allocation against income and density data",
    }] : [{
      kind: "success" as const,
      headline: "Equity gap within acceptable range",
      detail: `${equityGap}-point spread across ${hoods.length} neighbourhoods. Continue monitoring underserved areas.`,
    }]),
    ...(longWait.length > 0 ? [{
      kind: "warn" as const,
      headline: `${longWait.length} area${longWait.length > 1 ? "s" : ""} with avg wait > 15 min`,
      detail: `${longWait.map(h => h.name).slice(0, 2).join(", ")}${longWait.length > 2 ? ` +${longWait.length - 2} more` : ""} exceed the TTC 15-minute service standard.`,
      action: "Evaluate headway reduction or on-demand transit pilot",
    }] : []),
  ].slice(0, 3);

  return (
    <div className="px-4 md:px-6 py-6 max-w-[1600px] mx-auto">
      <PageHeader
        title="Equity Heatmap"
        subtitle="Mobility access across 25 Toronto neighborhoods"
      />
      <InsightStrip insights={equityInsights} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ChartCard title="Mobility score by neighborhood" subtitle="Click an area for details" className="lg:col-span-2 h-[600px]">
          <ClientOnly fallback={<div className="size-full grid place-items-center text-xs text-muted-foreground">Loading map…</div>}>
            <HoodsMap onHoodClick={(h) => setSelected(h)} />
          </ClientOnly>
        </ChartCard>

        <div className="space-y-4">
          <div className="glass-card rounded-2xl p-5">
            <div className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Selected area</div>
            {selected ? (
              <>
                <div className="flex items-center gap-2"><MapPin className="size-4 text-primary" /><span className="font-semibold">{selected.name}</span></div>
                <div className="grid grid-cols-2 gap-2 mt-3">
                  {[
                    ["Mobility", `${selected.mobilityScore}/100`],
                    ["Stops/km²", `${selected.stopDensity}`],
                    ["Avg wait", `${selected.avgWait} min`],
                    ["Income", selected.income],
                  ].map(([k, v]) => (
                    <div key={k} className="rounded-lg border border-border bg-surface/40 p-2">
                      <div className="text-[10px] uppercase text-muted-foreground">{k}</div>
                      <div className="text-sm font-semibold capitalize">{v}</div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="text-sm text-muted-foreground">Tap a neighborhood on the map.</div>
            )}
          </div>

          <ChartCard title="Top underserved" subtitle="Lowest mobility scores">
            <ul className="space-y-2">
              {underserved.map((h, i) => (
                <motion.li
                  key={h.id}
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="rounded-xl border border-border bg-surface/40 p-3 flex items-center gap-3"
                >
                  <div className="size-8 rounded-lg bg-destructive/15 text-destructive font-semibold flex items-center justify-center text-sm">{i + 1}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">{h.name}</div>
                    <div className="text-xs text-muted-foreground">Wait {h.avgWait}m · {h.stopDensity} stops/km²</div>
                  </div>
                  <div className={`text-xs font-semibold px-2 py-0.5 rounded ${colorForScore(h.mobilityScore)}`}>{h.mobilityScore}</div>
                </motion.li>
              ))}
            </ul>
          </ChartCard>

          <div className="glass-card rounded-2xl p-5">
            <div className="text-xs font-semibold mb-2 text-muted-foreground uppercase tracking-wider">Service recommendations</div>
            <ul className="text-xs text-muted-foreground space-y-2">
              {underserved.slice(0, 3).map((h) => (
                <li key={h.id}>
                  • <span className="text-foreground font-medium">{h.name}</span>
                  {h.avgWait > 15
                    ? ` — reduce headway to meet 15-min standard (currently ${h.avgWait} min avg wait)`
                    : h.stopDensity < 3
                    ? ` — add stops to improve density (${h.stopDensity}/km²)`
                    : ` — mobility score ${h.mobilityScore}/100, review service allocation`}
                </li>
              ))}
              {lowDensity.length > 0 && (
                <li>• {lowDensity.length} area{lowDensity.length > 1 ? "s" : ""} with stop density &lt;3/km² — pilot demand-responsive transit</li>
              )}
            </ul>
          </div>
        </div>
      </div>

      <ChartCard title="All neighborhoods" subtitle="Sortable rankings" className="mt-4">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground uppercase tracking-wider">
              <tr className="border-b border-border">
                <th className="text-left py-2 px-3 font-medium">#</th>
                <th className="text-left py-2 px-3 font-medium">Neighborhood</th>
                <th className="text-right py-2 px-3 font-medium">Mobility</th>
                <th className="text-right py-2 px-3 font-medium">Stops/km²</th>
                <th className="text-right py-2 px-3 font-medium">Avg wait</th>
                <th className="text-right py-2 px-3 font-medium">Income</th>
              </tr>
            </thead>
            <tbody>
              {[...hoods].sort((a, b) => b.mobilityScore - a.mobilityScore).map((h, i) => (
                <tr key={h.id} className="border-b border-border last:border-0 hover:bg-surface/40">
                  <td className="py-2 px-3 text-muted-foreground">{i + 1}</td>
                  <td className="py-2 px-3 font-medium">{h.name}</td>
                  <td className="py-2 px-3 text-right">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded ${colorForScore(h.mobilityScore)}`}>{h.mobilityScore}</span>
                  </td>
                  <td className="py-2 px-3 text-right">{h.stopDensity}</td>
                  <td className="py-2 px-3 text-right">{h.avgWait}m</td>
                  <td className="py-2 px-3 text-right capitalize text-muted-foreground">{h.income}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ChartCard>
    </div>
  );
}
