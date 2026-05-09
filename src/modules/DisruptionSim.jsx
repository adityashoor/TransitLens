import { useState } from "react";
import { MapContainer, TileLayer, CircleMarker, Polyline, Popup, Tooltip as MapTooltip } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { transitNetwork, disruptionScenarios } from "../data/mockData";
import { Card, CardHeader, Badge, PageHeader, StatCard, InfoTag, EmptyState } from "../components/ui";

const TORONTO = [43.6600, -79.3900];

const RELIABILITY_BADGE = { High: "success", Medium: "warning", Low: "danger" };

export default function DisruptionSim() {
  const [disrupted, setDisrupted] = useState(null);
  const [simulating, setSimulating] = useState(false);

  const scenario = disrupted
    ? (disruptionScenarios[disrupted.id] ?? disruptionScenarios.default)
    : null;

  function simulate(station) {
    setSimulating(true);
    setTimeout(() => { setDisrupted(station); setSimulating(false); }, 900);
  }

  const line1Coords = transitNetwork.routes[0].stations
    .map((id) => transitNetwork.stations.find((s) => s.id === id))
    .filter(Boolean).map((s) => [s.lat, s.lng]);

  const line2Coords = transitNetwork.routes[2].stations
    .map((id) => transitNetwork.stations.find((s) => s.id === id))
    .filter(Boolean).map((s) => [s.lat, s.lng]);

  return (
    <section aria-label="Disruption Simulation">
      <PageHeader
        title="Disruption Simulation"
        subtitle="Click any station on the map to simulate a service disruption and see cascading impacts"
        action={disrupted
          ? <Badge color="danger">⚡ Disruption active — {disrupted.name}</Badge>
          : <Badge color="success">All systems normal</Badge>
        }
      />

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <StatCard label="Stations Mapped"    value={transitNetwork.stations.length}       color="primary"   change="Downtown core" />
        <StatCard label="Routes Simulated"   value={transitNetwork.routes.length}         color="info"      change="Lines + streetcars" />
        <StatCard label="Disrupted Station"  value={disrupted ? disrupted.name : "None"}  color={disrupted ? "danger" : "success"} change={disrupted ? "Active disruption" : "Click to simulate"} />
        <StatCard label="Impacted Riders"    value={scenario ? scenario.impactedRiders.toLocaleString() : "—"} color="warning" change={scenario ? "Estimated affected" : "No disruption"} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Map */}
        <Card className="xl:col-span-2">
          <CardHeader
            title="Transit Network Map"
            subtitle="Click a station to simulate disruption"
            action={
              disrupted && (
                <button
                  onClick={() => setDisrupted(null)}
                  className="text-[11px] font-medium px-3 py-1 rounded-lg transition-colors"
                  style={{ background: "rgba(245,51,79,0.1)", color: "var(--danger)", border: "1px solid rgba(245,51,79,0.25)" }}
                >
                  Clear disruption
                </button>
              )
            }
          />
          <div className="relative" style={{ height: 460 }}>
            {simulating && (
              <div className="absolute inset-0 z-[9999] flex items-center justify-center rounded-b-[var(--card-radius)]" style={{ background: "rgba(255,255,255,0.85)" }}>
                <div className="flex items-center gap-3 bg-white rounded-xl px-6 py-4 shadow-xl border" style={{ borderColor: "var(--border-color)" }}>
                  <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "var(--primary)", borderTopColor: "transparent" }} />
                  <span className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>Simulating disruption…</span>
                </div>
              </div>
            )}
            <MapContainer center={TORONTO} zoom={14} style={{ height: "100%", width: "100%", borderRadius: "0 0 0.75rem 0.75rem" }} aria-label="Transit network map">
              <TileLayer
                attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <Polyline positions={line1Coords} pathOptions={{ color: "#f7b731", weight: 5, opacity: 0.9 }} />
              <Polyline positions={line2Coords} pathOptions={{ color: "#4ec2f0", weight: 5, opacity: 0.9 }} />

              {transitNetwork.stations.map((station) => {
                const isD = disrupted?.id === station.id;
                return (
                  <CircleMarker
                    key={station.id}
                    center={[station.lat, station.lng]}
                    radius={isD ? 14 : 9}
                    pathOptions={{
                      fillColor: isD ? "#f5334f" : "#1a1c2e",
                      fillOpacity: 1,
                      color: isD ? "#fca5a5" : "#fff",
                      weight: isD ? 3 : 2,
                    }}
                    eventHandlers={{ click: () => simulate(station) }}
                  >
                    <MapTooltip direction="top" offset={[0, -12]} opacity={0.97}>
                      <div style={{ fontFamily: "Poppins, sans-serif", fontSize: 12 }}>
                        <strong>{station.name}</strong><br />
                        <span style={{ color: "#7b8191" }}>{station.lines.join(" · ")}</span><br />
                        {isD
                          ? <span style={{ color: "#f5334f", fontWeight: 600 }}>⚡ Disruption active</span>
                          : <span style={{ color: "#6259ca" }}>Click to simulate</span>
                        }
                      </div>
                    </MapTooltip>
                    <Popup>
                      <div style={{ fontFamily: "Poppins, sans-serif", fontSize: 12, minWidth: 150 }}>
                        <p style={{ fontWeight: 700, marginBottom: 4 }}>{station.name}</p>
                        <p style={{ color: "#7b8191", marginBottom: 8 }}>{station.lines.join(" · ")}</p>
                        {!isD && (
                          <button
                            onClick={() => simulate(station)}
                            style={{ background: "linear-gradient(135deg,#f5334f,#ff6b7a)", color: "#fff", border: "none", borderRadius: 6, padding: "5px 12px", fontSize: 11, cursor: "pointer", fontFamily: "Poppins" }}
                          >
                            ⚡ Simulate Disruption
                          </button>
                        )}
                      </div>
                    </Popup>
                  </CircleMarker>
                );
              })}
            </MapContainer>
          </div>
        </Card>

        {/* Results panel */}
        <div className="flex flex-col gap-4">
          {!disrupted ? (
            <Card>
              <EmptyState
                icon="⚡"
                title="Select a station"
                body="Click any station on the map to simulate a disruption and view cascading impacts and alternatives."
              />
            </Card>
          ) : (
            <>
              {/* Disruption summary */}
              <Card>
                <div className="p-4" style={{ background: "rgba(245,51,79,0.04)", borderRadius: "var(--card-radius) var(--card-radius) 0 0", borderBottom: "1px solid rgba(245,51,79,0.15)" }}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: "var(--danger)" }} />
                    <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--danger)" }}>Active Disruption</span>
                  </div>
                  <p className="text-[16px] font-bold" style={{ color: "var(--text-primary)" }}>{disrupted.name}</p>
                  <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>{disrupted.lines?.join(" · ")}</p>
                </div>
                <div className="grid grid-cols-2 gap-3 p-4">
                  <div className="rounded-xl p-3 text-center" style={{ background: "rgba(247,183,49,0.1)" }}>
                    <p className="text-[10px] mb-1" style={{ color: "var(--text-muted)" }}>Recovery Time</p>
                    <p className="text-[20px] font-bold" style={{ color: "#c88c00" }}>{scenario.recoveryTime}</p>
                  </div>
                  <div className="rounded-xl p-3 text-center" style={{ background: "rgba(245,51,79,0.08)" }}>
                    <p className="text-[10px] mb-1" style={{ color: "var(--text-muted)" }}>Impacted Riders</p>
                    <p className="text-[20px] font-bold" style={{ color: "var(--danger)" }}>{scenario.impactedRiders.toLocaleString()}</p>
                  </div>
                </div>
              </Card>

              {/* Affected routes */}
              <Card>
                <CardHeader title="Affected Routes" subtitle="Services impacted by disruption" />
                <div className="p-4 flex flex-wrap gap-2">
                  {scenario.affectedRoutes.map((r) => (
                    <Badge key={r} color="warning">{r}</Badge>
                  ))}
                </div>
              </Card>

              {/* Alternatives */}
              <Card>
                <CardHeader title="Alternative Routes" subtitle="Recommended detours" action={<Badge color="info">Top 3</Badge>} />
                <div className="p-4 space-y-3">
                  {scenario.alternatives.map((alt) => (
                    <div
                      key={alt.rank}
                      className="flex items-start gap-3 p-3 rounded-xl"
                      style={{ background: "var(--body-bg)", border: "1px solid var(--border-color)" }}
                    >
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[11px] font-bold shrink-0"
                        style={{ background: "linear-gradient(135deg, var(--primary), var(--primary-light))" }}
                      >
                        {alt.rank}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-semibold" style={{ color: "var(--text-primary)" }}>{alt.route}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>{alt.eta}</span>
                          <Badge color={RELIABILITY_BADGE[alt.reliability]}>{alt.reliability}</Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </>
          )}

          {/* Map legend */}
          <Card>
            <CardHeader title="Legend" />
            <div className="p-4 space-y-2.5">
              {[
                { color: "#f7b731", label: "Line 1 (Yonge-University/Spadina)" },
                { color: "#4ec2f0", label: "Line 2 (Bloor-Danforth)"           },
                { color: "#f5334f", label: "Disrupted station"                  },
                { color: "#1a1c2e", label: "Normal station"                     },
              ].map((l) => (
                <div key={l.label} className="flex items-center gap-2.5">
                  <span className="w-3 h-3 rounded-full shrink-0" style={{ background: l.color }} aria-hidden="true" />
                  <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>{l.label}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </section>
  );
}
