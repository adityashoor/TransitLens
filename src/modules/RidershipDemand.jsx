import { useState } from "react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, Cell, LineChart, Line, ReferenceLine,
} from "recharts";
import { ridershipTimeSeries, stationHeatmap, demandByRoute } from "../data/mockData";
import { Card, CardHeader, Badge, PageHeader, StatCard, PillGroup, InfoTag } from "../components/ui";

const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const DAY_L = { mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat", sun: "Sun" };

function cellBg(val, max) {
  const t = val / max;
  if (t > 0.85) return { bg: "rgba(245,51,79,0.12)",   fg: "#c0112c" };
  if (t > 0.65) return { bg: "rgba(247,183,49,0.12)",  fg: "#b8860b" };
  if (t > 0.45) return { bg: "rgba(98,89,202,0.10)",   fg: "#6259ca" };
  return                { bg: "rgba(25,177,89,0.08)",   fg: "#19b159" };
}
const MAX_H = 11000;

const CHART_TOOLTIP = {
  contentStyle: {
    background: "#fff", border: "1px solid #e8e8f7", borderRadius: 10,
    boxShadow: "0 4px 20px rgba(18,38,63,0.1)", fontFamily: "Poppins, sans-serif", fontSize: 12,
  },
  labelStyle: { color: "#1a1c2e", fontWeight: 600 },
};

const VIEWS = ["Time Series", "Station Heatmap", "Route Demand"];

export default function RidershipDemand() {
  const [view, setView] = useState("Time Series");

  const overCapacity = demandByRoute.filter((r) => r.demand / r.capacity > 0.85).length;

  return (
    <section aria-label="Ridership Demand">
      <PageHeader
        title="Ridership Demand"
        subtitle="ML-predicted vs actual ridership — routes, stations, and time patterns"
        action={<Badge color="success">Model: XGBoost · 87.5% accuracy</Badge>}
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <StatCard label="Peak Hour Riders" value="9,800"    color="primary"   change="Union Station · 8–9 AM" />
        <StatCard label="Over Capacity"    value={overCapacity} unit=" routes" color="danger"    change="Above 85% load" />
        <StatCard label="Forecast MAE"     value="312"      unit=" riders"    color="info"      change="XGBoost model" />
        <StatCard label="Busiest Day"      value="Friday"                      color="secondary" change="Avg 10.2k at Union" />
      </div>

      {/* Tab selector */}
      <div className="flex items-center gap-4 mb-4">
        <PillGroup options={VIEWS} value={view} onChange={setView} />
      </div>

      {/* ── Time Series ──────────────────────────── */}
      {view === "Time Series" && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <Card className="xl:col-span-2">
            <CardHeader
              title="Actual vs Predicted Ridership"
              subtitle="Hourly demand today — shaded area = forecast confidence"
              action={<Badge color="primary">Live</Badge>}
            />
            <div className="p-5">
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={ridershipTimeSeries} margin={{ top: 8, right: 16, left: -8, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gAc" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#6259ca" stopOpacity={0.22} />
                      <stop offset="95%" stopColor="#6259ca" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gPr" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#19b159" stopOpacity={0.18} />
                      <stop offset="95%" stopColor="#19b159" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f6" />
                  <XAxis dataKey="hour" tick={{ fill: "#a8afc7", fontSize: 10, fontFamily: "Poppins" }} />
                  <YAxis tick={{ fill: "#a8afc7", fontSize: 10, fontFamily: "Poppins" }} />
                  <ReferenceLine x="08:00" stroke="#f7b731" strokeDasharray="4 2" label={{ value: "AM Peak", fill: "#c88c00", fontSize: 10, fontFamily: "Poppins" }} />
                  <ReferenceLine x="17:00" stroke="#f7b731" strokeDasharray="4 2" label={{ value: "PM Peak", fill: "#c88c00", fontSize: 10, fontFamily: "Poppins" }} />
                  <Tooltip {...CHART_TOOLTIP} />
                  <Legend wrapperStyle={{ fontSize: 11, color: "#7b8191", fontFamily: "Poppins" }} />
                  <Area type="monotone" dataKey="actual"    name="Actual"    stroke="#6259ca" fill="url(#gAc)" strokeWidth={2.5} dot={false} />
                  <Area type="monotone" dataKey="predicted" name="Predicted" stroke="#19b159" fill="url(#gPr)" strokeWidth={2}   dot={false} strokeDasharray="5 3" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Model stats */}
          <div className="flex flex-col gap-4">
            <Card>
              <CardHeader title="Model Performance" subtitle="XGBoost — 90-day training" />
              <div className="p-4 space-y-3">
                {[
                  { label: "Accuracy (MAE)",    value: "87.5%",  color: "success" },
                  { label: "R² Score",           value: "0.921",  color: "primary" },
                  { label: "Training samples",   value: "87,480", color: "info"    },
                  { label: "Features used",      value: "14",     color: "secondary"},
                ].map((m) => (
                  <div key={m.label} className="flex items-center justify-between rounded-lg px-3 py-2.5" style={{ background: "var(--body-bg)" }}>
                    <span className="text-[12px]" style={{ color: "var(--text-muted)" }}>{m.label}</span>
                    <Badge color={m.color}>{m.value}</Badge>
                  </div>
                ))}
              </div>
            </Card>
            <Card>
              <CardHeader title="Key Features" subtitle="Top predictors" />
              <div className="p-4 space-y-2">
                {[
                  { f: "Hour of day",     pct: 92 },
                  { f: "Day of week",     pct: 78 },
                  { f: "Route type",      pct: 65 },
                  { f: "Weather (temp)",  pct: 48 },
                  { f: "Season",          pct: 41 },
                ].map((x) => (
                  <div key={x.f}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>{x.f}</span>
                      <span className="text-[11px] font-semibold" style={{ color: "var(--primary)" }}>{x.pct}%</span>
                    </div>
                    <div className="progress-bar">
                      <div className="progress-fill" style={{ width: `${x.pct}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* ── Station Heatmap ──────────────────────── */}
      {view === "Station Heatmap" && (
        <Card>
          <CardHeader
            title="Peak Hour Ridership by Station & Day"
            subtitle="Morning peak ridership (thousands) — colour = load intensity"
            action={<Badge color="muted">7 stations · 7 days</Badge>}
          />
          <div className="p-5 overflow-x-auto">
            <table className="w-full text-xs border-collapse" aria-label="Ridership heatmap">
              <thead>
                <tr>
                  <th className="text-left pb-3 pr-6" style={{ color: "var(--text-muted)", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>Station</th>
                  {DAYS.map((d) => (
                    <th key={d} className="pb-3 px-2 text-center" style={{ color: "var(--text-muted)", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>{DAY_L[d]}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {stationHeatmap.map((row, ri) => (
                  <tr key={row.station}>
                    <td className="pr-6 py-2 font-medium" style={{ color: "var(--text-primary)", fontSize: 12 }}>{row.station}</td>
                    {DAYS.map((d) => {
                      const { bg, fg } = cellBg(row[d], MAX_H);
                      return (
                        <td key={d} className="py-1 px-1">
                          <div
                            className="rounded-lg text-center py-1.5 font-semibold"
                            style={{ background: bg, color: fg, fontSize: 11, minWidth: 44 }}
                            title={`${row.station} ${DAY_L[d]}: ${row[d].toLocaleString()} riders`}
                          >
                            {(row[d] / 1000).toFixed(1)}k
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex items-center gap-4 mt-4 pt-3" style={{ borderTop: "1px solid var(--border-color)" }}>
              <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>Intensity scale:</span>
              {[
                { label: "Low",      bg: "rgba(25,177,89,0.08)",   fg: "#19b159" },
                { label: "Medium",   bg: "rgba(98,89,202,0.10)",   fg: "#6259ca" },
                { label: "High",     bg: "rgba(247,183,49,0.12)",  fg: "#b8860b" },
                { label: "Critical", bg: "rgba(245,51,79,0.12)",   fg: "#c0112c" },
              ].map((s) => (
                <div key={s.label} className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded" style={{ background: s.bg, border: `1px solid ${s.fg}55` }} />
                  <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>{s.label}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* ── Route Demand ─────────────────────────── */}
      {view === "Route Demand" && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <Card className="xl:col-span-2">
            <CardHeader
              title="Daily Demand vs Capacity"
              subtitle="By route — red bars indicate overcrowding risk (>85% capacity)"
              action={overCapacity > 0 ? <Badge color="danger">{overCapacity} over-capacity</Badge> : <Badge color="success">All clear</Badge>}
            />
            <div className="p-5">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={demandByRoute} layout="vertical" margin={{ top: 0, right: 20, left: 110, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f6" horizontal={false} />
                  <XAxis type="number" tick={{ fill: "#a8afc7", fontSize: 10, fontFamily: "Poppins" }} />
                  <YAxis type="category" dataKey="route" tick={{ fill: "#7b8191", fontSize: 10, fontFamily: "Poppins" }} width={110} />
                  <Tooltip {...CHART_TOOLTIP} formatter={(v) => [v.toLocaleString()]} />
                  <Legend wrapperStyle={{ fontSize: 11, color: "#7b8191", fontFamily: "Poppins" }} />
                  <Bar dataKey="demand" name="Demand" radius={[0, 4, 4, 0]}>
                    {demandByRoute.map((r, i) => (
                      <Cell key={i} fill={r.demand / r.capacity > 0.85 ? "#f5334f" : "#6259ca"} />
                    ))}
                  </Bar>
                  <Bar dataKey="capacity" name="Capacity" fill="#e8e8f7" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Route table */}
          <Card>
            <CardHeader title="Load Factor" subtitle="Demand ÷ capacity" />
            <div className="p-4 space-y-3">
              {demandByRoute.map((r) => {
                const pct = Math.round((r.demand / r.capacity) * 100);
                const color = pct > 85 ? "#f5334f" : pct > 70 ? "#f7b731" : "#6259ca";
                return (
                  <div key={r.route}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-medium truncate" style={{ color: "var(--text-primary)", maxWidth: "70%" }}>{r.route}</span>
                      <span className="text-[11px] font-bold" style={{ color }}>{pct}%</span>
                    </div>
                    <div className="progress-bar">
                      <div className="progress-fill" style={{ width: `${pct}%`, background: `linear-gradient(to right, ${color}, ${color}cc)` }} />
                    </div>
                  </div>
                );
              })}
            </div>
            {overCapacity > 0 && (
              <div className="px-4 pb-4">
                <InfoTag color="danger">⚠ {overCapacity} route{overCapacity > 1 ? "s" : ""} exceed 85% capacity — consider service augmentation</InfoTag>
              </div>
            )}
          </Card>
        </div>
      )}
    </section>
  );
}
