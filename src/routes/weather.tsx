import { createFileRoute } from "@tanstack/react-router";
import { CloudSnow, CloudRain, Sun, Cloud, Zap, Wind, Droplets } from "lucide-react";
import { useWeather } from "@/mock/api";
import { ChartCard, PageHeader } from "@/components/ui-ext/ChartCard";
import { KpiCard } from "@/components/ui-ext/KpiCard";
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip as RTooltip, Legend,
} from "recharts";

export const Route = createFileRoute("/weather")({
  head: () => ({ meta: [{ title: "Weather Impact — TransitLens" }] }),
  component: WeatherPage,
});

// Map Open-Meteo condition strings → icon (fallback to Cloud)
function conditionIcon(condition: string) {
  const c = condition.toLowerCase();
  if (c.includes("thunder") || c.includes("storm")) return Zap;
  if (c.includes("snow"))   return CloudSnow;
  if (c.includes("rain") || c.includes("drizzle") || c.includes("shower")) return CloudRain;
  if (c.includes("fog"))    return Droplets;
  if (c.includes("clear"))  return Sun;
  if (c.includes("wind"))   return Wind;
  return Cloud;
}

// Estimate ridership impact from precipitation probability
function precipToRidership(precip: number) {
  // baseline ~60 000/hr, drops ~30% in heavy rain
  return Math.round(60_000 * (1 - precip / 100 * 0.3));
}

function WeatherPage() {
  const { data: w = [] } = useWeather();

  // Real data shape: { time, temp, precip, wind, condition, impact }
  const enriched = w.map((d) => ({
    ...d,
    ridership: precipToRidership(d.precip ?? 0),
    label: d.time ?? "",
  }));

  const avg = Math.round(
    enriched.reduce((s, d) => s + d.ridership, 0) / Math.max(1, enriched.length)
  );
  const worst = enriched.reduce(
    (m, d) => (d.precip > m.precip ? d : m),
    enriched[0] ?? { condition: "—", precip: 0 }
  );
  const avgTemp = enriched.length
    ? Math.round(enriched.reduce((s, d) => s + (d.temp ?? 0), 0) / enriched.length)
    : "—";
  const highImpact = enriched.filter((d) => d.impact === "High").length;

  // Show every 3rd hour for readability
  const chartData = enriched.filter((_, i) => i % 3 === 0);

  return (
    <div className="px-4 md:px-6 py-6 max-w-[1600px] mx-auto">
      <PageHeader title="Weather Impact" subtitle="Open-Meteo · 48-hour Toronto forecast × ridership model" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6">
        <KpiCard label="Avg ridership/hr" value={avg.toLocaleString()} icon={Sun} accent="primary" />
        <KpiCard label="Worst condition" value={worst?.condition ?? "—"} icon={CloudSnow} accent="warn" />
        <KpiCard label="Avg temperature" value={`${avgTemp}°C`} icon={Cloud} accent="info" />
        <KpiCard label="High-impact hours" value={`${highImpact}`} icon={Zap} accent="danger" />
      </div>

      <ChartCard title="Precipitation vs ridership (48h)" subtitle="Bars: precipitation % · Line: estimated ridership" className="mb-6">
        <ResponsiveContainer width="100%" height={340}>
          <ComposedChart data={chartData}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
            <YAxis yAxisId="left" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} domain={[0, 100]} unit="%" />
            <YAxis yAxisId="right" orientation="right" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false}
              tickFormatter={(v) => `${Math.round((v as number) / 1000)}k`} />
            <RTooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12 }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar yAxisId="left" dataKey="precip" name="Precip %" fill="var(--cyan)" radius={[6, 6, 0, 0]} />
            <Line yAxisId="right" dataKey="ridership" name="Ridership" stroke="var(--electric)" strokeWidth={2} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="48-hour forecast" subtitle="Hourly breakdown — scroll to see all">
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-8 gap-2 overflow-x-auto">
          {enriched.map((d, i) => {
            const Icon = conditionIcon(d.condition ?? "");
            const impactColor =
              d.impact === "High" ? "text-red-400" :
              d.impact === "Medium" ? "text-yellow-400" : "text-emerald-400";
            return (
              <div key={i} className="rounded-xl border border-border bg-surface/40 p-3 text-center min-w-[72px]">
                <div className="text-[10px] text-muted-foreground">{d.time}</div>
                <Icon className="size-5 mx-auto my-1.5 text-cyan" />
                <div className="text-sm font-semibold">{d.temp}°C</div>
                <div className="text-[9px] text-muted-foreground leading-tight">{d.condition}</div>
                <div className={`text-[9px] mt-1 font-medium ${impactColor}`}>{d.impact}</div>
                <div className="text-[9px] text-muted-foreground">{d.precip}% rain</div>
              </div>
            );
          })}
        </div>
      </ChartCard>
    </div>
  );
}
