import { describe, expect, it } from "vitest";
import { createFishModelInstanceByKey } from "../src/fish/model-loader.js";

describe("fish model routing", () => {
  it.each(["sardine", "koi", "clownfish", "starfish"] as const)(
    "routes %s to a colored procedural model before GLB lookup",
    (key) => {
      const model = createFishModelInstanceByKey(key);

      expect(model.geometry.getAttribute("position").count).toBeGreaterThan(0);
      expect(model.geometry.getAttribute("color")).toBeDefined();
      expect(model.geometry.getAttribute("normal")).toBeDefined();

      model.geometry.dispose();
      model.material.dispose();
    },
  );
});
