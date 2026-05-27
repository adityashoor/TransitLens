import type { Scenario } from "../store/ui";

export const SCENARIO_META: Record<Scenario, {
  label: string;
  emoji: string;
  description: string;
  ridershipMult: number;
  congestionDelta: number;
  delayMin: number;
  hotZones: string[];
}> = {
  baseline: {
    label: "Baseline",
    emoji: "•",
    description: "Typical day, no major events or weather impact.",
    ridershipMult: 1,
    congestionDelta: 0,
    delayMin: 0,
    hotZones: [],
  },
  raptors: {
    label: "Raptors game",
    emoji: "🏀",
    description: "19:00 tip-off at Scotiabank Arena. Surge on Line 1 + 504 King.",
    ridershipMult: 1.18,
    congestionDelta: 14,
    delayMin: 4,
    hotZones: ["Union", "Osgoode", "King"],
  },
  snowstorm: {
    label: "Snowstorm",
    emoji: "❄️",
    description: "Heavy snowfall warning, ~12 cm. Bus & streetcar slowdowns expected.",
    ridershipMult: 0.86,
    congestionDelta: 22,
    delayMin: 9,
    hotZones: ["Etobicoke North", "Scarborough", "North York"],
  },
  strike: {
    label: "TTC partial strike",
    emoji: "⚠️",
    description: "Bus operators job action. ~35% of bus routes reduced.",
    ridershipMult: 0.62,
    congestionDelta: 31,
    delayMin: 18,
    hotZones: ["Mount Dennis", "Malvern", "Rexdale"],
  },
  heatwave: {
    label: "Heatwave",
    emoji: "🌡️",
    description: "Humidex 41 °C. Subway A/C demand peaks; surface routes lighter.",
    ridershipMult: 1.05,
    congestionDelta: 6,
    delayMin: 2,
    hotZones: ["Downtown", "Yonge corridor"],
  },
};

export interface FeatureAttribution {
  feature: string;
  weight: number; // -1..1
  hint: string;
}

export function attributionsFor(scenario: Scenario): FeatureAttribution[] {
  const base: FeatureAttribution[] = [
    { feature: "Day of week", weight: 0.32, hint: "Saturday — leisure pattern dominates." },
    { feature: "Hour of day", weight: 0.28, hint: "Approaching evening peak window." },
    { feature: "Weather", weight: 0.04, hint: "Light rain, 14 °C — minor impact." },
    { feature: "Events nearby", weight: 0.06, hint: "No major events flagged." },
    { feature: "Historic baseline", weight: 0.18, hint: "L52W average for this slot." },
    { feature: "Live disruptions", weight: -0.08, hint: "Two minor delays drag forecast down." },
  ];
  switch (scenario) {
    case "raptors":
      return [
        { feature: "Events nearby", weight: 0.42, hint: "Raptors tip-off at 19:00, ~19k attendees." },
        ...base.filter((b) => b.feature !== "Events nearby").map((b) =>
          b.feature === "Hour of day" ? { ...b, weight: 0.36 } : b,
        ),
      ];
    case "snowstorm":
      return [
        { feature: "Weather", weight: -0.38, hint: "Snowfall 12 cm + wind chill suppress demand." },
        { feature: "Live disruptions", weight: -0.22, hint: "Bus delays cascading across grid." },
        ...base.filter((b) => b.feature !== "Weather" && b.feature !== "Live disruptions"),
      ];
    case "strike":
      return [
        { feature: "Service availability", weight: -0.55, hint: "35% of bus routes operating reduced service." },
        { feature: "Mode substitution", weight: 0.18, hint: "Riders shifting to subway + streetcar." },
        ...base.slice(0, 3),
      ];
    case "heatwave":
      return [
        { feature: "Weather", weight: 0.12, hint: "Underground stays cool — subway slightly up." },
        ...base.filter((b) => b.feature !== "Weather"),
      ];
    default:
      return base;
  }
}

export const MODEL_CARD = {
  name: "TransitLens Forecaster",
  version: "v3.2",
  trainedOn: "2026-04-28",
  windowDays: 365,
  algorithm: "Gradient-boosted decision trees + temporal Fourier features",
  mae: "3.4%",
  mape: "5.1%",
  coverage: "All TTC subway, streetcar, and 142 bus routes",
  refreshedEvery: "5 minutes",
  features: 47,
  notes: "Trained on synthetic data for the demo; production version will consume Open Toronto + WeatherCAN feeds.",
};
