import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Sparkles, Brain, Cloud, AlertOctagon, Activity, HelpCircle } from "lucide-react";
import { ChartCard, PageHeader } from "@/components/ui-ext/ChartCard";
import { DataCard } from "@/components/ui-ext/DataCard";
import { useAiCards, usePredictions } from "@/mock/api";
import { SCENARIO_META } from "@/mock/predictions";
import { useUI } from "@/store/ui";
import { ScenarioChips } from "@/components/predictions/ScenarioChips";
import { WhyDrawer } from "@/components/predictions/WhyDrawer";
import { ModelCard } from "@/components/predictions/ModelCard";
import {
  ResponsiveContainer, ComposedChart, Area, Line, XAxis, YAxis, Tooltip as RTooltip, CartesianGrid, ReferenceLine,
} from "recharts";

export const Route = createFileRoute("/predictions")({
  head: () => ({
    meta: [
      { title: "AI Predictions — TransitLens" },
      { name: "description", content: "AI-generated forecasts with confidence bands, scenario simulation, feature attributions, and a transparent model card." },
    ],
  }),
  component: Predictions,
});

function Gauge({ label, value, color }: { label: string; value: number; color: string }) {
  const dash = 264;
  const offset = dash - (dash * value) / 100;
  return (
    <div className="glass-card rounded-2xl p-5 flex items-center gap-4">
      <svg width="100" height="100" viewBox="0 0 100 100" className="shrink-0">
        <circle cx="50" cy="50" r="42" stroke="var(--border)" strokeWidth="8" fill="none" />
        <motion.circle
          cx="50" cy="50" r="42" fill="none" stroke={color} strokeWidth="8"
          strokeLinecap="round" strokeDasharray={dash} initial={{ strokeDashoffset: dash }}
          animate={{ strokeDashoffset: offset }} transition={{ duration: 1.2, ease: "easeOut" }}
          transform="rotate(-90 50 50)"
        />
        <text x="50" y="56" textAnchor="middle" fill="var(--foreground)" fontSize="20" fontWeight="600">{value}</text>
      </svg>
      <div>
        <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="text-sm font-medium mt-1">
          {value >= 85 ? "Excellent" : value >= 70 ? "Good" : value >= 50 ? "Fair" : "Low"}
        </div>
      </div>
    </div>
  );
}

function Predictions() {
  const { data: cards = [] } = useAiCards();
  const { data: timeline = [] } = usePredictions();
  const { scenario } = useUI();
  const [whyOpen, setWhyOpen] = useState(false);

  const meta = SCENARIO_META[scenario];

  // Apply scenario to timeline (transform forecast + band)
  const data = useMemo(
    () =>
      timeline.map((p) => ({
        ...p,
        forecast: +(p.forecast * meta.ridershipMult).toFixed(1),
        upper: +(p.upper * meta.ridershipMult + meta.delayMin * 0.4).toFixed(1),
        lower: +(p.lower * meta.ridershipMult - meta.delayMin * 0.4).toFixed(1),
      })),
    [timeline, meta],
  );

  const iconMap = { users: Brain, activity: Activity, alert: AlertOctagon, cloud: Cloud } as const;

  return (
    <div className="px-4 md:px-6 py-6 max-w-[1600px] mx-auto">
      <PageHeader
        title="AI Predictions"
        subtitle="Forecast horizon · next 24 hours · model v3.2"
        action={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setWhyOpen(true)}
              className="px-3 h-9 rounded-xl bg-surface/60 border border-border text-xs inline-flex items-center gap-1.5 hover:bg-surface"
            >
              <HelpCircle className="size-3.5 text-primary" /> Why this prediction?
            </button>
            <div className="flex items-center gap-2 px-3 h-9 rounded-xl glass-card text-xs">
              <Sparkles className="size-3.5 text-primary animate-pulse-glow" />
              AI live · 12s ago
            </div>
          </div>
        }
      />

      <DataCard
        title="Scenario simulation"
        subtitle={meta.description}
        className="mb-4"
      >
        <ScenarioChips />
        {scenario !== "baseline" && (
          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label="Ridership" value={`${((meta.ridershipMult - 1) * 100 >= 0 ? "+" : "")}${Math.round((meta.ridershipMult - 1) * 100)}%`} positive={meta.ridershipMult >= 1} />
            <Stat label="Congestion" value={`+${meta.congestionDelta}`} positive={false} />
            <Stat label="Avg added delay" value={`+${meta.delayMin} min`} positive={false} />
            <Stat label="Hot zones" value={meta.hotZones.slice(0, 2).join(", ") || "—"} />
          </div>
        )}
      </DataCard>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <Gauge label="AI Confidence" value={92} color="var(--electric)" />
        <Gauge label="Prediction Accuracy" value={87} color="var(--cyan)" />
        <Gauge label="Forecast Risk" value={28 + meta.congestionDelta} color="var(--warn)" />
      </div>

      <ChartCard
        title="24h forecast"
        subtitle="Demand index with p10–p90 confidence band"
        className="h-[380px] mb-4"
        action={
          <button onClick={() => setWhyOpen(true)} className="text-xs text-primary hover:underline inline-flex items-center gap-1">
            <HelpCircle className="size-3" /> Explain
          </button>
        }
      >
        <ResponsiveContainer>
          <ComposedChart data={data}>
            <defs>
              <linearGradient id="band-up" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--electric)" stopOpacity={0.35} />
                <stop offset="100%" stopColor="var(--electric)" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="t" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
            <YAxis stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
            <RTooltip
              contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12 }}
              formatter={(v: number, name) => [v, name === "forecast" ? "Forecast" : name === "upper" ? "p90" : "p10"]}
            />
            <ReferenceLine y={70} stroke="var(--warn)" strokeDasharray="3 3" label={{ value: "High demand", fill: "var(--warn)", fontSize: 10, position: "insideTopLeft" }} />
            <Area dataKey="upper" stroke="none" fill="url(#band-up)" />
            <Area dataKey="lower" stroke="none" fill="var(--background)" />
            <Line dataKey="forecast" stroke="var(--electric)" strokeWidth={2.5} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartCard>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-4">
        {cards.map((c, i) => {
          const Icon = iconMap[c.icon as keyof typeof iconMap] ?? Brain;
          return (
            <motion.div
              key={c.title}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              className="glass-card rounded-2xl p-5 relative overflow-hidden"
            >
              <div className="absolute -top-10 -right-10 size-32 rounded-full bg-primary/20 blur-3xl" />
              <div className="flex items-center justify-between relative">
                <div className="size-10 rounded-xl bg-primary/15 border border-border flex items-center justify-center">
                  <Icon className="size-5 text-primary" />
                </div>
                <span className="size-2 rounded-full bg-primary animate-pulse-glow" />
              </div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground mt-3">{c.title}</div>
              <div className="text-2xl font-semibold mt-1">{c.value}</div>
              <div className="text-xs text-muted-foreground mt-1">{c.hint}</div>
            </motion.div>
          );
        })}
      </div>

      <ModelCard />

      <WhyDrawer open={whyOpen} onClose={() => setWhyOpen(false)} />
    </div>
  );
}

function Stat({ label, value, positive }: { label: string; value: string; positive?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-surface/40 p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`text-base font-semibold mt-1 ${positive === true ? "text-success" : positive === false ? "text-warn" : ""}`}>
        {value}
      </div>
    </div>
  );
}
