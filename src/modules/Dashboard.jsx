import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useApi } from "../hooks/useApi";
import { api, compactNumber, formatNumber } from "../services/api";
import { Badge, Card, CardHeader, Icon, KPI, PageHeader, Skeleton } from "../components/ui";
import { chartTooltip } from "../components/chartConfig";

function buildPredictionWindow() {
  const start = new Date();
  start.setHours(7, 0, 0, 0);
  const end = new Date(start);
  end.setHours(20, 0, 0, 0);
  return { start: start.toISOString(), end: end.toISOString() };
}

export default function Dashboard() {
  const health = useApi(api.health, [], {});
  const routes = useApi(api.routes, [], []);
  const surface = useApi(() => api.surfaceRidership(10), [], []);
  const equity = useApi(() => api.equity("lowest", 10), [], []);
  const prediction = useApi(() => api.prediction({ routeId: "504", ...buildPredictionWindow() }), [], null);

  const routeCount = routes.data?.length || 0;
  const topRidership = surface.data?.[0]?.all_day_riders || 0;
  const avgEquity = equity.data?.length ? equity.data.reduce((sum, row) => sum + row.score, 0) / equity.data.length : 0;
  const modelName = prediction.data?.model?.replaceAll("_", " ") || "Loading model";
  const predictionRows = prediction.data?.points?.map((point) => ({
    time: new Date(point.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    riders: Math.round(point.predicted_riders),
    low: Math.round(point.lower_bound),
    high: Math.round(point.upper_bound),
  })) || [];

  return (
    <section>
      <PageHeader
        title="Transit Intelligence Dashboard"
        subtitle="A production dashboard for TTC service, equity, ridership forecasting, and disruption resilience."
        action={<Badge color={health.error ? "red" : "green"}>{health.error ? "API degraded" : "Backend connected"}</Badge>}
      />

      <div className="mb-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KPI label="Routes" value={routeCount || "-"} hint="Current GTFS feed" tone="brand" icon={<Icon name="route" />} />
        <KPI label="Top Surface Riders" value={compactNumber(topRidership)} hint={surface.data?.[0]?.route_name || "Loading"} tone="green" icon={<Icon name="people" />} />
        <KPI label="Lowest Equity Avg" value={avgEquity ? avgEquity.toFixed(1) : "-"} hint="10 most urgent areas" tone="amber" icon={<Icon name="equity" />} />
        <KPI label="Model" value={prediction.data?.model_metrics?.r2?.toFixed?.(3) || "-"} hint="Test R-squared" tone="teal" icon={<Icon name="chart" />} />
      </div>

      <div className="mb-5 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Route 504 Forecast" subtitle={modelName} action={<Badge color="brand">Live prediction</Badge>} />
          <div className="card-pad">
            {prediction.loading ? <Skeleton /> : (
              <ResponsiveContainer width="100%" height={275}>
                <AreaChart data={predictionRows} margin={{ top: 6, right: 12, left: -8, bottom: 0 }}>
                  <defs>
                    <linearGradient id="forecastFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6259ca" stopOpacity={0.24} />
                      <stop offset="95%" stopColor="#6259ca" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#edf0f7" strokeDasharray="3 3" />
                  <XAxis dataKey="time" tick={{ fontSize: 11, fill: "#6f7a8d" }} />
                  <YAxis tick={{ fontSize: 11, fill: "#6f7a8d" }} />
                  <Tooltip {...chartTooltip} />
                  <Area dataKey="riders" stroke="#6259ca" fill="url(#forecastFill)" strokeWidth={2.5} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Equity Watchlist" subtitle="Lowest scoring neighbourhoods" />
          <div className="divide-y divide-[var(--line)]">
            {(equity.data || []).slice(0, 6).map((area) => (
              <div key={area.geography_id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">{area.geography_name}</p>
                  <p className="text-xs text-[var(--muted)]">Income ${formatNumber(area.median_income)} · {area.distance_to_stop}m to stop</p>
                </div>
                <Badge color={area.score < 40 ? "red" : "amber"}>{area.score}</Badge>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader title="Surface Ridership" subtitle="Highest all-day surface routes" />
          <div className="card-pad">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={surface.data || []} layout="vertical" margin={{ left: 44, right: 18 }}>
                <CartesianGrid stroke="#edf0f7" strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: "#6f7a8d" }} />
                <YAxis type="category" dataKey="route_name" width={108} tick={{ fontSize: 11, fill: "#6f7a8d" }} />
                <Tooltip {...chartTooltip} formatter={(value) => formatNumber(value)} />
                <Bar dataKey="all_day_riders" radius={[0, 6, 6, 0]}>
                  {(surface.data || []).map((_, index) => <Cell key={index} fill={index < 3 ? "#6259ca" : "#15a6a6"} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <CardHeader title="System Readiness" subtitle="Backend modules verified locally" />
          <div className="grid gap-3 p-4 sm:grid-cols-2">
            {[
              ["GTFS", "Routes, stops, trips, shapes"],
              ["Equity", "158 neighbourhood scores"],
              ["ML", "Weather and calendar model"],
              ["Graph", "39k simulation edges"],
            ].map(([title, text]) => (
              <div key={title} className="rounded-xl border border-[var(--line)] bg-[var(--panel-soft)] p-4">
                <Badge color="green">{title}</Badge>
                <p className="mt-3 text-sm font-semibold">{text}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </section>
  );
}
