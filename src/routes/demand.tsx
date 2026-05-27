import { createFileRoute } from "@tanstack/react-router";
import { Network, TrendingUp, ArrowRightLeft } from "lucide-react";
import { useOdPairs } from "../mock/api";
import { ChartCard, PageHeader } from "../components/ui-ext/ChartCard";
import { KpiCard } from "../components/ui-ext/KpiCard";
import { fmtCompact } from "../lib/format";

export const Route = createFileRoute("/demand")({
  component: DemandPage,
});

function DemandPage() {
  const { data: pairs = [] } = useOdPairs();
  const hubs = Array.from(new Set(pairs.flatMap((p) => [p.from, p.to])));
  const matrix: Record<string, Record<string, { riders: number; shift: number }>> = {};
  hubs.forEach((h) => (matrix[h] = {}));
  pairs.forEach((p) => (matrix[p.from][p.to] = { riders: p.riders, shift: p.shift }));

  const max = Math.max(...pairs.map((p) => p.riders), 1);
  const totalTrips = pairs.reduce((s, p) => s + p.riders, 0);
  const top = [...pairs].sort((a, b) => b.riders - a.riders).slice(0, 6);
  const surging = [...pairs].sort((a, b) => b.shift - a.shift).slice(0, 6);

  return (
    <div className="px-4 md:px-6 py-6 max-w-[1600px] mx-auto">
      <PageHeader title="Origin–Destination Demand" subtitle="Presto tap-pair flows · AI demand-shift detection" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6">
        <KpiCard label="Tap pairs / hr" value={fmtCompact(totalTrips)} delta={5.2} icon={ArrowRightLeft} accent="primary" />
        <KpiCard label="Hubs analyzed" value={hubs.length} format="raw" icon={Network} accent="cyan" />
        <KpiCard label="Top surge" value={`+${Math.max(...pairs.map((p) => p.shift))}%`} icon={TrendingUp} accent="success" />
        <KpiCard label="Top decline" value={`${Math.min(...pairs.map((p) => p.shift))}%`} icon={TrendingUp} accent="warn" />
      </div>

      <ChartCard title="OD heatmap" subtitle="Rider volume between hubs · brighter = busier" className="mb-6">
        <div className="overflow-x-auto">
          <div className="inline-block min-w-full">
            <div className="grid" style={{ gridTemplateColumns: `120px repeat(${hubs.length}, minmax(60px, 1fr))` }}>
              <div />
              {hubs.map((h) => <div key={h} className="text-[10px] text-muted-foreground p-2 text-center truncate">{h}</div>)}
              {hubs.map((from) => (
                <>
                  <div key={`r-${from}`} className="text-[10px] text-muted-foreground p-2 truncate">{from}</div>
                  {hubs.map((to) => {
                    const cell = matrix[from]?.[to];
                    if (!cell) return <div key={`${from}-${to}`} className="aspect-square m-0.5 rounded bg-surface/30" />;
                    const intensity = cell.riders / max;
                    return (
                      <div key={`${from}-${to}`}
                           title={`${from} → ${to}: ${cell.riders} riders (${cell.shift > 0 ? "+" : ""}${cell.shift}%)`}
                           className="aspect-square m-0.5 rounded flex items-center justify-center text-[9px] font-medium"
                           style={{ background: `oklch(0.72 ${0.05 + intensity * 0.2} 240 / ${0.15 + intensity * 0.85})`, color: intensity > 0.5 ? "white" : "var(--muted-foreground)" }}>
                        {Math.round(cell.riders / 100) / 10}k
                      </div>
                    );
                  })}
                </>
              ))}
            </div>
          </div>
        </div>
      </ChartCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Top corridors" subtitle="By rider volume">
          <ul className="space-y-2">
            {top.map((p) => (
              <li key={`${p.from}-${p.to}`} className="rounded-xl border border-border bg-surface/40 p-3 flex items-center gap-3">
                <div className="flex-1 text-sm">{p.from} <ArrowRightLeft className="size-3 inline mx-2 text-muted-foreground" /> {p.to}</div>
                <div className="text-sm font-semibold">{fmtCompact(p.riders)}</div>
              </li>
            ))}
          </ul>
        </ChartCard>
        <ChartCard title="AI: surging corridors" subtitle="Largest 7-day demand shifts">
          <ul className="space-y-2">
            {surging.map((p) => (
              <li key={`${p.from}-${p.to}`} className="rounded-xl border border-border bg-surface/40 p-3 flex items-center gap-3">
                <div className="flex-1 text-sm">{p.from} → {p.to}</div>
                <div className="text-sm font-semibold text-success">+{p.shift}%</div>
              </li>
            ))}
          </ul>
        </ChartCard>
      </div>
    </div>
  );
}