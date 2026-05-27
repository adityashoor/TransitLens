/**
 * useRealtimeVehicles — live TTC vehicle positions via Supabase Realtime.
 *
 * Supabase fires one postgres_changes event PER ROW (638 rows = 638 events).
 * We debounce the re-fetch so all 638 events coalesce into a single DB call.
 */
import { useEffect, useRef, useState } from "react";
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

async function fetchAllVehicles() {
  const { data, error } = await supabase.from("vehicle_positions").select("*");
  if (!error && data && data.length > 0) return data.map(dbRowToVehicle);
  return null;
}

export function useRealtimeVehicles() {
  const [vehicles, setVehicles] = useState<RealtimeVehicle[]>([]);
  const [connected, setConnected] = useState(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Initial load
    fetchAllVehicles().then((v) => {
      if (v) { setVehicles(v); setConnected(true); }
      else {
        setVehicles(
          generateVehicles().map((v, i) => ({
            ...v, id: `mock-${i}`, speedKmh: 0, updatedAt: new Date().toISOString(),
          }))
        );
      }
    });

    const channel = supabase
      .channel("transitlens-vehicles")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "vehicle_positions" },
        () => {
          // Debounce: 638 row events collapse into one fetch after 500ms silence
          if (debounceTimer.current) clearTimeout(debounceTimer.current);
          debounceTimer.current = setTimeout(() => {
            fetchAllVehicles().then((v) => {
              if (v) { setVehicles(v); setConnected(true); }
            });
          }, 500);
        }
      )
      .subscribe((status) => setConnected(status === "SUBSCRIBED"));

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      supabase.removeChannel(channel);
    };
  }, []);

  return { vehicles, connected };
}
