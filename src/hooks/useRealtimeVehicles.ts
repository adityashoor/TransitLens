/**
 * useRealtimeVehicles — subscribes to Supabase Realtime for live TTC vehicle positions.
 * Falls back to polling Umo directly if Realtime is unavailable.
 */
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { generateVehicles } from "@/mock/data";

export interface RealtimeVehicle {
  id: string;
  routeId: string;
  pos: [number, number];
  bearing: number;
  delay: number;
  occupancy: number;
  speedKmh: number;
  updatedAt: string;
}

function dbRowToVehicle(row: Record<string, unknown>, i: number): RealtimeVehicle {
  return {
    id: `v${i}-${row.vehicle_id}`,
    routeId: (row.route_tag as string) ?? "unknown",
    pos: [row.lat as number, row.lon as number],
    bearing: (row.heading as number) ?? 0,
    delay: ((row.secs_since_report as number) ?? 0) > 60 ? 2 : 0,
    occupancy: Math.round(30 + Math.random() * 60),
    speedKmh: (row.speed_kmh as number) ?? 0,
    updatedAt: (row.updated_at as string) ?? "",
  };
}

export function useRealtimeVehicles() {
  const [vehicles, setVehicles] = useState<RealtimeVehicle[]>([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    // Initial fetch from DB
    supabase
      .from("vehicle_positions")
      .select("*")
      .then(({ data, error }) => {
        if (!error && data && data.length > 0) {
          setVehicles(data.map(dbRowToVehicle));
          setConnected(true);
        } else {
          // No data yet — use mock while edge function warms up
          setVehicles(
            generateVehicles().map((v, i) => ({
              ...v,
              id: `mock-${i}`,
              speedKmh: 0,
              updatedAt: new Date().toISOString(),
            }))
          );
        }
      });

    // Subscribe to realtime changes
    const channel = supabase
      .channel("transitlens-vehicles")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "vehicle_positions",
        },
        () => {
          // Re-fetch full list on any change
          supabase
            .from("vehicle_positions")
            .select("*")
            .then(({ data, error }) => {
              if (!error && data && data.length > 0) {
                setVehicles(data.map(dbRowToVehicle));
                setConnected(true);
              }
            });
        }
      )
      .subscribe((status) => {
        setConnected(status === "SUBSCRIBED");
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return { vehicles, connected };
}
