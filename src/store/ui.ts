import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type Theme = "dark" | "light";
export type Scenario = "baseline" | "raptors" | "snowstorm" | "strike" | "heatwave";

interface UIState {
  theme: Theme;
  sidebarCollapsed: boolean;
  reducedMotion: boolean;
  highContrast: boolean;
  density: "comfortable" | "compact";
  mapLayers: { routes: boolean; stops: boolean; vehicles: boolean; heatmap: boolean; traffic: boolean; bike: boolean };
  timeOffset: number; // minutes, 0 = now, negative = past
  scenario: Scenario;
  commandOpen: boolean;
  setTheme: (t: Theme) => void;
  toggleSidebar: () => void;
  setReducedMotion: (b: boolean) => void;
  setHighContrast: (b: boolean) => void;
  setDensity: (d: "comfortable" | "compact") => void;
  setLayer: (k: keyof UIState["mapLayers"], v: boolean) => void;
  setAllLayers: (v: boolean) => void;
  setTimeOffset: (n: number) => void;
  setScenario: (s: Scenario) => void;
  setCommandOpen: (b: boolean) => void;
}

export const useUI = create<UIState>()(
  persist(
    (set) => ({
      theme: "dark",
      sidebarCollapsed: false,
      reducedMotion: false,
      highContrast: false,
      density: "comfortable",
      mapLayers: { routes: true, stops: true, vehicles: true, heatmap: false, traffic: false, bike: false },
      timeOffset: 0,
      scenario: "baseline",
      commandOpen: false,
      setTheme: (theme) => {
        if (typeof document !== "undefined") {
          document.documentElement.classList.toggle("light", theme === "light");
          document.documentElement.classList.toggle("dark", theme === "dark");
        }
        set({ theme });
      },
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setReducedMotion: (reducedMotion) => set({ reducedMotion }),
      setHighContrast: (highContrast) => {
        if (typeof document !== "undefined") {
          document.documentElement.classList.toggle("high-contrast", highContrast);
        }
        set({ highContrast });
      },
      setDensity: (density) => set({ density }),
      setLayer: (k, v) => set((s) => ({ mapLayers: { ...s.mapLayers, [k]: v } })),
      setAllLayers: (v) =>
        set((s) => ({
          mapLayers: Object.fromEntries(Object.keys(s.mapLayers).map((k) => [k, v])) as UIState["mapLayers"],
        })),
      setTimeOffset: (timeOffset) => set({ timeOffset }),
      setScenario: (scenario) => set({ scenario }),
      setCommandOpen: (commandOpen) => set({ commandOpen }),
    }),
    {
      name: "transitlens-ui",
      storage: createJSONStorage(() => (typeof window !== "undefined" ? localStorage : (undefined as never))),
      partialize: (s) => ({
        theme: s.theme,
        sidebarCollapsed: s.sidebarCollapsed,
        reducedMotion: s.reducedMotion,
        highContrast: s.highContrast,
        density: s.density,
        mapLayers: s.mapLayers,
      }),
    },
  ),
);
