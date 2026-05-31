import React from "react";
import { cn } from "@/lib/utils";

export function Skeleton({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={cn("rounded-lg bg-surface/60 animate-pulse", className)}
      style={style}
    />
  );
}

/** Full KPI card placeholder — matches KpiCard dimensions */
export function KpiSkeleton() {
  return (
    <div className="glass-card rounded-2xl p-5 space-y-3">
      <div className="flex justify-between items-start">
        <div className="space-y-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-8 w-28" />
        </div>
        <Skeleton className="size-10 rounded-xl" />
      </div>
      <Skeleton className="h-3 w-14" />
    </div>
  );
}

/** Bar-chart placeholder */
export function ChartSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("glass-card rounded-2xl p-5 space-y-3", className)}>
      <div className="space-y-1">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-48" />
      </div>
      <div className="flex items-end gap-2 h-40 pt-4">
        {[65, 45, 80, 55, 70, 40, 90, 60, 75, 50, 85, 45].map((h, i) => (
          <Skeleton key={i} className="flex-1 rounded-sm" style={{ height: `${h}%` }} />
        ))}
      </div>
    </div>
  );
}

/** Table row placeholder */
export function TableRowSkeleton({ cols = 5 }: { cols?: number }) {
  return (
    <tr className="border-b border-border/50">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="py-2.5 px-2">
          <Skeleton className={cn("h-3", i === 0 ? "w-20" : i === 1 ? "w-32" : "w-16")} />
        </td>
      ))}
    </tr>
  );
}

/** Page-level loading scaffold: 4 KPI cards + 2 charts */
export function PageSkeleton() {
  return (
    <div className="px-4 md:px-6 py-6 max-w-[1600px] mx-auto space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>
      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {[0, 1, 2, 3].map((i) => <KpiSkeleton key={i} />)}
      </div>
      {/* Two charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartSkeleton className="h-[320px]" />
        <ChartSkeleton className="h-[320px]" />
      </div>
      {/* Table */}
      <div className="glass-card rounded-2xl p-5 space-y-3">
        <Skeleton className="h-4 w-36" />
        <div className="space-y-0">
          {[0, 1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="border-b border-border/50 py-2.5 flex gap-4">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-3 w-12" />
              <Skeleton className="h-3 w-12" />
              <Skeleton className="h-3 w-20" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
