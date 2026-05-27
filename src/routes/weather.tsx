import { createFileRoute } from "@tanstack/react-router";
import { CloudSnow, CloudRain, Sun, Cloud, Zap } from "lucide-react";
import { useWeather } from "../mock/api";
import { ChartCard, PageHeader } from "../components/ui-ext/ChartCard";
import { KpiCard } from "../components/ui-ext/KpiCard";
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, Legend,
} from "recharts";
import { fmtCompact } from "../lib/format";

export const Route = createFileRoute("/weather")({
  component: WeatherPage,
});

const icons = { Clear: Sun, Cloudy: Cloud, Rain: CloudRain, Snow: CloudSnow, Storm: Zap };

function WeatherPage() {
  const { data: w = [] } = useWeather();
  const avg = Math.round(w.reduce((s, d) => s + d.ridership, 0) / Math.max(1, w.length));
  const worst = w.reduce((m, d) => (d.ridership < m.ridership ? d : m), w[0] ?? { condition: "—", ridership: 0 });

  return (
    <div className="px-4 md:px-6 py-6 max-w-[1600px] mx-auto">
      <PageHeader title="Weather Impact" subtitle="Environment Canada × ridership · 14d" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6">
        <KpiCard label="Avg daily ridership" value={fmtCompact(avg)} icon={Sun} accent="primary" />
        <KpiCard label="Worst weather day" value={worst?.condition ?? "—"} icon={CloudSnow} accent="warn" />
        <KpiCard label="Snow-day predicted drop" value="-26%" icon={CloudSnow} accent="warn" />
        <KpiCard label="Forecast confidence" value="91%" icon={Zap} accent="success" />
      </div>

      <ChartCard title="Ridership vs precipitation" subtitle="Bars: precipitation (mm) · Line: ridership" className="mb-6">
        <ResponsiveContainer width="100%" height={340}>
          <ComposedChart data={w}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="day" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
            <YAxis yAxisId="left" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
            <YAxis yAxisId="right" orientation="right" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => fmtCompact(v as number)} />
            <RTooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12 }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar yAxisId="left" dataKey="precip" fill="var(--cyan)" radius={[6, 6, 0, 0]} />
            <Line yAxisId="right" dataKey="ridership" stroke="var(--electric)" strokeWidth={2} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Daily forecast" subtitle="AI-blended Environment Canada model">
        <div className="grid grid-cols-2 md:grid-cols-7 gap-2">
          {w.map((d) => {
            const Icon = icons[d.condition];
            return (
              <div key={d.day} className="rounded-xl border border-border bg-surface/40 p-3 text-center">
                <div className="text-[10px] text-muted-foreground">{d.day}</div>
                <Icon className="size-6 mx-auto my-2 text-cyan" />
                <div className="text-sm font-semibold">{d.temp}°C</div>
                <div className="text-[10px] text-muted-foreground">{d.condition}</div>
                <div className="text-[10px] mt-1 text-electric">{fmtCompact(d.ridership)}</div>
              </div>
            );
          })}
        </div>
      </ChartCard>
    </div>
  );
}