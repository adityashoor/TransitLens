import { createFileRoute } from "@tanstack/react-router";
import { useUI } from "../store/ui";
import { ChartCard, PageHeader } from "../components/ui-ext/ChartCard";
import { Switch } from "../components/ui/switch";
import { Sun, Moon, Monitor } from "lucide-react";

export const Route = createFileRoute("/settings")({
  component: Settings,
});

function Settings() {
  const {
    theme, setTheme, reducedMotion, setReducedMotion, mapLayers, setLayer,
    highContrast, setHighContrast, density, setDensity,
  } = useUI();

  return (
    <div className="px-4 md:px-6 py-6 max-w-[900px] mx-auto">
      <PageHeader title="Settings" subtitle="Configure your TransitLens experience" />

      <div className="grid grid-cols-1 gap-4">
        <ChartCard title="Profile" subtitle="Operator account">
          <div className="flex items-center gap-4">
            <div className="size-14 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center text-primary-foreground font-bold">AK</div>
            <div>
              <div className="font-semibold">Alex Kim</div>
              <div className="text-xs text-muted-foreground">TTC Operations · alex@transitlens.io</div>
            </div>
          </div>
        </ChartCard>

        <ChartCard title="Appearance" subtitle="Theme and motion">
          <div className="space-y-4">
            <div>
              <div className="text-sm mb-2">Theme</div>
              <div className="inline-flex rounded-xl bg-surface/60 border border-border p-1">
                {([
                  ["dark", Moon],
                  ["light", Sun],
                ] as const).map(([t, Icon]) => (
                  <button
                    key={t}
                    onClick={() => setTheme(t)}
                    className={`px-3 h-8 rounded-lg text-xs font-medium capitalize inline-flex items-center gap-1.5 transition-colors ${theme === t ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
                  >
                    <Icon className="size-3.5" /> {t}
                  </button>
                ))}
                <button className="px-3 h-8 rounded-lg text-xs font-medium text-muted-foreground inline-flex items-center gap-1.5">
                  <Monitor className="size-3.5" /> system
                </button>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm">Reduced motion</div>
                <div className="text-xs text-muted-foreground">Disable non-essential animations.</div>
              </div>
              <Switch checked={reducedMotion} onCheckedChange={setReducedMotion} />
            </div>
          </div>
        </ChartCard>

        <ChartCard title="Map preferences" subtitle="Default visible layers">
          <div className="space-y-3">
            {(Object.keys(mapLayers) as Array<keyof typeof mapLayers>).map((k) => (
              <div key={k} className="flex items-center justify-between">
                <div className="text-sm capitalize">{k}</div>
                <Switch checked={mapLayers[k]} onCheckedChange={(v) => setLayer(k, v)} />
              </div>
            ))}
          </div>
        </ChartCard>

        <ChartCard title="Accessibility" subtitle="Display & interaction">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm">High contrast</div>
                <div className="text-xs text-muted-foreground">Stronger borders and text contrast.</div>
              </div>
              <Switch checked={highContrast} onCheckedChange={setHighContrast} />
            </div>
            <div>
              <div className="text-sm mb-2">Density</div>
              <div className="inline-flex rounded-xl bg-surface/60 border border-border p-1">
                {(["comfortable", "compact"] as const).map((d) => (
                  <button
                    key={d}
                    onClick={() => setDensity(d)}
                    className={`px-3 h-8 rounded-lg text-xs font-medium capitalize ${density === d ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
            <div className="text-xs text-muted-foreground">Press <kbd className="border border-border rounded px-1 py-0.5">⌘K</kbd> anywhere to open the command palette.</div>
          </div>
        </ChartCard>

        <ChartCard title="Saved filters" subtitle="Reuse common views">
          <ul className="space-y-2">
            {["Rush hour · Subway only", "Underserved neighborhoods", "Top 10 busiest routes"].map((s) => (
              <li key={s} className="rounded-xl border border-border bg-surface/40 p-3 text-sm flex items-center justify-between">
                <span>{s}</span>
                <button className="text-xs text-muted-foreground hover:text-foreground">Apply</button>
              </li>
            ))}
          </ul>
        </ChartCard>
      </div>
    </div>
  );
}
