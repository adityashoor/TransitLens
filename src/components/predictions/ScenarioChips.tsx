import { useUI, type Scenario } from "@/store/ui";
import { SCENARIO_META } from "@/mock/predictions";
import { cn } from "@/lib/utils";

export function ScenarioChips() {
  const { scenario, setScenario } = useUI();
  const items = Object.keys(SCENARIO_META) as Scenario[];
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Forecast scenario">
      {items.map((s) => {
        const m = SCENARIO_META[s];
        const active = scenario === s;
        return (
          <button
            key={s}
            role="radio"
            aria-checked={active}
            onClick={() => setScenario(s)}
            className={cn(
              "px-3 h-9 rounded-full text-xs font-medium border transition-all inline-flex items-center gap-1.5",
              active
                ? "bg-primary text-primary-foreground border-primary shadow-[0_0_0_4px_oklch(0.72_0.18_240/0.15)]"
                : "bg-surface/60 border-border text-muted-foreground hover:text-foreground hover:bg-surface",
            )}
            title={m.description}
          >
            <span aria-hidden>{m.emoji}</span>
            {m.label}
          </button>
        );
      })}
    </div>
  );
}
