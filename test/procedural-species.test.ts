import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { createProceduralFishModel } from "../src/fish/procedural-species.js";
import {
  FISH_CATALOG,
  getFishMeta,
} from "../src/aquarium/species-catalog.js";

describe("procedural fish species", () => {
  it.each([
    "sardine",
    "koi",
    "clownfish",
    "starfish",
    "angelfish",
    "blue-tang",
    "pufferfish",
  ] as const)(
    "creates a renderable %s model",
    (key) => {
      const model = createProceduralFishModel(key);
      expect(model.geometry.getAttribute("position").count).toBeGreaterThan(0);
      expect(model.geometry.getAttribute("normal").count).toBeGreaterThan(0);
      expect(model.geometry.getAttribute("position").count).toBeGreaterThan(120);
      const position = model.geometry.getAttribute("position");
      const normal = model.geometry.getAttribute("normal");
      const bounds = model.geometry.boundingBox;
      expect(model.geometry.index).toBeNull();
      expect(position.count).toBeGreaterThan(300);
      expect(normal.count).toBe(position.count);
      expect(bounds).not.toBeNull();
      expect(bounds?.min.toArray().every(Number.isFinite)).toBe(true);
      expect(bounds?.max.toArray().every(Number.isFinite)).toBe(true);
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

  it("keeps a taller silhouette for angelfish than sardine", () => {
    const sardine = createProceduralFishModel("sardine");
    const angelfish = createProceduralFishModel("angelfish");
    const sardineSize = sardine.geometry.boundingBox!.getSize(new THREE.Vector3());
    const angelfishSize = angelfish.geometry.boundingBox!.getSize(new THREE.Vector3());

    expect(angelfishSize.z / angelfishSize.x).toBeGreaterThan(
      sardineSize.z / sardineSize.x,
    );

    sardine.geometry.dispose();
    sardine.material.dispose();
    angelfish.geometry.dispose();
    angelfish.material.dispose();
  });

  it("keeps natural proportions and dense vertex colors for the first fish group", () => {
    const sardine = createProceduralFishModel("sardine");
    const koi = createProceduralFishModel("koi");
    const clownfish = createProceduralFishModel("clownfish");
    const sardineSize = sardine.geometry.boundingBox!.getSize(new THREE.Vector3());
    const koiSize = koi.geometry.boundingBox!.getSize(new THREE.Vector3());
    const clownfishSize = clownfish.geometry.boundingBox!.getSize(new THREE.Vector3());

    expect(koiSize.x).toBeGreaterThan(sardineSize.x);
    expect(clownfishSize.y).toBeLessThan(sardineSize.y);
    for (const model of [sardine, koi, clownfish]) {
      expect(model.geometry.getAttribute("color").count).toBeGreaterThan(300);
      model.geometry.dispose();
      model.material.dispose();
    }
  });

  it("keeps intended silhouettes for the remaining natural species", () => {
    const angelfish = createProceduralFishModel("angelfish");
    const pufferfish = createProceduralFishModel("pufferfish");
    const starfish = createProceduralFishModel("starfish");
    const angelfishSize = angelfish.geometry.boundingBox!.getSize(new THREE.Vector3());
    const pufferSize = pufferfish.geometry.boundingBox!.getSize(new THREE.Vector3());
    const starSize = starfish.geometry.boundingBox!.getSize(new THREE.Vector3());

    expect(angelfishSize.z).toBeGreaterThan(angelfishSize.x * 1.2);
    expect(pufferSize.x).toBeGreaterThan(pufferSize.y * 0.7);
    expect(Math.abs(starSize.x - starSize.y)).toBeLessThan(0.15);
    for (const model of [angelfish, pufferfish, starfish]) {
      model.geometry.dispose();
      model.material.dispose();
    }
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
