import { useMemo } from "react";
import { useVehicles } from "@/mock/api";

export interface BunchPair {
  routeId: string;
  v1Id: string;
  v2Id: string;
  pos: [number, number]; // midpoint between the two vehicles
  distanceM: number;
}

/** Haversine distance in metres between two lat/lon points */
function haversineM(
  [lat1, lon1]: [number, number],
  [lat2, lon2]: [number, number],
): number {
  const R = 6_371_000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const BUNCH_THRESHOLD_M = 200; // flag vehicles within 200 m on the same route

/**
 * Returns pairs of vehicles on the same route that are within BUNCH_THRESHOLD_M
 * of each other — a reliable real-time signal for bus bunching.
 */
export function useBunching(): BunchPair[] {
  const { vehicles = [] } = useVehicles();

  return useMemo(() => {
    const pairs: BunchPair[] = [];
    // Group by routeId
    const byRoute = new Map<string, typeof vehicles>();
    for (const v of vehicles) {
      if (!v.routeId || v.routeId === "unknown") continue;
      if (!byRoute.has(v.routeId)) byRoute.set(v.routeId, []);
      byRoute.get(v.routeId)!.push(v);
    }

    for (const [routeId, vs] of byRoute) {
      if (vs.length < 2) continue;
      for (let i = 0; i < vs.length - 1; i++) {
        for (let j = i + 1; j < vs.length; j++) {
          const d = haversineM(vs[i].pos, vs[j].pos);
          if (d <= BUNCH_THRESHOLD_M) {
            pairs.push({
              routeId,
              v1Id: vs[i].id,
              v2Id: vs[j].id,
              // midpoint
              pos: [
                (vs[i].pos[0] + vs[j].pos[0]) / 2,
                (vs[i].pos[1] + vs[j].pos[1]) / 2,
              ],
              distanceM: Math.round(d),
            });
          }
        }
      }
    }
    return pairs;
  }, [vehicles]);
}
