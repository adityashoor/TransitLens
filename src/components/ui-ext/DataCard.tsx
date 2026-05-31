import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface DataCardProps {
  title?: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  footer?: ReactNode;
  icon?: ReactNode;
  className?: string;
  bodyClassName?: string;
  interactive?: boolean;
  children?: ReactNode;
}

export function DataCard({
  title,
  subtitle,
  action,
  footer,
  icon,
  className,
  bodyClassName,
  interactive,
  children,
}: DataCardProps) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className={cn(
        "glass-card rounded-2xl p-5 flex flex-col gap-4",
        interactive && "transition-colors hover:bg-surface/60 focus-within:ring-2 focus-within:ring-ring/40",
        className,
      )}
    >
      {(title || action) && (
        <header className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            {icon && (
              <div className="size-9 rounded-xl bg-primary/15 border border-border flex items-center justify-center shrink-0">
                {icon}
              </div>
            )}
            <div className="min-w-0">
              {title && <div className="text-sm font-semibold leading-tight truncate">{title}</div>}
              {subtitle && <div className="text-xs text-muted-foreground mt-0.5">{subtitle}</div>}
            </div>
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </header>
      )}
      {children && <div className={cn("flex-1 min-h-0", bodyClassName)}>{children}</div>}
      {footer && <footer className="pt-2 border-t border-border text-xs text-muted-foreground">{footer}</footer>}
    </motion.section>
  );
}
