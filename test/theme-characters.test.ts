import * as THREE from "three";
import { assert, describe, it } from "vitest";
import {
  createMrKrabsParts,
  createSquidwardParts,
  createThemeCharacter,
} from "../src/theme/characters.js";
import { updateMrKrabsAnimation, updateSquidwardAnimation } from "../src/theme/animation.js";

function rotationSnapshot(object: THREE.Object3D) {
  return { x: object.rotation.x, y: object.rotation.y, z: object.rotation.z };
}

describe("procedural theme characters", () => {
  it("creates named Squidward parts and animates/restores tentacles", () => {
    const group = new THREE.Group();
    const parts = createSquidwardParts(group);
    assert.strictEqual(parts.tentacles.length, 4);
    assert.ok(group.getObjectByName("body"));
    assert.ok(group.getObjectByName("eyes"));
    assert.ok(group.getObjectByName("tentacle-0"));
    const initial = rotationSnapshot(parts.tentacles[0]);
    updateSquidwardAnimation(parts, 0.8, true);
    assert.notStrictEqual(parts.tentacles[0].rotation.z, initial.z);
    updateSquidwardAnimation(parts, 0.8, false);
    assert.deepStrictEqual(rotationSnapshot(parts.tentacles[0]), initial);
  });

  it("creates named Mr. Krabs parts and alternates claws", () => {
    const group = new THREE.Group();
    const parts = createMrKrabsParts(group);
    assert.strictEqual(parts.claws.length, 2);
    assert.ok(group.getObjectByName("body"));
    assert.ok(group.getObjectByName("eyes"));
    assert.ok(group.getObjectByName("claw-left"));
    const initial = rotationSnapshot(parts.claws[0]);
    updateMrKrabsAnimation(parts, 0.9, true);
    assert.notStrictEqual(parts.claws[0].rotation.z, initial.z);
    updateMrKrabsAnimation(parts, 0.9, false);
    assert.deepStrictEqual(rotationSnapshot(parts.claws[0]), initial);
  });

  it("creates scalable handles, supports static pose toggles, and disposes safely", () => {
    const squidward = createThemeCharacter("squidward", { scale: 0.7, animationEnabled: true });
    const krabs = createThemeCharacter("mr-krabs", { scale: 1, animationEnabled: true });
    assert.strictEqual(squidward.group.name, "Theme-squidward");
    assert.strictEqual(krabs.group.name, "Theme-mr-krabs");
    assert.strictEqual(squidward.group.scale.x, 0.7);
    squidward.update(0.7, 1 / 60);
    squidward.setAnimationEnabled(false);
    squidward.update(1.7, 1 / 60);
    squidward.resize(new THREE.Vector3(1, 2, 1));
    assert.ok(Math.abs(squidward.group.position.x) <= 1);
    squidward.dispose();
    squidward.dispose();
    krabs.dispose();
    krabs.dispose();
  });
});

