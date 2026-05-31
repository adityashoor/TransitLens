import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Pause, RotateCcw, Zap, AlertTriangle, CheckCircle, Info } from "lucide-react";
import { ChartCard, PageHeader } from "@/components/ui-ext/ChartCard";
import { MapBox } from "@/components/map/MapBox";
import { useNetwork, useRouteStats } from "@/mock/api";
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

// Simulation log events — parameterised by route + impact values
function buildLog(
  shortName: string,
  longName: string,
  affectedRiders: number,
  congestionDelta: number,
  altCount: number,
) {
  return [
    { t:  0, msg: `Route ${shortName} (${longName}) disrupted. Service suspended.`,                    sev: "high"   },
    { t:  2, msg: "OCC alerted. Headway adjustment protocol initiated.",                                sev: "medium" },
    { t:  5, msg: `${fmtCompact(affectedRiders)} riders affected. Diversion messaging sent to PRESTO.`, sev: "high"   },
    { t: 10, msg: `${altCount} parallel route${altCount !== 1 ? "s" : ""} absorbing overflow passengers.`, sev: "medium" },
    { t: 15, msg: `Congestion index rising +${congestionDelta} pts in surrounding 2 km corridor.`,     sev: "high"   },
    { t: 20, msg: "Express short-turn service deployed on adjacent corridor.",                          sev: "medium" },
    { t: 25, msg: "Crowding alerts issued at 3 connecting subway stations.",                            sev: "medium" },
    { t: 30, msg: "Headway normalising. Incident response closing.",                                    sev: "low"    },
  ];
}

const SEV_ICON = {
  high:   <AlertTriangle className="size-3.5 text-destructive shrink-0" />,
  medium: <Zap           className="size-3.5 text-warn shrink-0" />,
  low:    <CheckCircle   className="size-3.5 text-cyan shrink-0" />,
};

function Simulator() {
  const { data: net } = useNetwork();
  const { data: stats = {} } = useRouteStats();

  const [routeId, setRouteId]   = useState("");
  const [delay,   setDelay]     = useState(15);
  const [time,    setTime]      = useState(0);
  const [playing, setPlaying]   = useState(false);

  const disabledIds = useMemo(() => new Set(routeId ? [routeId] : []), [routeId]);
  const route = net?.routes.find((r) => r.id === routeId);

  // Find parallel routes (same mode, different id) for alt-route count
  const altRoutes = useMemo(() => {
    if (!route || !net) return [];
    return net.routes
      .filter((r) => r.id !== route.id && r.mode === route.mode)
      .slice(0, 3);
  }, [route, net]);

  // Impact model: use real ridership from route + real on-time from CKAN stats
  const realOnTime    = stats[routeId]?.onTimePct   ?? route?.onTime    ?? 80;
  const realRidership = route?.ridership             ?? 0;

  // How many riders are affected depends on delay severity and route frequency
  const affectedRiders = route
    ? Math.round(realRidership * (0.35 + (delay / 60) * 0.30))
    : 0;

  // Congestion increase: worse for already-delayed routes
  const congestionDelta = route
    ? Math.round((delay * 0.55) + ((100 - realOnTime) * 0.25) + 6)
    : 0;

  // Avg added travel time for displaced riders (minutes)
  const avgAddedTime = route ? Math.round(delay * 0.65 + 4) : 0;

  const logEvents = useMemo(
    () => route
      ? buildLog(route.shortName, route.longName, affectedRiders, congestionDelta, altRoutes.length)
      : [],
    [route, affectedRiders, congestionDelta, altRoutes.length],
  );

  const visibleLog = logEvents.filter((e) => e.t <= time);

  // Timer: advances 1 sim-minute every 400ms when playing
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      setTime((prev) => {
        if (prev >= 30) { setPlaying(false); return prev; }
        return prev + 1;
      });
    }, 400);
    return () => clearInterval(id);
  }, [playing]);

  const handleRun = useCallback(() => {
    if (!route) return;
    if (playing) { setPlaying(false); return; }
    if (time >= 30) setTime(0);
    setPlaying(true);
  }, [route, playing, time]);

  const handleReset = useCallback(() => {
    setPlaying(false);
    setTime(0);
  }, []);

  const handleRouteChange = (id: string) => {
    setRouteId(id);
    setPlaying(false);
    setTime(0);
  };

  const progress = Math.round((time / 30) * 100);

  return (
    <div className="px-4 md:px-6 py-6 max-w-[1600px] mx-auto">
      <PageHeader
        title="Disruption Simulator"
        subtitle="What-if modelling for the TTC network · parametric impact from real route data"
        action={
          <div className="flex gap-2">
            <button
              onClick={handleRun}
              disabled={!route}
              className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-xs font-medium flex items-center gap-2 disabled:opacity-40"
            >
              {playing ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
              {playing ? "Pause" : "Run simulation"}
            </button>
            <button onClick={handleReset} className="h-9 px-3 rounded-lg glass-card text-xs flex items-center gap-2">
              <RotateCcw className="size-3.5" /> Reset
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Controls */}
        <div className="lg:col-span-3 space-y-4">
          <ChartCard title="Scenario controls" subtitle="Configure the disruption">
            <div className="space-y-5">
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Route to disrupt</label>
                <select
                  value={routeId}
                  onChange={(e) => handleRouteChange(e.target.value)}
                  className="w-full h-9 rounded-lg bg-surface border border-border text-sm px-2 outline-none focus:ring-2 focus:ring-ring/40"
                >
                  <option value="">— choose route —</option>
                  {/* Group by mode */}
                  {(["subway", "streetcar", "bus"] as const).map((mode) => {
                    const modeRoutes = net?.routes.filter((r) => r.mode === mode) ?? [];
                    if (!modeRoutes.length) return null;
                    return (
                      <optgroup key={mode} label={mode.charAt(0).toUpperCase() + mode.slice(1)}>
                        {modeRoutes.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.shortName} · {r.longName.slice(0, 28)}
                          </option>
                        ))}
                      </optgroup>
                    );
                  })}
                </select>
              </div>

              <div>
                <label className="text-xs text-muted-foreground block mb-2">
                  Delay added: <b className="text-foreground">{delay} min</b>
                </label>
                <Slider value={[delay]} onValueChange={([v]) => setDelay(v)} min={0} max={60} step={5} />
                <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                  <span>0 min</span><span>30</span><span>60 min</span>
                </div>
              </div>

              {/* Simulation progress bar */}
              <div>
                <div className="flex justify-between mb-1">
                  <label className="text-xs text-muted-foreground">
                    Sim time: <b className="text-foreground">{time} min</b>
                  </label>
                  {playing && <span className="text-[10px] text-primary animate-pulse">Running…</span>}
                  {time >= 30 && !playing && <span className="text-[10px] text-success">Complete</span>}
                </div>
                <div className="h-2 rounded-full bg-surface overflow-hidden">
                  <motion.div
                    className="h-full rounded-full bg-primary"
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                  <span>0</span><span>15 min</span><span>30 min</span>
                </div>
              </div>

              {/* Real data badge */}
              {route && stats[routeId] && (
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground bg-surface/40 rounded-lg px-2 py-1.5 border border-border">
                  <Info className="size-3 text-cyan shrink-0" />
                  Impact uses real on-time rate ({realOnTime}%) from CKAN 2025 data
                </div>
              )}
            </div>
          </ChartCard>

          {/* Impact dashboard */}
          <ChartCard title="Impact dashboard" subtitle="Live cascading effects">
            <div className="space-y-2">
              {[
                { label: "Affected riders",       value: route ? fmtCompact(affectedRiders) : "0",           warn: affectedRiders > 50_000 },
                { label: "Avg added travel time",  value: route ? `+${avgAddedTime} min` : "—",               warn: avgAddedTime > 15 },
                { label: "Congestion increase",    value: route ? `+${congestionDelta} pts` : "+0 pts",       warn: congestionDelta > 20 },
                { label: "Alt routes activated",   value: route ? String(altRoutes.length) : "0",             warn: false },
              ].map(({ label, value, warn }) => (
                <motion.div
                  key={label}
                  layout
                  className={`rounded-xl border p-3 flex items-center justify-between transition-colors ${
                    warn && route ? "border-warn/30 bg-warn/5" : "border-border bg-surface/40"
                  }`}
                >
                  <span className="text-xs text-muted-foreground">{label}</span>
                  <span className={`font-semibold text-sm ${warn && route ? "text-warn" : ""}`}>{value}</span>
                </motion.div>
              ))}
            </div>

            {/* Alt routes list */}
            {route && altRoutes.length > 0 && (
              <div className="mt-3 space-y-1">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">Parallel routes</div>
                {altRoutes.map((r) => (
                  <div key={r.id} className="flex items-center gap-2">
                    <span
                      className="size-5 rounded text-[9px] font-bold flex items-center justify-center text-white shrink-0"
                      style={{ background: r.color }}
                    >{r.shortName}</span>
                    <span className="text-[10px] text-muted-foreground truncate">{r.longName}</span>
                  </div>
                ))}
              </div>
            )}
          </ChartCard>
        </div>

        {/* Map */}
        <ChartCard
          title="Network impact"
          subtitle={route ? `${route.shortName} · ${route.longName} — disrupted` : "Select a route to begin"}
          className="lg:col-span-9 h-[640px]"
        >
          {/* key forces MapContainer remount on route change — resets center/zoom to Toronto */}
          <MapBox
            key={`sim-map-${routeId || "none"}`}
            highlightRouteId={routeId || null}
            disabledRouteIds={disabledIds}
            showVehicles
            showBunching={false}
            zoom={11}
          />
        </ChartCard>
      </div>

      {/* Simulation log */}
      <ChartCard title="Simulation log" subtitle="OCC system reactions over time" className="mt-4">
        {!route ? (
          <div className="text-sm text-muted-foreground py-4 text-center">Select a route and click Run simulation to see the event log.</div>
        ) : visibleLog.length === 0 ? (
          <div className="text-sm text-muted-foreground py-4 text-center">Click Run simulation to begin.</div>
        ) : (
          <ul className="space-y-2">
            <AnimatePresence>
              {visibleLog.map((e) => (
                <motion.li
                  key={e.t}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-start gap-3 text-sm rounded-xl border border-border bg-surface/30 px-3 py-2.5"
                >
                  <span className="text-xs text-muted-foreground w-12 shrink-0 pt-0.5">T+{e.t}m</span>
                  {SEV_ICON[e.sev as keyof typeof SEV_ICON]}
                  <span>{e.msg}</span>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </ChartCard>
    </div>
  );
}
