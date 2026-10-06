import { assert, describe, it } from "vitest";
import * as THREE from "three";
import { computeClownfishAvoidanceZones, computeExclusionZones, computeObstacles } from "../src/aquarium/scene-builder.js";
import { createDefaultThemeEntries } from "../src/theme/catalog.js";
import {
  createThemeProp,
  getThemeAvoidanceZone,
  getThemePropCollision,
} from "../src/theme/props.js";

describe("theme props", () => {
  it("builds named procedural props with geometry and safe cleanup", () => {
    for (const id of ["pineapple-house", "squidward-house", "krusty-krab"] as const) {
      const handle = createThemeProp(id, { scale: 0.8 });
      assert.ok(handle);
      assert.strictEqual(handle.group.name, `Theme-${id}`);
      assert.ok(handle.group.children.length > 0);
      assert.ok(handle.group.getObjectByProperty("isMesh", true));
      handle.resize(new THREE.Vector3(12, 8, 10));
      assert.strictEqual(handle.group.position.y, -8);
      handle.update(1, 1 / 60);
      handle.dispose();
      handle.dispose();
      assert.strictEqual(handle.group.children.length, 0);
    }
  });

  it("exposes the pineapple house's key procedural parts", () => {
    const handle = createThemeProp("pineapple-house");
    assert.ok(handle);
    for (const name of [
      "pineapple-body",
      "pineapple-ridges",
      "pineapple-leaf-crown",
      "pineapple-windows",
      "pineapple-door",
      "pineapple-base",
    ]) {
      assert.ok(handle.group.getObjectByName(name), `missing ${name}`);
    }
    assert.ok(handle.group.getObjectByName("pineapple-window-left"));
    assert.ok(handle.group.getObjectByName("pineapple-window-right"));
    handle.dispose();
  });

  it("returns stable scaled obstacle and avoidance records", () => {
    const position = new THREE.Vector3(-2, -6, 3);
    const obstacle = getThemePropCollision("squidward-house", position, 0.5);
    const zone = getThemeAvoidanceZone("squidward-house", position, 0.5);

    assert.deepStrictEqual(obstacle.position.toArray(), position.toArray());
    assert.strictEqual(obstacle.shape, "box");
    assert.ok(obstacle.size.x > 0);
    assert.ok(obstacle.size.y > 0);
    assert.ok(obstacle.size.z > 0);
    assert.ok(zone.radius > 0);
    assert.ok((zone.strength ?? 0) > 0);
    assert.notStrictEqual(obstacle.position, position);
    assert.notStrictEqual(zone.position, position);
  });

  it("provides a scaled pineapple footprint covering its tall crown", () => {
    const full = getThemePropCollision("pineapple-house", new THREE.Vector3(), 1);
    const half = getThemeAvoidanceZone("pineapple-house", new THREE.Vector3(), 0.5);
    assert.ok(full.size.y > full.size.x);
    assert.ok(full.size.y > 0);
    assert.ok(half.radius > 0);
    assert.ok((half.strength ?? 0) > 0);
    assert.ok(getThemePropCollision("pineapple-house", new THREE.Vector3(), 0.5).size.y < full.size.y);
  });

  it("merges enabled theme entries into scene collision and clownfish zones", () => {
    const entries = createDefaultThemeEntries();
    const disabled = entries.find((entry) => entry.id === "krusty-krab");
    assert.ok(disabled);
    disabled.enabled = false;
    const decor = [] as never[];
    const obstacles = computeObstacles(decor, new THREE.Vector3(14, 8, 10), entries);
    const zones = computeExclusionZones(decor, entries);
    const clownfishZones = computeClownfishAvoidanceZones(decor, entries);

    const enabledEntries = entries.filter((entry) => entry.enabled).length;
    assert.strictEqual(obstacles.length, enabledEntries);
    assert.strictEqual(zones.length, enabledEntries);
    assert.strictEqual(clownfishZones.length, enabledEntries);
    assert.ok(obstacles.every((obstacle) => obstacle.position.y < 0));
  });

  it("skips unknown optional props instead of throwing", () => {
    const handle = createThemeProp("unknown-prop" as never, { scale: 1 });
    assert.strictEqual(handle, null);
  });
});
