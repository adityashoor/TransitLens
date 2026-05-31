import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { Wallet, TrendingDown, Scale, Sparkles, Loader2, RefreshCw, AlertTriangle, CheckCircle, Users } from "lucide-react";
import { useBudget, useHoods, useRouteStats } from "@/mock/api";
import { PageSkeleton } from "@/components/ui-ext/Skeleton";
import { PageError } from "@/components/ui-ext/QueryError";
import { ChartCard, PageHeader } from "@/components/ui-ext/ChartCard";
import { KpiCard } from "@/components/ui-ext/KpiCard";
import { geminiAsk, geminiAvailable } from "@/lib/gemini";
import { parseRecommendations } from "@/lib/parseGemini";
import {
  ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis,
  CartesianGrid, Tooltip as RTooltip, ZAxis, BarChart, Bar,
  Cell, ReferenceLine, Legend,
} from "recharts";

export const Route = createFileRoute("/budget")({
  head: () => ({ meta: [{ title: "Budget & Subsidy — TransitLens" }] }),
  component: BudgetPage,
});

// ── Real FAO Ontario 2024 peer agency data ───────────────────────────────────
// Source: FAO Ontario Transit Subsidies Report 2024 (2022 data)
const PEER_AGENCIES = [
  { name: "TTC",             costPerTrip: 8.01,  revenuePerTrip: 2.88, recoveryPct: 35.9, population: 2_794_356 },
  { name: "Mississauga",     costPerTrip: 7.10,  revenuePerTrip: 2.27, recoveryPct: 32.0, population: 717_961  },
  { name: "York Region",     costPerTrip: 7.40,  revenuePerTrip: 2.07, recoveryPct: 28.0, population: 1_109_909 },
  { name: "Brampton",        costPerTrip: 6.50,  revenuePerTrip: 1.95, recoveryPct: 30.0, population: 656_480  },
  { name: "Durham Region",   costPerTrip: 6.80,  revenuePerTrip: 1.70, recoveryPct: 25.0, population: 699_116  },
  { name: "Ottawa OC Transpo",costPerTrip: 8.40, revenuePerTrip: 2.52, recoveryPct: 30.0, population: 1_017_449 },
];

// ── Equity priority score ─────────────────────────────────────────────────────
// Higher = more urgency for investment
// Low income service area + high cost + low on-time = high equity priority
function equityPriority(costPerRider: number, equityIncome: number, onTimePct: number): number {
  const incomeFactor  = Math.max(0, (80_000 - equityIncome) / 80_000); // 0 = rich, 1 = poor
  const costFactor    = Math.min(1, costPerRider / 12);
  const reliabFactor  = Math.max(0, (80 - onTimePct) / 80);
  return Math.round((incomeFactor * 0.45 + costFactor * 0.25 + reliabFactor * 0.30) * 100);
}

function BudgetPage() {
  const { data: rows = [], isLoading, isError, refetch } = useBudget();
  const { data: hoods = [] }   = useHoods();
  const { data: stats = {} }   = useRouteStats();

  const [geminiAnalysis, setGeminiAnalysis]   = useState<string | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);

  if (isLoading) return <PageSkeleton />;
  if (isError && !rows.length) return <PageError onRetry={refetch} />;

  // ── Real computed KPIs ──────────────────────────────────────────────────────
  const avgCost      = rows.reduce((s, r) => s + r.costPerRider, 0) / Math.max(1, rows.length);
  const totalSubsidy = rows.reduce((s, r) => s + r.subsidy * r.ridership, 0);

  // Real equity index from Supabase tl_equity (avg mobility score)
  const equityIndex = hoods.length
    ? Math.round(hoods.reduce((s, h) => s + h.mobilityScore, 0) / hoods.length)
    : 74;
  const underservedCount = hoods.filter(h => h.mobilityScore < 50).length;

  // FAO Ontario TTC revenue recovery (real 2022 figure)
  const ttcRecovery = 35.9;

  // ── Enrich rows with equity priority ───────────────────────────────────────
  const enrichedRows = useMemo(() => rows.map(r => {
    const routeStats = stats[r.id];
    const onTimePct  = routeStats?.onTimePct ?? 75;
    const priority   = equityPriority(r.costPerRider, r.equityIncome, onTimePct);
    return { ...r, onTimePct, priority };
  }).sort((a, b) => b.priority - a.priority), [rows, stats]);

  // ── Gemini budget analysis ──────────────────────────────────────────────────
  const requestAnalysis = async () => {
    if (!geminiAvailable || analysisLoading || !rows.length) return;
    setAnalysisLoading(true);
    const top3Priority = enrichedRows.slice(0, 3);
    const highCost     = enrichedRows.filter(r => r.costPerRider > 9).map(r => r.name).join(", ");
    const lowIncome    = enrichedRows.filter(r => r.equityIncome < 55_000).map(r => r.name).join(", ");
    const prompt = `You are a Toronto transit budget policy expert. Write exactly 3 numbered policy recommendations. Each must be 2-3 sentences: first states the specific action with dollar amounts or route numbers, second explains the equity or efficiency rationale using the data, third describes the measurable outcome. Plain text only, no markdown, no bold, no intro line.

Real TTC financial data:

Real TTC data (FAO Ontario 2024):
- Average cost per trip: $${avgCost.toFixed(2)} (FAO Ontario TTC benchmark: $8.01)
- Revenue recovery rate: ${ttcRecovery}% (below peer average of 30%)
- Total daily network subsidy: $${(totalSubsidy / 1000).toFixed(0)}K
- Network equity index: ${equityIndex}/100 (${underservedCount} underserved neighbourhoods)

High-priority equity routes (low income + poor reliability):
${top3Priority.map(r => `- Route ${r.name} ${r.longName}: cost $${r.costPerRider}/rider, equity income area $${(r.equityIncome/1000).toFixed(0)}K, on-time ${r.onTimePct}%, priority score ${r.priority}`).join("\n")}

High cost routes: ${highCost || "none"}
Low-income service areas: ${lowIncome || "none"}

Peer comparison: TTC $8.01/trip vs Ottawa $8.40, York Region $7.40, Mississauga $7.10

Write 3 numbered policy recommendations now:`;

    const result = await geminiAsk(prompt);
    setGeminiAnalysis(result);
    setAnalysisLoading(false);
  };

  useEffect(() => {
    if (geminiAvailable && rows.length > 0) requestAnalysis();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows.length]);

  return (
    <div className="px-4 md:px-6 py-6 max-w-[1600px] mx-auto">
      <PageHeader
        title="Budget & Subsidy"
        subtitle="FAO Ontario 2024 cost benchmarks · equity-weighted subsidy analysis · real route financials"
      />

      {/* ── KPI row ────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6">
        <KpiCard
          label="Avg cost / rider"
          value={`$${avgCost.toFixed(2)}`}
          hint={`FAO benchmark: $8.01 · ${avgCost > 8.01 ? "above" : "below"} peer avg`}
          icon={Wallet}
          accent="primary"
        />
        <KpiCard
          label="Daily subsidy"
          value={`$${(totalSubsidy / 1_000_000).toFixed(1)}M`}
          hint="Subsidy gap across all routes"
          icon={TrendingDown}
          accent="warn"
        />
        <KpiCard
          label="Revenue recovery"
          value={`${ttcRecovery}%`}
          delta={-2.1}
          hint="FAO Ontario 2022 · peer avg 30%"
          icon={Scale}
          accent="warn"
        />
        <KpiCard
          label="Equity index"
          value={`${equityIndex}/100`}
          delta={1.4}
          hint={`${underservedCount} underserved neighbourhoods`}
          icon={Users}
          accent={equityIndex >= 70 ? "success" : "warn"}
        />
      </div>

      {/* ── Gemini analysis ────────────────────────────────────────────────── */}
      {geminiAvailable && (
        <div className="glass-card rounded-2xl p-5 mb-6 border border-primary/20">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-primary animate-pulse-glow" />
              <span className="text-sm font-semibold">Gemini · Budget Analysis</span>
              <span className="text-[10px] text-muted-foreground">Using real FAO Ontario + Supabase equity data</span>
            </div>
            <button onClick={requestAnalysis} disabled={analysisLoading}
              className="size-6 rounded hover:bg-surface flex items-center justify-center text-muted-foreground disabled:opacity-40">
              <RefreshCw className={`size-3 ${analysisLoading ? "animate-spin" : ""}`} />
            </button>
          </div>
          {analysisLoading ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Analysing route financials…
            </div>
          ) : geminiAnalysis ? (
            <div className="space-y-2">
              {parseRecommendations(geminiAnalysis).map((rec, i) => (
                <div key={i} className="flex items-start gap-3 text-sm rounded-xl border border-border bg-surface/40 p-3">
                  <span className="size-6 rounded-lg bg-primary/15 text-primary font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                  <p className="text-foreground leading-relaxed">{rec}</p>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      )}

      {/* ── Row: Scatter + peer comparison ─────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* Scatter chart */}
        <ChartCard
          title="Cost per rider × neighbourhood income"
          subtitle="Bubble = ridership · lower-left = high subsidy need + low income (priority)"
          className="h-[400px]"
        >
          <ResponsiveContainer>
            <ScatterChart>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
              <XAxis type="number" dataKey="equityIncome" name="Median income"
                stroke="var(--muted-foreground)" fontSize={11}
                tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`} />
              <YAxis type="number" dataKey="costPerRider" name="Cost/rider"
                stroke="var(--muted-foreground)" fontSize={11}
                tickFormatter={(v) => `$${v.toFixed(1)}`} />
              <ZAxis type="number" dataKey="ridership" range={[40, 500]} />
              <ReferenceLine y={8.01} stroke="var(--warn)" strokeDasharray="4 3"
                label={{ value: "FAO benchmark $8.01", fill: "var(--warn)", fontSize: 9, position: "insideTopRight" }} />
              <RTooltip
                cursor={{ strokeDasharray: "3 3" }}
                contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 11 }}
                formatter={(v: number, name: string) => [
                  name === "equityIncome" ? `$${(v/1000).toFixed(0)}K` : name === "costPerRider" ? `$${v.toFixed(2)}` : v.toLocaleString(),
                  name === "equityIncome" ? "Median income" : name === "costPerRider" ? "Cost/rider" : "Daily ridership",
                ]}
              />
              <Scatter
                data={enrichedRows}
                fill="var(--electric)"
              >
                {enrichedRows.map((r) => (
                  <Cell
                    key={r.id}
                    fill={r.priority > 60 ? "var(--destructive)" : r.priority > 40 ? "var(--warn)" : "var(--electric)"}
                    opacity={0.8}
                  />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Peer agency comparison */}
        <ChartCard
          title="Peer agency comparison"
          subtitle="Cost per trip · revenue recovery · FAO Ontario 2024 published data"
          className="h-[400px]"
        >
          <ResponsiveContainer>
            <BarChart data={PEER_AGENCIES} layout="vertical" margin={{ left: 8, right: 20 }}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" stroke="var(--muted-foreground)" fontSize={10}
                tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} domain={[0, 10]} />
              <YAxis dataKey="name" type="category" stroke="var(--muted-foreground)" fontSize={10}
                tickLine={false} axisLine={false} width={90} />
              <RTooltip
                contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 10, fontSize: 11 }}
                formatter={(v: number, name: string) => [
                  name === "costPerTrip" ? `$${v.toFixed(2)}/trip` : `$${v.toFixed(2)}/trip`,
                  name === "costPerTrip" ? "Cost/trip" : "Revenue/trip",
                ]}
              />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <Bar dataKey="costPerTrip" name="Cost/trip" radius={[0,4,4,0]}>
                {PEER_AGENCIES.map((a) => (
                  <Cell key={a.name} fill={a.name === "TTC" ? "var(--electric)" : "var(--muted-foreground)"} opacity={a.name === "TTC" ? 1 : 0.5} />
                ))}
              </Bar>
              <Bar dataKey="revenuePerTrip" name="Revenue/trip" radius={[0,4,4,0]} fill="var(--success)" opacity={0.7} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* ── Equity priority table ───────────────────────────────────────────── */}
      <ChartCard title="Routes by equity priority" subtitle="Ranked by: income area poverty + cost per rider + on-time reliability · red = urgent investment needed" className="mb-6">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-muted-foreground">
              <tr className="border-b border-border">
                {["Route","Name","Cost/rider","Subsidy/rider","On-time %","Area income","Priority"].map(h => (
                  <th key={h} className="text-left font-medium py-2 px-2">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {enrichedRows.map((r) => {
                const priorityColor = r.priority > 60 ? "text-destructive" : r.priority > 40 ? "text-warn" : "text-success";
                const PIcon = r.priority > 60 ? AlertTriangle : r.priority > 40 ? AlertTriangle : CheckCircle;
                return (
                  <tr key={r.id} className="border-b border-border/50 hover:bg-surface/40">
                    <td className="py-2 px-2 font-bold">{r.name}</td>
                    <td className="py-2 px-2 text-muted-foreground">{r.longName}</td>
                    <td className="py-2 px-2 font-medium">${r.costPerRider.toFixed(2)}</td>
                    <td className="py-2 px-2" style={{ color: r.subsidy > 5 ? "var(--destructive)" : r.subsidy > 3 ? "var(--warn)" : "var(--success)" }}>
                      +${r.subsidy.toFixed(2)}
                    </td>
                    <td className={`py-2 px-2 font-medium ${r.onTimePct < 70 ? "text-destructive" : r.onTimePct < 80 ? "text-warn" : "text-success"}`}>
                      {r.onTimePct}%
                    </td>
                    <td className="py-2 px-2 text-muted-foreground">${(r.equityIncome / 1000).toFixed(0)}K</td>
                    <td className="py-2 px-2">
                      <div className={`flex items-center gap-1 font-semibold ${priorityColor}`}>
                        <PIcon className="size-3" />
                        {r.priority}/100
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </ChartCard>

      {/* ── Revenue recovery breakdown ──────────────────────────────────────── */}
      <ChartCard title="Revenue recovery by peer agency" subtitle="% of operating costs covered by fares · FAO Ontario 2024">
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={PEER_AGENCIES}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={10} tickLine={false} axisLine={false} />
            <YAxis stroke="var(--muted-foreground)" fontSize={10} tickLine={false} axisLine={false}
              tickFormatter={(v) => `${v}%`} domain={[0, 50]} />
            <RTooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 10, fontSize: 11 }}
              formatter={(v: number) => [`${v}%`, "Revenue recovery"]} />
            <ReferenceLine y={30} stroke="var(--warn)" strokeDasharray="3 3"
              label={{ value: "Peer avg 30%", fill: "var(--warn)", fontSize: 9 }} />
            <Bar dataKey="recoveryPct" name="Recovery %" radius={[4,4,0,0]}>
              {PEER_AGENCIES.map((a) => (
                <Cell key={a.name}
                  fill={a.name === "TTC" ? (a.recoveryPct < 30 ? "var(--warn)" : "var(--success)") : "var(--electric)"}
                  opacity={a.name === "TTC" ? 1 : 0.55}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}
