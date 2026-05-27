import { motion, AnimatePresence } from "framer-motion";
import { X, Brain, TrendingUp, TrendingDown } from "lucide-react";
import { attributionsFor } from "../../mock/predictions";
import { useUI } from "../../store/ui";
import { cn } from "../../lib/utils";
import { useEffect } from "react";

export function WhyDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { scenario } = useUI();
  const features = attributionsFor(scenario);
  const total = features.reduce((a, f) => a + Math.abs(f.weight), 0);

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
            className="fixed top-0 right-0 h-full w-full sm:w-[440px] z-[1100] glass-panel border-l border-border overflow-y-auto scrollbar-thin"
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
                <div className="text-xs text-muted-foreground mt-0.5">Top features driving the next-hour forecast.</div>
              </div>
              <button onClick={onClose} className="size-8 rounded-lg hover:bg-surface flex items-center justify-center" aria-label="Close">
                <X className="size-4" />
              </button>
            </header>

            <div className="p-5 space-y-3">
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
                Attributions use SHAP-style approximation on the gradient-boosted forecaster. Mock values for demo.
              </div>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
