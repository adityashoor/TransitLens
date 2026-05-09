import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { MapContainer, CircleMarker, Popup, TileLayer } from "react-leaflet";
import { useApi } from "../hooks/useApi";
import { api, formatNumber } from "../services/api";
import { Badge, Card, CardHeader, KPI, PageHeader, Skeleton } from "../components/ui";
import { chartTooltip } from "../components/chartConfig";

const TORONTO = [43.711, -79.38];

function scoreColor(score) {
  if (score < 40) return "#e5484d";
  if (score < 65) return "#e7a21a";
  return "#17a36b";
}

function pseudoPoint(id) {
  const n = Number(String(id).replace(/\D/g, "")) || 1;
  const col = n % 18;
  const row = Math.floor(n / 18);
  return [43.60 + row * 0.024, -79.61 + col * 0.030];
}

export default function EquityScoring() {
  const [sort, setSort] = useState("lowest");
  const [selected, setSelected] = useState(null);
  const equity = useApi(() => api.equity(sort, 50), [sort], []);

  const rows = useMemo(() => equity.data || [], [equity.data]);
  const urgent = rows.filter((row) => row.score < 40);
  const avgScore = rows.length ? rows.reduce((sum, row) => sum + row.score, 0) / rows.length : 0;
  const chartRows = useMemo(() => rows.slice(0, 12).map((row) => ({
    name: row.geography_name,
    score: row.score,
    income: row.median_income,
    stops: row.stop_density,
  })), [rows]);

  return (
    <section>
      <PageHeader
        title="Neighbourhood Equity Scoring"
        subtitle="Toronto neighbourhoods ranked with demographic need, stop density, ridership per capita, and distance-to-stop metrics."
        action={
          <div className="segmented">
            {["lowest", "highest", "name"].map((item) => (
              <button key={item} className={sort === item ? "active" : ""} onClick={() => setSort(item)}>
                {item}
              </button>
            ))}
          </div>
        }
      />

      <div className="mb-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KPI label="Areas Loaded" value={formatNumber(rows.length)} hint="Neighbourhood score rows" tone="brand" />
        <KPI label="Improvement Need" value={urgent.length} hint="Score below 40" tone="red" />
        <KPI label="Average Score" value={avgScore ? avgScore.toFixed(1) : "-"} hint="Current list average" tone="teal" />
        <KPI label="Closest Stop" value={rows.length ? `${Math.min(...rows.map((r) => r.distance_to_stop || 9999)).toFixed(0)}m` : "-"} hint="Best representative point" tone="green" />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Equity Map" subtitle="Neighbourhood score points, coloured by improvement need" action={<Badge color="brand">Toronto 158 model</Badge>} />
          <div className="h-[470px] p-3">
            {equity.loading ? <Skeleton /> : (
              <MapContainer center={TORONTO} zoom={10} className="h-full">
                <TileLayer attribution="OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                {rows.map((area) => {
                  const point = pseudoPoint(area.geography_id);
                  return (
                    <CircleMarker
                      key={area.geography_id}
                      center={point}
                      radius={area.score < 40 ? 10 : 7}
                      pathOptions={{
                        color: selected?.geography_id === area.geography_id ? "#172033" : scoreColor(area.score),
                        fillColor: scoreColor(area.score),
                        fillOpacity: 0.78,
                        weight: selected?.geography_id === area.geography_id ? 3 : 1.5,
                      }}
                      eventHandlers={{ click: () => setSelected(area) }}
                    >
                      <Popup>
                        <div className="min-w-[190px]">
                          <p className="font-bold">{area.geography_name}</p>
                          <p className="mt-1 text-xs text-slate-500">Score {area.score} · {area.metrics?.priority_level}</p>
                          <p className="mt-2 text-xs">Stop density: <b>{area.stop_density}</b></p>
                          <p className="text-xs">Median income: <b>${formatNumber(area.median_income)}</b></p>
                        </div>
                      </Popup>
                    </CircleMarker>
                  );
                })}
              </MapContainer>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Selected Area" subtitle="Raw Part 6 metrics" />
          <div className="p-4">
            {selected ? (
              <div>
                <Badge color={selected.score < 40 ? "red" : selected.score < 65 ? "amber" : "green"}>{selected.score} score</Badge>
                <h3 className="mt-4 text-xl font-extrabold">{selected.geography_name}</h3>
                <div className="mt-4 grid gap-3">
                  {[
                    ["Stop density", selected.stop_density],
                    ["Ridership per capita", selected.ridership_per_capita],
                    ["Median income", `$${formatNumber(selected.median_income)}`],
                    ["Vulnerable share", `${selected.vulnerable_share}%`],
                    ["Distance to stop", `${selected.distance_to_stop}m`],
                  ].map(([label, value]) => (
                    <div key={label} className="flex items-center justify-between rounded-xl bg-[var(--panel-soft)] px-3 py-2">
                      <span className="text-xs text-[var(--muted)]">{label}</span>
                      <b className="text-sm">{value}</b>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-[var(--muted)]">Select a point on the map or row below.</p>
            )}
          </div>
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader title="Score Ranking" subtitle="Current sort order" />
          <div className="card-pad">
            <ResponsiveContainer width="100%" height={310}>
              <BarChart data={chartRows} layout="vertical" margin={{ left: 112, right: 12 }}>
                <CartesianGrid stroke="#edf0f7" strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: "#6f7a8d" }} />
                <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 10, fill: "#6f7a8d" }} />
                <Tooltip {...chartTooltip} />
                <Bar dataKey="score" radius={[0, 6, 6, 0]}>
                  {chartRows.map((row) => <Cell key={row.name} fill={scoreColor(row.score)} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <CardHeader title="Neighbourhood Table" subtitle="Click a row to inspect" />
          <div className="max-h-[360px] overflow-auto">
            <table className="table">
              <thead><tr><th>Area</th><th>Score</th><th>Income</th><th>Stop dist.</th></tr></thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.geography_id} onClick={() => setSelected(row)} className="cursor-pointer">
                    <td className="font-bold">{row.geography_name}</td>
                    <td><Badge color={row.score < 40 ? "red" : row.score < 65 ? "amber" : "green"}>{row.score}</Badge></td>
                    <td>${formatNumber(row.median_income)}</td>
                    <td>{row.distance_to_stop}m</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </section>
  );
}
