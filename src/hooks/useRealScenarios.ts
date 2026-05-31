/**
 * useRealScenarios — detects real TTC scenarios from live data sources.
 *
 * Sources:
 *  - GTFS-RT service alerts (bustime.ttc.ca/gtfsrt/alerts)
 *  - useDisruptions() — Umo/NextBus real TTC service disruptions
 *  - useWeather() — Open-Meteo real Toronto forecast
 *
 * Returns an array of ScenarioItem ordered: Baseline first, then
 * live-detected events sorted by severity, then any static fallbacks.
 */

import { useMemo } from "react";
import { useDisruptions, useWeather } from "@/mock/api";
import { useQuery } from "@tanstack/react-query";

export interface ScenarioItem {
  id: string;
  label: string;
  emoji: string;
  description: string;
  ridershipMult: number;
  congestionDelta: number;
  delayMin: number;
  hotZones: string[];
  isLive: boolean;      // true = detected from real data right now
  severity: "low" | "medium" | "high";
}

// ── GTFS-RT alerts parser ─────────────────────────────────────────────────────

async function fetchGtfsAlerts(): Promise<string[]> {
  try {
    const res = await fetch("/api/gtfsrt/alerts?debug", {
      signal: AbortSignal.timeout(6_000),
    });
    if (!res.ok) return [];
    const text = await res.text();
    // Extract header_text and description_text from protobuf debug output
    const texts: string[] = [];
    for (const m of text.matchAll(/translation\s*\{[^}]*text:\s*"([^"]+)"/g)) {
      const t = m[1].trim();
      if (t.length > 10) texts.push(t);
    }
    return [...new Set(texts)].slice(0, 10);
  } catch {
    return [];
  }
}

function useGtfsAlerts() {
  return useQuery({
    queryKey: ["gtfsAlerts"],
    queryFn: fetchGtfsAlerts,
    staleTime: 60_000,
    refetchInterval: 120_000,
  });
}

// ── Scenario detection logic ─────────────────────────────────────────────────

const BASELINE: ScenarioItem = {
  id: "baseline",
  label: "Baseline",
  emoji: "•",
  description: "Typical day, no major events or weather impact.",
  ridershipMult: 1,
  congestionDelta: 0,
  delayMin: 0,
  hotZones: [],
  isLive: false,
  severity: "low",
};

export function useRealScenarios(): ScenarioItem[] {
  const { data: disruptions = [] } = useDisruptions();
  const { data: weather = [] } = useWeather();
  const { data: alerts = [] } = useGtfsAlerts();

  return useMemo(() => {
    const detected: ScenarioItem[] = [];
    const currentWeather = weather[0];
    const nextHours = weather.slice(0, 6);

    // ── Weather-based scenarios ─────────────────────────────────────────────
    const maxPrecip = Math.max(...nextHours.map((w) => w.precip ?? 0), 0);
    const maxTemp   = Math.max(...nextHours.map((w) => w.temp ?? 0), 0);
    const minTemp   = Math.min(...nextHours.map((w) => w.temp ?? 99), 99);
    const condition = (currentWeather?.condition ?? "").toLowerCase();

    if (condition.includes("snow") || condition.includes("blizzard")) {
      detected.push({
        id: "live_snow",
        label: `Snowfall`,
        emoji: "❄️",
        description: `${currentWeather?.condition} forecast. Bus & streetcar slowdowns expected across the network.`,
        ridershipMult: 0.84,
        congestionDelta: 24,
        delayMin: 10,
        hotZones: ["Etobicoke North", "Scarborough", "North York"],
        isLive: true,
        severity: "high",
      });
    } else if (maxPrecip > 60) {
      detected.push({
        id: "live_rain",
        label: `Heavy Rain`,
        emoji: "🌧️",
        description: `${maxPrecip}% precipitation probability in next 6 hours. Slippery conditions on surface routes.`,
        ridershipMult: 0.92,
        congestionDelta: 14,
        delayMin: 5,
        hotZones: ["Queensway", "Lakeshore", "Dundas"],
        isLive: true,
        severity: "medium",
      });
    } else if (maxPrecip > 30) {
      detected.push({
        id: "live_light_rain",
        label: `Light Rain`,
        emoji: "🌦️",
        description: `${maxPrecip}% rain probability. Minor delays on surface routes.`,
        ridershipMult: 0.97,
        congestionDelta: 6,
        delayMin: 2,
        hotZones: [],
        isLive: true,
        severity: "low",
      });
    }

    if (maxTemp >= 32) {
      detected.push({
        id: "live_heat",
        label: `Heat Advisory`,
        emoji: "🌡️",
        description: `${maxTemp}°C forecast. Subway A/C demand peaks; crowding on Line 1 expected.`,
        ridershipMult: 1.06,
        congestionDelta: 8,
        delayMin: 2,
        hotZones: ["Yonge-University", "Bloor-Danforth", "Downtown"],
        isLive: true,
        severity: "medium",
      });
    } else if (minTemp <= -15) {
      detected.push({
        id: "live_cold",
        label: `Extreme Cold`,
        emoji: "🥶",
        description: `${minTemp}°C windchill. Mechanical delays on older bus fleet probable.`,
        ridershipMult: 0.88,
        congestionDelta: 18,
        delayMin: 7,
        hotZones: ["North York", "Scarborough", "Etobicoke"],
        isLive: true,
        severity: "high",
      });
    }

    // ── Disruption-based scenarios ──────────────────────────────────────────
    const highDisr    = disruptions.filter((d: { severity?: string }) => d.severity === "high");
    const subwayDisr  = disruptions.filter((d: { type?: string }) => d.type === "subway");
    const busDisr     = disruptions.filter((d: { type?: string }) => d.type === "bus");

    if (subwayDisr.length >= 2) {
      const lines = [...new Set(subwayDisr.map((d: { routeId?: string }) => `Line ${d.routeId}`))].slice(0, 2).join(", ");
      detected.push({
        id: "live_subway_disruption",
        label: "Subway Disruption",
        emoji: "🚇",
        description: `Active disruptions on ${lines}. Expect crowding at connecting surface stops.`,
        ridershipMult: 1.08,
        congestionDelta: 20,
        delayMin: 8,
        hotZones: subwayDisr.slice(0, 3).map((d: { routeId?: string }) => `Line ${d.routeId}`),
        isLive: true,
        severity: "high",
      });
    }

    if (busDisr.length >= 5) {
      detected.push({
        id: "live_bus_disruption",
        label: `Bus Delays (${busDisr.length})`,
        emoji: "🚌",
        description: `${busDisr.length} active bus route disruptions across the network. Check alternate routes.`,
        ridershipMult: 0.94,
        congestionDelta: 12 + Math.min(busDisr.length, 10),
        delayMin: Math.round(busDisr.length * 0.8),
        hotZones: [...new Set(busDisr.slice(0, 3).map((d: { routeId?: string }) => `Route ${d.routeId}`))],
        isLive: true,
        severity: highDisr.length > 3 ? "high" : "medium",
      });
    }

    // ── GTFS-RT alert-based scenarios ───────────────────────────────────────
    if (alerts.length > 0) {
      // Look for keyword patterns in real alert text
      const alertText = alerts.join(" ").toLowerCase();
      if (alertText.includes("suspend") || alertText.includes("shuttle") || alertText.includes("no service")) {
        detected.push({
          id: "live_suspension",
          label: "Service Suspended",
          emoji: "⛔",
          description: alerts[0].slice(0, 100),
          ridershipMult: 0.70,
          congestionDelta: 30,
          delayMin: 20,
          hotZones: [],
          isLive: true,
          severity: "high",
        });
      } else if (alertText.includes("delay") || alertText.includes("divert") || alertText.includes("detour")) {
        detected.push({
          id: "live_alert",
          label: "TTC Alert",
          emoji: "⚠️",
          description: alerts[0].slice(0, 100),
          ridershipMult: 0.95,
          congestionDelta: 10,
          delayMin: 5,
          hotZones: [],
          isLive: true,
          severity: "medium",
        });
      }
    }

    // ── Final list: Baseline always first, then live events by severity ──────
    const sevOrder = { high: 0, medium: 1, low: 2 };
    const sorted = detected.sort((a, b) => sevOrder[a.severity] - sevOrder[b.severity]);

    return [BASELINE, ...sorted];
  }, [disruptions, weather, alerts]);
}
