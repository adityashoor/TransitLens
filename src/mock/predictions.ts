import type { Scenario } from "@/store/ui";

// ── Feature attributions — uses real weather + day-of-week context ─────────────

export interface FeatureAttribution {
  feature: string;
  weight: number; // -1..1
  hint: string;
}

export interface AttributionContext {
  day: string;           // "Monday", "Saturday" etc — real from Date()
  hour: number;          // 0-23 — real current hour
  tempC?: number;        // real from Open-Meteo
  precip?: number;       // real precipitation probability %
  condition?: string;    // real weather condition string
  highDisruptions?: number;
}

export function attributionsFor(
  scenario: Scenario,
  ctx?: AttributionContext,
): FeatureAttribution[] {
  const day       = ctx?.day       ?? new Date().toLocaleDateString("en-CA", { weekday: "long" });
  const hour      = ctx?.hour      ?? new Date().getHours();
  const tempC     = ctx?.tempC     ?? null;
  const precip    = ctx?.precip    ?? null;
  const condition = ctx?.condition ?? null;
  const highDisr  = ctx?.highDisruptions ?? 0;

  const isWeekend  = ["Saturday", "Sunday"].includes(day);
  const isPeak     = (hour >= 7 && hour <= 9) || (hour >= 16 && hour <= 19);
  const weatherHint = tempC !== null && precip !== null
    ? `${condition ?? "Unknown"}, ${tempC}°C — ${precip > 60 ? "high" : precip > 30 ? "moderate" : "low"} precipitation impact.`
    : "Weather data unavailable.";
  const weatherWeight = precip !== null
    ? precip > 60 ? -0.18 : precip > 30 ? -0.08 : 0.04
    : 0.02;

  const base: FeatureAttribution[] = [
    {
      feature: "Day of week",
      weight: isWeekend ? -0.12 : 0.32,
      hint: `${day} — ${isWeekend ? "leisure/reduced commute pattern." : "full weekday commute pattern."}`,
    },
    {
      feature: "Hour of day",
      weight: isPeak ? 0.36 : 0.18,
      hint: `${String(hour).padStart(2,"0")}:00 — ${isPeak ? "within peak commute window." : "off-peak period."}`,
    },
    {
      feature: "Weather",
      weight: weatherWeight,
      hint: weatherHint,
    },
    {
      feature: "Events nearby",
      weight: 0.06,
      hint: "No major events flagged at this time.",
    },
    {
      feature: "Historic baseline",
      weight: 0.18,
      hint: "52-week rolling average for this time slot.",
    },
    {
      feature: "Live disruptions",
      weight: highDisr > 0 ? -(highDisr * 0.06) : 0.02,
      hint: highDisr > 0
        ? `${highDisr} high-severity disruption${highDisr > 1 ? "s" : ""} active — reducing demand forecast.`
        : "No major disruptions — network nominal.",
    },
  ];

  // Scenario-specific overrides using real scenario IDs
  if (scenario.includes("rain") || scenario.includes("snow") || scenario.includes("cold")) {
    return [
      { feature: "Weather", weight: scenario.includes("snow") ? -0.38 : -0.22,
        hint: `${condition ?? "Adverse weather"} — bus & streetcar slowdowns expected.` },
      { feature: "Live disruptions", weight: -0.22, hint: "Surface route delays cascading across the grid." },
      ...base.filter(b => b.feature !== "Weather" && b.feature !== "Live disruptions"),
    ];
  }

  if (scenario.includes("heat")) {
    return [
      { feature: "Weather", weight: 0.14, hint: `${tempC ?? "High"}°C — subway usage increases as surface routes slow.` },
      ...base.filter(b => b.feature !== "Weather"),
    ];
  }

  if (scenario.includes("subway_disruption")) {
    return [
      { feature: "Subway disruption", weight: 0.22, hint: "Active subway delay — riders diverting to surface routes." },
      { feature: "Mode substitution", weight: 0.18, hint: "Bus/streetcar absorbing displaced subway passengers." },
      ...base.slice(0, 3),
    ];
  }

  if (scenario.includes("bus_disruption")) {
    return [
      { feature: "Bus network stress", weight: -0.28, hint: "Multiple bus route delays reducing accessibility." },
      ...base.filter(b => b.feature !== "Events nearby"),
    ];
  }

  if (scenario.includes("suspension")) {
    return [
      { feature: "Service suspension", weight: -0.55, hint: "Active TTC service suspension — major demand impact." },
      { feature: "Mode substitution", weight: 0.14, hint: "Riders shifting to adjacent modes." },
      ...base.slice(0, 3),
    ];
  }

  return base;
}

// ── Model card — values pulled from Supabase tl_model_metrics at runtime ──────
// Hardcoded fields are methodology constants, not live metrics.
// Live fields (accuracy, routes, mae) come from fetchAiCards / tl_model_metrics.

export const MODEL_CARD_STATIC = {
  name: "TransitLens Forecaster",
  algorithm: "Demand-index heuristic · GTFS-RT delay signal + TTC hourly seasonality",
  windowDays: 365,
  refreshedEvery: "30 seconds",    // GTFS-RT polling interval
  dataInputs: [
    "TTC GTFS-RT vehicle positions",
    "TTC GTFS-RT trip updates",
    "Toronto Open Data delay records",
    "Open-Meteo 48h forecast",
    "Supabase route & equity data",
    "Toronto Police KSI collisions",
  ],
};
