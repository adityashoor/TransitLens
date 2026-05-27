/**
 * useRealtimeSync — subscribes to all TransitLens Supabase tables via
 * Realtime and invalidates the matching TanStack Query cache key on any change.
 * Mount once at the app root — all pages auto-update without polling.
 */
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

const TABLE_TO_QUERY: Record<string, string[]> = {
  tl_kpi:              ["kpis"],
  tl_ridership_hourly: ["hourly"],
  tl_equity:           ["hoods"],
  tl_routes:           ["network"],
  tl_model_metrics:    ["aiCards"],
  vehicle_positions:   ["kpis"],   // vehicle count rolls into KPIs
};

export function useRealtimeSync() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channels = Object.entries(TABLE_TO_QUERY).map(([table, keys]) =>
      supabase
        .channel(`rt-${table}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table },
          () => {
            keys.forEach((k) => queryClient.invalidateQueries({ queryKey: [k] }));
          }
        )
        .subscribe()
    );

    return () => {
      channels.forEach((ch) => supabase.removeChannel(ch));
    };
  }, [queryClient]);
}
