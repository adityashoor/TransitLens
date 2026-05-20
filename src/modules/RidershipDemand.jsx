import { useState, useEffect } from "react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, Cell, ReferenceLine,
} from "recharts";
import { fetchTimeSeries, fetchHeatmap, fetchDemandByRoute, fetchModelMetrics } from "../api/client";
import { Card, CardHeader, Badge, PageHeader, StatCard, PillGroup, InfoTag } from "../components/ui";

const DAYS     = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const DAY_L    = { mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat", sun: "Sun" };
const DAY_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const ROUTE_TYPES = [
  { label: "Subway",     value: 1 },
  { label: "Streetcar",  value: 0 },
  { label: "Bus",        value: 3 },
];

function cellBg(val, max) {
  const t = val / max;
  if (t > 0.85) return { bg: "rgba(245,51,79,0.12)",   fg: "#c0112c" };
  if (t > 0.65) return { bg: "rgba(247,183,49,0.12)",  fg: "#b8860b" };
  if (t > 0.45) return { bg: "rgba(98,89,202,0.10)",   fg: "#6259ca" };
  return               { bg: "rgba(25,177,89,0.08)",   fg: "#19b159" };
}

const CHART_TOOLTIP = {
  contentStyle: {
    background: "#fff", border: "1px solid #e8e8f7", borderRadius: 10,
    boxShadow: "0 4px 20px rgba(18,38,63,0.1)", fontFamily: "Poppins, sans-serif", fontSize: 12,
  },
  labelStyle: { color: "#1a1c2e", fontWeight: 600 },
};

const VIEWS = ["Time Series", "Station Heatmap", "Route Demand"];

function Skeleton({ h = "h-8", w = "w-full" }) {
  return <div className={`${h} ${w} rounded-lg animate-pulse`} style={{ background: "#e8e8f7" }} />;
}

export default function RidershipDemand() {
  const [view,       setView]       = useState("Time Series");
  const [routeType,  setRouteType]  = useState(1);
  const [dayOfWeek,  setDayOfWeek]  = useState(1);   // 0=Sun … 6=Sat
  const [tempC,      setTempC]      = useState(5);
  const [precipMm,   setPrecipMm]   = useState(0);
  const [tempCInput, setTempCInput] = useState(5);   // staged until slider release
  const [precipInput,setPrecipInput]= useState(0);

  const [series,     setSeries]     = useState([]);
  const [heatmap,    setHeatmap]    = useState([]);
  const [demand,     setDemand]     = useState([]);
  const [metrics,    setMetrics]    = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [fetchedAt,  setFetchedAt]  = useState(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetchTimeSeries({ routeType, dayOfWeek, month: 3, tempC, precipMm }),
      fetchHeatmap(),
      fetchDemandByRoute(),
      fetchModelMetrics(),
    ]).then(([s, h, d, m]) => {
      setSeries(s);
      setHeatmap(h);
      setDemand(d);
      setMetrics(m);
      setFetchedAt(new Date());
      setLoading(false);
    });
  }, [routeType, dayOfWeek, tempC, precipMm]);

  const maxH = heatmap.length
    ? Math.max(...heatmap.flatMap((r) => DAYS.map((d) => r[d] ?? 0)))
    : 11000;

  const peakActual   = series.length ? Math.max(...series.map((r) => r.actual ?? 0)) : 0;
  const overCapacity = demand.filter((r) => r.demand / r.capacity > 0.85).length;

  return (
    <section aria-label="Ridership Demand">
      <PageHeader
        title="Ridership Demand"
        subtitle="ML-predicted vs actual ridership — routes, stations, and time patterns"
        action={
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {metrics && <Badge color="success">XGBoost · R²={metrics.r2} · {metrics.accuracy_pct}%</Badge>}
            {fetchedAt && <span className="text-[10px]" style={{ color: "var(--text-light)" }}>Updated {fetchedAt.toLocaleTimeString()}</span>}
          </div>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        {loading ? Array(4).fill(0).map((_, i) => (
          <div key={i} className="rounded-[var(--card-radius)] p-5" style={{ background: "#e8e8f7" }}>
            <Skeleton h="h-4" w="w-24" /><Skeleton h="h-8" w="w-32" />
          </div>
        )) : <>
          <StatCard label="Peak Hour Riders" value={peakActual.toLocaleString()}         color="primary"   change="Max in selected series" />
          <StatCard label="Over Capacity"    value={overCapacity} unit=" routes"          color="danger"    change="Above 85% load" />
          <StatCard label="Forecast MAE"     value={metrics?.mae?.toLocaleString() ?? "—"} unit=" riders"  color="info"      change="XGBoost model" />
          <StatCard label="Train Samples"    value={metrics?.n_train?.toLocaleString() ?? "—"}             color="secondary" change="Training rows" />
        </>}
      </div>

      {/* Tab selector + route type filter */}
      <div className="flex flex-wrap items-center gap-4 mb-4">
        <PillGroup options={VIEWS} value={view} onChange={setView} />
        {view === "Time Series" && (
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-[12px]" style={{ color: "var(--text-muted)" }}>Route type:</span>
            <PillGroup
              options={ROUTE_TYPES.map((r) => r.label)}
              value={ROUTE_TYPES.find((r) => r.value === routeType)?.label}
              onChange={(label) => setRouteType(ROUTE_TYPES.find((r) => r.label === label)?.value ?? 1)}
            />
          </div>
        )}
      </div>

      {/* Day-of-week + weather controls (Time Series only) */}
      {view === "Time Series" && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-4">
          {/* Day selector */}
          <div className="rounded-[var(--card-radius)] px-4 py-3 flex items-center gap-3 flex-wrap"
               style={{ background: "var(--card-bg, #fff)", border: "1px solid var(--border-color)", boxShadow: "var(--card-shadow)" }}>
            <span className="text-[11px] font-semibold uppercase tracking-wider shrink-0" style={{ color: "var(--text-muted)" }}>Day</span>
            <div className="flex gap-1.5 flex-wrap">
              {DAY_FULL.map((d, i) => (
                <button
                  key={i}
                  onClick={() => setDayOfWeek(i)}
                  className="text-[11px] font-medium px-3 py-1 rounded-lg transition-all"
                  style={{
                    background: dayOfWeek === i ? "var(--primary)" : "var(--body-bg)",
                    color:      dayOfWeek === i ? "#fff" : "var(--text-muted)",
                    border:     `1px solid ${dayOfWeek === i ? "var(--primary)" : "var(--border-color)"}`,
                  }}
                >
                  {d.slice(0, 3)}
                </button>
              ))}
            </div>
          </div>

          {/* Weather sliders */}
          <div className="rounded-[var(--card-radius)] px-4 py-3 flex items-center gap-6 flex-wrap"
               style={{ background: "var(--card-bg, #fff)", border: "1px solid var(--border-color)", boxShadow: "var(--card-shadow)" }}>
            <span className="text-[11px] font-semibold uppercase tracking-wider shrink-0" style={{ color: "var(--text-muted)" }}>Weather</span>
            <div className="flex items-center gap-2 flex-1 min-w-[180px]">
              <span className="text-[18px]">🌡</span>
              <div className="flex-1">
                <div className="flex justify-between mb-1">
                  <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>Temp</span>
                  <span className="text-[11px] font-semibold" style={{ color: "var(--primary)" }}>{tempCInput}°C</span>
                </div>
                <input type="range" min="-20" max="35" step="1"
                  value={tempCInput}
                  onChange={(e) => setTempCInput(+e.target.value)}
                  onMouseUp={(e) => setTempC(+e.target.value)}
                  onTouchEnd={(e) => setTempC(+e.target.value)}
                  className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                  style={{ accentColor: "var(--primary)" }}
                />
                <div className="flex justify-between mt-0.5">
                  <span className="text-[9px]" style={{ color: "var(--text-light)" }}>-20°C</span>
                  <span className="text-[9px]" style={{ color: "var(--text-light)" }}>35°C</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-1 min-w-[180px]">
              <span className="text-[18px]">🌧</span>
              <div className="flex-1">
                <div className="flex justify-between mb-1">
                  <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>Rain</span>
                  <span className="text-[11px] font-semibold" style={{ color: "var(--info)" }}>{precipInput} mm</span>
                </div>
                <input type="range" min="0" max="50" step="1"
                  value={precipInput}
                  onChange={(e) => setPrecipInput(+e.target.value)}
                  onMouseUp={(e) => setPrecipMm(+e.target.value)}
                  onTouchEnd={(e) => setPrecipMm(+e.target.value)}
                  className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                  style={{ accentColor: "var(--info)" }}
                />
                <div className="flex justify-between mt-0.5">
                  <span className="text-[9px]" style={{ color: "var(--text-light)" }}>0 mm</span>
                  <span className="text-[9px]" style={{ color: "var(--text-light)" }}>50 mm</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Time Series ──────────────────────────── */}
      {view === "Time Series" && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <Card className="xl:col-span-2">
            <CardHeader
              title="Actual vs Predicted Ridership"
              subtitle={`${DAY_FULL[dayOfWeek]} · ${ROUTE_TYPES.find(r => r.value === routeType)?.label} · ${tempC}°C · ${precipMm}mm rain — dashed = XGBoost forecast`}
              action={<Badge color="primary">Live</Badge>}
            />
            <div className="p-5">
              {loading ? <Skeleton h="h-[300px]" /> : (
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={series} margin={{ top: 8, right: 16, left: -8, bottom: 0 }}>
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
                    <ReferenceLine x={8}  stroke="#f7b731" strokeDasharray="4 2" label={{ value: "AM Peak", fill: "#c88c00", fontSize: 10, fontFamily: "Poppins" }} />
                    <ReferenceLine x={17} stroke="#f7b731" strokeDasharray="4 2" label={{ value: "PM Peak", fill: "#c88c00", fontSize: 10, fontFamily: "Poppins" }} />
                    <Tooltip {...CHART_TOOLTIP} />
                    <Legend wrapperStyle={{ fontSize: 11, color: "#7b8191", fontFamily: "Poppins" }} />
                    <Area type="monotone" dataKey="actual"    name="Actual"    stroke="#6259ca" fill="url(#gAc)" strokeWidth={2.5} dot={false} />
                    <Area type="monotone" dataKey="predicted" name="Predicted" stroke="#19b159" fill="url(#gPr)" strokeWidth={2}   dot={false} strokeDasharray="5 3" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </Card>

          {/* Model stats */}
          <div className="flex flex-col gap-4">
            <Card>
              <CardHeader title="Model Performance" subtitle="XGBoost — 90-day training" />
              <div className="p-4 space-y-3">
                {loading || !metrics ? Array(4).fill(0).map((_, i) => <Skeleton key={i} h="h-10" />) : [
                  { label: "Accuracy",         value: `${metrics.accuracy_pct}%`,             color: "success"   },
                  { label: "R² Score",          value: metrics.r2,                             color: "primary"   },
                  { label: "MAE",               value: `${metrics.mae?.toLocaleString()} riders`, color: "info"   },
                  { label: "Training samples",  value: metrics.n_train?.toLocaleString(),      color: "secondary" },
                ].map((m) => (
                  <div key={m.label} className="flex items-center justify-between rounded-lg px-3 py-2.5" style={{ background: "var(--body-bg)" }}>
                    <span className="text-[12px]" style={{ color: "var(--text-muted)" }}>{m.label}</span>
                    <Badge color={m.color}>{m.value}</Badge>
                  </div>
                ))}
              </div>
            </Card>
            <Card>
              <CardHeader title="Feature Importance" subtitle="XGBoost — top predictors" />
              <div className="p-4 space-y-2">
                {loading || !metrics?.importances
                  ? Array(5).fill(0).map((_, i) => <Skeleton key={i} h="h-8" />)
                  : (() => {
                      const LABELS = {
                        hour: "Hour of day", day_of_week: "Day of week",
                        route_type: "Route type", temp_c: "Weather (temp)",
                        month: "Season / month", precip_mm: "Precipitation",
                      };
                      const maxVal = Math.max(...Object.values(metrics.importances));
                      return Object.entries(metrics.importances)
                        .sort(([, a], [, b]) => b - a)
                        .map(([key, val]) => {
                          const pct = Math.round((val / maxVal) * 100);
                          return (
                            <div key={key}>
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>{LABELS[key] ?? key}</span>
                                <span className="text-[11px] font-semibold" style={{ color: "var(--primary)" }}>{(val * 100).toFixed(1)}%</span>
                              </div>
                              <div className="progress-bar">
                                <div className="progress-fill" style={{ width: `${pct}%` }} />
                              </div>
                            </div>
                          );
                        });
                    })()
                }
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
            action={<Badge color="muted">{heatmap.length} stations · 7 days</Badge>}
          />
          <div className="p-5 overflow-x-auto">
            {loading ? <Skeleton h="h-[200px]" /> : (
              <>
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
                    {heatmap.map((row) => (
                      <tr key={row.station}>
                        <td className="pr-6 py-2 font-medium" style={{ color: "var(--text-primary)", fontSize: 12 }}>{row.station}</td>
                        {DAYS.map((d) => {
                          const val = row[d] ?? 0;
                          const { bg, fg } = cellBg(val, maxH);
                          return (
                            <td key={d} className="py-1 px-1">
                              <div
                                className="rounded-lg text-center py-1.5 font-semibold"
                                style={{ background: bg, color: fg, fontSize: 11, minWidth: 44 }}
                                title={`${row.station} ${DAY_L[d]}: ${val.toLocaleString()} riders`}
                              >
                                {(val / 1000).toFixed(1)}k
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
              </>
            )}
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
              {loading ? <Skeleton h="h-[300px]" /> : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={demand} layout="vertical" margin={{ top: 0, right: 20, left: 110, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f6" horizontal={false} />
                    <XAxis type="number" tick={{ fill: "#a8afc7", fontSize: 10, fontFamily: "Poppins" }} />
                    <YAxis type="category" dataKey="route" tick={{ fill: "#7b8191", fontSize: 10, fontFamily: "Poppins" }} width={110} />
                    <Tooltip {...CHART_TOOLTIP} formatter={(v) => [v.toLocaleString()]} />
                    <Legend wrapperStyle={{ fontSize: 11, color: "#7b8191", fontFamily: "Poppins" }} />
                    <Bar dataKey="demand" name="Demand" radius={[0, 4, 4, 0]}>
                      {demand.map((r, i) => (
                        <Cell key={i} fill={r.demand / r.capacity > 0.85 ? "#f5334f" : "#6259ca"} />
                      ))}
                    </Bar>
                    <Bar dataKey="capacity" name="Capacity" fill="#e8e8f7" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </Card>

          {/* Route table */}
          <Card>
            <CardHeader title="Load Factor" subtitle="Demand ÷ capacity" />
            <div className="p-4 space-y-3">
              {loading ? Array(5).fill(0).map((_, i) => <Skeleton key={i} h="h-10" />) :
                demand.map((r) => {
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
                })
              }
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
