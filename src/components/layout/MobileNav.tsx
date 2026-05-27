import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, Map, BarChart3, Sparkles, Activity, Route as RouteIcon } from "lucide-react";
import { cn } from "../../lib/utils";

const items = [
  { to: "/", label: "Home", icon: LayoutDashboard },
  { to: "/map", label: "Map", icon: Map },
  { to: "/analytics", label: "Stats", icon: BarChart3 },
  { to: "/predictions", label: "AI", icon: Sparkles },
  { to: "/simulator", label: "Sim", icon: Activity },
  { to: "/routes", label: "Routes", icon: RouteIcon },
] as const;

export function MobileNav() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 glass-panel border-t border-border">
      <div className="grid grid-cols-6">
        {items.map((it) => {
          const active = it.to === "/" ? path === "/" : path.startsWith(it.to);
          const Icon = it.icon;
          return (
            <Link
              key={it.to}
              to={it.to}
              className={cn(
                "flex flex-col items-center gap-0.5 py-2 text-[10px]",
                active ? "text-primary" : "text-muted-foreground",
              )}
            >
              <Icon className="size-5" />
              {it.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
