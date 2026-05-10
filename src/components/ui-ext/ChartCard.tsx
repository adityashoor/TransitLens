import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface ChartCardProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}
export function ChartCard({ title, subtitle, action, className, children }: ChartCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={cn("glass-card rounded-2xl p-5 flex flex-col", className)}
    >
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <div className="text-sm font-semibold">{title}</div>
          {subtitle && <div className="text-xs text-muted-foreground mt-0.5">{subtitle}</div>}
        </div>
        {action}
      </div>
      <div className="flex-1 min-h-0">{children}</div>
    </motion.div>
  );
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function StatusPill({ status }: { status: "normal" | "delayed" | "disrupted" }) {
  const map = {
    normal: { label: "On time", color: "bg-success/15 text-success" },
    delayed: { label: "Delayed", color: "bg-warn/15 text-warn" },
    disrupted: { label: "Disrupted", color: "bg-destructive/15 text-destructive" },
  } as const;
  const s = map[status];
  return <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded-full", s.color)}>{s.label}</span>;
}
