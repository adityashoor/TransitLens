import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Search } from "lucide-react";
import { MapBox } from "@/components/map/MapBox";
import { LayerControls } from "@/components/map/LayerControls";
import { TimeTravel } from "@/components/map/TimeTravel";
import { StopArrivalsPanel, type StopMeta } from "@/components/map/StopArrivalsPanel";
import { useNetwork, useVehicles } from "@/mock/api";
import type { Route as TransitRoute } from "@/mock/routes";
import { ResponsiveContainer, AreaChart, Area, XAxis, Tooltip as RTooltip } from "recharts";
import { hourlyRidership } from "@/mock/data";
import { StatusPill } from "@/components/ui-ext/ChartCard";
import { fmtCompact } from "@/lib/format";

export const Route = createFileRoute("/map")({
  head: () => ({
    meta: [
      { title: "Live Map — TransitLens" },
      { name: "description", content: "Real-time TTC vehicle tracking, route layers, stop arrivals, and time-travel replay." },
      { property: "og:title", content: "TransitLens Live Map" },
    ],
  }),
  component: LiveMap,
});

function LiveMap() {
  const [selected, setSelected] = useState<TransitRoute | null>(null);
  const [stop, setStop] = useState<StopMeta | null>(null);
  const [query, setQuery] = useState("");
  const { data: net } = useNetwork();
  const { data: vehicles = [] } = useVehicles();
  const [hourly] = useState(() => hourlyRidership());

  const filtered =
    net?.routes.filter((r) =>
      !query || `${r.shortName} ${r.longName}`.toLowerCase().includes(query.toLowerCase()),
    ) ?? [];

  // Esc to close panels
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (stop) setStop(null);
        else if (selected) setSelected(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [stop, selected]);

  return (
    <div className="relative h-[calc(100vh-64px)] overflow-hidden">
      <MapBox
        height="100%"
        highlightRouteId={selected?.id ?? null}
        onRouteClick={(r) => { setSelected(r); setStop(null); }}
        onStopClick={(s) => { setStop(s); setSelected(null); }}
        withActions
      />

      {/* Search panel */}
      <div className="absolute top-4 left-4 right-4 md:right-auto md:w-80 z-[1000]">
        <div className="glass-card rounded-2xl p-3">
          <div className="relative">
            <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search routes or stops…"
              className="w-full h-10 pl-9 pr-3 rounded-xl bg-surface/60 border border-border text-sm outline-none focus:ring-2 focus:ring-ring/40"
              aria-label="Search routes and stops"
            />
          </div>
          {query && (
            <ul className="mt-2 max-h-72 overflow-y-auto scrollbar-thin">
              {filtered.slice(0, 10).map((r) => (
                <li key={r.id}>
                  <button
                    onClick={() => { setSelected(r); setQuery(""); }}
                    className="w-full flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-surface text-left"
                  >
                    <span className="size-7 rounded-md text-[11px] font-bold flex items-center justify-center text-primary-foreground" style={{ background: r.color }}>{r.shortName}</span>
                    <span className="text-sm truncate">{r.longName}</span>
                  </button>
                </li>
              ))}
              {filtered.length === 0 && (
                <li className="px-2 py-3 text-xs text-muted-foreground">No matches.</li>
              )}
            </ul>
          )}
        </div>
      </div>

      {/* Layer controls — moved to LEFT to avoid drawer overlap */}
      <div className="absolute bottom-28 md:bottom-6 left-4 z-[1000]">
        <LayerControls counts={{ vehicles: vehicles.length, routes: net?.routes.length }} />
      </div>

      {/* Time travel — bottom center */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[1000] hidden md:block">
        <TimeTravel />
      </div>

      {/* Stop arrivals */}
      <AnimatePresence>
        {stop && <StopArrivalsPanel stop={stop} onClose={() => setStop(null)} />}
      </AnimatePresence>

      {/* Route drawer */}
      <AnimatePresence>
        {selected && (
          <motion.aside
            initial={{ x: 420, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 420, opacity: 0 }}
            transition={{ type: "spring", stiffness: 240, damping: 28 }}
            className="absolute top-0 right-0 h-full w-full md:w-[400px] z-[1100] glass-panel border-l border-border overflow-y-auto scrollbar-thin"
            role="complementary"
            aria-label={`Route ${selected.shortName} details`}
          >
            <div className="p-5 sticky top-0 bg-background/40 backdrop-blur-xl border-b border-border flex items-start gap-3 z-10">
              <span className="size-10 rounded-xl text-sm font-bold flex items-center justify-center text-primary-foreground shrink-0" style={{ background: selected.color }}>
                {selected.shortName}
              </span>
              <div className="flex-1 min-w-0">
                <div className="font-semibold truncate">{selected.longName}</div>
                <div className="text-xs text-muted-foreground capitalize">{selected.mode} · {selected.stopIds.length} stops</div>
              </div>
              <button onClick={() => setSelected(null)} className="size-8 rounded-lg hover:bg-surface flex items-center justify-center" aria-label="Close route panel">
                <X className="size-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="flex items-center gap-2">
                <StatusPill status={selected.status} />
                <span className="text-xs text-muted-foreground">Headway {selected.headway} min</span>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {[
                  ["Daily riders", fmtCompact(selected.ridership)],
                  ["On time", `${selected.onTime}%`],
                  ["Congestion", `${selected.congestion}/100`],
                  ["AI score", `${selected.aiScore}`],
                  ["Trend", `${selected.trend > 0 ? "+" : ""}${selected.trend}%`],
                  ["Stops", `${selected.stopIds.length}`],
                ].map(([k, v]) => (
                  <div key={k} className="rounded-xl border border-border bg-surface/40 p-3">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{k}</div>
                    <div className="text-base font-semibold mt-1">{v}</div>
                  </div>
                ))}
              </div>

              <div className="rounded-xl border border-border bg-surface/40 p-3">
                <div className="text-xs font-semibold mb-2">Hourly ridership</div>
                <div className="h-32">
                  <ResponsiveContainer>
                    <AreaChart data={hourly}>
                      <defs>
                        <linearGradient id="d-r" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={selected.color} stopOpacity={0.6} />
                          <stop offset="100%" stopColor={selected.color} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="hour" hide />
                      <RTooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12 }} />
                      <Area dataKey="riders" stroke={selected.color} fill="url(#d-r)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="rounded-xl border border-border bg-surface/40 p-3">
                <div className="text-xs font-semibold mb-1">AI prediction · next 3h</div>
                <p className="text-xs text-muted-foreground">
                  Demand expected {selected.trend > 0 ? "above" : "below"} typical, peaking at 17:30.
                  Confidence {Math.round(80 + selected.aiScore / 8)}%.
                </p>
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </div>
  );
}
