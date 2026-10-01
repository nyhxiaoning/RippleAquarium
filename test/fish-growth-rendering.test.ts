import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { FishSchoolSimulation } from "../src/fish-school-simulation.js";
import { createFishMesh, updateFishInstances } from "../src/fish-renderer.js";
import { fishConfig } from "../src/fish/config.js";
import type { SimulationSettings } from "../src/types.js";

const settings: SimulationSettings = {
  minSpeed: 0.5, maxSpeed: 1, maxTurnRate: 3, perceptionRadius: 3,
  avoidanceRadius: 1, maxSteerForce: 1, alignWeight: 1, cohesionWeight: 1,
  separateWeight: 1, boundsRadius: 1, avoidCollisionWeight: 1,
  collisionAvoidDistance: 1, boundaryWeight: 1, boundaryMargin: 1,
  topBoundaryMargin: 1, bottomBoundaryMargin: 1, horizontalBoundaryMargin: 1,
};

function makeSimulation() {
  return new FishSchoolSimulation({
    aquariumHalfSize: new THREE.Vector3(10, 6, 8),
    obstacles: [],
    settings,
  });
}

describe("fish identity and growth rendering", () => {
  it("keeps supplied IDs and surviving state when resizing a school", () => {
    const sim = makeSimulation();
    sim.reset(3, 7, ["a", "b", "c"]);
    const position = sim.fish[1].position.clone();

    sim.setCount(2, ["b", "a"]);
    expect(sim.fish.map((fish) => fish.fishId)).toEqual(["b", "a"]);
    expect(sim.fish[0].position.equals(position)).toBe(true);

    sim.setCount(3, ["b", "a", "d"]);
    expect(sim.fish.map((fish) => fish.fishId)).toEqual(["b", "a", "d"]);
  });

  it("multiplies the base instance scale when growth sizes are supplied", () => {
    const mesh = createFishMesh(1);
    const sim = makeSimulation();
    sim.reset(1, 3, ["fish-a"]);

    updateFishInstances(mesh, sim.fish);
    const base = new THREE.Vector3();
    mesh.getMatrixAt(0, new THREE.Matrix4()).decompose(new THREE.Vector3(), new THREE.Quaternion(), base);
    expect(base.x).toBeCloseTo(fishConfig.renderScale);

    updateFishInstances(mesh, sim.fish, [0.55]);
    const scaled = new THREE.Vector3();
    mesh.getMatrixAt(0, new THREE.Matrix4()).decompose(new THREE.Vector3(), new THREE.Quaternion(), scaled);
    expect(scaled.x).toBeCloseTo(fishConfig.renderScale * 0.55);
    mesh.geometry.dispose();
    if (Array.isArray(mesh.material)) mesh.material.forEach((material) => material.dispose());
    else mesh.material.dispose();
  });
});
