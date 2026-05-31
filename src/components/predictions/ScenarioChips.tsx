import { useUI } from "@/store/ui";
import { useRealScenarios } from "@/hooks/useRealScenarios";
import { cn } from "@/lib/utils";
import { Wifi } from "lucide-react";

export function ScenarioChips() {
  const { scenario, setScenario } = useUI();
  const scenarios = useRealScenarios();

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Forecast scenario">
        {scenarios.map((s) => {
          const active = scenario === s.id;
          return (
            <button
              key={s.id}
              role="radio"
              aria-checked={active}
              onClick={() => setScenario(s.id)}
              className={cn(
                "px-3 h-9 rounded-full text-xs font-medium border transition-all inline-flex items-center gap-1.5",
                active
                  ? "bg-primary text-primary-foreground border-primary shadow-[0_0_0_4px_oklch(0.72_0.18_240/0.15)]"
                  : "bg-surface/60 border-border text-muted-foreground hover:text-foreground hover:bg-surface",
              )}
              title={s.description}
            >
              <span aria-hidden>{s.emoji}</span>
              {s.label}
              {s.isLive && (
                <span className={cn(
                  "inline-flex items-center gap-0.5 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full ml-0.5",
                  s.severity === "high"   ? "bg-destructive/15 text-destructive" :
                  s.severity === "medium" ? "bg-warn/15 text-warn" :
                                            "bg-success/15 text-success",
                )}>
                  <Wifi className="size-2" />
                  live
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Live detected events count */}
      {scenarios.filter((s) => s.isLive).length > 0 ? (
        <div className="text-[10px] text-muted-foreground flex items-center gap-1">
          <span className="size-1.5 rounded-full bg-success animate-pulse inline-block" />
          {scenarios.filter((s) => s.isLive).length} live event{scenarios.filter((s) => s.isLive).length > 1 ? "s" : ""} detected from GTFS-RT, weather & disruption feeds
        </div>
      ) : (
        <div className="text-[10px] text-muted-foreground">
          No active events detected — network operating normally
        </div>
      )}
    </div>
  );
}
