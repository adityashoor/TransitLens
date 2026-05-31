import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Pause, RotateCcw, AlertTriangle, CheckCircle, Info, Sparkles, Loader2 } from "lucide-react";
import { ChartCard, PageHeader } from "@/components/ui-ext/ChartCard";
import { MapBox } from "@/components/map/MapBox";
import { useNetwork, useRouteStats } from "@/mock/api";
import { Slider } from "@/components/ui/slider";
import { fmtCompact } from "@/lib/format";
import { geminiAsk, geminiAvailable } from "@/lib/gemini";
import { parseRecommendations } from "@/lib/parseGemini";

export const Route = createFileRoute("/simulator")({
  head: () => ({
    meta: [
      { title: "Disruption Simulator — TransitLens" },
      { name: "description", content: "Model disruptions: close routes, induce delays, and visualize cascading impact across the TTC network." },
    ],
  }),
  component: Simulator,
});

interface LogEntry { t: number; msg: string; sev: "high" | "medium" | "low"; source: "parametric" | "gemini" }

const SEV_ICON = {
  high:   <AlertTriangle className="size-3.5 text-destructive shrink-0" />,
  medium: <Sparkles      className="size-3.5 text-warn shrink-0" />,
  low:    <CheckCircle   className="size-3.5 text-cyan shrink-0" />,
};

/**
 * Build a fully parametric simulation log from real route data.
 * Every message references actual numbers — no generic placeholders.
 */
function buildLog(
  route: { shortName: string; longName: string; mode: string; ridership: number; headway: number },
  delay: number,
  affectedRiders: number,
  congestionDelta: number,
  altRoutes: { shortName: string; longName: string }[],
  realOnTime: number,
  realIncidents: number,
): LogEntry[] {
  const isSubway   = route.mode === "subway";
  const isSevere   = delay >= 30;
  const altStr     = altRoutes.slice(0, 2).map(r => `Route ${r.shortName} ${r.longName.slice(0,18)}`).join(" and ") || "adjacent routes";
  const connectStr = isSubway ? "connecting bus and streetcar stops" : "downstream intersections";
  const headwayNew = Math.min(route.headway + Math.round(delay * 0.4), 20);
  const peakRiders = Math.round(affectedRiders * 0.6);

  const entries: LogEntry[] = [
    {
      t: 0,
      msg: `${isSubway ? "Line" : "Route"} ${route.shortName} (${route.longName}) — ${delay}-minute service suspension initiated. ${fmtCompact(route.ridership)} daily riders impacted on this corridor.`,
      sev: "high", source: "parametric",
    },
    {
      t: 2,
      msg: `OCC alerted. Headway adjustment protocol activated. Target headway adjusted from ${route.headway} min to ${headwayNew} min to compensate for gap.`,
      sev: "medium", source: "parametric",
    },
    {
      t: 5,
      msg: `PRESTO push notification sent to ${fmtCompact(affectedRiders)} affected tap-in riders. ${fmtCompact(peakRiders)} currently in peak travel window. Diversion to ${altStr} recommended.`,
      sev: "high", source: "parametric",
    },
    {
      t: 10,
      msg: `${altRoutes.length > 0 ? `${altStr} absorbing overflow.` : "No direct parallel routes."} ${isSubway ? "Surface shuttle bus deployment authorised for gap section." : "Short-turn service activated at next major intersection."} Crowding building at ${connectStr}.`,
      sev: "medium", source: "parametric",
    },
    {
      t: 15,
      msg: `Congestion index +${congestionDelta} pts in surrounding 2 km corridor. ${isSevere ? `Extended delay — ${realOnTime}% baseline on-time rate means recovery will take longer (${realIncidents} incidents on record this year).` : `Manageable impact given ${realOnTime}% historical on-time rate.`}`,
      sev: isSevere ? "high" : "medium", source: "parametric",
    },
    {
      t: 20,
      msg: `${isSubway ? `Additional capacity deployed on ${altStr}. Supervisors positioned at key interchange stations.` : `Express short-turn service on ${altStr} reducing passenger wait by ~${Math.round(delay * 0.5)} min.`} Customer service agents deployed at ${isSubway ? "affected subway stations" : "major stops"}.`,
      sev: "medium", source: "parametric",
    },
    {
      t: 25,
      msg: `Crowding alerts at ${isSubway ? "Union, Bloor-Yonge and Sheppard interchange" : "3 connecting stops"} now at yellow threshold. ${isSevere ? "Recovery estimate: 15-20 min after service restored." : "System absorbing disruption within normal parameters."}`,
      sev: isSevere ? "high" : "medium", source: "parametric",
    },
    {
      t: 30,
      msg: `Headway normalising. Incident response closing. Post-incident report queued for ${route.shortName} service reliability review. Affected: ${fmtCompact(affectedRiders)} riders, ${delay} min delay, +${congestionDelta} pts congestion.`,
      sev: "low", source: "parametric",
    },
  ];

  return entries;
}

function Simulator() {
  const { data: net } = useNetwork();
  const { data: stats = {} } = useRouteStats();

  const [routeId, setRouteId]   = useState("");
  const [delay,   setDelay]     = useState(15);
  const [time,    setTime]      = useState(0);
  const [playing, setPlaying]   = useState(false);
  const [geminiLog, setGeminiLog] = useState<LogEntry[]>([]);
  const [geminiLoading, setGeminiLoading] = useState(false);

  const disabledIds = useMemo(() => new Set(routeId ? [routeId] : []), [routeId]);
  const route = net?.routes.find((r) => r.id === routeId);

  // Alt routes: parallel routes of same mode
  const altRoutes = useMemo(() => {
    if (!route || !net) return [];
    return net.routes.filter(r => r.id !== route.id && r.mode === route.mode).slice(0, 3);
  }, [route, net]);

  // Real data from CKAN stats
  const realOnTime   = stats[routeId]?.onTimePct    ?? route?.onTime    ?? 75;
  const realRidership = route?.ridership             ?? 0;
  const realIncidents = stats[routeId]?.incidentCount ?? 0;

  // Impact model using real data
  const affectedRiders  = route ? Math.round(realRidership * (0.35 + (delay / 60) * 0.30)) : 0;
  const congestionDelta = route ? Math.round((delay * 0.55) + ((100 - realOnTime) * 0.25) + 6) : 0;
  const avgAddedTime    = route ? Math.round(delay * 0.65 + 4) : 0;

  // Build parametric log from real data
  const parametricLog = useMemo(() => {
    if (!route) return [];
    return buildLog(route, delay, affectedRiders, congestionDelta, altRoutes, realOnTime, realIncidents);
  }, [route, delay, affectedRiders, congestionDelta, altRoutes, realOnTime, realIncidents]);

  // Merge parametric + Gemini entries, sorted by time
  const fullLog = useMemo(() => {
    const merged = [...parametricLog, ...geminiLog].sort((a, b) => a.t - b.t);
    return merged;
  }, [parametricLog, geminiLog]);

  const visibleLog = fullLog.filter(e => e.t <= time);

  // Gemini: generate 2 extra log entries with deeper operational insight
  const fetchGeminiLog = useCallback(async () => {
    if (!geminiAvailable || !route || geminiLoading) return;
    setGeminiLoading(true);
    const prompt = `TTC Toronto transit simulation. Write exactly 2 OCC log entries for a ${delay}-minute disruption on ${route.mode} Route ${route.shortName} (${route.longName}). Each entry is one sentence, max 25 words. Reference specific numbers. Format: time offset in minutes then a pipe then the log message. Use realistic TTC operations language. No intro. No markdown.

Route data: ${realRidership.toLocaleString()} daily riders, ${realOnTime}% on-time, ${realIncidents} incidents this year, ${route.headway}min headway, ${altRoutes.length} parallel routes available.
Disruption: ${delay} min delay, ${fmtCompact(affectedRiders)} affected riders, +${congestionDelta} pts congestion.

Example format:
7 | 847 passengers transferred to Route 35 Jane northbound at Eglinton.
22 | Signal restored at Yonge/Bloor junction; 4-minute recovery window initiated.

Write 2 entries now:`;
    const result = await geminiAsk(prompt);
    if (result) {
      const newEntries: LogEntry[] = result
        .split("\n")
        .map(l => l.replace(/\*\*/g,"").replace(/\*/g,"").trim())
        .filter(l => /^\d+\s*\|/.test(l))
        .map(l => {
          const [tPart, ...msgParts] = l.split("|");
          const t = parseInt(tPart.trim());
          const msg = msgParts.join("|").trim();
          // Avoid duplicate time slots
          const occupied = new Set(parametricLog.map(e => e.t));
          const safeT = occupied.has(t) ? t + 1 : t;
          return { t: Math.max(1, Math.min(29, safeT)), msg, sev: "medium" as const, source: "gemini" as const };
        })
        .filter(e => e.msg.length > 15)
        .slice(0, 2);
      setGeminiLog(newEntries);
    }
    setGeminiLoading(false);
  }, [route, delay, affectedRiders, congestionDelta, altRoutes, realOnTime, realIncidents, realRidership, parametricLog, geminiLoading]);

  // Re-generate Gemini log when route or delay changes
  useEffect(() => {
    if (route && geminiAvailable) fetchGeminiLog();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeId, delay]);

  // Timer
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      setTime(prev => {
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

  const handleReset = useCallback(() => { setPlaying(false); setTime(0); }, []);

  const handleRouteChange = (id: string) => {
    setRouteId(id);
    setPlaying(false);
    setTime(0);
    setGeminiLog([]);
  };

  const progress = Math.round((time / 30) * 100);

  return (
    <div className="px-4 md:px-6 py-6 max-w-[1600px] mx-auto">
      <PageHeader
        title="Disruption Simulator"
        subtitle="What-if modelling · parametric impact from real CKAN route data · Gemini-enhanced log"
        action={
          <div className="flex gap-2">
            <button onClick={handleRun} disabled={!route}
              className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-xs font-medium flex items-center gap-2 disabled:opacity-40">
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
                <select value={routeId} onChange={e => handleRouteChange(e.target.value)}
                  className="w-full h-9 rounded-lg bg-surface border border-border text-sm px-2 outline-none focus:ring-2 focus:ring-ring/40">
                  <option value="">— choose route —</option>
                  {(["subway","streetcar","bus"] as const).map(mode => {
                    const modeRoutes = net?.routes.filter(r => r.mode === mode) ?? [];
                    if (!modeRoutes.length) return null;
                    return (
                      <optgroup key={mode} label={mode.charAt(0).toUpperCase() + mode.slice(1)}>
                        {modeRoutes.map(r => (
                          <option key={r.id} value={r.id}>{r.shortName} · {r.longName.slice(0,28)}</option>
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
                  <span>0</span><span>30</span><span>60 min</span>
                </div>
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <label className="text-xs text-muted-foreground">Sim time: <b className="text-foreground">{time} min</b></label>
                  {playing && <span className="text-[10px] text-primary animate-pulse">Running…</span>}
                  {time >= 30 && !playing && <span className="text-[10px] text-success">Complete</span>}
                </div>
                <div className="h-2 rounded-full bg-surface overflow-hidden">
                  <motion.div className="h-full rounded-full bg-primary"
                    animate={{ width: `${progress}%` }} transition={{ duration: 0.3 }} />
                </div>
              </div>

              {/* Real data badge */}
              {route && (
                <div className="rounded-xl border border-border bg-surface/40 p-2.5 space-y-1 text-[10px] text-muted-foreground">
                  <div className="flex justify-between"><span>Daily ridership</span><span className="font-semibold text-foreground">{fmtCompact(realRidership)}</span></div>
                  <div className="flex justify-between"><span>On-time rate (CKAN)</span><span className={`font-semibold ${realOnTime < 75 ? "text-destructive" : "text-success"}`}>{realOnTime}%</span></div>
                  <div className="flex justify-between"><span>Incidents (2025)</span><span className="font-semibold text-foreground">{realIncidents}</span></div>
                  <div className="flex justify-between"><span>Headway</span><span className="font-semibold text-foreground">{route.headway} min</span></div>
                </div>
              )}
            </div>
          </ChartCard>

          {/* Impact dashboard */}
          <ChartCard title="Impact dashboard" subtitle="Computed from real ridership data">
            <div className="space-y-2">
              {[
                { label: "Affected riders",      value: route ? fmtCompact(affectedRiders) : "0",         warn: affectedRiders > 50_000 },
                { label: "Avg added travel time", value: route ? `+${avgAddedTime} min` : "—",            warn: avgAddedTime > 15 },
                { label: "Congestion increase",   value: route ? `+${congestionDelta} pts` : "+0 pts",    warn: congestionDelta > 20 },
                { label: "Alt routes activated",  value: route ? String(altRoutes.length) : "0",          warn: false },
              ].map(({ label, value, warn }) => (
                <div key={label} className={`rounded-xl border p-3 flex items-center justify-between ${warn && route ? "border-warn/30 bg-warn/5" : "border-border bg-surface/40"}`}>
                  <span className="text-xs text-muted-foreground">{label}</span>
                  <span className={`font-semibold text-sm ${warn && route ? "text-warn" : ""}`}>{value}</span>
                </div>
              ))}
            </div>

            {altRoutes.length > 0 && route && (
              <div className="mt-3 space-y-1">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">Parallel routes</div>
                {altRoutes.map(r => (
                  <div key={r.id} className="flex items-center gap-2">
                    <span className="size-5 rounded text-[9px] font-bold flex items-center justify-center text-white shrink-0"
                      style={{ background: r.color }}>{r.shortName}</span>
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
          <MapBox key={`sim-map-${routeId || "none"}`}
            highlightRouteId={routeId || null}
            disabledRouteIds={disabledIds}
            showVehicles showBunching={false} zoom={11} />
        </ChartCard>
      </div>

      {/* Simulation log */}
      <ChartCard
        title="Simulation log"
        subtitle={route
          ? `${route.shortName} ${route.longName} · ${delay}min delay · real ridership + CKAN on-time data${geminiAvailable ? " · Gemini-enhanced" : ""}`
          : "OCC system reactions over time"}
        className="mt-4"
        action={
          geminiAvailable && route && (
            <button onClick={fetchGeminiLog} disabled={geminiLoading}
              className="text-[10px] flex items-center gap-1 text-primary hover:underline disabled:opacity-40">
              {geminiLoading ? <><Loader2 className="size-3 animate-spin" /> Generating…</> : <><Sparkles className="size-3" /> Regenerate Gemini entries</>}
            </button>
          )
        }
      >
        {!route ? (
          <div className="text-sm text-muted-foreground py-4 text-center flex items-center justify-center gap-2">
            <Info className="size-4" /> Select a route and click Run simulation to see the log.
          </div>
        ) : visibleLog.length === 0 ? (
          <div className="text-sm text-muted-foreground py-4 text-center">Click Run simulation to begin.</div>
        ) : (
          <ul className="space-y-2">
            <AnimatePresence>
              {visibleLog.map((e) => (
                <motion.li key={`${e.t}-${e.source}`}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  className={`flex items-start gap-3 text-sm rounded-xl border px-3 py-2.5 ${e.source === "gemini" ? "border-primary/20 bg-primary/5" : "border-border bg-surface/30"}`}
                >
                  <span className="text-xs text-muted-foreground w-12 shrink-0 pt-0.5">T+{e.t}m</span>
                  {SEV_ICON[e.sev]}
                  <span className="flex-1">{e.msg}</span>
                  {e.source === "gemini" && (
                    <span className="text-[9px] text-primary border border-primary/20 rounded px-1 py-0.5 shrink-0">AI</span>
                  )}
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </ChartCard>
    </div>
  );
}
