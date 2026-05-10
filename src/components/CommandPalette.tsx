import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator,
} from "@/components/ui/command";
import { useUI } from "@/store/ui";
import { useNetwork, useHoods } from "@/mock/api";
import {
  LayoutDashboard, Map, BarChart3, Sparkles, Activity, Route as RouteIcon,
  Settings, Scale, Sun, Moon, MapPin,
} from "lucide-react";

export function CommandPalette() {
  const { commandOpen, setCommandOpen, theme, setTheme } = useUI();
  const navigate = useNavigate();
  const { data: net } = useNetwork();
  const { data: hoods = [] } = useHoods();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandOpen(!commandOpen);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [commandOpen, setCommandOpen]);

  const go = (to: string) => {
    setCommandOpen(false);
    navigate({ to });
  };

  return (
    <CommandDialog open={commandOpen} onOpenChange={setCommandOpen}>
      <CommandInput placeholder="Search routes, neighbourhoods, pages…" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        <CommandGroup heading="Pages">
          <CommandItem onSelect={() => go("/")}><LayoutDashboard className="mr-2 size-4" />Dashboard</CommandItem>
          <CommandItem onSelect={() => go("/map")}><Map className="mr-2 size-4" />Live Map</CommandItem>
          <CommandItem onSelect={() => go("/analytics")}><BarChart3 className="mr-2 size-4" />Analytics</CommandItem>
          <CommandItem onSelect={() => go("/predictions")}><Sparkles className="mr-2 size-4" />AI Predictions</CommandItem>
          <CommandItem onSelect={() => go("/equity")}><Scale className="mr-2 size-4" />Equity Heatmap</CommandItem>
          <CommandItem onSelect={() => go("/simulator")}><Activity className="mr-2 size-4" />Disruption Simulator</CommandItem>
          <CommandItem onSelect={() => go("/routes")}><RouteIcon className="mr-2 size-4" />Route Explorer</CommandItem>
          <CommandItem onSelect={() => go("/settings")}><Settings className="mr-2 size-4" />Settings</CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Actions">
          <CommandItem onSelect={() => { setTheme(theme === "dark" ? "light" : "dark"); setCommandOpen(false); }}>
            {theme === "dark" ? <Sun className="mr-2 size-4" /> : <Moon className="mr-2 size-4" />}
            Switch to {theme === "dark" ? "light" : "dark"} mode
          </CommandItem>
        </CommandGroup>

        {net?.routes.length ? (
          <>
            <CommandSeparator />
            <CommandGroup heading="Routes">
              {net.routes.slice(0, 12).map((r) => (
                <CommandItem
                  key={r.id}
                  value={`${r.shortName} ${r.longName}`}
                  onSelect={() => go(`/routes/${r.id}`)}
                >
                  <span className="mr-2 size-5 rounded text-[10px] font-bold flex items-center justify-center text-primary-foreground" style={{ background: r.color }}>
                    {r.shortName}
                  </span>
                  <span className="truncate">{r.longName}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        ) : null}

        {hoods.length ? (
          <>
            <CommandSeparator />
            <CommandGroup heading="Neighbourhoods">
              {hoods.slice(0, 8).map((h) => (
                <CommandItem key={h.id} value={h.name} onSelect={() => go("/equity")}>
                  <MapPin className="mr-2 size-4 text-muted-foreground" />
                  {h.name}
                  <span className="ml-auto text-[10px] text-muted-foreground">Mobility {h.mobilityScore}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        ) : null}
      </CommandList>
    </CommandDialog>
  );
}
