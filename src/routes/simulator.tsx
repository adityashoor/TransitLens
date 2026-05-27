import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Play, Pause, RotateCcw, Zap } from "lucide-react";
import { ChartCard, PageHeader } from "@/components/ui-ext/ChartCard";
import { MapBox } from "@/components/map/MapBox";
import { useNetwork } from "@/mock/api";
import { Slider } from "@/components/ui/slider";
import { fmtCompact } from "@/lib/format";

export const Route = createFileRoute("/simulator")({
  head: () => ({
    meta: [
      { title: "Disruption Simulator — TransitLens" },
      { name: "description", content: "Model disruptions: close routes, induce delays, and visualize cascading impact across the TTC network." },
    ],
  }),
  component: Simulator,
});

function Simulator() {
  const { data: net } = useNetwork();
  const [routeId, setRouteId] = useState<string>("");
  const [delay, setDelay] = useState(15);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);

  const disabledIds = useMemo(() => new Set(routeId ? [routeId] : []), [routeId]);

  const route = net?.routes.find((r) => r.id === routeId);
  const affectedRiders = route ? Math.round(route.ridership * 0.45 + delay * 1200) : 0;
  const congestionDelta = route ? Math.round(delay * 0.6 + 8) : 0;
  const altTravel = route ? `+${Math.round(delay * 0.7)} min` : "—";

  const start = () => setPlaying(true);
  const reset = () => { setPlaying(false); setTime(0); };

  return (
    <div className="px-4 md:px-6 py-6 max-w-[1600px] mx-auto">
      <PageHeader
        title="Disruption Simulator"
        subtitle="What-if modeling for the TTC network"
        action={
          <div className="flex gap-2">
            <button onClick={start} disabled={!route} className="h-9 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-medium flex items-center gap-2 disabled:opacity-50">
              {playing ? <Pause className="size-3.5" /> : <Play className="size-3.5" />} {playing ? "Pause" : "Run simulation"}
            </button>
            <button onClick={reset} className="h-9 px-3 rounded-lg glass-card text-xs flex items-center gap-2"><RotateCcw className="size-3.5" /> Reset</button>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-3 space-y-4">
          <ChartCard title="Scenario controls" subtitle="Configure the disruption">
            <div className="space-y-4">
              <div>
                <label className="text-xs text-muted-foreground">Route to disrupt</label>
                <select
                  value={routeId}
                  onChange={(e) => setRouteId(e.target.value)}
                  className="mt-1 w-full h-9 rounded-lg bg-surface border border-border text-sm px-2"
                >
                  <option value="">— choose route —</option>
                  {net?.routes.map((r) => (
                    <option key={r.id} value={r.id}>{r.shortName} · {r.longName}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Delay added: <b>{delay} min</b></label>
                <Slider value={[delay]} onValueChange={([v]) => setDelay(v)} min={0} max={60} step={1} className="mt-2" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Sim time: <b>{time} min</b></label>
                <Slider value={[time]} onValueChange={([v]) => setTime(v)} min={0} max={120} step={1} className="mt-2" />
              </div>
            </div>
          </ChartCard>

          <ChartCard title="Impact dashboard" subtitle="Live cascading effects">
            <div className="space-y-2">
              {[
                ["Affected riders", fmtCompact(affectedRiders)],
                ["Avg added travel time", altTravel],
                ["Congestion increase", `+${congestionDelta} pts`],
                ["Alt routes activated", route ? "3" : "0"],
              ].map(([k, v], i) => (
                <motion.div
                  key={k}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="rounded-xl border border-border bg-surface/40 p-3 flex items-center justify-between"
                >
                  <span className="text-xs text-muted-foreground">{k}</span>
                  <span className="font-semibold">{v}</span>
                </motion.div>
              ))}
            </div>
          </ChartCard>
        </div>

        <ChartCard title="Network impact" subtitle={route ? `${route.shortName} · ${route.longName} disrupted` : "Select a route to begin"} className="lg:col-span-9 h-[640px]">
          <MapBox
            highlightRouteId={routeId || null}
            disabledRouteIds={disabledIds}
            showVehicles
          />
        </ChartCard>
      </div>

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
              <Zap className={`size-3.5 ${e.sev === "high" ? "text-destructive" : e.sev === "medium" ? "text-warn" : "text-cyan"}`} />
              <span>{e.msg}</span>
            </motion.li>
          ))}
          {!route && <div className="text-sm text-muted-foreground">Select a route to see the simulation log.</div>}
        </ul>
      </ChartCard>
    </div>
  );
}
