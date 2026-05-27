/**
 * useRealtimeSync — subscribes to all TransitLens Supabase tables via Realtime.
 * On any row change, immediately invalidates the matching TanStack Query keys
 * so every page re-fetches fresh data without waiting for the poll interval.
 *
 * Debounced per key (300ms) to coalesce rapid bursts into one refetch.
 * Mount once inside QueryClientProvider at the app root.
 */
import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

// Maps Supabase table → query keys to invalidate on change
const TABLE_TO_QUERY: Record<string, string[]> = {
  tl_kpi:              ["kpis"],
  tl_ridership_hourly: ["hourly", "daily"],
  tl_equity:           ["hoods", "heatmap"],
  tl_routes:           ["network", "routeCompare"],
  tl_model_metrics:    ["aiCards"],
};

export function useRealtimeSync() {
  const queryClient = useQueryClient();
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    function invalidate(keys: string[]) {
      keys.forEach((k) => {
        clearTimeout(timers.current[k]);
        timers.current[k] = setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: [k] });
        }, 300);
      });
    }

    const channels = Object.entries(TABLE_TO_QUERY).map(([table, keys]) =>
      supabase
        .channel(`rt-${table}`)
        .on("postgres_changes", { event: "*", schema: "public", table }, () =>
          invalidate(keys)
        )
        .subscribe()
    );

    return () => {
      Object.values(timers.current).forEach(clearTimeout);
      channels.forEach((ch) => supabase.removeChannel(ch));
    };
  }, [queryClient]);
}
