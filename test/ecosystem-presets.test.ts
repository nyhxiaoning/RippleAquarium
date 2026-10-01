import { describe, expect, it } from "vitest";
import {
  AQUARIUM_STYLES,
  DEFAULT_STYLE,
  SMALL_TANK_STYLE,
} from "../src/aquarium/presets.js";
import { ECOLOGY_CATALOG, getEcologyMeta } from "../src/ecology/catalog.js";
import { FISH_CATALOG, getFishMeta } from "../src/aquarium/species-catalog.js";

describe("ecosystem presets", () => {
  it("ships the expanded default aquarium and all new species", () => {
    expect(DEFAULT_STYLE.aquarium.halfSize).toEqual({ x: 14, y: 8, z: 11 });

    const fishIds = DEFAULT_STYLE.fish.map((entry) => entry.speciesId);
    expect(fishIds).toEqual(expect.arrayContaining(["angelfish", "blue-tang", "pufferfish"]));
    const fishCount = DEFAULT_STYLE.fish.reduce((total, entry) => total + entry.count, 0);
    expect(fishCount).toBeGreaterThanOrEqual(120);
    expect(fishCount).toBeLessThanOrEqual(160);
    for (const entry of DEFAULT_STYLE.fish) {
      expect(entry.count).toBeGreaterThan(0);
      expect(entry.count).toBeLessThanOrEqual(getFishMeta(entry.speciesId)?.maxCount ?? 0);
    }

    expect(DEFAULT_STYLE.ecology?.map((entry) => entry.speciesId)).toEqual(
      ECOLOGY_CATALOG.map((entry) => entry.id),
    );
    for (const entry of DEFAULT_STYLE.ecology ?? []) {
      expect(entry.count).toBeGreaterThan(0);
      expect(entry.count).toBeLessThanOrEqual(getEcologyMeta(entry.speciesId)?.maxCount ?? 0);
    }
  });

  it("keeps every style within catalog capacities", () => {
    for (const style of AQUARIUM_STYLES) {
      for (const entry of style.fish) {
        expect(entry.count).toBeLessThanOrEqual(getFishMeta(entry.speciesId)?.maxCount ?? 0);
      }
      for (const entry of style.ecology ?? []) {
        expect(entry.count).toBeLessThanOrEqual(getEcologyMeta(entry.speciesId)?.maxCount ?? 0);
      }
    }
  });

  it("keeps the small-tank preset compact", () => {
    const fishCount = SMALL_TANK_STYLE.fish.reduce((total, entry) => total + entry.count, 0);
    const ecologyCount = (SMALL_TANK_STYLE.ecology ?? []).reduce((total, entry) => total + entry.count, 0);
    expect(fishCount).toBeLessThanOrEqual(40);
    expect(ecologyCount).toBeLessThanOrEqual(12);
    expect(SMALL_TANK_STYLE.aquarium.halfSize).toEqual({ x: 5, y: 3.5, z: 4 });
  });

  it("keeps catalog metadata aligned with preset ids", () => {
    const knownFish = new Set(FISH_CATALOG.map((entry) => entry.id));
    for (const style of AQUARIUM_STYLES) {
      for (const entry of style.fish) expect(knownFish.has(entry.speciesId)).toBe(true);
    }
  });
});
