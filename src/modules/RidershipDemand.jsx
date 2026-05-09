import { useMemo, useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useApi } from "../hooks/useApi";
import { api, formatNumber } from "../services/api";
import { Badge, Card, CardHeader, Field, KPI, PageHeader, Skeleton } from "../components/ui";
import { chartTooltip } from "../components/chartConfig";

function windowForToday() {
  const start = new Date();
  start.setHours(5, 0, 0, 0);
  const end = new Date(start);
  end.setHours(23, 0, 0, 0);
  return { start: start.toISOString(), end: end.toISOString() };
}

export default function RidershipDemand() {
  const [routeId, setRouteId] = useState("504");
  const [weather, setWeather] = useState("");
  const routes = useApi(api.routes, [], []);
  const surface = useApi(() => api.surfaceRidership(14), [], []);
  const annual = useApi(() => api.annualRidership(2019), [], []);
  const prediction = useApi(() => api.prediction({ routeId, weather, ...windowForToday() }), [routeId, weather], null);

  const forecastRows = useMemo(() => (prediction.data?.points || []).map((point) => ({
    time: new Date(point.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    riders: Math.round(point.predicted_riders),
    low: Math.round(point.lower_bound),
    high: Math.round(point.upper_bound),
  })), [prediction.data]);
  const annualTotal = annual.data?.reduce((sum, row) => sum + row.count, 0) || 0;
  const modelMetrics = prediction.data?.model_metrics || {};

  return (
    <section>
      <PageHeader
        title="Ridership Demand Forecasting"
        subtitle="Model-backed hourly ridership forecasts with route and weather controls."
        action={<Badge color="brand">{prediction.data?.model?.replaceAll("_", " ") || "ML model"}</Badge>}
      />

      <div className="mb-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KPI label="Annual Riders" value={formatNumber(annualTotal)} hint="2019 matrix total" tone="brand" />
        <KPI label="Surface Routes" value={surface.data?.length || "-"} hint="Top routes loaded" tone="green" />
        <KPI label="Test MAPE" value={modelMetrics.mape ? `${modelMetrics.mape}%` : "-"} hint="Model registry metric" tone="teal" />
        <KPI label="Route" value={routeId} hint="Forecast target" tone="amber" />
      </div>

      <div className="mb-4 grid grid-cols-1 gap-4 xl:grid-cols-4">
        <Card className="xl:col-span-3">
          <CardHeader title="Hourly Forecast" subtitle="Predicted riders by hour, including confidence bounds" />
          <div className="card-pad">
            {prediction.loading ? <Skeleton /> : (
              <ResponsiveContainer width="100%" height={340}>
                <AreaChart data={forecastRows} margin={{ top: 8, right: 16, left: -6, bottom: 0 }}>
                  <defs>
                    <linearGradient id="ridersFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#15a6a6" stopOpacity={0.22} />
                      <stop offset="95%" stopColor="#15a6a6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#edf0f7" strokeDasharray="3 3" />
                  <XAxis dataKey="time" tick={{ fontSize: 11, fill: "#6f7a8d" }} />
                  <YAxis tick={{ fontSize: 11, fill: "#6f7a8d" }} />
                  <Tooltip {...chartTooltip} />
                  <Area dataKey="riders" stroke="#15a6a6" fill="url(#ridersFill)" strokeWidth={2.5} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Forecast Controls" subtitle="Route and weather" />
          <div className="space-y-4 p-4">
            <Field label="Route">
              <select className="select" value={routeId} onChange={(event) => setRouteId(event.target.value)}>
                {(routes.data || []).slice(0, 120).map((route) => (
                  <option key={route.route_id} value={route.route_id}>{route.short_name} {route.long_name}</option>
                ))}
              </select>
            </Field>
            <Field label="Weather">
              <select className="select" value={weather} onChange={(event) => setWeather(event.target.value)}>
                <option value="">Typical</option>
                <option value="rain">Rain</option>
                <option value="snow">Snow</option>
              </select>
            </Field>
            <div className="rounded-xl bg-[var(--panel-soft)] p-3 text-xs text-[var(--muted)]">
              Predictions come from the trained backend model and are cached by route/time/weather.
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader title="Top Surface Routes" subtitle="All-day riders" />
          <div className="card-pad">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={surface.data || []} layout="vertical" margin={{ left: 92, right: 12 }}>
                <CartesianGrid stroke="#edf0f7" strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: "#6f7a8d" }} />
                <YAxis type="category" dataKey="route_name" width={125} tick={{ fontSize: 10, fill: "#6f7a8d" }} />
                <Tooltip {...chartTooltip} formatter={(value) => formatNumber(value)} />
                <Bar dataKey="all_day_riders" fill="#6259ca" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <CardHeader title="Model Metrics" subtitle="Returned with prediction response" />
          <div className="grid gap-3 p-4 sm:grid-cols-2">
            {[
              ["MAE", modelMetrics.mae],
              ["RMSE", modelMetrics.rmse],
              ["MAPE", modelMetrics.mape],
              ["R squared", modelMetrics.r2],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-[var(--line)] bg-[var(--panel-soft)] p-4">
                <p className="text-xs text-[var(--muted)]">{label}</p>
                <p className="mt-2 text-2xl font-extrabold">{value ?? "-"}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </section>
  );
}
