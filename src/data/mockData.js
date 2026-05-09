// ─── KPI Dashboard ───────────────────────────────────────────────────────────
export const kpiData = {
  totalRoutes: 154,
  avgEquityScore: 62.4,
  disruptionIndex: 3.2,
  demandForecastAccuracy: 87.5,
  totalStops: 2_382,
  dailyRidership: 1_240_000,
};

// ─── Equity Scoring ──────────────────────────────────────────────────────────
export const equityNeighborhoods = [
  { id: 1, name: "Scarborough Village",   lat: 43.7434, lng: -79.2394, equityScore: 38, income: 42000, seniorPct: 18, disabilityPct: 12, stopDensity: 1.2 },
  { id: 2, name: "Jane & Finch",          lat: 43.7615, lng: -79.5116, equityScore: 31, income: 38000, seniorPct: 14, disabilityPct: 15, stopDensity: 0.9 },
  { id: 3, name: "Rexdale",               lat: 43.7285, lng: -79.5887, equityScore: 35, income: 40000, seniorPct: 16, disabilityPct: 13, stopDensity: 1.0 },
  { id: 4, name: "Malvern",               lat: 43.8018, lng: -79.2197, equityScore: 33, income: 37000, seniorPct: 20, disabilityPct: 14, stopDensity: 0.8 },
  { id: 5, name: "Thorncliffe Park",      lat: 43.7057, lng: -79.3474, equityScore: 40, income: 44000, seniorPct: 11, disabilityPct: 10, stopDensity: 1.4 },
  { id: 6, name: "Downtown Core",         lat: 43.6532, lng: -79.3832, equityScore: 89, income: 95000, seniorPct:  8, disabilityPct:  6, stopDensity: 9.2 },
  { id: 7, name: "Midtown (Yonge/Eg)",   lat: 43.7055, lng: -79.3977, equityScore: 82, income: 88000, seniorPct: 10, disabilityPct:  7, stopDensity: 7.8 },
  { id: 8, name: "North York Centre",     lat: 43.7615, lng: -79.4111, equityScore: 71, income: 72000, seniorPct: 13, disabilityPct:  9, stopDensity: 5.6 },
  { id: 9, name: "Etobicoke Centre",      lat: 43.6469, lng: -79.5497, equityScore: 65, income: 68000, seniorPct: 15, disabilityPct:  8, stopDensity: 4.1 },
  { id:10, name: "East York",             lat: 43.6940, lng: -79.3270, equityScore: 74, income: 74000, seniorPct: 12, disabilityPct:  8, stopDensity: 5.9 },
  { id:11, name: "Parkdale",              lat: 43.6414, lng: -79.4390, equityScore: 55, income: 52000, seniorPct: 17, disabilityPct: 11, stopDensity: 3.8 },
  { id:12, name: "Weston",               lat: 43.7014, lng: -79.5181, equityScore: 44, income: 46000, seniorPct: 19, disabilityPct: 13, stopDensity: 2.1 },
];

export const equityRoutes = [
  { id: "54", name: "Lawrence East", score: 42, color: "#ef4444" },
  { id: "36", name: "Finch West",    score: 38, color: "#dc2626" },
  { id: "60", name: "Steeles West",  score: 46, color: "#f97316" },
  { id: "1",  name: "Yonge-U/S",     score: 91, color: "#22c55e" },
  { id: "2",  name: "Bloor-Danforth",score: 88, color: "#16a34a" },
  { id: "501",name: "Queen",         score: 67, color: "#eab308" },
  { id: "504",name: "King",          score: 72, color: "#84cc16" },
];

// ─── Ridership Demand ─────────────────────────────────────────────────────────
const hours = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, "0")}:00`);

function ridershipCurve(h) {
  // morning peak ~8, evening peak ~17
  return Math.round(
    800 +
    3200 * Math.exp(-0.5 * ((h - 8) / 1.5) ** 2) +
    2800 * Math.exp(-0.5 * ((h - 17) / 2) ** 2) +
    (Math.random() - 0.5) * 300
  );
}

export const ridershipTimeSeries = hours.map((hour, i) => ({
  hour,
  actual:    ridershipCurve(i),
  predicted: ridershipCurve(i) + Math.round((Math.random() - 0.5) * 250),
}));

export const stationHeatmap = [
  { station: "Union",         mon: 9800, tue: 9500, wed: 9700, thu: 9600, fri: 10200, sat: 6800, sun: 5200 },
  { station: "Bloor-Yonge",  mon: 8700, tue: 8500, wed: 8600, thu: 8400, fri: 9000,  sat: 7200, sun: 5800 },
  { station: "Spadina",      mon: 6200, tue: 6100, wed: 6000, thu: 6300, fri: 6800,  sat: 5600, sun: 4400 },
  { station: "Sheppard-Y",   mon: 5400, tue: 5200, wed: 5300, thu: 5100, fri: 5700,  sat: 3800, sun: 3000 },
  { station: "Finch",        mon: 4800, tue: 4600, wed: 4700, thu: 4900, fri: 5100,  sat: 3200, sun: 2600 },
  { station: "Kennedy",      mon: 4200, tue: 4000, wed: 4100, thu: 4300, fri: 4600,  sat: 2900, sun: 2200 },
  { station: "Kipling",      mon: 3900, tue: 3800, wed: 3700, thu: 3900, fri: 4200,  sat: 2700, sun: 2100 },
];

export const demandByRoute = [
  { route: "Line 1 (Yonge-U/S)",  demand: 182000, capacity: 200000 },
  { route: "Line 2 (B-D)",        demand: 165000, capacity: 190000 },
  { route: "Line 4 (Sheppard)",   demand: 38000,  capacity: 80000  },
  { route: "501 Queen",           demand: 52000,  capacity: 65000  },
  { route: "504 King",            demand: 47000,  capacity: 60000  },
  { route: "36 Finch West",       demand: 28000,  capacity: 40000  },
  { route: "54 Lawrence E",       demand: 22000,  capacity: 38000  },
];

// ─── Disruption Simulation ────────────────────────────────────────────────────
export const transitNetwork = {
  stations: [
    { id: "bloor-yonge",  name: "Bloor-Yonge",   lat: 43.6709, lng: -79.3857, lines: ["Line 1","Line 2"] },
    { id: "spadina",      name: "Spadina",        lat: 43.6677, lng: -79.4037, lines: ["Line 1","Line 2"] },
    { id: "union",        name: "Union",          lat: 43.6452, lng: -79.3806, lines: ["Line 1"] },
    { id: "king",         name: "King",           lat: 43.6488, lng: -79.3813, lines: ["Line 1"] },
    { id: "queen",        name: "Queen",          lat: 43.6524, lng: -79.3810, lines: ["Line 1"] },
    { id: "college",      name: "College",        lat: 43.6598, lng: -79.3871, lines: ["Line 1"] },
    { id: "wellesley",    name: "Wellesley",      lat: 43.6653, lng: -79.3851, lines: ["Line 1"] },
    { id: "bay",          name: "Bay",            lat: 43.6705, lng: -79.3906, lines: ["Line 2"] },
    { id: "museum",       name: "Museum",         lat: 43.6677, lng: -79.3948, lines: ["Line 1"] },
    { id: "st-george",    name: "St. George",     lat: 43.6682, lng: -79.3997, lines: ["Line 1","Line 2"] },
    { id: "osgoode",      name: "Osgoode",        lat: 43.6506, lng: -79.3874, lines: ["Line 1"] },
    { id: "st-patrick",   name: "St. Patrick",    lat: 43.6540, lng: -79.3878, lines: ["Line 1"] },
    { id: "dundas",       name: "Dundas",         lat: 43.6559, lng: -79.3813, lines: ["Line 1"] },
  ],
  routes: [
    { id: "L1-south", name: "Line 1 Southbound", stations: ["bloor-yonge","wellesley","college","dundas","queen","king","union"], color: "#facc15" },
    { id: "L1-north", name: "Line 1 Northbound", stations: ["union","king","queen","dundas","college","wellesley","bloor-yonge"], color: "#facc15" },
    { id: "L2-east",  name: "Line 2 Eastbound",  stations: ["spadina","st-george","bay","bloor-yonge"], color: "#60a5fa" },
    { id: "501",      name: "501 Queen Streetcar",stations: [], color: "#f97316" },
    { id: "504",      name: "504 King Streetcar", stations: [], color: "#a78bfa" },
  ],
};

export const disruptionScenarios = {
  "bloor-yonge": {
    affectedRoutes: ["Line 1 Southbound", "Line 2 Eastbound"],
    alternatives: [
      { rank: 1, route: "506 Carlton + walk",    eta: "+8 min",  reliability: "High"   },
      { rank: 2, route: "Bus bridge via Bay St", eta: "+12 min", reliability: "Medium" },
      { rank: 3, route: "Line 2 to Spadina + L1",eta: "+15 min", reliability: "High"   },
    ],
    recoveryTime: "22 min",
    impactedRiders: 4200,
  },
  "union": {
    affectedRoutes: ["Line 1 Southbound", "Line 1 Northbound"],
    alternatives: [
      { rank: 1, route: "509/510 Harbourfront",  eta: "+10 min", reliability: "High"   },
      { rank: 2, route: "GO Transit (King St)",  eta: "+5 min",  reliability: "High"   },
      { rank: 3, route: "504 King to Bay",       eta: "+14 min", reliability: "Medium" },
    ],
    recoveryTime: "18 min",
    impactedRiders: 6800,
  },
  default: {
    affectedRoutes: ["Line 1"],
    alternatives: [
      { rank: 1, route: "Parallel bus route",   eta: "+10 min", reliability: "Medium" },
      { rank: 2, route: "Alternate subway line", eta: "+15 min", reliability: "High"   },
      { rank: 3, route: "Surface streetcar",     eta: "+20 min", reliability: "Low"    },
    ],
    recoveryTime: "25 min",
    impactedRiders: 2500,
  },
};

// ─── Service Gap Analysis ─────────────────────────────────────────────────────
export const serviceGapZones = [
  {
    id: 1, name: "Malvern North",       lat: 43.8120, lng: -79.2150,
    population: 18400, stopDensity: 0.6, gapScore: 88,
    proposedStop: { lat: 43.8145, lng: -79.2200, name: "Proposed: Malvern Town Centre" },
    estimatedBenefit: 3200,
  },
  {
    id: 2, name: "Humber Summit",       lat: 43.7684, lng: -79.5423,
    population: 12700, stopDensity: 0.8, gapScore: 82,
    proposedStop: { lat: 43.7710, lng: -79.5450, name: "Proposed: Humber Summit Loop" },
    estimatedBenefit: 2100,
  },
  {
    id: 3, name: "West Humber–Clairville", lat: 43.7242, lng: -79.5754,
    population: 21600, stopDensity: 0.7, gapScore: 85,
    proposedStop: { lat: 43.7270, lng: -79.5790, name: "Proposed: Albion–Humber Connector" },
    estimatedBenefit: 4100,
  },
  {
    id: 4, name: "Rouge",               lat: 43.8045, lng: -79.1648,
    population: 9800,  stopDensity: 0.5, gapScore: 91,
    proposedStop: { lat: 43.8070, lng: -79.1680, name: "Proposed: Rouge Valley Station" },
    estimatedBenefit: 1900,
  },
  {
    id: 5, name: "Emery",               lat: 43.7470, lng: -79.5270,
    population: 15300, stopDensity: 0.9, gapScore: 76,
    proposedStop: { lat: 43.7490, lng: -79.5300, name: "Proposed: Emery Village Hub" },
    estimatedBenefit: 2700,
  },
];

export const coverageStats = {
  before: { population_covered_pct: 71.2, avg_walk_to_stop_min: 12.4, stops_per_km2: 3.1 },
  after:  { population_covered_pct: 82.7, avg_walk_to_stop_min: 8.2,  stops_per_km2: 3.9 },
};
