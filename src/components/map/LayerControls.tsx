import { Layers, Train, TramFront, Bus, MapPin, Flame, Bike, Car, Eye, EyeOff } from "lucide-react";
import { useUI } from "@/store/ui";
import { cn } from "@/lib/utils";

const LAYER_META: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; hint: string }> = {
  routes: { label: "Routes", icon: Train, hint: "Subway, streetcar & bus lines" },
  stops: { label: "Stops", icon: MapPin, hint: "Stop markers along routes" },
  vehicles: { label: "Vehicles", icon: Bus, hint: "Live vehicle positions" },
  heatmap: { label: "Crowding", icon: Flame, hint: "Passenger density heatmap" },
  traffic: { label: "Traffic", icon: Car, hint: "Road congestion overlay" },
  bike: { label: "Bike share", icon: Bike, hint: "Bike Share Toronto stations" },
};

export function LayerControls({ counts }: { counts?: Partial<Record<string, number>> }) {
  const { mapLayers, setLayer, setAllLayers } = useUI();
  const allOn = Object.values(mapLayers).every(Boolean);
  const allOff = Object.values(mapLayers).every((v) => !v);

  return (
    <div className="glass-card rounded-2xl p-3 w-64">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <Layers className="size-3.5" /> Layers
        </div>
        <button
          onClick={() => setAllLayers(allOff)}
          className="text-[10px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
          aria-label={allOff ? "Show all layers" : "Hide all layers"}
        >
          {allOff ? <Eye className="size-3" /> : <EyeOff className="size-3" />}
          {allOff ? "Show all" : "Hide all"}
        </button>
      </div>
      <ul className="space-y-1">
        {(Object.keys(mapLayers) as Array<keyof typeof mapLayers>).map((k) => {
          const meta = LAYER_META[k];
          const Icon = meta.icon;
          const on = mapLayers[k];
          return (
            <li key={k}>
              <button
                onClick={() => setLayer(k, !on)}
                className={cn(
                  "w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm transition-colors",
                  on ? "bg-primary/10 text-foreground" : "text-muted-foreground hover:bg-surface",
                )}
                aria-pressed={on}
                title={meta.hint}
              >
                <Icon className={cn("size-4 shrink-0", on ? "text-primary" : "text-muted-foreground")} />
                <span className="flex-1 text-left">{meta.label}</span>
                {counts?.[k] !== undefined && (
                  <span className="text-[10px] tabular-nums text-muted-foreground">{counts[k]}</span>
                )}
                <span
                  className={cn(
                    "size-3.5 rounded-full border border-border transition-colors",
                    on ? "bg-primary" : "bg-transparent",
                  )}
                  aria-hidden
                />
              </button>
            </li>
          );
        })}
      </ul>
      <div className="mt-3 pt-3 border-t border-border flex items-center gap-3 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1"><Train className="size-3 text-primary" /> Subway</span>
        <span className="flex items-center gap-1"><TramFront className="size-3 text-cyan" /> Streetcar</span>
        <span className="flex items-center gap-1"><Bus className="size-3 text-teal" /> Bus</span>
      </div>
    </div>
  );
}
