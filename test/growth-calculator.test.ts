import { describe, expect, it } from "vitest";
import {
  calculateGrowth,
  clampOfflineSeconds,
  DEFAULT_GROWTH_CONFIG,
} from "../src/growth/calculator.js";

describe("fish growth calculator", () => {
  it("uses the agreed stages and reaches full size at two hours", () => {
    expect(calculateGrowth(0, DEFAULT_GROWTH_CONFIG).stage).toBe("juvenile");
    expect(calculateGrowth(20 * 60, DEFAULT_GROWTH_CONFIG).stage).toBe("growing");
    expect(calculateGrowth(80 * 60, DEFAULT_GROWTH_CONFIG).stage).toBe("adult");
    expect(calculateGrowth(120 * 60, DEFAULT_GROWTH_CONFIG).sizeMultiplier).toBe(1);
  });

  it("clamps offline catch-up and ignores a clock rollback", () => {
    expect(clampOfflineSeconds(0, 26 * 60 * 60 * 1000, 24 * 60 * 60)).toBe(24 * 60 * 60);
    expect(clampOfflineSeconds(10_000, 9_000, 24 * 60 * 60)).toBe(0);
  });

  it("clamps invalid or negative ages and keeps progress bounded", () => {
    expect(calculateGrowth(-1).sizeMultiplier).toBe(DEFAULT_GROWTH_CONFIG.juvenileScale);
    expect(calculateGrowth(Number.NaN).growthProgress).toBe(0);
    expect(calculateGrowth(Number.POSITIVE_INFINITY).growthProgress).toBe(0);
    expect(calculateGrowth(10 * 60 * 60).growthProgress).toBe(1);
  });
});
