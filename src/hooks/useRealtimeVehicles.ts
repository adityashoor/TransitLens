/**
 * useRealtimeVehicles — live TTC vehicle positions.
 *
 * Polls Supabase every 15s (vehicles refresh from edge function every ~30s).
 * Supports both the deployed `vehicle_positions` table and the documented
 * `tl_vehicles` fallback schema.
 * Avoids postgres_changes subscriptions which fire 638× per ingest and
 * crash the browser with ERR_INSUFFICIENT_RESOURCES.
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
  const secsSinceReport = (row.secs_since_report as number | undefined) ?? 0;
  const explicitDelay = row.delay as number | undefined;
  return {
    id: `v${i}-${(row.vehicle_id as string | undefined) ?? (row.id as string | undefined) ?? i}`,
    routeId: (row.route_tag as string | undefined) ?? (row.route_id as string | undefined) ?? "unknown",
    pos: [row.lat as number, row.lon as number],
    bearing: (row.heading as number) ?? 0,
    delay: explicitDelay ?? (secsSinceReport > 60 ? 2 : 0),
    occupancy: (row.occupancy as number | undefined) ?? Math.round(30 + Math.random() * 60),
    speedKmh: (row.speed_kmh as number) ?? 0,
    updatedAt: (row.updated_at as string) ?? "",
  };
}

const POLL_INTERVAL = 15_000;

export function useRealtimeVehicles() {
  const [vehicles, setVehicles] = useState<RealtimeVehicle[]>([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const primary = await supabase.from("vehicle_positions").select("*");
        const fallback = primary.error || !primary.data?.length
          ? await supabase.from("tl_vehicles").select("*")
          : primary;
        const { data, error } = fallback;
        if (cancelled) return;
        if (!error && data && data.length > 0) {
          setVehicles(data.map(dbRowToVehicle));
          setConnected(true);
        } else if (!connected) {
          setVehicles(
            generateVehicles().map((v, i) => ({
              ...v, id: `mock-${i}`, speedKmh: 0, updatedAt: new Date().toISOString(),
            }))
          );
        }
      } catch {
        // network error — keep showing last data
      }
    }

    load();
    const interval = setInterval(load, POLL_INTERVAL);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { vehicles, connected };
}
