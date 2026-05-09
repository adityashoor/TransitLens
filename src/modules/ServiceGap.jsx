import { useState } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, Tooltip as MapTooltip, Marker } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { serviceGapZones, coverageStats } from "../data/mockData";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Card, CardHeader, Badge, PageHeader, StatCard, InfoTag, EmptyState, Btn } from "../components/ui";

const TORONTO = [43.7500, -79.3800];

function gapColor(s) {
  if (s >= 85) return "#f5334f";
  if (s >= 75) return "#eb6f33";
  return "#f7b731";
}

const CHART_TOOLTIP = {
  contentStyle: {
    background: "#fff", border: "1px solid #e8e8f7", borderRadius: 10,
    boxShadow: "0 4px 20px rgba(18,38,63,0.1)", fontFamily: "Poppins, sans-serif", fontSize: 12,
  },
  labelStyle: { color: "#1a1c2e", fontWeight: 600 },
};

/* Coverage comparison chart data */
const coverageChart = [
  { metric: "Pop. Coverage",   before: coverageStats.before.population_covered_pct,  after: coverageStats.after.population_covered_pct,  unit: "%" },
  { metric: "Stops / km²",    before: coverageStats.before.stops_per_km2,            after: coverageStats.after.stops_per_km2,            unit: "" },
];

const walkChart = [
  { metric: "Walk to Stop",   before: coverageStats.before.avg_walk_to_stop_min,     after: coverageStats.after.avg_walk_to_stop_min,     unit: " min" },
];

export default function ServiceGap() {
  const [showProposed, setShowProposed] = useState(false);
  const [selected, setSelected] = useState(null);

  const totalBenefit = serviceGapZones.reduce((a, b) => a + b.estimatedBenefit, 0);

  return (
    <section aria-label="Service Gap Analysis">
      <PageHeader
        title="Service Gap Analysis"
        subtitle="Identifies underserved areas by stop density vs population, and models proposed improvements"
        action={
          <div className="flex items-center gap-2">
            <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>View:</span>
            <div className="toggle-group">
              <button className={`toggle-btn ${!showProposed ? "active" : ""}`} onClick={() => setShowProposed(false)} aria-pressed={!showProposed}>Current Gaps</button>
              <button className={`toggle-btn ${showProposed ? "active" : ""}`} onClick={() => setShowProposed(true)}  aria-pressed={showProposed}
                style={showProposed ? { background: "#19b159", boxShadow: "0 4px 12px rgba(25,177,89,0.3)" } : {}}>
                With Proposals
              </button>
            </div>
          </div>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <StatCard label="Gap Zones"          value={serviceGapZones.length}               color="danger"    change="Priority areas" />
        <StatCard label="Total Population"   value={serviceGapZones.reduce((a,b)=>a+b.population,0).toLocaleString()} color="primary" change="Underserved residents" />
        <StatCard label="Proposed Stops"     value={serviceGapZones.length}               color="success"   change={showProposed ? "Shown on map" : "Toggle to preview"} />
        <StatCard label="Est. New Riders"    value={totalBenefit.toLocaleString()}         color="info"      change="Daily from proposals" changePct={showProposed ? 14.5 : undefined} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Map */}
        <Card className="xl:col-span-2">
          <CardHeader
            title={showProposed ? "Gap Zones + Proposed Stops" : "Current Service Gap Zones"}
            subtitle="Size = population · Colour = gap severity · Click for details"
            action={showProposed ? <Badge color="success">Proposals active</Badge> : <Badge color="danger">{serviceGapZones.length} gaps</Badge>}
          />
          <div style={{ height: 460 }}>
            <MapContainer center={TORONTO} zoom={11} style={{ height: "100%", width: "100%", borderRadius: "0 0 0.75rem 0.75rem" }} aria-label="Service gap map">
              <TileLayer
                attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {/* Gap zones */}
              {serviceGapZones.map((z) => (
                <CircleMarker
                  key={z.id}
                  center={[z.lat, z.lng]}
                  radius={20}
                  pathOptions={{
                    fillColor: gapColor(z.gapScore),
                    fillOpacity: 0.45,
                    color: selected?.id === z.id ? "#1a1c2e" : gapColor(z.gapScore),
                    weight: selected?.id === z.id ? 3 : 1.5,
                  }}
                  eventHandlers={{ click: () => setSelected(z) }}
                >
                  <MapTooltip direction="top" offset={[0, -14]} opacity={0.95}>
                    <div style={{ fontFamily: "Poppins, sans-serif", fontSize: 12 }}>
                      <strong>{z.name}</strong><br />
                      Gap Score: <strong style={{ color: gapColor(z.gapScore) }}>{z.gapScore}/100</strong><br />
                      Pop: {z.population.toLocaleString()}
                    </div>
                  </MapTooltip>
                  <Popup>
                    <div style={{ fontFamily: "Poppins, sans-serif", fontSize: 12, minWidth: 160 }}>
                      <p style={{ fontWeight: 700, marginBottom: 5 }}>{z.name}</p>
                      <table style={{ borderCollapse: "collapse", width: "100%" }}>
                        {[
                          ["Gap Score", `${z.gapScore}/100`],
                          ["Population", z.population.toLocaleString()],
                          ["Stop Density", `${z.stopDensity}/km²`],
                        ].map(([k, v]) => (
                          <tr key={k}><td style={{ color: "#7b8191", paddingRight: 8, paddingBottom: 3 }}>{k}</td><td style={{ fontWeight: 600 }}>{v}</td></tr>
                        ))}
                      </table>
                    </div>
                  </Popup>
                </CircleMarker>
              ))}

              {/* Proposed stops */}
              {showProposed && serviceGapZones.map((z) => (
                <CircleMarker
                  key={`p-${z.id}`}
                  center={[z.proposedStop.lat, z.proposedStop.lng]}
                  radius={9}
                  pathOptions={{ fillColor: "#19b159", fillOpacity: 1, color: "#fff", weight: 2.5 }}
                >
                  <MapTooltip direction="top" offset={[0, -10]} opacity={0.95}>
                    <div style={{ fontFamily: "Poppins, sans-serif", fontSize: 12 }}>
                      <strong style={{ color: "#19b159" }}>{z.proposedStop.name}</strong><br />
                      Est. new riders: <strong>+{z.estimatedBenefit.toLocaleString()}/day</strong>
                    </div>
                  </MapTooltip>
                  <Popup>
                    <div style={{ fontFamily: "Poppins, sans-serif", fontSize: 12, minWidth: 150 }}>
                      <p style={{ fontWeight: 700, color: "#19b159", marginBottom: 4 }}>{z.proposedStop.name}</p>
                      <p>Est. new daily riders: <strong>+{z.estimatedBenefit.toLocaleString()}</strong></p>
                    </div>
                  </Popup>
                </CircleMarker>
              ))}
            </MapContainer>
          </div>
        </Card>

        {/* Right panel */}
        <div className="flex flex-col gap-4">
          {/* Before / After coverage */}
          <Card>
            <CardHeader title="Coverage Impact" subtitle={showProposed ? "With proposed stops" : "Current baseline"} />
            <div className="p-4 space-y-3">
              {[
                { label: "Population Covered", before: coverageStats.before.population_covered_pct, after: coverageStats.after.population_covered_pct, unit: "%",    higherIsBetter: true  },
                { label: "Avg Walk to Stop",   before: coverageStats.before.avg_walk_to_stop_min,   after: coverageStats.after.avg_walk_to_stop_min,   unit: " min", higherIsBetter: false },
                { label: "Stops per km²",      before: coverageStats.before.stops_per_km2,          after: coverageStats.after.stops_per_km2,          unit: "",     higherIsBetter: true  },
              ].map((m) => {
                const delta = m.after - m.before;
                const positive = m.higherIsBetter ? delta > 0 : delta < 0;
                const shown = showProposed ? m.after : m.before;
                return (
                  <div key={m.label} className="rounded-xl p-3" style={{ background: "var(--body-bg)", border: "1px solid var(--border-color)" }}>
                    <div className="flex items-center justify-between">
                      <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>{m.label}</p>
                      {showProposed && (
                        <span className={`text-[10px] font-bold ${positive ? "text-green-600" : "text-red-500"}`}>
                          {positive ? "▲" : "▼"} {Math.abs(delta).toFixed(1)}{m.unit}
                        </span>
                      )}
                    </div>
                    <div className="flex items-end gap-2 mt-1">
                      {showProposed && <span className="text-[11px] line-through" style={{ color: "var(--text-light)" }}>{m.before}{m.unit}</span>}
                      <span className="text-[18px] font-bold" style={{ color: "var(--text-primary)" }}>{shown}{m.unit}</span>
                    </div>
                  </div>
                );
              })}
            </div>
            {showProposed && (
              <div className="px-4 pb-4">
                <InfoTag color="success">✓ Proposals improve population coverage by +11.5 percentage points</InfoTag>
              </div>
            )}
          </Card>

          {/* Priority list */}
          <Card>
            <CardHeader title="Priority Gap Zones" subtitle="Ranked by gap score" action={<Badge color="danger">{serviceGapZones.length} zones</Badge>} />
            <div>
              {[...serviceGapZones]
                .sort((a, b) => b.gapScore - a.gapScore)
                .map((z, i) => (
                  <button
                    key={z.id}
                    onClick={() => setSelected(z)}
                    className="w-full flex items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-[#fafafe]"
                    style={{
                      borderBottom: i < serviceGapZones.length - 1 ? "1px solid var(--border-color)" : "none",
                      background: selected?.id === z.id ? "var(--primary-01)" : "transparent",
                    }}
                  >
                    <span
                      className="shrink-0 mt-0.5 w-5 h-5 rounded-full flex items-center justify-center text-white font-bold text-[9px]"
                      style={{ background: gapColor(z.gapScore) }}
                    >
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-semibold truncate" style={{ color: "var(--text-primary)" }}>{z.name}</p>
                      <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                        Gap {z.gapScore}/100 · {z.population.toLocaleString()} residents
                      </p>
                    </div>
                    <span className="shrink-0 text-[11px] font-bold" style={{ color: gapColor(z.gapScore) }}>{z.gapScore}</span>
                  </button>
                ))}
            </div>
          </Card>

          {/* Selected zone detail */}
          {selected && (
            <Card>
              <CardHeader
                title={selected.name}
                subtitle="Zone detail"
                action={
                  <button onClick={() => setSelected(null)} className="w-6 h-6 rounded-full flex items-center justify-center text-sm hover:bg-gray-100" style={{ color: "var(--text-muted)" }}>✕</button>
                }
              />
              <div className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-[28px] font-bold" style={{ color: gapColor(selected.gapScore) }}>{selected.gapScore}</span>
                  <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>/ 100<br />Gap Score</p>
                </div>
                <div className="progress-bar mb-4">
                  <div className="progress-fill" style={{ width: `${selected.gapScore}%`, background: `linear-gradient(to right, ${gapColor(selected.gapScore)}, ${gapColor(selected.gapScore)}bb)` }} />
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px] mb-3">
                  {[
                    ["Population",    selected.population.toLocaleString()],
                    ["Stop Density",  `${selected.stopDensity}/km²`],
                  ].map(([k, v]) => (
                    <div key={k} className="rounded-lg p-2.5" style={{ background: "var(--body-bg)" }}>
                      <p style={{ color: "var(--text-muted)" }}>{k}</p>
                      <p className="font-semibold mt-0.5" style={{ color: "var(--text-primary)" }}>{v}</p>
                    </div>
                  ))}
                </div>
                <InfoTag color="success">
                  <div>
                    <p className="font-semibold">{selected.proposedStop.name}</p>
                    <p className="font-normal mt-0.5">Est. +{selected.estimatedBenefit.toLocaleString()} new riders/day</p>
                  </div>
                </InfoTag>
              </div>
            </Card>
          )}
        </div>
      </div>
    </section>
  );
}
