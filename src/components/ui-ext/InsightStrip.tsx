import { Lightbulb, TrendingUp, AlertTriangle, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type InsightKind = "warn" | "success" | "info" | "critical";

interface Insight {
  kind: InsightKind;
  headline: string;
  detail: string;
  action?: string;
}

const ICONS = {
  warn:     AlertTriangle,
  success:  CheckCircle,
  info:     Lightbulb,
  critical: TrendingUp,
} as const;

const COLORS: Record<InsightKind, string> = {
  warn:     "border-warn/30 bg-warn/8 text-warn",
  success:  "border-success/30 bg-success/8 text-success",
  info:     "border-primary/30 bg-primary/8 text-primary",
  critical: "border-destructive/30 bg-destructive/8 text-destructive",
};

function InsightCard({ insight }: { insight: Insight }) {
  const Icon = ICONS[insight.kind];
  return (
    <div className={cn("rounded-xl border px-4 py-3 flex items-start gap-3", COLORS[insight.kind])}>
      <Icon className="size-4 mt-0.5 shrink-0" />
      <div>
        <div className="text-sm font-semibold">{insight.headline}</div>
        <div className="text-xs opacity-80 mt-0.5">{insight.detail}</div>
        {insight.action && (
          <div className="text-xs font-medium mt-1.5 underline underline-offset-2 opacity-90">
            → {insight.action}
          </div>
        )}
      </div>
    </div>
  );
}

export function InsightStrip({ insights, className }: { insights: Insight[]; className?: string }) {
  if (!insights.length) return null;
  return (
    <div className={cn("grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6", className)}>
      {insights.map((ins, i) => <InsightCard key={i} insight={ins} />)}
    </div>
  );
}
