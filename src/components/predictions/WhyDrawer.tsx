import { motion, AnimatePresence } from "framer-motion";
import { X, Brain, TrendingUp, TrendingDown, Sparkles, Loader2 } from "lucide-react";
import { attributionsFor } from "@/mock/predictions";
import { useUI } from "@/store/ui";
import { cn } from "@/lib/utils";
import { useEffect, useState, useCallback } from "react";
import { useDisruptions, useWeather, useNetwork } from "@/mock/api";
import { geminiAsk, geminiAvailable } from "@/lib/gemini";

export function WhyDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { scenario } = useUI();

  // Hooks must be declared before use
  const { data: disruptions = [] } = useDisruptions();
  const { data: weather = [] } = useWeather();
  const { data: net } = useNetwork();

  // Build context from available live/public inputs
  const now = new Date();
  const realCtx = {
    day:             now.toLocaleDateString("en-CA", { weekday: "long" }),
    hour:            now.getHours(),
    tempC:           weather[0]?.temp,
    precip:          weather[0]?.precip,
    condition:       weather[0]?.condition,
    highDisruptions: disruptions.filter((d: { severity?: string }) => d.severity === "high").length,
  };

  const features = attributionsFor(scenario, realCtx);
  const total = features.reduce((a, f) => a + Math.abs(f.weight), 0);

  const [aiExplanation, setAiExplanation] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchExplanation = useCallback(async () => {
    if (!open || !geminiAvailable) return;
    setLoading(true);
    setAiExplanation(null);

    // Build context from available live/public inputs
    const now = new Date();
    const hourStr = `${now.getHours()}:00`;
    const dayName = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][now.getDay()];
    const highDisruptions = disruptions.filter((d: { severity?: string }) => d.severity === "high").length;
    const currentWeather = weather[0];
    const routeCount = net?.routes.length ?? 232;
    const activeVehicles = net?.routes.length ? routeCount * 8 : 0;

    const prompt = `You are a Toronto transit (TTC) demand forecasting AI assistant. Explain in 3-4 clear sentences why transit demand is forecast as described, using only the source context provided. Be specific, data-driven, and actionable for a transit planner.

Current conditions:
- Time: ${hourStr} on ${dayName}
- Scenario: ${scenario}
- Active high-severity disruptions: ${highDisruptions}
- Current weather: ${currentWeather ? `${currentWeather.condition}, ${currentWeather.temp}°C, ${currentWeather.precip}% precipitation probability` : "data unavailable"}
- Routes on the network: ${routeCount}
- Forecast horizon: next 24 hours

Top demand drivers:
${features.map(f => `- ${f.feature}: ${f.weight > 0 ? "+" : ""}${Math.round(f.weight * 100)}% influence — ${f.hint}`).join("\n")}

Explain why demand is forecast at current levels and what transit planners should watch for next.`;

    const result = await geminiAsk(prompt);
    setAiExplanation(result);
    setLoading(false);
  }, [open, scenario, disruptions, weather, net, features]);

  useEffect(() => {
    if (open) fetchExplanation();
  }, [open, fetchExplanation]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 bg-background/60 backdrop-blur-sm z-[1090]"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.aside
            className="fixed top-0 right-0 h-full w-full sm:w-[460px] z-[1100] glass-panel border-l border-border overflow-y-auto scrollbar-thin"
            initial={{ x: 480 }} animate={{ x: 0 }} exit={{ x: 480 }}
            transition={{ type: "spring", stiffness: 240, damping: 28 }}
            role="dialog" aria-modal="true" aria-label="Why this prediction"
          >
            <header className="sticky top-0 bg-background/40 backdrop-blur-xl border-b border-border p-5 flex items-start gap-3 z-10">
              <div className="size-10 rounded-xl bg-primary/15 border border-border flex items-center justify-center">
                <Brain className="size-5 text-primary" />
              </div>
              <div className="flex-1">
                <div className="font-semibold">Why this prediction?</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {geminiAvailable ? "Gemini Flash · source-context analysis" : "Feature attribution breakdown"}
                </div>
              </div>
              <button onClick={onClose} className="size-8 rounded-lg hover:bg-surface flex items-center justify-center" aria-label="Close">
                <X className="size-4" />
              </button>
            </header>

            <div className="p-5 space-y-4">
              {/* Gemini AI explanation */}
              {geminiAvailable && (
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="size-3.5 text-primary animate-pulse-glow" />
                    <span className="text-xs font-semibold text-primary">Gemini Flash Source Analysis</span>
                  </div>
                  {loading ? (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Loader2 className="size-3.5 animate-spin" />
                      Analysing available TTC conditions...
                    </div>
                  ) : aiExplanation ? (
                    <p className="text-xs text-foreground leading-relaxed">{aiExplanation}</p>
                  ) : (
                    <p className="text-xs text-muted-foreground">Analysis unavailable — showing feature breakdown below.</p>
                  )}
                </div>
              )}

              {/* Feature attributions */}
              <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Feature attribution</div>
              {features.map((f) => {
                const pct = Math.round((Math.abs(f.weight) / total) * 100);
                const positive = f.weight >= 0;
                return (
                  <div key={f.feature} className="rounded-xl border border-border bg-surface/40 p-3">
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "size-6 rounded-md flex items-center justify-center",
                        positive ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive",
                      )}>
                        {positive ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}
                      </span>
                      <div className="text-sm font-medium flex-1">{f.feature}</div>
                      <div className="text-xs tabular-nums text-muted-foreground">{pct}%</div>
                    </div>
                    <div className="mt-2 h-1.5 rounded-full bg-surface overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.6, ease: "easeOut" }}
                        className={cn("h-full rounded-full", positive ? "bg-success" : "bg-destructive")}
                      />
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground">{f.hint}</div>
                  </div>
                );
              })}

              <div className="rounded-xl border border-border bg-surface/40 p-3 text-xs text-muted-foreground">
                {geminiAvailable
                  ? "AI explanation powered by Gemini Flash using available GTFS-RT, weather, disruption, and modeled attribution context."
                  : "Attributions use SHAP-style approximation on the gradient-boosted forecaster."}
              </div>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
