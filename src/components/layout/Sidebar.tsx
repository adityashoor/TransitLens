import { Link, useRouterState } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  LayoutDashboard, Map, BarChart3, Sparkles, Globe2, Activity, Route as RouteIcon, Settings, Train,
  ChevronLeft, Siren, Bus, Network, ShieldAlert, CloudSnow, Wallet,
} from "lucide-react";
import { useUI } from "@/store/ui";
import { cn } from "@/lib/utils";

const items = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/map", label: "Live Map", icon: Map },
  { to: "/incidents", label: "Incidents", icon: Siren },
  { to: "/fleet", label: "Fleet Health", icon: Bus },
  { to: "/demand", label: "Demand (OD)", icon: Network },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/predictions", label: "AI Predictions", icon: Sparkles },
  { to: "/equity", label: "Equity Heatmap", icon: Globe2 },
  { to: "/safety", label: "Safety / Vision Zero", icon: ShieldAlert },
  { to: "/weather", label: "Weather Impact", icon: CloudSnow },
  { to: "/budget", label: "Budget & Subsidy", icon: Wallet },
  { to: "/simulator", label: "Disruption Sim", icon: Activity },
  { to: "/routes", label: "Route Explorer", icon: RouteIcon },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export function Sidebar() {
  const { sidebarCollapsed, toggleSidebar } = useUI();
  const path = useRouterState({ select: (s) => s.location.pathname });

  return (
    <motion.aside
      animate={{ width: sidebarCollapsed ? 76 : 248 }}
      transition={{ type: "spring", stiffness: 240, damping: 28 }}
      className="relative hidden md:flex flex-col border-r border-border bg-sidebar/80 backdrop-blur-xl z-30"
    >
      <div className="flex items-center gap-3 px-5 h-16 border-b border-border">
        <div className="size-9 rounded-xl flex items-center justify-center shrink-0 glow-ring"
             style={{ background: "var(--gradient-primary)" }}>
          <Train className="size-5 text-primary-foreground" />
        </div>
        {!sidebarCollapsed && (
          <div className="overflow-hidden">
            <div className="font-semibold tracking-tight text-gradient text-lg leading-none">TransitLens</div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mt-1">Toronto · Live</div>
          </div>
        )}
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto scrollbar-thin">
        {items.map((it) => {
          const active = it.to === "/" ? path === "/" : path.startsWith(it.to);
          const Icon = it.icon;
          return (
            <Link
              key={it.to}
              to={it.to}
              className={cn(
                "group flex items-center gap-3 px-3 h-10 rounded-xl text-sm transition-all",
                "hover:bg-sidebar-accent/60 text-muted-foreground hover:text-foreground",
                active && "bg-sidebar-accent text-foreground",
              )}
            >
              <Icon className={cn("size-[18px] shrink-0", active && "text-primary")} />
              {!sidebarCollapsed && <span className="truncate">{it.label}</span>}
              {active && !sidebarCollapsed && (
                <span className="ml-auto size-1.5 rounded-full bg-primary animate-pulse-glow" />
              )}
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t border-border">
        <button
          onClick={toggleSidebar}
          className="w-full flex items-center justify-center gap-2 h-9 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-colors"
        >
          <ChevronLeft className={cn("size-4 transition-transform", sidebarCollapsed && "rotate-180")} />
          {!sidebarCollapsed && "Collapse"}
        </button>
      </div>
    </motion.aside>
  );
}
