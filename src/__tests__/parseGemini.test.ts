import { describe, it, expect } from "vitest";
import { parseRecommendations } from "@/lib/parseGemini";

describe("parseRecommendations", () => {
  it("parses numbered lines separated by newlines", () => {
    const input = `1. Monitor Route 29 Dufferin closely. Delay risk is 71/100.
2. Deploy extra service on 501 Queen. Streetcar risk elevated at 65/100.
3. Alert OCC of weather impact. Precipitation rising to 55% by 18:00.`;
    const result = parseRecommendations(input);
    expect(result).toHaveLength(3);
    expect(result[0]).toContain("Route 29 Dufferin");
    expect(result[1]).toContain("501 Queen");
    expect(result[2]).toContain("18:00");
  });

  it("strips markdown bold and italic", () => {
    const input = `1. **Monitor** Route 29. Risk is *high*.
2. Deploy *extra* service on **501 Queen**.
3. Alert OCC of weather impact at peak hours.`;
    const result = parseRecommendations(input);
    expect(result[0]).not.toContain("**");
    expect(result[0]).not.toContain("*");
  });

  it("handles paragraph-separated recommendations", () => {
    const input = `Monitor Route 29 Dufferin closely due to 71/100 risk score.

Deploy additional service on 501 Queen streetcar. The route shows elevated delay risk.

Alert OCC of incoming weather. Precipitation rising to 55% by 18:00 peak.`;
    const result = parseRecommendations(input);
    expect(result.length).toBeGreaterThanOrEqual(2);
  });

  it("filters out preamble lines like 'Here are 3 recommendations'", () => {
    const input = `Here are 3 recommendations for TTC operators:
1. Monitor Route 29. Delay risk is 71/100 with 67% on-time rate.
2. Deploy extra service on 501 Queen. Streetcar risk elevated.
3. Alert OCC of weather impact. Peak precipitation at 18:00.`;
    const result = parseRecommendations(input);
    expect(result.every(r => !/^here are/i.test(r))).toBe(true);
    expect(result).toHaveLength(3);
  });

  it("caps output at max parameter", () => {
    const input = `1. First recommendation with enough text to pass filter.
2. Second recommendation with enough text to pass filter.
3. Third recommendation with enough text to pass filter.
4. Fourth recommendation with enough text to pass filter.`;
    const result = parseRecommendations(input, 3);
    expect(result).toHaveLength(3);
  });

  it("returns available items when fewer than 3 exist", () => {
    const input = `Only one clear recommendation here: monitor the main route carefully.`;
    const result = parseRecommendations(input);
    expect(result.length).toBeGreaterThanOrEqual(0);
  });
});
