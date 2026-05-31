import { AlertCircle, RefreshCw } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

interface QueryErrorProps {
  queryKey: string[];
  message?: string;
}

/**
 * Inline error state for failed data queries.
 * Shows a user-friendly message with a retry button that re-fetches the query.
 */
export function QueryError({ queryKey, message }: QueryErrorProps) {
  const qc = useQueryClient();
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center text-muted-foreground">
      <AlertCircle className="size-8 text-destructive/70" />
      <div>
        <div className="text-sm font-medium text-foreground">Data temporarily unavailable</div>
        <div className="text-xs mt-1 max-w-xs">
          {message ?? "Could not load live data. Showing the last cached values, or retrying from the open data source."}
        </div>
      </div>
      <button
        onClick={() => qc.invalidateQueries({ queryKey })}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border border-border hover:bg-surface transition-colors"
      >
        <RefreshCw className="size-3.5" /> Retry
      </button>
    </div>
  );
}

/**
 * Full-page error fallback for critical load failures.
 */
export function PageError({ onRetry }: { onRetry?: () => void }) {
  return (
    <div className="px-4 md:px-6 py-16 max-w-[1600px] mx-auto flex flex-col items-center justify-center gap-4 text-center">
      <AlertCircle className="size-12 text-destructive/60" />
      <div>
        <h2 className="text-lg font-semibold">Could not load page data</h2>
        <p className="text-sm text-muted-foreground mt-1 max-w-sm">
          The live data source returned an error. The app will use cached or synthetic fallback data.
        </p>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90"
        >
          <RefreshCw className="size-4" /> Try again
        </button>
      )}
    </div>
  );
}
