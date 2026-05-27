import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Play, Pause, RotateCcw, Zap, AlertTriangle } from "lucide-react";
import { ChartCard, PageHeader } from "../components/ui-ext/ChartCard";
import { MapBox } from "../components/map/MapBox";
import { useLiveRoutes, mockApi } from "../mock/api";
import { Slider } from "../components/ui/slider";
import { fmtCompact, fmtNum } from "../lib/format";

export const Route = createFileRoute("/simulator")({
  component: Simulator,
});

interface SimResult {
  type: string;
  affected_ids: string[];
  affected_trip_count: number;
  affected_routes: number | null;
  affected_stops: number | null;
  average_delay_minutes: number | null;
  passenger_impact_minutes: number | null;
  alternatives: Array<{
    origin: string; destination: string;
    baseline_time: number; new_time: number | null;
    delay: number | null; path: string[]; status: string;
  }>;
  impact_summary: Record<string, unknown>;
  notes: string[];
}

function Simulator() {
  const { data: routes = [] } = useLiveRoutes();
  const [routeId, setRouteId] = useState<string>("");
  const [disruptionType, setDisruptionType] = useState<"route_delay" | "line_closure">("route_delay");
  const [delay, setDelay] = useState(15);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SimResult | null>(null);
  const [error, setError] = useState("");

  const disabledIds = useMemo(() => new Set(routeId ? [routeId] : []), [routeId]);
  const route = routes.find((r) => r.id === routeId);

  const affectedRiders = result
    ? result.affected_trip_count * 12
    : route ? Math.round(route.ridership * 0.45 + delay * 1200) : 0;

  const avgDelay = result?.average_delay_minutes ?? (route ? delay : 0);
  const congestionDelta = Math.round(avgDelay * 0.6 + 8);
  const altTravel = result ? `+${avgDelay.toFixed(1)} min` : route ? `+${Math.round(delay * 0.7)} min` : "—";

  async function runSimulation() {
    if (!routeId) return;
    setLoading(true);
    setError("");
    setPlaying(true);
    try {
      const start = new Date(); start.setHours(8, 0, 0, 0);
      const end = new Date(start); end.setHours(10, 0, 0, 0);
      const res = await mockApi.liveSimulate({
        type: disruptionType,
        affected_ids: [routeId],
        delay_minutes: disruptionType === "route_delay" ? delay : null,
        start_time: start.toISOString(),
        end_time: end.toISOString(),
      });
      setResult(res as SimResult);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const reset = () => { setPlaying(false); setTime(0); setResult(null); setError(""); };

  return (
    <div className="px-4 md:px-6 py-6 max-w-[1600px] mx-auto">
      <PageHeader
        title="Disruption Simulator"
        subtitle="What-if modeling for the TTC network · connects to live backend when available"
        action={
          <div className="flex gap-2">
            <button
              onClick={runSimulation}
              disabled={!route || loading}
              className="h-9 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-medium flex items-center gap-2 disabled:opacity-50"
            >
              {loading
                ? <span className="animate-spin size-3.5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full" />
                : playing ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
              {loading ? "Simulating…" : playing ? "Re-run" : "Run simulation"}
            </button>
            <button onClick={reset} className="h-9 px-3 rounded-lg glass-card text-xs flex items-center gap-2">
              <RotateCcw className="size-3.5" /> Reset
            </button>
          </div>
        }
      />

      {error && (
        <div className="mb-4 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive flex items-center gap-2">
          <AlertTriangle className="size-4 shrink-0" /> {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-3 space-y-4">
          <ChartCard title="Scenario controls" subtitle="Configure the disruption">
            <div className="space-y-4">
              <div>
                <label className="text-xs text-muted-foreground">Route to disrupt</label>
                <select
                  value={routeId}
                  onChange={(e) => { setRouteId(e.target.value); setResult(null); }}
                  className="mt-1 w-full h-9 rounded-lg bg-surface border border-border text-sm px-2"
                >
                  <option value="">— choose route —</option>
                  {routes.map((r) => (
                    <option key={r.id} value={r.id}>{r.shortName} · {r.longName}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Disruption type</label>
                <select
                  value={disruptionType}
                  onChange={(e) => setDisruptionType(e.target.value as "route_delay" | "line_closure")}
                  className="mt-1 w-full h-9 rounded-lg bg-surface border border-border text-sm px-2"
                >
                  <option value="route_delay">Route delay</option>
                  <option value="line_closure">Line closure</option>
                </select>
              </div>
              {disruptionType === "route_delay" && (
                <div>
                  <label className="text-xs text-muted-foreground">Delay added: <b>{delay} min</b></label>
                  <Slider value={[delay]} onValueChange={([v]) => setDelay(v)} min={0} max={60} step={1} className="mt-2" />
                </div>
              )}
              <div>
                <label className="text-xs text-muted-foreground">Sim time: <b>{time} min</b></label>
                <Slider value={[time]} onValueChange={([v]) => setTime(v)} min={0} max={120} step={1} className="mt-2" />
              </div>
            </div>
          </ChartCard>

          <ChartCard title="Impact dashboard" subtitle={result ? "Backend response" : "Estimated cascading effects"}>
            <div className="space-y-2">
              {[
                ["Affected riders", fmtCompact(affectedRiders)],
                ["Avg added travel time", altTravel],
                ["Congestion increase", `+${congestionDelta} pts`],
                ["Affected trips", result ? fmtNum(result.affected_trip_count) : route ? "~" + Math.round(delay * 12 + 80) : "0"],
                ["Affected stops", result?.affected_stops != null ? fmtNum(result.affected_stops) : route ? "~" + Math.round(delay * 3) : "0"],
                ["Passenger·min lost", result?.passenger_impact_minutes != null ? fmtCompact(result.passenger_impact_minutes) : "—"],
                ["Affected routes", result?.affected_routes != null ? fmtNum(result.affected_routes) : route ? "1" : "0"],
              ].map(([k, v], i) => (
                <motion.div
                  key={k as string}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="rounded-xl border border-border bg-surface/40 p-3 flex items-center justify-between"
                >
                  <span className="text-xs text-muted-foreground">{k}</span>
                  <span className="font-semibold text-sm">{v}</span>
                </motion.div>
              ))}
            </div>
          </ChartCard>
        </div>

        <ChartCard
          title="Network impact"
          subtitle={route ? `${route.shortName} · ${route.longName} disrupted` : "Select a route to begin"}
          className="lg:col-span-9 h-[640px]"
        >
          <MapBox highlightRouteId={routeId || null} disabledRouteIds={disabledIds} showVehicles />
        </ChartCard>
      </div>

      {/* Backend simulation notes */}
      {result?.notes && result.notes.length > 0 && (
        <div className="mt-4 rounded-xl border border-border bg-surface/40 p-3 text-xs text-muted-foreground space-y-1">
          {result.notes.map((n, i) => <div key={i}>ℹ {n}</div>)}
        </div>
      )}

      <ChartCard title="Simulation log" subtitle="System reactions over time" className="mt-4">
        <ul className="space-y-2">
          {(route ? [
            { t: "00:00", msg: `Disruption begins on ${route.shortName} ${route.longName}.`, sev: "high" },
            { t: "00:02", msg: "Adjacent routes alerted. Headway tightening engaged.", sev: "medium" },
            { t: "00:05", msg: `Riders rerouted via parallel corridors. ${fmtCompact(affectedRiders)} affected.`, sev: "medium" },
            { t: "00:12", msg: `Congestion +${congestionDelta} pts in surrounding 2 km.`, sev: "high" },
            { t: "00:18", msg: "Replacement service deployed.", sev: "low" },
          ] : []).map((e, i) => (
            <motion.li
              key={i}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.08 }}
              className="flex items-center gap-3 text-sm"
            >
              <span className="text-xs text-muted-foreground w-12">{e.t}</span>
              <Zap className={`size-3.5 shrink-0 ${e.sev === "high" ? "text-destructive" : e.sev === "medium" ? "text-warn" : "text-cyan"}`} />
              <span>{e.msg}</span>
            </motion.li>
          ))}
          {!route && <div className="text-sm text-muted-foreground">Select a route to see the simulation log.</div>}
        </ul>
      </ChartCard>

      {result && result.alternatives.length > 0 && (
        <ChartCard title="Alternative routes" subtitle={`${result.alternatives.length} OD pairs from backend simulation`} className="mt-4">
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground uppercase tracking-wider">
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-3 font-medium">Origin</th>
                  <th className="text-left py-2 px-3 font-medium">Destination</th>
                  <th className="text-right py-2 px-3 font-medium">Baseline</th>
                  <th className="text-right py-2 px-3 font-medium">New time</th>
                  <th className="text-right py-2 px-3 font-medium">Delay</th>
                  <th className="text-left py-2 px-3 font-medium">Via</th>
                  <th className="text-left py-2 px-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {result.alternatives.map((row, i) => (
                  <tr key={i} className="border-b border-border last:border-0">
                    <td className="py-2 px-3 font-medium text-xs">{row.origin}</td>
                    <td className="py-2 px-3 text-xs">{row.destination}</td>
                    <td className="py-2 px-3 text-right">{row.baseline_time}m</td>
                    <td className="py-2 px-3 text-right">{row.new_time != null ? `${row.new_time}m` : "—"}</td>
                    <td className="py-2 px-3 text-right">
                      {row.delay != null ? (
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded ${row.delay > 5 ? "bg-destructive/15 text-destructive" : row.delay > 0 ? "bg-warn/15 text-warn" : "bg-success/15 text-success"}`}>
                          +{row.delay}m
                        </span>
                      ) : "—"}
                    </td>
                    <td className="py-2 px-3 text-xs text-muted-foreground truncate max-w-[120px]">
                      {Array.isArray(row.path) ? row.path.join(" → ") : "—"}
                    </td>
                    <td className="py-2 px-3 text-muted-foreground capitalize text-xs">{row.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ChartCard>
      )}
    </div>
  );
}
