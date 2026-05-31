import { Layers, Train, TramFront, Bus, MapPin, Eye, EyeOff, ZoomIn } from "lucide-react";
import { useUI } from "@/store/ui";
import { cn } from "@/lib/utils";

const LAYER_META = {
  routes:   { label: "Routes",   icon: Train,  hint: "Subway, streetcar & bus lines" },
  stops:    { label: "Stops",    icon: MapPin, hint: "TTC stops — zoom in to see" },
  vehicles: { label: "Vehicles", icon: Bus,    hint: "Live positions from GTFS-RT" },
} as const;

interface Props {
  counts?: Partial<Record<string, number>>;
  mapZoom?: number;
}

export function LayerControls({ counts, mapZoom = 12 }: Props) {
  const { mapLayers, setLayer, setAllLayers } = useUI();
  const allOff = !mapLayers.routes && !mapLayers.stops && !mapLayers.vehicles;

  return (
    <div className="glass-card rounded-2xl p-3 w-56">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <Layers className="size-3.5" /> Layers
        </div>
        <button
          onClick={() => setAllLayers(!allOff)}
          className="text-[10px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
        >
          {allOff ? <Eye className="size-3" /> : <EyeOff className="size-3" />}
          {allOff ? "Show all" : "Hide all"}
        </button>
      </div>

      <ul className="space-y-0.5">
        {(Object.keys(LAYER_META) as (keyof typeof LAYER_META)[]).map((k) => {
          const { label, icon: Icon, hint } = LAYER_META[k];
          const on = mapLayers[k];

          return (
            <li key={k}>
              <button
                onClick={() => setLayer(k, !on)}
                className={cn(
                  "w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm transition-colors",
                  on
                    ? "bg-primary/10 text-foreground hover:bg-primary/15"
                    : "text-muted-foreground hover:bg-surface",
                )}
                aria-pressed={on}
                title={hint}
              >
                <Icon className={cn("size-4 shrink-0", on ? "text-primary" : "text-muted-foreground")} />
                <span className="flex-1 text-left">{label}</span>
                {counts?.[k] !== undefined && (
                  <span className="text-[10px] tabular-nums text-muted-foreground">{counts[k]}</span>
                )}
                {/* Zoom hint icon for stops */}
                {k === "stops" && on && mapZoom < 13 && (
                  <ZoomIn className="size-3 text-warn" title="Zoom in to see stops" />
                )}
                <span className={cn(
                  "size-3 rounded-full border transition-colors shrink-0",
                  on ? "bg-primary border-primary" : "bg-transparent border-border",
                )} aria-hidden />
              </button>
            </li>
          );
        })}
      </ul>

      {/* Stops zoom hint */}
      {mapLayers.stops && mapZoom < 13 && (
        <div className="mt-2 flex items-center gap-1.5 text-[10px] text-warn bg-warn/8 rounded-lg px-2 py-1.5">
          <ZoomIn className="size-3 shrink-0" />
          Zoom to level 13+ to see stops
        </div>
      )}

      <div className="mt-3 pt-3 border-t border-border flex items-center gap-3 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1"><Train className="size-3 text-primary" /> Subway</span>
        <span className="flex items-center gap-1"><TramFront className="size-3 text-cyan" /> Streetcar</span>
        <span className="flex items-center gap-1"><Bus className="size-3 text-teal" /> Bus</span>
      </div>
    </div>
  );
}
