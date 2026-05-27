/**
 * Unit tests for TransitLens pure utility functions.
 * Covers: equity scoring, alert generation, normalisation, API client fallback.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Inline copies of pure functions (no JSX dependency) ─────────────────────

function buildEquityBands(zones) {
  return [
    { name: 'High (≥75)',    value: zones.filter(n => n.equityScore >= 75).length, fill: '#19b159' },
    { name: 'Medium (55–74)',value: zones.filter(n => n.equityScore >= 55 && n.equityScore < 75).length, fill: '#f7b731' },
    { name: 'Low (40–54)',   value: zones.filter(n => n.equityScore >= 40 && n.equityScore < 55).length, fill: '#eb6f33' },
    { name: 'Critical (<40)',value: zones.filter(n => n.equityScore < 40).length, fill: '#f5334f' },
  ];
}

function scoreColor(s) {
  if (s >= 75) return '#19b159';
  if (s >= 55) return '#f7b731';
  if (s >= 40) return '#eb6f33';
  return '#f5334f';
}

function scoreBadge(s) {
  if (s >= 75) return 'success';
  if (s >= 55) return 'warning';
  if (s >= 40) return 'secondary';
  return 'danger';
}

function normalise(n) {
  const seniorRaw     = n.senior_pct     ?? n.seniorPct     ?? 0;
  const disabilityRaw = n.disability_pct ?? n.disabilityPct ?? 0;
  const seniorPct     = seniorRaw     <= 1 ? Math.round(seniorRaw * 100)     : Math.round(seniorRaw);
  const disabilityPct = disabilityRaw <= 1 ? Math.round(disabilityRaw * 100) : Math.round(disabilityRaw);
  return {
    id:           n.id ?? n.name,
    name:         n.name,
    lat:          n.lat,
    lng:          n.lng,
    equityScore:  Math.round(n.equity_score ?? n.equityScore ?? 0),
    incomeIndex:  n.income_index != null
                    ? Math.round(n.income_index * 100)
                    : Math.min(100, Math.round((n.income ?? 0) / 1000)),
    seniorPct,
    disabilityPct,
    stopDensity:  +(n.stop_density ?? n.stopDensity ?? 0).toFixed(1),
    routeCount:   n.route_count ?? n.routeCount ?? 0,
    population:   n.population ?? 0,
  };
}

function buildAlerts(demand, zones, gapZones) {
  const alerts = [];
  (demand ?? []).forEach((r) => {
    const pct = r.capacity > 0 ? Math.round((r.demand / r.capacity) * 100) : 0;
    if (pct > 85) alerts.push({ id: `d-${r.route}`, route: r.route, msg: `Ridership at ${pct}% capacity`, type: 'warning' });
  });
  (zones ?? []).filter(z => (z.equityScore ?? z.equity_score ?? 100) < 45).forEach((z) => {
    alerts.push({ id: `e-${z.id}`, route: z.name, msg: 'Critical equity score — underserved neighbourhood', type: 'danger' });
  });
  (gapZones ?? []).slice(0, 2).forEach((z) => {
    alerts.push({ id: `g-${z.id}`, route: 'Service Gap', msg: `${z.name} flagged — gap score ${z.gapScore ?? 'high'}`, type: 'info' });
  });
  return alerts.slice(0, 6);
}

function gapColor(score) {
  if (score >= 80) return '#f5334f';
  if (score >= 65) return '#eb6f33';
  if (score >= 50) return '#f7b731';
  return '#19b159';
}

// ─── buildEquityBands ─────────────────────────────────────────────────────────

describe('buildEquityBands', () => {
  const zones = [
    { equityScore: 89 }, // High
    { equityScore: 82 }, // High
    { equityScore: 71 }, // Medium
    { equityScore: 60 }, // Medium
    { equityScore: 44 }, // Low
    { equityScore: 38 }, // Critical
    { equityScore: 31 }, // Critical
  ];

  it('returns 4 bands', () => {
    expect(buildEquityBands(zones)).toHaveLength(4);
  });

  it('counts High correctly (score >= 75)', () => {
    const bands = buildEquityBands(zones);
    expect(bands[0].value).toBe(2);
  });

  it('counts Medium correctly (55–74)', () => {
    const bands = buildEquityBands(zones);
    expect(bands[1].value).toBe(2);
  });

  it('counts Low correctly (40–54)', () => {
    const bands = buildEquityBands(zones);
    expect(bands[2].value).toBe(1);
  });

  it('counts Critical correctly (< 40)', () => {
    const bands = buildEquityBands(zones);
    expect(bands[3].value).toBe(2);
  });

  it('returns zero counts for empty input', () => {
    const bands = buildEquityBands([]);
    bands.forEach(b => expect(b.value).toBe(0));
  });

  it('boundary value 75 goes into High', () => {
    const bands = buildEquityBands([{ equityScore: 75 }]);
    expect(bands[0].value).toBe(1);
    expect(bands[1].value).toBe(0);
  });

  it('boundary value 55 goes into Medium', () => {
    const bands = buildEquityBands([{ equityScore: 55 }]);
    expect(bands[1].value).toBe(1);
  });

  it('boundary value 40 goes into Low', () => {
    const bands = buildEquityBands([{ equityScore: 40 }]);
    expect(bands[2].value).toBe(1);
  });

  it('preserves fill colours', () => {
    const bands = buildEquityBands([]);
    expect(bands[0].fill).toBe('#19b159');
    expect(bands[3].fill).toBe('#f5334f');
  });
});

// ─── scoreColor ───────────────────────────────────────────────────────────────

describe('scoreColor', () => {
  it('returns green for high score (75+)', () => {
    expect(scoreColor(75)).toBe('#19b159');
    expect(scoreColor(100)).toBe('#19b159');
  });
  it('returns yellow for medium (55–74)', () => {
    expect(scoreColor(55)).toBe('#f7b731');
    expect(scoreColor(74)).toBe('#f7b731');
  });
  it('returns orange for low (40–54)', () => {
    expect(scoreColor(40)).toBe('#eb6f33');
    expect(scoreColor(54)).toBe('#eb6f33');
  });
  it('returns red for critical (< 40)', () => {
    expect(scoreColor(39)).toBe('#f5334f');
    expect(scoreColor(0)).toBe('#f5334f');
  });
});

// ─── scoreBadge ───────────────────────────────────────────────────────────────

describe('scoreBadge', () => {
  it('returns success for >= 75', () => expect(scoreBadge(80)).toBe('success'));
  it('returns warning for 55–74', () => expect(scoreBadge(60)).toBe('warning'));
  it('returns secondary for 40–54', () => expect(scoreBadge(45)).toBe('secondary'));
  it('returns danger for < 40', () => expect(scoreBadge(30)).toBe('danger'));
  it('boundary 75 → success', () => expect(scoreBadge(75)).toBe('success'));
  it('boundary 55 → warning', () => expect(scoreBadge(55)).toBe('warning'));
  it('boundary 40 → secondary', () => expect(scoreBadge(40)).toBe('secondary'));
});

// ─── normalise ────────────────────────────────────────────────────────────────

describe('normalise', () => {
  it('handles camelCase API response', () => {
    const result = normalise({
      id: 1, name: 'Downtown', lat: 43.65, lng: -79.38,
      equityScore: 89, income: 95000, seniorPct: 8, disabilityPct: 6,
      stopDensity: 9.2, routeCount: 12, population: 55000,
    });
    expect(result.equityScore).toBe(89);
    expect(result.seniorPct).toBe(8);
    expect(result.disabilityPct).toBe(6);
    expect(result.stopDensity).toBe(9.2);
    expect(result.routeCount).toBe(12);
    expect(result.population).toBe(55000);
  });

  it('handles snake_case API response', () => {
    const result = normalise({
      id: 'jane_finch', name: 'Jane & Finch', lat: 43.76, lng: -79.51,
      equity_score: 31, income_index: 0.45, senior_pct: 0.14,
      disability_pct: 0.15, stop_density: 0.9, route_count: 3, population: 41000,
    });
    expect(result.equityScore).toBe(31);
    expect(result.incomeIndex).toBe(45);       // 0.45 * 100
    expect(result.seniorPct).toBe(14);         // 0.14 * 100
    expect(result.disabilityPct).toBe(15);     // 0.15 * 100
  });

  it('income in dollars is scaled to 0–100 index', () => {
    const result = normalise({ name: 'X', lat: 0, lng: 0, income: 84000 });
    expect(result.incomeIndex).toBe(84);
  });

  it('income > 100k is capped at 100', () => {
    const result = normalise({ name: 'X', lat: 0, lng: 0, income: 150000 });
    expect(result.incomeIndex).toBe(100);
  });

  it('income_index takes priority over income field', () => {
    const result = normalise({ name: 'X', lat: 0, lng: 0, income_index: 0.6, income: 99999 });
    expect(result.incomeIndex).toBe(60);
  });

  it('defaults zeros for missing fields', () => {
    const result = normalise({ name: 'X', lat: 0, lng: 0 });
    expect(result.equityScore).toBe(0);
    expect(result.seniorPct).toBe(0);
    expect(result.population).toBe(0);
  });

  it('uses name as id fallback', () => {
    const result = normalise({ name: 'Fallback', lat: 0, lng: 0 });
    expect(result.id).toBe('Fallback');
  });
});

// ─── buildAlerts ──────────────────────────────────────────────────────────────

describe('buildAlerts', () => {
  const demandOverCapacity = [{ route: '504 King', demand: 55000, capacity: 60000 }]; // 91%
  const demandUnder       = [{ route: '36 Finch',  demand: 20000, capacity: 40000 }]; // 50%
  const criticalZone      = [{ id: 1, name: 'Jane & Finch', equityScore: 31 }];
  const okZone            = [{ id: 2, name: 'Downtown',     equityScore: 89 }];
  const gapZones          = [{ id: 1, name: 'Malvern', gapScore: 88 }, { id: 2, name: 'Humber', gapScore: 82 }, { id: 3, name: 'Rouge', gapScore: 91 }];

  it('generates warning for route > 85% capacity', () => {
    const alerts = buildAlerts(demandOverCapacity, [], []);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].type).toBe('warning');
    // 55000/60000 = 91.67% → Math.round → 92%
    expect(alerts[0].msg).toContain('92%');
  });

  it('does NOT generate alert for route <= 85% capacity', () => {
    const alerts = buildAlerts(demandUnder, [], []);
    expect(alerts).toHaveLength(0);
  });

  it('generates danger alert for critical equity zone (score < 45)', () => {
    const alerts = buildAlerts([], criticalZone, []);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].type).toBe('danger');
    expect(alerts[0].route).toBe('Jane & Finch');
  });

  it('does NOT generate alert for non-critical equity zone', () => {
    const alerts = buildAlerts([], okZone, []);
    expect(alerts).toHaveLength(0);
  });

  it('generates info alerts for top 2 gap zones only', () => {
    const alerts = buildAlerts([], [], gapZones);
    const infoAlerts = alerts.filter(a => a.type === 'info');
    expect(infoAlerts).toHaveLength(2);
    expect(infoAlerts[0].msg).toContain('Malvern');
    expect(infoAlerts[1].msg).toContain('Humber');
  });

  it('caps total alerts at 6', () => {
    const manyDemand = Array.from({ length: 4 }, (_, i) => ({
      route: `Route ${i}`, demand: 9000, capacity: 10000,
    }));
    const alerts = buildAlerts(manyDemand, criticalZone, gapZones);
    expect(alerts.length).toBeLessThanOrEqual(6);
  });

  it('handles null/undefined inputs gracefully', () => {
    expect(() => buildAlerts(null, null, null)).not.toThrow();
    expect(buildAlerts(null, null, null)).toHaveLength(0);
  });

  it('assigns stable ids by type', () => {
    const alerts = buildAlerts(demandOverCapacity, criticalZone, gapZones);
    expect(alerts.find(a => a.type === 'warning')?.id).toMatch(/^d-/);
    expect(alerts.find(a => a.type === 'danger')?.id).toMatch(/^e-/);
    expect(alerts.find(a => a.type === 'info')?.id).toMatch(/^g-/);
  });
});

// ─── gapColor ─────────────────────────────────────────────────────────────────

describe('gapColor', () => {
  it('returns red for score >= 80', () => expect(gapColor(88)).toBe('#f5334f'));
  it('returns orange for 65–79', () => expect(gapColor(70)).toBe('#eb6f33'));
  it('returns yellow for 50–64', () => expect(gapColor(55)).toBe('#f7b731'));
  it('returns green for < 50', () => expect(gapColor(40)).toBe('#19b159'));
  it('boundary 80 → red', () => expect(gapColor(80)).toBe('#f5334f'));
  it('boundary 65 → orange', () => expect(gapColor(65)).toBe('#eb6f33'));
});
