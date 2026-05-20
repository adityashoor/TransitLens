import { useState, useEffect, useRef } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, Tooltip as MapTooltip, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { fetchEquityScores, fetchEquityRoutes, fetchDemandByRoute } from "../api/client";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  ScatterChart, Scatter, ZAxis, ReferenceLine, Label,
} from "recharts";
import { Card, CardHeader, Badge, PageHeader, PillGroup, StatCard, InfoTag } from "../components/ui";

function FlyTo({ target }) {
  const map = useMap();
  useEffect(() => {
    if (target) map.flyTo([target.lat, target.lng], 14, { duration: 1 });
  }, [target, map]);
  return null;
}

const TORONTO = [43.6532, -79.3832];

function scoreColor(s) {
  if (s >= 75) return "#19b159";
  if (s >= 55) return "#f7b731";
  if (s >= 40) return "#eb6f33";
  return "#f5334f";
}
function scoreBadge(s) {
  if (s >= 75) return "success";
  if (s >= 55) return "warning";
  if (s >= 40) return "secondary";
  return "danger";
}

const FILTERS = ["All", "Low Income", "Seniors", "Disability"];

const CHART_TOOLTIP = {
  contentStyle: {
    background: "#fff", border: "1px solid #e8e8f7", borderRadius: 10,
    boxShadow: "0 4px 20px rgba(18,38,63,0.1)", fontFamily: "Poppins, sans-serif", fontSize: 12,
  },
  labelStyle: { color: "#1a1c2e", fontWeight: 600 },
};

function Skeleton({ h = "h-8", w = "w-full" }) {
  return <div className={`${h} ${w} rounded-lg animate-pulse`} style={{ background: "#e8e8f7" }} />;
}

/* Normalise API shape → internal shape used by the component.
   API returns camelCase with seniorPct/disabilityPct as whole-number percentages
   and income in dollars. Falls back to snake_case for forward-compat. */
function normalise(n) {
  const seniorRaw      = n.senior_pct      ?? n.seniorPct      ?? 0;
  const disabilityRaw  = n.disability_pct  ?? n.disabilityPct  ?? 0;
  // snake_case fields are fractions (0-1); camelCase are already whole %
  const seniorPct      = seniorRaw     <= 1 ? Math.round(seniorRaw * 100)     : Math.round(seniorRaw);
  const disabilityPct  = disabilityRaw <= 1 ? Math.round(disabilityRaw * 100) : Math.round(disabilityRaw);
  return {
    id:           n.id ?? n.neighbourhood ?? n.name,
    name:         n.name ?? n.neighbourhood,
    lat:          n.lat,
    lng:          n.lng,
    equityScore:  Math.round(n.equity_score ?? n.equityScore ?? 0),
    // income_index (0-1) or income in dollars → 0-100 index
    incomeIndex:  n.income_index != null
                    ? Math.round(n.income_index * 100)
                    : Math.min(100, Math.round((n.income ?? 0) / 1000)),
    seniorPct,
    disabilityPct,
    stopDensity:  +(n.stop_density  ?? n.stopDensity  ?? 0).toFixed(1),
    routeCount:   n.route_count ?? n.routeCount ?? 0,
    population:   n.population  ?? 0,
  };
}

export default function EquityScoring() {
  const [filter,       setFilter]       = useState("All");
  const [selected,     setSelected]     = useState(null);
  const [mapTarget,    setMapTarget]    = useState(null);
  const [zones,        setZones]        = useState([]);
  const [equityRoutes, setEquityRoutes] = useState([]);
  const [demand,       setDemand]       = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [apiLive,      setApiLive]      = useState(false);
  const [fetchedAt,    setFetchedAt]    = useState(null);

  useEffect(() => {
    Promise.all([fetchEquityScores(), fetchEquityRoutes(), fetchDemandByRoute()]).then(([raw, routes, dem]) => {
      const data = raw.map(normalise);
      setZones(data);
      setEquityRoutes(Array.isArray(routes) ? routes : []);
      setDemand(Array.isArray(dem) ? dem : []);
      setApiLive(raw.length > 0 && ("vulnerability" in raw[0] || "stopCount" in raw[0] || "equity_score" in raw[0]));
      setFetchedAt(new Date());
      setLoading(false);
    });
  }, []);

  // Join equityRoutes with demand on route_id for scatter plot
  const scatterData = equityRoutes.map((er) => {
    const d = demand.find((r) => r.route_id === er.id);
    if (!d || !d.capacity) return null;
    return {
      name:       er.name,
      equity:     er.score,
      loadFactor: Math.round((d.demand / d.capacity) * 100),
      routeType:  er.route_type,
    };
  }).filter(Boolean);

  const filtered = zones.filter((n) => {
    if (filter === "Low Income") return n.incomeIndex < 50;  // < $50k
    if (filter === "Seniors")    return n.seniorPct >= 15;
    if (filter === "Disability") return n.disabilityPct >= 12;
    return true;
  });

  const avgScore    = filtered.length ? Math.round(filtered.reduce((a, b) => a + b.equityScore, 0) / filtered.length) : 0;
  const underserved = filtered.filter((n) => n.equityScore < 50).length;

  return (
    <section aria-label="Equity Scoring">
      <PageHeader
        title="Equity Scoring"
        subtitle="Transit access scored per neighbourhood using census demographics and stop density"
        action={
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <Badge color={apiLive ? "success" : "warning"}>{apiLive ? "🟢 Live API" : "⚠ Mock data"}</Badge>
            <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>TTC GTFS · StatCan</span>
            {fetchedAt && <span className="text-[10px]" style={{ color: "var(--text-light)" }}>Updated {fetchedAt.toLocaleTimeString()}</span>}
          </div>
        }
      />

      {/* ── Mini KPIs ─────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        {loading ? Array(4).fill(0).map((_, i) => (
          <div key={i} className="rounded-[var(--card-radius)] p-5" style={{ background: "#e8e8f7" }}>
            <Skeleton h="h-4" w="w-24" /><Skeleton h="h-8" w="w-32" />
          </div>
        )) : <>
          <StatCard label="Neighbourhoods" value={filtered.length}                             color="primary"   change="In view" />
          <StatCard label="Avg Score"      value={avgScore}           unit="/ 100"              color="info"      change="Selected filter" />
          <StatCard label="Underserved"    value={underserved}                                   color="danger"    change="Score < 50" />
          <StatCard label="Routes Mapped"  value={equityRoutes.length}                          color="success"   change="With equity data" />
        </>}
      </div>

      {/* ── Filter pills ───────────────────────────── */}
      <div className="flex items-center gap-3 mb-4">
        <span className="text-[12px] font-medium" style={{ color: "var(--text-muted)" }}>Filter by:</span>
        <PillGroup options={FILTERS} value={filter} onChange={setFilter} />
      </div>

      {/* ── Main content ───────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 items-stretch">
        {/* Map */}
        <Card className="xl:col-span-2 flex flex-col" style={{ overflow: "hidden" }}>
          <CardHeader
            title="Neighbourhood Equity Map"
            subtitle="Click a marker to view details · Coloured by equity score"
            action={<Badge color={underserved > 3 ? "danger" : "success"}>{underserved} underserved</Badge>}
          />
          <div className="flex-1" style={{ minHeight: 420 }}>
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "var(--primary)", borderTopColor: "transparent" }} />
              </div>
            ) : (
              <MapContainer center={TORONTO} zoom={11} style={{ height: "100%", width: "100%" }} aria-label="Equity map">
                <TileLayer
                  attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <FlyTo target={mapTarget} />
                {filtered.map((n) => (
                  <CircleMarker
                    key={n.id}
                    center={[n.lat, n.lng]}
                    radius={16}
                    pathOptions={{
                      fillColor: scoreColor(n.equityScore),
                      fillOpacity: 0.75,
                      color: selected?.id === n.id ? "#1a1c2e" : scoreColor(n.equityScore),
                      weight: selected?.id === n.id ? 3 : 1.5,
                    }}
                    eventHandlers={{ click: () => setSelected(n) }}
                  >
                    <MapTooltip direction="top" offset={[0, -12]} opacity={0.95}>
                      <div style={{ fontFamily: "Poppins, sans-serif", fontSize: 12 }}>
                        <strong>{n.name}</strong><br />
                        Score: <strong style={{ color: scoreColor(n.equityScore) }}>{n.equityScore}/100</strong>
                      </div>
                    </MapTooltip>
                    <Popup>
                      <div style={{ fontFamily: "Poppins, sans-serif", fontSize: 12, minWidth: 160 }}>
                        <p style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>{n.name}</p>
                        <table style={{ width: "100%", borderCollapse: "collapse" }}>
                          {[
                            ["Equity Score",  `${n.equityScore}/100`],
                            ["Income Index",  `${n.incomeIndex}/100`],
                            ["Seniors",       `${n.seniorPct}%`],
                            ["Disability",    `${n.disabilityPct}%`],
                            ["Stop Density",  `${n.stopDensity}/km²`],
                            ["Routes",        n.routeCount],
                          ].map(([k, v]) => (
                            <tr key={k}>
                              <td style={{ color: "#7b8191", paddingRight: 8, paddingBottom: 3 }}>{k}</td>
                              <td style={{ fontWeight: 600 }}>{v}</td>
                            </tr>
                          ))}
                        </table>
                      </div>
                    </Popup>
                  </CircleMarker>
                ))}
              </MapContainer>
            )}
          </div>
        </Card>

        {/* Right panel */}
        <div className="flex flex-col gap-4">
          {/* Legend card */}
          <Card>
            <CardHeader title="Score Legend" />
            <div className="p-4 space-y-2.5">
              {[
                { label: "High (75–100)",  color: "#19b159", desc: "Well-served" },
                { label: "Medium (55–74)", color: "#f7b731", desc: "Average access" },
                { label: "Low (40–54)",    color: "#eb6f33", desc: "Below average" },
                { label: "Critical (<40)", color: "#f5334f", desc: "Underserved" },
              ].map((l) => (
                <div key={l.label} className="flex items-center gap-3">
                  <span
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ background: l.color, boxShadow: `0 0 0 3px ${l.color}33` }}
                    aria-hidden="true"
                  />
                  <div>
                    <p className="text-[12px] font-medium" style={{ color: "var(--text-primary)" }}>{l.label}</p>
                    <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{l.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Selected neighbourhood detail */}
          {selected ? (
            <Card>
              <CardHeader
                title={selected.name}
                subtitle="Neighbourhood detail"
                action={
                  <button onClick={() => setSelected(null)} aria-label="Close" className="w-6 h-6 rounded-full flex items-center justify-center text-sm transition-colors hover:bg-gray-100" style={{ color: "var(--text-muted)" }}>✕</button>
                }
              />
              <div className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-[28px] font-bold text-gradient">{selected.equityScore}</span>
                  <div>
                    <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>/ 100 equity score</p>
                    <Badge color={scoreBadge(selected.equityScore)}>
                      {selected.equityScore >= 75 ? "High" : selected.equityScore >= 55 ? "Medium" : selected.equityScore >= 40 ? "Low" : "Critical"}
                    </Badge>
                  </div>
                </div>
                <div className="progress-bar mb-4">
                  <div className="progress-fill" style={{ width: `${selected.equityScore}%`, background: `linear-gradient(to right, ${scoreColor(selected.equityScore)}, ${scoreColor(selected.equityScore)}aa)` }} />
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  {[
                    ["Income Index",  `${selected.incomeIndex}/100`],
                    ["Stop Density",  `${selected.stopDensity}/km²`],
                    ["Senior Pop.",   `${selected.seniorPct}%`],
                    ["Disability",    `${selected.disabilityPct}%`],
                    ["Routes",        selected.routeCount],
                    ["Population",    selected.population.toLocaleString()],
                  ].map(([k, v]) => (
                    <div key={k} className="rounded-lg p-2.5" style={{ background: "var(--body-bg)" }}>
                      <p style={{ color: "var(--text-muted)" }}>{k}</p>
                      <p className="font-semibold mt-0.5" style={{ color: "var(--text-primary)" }}>{v}</p>
                    </div>
                  ))}
                </div>
                {selected.equityScore < 50 && (
                  <div className="mt-3">
                    <InfoTag color="danger">⚠ Underserved — priority for service improvement</InfoTag>
                  </div>
                )}
              </div>
            </Card>
          ) : (
            <Card>
              <div className="p-6 text-center">
                <div className="w-10 h-10 rounded-xl mx-auto mb-2 flex items-center justify-center text-lg"
                  style={{ background: "var(--primary-01)", color: "var(--primary)" }}>⚖</div>
                <p className="text-[12px] font-medium" style={{ color: "var(--text-primary)" }}>Select a neighbourhood</p>
                <p className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>Click a map marker to view equity details</p>
              </div>
            </Card>
          )}

          {/* Route equity bars */}
          <Card>
            <CardHeader title="Route Equity Scores" subtitle="By transit line" />
            <div className="p-4">
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={equityRoutes} layout="vertical" margin={{ top: 0, right: 8, left: 65, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f6" horizontal={false} />
                  <XAxis type="number" domain={[0, 100]} tick={{ fill: "#a8afc7", fontSize: 10, fontFamily: "Poppins" }} />
                  <YAxis type="category" dataKey="name" tick={{ fill: "#7b8191", fontSize: 9, fontFamily: "Poppins" }} width={65} />
                  <Tooltip {...CHART_TOOLTIP} formatter={(v) => [`${v}/100`, "Score"]} />
                  <Bar dataKey="score" radius={[0, 4, 4, 0]}>
                    {equityRoutes.map((r) => <Cell key={r.id} fill={scoreColor(r.score)} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      </div>

      {/* ── Neighbourhood table ─────────────────────── */}
      <Card className="mt-4">
        <CardHeader
          title="Neighbourhood Summary"
          subtitle="All zones ranked by equity score"
          action={<Badge color="muted">{filtered.length} records</Badge>}
        />
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-6 space-y-2">{Array(6).fill(0).map((_, i) => <Skeleton key={i} h="h-8" />)}</div>
          ) : (
            <table className="tl-table">
              <thead>
                <tr>
                  <th className="text-left">Neighbourhood</th>
                  <th>Equity Score</th>
                  <th>Income Index</th>
                  <th>Seniors %</th>
                  <th>Disability %</th>
                  <th>Stop Density</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {[...filtered].sort((a, b) => a.equityScore - b.equityScore).map((n) => (
                  <tr
                    key={n.id}
                    className="cursor-pointer"
                    onClick={() => { setSelected(n); setMapTarget({ lat: n.lat, lng: n.lng }); }}
                    title="Click to fly map to this neighbourhood"
                    style={selected?.id === n.id ? { background: "var(--primary-01)" } : {}}
                  >
                    <td className="font-medium">{n.name}</td>
                    <td className="text-center">
                      <div className="flex items-center justify-center gap-2">
                        <div className="progress-bar w-16 flex-shrink-0">
                          <div className="progress-fill" style={{ width: `${n.equityScore}%`, background: scoreColor(n.equityScore) }} />
                        </div>
                        <span className="font-semibold text-[12px]" style={{ color: scoreColor(n.equityScore) }}>{n.equityScore}</span>
                      </div>
                    </td>
                    <td className="text-center">{n.incomeIndex}/100</td>
                    <td className="text-center">{n.seniorPct}%</td>
                    <td className="text-center">{n.disabilityPct}%</td>
                    <td className="text-center">{n.stopDensity}</td>
                    <td className="text-center">
                      <Badge color={scoreBadge(n.equityScore)}>
                        {n.equityScore >= 75 ? "High" : n.equityScore >= 55 ? "Medium" : n.equityScore >= 40 ? "Low" : "Critical"}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Card>

      {/* ── Equity × Ridership Scatter ───────────── */}
      <Card className="mt-4">
        <CardHeader
          title="Equity vs Ridership Load"
          subtitle="Each dot = a TTC route — low equity + high load = chronically underserved"
          action={<Badge color="info">{scatterData.length} routes matched</Badge>}
        />
        <div className="p-5">
          {loading || scatterData.length === 0 ? (
            <Skeleton h="h-[260px]" />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <ScatterChart margin={{ top: 16, right: 24, left: 0, bottom: 24 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f6" />
                <XAxis type="number" dataKey="equity" domain={[0, 100]} name="Equity Score"
                  tick={{ fill: "#a8afc7", fontSize: 10, fontFamily: "Poppins" }}>
                  <Label value="Equity Score →" position="insideBottom" offset={-14}
                    style={{ fill: "#7b8191", fontSize: 10, fontFamily: "Poppins" }} />
                </XAxis>
                <YAxis type="number" dataKey="loadFactor" domain={[0, 120]} name="Load Factor %"
                  tick={{ fill: "#a8afc7", fontSize: 10, fontFamily: "Poppins" }}>
                  <Label value="Load Factor %" angle={-90} position="insideLeft" offset={12}
                    style={{ fill: "#7b8191", fontSize: 10, fontFamily: "Poppins" }} />
                </YAxis>
                <ZAxis range={[60, 60]} />
                <ReferenceLine x={55}  stroke="#f7b731" strokeDasharray="4 2" label={{ value: "Equity 55", fill: "#b8860b", fontSize: 9, fontFamily: "Poppins" }} />
                <ReferenceLine y={85}  stroke="#f5334f" strokeDasharray="4 2" label={{ value: "85% cap", fill: "#c0112c", fontSize: 9, fontFamily: "Poppins", position: "insideTopRight" }} />
                <Tooltip
                  cursor={{ strokeDasharray: "3 3" }}
                  contentStyle={{ background: "#fff", border: "1px solid #e8e8f7", borderRadius: 10, fontFamily: "Poppins", fontSize: 12 }}
                  formatter={(v, name) => [name === "equity" ? `${v}/100` : `${v}%`, name === "equity" ? "Equity Score" : "Load Factor"]}
                  labelFormatter={(_, payload) => payload?.[0]?.payload?.name ?? ""}
                />
                <Scatter data={scatterData} name="Routes">
                  {scatterData.map((d, i) => (
                    <Cell key={i} fill={scoreColor(d.equity)} fillOpacity={0.82} />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          )}
          <div className="flex flex-wrap items-center gap-4 mt-2 pt-3" style={{ borderTop: "1px solid var(--border-color)" }}>
            <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>Colour = equity band:</span>
            {[["≥75 High","#19b159"],["55–74 Medium","#f7b731"],["40–54 Low","#eb6f33"],["<40 Critical","#f5334f"]].map(([l,c])=>(
              <div key={l} className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: c }} />
                <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>{l}</span>
              </div>
            ))}
            <span className="ml-auto text-[10px]" style={{ color: "var(--text-light)" }}>
              Bottom-left quadrant = low equity + low ridership (neglected). Top-left = low equity + overcrowded (urgent).
            </span>
          </div>
        </div>
      </Card>
    </section>
  );
}
