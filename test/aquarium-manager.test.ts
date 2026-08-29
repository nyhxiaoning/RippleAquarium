import { assert, beforeEach, describe, it } from "vitest";
import { aquariumHalfSize, pineappleHouseDecor, spongebobPatrickDecor } from "../src/config.js";
import {
  DEFAULT_STYLE,
  CORAL_REEF_STYLE,
  DEEP_SEA_STYLE,
  SMALL_TANK_STYLE,
  getStyleById,
  listStyleIds,
} from "../src/aquarium/presets.js";
import {
  FISH_CATALOG,
  PLANT_CATALOG,
  getFishMeta,
  getPlantMeta,
} from "../src/aquarium/species-catalog.js";
import { createAquariumManager } from "../src/aquarium/manager.js";
import type { AquariumDescriptor } from "../src/aquarium/types.js";

// The manager tracks its descriptor even without a live scene handle, so the
// pure-logic parts (presets, catalog, resize clamping, change events) can be
// exercised in Node without WebGL.
const mockDeps = {
  renderer: {} as never,
  scene: {} as never,
  cameraRig: { configure: () => {} },
};

function fishCounts(manager: ReturnType<typeof createAquariumManager>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const entry of manager.getDescriptor().fish) out[entry.speciesId] = entry.count;
  return out;
}

describe("aquarium presets", () => {
  it("lists all four styles in order", () => {
    assert.deepStrictEqual(listStyleIds(), ["default", "coral-reef", "deep-sea", "small-tank"]);
  });

  it("derives the default style from config constants", () => {
    const style = getStyleById("default");
    assert.ok(style);
    assert.strictEqual(style.aquarium.halfSize.x, aquariumHalfSize.x);
    assert.strictEqual(style.aquarium.halfSize.y, aquariumHalfSize.y);
    assert.strictEqual(style.aquarium.halfSize.z, aquariumHalfSize.z);
    assert.strictEqual(style.decor[0].position.x, pineappleHouseDecor.position.x);
    assert.strictEqual(style.decor[1].position.x, spongebobPatrickDecor.position.x);
    assert.strictEqual(style.decor[1].height, spongebobPatrickDecor.height);
  });

  it("every style has a complete descriptor", () => {
    for (const style of [DEFAULT_STYLE, CORAL_REEF_STYLE, DEEP_SEA_STYLE, SMALL_TANK_STYLE]) {
      assert.ok(style.id, `style ${style.id} missing id`);
      assert.ok(style.name.zh && style.name.en);
      assert.ok(style.aquarium.halfSize.x > 0);
      assert.ok(style.aquarium.halfSize.y > 0);
      assert.ok(style.aquarium.halfSize.z > 0);
      assert.ok(style.theme.lighting.hemiIntensity > 0);
      assert.ok(style.theme.lighting.sunIntensity > 0);
      assert.ok(Array.isArray(style.decor));
      assert.ok(Array.isArray(style.fish));
      assert.ok(Array.isArray(style.plants));
    }
  });
});

describe("species catalog", () => {
  it("lists the expected fish and plant species", () => {
    assert.deepStrictEqual(
      FISH_CATALOG.map((m) => m.id),
      ["sardine", "koi", "clownfish", "starfish"],
    );
    assert.deepStrictEqual(
      PLANT_CATALOG.map((m) => m.id),
      ["coral", "seaweed"],
    );
  });

  it("reports sensible defaults and categories", () => {
    assert.strictEqual(getFishMeta("sardine")?.defaultCount, 60);
    assert.strictEqual(getFishMeta("sardine")?.maxCount, 260);
    assert.strictEqual(getFishMeta("koi")?.maxCount, 120);
    assert.strictEqual(getFishMeta("clownfish")?.kind, "bottom");
    assert.strictEqual(getFishMeta("starfish")?.kind, "bottom");
    assert.strictEqual(getPlantMeta("coral")?.maxCount, 200);
    assert.strictEqual(getPlantMeta("seaweed")?.maxCount, 40);
    assert.strictEqual(getPlantMeta("seaweed")?.defaultCount, 26);
  });

  it("returns undefined for unknown species", () => {
    assert.strictEqual(getFishMeta("ghost"), undefined);
    assert.strictEqual(getPlantMeta("ghost"), undefined);
  });
});

describe("aquarium manager (descriptor logic, no WebGL)", () => {
  let manager: ReturnType<typeof createAquariumManager>;

  beforeEach(() => {
    manager = createAquariumManager(DEFAULT_STYLE, mockDeps);
  });

  it("starts from the default style with default counts", () => {
    assert.strictEqual(manager.getDescriptor().id, "default");
    assert.deepStrictEqual(fishCounts(manager), { sardine: 60, koi: 24, clownfish: 18 });
  });

  it("reports style ids and half size from the descriptor", () => {
    assert.deepStrictEqual(manager.getStyleIds(), listStyleIds());
    assert.deepStrictEqual(manager.getHalfSize(), DEFAULT_STYLE.aquarium.halfSize);
  });

  it("notifies change listeners when a fish count changes", () => {
    const seen: AquariumDescriptor[] = [];
    manager.on("change", (descriptor) => seen.push(descriptor));
    assert.strictEqual(manager.setFishCount("sardine", 80), true);
    assert.strictEqual(fishCounts(manager).sardine, 80);
    assert.strictEqual(seen.length, 1);
    assert.strictEqual(seen[0].fish.find((f) => f.speciesId === "sardine")!.count, 80);
  });

  it("notifies change listeners when a plant count changes", () => {
    const seen: AquariumDescriptor[] = [];
    manager.on("change", (descriptor) => seen.push(descriptor));
    assert.strictEqual(manager.setPlantCount("coral", 50), true);
    assert.strictEqual(manager.getDescriptor().plants[0].count, 50);
    assert.strictEqual(seen.length, 1);
  });

  it("rejects unknown species when setting a count", () => {
    assert.strictEqual(manager.setFishCount("ghost", 5), false);
    assert.strictEqual(manager.setPlantCount("ghost", 5), false);
  });

  it("clamps fish counts proportionally when the tank shrinks", () => {
    const half = DEFAULT_STYLE.aquarium.halfSize;
    // Shrink to 1/8 of the original volume.
    manager.resize({ x: half.x / 2, y: half.y / 2, z: half.z / 2 });
    const counts = fishCounts(manager);
    assert.strictEqual(counts.sardine, Math.round(60 / 8));
    assert.strictEqual(counts.koi, Math.round(24 / 8));
    assert.strictEqual(counts.clownfish, Math.round(18 / 8));
    // Never more fish than the original default counts.
    assert.ok(counts.sardine <= 60);
    assert.ok(counts.koi <= 24);
    assert.ok(counts.clownfish <= 18);
  });

  it("does not spawn fish when the tank grows", () => {
    const before = fishCounts(manager);
    manager.resize({ x: 22, y: 13.2, z: 17 }); // 8x the default volume
    assert.deepStrictEqual(fishCounts(manager), before);
  });

  it("does not mutate the shared preset when counts change", () => {
    const before = { ...DEFAULT_STYLE.fish.find((f) => f.speciesId === "sardine")! };
    manager.setFishCount("sardine", 999);
    manager.setPlantCount("coral", 1);
    manager.resize({ x: 1, y: 1, z: 1 });
    const after = DEFAULT_STYLE.fish.find((f) => f.speciesId === "sardine")!;
    assert.strictEqual(after.count, before.count);
    assert.strictEqual(DEFAULT_STYLE.plants[0].count, 100);
  });

  it("reports the new half size after resize", () => {
    manager.resize({ x: 5, y: 4, z: 3 });
    assert.deepStrictEqual(manager.getHalfSize(), { x: 5, y: 4, z: 3 });
  });
});
