import { kpiData, ridershipTimeSeries, demandByRoute, equityNeighborhoods } from "../data/mockData";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, RadialBarChart, RadialBar,
} from "recharts";
import { StatCard, Card, CardHeader, Badge, PageHeader } from "../components/ui";

/* ── Icons ─────────────────────────────────────────────── */
const Icon = {
  Routes: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points="9,22 9,12 15,12 15,22" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  Riders: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" strokeLinecap="round" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" strokeLinecap="round" />
    </svg>
  ),
  Equity: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8v4l3 3" strokeLinecap="round" />
    </svg>
  ),
  Disruption: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
      <polygon points="13,2 3,14 12,14 11,22 21,10 12,10" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  Stops: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3" strokeLinecap="round" />
    </svg>
  ),
  Accuracy: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
      <polyline points="22,12 18,12 15,21 9,3 6,12 2,12" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
};

const CHART_TOOLTIP = {
  contentStyle: {
    background: "#fff",
    border: "1px solid #e8e8f7",
    borderRadius: 10,
    boxShadow: "0 4px 20px rgba(18,38,63,0.1)",
    fontFamily: "Poppins, sans-serif",
    fontSize: 12,
  },
  labelStyle: { color: "#1a1c2e", fontWeight: 600 },
};

const SAMPLE = ridershipTimeSeries.filter((_, i) => i % 2 === 0);

/* ── Equity score breakdown for radial chart ──────────── */
const equityBands = [
  { name: "High (≥75)",   value: equityNeighborhoods.filter(n => n.equityScore >= 75).length, fill: "#19b159" },
  { name: "Medium (55–74)", value: equityNeighborhoods.filter(n => n.equityScore >= 55 && n.equityScore < 75).length, fill: "#f7b731" },
  { name: "Low (40–54)",  value: equityNeighborhoods.filter(n => n.equityScore >= 40 && n.equityScore < 55).length, fill: "#eb6f33" },
  { name: "Critical (<40)", value: equityNeighborhoods.filter(n => n.equityScore < 40).length, fill: "#f5334f" },
];

/* ── Recent alerts mock ───────────────────────────────── */
const ALERTS = [
  { id: 1, route: "Line 1 — Yonge", msg: "Delay at Bloor-Yonge station",     type: "warning", time: "2 min ago"  },
  { id: 2, route: "36 Finch West",  msg: "Low equity score neighbourhood",    type: "danger",  time: "18 min ago" },
  { id: 3, route: "504 King",       msg: "Ridership at 92% capacity",         type: "warning", time: "34 min ago" },
  { id: 4, route: "Service Gap",    msg: "Malvern North flagged for review",   type: "info",    time: "1 hr ago"   },
];

export default function Dashboard() {
  return (
    <section aria-label="Dashboard overview">
      <PageHeader
        title="Analytics Overview"
        subtitle="Real-time transit equity, ridership, and service health · Toronto, ON"
      />

      {/* ── KPI Cards ─────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-5">
        <StatCard
          label="Total Routes"
          value={kpiData.totalRoutes}
          change="TTC network"
          icon={<Icon.Routes />}
          color="primary"
        />
        <StatCard
          label="Total Stops"
          value={kpiData.totalStops.toLocaleString()}
          change="Active stops"
          icon={<Icon.Stops />}
          color="info"
        />
        <StatCard
          label="Daily Ridership"
          value={(kpiData.dailyRidership / 1e6).toFixed(2)}
          unit="M"
          change="Avg weekday"
          changePct={3.4}
          icon={<Icon.Riders />}
          color="success"
        />
        <StatCard
          label="Avg Equity Score"
          value={kpiData.avgEquityScore}
          unit="/ 100"
          change="Network-wide"
          icon={<Icon.Equity />}
          color="secondary"
        />
        <StatCard
          label="Disruption Index"
          value={kpiData.disruptionIndex}
          unit="/ 10"
          change="Last 30 days"
          changePct={-0.8}
          icon={<Icon.Disruption />}
          color="warning"
        />
        <StatCard
          label="Forecast Accuracy"
          value={kpiData.demandForecastAccuracy}
          unit="%"
          change="XGBoost model"
          changePct={1.2}
          icon={<Icon.Accuracy />}
          color="teal"
        />
      </div>

      {/* ── Charts row ─────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-4">
        {/* Ridership area chart — 2/3 width */}
        <Card className="xl:col-span-2">
          <CardHeader
            title="Ridership — Actual vs Predicted"
            subtitle="Today's hourly demand (ML forecast)"
            action={<Badge color="success">Live</Badge>}
          />
          <div className="p-5">
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={SAMPLE} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
                <defs>
                  <linearGradient id="gA" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#6259ca" stopOpacity={0.22} />
                    <stop offset="95%" stopColor="#6259ca" stopOpacity={0}    />
                  </linearGradient>
                  <linearGradient id="gP" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#19b159" stopOpacity={0.18} />
                    <stop offset="95%" stopColor="#19b159" stopOpacity={0}    />
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
          </div>
        </Card>

        {/* Equity distribution radial — 1/3 */}
        <Card>
          <CardHeader title="Equity Distribution" subtitle="Neighbourhoods by score band" />
          <div className="p-5 flex flex-col items-center">
            <ResponsiveContainer width="100%" height={160}>
              <RadialBarChart
                innerRadius="30%"
                outerRadius="100%"
                data={equityBands}
                startAngle={90}
                endAngle={-270}
              >
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

      {/* ── Bottom row ─────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* Demand vs Capacity */}
        <Card>
          <CardHeader title="Demand vs Capacity" subtitle="Daily by route" action={<Badge color="primary">Routes</Badge>} />
          <div className="p-5">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={demandByRoute} layout="vertical" margin={{ top: 0, right: 12, left: 90, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f6" horizontal={false} />
                <XAxis type="number" tick={{ fill: "#a8afc7", fontSize: 10, fontFamily: "Poppins" }} />
                <YAxis type="category" dataKey="route" tick={{ fill: "#7b8191", fontSize: 10, fontFamily: "Poppins" }} width={90} />
                <Tooltip {...CHART_TOOLTIP} formatter={(v) => [v.toLocaleString()]} />
                <Legend wrapperStyle={{ fontSize: 11, color: "#7b8191", fontFamily: "Poppins" }} />
                <Bar dataKey="demand"   name="Demand"   fill="#6259ca" radius={[0, 4, 4, 0]} />
                <Bar dataKey="capacity" name="Capacity" fill="#e8e8f7" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Alerts / Activity feed */}
        <Card>
          <CardHeader
            title="System Alerts"
            subtitle="Recent transit events"
            action={<Badge color="danger">{ALERTS.length} active</Badge>}
          />
          <div>
            {ALERTS.map((a, idx) => (
              <div
                key={a.id}
                className="flex items-start gap-3 px-5 py-3 transition-colors hover:bg-[#fafafe]"
                style={{ borderBottom: idx < ALERTS.length - 1 ? "1px solid var(--border-color)" : "none" }}
              >
                {/* Dot */}
                <span
                  className="mt-1 w-2 h-2 rounded-full shrink-0"
                  style={{
                    background: a.type === "danger" ? "var(--danger)"
                      : a.type === "warning" ? "var(--warning)"
                      : "var(--info)",
                  }}
                  aria-hidden="true"
                />
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
    </section>
  );
}
