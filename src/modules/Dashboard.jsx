import { useEffect, useState } from "react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, RadialBarChart, RadialBar,
} from "recharts";
import { fetchKPI, fetchTimeSeries, fetchDemandByRoute, fetchModelMetrics } from "../api/client";
import { equityNeighborhoods } from "../data/mockData";
import { StatCard, Card, CardHeader, Badge, PageHeader } from "../components/ui";

const Icon = {
  Routes: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" strokeLinecap="round" strokeLinejoin="round" /><polyline points="9,22 9,12 15,12 15,22" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  Riders: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" strokeLinecap="round" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" strokeLinecap="round" /></svg>,
  Equity: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5"><circle cx="12" cy="12" r="10" /><path d="M12 8v4l3 3" strokeLinecap="round" /></svg>,
  Disruption: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5"><polygon points="13,2 3,14 12,14 11,22 21,10 12,10" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  Stops: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5"><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" strokeLinecap="round" /></svg>,
  Accuracy: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5"><polyline points="22,12 18,12 15,21 9,3 6,12 2,12" strokeLinecap="round" strokeLinejoin="round" /></svg>,
};

const CHART_TOOLTIP = {
  contentStyle: { background: "#fff", border: "1px solid #e8e8f7", borderRadius: 10, boxShadow: "0 4px 20px rgba(18,38,63,0.1)", fontFamily: "Poppins, sans-serif", fontSize: 12 },
  labelStyle: { color: "#1a1c2e", fontWeight: 600 },
};

const equityBands = [
  { name: "High (≥75)",    value: equityNeighborhoods.filter(n => n.equityScore >= 75).length, fill: "#19b159" },
  { name: "Medium (55–74)",value: equityNeighborhoods.filter(n => n.equityScore >= 55 && n.equityScore < 75).length, fill: "#f7b731" },
  { name: "Low (40–54)",   value: equityNeighborhoods.filter(n => n.equityScore >= 40 && n.equityScore < 55).length, fill: "#eb6f33" },
  { name: "Critical (<40)",value: equityNeighborhoods.filter(n => n.equityScore < 40).length,  fill: "#f5334f" },
];

const ALERTS = [
  { id: 1, route: "Line 1 — Yonge", msg: "Delay at Bloor-Yonge station",   type: "warning", time: "2 min ago"  },
  { id: 2, route: "36 Finch West",  msg: "Low equity score neighbourhood", type: "danger",  time: "18 min ago" },
  { id: 3, route: "504 King",       msg: "Ridership at 92% capacity",       type: "warning", time: "34 min ago" },
  { id: 4, route: "Service Gap",    msg: "Malvern North flagged for review", type: "info",    time: "1 hr ago"   },
];

function Skeleton({ h = "h-8", w = "w-full" }) {
  return <div className={`${h} ${w} rounded-lg animate-pulse`} style={{ background: "#e8e8f7" }} />;
}

export default function Dashboard() {
  const [kpi,     setKpi]     = useState(null);
  const [series,  setSeries]  = useState([]);
  const [demand,  setDemand]  = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [apiLive, setApiLive] = useState(false);

  useEffect(() => {
    Promise.all([
      fetchKPI(),
      fetchTimeSeries({ routeType: 1, dayOfWeek: 1, month: 3 }),
      fetchDemandByRoute(),
      fetchModelMetrics(),
    ]).then(([k, s, d, m]) => {
      setKpi(k);
      setSeries(s.filter((_, i) => i % 2 === 0));
      setDemand(d);
      setMetrics(m);
      setApiLive(k.totalRoutes > 0 && k.totalRoutes !== 154);
      setLoading(false);
    });
  }, []);

  return (
    <section aria-label="Dashboard overview">
      <PageHeader
        title="Analytics Overview"
        subtitle="Real-time transit equity, ridership, and service health · Toronto, ON"
        action={
          <Badge color={apiLive ? "success" : "warning"}>
            {apiLive ? "🟢 Live API" : "⚠ Mock data"}
          </Badge>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-5">
        {loading ? Array(6).fill(0).map((_, i) => (
          <div key={i} className="rounded-[var(--card-radius)] p-5" style={{ background: "#e8e8f7" }}>
            <Skeleton h="h-4" w="w-24" /><Skeleton h="h-8" w="w-32" />
          </div>
        )) : <>
          <StatCard label="Total Routes"       value={kpi.totalRoutes}                                          color="primary"   change="TTC network" />
          <StatCard label="Total Stops"        value={Number(kpi.totalStops).toLocaleString()}                  color="info"      change="Active stops" />
          <StatCard label="Daily Ridership"    value={(kpi.dailyRidership / 1e6).toFixed(2)} unit="M"           color="success"   change="Avg weekday" changePct={3.4} />
          <StatCard label="Avg Equity Score"   value={kpi.avgEquityScore}  unit="/ 100"                         color="secondary" change="Network-wide" />
          <StatCard label="Disruption Index"   value={kpi.disruptionIndex} unit="/ 10"                          color="warning"   change="Last 30 days" changePct={-0.8} />
          <StatCard label="Forecast Accuracy"  value={kpi.demandForecastAccuracy} unit="%"                      color="teal"      change="XGBoost model" changePct={1.2} />
        </>}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-4">
        <Card className="xl:col-span-2">
          <CardHeader
            title="Ridership — Actual vs Predicted"
            subtitle={metrics
              ? `XGBoost · R²=${metrics.r2} · MAE=${metrics.mae?.toLocaleString()} riders`
              : "Today's hourly demand (ML forecast)"}
            action={<Badge color="success">Live</Badge>}
          />
          <div className="p-5">
            {loading ? <Skeleton h="h-[220px]" /> : (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={series} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gA" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#6259ca" stopOpacity={0.22} />
                      <stop offset="95%" stopColor="#6259ca" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gP" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#19b159" stopOpacity={0.18} />
                      <stop offset="95%" stopColor="#19b159" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f6" />
                  <XAxis dataKey="hour" tick={{ fill: "#a8afc7", fontSize: 10, fontFamily: "Poppins" }} />
                  <YAxis tick={{ fill: "#a8afc7", fontSize: 10, fontFamily: "Poppins" }} />
                  <Tooltip {...CHART_TOOLTIP} />
                  <Legend wrapperStyle={{ fontSize: 11, color: "#7b8191", fontFamily: "Poppins" }} />
                  <Area type="monotone" dataKey="actual"    name="Actual"    stroke="#6259ca" fill="url(#gA)" strokeWidth={2.5} dot={false} />
                  <Area type="monotone" dataKey="predicted" name="Predicted" stroke="#19b159" fill="url(#gP)" strokeWidth={2}   dot={false} strokeDasharray="5 3" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Equity Distribution" subtitle="Neighbourhoods by score band" />
          <div className="p-5 flex flex-col items-center">
            <ResponsiveContainer width="100%" height={160}>
              <RadialBarChart innerRadius="30%" outerRadius="100%" data={equityBands} startAngle={90} endAngle={-270}>
                <RadialBar dataKey="value" cornerRadius={4} background={{ fill: "#f0f0f6" }} />
                <Tooltip {...CHART_TOOLTIP} formatter={(v, n) => [v + " zones", n]} />
              </RadialBarChart>
            </ResponsiveContainer>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 w-full mt-2">
              {equityBands.map((b) => (
                <div key={b.name} className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: b.fill }} aria-hidden="true" />
                  <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>{b.name}: <strong style={{ color: "var(--text-primary)" }}>{b.value}</strong></span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card>
          <CardHeader title="Demand vs Capacity" subtitle="Daily by route" action={<Badge color="primary">Routes</Badge>} />
          <div className="p-5">
            {loading ? <Skeleton h="h-[200px]" /> : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={demand} layout="vertical" margin={{ top: 0, right: 12, left: 90, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f6" horizontal={false} />
                  <XAxis type="number" tick={{ fill: "#a8afc7", fontSize: 10, fontFamily: "Poppins" }} />
                  <YAxis type="category" dataKey="route" tick={{ fill: "#7b8191", fontSize: 10, fontFamily: "Poppins" }} width={90} />
                  <Tooltip {...CHART_TOOLTIP} formatter={(v) => [Number(v).toLocaleString()]} />
                  <Legend wrapperStyle={{ fontSize: 11, color: "#7b8191", fontFamily: "Poppins" }} />
                  <Bar dataKey="demand"   name="Demand"   fill="#6259ca" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="capacity" name="Capacity" fill="#e8e8f7" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="System Alerts" subtitle="Recent transit events" action={<Badge color="danger">{ALERTS.length} active</Badge>} />
          <div>
            {ALERTS.map((a, idx) => (
              <div
                key={a.id}
                className="flex items-start gap-3 px-5 py-3 transition-colors hover:bg-[#fafafe]"
                style={{ borderBottom: idx < ALERTS.length - 1 ? "1px solid var(--border-color)" : "none" }}
              >
                <span className="mt-1 w-2 h-2 rounded-full shrink-0" style={{ background: a.type === "danger" ? "var(--danger)" : a.type === "warning" ? "var(--warning)" : "var(--info)" }} aria-hidden="true" />
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-medium truncate" style={{ color: "var(--text-primary)" }}>{a.msg}</p>
                  <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>{a.route}</p>
                </div>
                <span className="text-[10px] shrink-0 mt-0.5" style={{ color: "var(--text-light)" }}>{a.time}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Model metrics bar */}
      {metrics && !loading && (
        <Card className="mt-4">
          <div className="flex flex-wrap items-center gap-4 px-5 py-3">
            <span className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>XGBoost Model</span>
            {[
              { label: "R²",        value: metrics.r2,           color: "primary"  },
              { label: "Accuracy",  value: `${metrics.accuracy_pct}%`, color: "success"  },
              { label: "MAE",       value: `${metrics.mae?.toLocaleString()} riders`, color: "info" },
              { label: "Train set", value: `${metrics.n_train?.toLocaleString()} rows`, color: "secondary" },
            ].map((m) => (
              <div key={m.label} className="flex items-center gap-1.5">
                <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>{m.label}:</span>
                <Badge color={m.color}>{m.value}</Badge>
              </div>
            ))}
            <span className="text-[10px] ml-auto" style={{ color: "var(--text-light)" }}>
              Trained on synthetic GTFS-anchored data · No PII
            </span>
          </div>
        </Card>
      )}
    </section>
  );
}
