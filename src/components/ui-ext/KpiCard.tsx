import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { cn } from "../../lib/utils";
import { fmtCompact } from "../../lib/format";
import type { LucideIcon } from "lucide-react";
import { ResponsiveContainer, AreaChart, Area } from "recharts";

interface KpiCardProps {
  label: string;
  value: number | string;
  delta?: number;
  hint?: string;
  icon?: LucideIcon;
  spark?: number[];
  format?: "compact" | "raw" | "pct";
  accent?: "primary" | "cyan" | "teal" | "warn" | "success";
}

function AnimatedNumber({ value, format }: { value: number; format?: KpiCardProps["format"] }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const dur = 900;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / dur);
      setN(value * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <>{format === "raw" ? Math.round(n) : fmtCompact(n)}</>;
}

const accentColors = {
  primary: "var(--electric)",
  cyan: "var(--cyan)",
  teal: "var(--teal)",
  warn: "var(--warn)",
  success: "var(--success)",
} as const;

export function KpiCard({ label, value, delta, hint, icon: Icon, spark, format = "compact", accent = "primary" }: KpiCardProps) {
  const color = accentColors[accent];
  const isUp = (delta ?? 0) >= 0;
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.4 }}
      className="glass-card rounded-2xl p-5 relative overflow-hidden group"
    >
      <div
        className="absolute -top-12 -right-12 size-40 rounded-full opacity-30 blur-3xl pointer-events-none"
        style={{ background: color }}
      />
      <div className="flex items-start justify-between gap-3 relative">
        <div className="space-y-1">
          <div className="text-xs uppercase tracking-wider text-muted-foreground font-medium">{label}</div>
          <div className="text-3xl font-semibold tracking-tight">
            {typeof value === "number" ? <AnimatedNumber value={value} format={format} /> : value}
          </div>
          {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
        </div>
        {Icon && (
          <div
            className="size-10 rounded-xl flex items-center justify-center shrink-0 border border-border"
            style={{ background: `color-mix(in oklab, ${color} 18%, transparent)` }}
          >
            <Icon className="size-[18px]" style={{ color }} />
          </div>
        )}
      </div>
      <div className="flex items-end justify-between mt-3 relative">
        {typeof delta === "number" && (
          <div
            className={cn(
              "text-xs font-medium px-2 py-0.5 rounded-md inline-flex items-center gap-1",
              isUp ? "text-success bg-success/10" : "text-destructive bg-destructive/10",
            )}
          >
            {isUp ? "▲" : "▼"} {Math.abs(delta).toFixed(1)}%
          </div>
        )}
        {spark && (
          <div className="h-10 w-24 -mr-2 -mb-2 ml-auto">
            <ResponsiveContainer>
              <AreaChart data={spark.map((v, i) => ({ i, v }))}>
                <defs>
                  <linearGradient id={`sp-${label}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity={0.6} />
                    <stop offset="100%" stopColor={color} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area dataKey="v" type="monotone" stroke={color} strokeWidth={1.5} fill={`url(#sp-${label})`} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </motion.div>
  );
}
