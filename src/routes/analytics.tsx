import { createFileRoute } from "@tanstack/react-router";
import { useDaily, useHourly, useYearly, useRouteCompare, useHeatmap } from "@/mock/api";
import { ChartCard, PageHeader } from "@/components/ui-ext/ChartCard";
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, Tooltip as RTooltip, CartesianGrid, Legend,
} from "recharts";
import { Download, Calendar, Filter } from "lucide-react";
import { fmtCompact } from "@/lib/format";

export const Route = createFileRoute("/analytics")({
  head: () => ({
    meta: [
      { title: "Ridership Analytics — TransitLens" },
      { name: "description", content: "Hourly, daily, and yearly TTC ridership analytics with route comparison and neighborhood heatmaps." },
    ],
  }),
  component: Analytics,
});

function Analytics() {
  const { data: daily = [] } = useDaily();
  const { data: hourly = [] } = useHourly();
  const { data: yearly = [] } = useYearly();
  const { data: cmp = [] } = useRouteCompare();
  const { data: hood = [] } = useHeatmap();

  const exportCsv = () => {
    const csv = ["date,riders", ...daily.map((d) => `${d.date},${d.riders}`)].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "ridership.csv";
    a.click();
  };

  return (
    <div className="px-4 md:px-6 py-6 max-w-[1600px] mx-auto">
      <PageHeader
        title="Ridership Analytics"
        subtitle="Drill down into TTC ridership patterns across time, route, and geography"
        action={
          <div className="flex flex-wrap gap-2">
            <button className="h-9 px-3 rounded-lg glass-card text-xs flex items-center gap-2"><Calendar className="size-3.5" /> Last 14 days</button>
            <button className="h-9 px-3 rounded-lg glass-card text-xs flex items-center gap-2"><Filter className="size-3.5" /> All routes</button>
            <button onClick={exportCsv} className="h-9 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-medium flex items-center gap-2"><Download className="size-3.5" /> Export CSV</button>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <ChartCard title="Daily ridership" subtitle="Last 14 days" className="lg:col-span-2 h-[320px]">
          <ResponsiveContainer>
            <BarChart data={daily}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => fmtCompact(v as number)} />
              <RTooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12 }} />
              <Bar dataKey="riders" fill="var(--electric)" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Hourly pattern" subtitle="Avg over last week" className="h-[320px]">
          <ResponsiveContainer>
            <LineChart data={hourly}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="hour" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => fmtCompact(v as number)} />
              <RTooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12 }} />
              <Line dataKey="riders" stroke="var(--cyan)" strokeWidth={2} dot={false} />
              <Line dataKey="predicted" stroke="var(--teal)" strokeWidth={2} strokeDasharray="4 4" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <ChartCard title="Route comparison" subtitle="Riders (k) vs on-time %" className="lg:col-span-2 h-[300px]">
          <ResponsiveContainer>
            <BarChart data={cmp}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis yAxisId="l" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis yAxisId="r" orientation="right" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
              <RTooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar yAxisId="l" dataKey="riders" fill="var(--electric)" radius={[6, 6, 0, 0]} />
              <Bar yAxisId="r" dataKey="onTime" fill="var(--cyan)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Yearly growth" subtitle="2024 vs 2025" className="h-[300px]">
          <ResponsiveContainer>
            <AreaChart data={yearly}>
              <defs>
                <linearGradient id="y1" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--electric)" stopOpacity={0.6} />
                  <stop offset="100%" stopColor="var(--electric)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="y2" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--cyan)" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="var(--cyan)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
              <RTooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12 }} />
              <Area dataKey="2024" stroke="var(--cyan)" fill="url(#y2)" strokeWidth={2} />
              <Area dataKey="2025" stroke="var(--electric)" fill="url(#y1)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <ChartCard title="Neighborhood heatmap" subtitle="Trip density by hour">
        <div className="overflow-x-auto scrollbar-thin">
          <div className="min-w-[800px]">
            <div className="flex text-[10px] text-muted-foreground pl-32 gap-px mb-1">
              {Array.from({ length: 24 }, (_, h) => (
                <div key={h} className="flex-1 text-center">{h}</div>
              ))}
            </div>
            {hood.map((row) => (
              <div key={row.name} className="flex items-center gap-px mb-px">
                <div className="w-32 text-xs truncate pr-2">{row.name}</div>
                {row.hours.map((v, i) => (
                  <div
                    key={i}
                    className="flex-1 h-6 rounded-sm"
                    style={{ background: `oklch(0.78 ${0.05 + (v / 100) * 0.2} 220 / ${0.15 + v / 130})` }}
                    title={`${row.name} · ${i}:00 · ${v}`}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </ChartCard>
    </div>
  );
}
