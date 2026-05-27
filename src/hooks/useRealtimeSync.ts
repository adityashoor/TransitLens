/**
 * useRealtimeSync — subscribes to TransitLens Supabase tables via Realtime
 * and invalidates the matching TanStack Query cache key on change.
 * Debounced per-key to avoid rapid-fire refetches.
 * Mount once at the app root.
 */
import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

// table → query keys to invalidate
const TABLE_TO_QUERY: Record<string, string[]> = {
  tl_kpi:              ["kpis"],
  tl_ridership_hourly: ["hourly"],
  tl_equity:           ["hoods"],
  tl_routes:           ["network"],
  tl_model_metrics:    ["aiCards"],
  // vehicle_positions handled by useRealtimeVehicles — skip here
};

export function useRealtimeSync() {
  const queryClient = useQueryClient();
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    // Debounced invalidate — coalesces rapid bursts into one refetch
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
