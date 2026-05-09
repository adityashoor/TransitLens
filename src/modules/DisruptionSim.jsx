import { useState } from "react";
import { MapContainer, Polyline, TileLayer } from "react-leaflet";
import { api, formatNumber } from "../services/api";
import { Badge, Card, CardHeader, Field, KPI, PageHeader, Skeleton } from "../components/ui";

const TORONTO = [43.6532, -79.3832];
const SAMPLE_PATH = [
  [43.6508, -79.3568],
  [43.6527, -79.3580],
  [43.6543, -79.3640],
  [43.6522, -79.3810],
  [43.6476, -79.3950],
  [43.6396, -79.4250],
];

function defaultWindow() {
  const start = new Date();
  start.setHours(8, 0, 0, 0);
  const end = new Date(start);
  end.setHours(10, 0, 0, 0);
  return {
    start_time: start.toISOString().slice(0, 16),
    end_time: end.toISOString().slice(0, 16),
  };
}

export default function DisruptionSim() {
  const initialWindow = defaultWindow();
  const [form, setForm] = useState({
    type: "route_delay",
    affected_ids: "504",
    delay_minutes: 12,
    ...initialWindow,
  });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const payload = {
        type: form.type,
        affected_ids: form.affected_ids.split(",").map((item) => item.trim()).filter(Boolean),
        start_time: new Date(form.start_time).toISOString(),
        end_time: new Date(form.end_time).toISOString(),
      };
      if (form.type === "route_delay") payload.delay_minutes = Number(form.delay_minutes || 0);
      setResult(await api.simulate(payload));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const alternatives = result?.alternatives || [];

  return (
    <section>
      <PageHeader
        title="Disruption Simulation Lab"
        subtitle="Run graph-based TTC route delays, line closures, and stop closures against the backend transit graph."
        action={<Badge color={result ? "green" : "brand"}>{result ? "Simulation complete" : "Ready"}</Badge>}
      />

      <div className="mb-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KPI label="Affected Trips" value={formatNumber(result?.affected_trip_count)} hint="GTFS trip count" tone="red" />
        <KPI label="Affected Stops" value={formatNumber(result?.affected_stops)} hint="Network nodes" tone="amber" />
        <KPI label="Avg Delay" value={result ? `${result.average_delay_minutes}m` : "-"} hint="Sample OD pairs" tone="brand" />
        <KPI label="Passenger Minutes" value={formatNumber(result?.passenger_impact_minutes)} hint="Planning estimate" tone="teal" />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader title="Scenario Builder" subtitle="POST /simulate-disruption" />
          <form onSubmit={submit} className="space-y-4 p-4">
            <Field label="Disruption type">
              <select className="select" value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}>
                <option value="route_delay">Route delay</option>
                <option value="line_closure">Line closure</option>
                <option value="station_closure">Station closure</option>
              </select>
            </Field>
            <Field label="Affected IDs">
              <input className="input" value={form.affected_ids} onChange={(event) => setForm({ ...form, affected_ids: event.target.value })} placeholder="504 or 234" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Start"><input className="input" type="datetime-local" value={form.start_time} onChange={(event) => setForm({ ...form, start_time: event.target.value })} /></Field>
              <Field label="End"><input className="input" type="datetime-local" value={form.end_time} onChange={(event) => setForm({ ...form, end_time: event.target.value })} /></Field>
            </div>
            {form.type === "route_delay" && (
              <Field label="Delay minutes">
                <input className="input" type="number" min="0" max="240" value={form.delay_minutes} onChange={(event) => setForm({ ...form, delay_minutes: event.target.value })} />
              </Field>
            )}
            <button className="button-primary w-full" disabled={loading}>{loading ? "Simulating..." : "Run simulation"}</button>
            {error && <p className="rounded-xl bg-red-50 p-3 text-xs font-semibold text-red-700">{error}</p>}
          </form>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader title="Alternative Path Preview" subtitle="Top route path from the graph simulator" action={<Badge color="slate">{alternatives.length} alternatives</Badge>} />
          <div className="h-[420px] p-3">
            <MapContainer center={TORONTO} zoom={12} className="h-full">
              <TileLayer attribution="OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <Polyline positions={SAMPLE_PATH} pathOptions={{ color: "#6259ca", weight: 5, opacity: 0.88 }} />
              {result && <Polyline positions={SAMPLE_PATH.map(([lat, lon]) => [lat + 0.006, lon + 0.002])} pathOptions={{ color: "#15a6a6", weight: 4, opacity: 0.75, dashArray: "6 8" }} />}
            </MapContainer>
          </div>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader title="Simulation Results" subtitle="Highest-impact sampled OD alternatives" />
        <div className="overflow-auto">
          {loading ? <div className="p-4"><Skeleton /></div> : (
            <table className="table">
              <thead><tr><th>Origin</th><th>Destination</th><th>Baseline</th><th>New</th><th>Delay</th><th>Path</th><th>Status</th></tr></thead>
              <tbody>
                {alternatives.map((row, index) => (
                  <tr key={`${row.origin}-${row.destination}-${index}`}>
                    <td className="font-bold">{row.origin}</td>
                    <td>{row.destination}</td>
                    <td>{row.baseline_time ?? "-"}m</td>
                    <td>{row.new_time ?? "-"}m</td>
                    <td><Badge color={row.delay > 5 ? "red" : row.delay > 0 ? "amber" : "green"}>{row.delay ?? "-"}m</Badge></td>
                    <td className="max-w-[360px] truncate">{(row.path || []).join(" -> ") || "-"}</td>
                    <td>{row.status}</td>
                  </tr>
                ))}
                {!alternatives.length && <tr><td colSpan="7" className="text-center text-[var(--muted)]">Run a simulation to see alternatives.</td></tr>}
              </tbody>
            </table>
          )}
        </div>
      </Card>
    </section>
  );
}
