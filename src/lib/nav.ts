import {
  LayoutDashboard, Map, BarChart3, Sparkles, Globe2, Activity, Route as RouteIcon,
  Settings, Siren, Bus, Network, ShieldAlert, CloudSnow, Wallet,
  type LucideIcon,
} from "lucide-react";

/** Domain color used to tint the icon chip in the mobile "More" sheet. */
export type NavTone =
  | "primary" | "accent" | "cyan" | "success" | "warn" | "destructive" | "muted";

export type NavItem = {
  to: string;
  /** Full label used in the desktop sidebar and the mobile "More" sheet. */
  label: string;
  /** Short label used on the mobile bottom bar. Falls back to `label`. */
  short?: string;
  icon: LucideIcon;
  tone?: NavTone;
};

/** Single source of truth for app navigation. Consumed by the sidebar and mobile nav. */
export const NAV: NavItem[] = [
  { to: "/", label: "Dashboard", short: "Home", icon: LayoutDashboard, tone: "primary" },
  { to: "/map", label: "Live Map", short: "Map", icon: Map, tone: "cyan" },
  { to: "/incidents", label: "Incidents", icon: Siren, tone: "destructive" },
  { to: "/fleet", label: "Fleet Health", short: "Fleet", icon: Bus, tone: "cyan" },
  { to: "/demand", label: "Demand (OD)", short: "Demand", icon: Network, tone: "primary" },
  { to: "/analytics", label: "Analytics", short: "Stats", icon: BarChart3, tone: "accent" },
  { to: "/predictions", label: "AI Predictions", short: "AI", icon: Sparkles, tone: "primary" },
  { to: "/equity", label: "Equity Heatmap", short: "Equity", icon: Globe2, tone: "success" },
  { to: "/safety", label: "Safety / Vision Zero", short: "Safety", icon: ShieldAlert, tone: "warn" },
  { to: "/weather", label: "Weather Impact", short: "Weather", icon: CloudSnow, tone: "cyan" },
  { to: "/budget", label: "Budget & Subsidy", short: "Budget", icon: Wallet, tone: "warn" },
  { to: "/simulator", label: "Disruption Sim", short: "Sim", icon: Activity, tone: "accent" },
  { to: "/routes", label: "Route Explorer", short: "Routes", icon: RouteIcon, tone: "primary" },
  { to: "/settings", label: "Settings", icon: Settings, tone: "muted" },
];

/** Routes pinned as fixed tabs on the mobile bottom bar; the rest live in the "More" sheet. */
export const MOBILE_PRIMARY = ["/", "/map", "/predictions", "/routes"] as const;

export const MOBILE_PRIMARY_ITEMS = MOBILE_PRIMARY.map(
  (to) => NAV.find((n) => n.to === to)!,
);

/** Everything not pinned to the bottom bar, shown in the "More" grid. */
export const MOBILE_MORE_ITEMS = NAV.filter(
  (n) => !MOBILE_PRIMARY.includes(n.to as (typeof MOBILE_PRIMARY)[number]),
);

/** Whether a nav item is active for the given pathname. */
export function isNavActive(to: string, pathname: string): boolean {
  return to === "/" ? pathname === "/" : pathname.startsWith(to);
}
