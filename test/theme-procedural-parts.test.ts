import * as THREE from "three";
import { assert, describe, it } from "vitest";
import {
  createRoundedBoxGeometry,
  createEyePair,
  createThemeMaterial,
  createThemeMesh,
  disposeThemeResources,
} from "../src/theme/procedural-parts.js";

describe("procedural theme parts", () => {
  it("creates renderable geometry and disposes a theme group safely", () => {
    const group = new THREE.Group();
    const geometry = createRoundedBoxGeometry(1, 2, 0.8, 0.08);
    const material = createThemeMaterial(0xffd83d);
    const body = createThemeMesh("body", geometry, material);
    group.add(body);

    assert.ok(body.geometry.getAttribute("position").count > 0);
    assert.ok(body.geometry.getAttribute("normal").count > 0);
    assert.strictEqual(body.castShadow, true);
    assert.strictEqual(body.receiveShadow, true);

    disposeThemeResources(group);
    disposeThemeResources(group);
    assert.equal(group.children.length, 1);
  });

  it("creates a named eye pair with reusable caller-owned materials", () => {
    const group = new THREE.Group();
    const white = createThemeMaterial(0xffffff);
    const dark = createThemeMaterial(0x111111);
    const eyes = createEyePair(group, {
      eyeWhiteMaterial: white,
      eyeDarkMaterial: dark,
      y: 1,
      z: 0.5,
      spacing: 0.2,
    });

    assert.equal(eyes.name, "eyes");
    assert.equal(eyes.children.length, 4);
    assert.ok(group.getObjectByName("pupil-left"));

    disposeThemeResources(group);
  });
});
