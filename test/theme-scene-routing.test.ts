import { readFileSync } from "node:fs";
import { assert, describe, it } from "vitest";
import * as THREE from "three";
import { DEFAULT_STYLE } from "../src/aquarium/presets.js";
import {
  computeClownfishAvoidanceZones,
  computeExclusionZones,
  computeObstacles,
} from "../src/aquarium/scene-builder.js";
import type { DecorItem } from "../src/aquarium/types.js";
import { createDefaultThemeEntries, normalizeThemeEntries } from "../src/theme/catalog.js";

describe("procedural theme scene routing", () => {
  it("does not retain the legacy decor factories in scene-builder", () => {
    const source = readFileSync(new URL("../src/aquarium/scene-builder.ts", import.meta.url), "utf8");
    assert.notMatch(source, /createPineappleHouseDecor|createSpongebobPatrickDecor/);
    assert.notMatch(source, /\.\.\/decor\/(?:pineapple-house|spongebob-patrick)\.js/);
  });

  it("keeps the default character entries and pineapple footprint", () => {
    const entries = DEFAULT_STYLE.themeEntries ?? [];
    assert.ok(entries.some((entry) => entry.id === "spongebob"));
    assert.ok(entries.some((entry) => entry.id === "patrick"));
    const pineapple = entries.find((entry) => entry.id === "pineapple-house");
    assert.ok(pineapple);
    assert.ok(pineapple.scale > 0);
    assert.ok(pineapple.position.x !== 0 || pineapple.position.z !== 0);
  });

  it("uses normalized theme entries once when legacy decor is present", () => {
    const decor: DecorItem[] = [
      {
        id: "legacy-pineapple",
        asset: "pineapple-house",
        position: { x: -4.65, y: -8, z: 2.75 },
        rotationY: 0,
        height: 6.08,
      },
      {
        id: "legacy-characters",
        asset: "spongebob-patrick",
        position: { x: -3.17, y: -8, z: 6.95 },
        height: 2.35,
      },
    ];
    const entries = normalizeThemeEntries(undefined, decor);
    const enabledCount = entries.filter((entry) => entry.enabled).length;
    const halfSize = new THREE.Vector3(14, 8, 11);

    assert.strictEqual(computeObstacles(decor, halfSize, entries).length, enabledCount);
    assert.strictEqual(computeExclusionZones(decor, entries).length, enabledCount);
    assert.strictEqual(computeClownfishAvoidanceZones(decor, entries).length, enabledCount);

    // The input remains legacy-shaped and is not expanded in place.
    assert.strictEqual(decor.length, 2);
    assert.strictEqual(createDefaultThemeEntries().length, 7);
  });
});
