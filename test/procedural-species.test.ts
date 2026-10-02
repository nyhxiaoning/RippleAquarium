import { describe, expect, it } from "vitest";
import { createProceduralFishModel } from "../src/fish/procedural-species.js";
import {
  FISH_CATALOG,
  getFishMeta,
} from "../src/aquarium/species-catalog.js";

describe("procedural fish species", () => {
  it.each(["angelfish", "blue-tang", "pufferfish"] as const)(
    "creates a renderable %s model",
    (key) => {
      const model = createProceduralFishModel(key);
      expect(model.geometry.getAttribute("position").count).toBeGreaterThan(0);
      expect(model.geometry.getAttribute("normal").count).toBeGreaterThan(0);
      expect(model.geometry.getAttribute("position").count).toBeGreaterThan(120);
      expect(model.geometry.getAttribute("color").count).toBe(
        model.geometry.getAttribute("position").count,
      );
      expect(model.material).toBeDefined();
      expect(model.renderScale).toBeGreaterThan(0);
      expect(() => {
        model.geometry.dispose();
        model.material.dispose();
      }).not.toThrow();
    },
  );

  it("rejects unknown procedural model keys", () => {
    expect(() => createProceduralFishModel("unknown" as never)).toThrow(
      "Unknown procedural fish model",
    );
  });

  it("registers new fish with their intended counts and habitat metadata", () => {
    expect(FISH_CATALOG.map((entry) => entry.id)).toEqual([
      "sardine",
      "koi",
      "clownfish",
      "starfish",
      "angelfish",
      "blue-tang",
      "pufferfish",
    ]);
    expect(getFishMeta("angelfish")).toMatchObject({
      defaultCount: 12,
      maxCount: 60,
      modelKey: "angelfish",
      habitatLayer: "middle",
    });
    expect(getFishMeta("blue-tang")).toMatchObject({
      defaultCount: 10,
      maxCount: 50,
      modelKey: "blue-tang",
      habitatLayer: "upper",
    });
    expect(getFishMeta("pufferfish")).toMatchObject({
      defaultCount: 6,
      maxCount: 24,
      modelKey: "pufferfish",
      habitatLayer: "lower",
    });
  });
});
