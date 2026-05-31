import { describe, it, expect } from "vitest";
import { computeGravityOD, STATION_BOARDINGS } from "@/mock/od_gravity";

describe("computeGravityOD", () => {
  it("returns OD pairs from real station data", () => {
    const pairs = computeGravityOD();
    expect(pairs.length).toBeGreaterThan(0);
  });

  it("all flows are positive numbers", () => {
    const pairs = computeGravityOD();
    pairs.forEach(p => {
      expect(p.riders).toBeGreaterThan(0);
    });
  });

  it("pairs are sorted by ridership descending", () => {
    const pairs = computeGravityOD();
    for (let i = 1; i < pairs.length; i++) {
      expect(pairs[i].riders).toBeLessThanOrEqual(pairs[i - 1].riders);
    }
  });

  it("no self-loops (from === to)", () => {
    const pairs = computeGravityOD();
    pairs.forEach(p => expect(p.from).not.toBe(p.to));
  });

  it("high-boardings stations dominate top flows", () => {
    const pairs = computeGravityOD();
    const top5 = pairs.slice(0, 5);
    const majorStations = new Set(["Union", "Bloor-Yonge", "St George", "Spadina"]);
    const topInvolvesMajor = top5.some(
      p => majorStations.has(p.from) || majorStations.has(p.to)
    );
    expect(topInvolvesMajor).toBe(true);
  });

  it("shift values are within -15 to +15 range", () => {
    const pairs = computeGravityOD();
    pairs.forEach(p => {
      expect(p.shift).toBeGreaterThanOrEqual(-15);
      expect(p.shift).toBeLessThanOrEqual(15);
    });
  });

  it("STATION_BOARDINGS has real Toronto coordinates", () => {
    Object.values(STATION_BOARDINGS).forEach(s => {
      // Toronto lat/lon bounds
      expect(s.lat).toBeGreaterThan(43.5);
      expect(s.lat).toBeLessThan(44.0);
      expect(s.lon).toBeGreaterThan(-79.7);
      expect(s.lon).toBeLessThan(-79.1);
      expect(s.boardings).toBeGreaterThan(0);
    });
  });
});
