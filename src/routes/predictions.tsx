import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Cloud, AlertTriangle, CheckCircle, Wind, Thermometer,
  Droplets, Bus, Train, Sparkles, Loader2, RefreshCw,
  TrendingDown, TrendingUp, AlertOctagon, Zap,
} from "lucide-react";
import { ChartCard, PageHeader } from "@/components/ui-ext/ChartCard";
import { useDisruptions, useWeather, useNetwork, useRouteStats } from "@/mock/api";
import { geminiAsk, geminiAvailable } from "@/lib/gemini";
import { parseRecommendations } from "@/lib/parseGemini";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  Tooltip as RTooltip, CartesianGrid, Cell, LineChart, Line, ReferenceLine,
} from "recharts";
import { WhyDrawer } from "@/components/predictions/WhyDrawer";
import { ModelCard } from "@/components/predictions/ModelCard";

export const Route = createFileRoute("/predictions")({
  head: () => ({
    meta: [
      { title: "Weather × TTC Impact — TransitLens" },
      { name: "description", content: "Real-time weather impact on TTC service: route risk, hourly forecasts, delay predictions." },
    ],
  }),
  component: Predictions,
});

// ── Weather impact thresholds ─────────────────────────────────────────────────
function weatherImpactLevel(precip: number, temp: number, wind: number): "low" | "medium" | "high" | "critical" {
  if (precip > 70 || temp < -15 || wind > 60) return "critical";
  if (precip > 45 || temp < -5 || wind > 40)  return "high";
  if (precip > 20 || temp > 32 || wind > 25)  return "medium";
  return "low";
}

const IMPACT_COLOR: Record<string, string> = {
  low:      "text-success",
  medium:   "text-warn",
  high:     "text-destructive",
  critical: "text-destructive",
};

const IMPACT_BG: Record<string, string> = {
  low:      "bg-success/10 border-success/20",
  medium:   "bg-warn/10 border-warn/20",
  high:     "bg-destructive/10 border-destructive/20",
  critical: "bg-destructive/15 border-destructive/30",
};

// ── Delay risk by mode based on weather ──────────────────────────────────────
function modeDelayRisk(mode: "bus" | "streetcar" | "subway", precip: number, temp: number, wind: number) {
  // Buses: vulnerable to rain + ice + wind
  if (mode === "bus")       return Math.min(100, precip * 0.8 + Math.max(0, -temp) * 2 + wind * 0.5);
  // Streetcars: very vulnerable to ice + overhead wire issues
  if (mode === "streetcar") return Math.min(100, precip * 0.9 + Math.max(0, -temp) * 3 + wind * 0.7);
  // Subway: mostly protected, only extreme temps cause equipment issues
  return Math.min(100, Math.max(0, Math.abs(temp) - 20) * 1.5 + precip * 0.1);
}

function Predictions() {
  const { data: disruptions = [] } = useDisruptions();
  const { data: weather = [] }     = useWeather();
  const { data: net }               = useNetwork();
  const { data: stats = {} }        = useRouteStats();

  const [whyOpen, setWhyOpen]               = useState(false);
  const [geminiInsight, setGeminiInsight]   = useState<string | null>(null);
  const [insightLoading, setInsightLoading] = useState(false);

  // ── Current + next 6h weather ─────────────────────────────────────────────
  const current  = weather[0];
  const next6h   = weather.slice(0, 6);
  const next24h  = weather.slice(0, 24);

  const precip = current?.precip ?? 0;
  const temp   = current?.temp   ?? 15;
  const wind   = current?.wind   ?? 0;

  const overallImpact = weatherImpactLevel(precip, temp, wind);

  // ── Mode delay risk ───────────────────────────────────────────────────────
  const busRisk        = Math.round(modeDelayRisk("bus",       precip, temp, wind));
  const streetcarRisk  = Math.round(modeDelayRisk("streetcar", precip, temp, wind));
  const subwayRisk     = Math.round(modeDelayRisk("subway",    precip, temp, wind));

  // ── At-risk routes: surface routes with already-poor on-time + high weather risk ──
  const atRiskRoutes = useMemo(() => {
    const surface = (net?.routes ?? []).filter(r => r.mode === "bus" || r.mode === "streetcar");
    return surface
      .map(r => {
        const s = stats[r.id];
        const onTime = s?.onTimePct ?? r.onTime;
        const weatherRisk = r.mode === "streetcar" ? streetcarRisk : busRisk;
        const combinedRisk = Math.round(((100 - onTime) * 0.5) + (weatherRisk * 0.5));
        return { ...r, onTime, combinedRisk };
      })
      .filter(r => r.combinedRisk > 35)
      .sort((a, b) => b.combinedRisk - a.combinedRisk)
      .slice(0, 8);
  }, [net, stats, busRisk, streetcarRisk]);

  // ── Hourly weather + delay forecast for next 12h ─────────────────────────
  const hourlyForecast = useMemo(() => next24h.map((w, i) => {
    const h = (new Date().getHours() + i) % 24;
    const busD = Math.round(modeDelayRisk("bus", w.precip ?? 0, w.temp ?? 15, w.wind ?? 0));
    const strD = Math.round(modeDelayRisk("streetcar", w.precip ?? 0, w.temp ?? 15, w.wind ?? 0));
    return {
      time:       `${String(h).padStart(2,"0")}:00`,
      precip:     w.precip ?? 0,
      temp:       w.temp ?? 15,
      busRisk:    busD,
      streetcarRisk: strD,
      condition:  w.condition ?? "",
      impact:     w.impact ?? "Low",
    };
  }), [next24h]);

  // ── Gemini insight — rich multi-source context ───────────────────────────
  const requestInsight = async () => {
    if (!geminiAvailable || insightLoading) return;
    setInsightLoading(true);

    const now      = new Date();
    const day      = now.toLocaleDateString("en-CA", { weekday: "long" });
    const hourStr  = `${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`;
    const peak6h   = next6h.reduce((max, w) => Math.max(max, w.precip ?? 0), 0);
    const peak6hHour = next6h.findIndex(w => (w.precip ?? 0) === peak6h);

    // ── Disruption detail ─────────────────────────────────────────────────
    const allDisr = disruptions as { severity?: string; routeId?: string; message?: string; type?: string }[];
    const highDisr    = allDisr.filter(d => d.severity === "high");
    const medDisr     = allDisr.filter(d => d.severity === "medium");
    const subwayDisr  = allDisr.filter(d => d.type === "subway");
    const busDisr     = allDisr.filter(d => d.type === "bus");
    const disrDetail  = highDisr.slice(0,3).map(d =>
      `Route ${d.routeId ?? "?"}: ${(d.message ?? "").slice(0,80)}`
    ).join(" | ") || "none";

    // ── At-risk routes with real CKAN stats ───────────────────────────────
    const atRiskDetail = atRiskRoutes.slice(0,5).map(r =>
      `Route ${r.shortName} ${r.longName} (${r.onTime}% on-time, risk ${r.combinedRisk}/100, ${r.mode})`
    ).join("\n  ") || "none identified";

    // ── Weather 6h forecast ───────────────────────────────────────────────
    const weather6h = next6h.map((w, i) => {
      const h = (now.getHours() + i) % 24;
      return `${String(h).padStart(2,"0")}:00 ${w.condition} ${w.temp}°C ${w.precip}%rain`;
    }).join(" | ");

    // ── Network snapshot ──────────────────────────────────────────────────
    const routeCount  = net?.routes.length ?? 0;
    const subwayCount = net?.routes.filter(r => r.mode === "subway").length ?? 0;
    const streetcarCount = net?.routes.filter(r => r.mode === "streetcar").length ?? 0;
    const busCount    = net?.routes.filter(r => r.mode === "bus").length ?? 0;

    // ── Route stats from CKAN delay data ──────────────────────────────────
    const worstOnTime = atRiskRoutes.slice(0,3);
    const statsDetail = worstOnTime.length > 0
      ? worstOnTime.map(r => `Route ${r.shortName}: ${r.onTime}% on-time (${r.mode})`).join(", ")
      : "all routes within normal range";

    const prompt = `You are a senior TTC Toronto transit operations supervisor. Write exactly 3 numbered recommendations for operators on duty right now. Each recommendation must be 3-4 sentences: sentence 1 = specific action with route numbers or times, sentence 2 = explains why using the exact numbers provided, sentence 3 = precise operational step to take immediately, sentence 4 (optional) = expected outcome. Plain text only. No markdown. No bold. No preamble.

=== LIVE TTC OPERATIONAL DATA — ${day} ${hourStr} ===

WEATHER (Open-Meteo live):
- Current: ${current?.condition ?? "unknown"}, ${temp}°C, ${precip}% precip, ${wind} km/h wind
- Next 6 hours: ${weather6h}
- Peak precipitation: ${peak6h}% at +${peak6hHour}h (${String((now.getHours() + peak6hHour) % 24).padStart(2,"0")}:00)

DELAY RISK (weather-derived):
- Bus routes: ${busRisk}/100 | Streetcar routes: ${streetcarRisk}/100 | Subway: ${subwayRisk}/100
- Overall transit impact: ${overallImpact.toUpperCase()}

DISRUPTIONS (live GTFS-RT + Umo feed):
- High severity: ${highDisr.length} | Medium: ${medDisr.length}
- Subway disruptions: ${subwayDisr.length} | Bus disruptions: ${busDisr.length}
- High severity detail: ${disrDetail}

AT-RISK SURFACE ROUTES (CKAN 2025 delay data × weather):
  ${atRiskDetail}

CKAN DELAY STATISTICS (2025 year-to-date):
- Worst performing routes: ${statsDetail}
- Total at-risk routes above threshold: ${atRiskRoutes.length}

NETWORK SNAPSHOT (Supabase GTFS):
- ${routeCount} total routes: ${subwayCount} subway, ${streetcarCount} streetcar, ${busCount} bus

Write 3 numbered recommendations now:`;



    const result = await geminiAsk(prompt);
    setGeminiInsight(result);
    setInsightLoading(false);
  };

  useEffect(() => {
    if (!geminiAvailable || !current) return;
    requestInsight();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Live disruption count ─────────────────────────────────────────────────
  const highDisruptions = disruptions.filter((d: { severity?: string }) => d.severity === "high").length;

  return (
    <div className="px-4 md:px-6 py-6 max-w-[1600px] mx-auto">
      <PageHeader
        title="Weather × TTC Impact"
        subtitle={`Live service risk assessment · ${new Date().toLocaleDateString("en-CA", { weekday: "long", month: "short", day: "numeric" })} · ${new Date().toLocaleTimeString("en-CA", { hour: "2-digit", minute: "2-digit" })}`}
        action={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setWhyOpen(true)}
              className="px-3 h-9 rounded-xl bg-surface/60 border border-border text-xs inline-flex items-center gap-1.5 hover:bg-surface"
            >
              Feature attribution
            </button>
            <div className={`flex items-center gap-2 px-3 h-9 rounded-xl text-xs font-medium border ${IMPACT_BG[overallImpact]}`}>
              <span className={`size-2 rounded-full ${overallImpact === "low" ? "bg-success" : overallImpact === "medium" ? "bg-warn" : "bg-destructive"} animate-pulse`} />
              <span className={IMPACT_COLOR[overallImpact]}>
                {overallImpact.charAt(0).toUpperCase() + overallImpact.slice(1)} transit impact
              </span>
            </div>
          </div>
        }
      />

      {/* ── Row 1: Current weather KPIs ────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        {[
          {
            icon: Thermometer,
            label: "Temperature",
            value: current ? `${temp}°C` : "—",
            sub: temp < -10 ? "Equipment risk" : temp > 32 ? "Heat advisory" : "Normal range",
            warn: temp < -10 || temp > 32,
          },
          {
            icon: Droplets,
            label: "Precipitation",
            value: current ? `${precip}%` : "—",
            sub: precip > 60 ? "High delay risk" : precip > 30 ? "Moderate impact" : "Minimal impact",
            warn: precip > 30,
          },
          {
            icon: Wind,
            label: "Wind Speed",
            value: current ? `${wind} km/h` : "—",
            sub: wind > 40 ? "Streetcar wire risk" : wind > 25 ? "Service slowdown" : "Normal",
            warn: wind > 25,
          },
          {
            icon: Cloud,
            label: "Condition",
            value: current?.condition ?? "—",
            sub: `Impact: ${overallImpact.charAt(0).toUpperCase() + overallImpact.slice(1)}`,
            warn: overallImpact === "high" || overallImpact === "critical",
          },
        ].map(({ icon: Icon, label, value, sub, warn }) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className={`glass-card rounded-2xl p-4 border ${warn ? "border-warn/30" : "border-border"}`}
          >
            <div className="flex items-center gap-2 mb-2">
              <Icon className={`size-4 ${warn ? "text-warn" : "text-muted-foreground"}`} />
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
            </div>
            <div className="text-2xl font-bold">{value}</div>
            <div className={`text-[11px] mt-0.5 ${warn ? "text-warn" : "text-muted-foreground"}`}>{sub}</div>
          </motion.div>
        ))}
      </div>

      {/* ── Row 2: Mode delay risk + Gemini insight ─────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        {/* Mode risk gauges */}
        <ChartCard title="Current delay risk by mode" subtitle="Derived from live weather conditions">
          <div className="space-y-3 py-1">
            {[
              { label: "Bus routes",       risk: busRisk,       icon: Bus,   mode: "bus"       },
              { label: "Streetcar routes", risk: streetcarRisk, icon: Zap,   mode: "streetcar" },
              { label: "Subway",           risk: subwayRisk,    icon: Train, mode: "subway"    },
            ].map(({ label, risk, icon: Icon, mode }) => {
              const color = risk > 60 ? "var(--destructive)" : risk > 35 ? "var(--warn)" : "var(--success)";
              return (
                <div key={mode}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <Icon className="size-3.5 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">{label}</span>
                    </div>
                    <span className="text-xs font-semibold" style={{ color }}>{risk}/100</span>
                  </div>
                  <div className="h-2 rounded-full bg-surface overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${risk}%` }}
                      transition={{ duration: 0.8 }}
                      className="h-full rounded-full"
                      style={{ background: color }}
                    />
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    {risk > 60 ? "High — expect significant delays"
                      : risk > 35 ? "Moderate — monitor closely"
                      : "Low — normal operations"}
                  </div>
                </div>
              );
            })}

            {highDisruptions > 0 && (
              <div className="mt-3 flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/8 px-3 py-2">
                <AlertOctagon className="size-3.5 text-destructive shrink-0" />
                <span className="text-xs text-destructive">{highDisruptions} high-severity disruption{highDisruptions > 1 ? "s" : ""} active</span>
              </div>
            )}
          </div>
        </ChartCard>

        {/* Gemini operational recommendations */}
        <ChartCard
          title="Gemini · Operations recommendations"
          subtitle="Based on live weather + disruption data"
          className="lg:col-span-2"
          action={
            geminiAvailable && (
              <button onClick={requestInsight} disabled={insightLoading}
                className="size-6 rounded hover:bg-surface flex items-center justify-center text-muted-foreground disabled:opacity-40">
                <RefreshCw className={`size-3 ${insightLoading ? "animate-spin" : ""}`} />
              </button>
            )
          }
        >
          {!geminiAvailable ? (
            <div className="text-xs text-muted-foreground py-4">
              Set VITE_GEMINI_KEY to enable AI recommendations.
            </div>
          ) : insightLoading ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground py-4">
              <Loader2 className="size-4 animate-spin" /> Analysing live conditions…
            </div>
          ) : geminiInsight ? (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-[10px] text-primary font-semibold uppercase tracking-wider">
                <Sparkles className="size-3 animate-pulse-glow" /> Live AI Recommendations
              </div>
              {parseRecommendations(geminiInsight).map((rec, i) => (
                <div key={i} className="flex items-start gap-3 rounded-xl border border-border bg-surface/40 p-3">
                  <span className="size-6 rounded-lg bg-primary/15 text-primary font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                  <p className="text-xs text-foreground leading-relaxed">{rec}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-xs text-muted-foreground py-4 text-center">
              Click ↻ to generate recommendations
            </div>
          )}
        </ChartCard>
      </div>

      {/* ── Row 3: 24h weather + delay forecast chart ───────────────────────── */}
      <ChartCard
        title="24-hour weather & delay risk forecast"
        subtitle="Precipitation probability + predicted bus/streetcar delay risk · Open-Meteo live"
        className="h-[320px] mb-4"
      >
        <ResponsiveContainer>
          <LineChart data={hourlyForecast.slice(0, 24)}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="time" stroke="var(--muted-foreground)" fontSize={10} tickLine={false} axisLine={false} interval={3} />
            <YAxis stroke="var(--muted-foreground)" fontSize={10} tickLine={false} axisLine={false} domain={[0, 100]} />
            <RTooltip
              contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 11 }}
              formatter={(v: number, name: string) => [
                `${v}%`,
                name === "precip" ? "Rain probability" :
                name === "busRisk" ? "Bus delay risk" : "Streetcar delay risk",
              ]}
            />
            <ReferenceLine y={60} stroke="var(--destructive)" strokeDasharray="3 3"
              label={{ value: "High risk", fill: "var(--destructive)", fontSize: 9, position: "insideTopLeft" }} />
            <ReferenceLine y={35} stroke="var(--warn)" strokeDasharray="3 3"
              label={{ value: "Moderate", fill: "var(--warn)", fontSize: 9, position: "insideTopLeft" }} />
            <Line dataKey="precip"        stroke="var(--cyan)"        strokeWidth={2} dot={false} name="precip" />
            <Line dataKey="busRisk"       stroke="var(--warn)"        strokeWidth={2} dot={false} name="busRisk" strokeDasharray="4 4" />
            <Line dataKey="streetcarRisk" stroke="var(--destructive)" strokeWidth={1.5} dot={false} name="streetcarRisk" strokeDasharray="2 3" />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* ── Row 4: At-risk routes + 6h summary ─────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        {/* At-risk routes */}
        <ChartCard
          title="At-risk routes"
          subtitle="Low on-time % + high weather vulnerability"
          className="lg:col-span-2"
        >
          {atRiskRoutes.length === 0 ? (
            <div className="flex items-center gap-2 py-4 text-sm text-success">
              <CheckCircle className="size-4" /> All surface routes within normal risk threshold
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="text-left py-2 px-2 font-medium">Route</th>
                    <th className="text-right py-2 px-2 font-medium">On-time %</th>
                    <th className="text-right py-2 px-2 font-medium">Weather risk</th>
                    <th className="text-right py-2 px-2 font-medium">Combined risk</th>
                    <th className="text-left py-2 px-2 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {atRiskRoutes.map((r) => {
                    const weatherR = r.mode === "streetcar" ? streetcarRisk : busRisk;
                    const color = r.combinedRisk > 65 ? "text-destructive" : "text-warn";
                    return (
                      <tr key={r.id} className="border-b border-border/50 hover:bg-surface/40">
                        <td className="py-2 px-2">
                          <div className="flex items-center gap-2">
                            <span className="size-6 rounded text-[10px] font-bold flex items-center justify-center text-white shrink-0"
                              style={{ background: r.color }}>{r.shortName}</span>
                            <span className="truncate max-w-[120px]">{r.longName}</span>
                          </div>
                        </td>
                        <td className={`py-2 px-2 text-right font-semibold ${r.onTime < 70 ? "text-destructive" : "text-warn"}`}>
                          {r.onTime}%
                        </td>
                        <td className={`py-2 px-2 text-right ${weatherR > 50 ? "text-destructive" : "text-warn"}`}>
                          {weatherR}/100
                        </td>
                        <td className={`py-2 px-2 text-right font-bold ${color}`}>
                          {r.combinedRisk}/100
                        </td>
                        <td className="py-2 px-2 text-muted-foreground">
                          {r.combinedRisk > 65 ? "⚡ Deploy extra service" : "👀 Monitor closely"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </ChartCard>

        {/* 6-hour weather summary */}
        <ChartCard title="Next 6 hours" subtitle="Condition · precip · impact">
          <div className="space-y-2">
            {next6h.map((w, i) => {
              const h = (new Date().getHours() + i) % 24;
              const impact = weatherImpactLevel(w.precip ?? 0, w.temp ?? 15, w.wind ?? 0);
              return (
                <div key={i} className={`rounded-xl border px-3 py-2 flex items-center justify-between ${IMPACT_BG[impact]}`}>
                  <div>
                    <div className="text-xs font-semibold">{String(h).padStart(2,"0")}:00</div>
                    <div className="text-[10px] text-muted-foreground">{w.condition}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs">{w.temp}°C · {w.precip}%</div>
                    <div className={`text-[10px] font-medium capitalize ${IMPACT_COLOR[impact]}`}>{impact}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </ChartCard>
      </div>

      {/* ── Row 5: Precipitation × delay bar chart ──────────────────────────── */}
      <ChartCard
        title="Hourly precipitation vs. predicted bus delay risk"
        subtitle="Next 12 hours · rain probability (cyan) vs delay risk (amber) · Open-Meteo + TTC patterns"
        className="h-[280px] mb-4"
      >
        <ResponsiveContainer>
          <BarChart data={hourlyForecast.slice(0, 12)}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="time" stroke="var(--muted-foreground)" fontSize={10} tickLine={false} axisLine={false} />
            <YAxis stroke="var(--muted-foreground)" fontSize={10} tickLine={false} axisLine={false} domain={[0, 100]} />
            <RTooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 10, fontSize: 11 }} />
            <Bar dataKey="precip"  fill="var(--cyan)"  radius={[4,4,0,0]} name="Rain probability %" />
            <Bar dataKey="busRisk" fill="var(--warn)"  radius={[4,4,0,0]} name="Bus delay risk"     />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* ── Model card ────────────────────────────────────────────────────────── */}
      <ModelCard />

      <WhyDrawer open={whyOpen} onClose={() => setWhyOpen(false)} />
    </div>
  );
}
