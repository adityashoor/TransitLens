import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useDaily, useHourly, useYearly, useRouteCompare, useHeatmap } from "@/mock/api";
import { PageSkeleton } from "@/components/ui-ext/Skeleton";
import { PageError } from "@/components/ui-ext/QueryError";
import { ChartCard, PageHeader } from "@/components/ui-ext/ChartCard";
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, Tooltip as RTooltip, CartesianGrid, Legend,
} from "recharts";
import { Download, Calendar, Filter, ChevronDown } from "lucide-react";
import { fmtCompact } from "@/lib/format";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

const RANGES = [7, 14, 30, 90] as const;

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
  const [days, setDays] = useState<number>(14);
  const [routeFilter, setRouteFilter] = useState<string>("all");

  const { data: daily = [], isLoading: loadDaily, isFetching: fetchDaily, isError: errDaily, refetch } = useDaily(days);
  const { data: hourly = [] } = useHourly();
  const { data: yearly = [] } = useYearly();
  const { data: cmp = [], isLoading: loadCmp } = useRouteCompare();
  const { data: hood = [] } = useHeatmap();
  if (loadDaily && loadCmp) return <PageSkeleton />;
  if (errDaily && !daily.length) return <PageError onRetry={refetch} />;

  const cmpFiltered = routeFilter === "all" ? cmp : cmp.filter((r) => r.name === routeFilter);
  const selectedRoute = cmp.find((r) => r.name === routeFilter);
  const routeLabel =
    routeFilter === "all"
      ? "All routes"
      : selectedRoute?.longName
        ? `${selectedRoute.name} · ${selectedRoute.longName}`
        : routeFilter;

  const exportCsv = () => {
    const csv = ["date,riders", ...daily.map((d) => `${d.date},${d.riders}`)].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `ridership-${days}d.csv`;
    a.click();
  };

  return (
    <div className="px-4 md:px-6 py-6 max-w-[1600px] mx-auto">
      <PageHeader
        title="Ridership Analytics"
        subtitle="Ridership estimates, CKAN delay-derived reliability, and public operating-stat trends"
        action={
          <div className="flex flex-wrap gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger className="h-9 px-3 rounded-lg glass-card text-xs flex items-center gap-2 outline-none focus:ring-2 focus:ring-ring/40">
                <Calendar className="size-3.5" /> Last {days} days
                {fetchDaily && <span className="size-1.5 rounded-full bg-primary animate-pulse" />}
                <ChevronDown className="size-3.5 opacity-60" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="min-w-40">
                <DropdownMenuLabel>Date range</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuRadioGroup value={String(days)} onValueChange={(v) => setDays(Number(v))}>
                  {RANGES.map((r) => (
                    <DropdownMenuRadioItem key={r} value={String(r)}>Last {r} days</DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger className="h-9 px-3 rounded-lg glass-card text-xs flex items-center gap-2 outline-none focus:ring-2 focus:ring-ring/40">
                <Filter className="size-3.5 shrink-0" />
                <span className="max-w-[140px] truncate">{routeLabel}</span>
                <ChevronDown className="size-3.5 opacity-60 shrink-0" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="min-w-48 max-h-72 overflow-y-auto scrollbar-thin">
                <DropdownMenuLabel>Route comparison</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuRadioGroup value={routeFilter} onValueChange={setRouteFilter}>
                  <DropdownMenuRadioItem value="all">All routes</DropdownMenuRadioItem>
                  {cmp.map((r) => (
                    <DropdownMenuRadioItem key={r.name} value={r.name}>
                      {r.longName ? `${r.name} · ${r.longName}` : r.name}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>

            <button onClick={exportCsv} className="h-9 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-medium flex items-center gap-2"><Download className="size-3.5" /> Export CSV</button>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <ChartCard title="Daily ridership" subtitle={`Last ${days} days · CKAN delay incidents → estimated riders`} className="lg:col-span-2 h-[320px]">
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

        <ChartCard title="Hourly pattern" subtitle="Estimated time-of-day ridership · Supabase or CKAN delay distribution" className="h-[320px]">
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
        <ChartCard title="Route comparison" subtitle={routeFilter === "all" ? "Estimated riders (k) vs CKAN on-time %" : `${routeLabel} · estimated riders (k) vs CKAN on-time %`} className="lg:col-span-2 h-[300px]">
          <ResponsiveContainer>
            <BarChart data={cmpFiltered}>
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

      <ChartCard title="Neighborhood heatmap" subtitle="Modeled stop-density intensity by hour">
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
