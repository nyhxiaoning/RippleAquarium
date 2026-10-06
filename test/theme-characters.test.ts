import * as THREE from "three";
import { assert, describe, it } from "vitest";
import {
  createMrKrabsParts,
  createPatrickParts,
  createSpongeBobParts,
  createSquidwardParts,
  createThemeCharacter,
} from "../src/theme/characters.js";
import {
  updateMrKrabsAnimation,
  updatePatrickAnimation,
  updateSquidwardAnimation,
  updateSpongeBobAnimation,
} from "../src/theme/animation.js";

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

  it.each(["spongebob", "patrick"] as const)("creates and safely disposes %s", (id) => {
    const handle = createThemeCharacter(id, { scale: 0.8, animationEnabled: true });
    assert.equal(handle.group.name, `Theme-${id}`);
    assert.ok(handle.group.getObjectByProperty("isMesh", true));
    assert.ok(handle.getInteractionAnchor?.());
    assert.ok(handle.group.getObjectByName("eyes"));
    assert.ok(handle.group.getObjectByName("mouth"));
    assert.ok(handle.group.getObjectByName("arm-left"));
    assert.ok(handle.group.getObjectByName("arm-right"));
    assert.ok(handle.group.getObjectByName("leg-left"));
    assert.ok(handle.group.getObjectByName("leg-right"));
    handle.update(1.2, 1 / 60);
    handle.setAnimationEnabled(false);
    handle.resize(new THREE.Vector3(5, 3.5, 4));
    handle.dispose();
    handle.dispose();
    assert.equal(handle.group.children.length, 0);
  });

  it("keeps distinct SpongeBob and Patrick silhouettes and restores idle poses", () => {
    const spongeGroup = new THREE.Group();
    const patrickGroup = new THREE.Group();
    const sponge = createSpongeBobParts(spongeGroup);
    const patrick = createPatrickParts(patrickGroup);
    const spongeBody = spongeGroup.getObjectByName("body") as THREE.Mesh;
    const patrickBody = patrickGroup.getObjectByName("body") as THREE.Mesh;
    spongeBody.geometry.computeBoundingBox();
    patrickBody.geometry.computeBoundingBox();
    const spongeWidth = (spongeBody.geometry.boundingBox?.max.x ?? 0) * spongeBody.scale.x * 2;
    const patrickWidth = (patrickBody.geometry.boundingBox?.max.x ?? 0) * patrickBody.scale.x * 2;
    assert.ok(spongeWidth > patrickWidth);
    assert.strictEqual(sponge.arms.length, 2);
    assert.strictEqual(patrick.arms.length, 2);

    const spongeInitial = rotationSnapshot(sponge.arms[0]);
    const patrickInitial = rotationSnapshot(patrick.arms[0]);
    updateSpongeBobAnimation(sponge, 1.2, true);
    updatePatrickAnimation(patrick, 1.2, true);
    assert.notStrictEqual(sponge.arms[0].rotation.z, spongeInitial.z);
    assert.notStrictEqual(patrick.arms[0].rotation.z, patrickInitial.z);
    updateSpongeBobAnimation(sponge, 1.2, false);
    updatePatrickAnimation(patrick, 1.2, false);
    assert.deepStrictEqual(rotationSnapshot(sponge.arms[0]), spongeInitial);
    assert.deepStrictEqual(rotationSnapshot(patrick.arms[0]), patrickInitial);
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
