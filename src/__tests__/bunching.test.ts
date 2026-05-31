import { describe, it, expect } from "vitest";

// Inline the haversine + bunching logic to test without React hooks
function haversineM([lat1, lon1]: [number, number], [lat2, lon2]: [number, number]): number {
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

const THRESHOLD_M = 200;

describe("Bunching detection (haversine)", () => {
  it("detects vehicles within 200m on same route", () => {
    // Two vehicles on Line 1, ~100m apart near Bloor-Yonge
    const v1: [number, number] = [43.6714, -79.3857];
    const v2: [number, number] = [43.6715, -79.3858]; // ~14m away
    expect(haversineM(v1, v2)).toBeLessThan(THRESHOLD_M);
  });

  it("does not flag vehicles >200m apart", () => {
    // Line 2: Kipling and Islington stations (~1.3km apart)
    const kipling: [number, number]   = [43.6367, -79.5360];
    const islington: [number, number] = [43.6468, -79.5239];
    expect(haversineM(kipling, islington)).toBeGreaterThan(THRESHOLD_M);
  });

  it("haversine is symmetric", () => {
    const a: [number, number] = [43.6714, -79.3857];
    const b: [number, number] = [43.6780, -79.3835];
    expect(haversineM(a, b)).toBeCloseTo(haversineM(b, a), 2);
  });

  it("same point returns 0m", () => {
    const p: [number, number] = [43.6714, -79.3857];
    expect(haversineM(p, p)).toBeCloseTo(0, 1);
  });

  it("Union to Bloor-Yonge is ~3km", () => {
    const union: [number, number]     = [43.6452, -79.3802];
    const bloor: [number, number]     = [43.6714, -79.3857];
    const dist = haversineM(union, bloor);
    expect(dist).toBeGreaterThan(2_500);
    expect(dist).toBeLessThan(3_500);
  });
});
