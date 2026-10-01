import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { createHabitatLayout, type HabitatRegion } from "../src/aquarium/habitat.js";
import { FishSchoolSimulation } from "../src/fish-school-simulation.js";

const settings = {
  minSpeed: 2,
  maxSpeed: 6,
  maxTurnRate: 4,
  perceptionRadius: 2.7,
  avoidanceRadius: 1,
  maxSteerForce: 3,
  alignWeight: 1,
  cohesionWeight: 1,
  separateWeight: 1.35,
  boundsRadius: 0.27,
  avoidCollisionWeight: 10,
  collisionAvoidDistance: 2,
  boundaryWeight: 9,
  boundaryMargin: 1,
  topBoundaryMargin: 0.42,
  bottomBoundaryMargin: 1,
  horizontalBoundaryMargin: 1,
};

function makeSimulation(region?: HabitatRegion) {
  return new FishSchoolSimulation({
    aquariumHalfSize: new THREE.Vector3(14, 8, 11),
    obstacles: [],
    settings,
    allowedRegion: region,
  });
}

function expectInside(sim: FishSchoolSimulation, region: HabitatRegion) {
  for (const fish of sim.fish) {
    expect(fish.position.x).toBeGreaterThanOrEqual(region.min.x - 1e-8);
    expect(fish.position.x).toBeLessThanOrEqual(region.max.x + 1e-8);
    expect(fish.position.y).toBeGreaterThanOrEqual(region.min.y - 1e-8);
    expect(fish.position.y).toBeLessThanOrEqual(region.max.y + 1e-8);
    expect(fish.position.z).toBeGreaterThanOrEqual(region.min.z - 1e-8);
    expect(fish.position.z).toBeLessThanOrEqual(region.max.z + 1e-8);
  }
}

describe("habitat-aware fish schools", () => {
  it("spawns and updates every fish inside its allowed middle region", () => {
    const region = createHabitatLayout({ x: 14, y: 8, z: 11 }).middle;
    const sim = makeSimulation(region);
    sim.reset(80, 23);
    expectInside(sim, region);

    for (let step = 0; step < 180; step += 1) sim.update(1 / 30);
    expectInside(sim, region);
  });

  it("keeps existing members in the region after count changes and resize", () => {
    const layout = createHabitatLayout({ x: 14, y: 8, z: 11 });
    const sim = makeSimulation(layout.lower);
    sim.reset(30, 11);
    sim.setCount(60);
    expectInside(sim, layout.lower);

    // The old region is intersected with the new tank bounds by setBounds.
    sim.setBounds(new THREE.Vector3(7, 4, 5.5));
    for (let step = 0; step < 40; step += 1) sim.update(1 / 60);
    expectInside(sim, layout.lower);
    for (const fish of sim.fish) {
      expect(Math.abs(fish.position.x)).toBeLessThanOrEqual(7 + 1e-8);
      expect(Math.abs(fish.position.y)).toBeLessThanOrEqual(4 + 1e-8);
      expect(Math.abs(fish.position.z)).toBeLessThanOrEqual(5.5 + 1e-8);
    }
  });

  it("can switch a school's region without recreating fish", () => {
    const layout = createHabitatLayout({ x: 14, y: 8, z: 11 });
    const sim = makeSimulation(layout.upper);
    sim.reset(12, 9, ["fish-a", "fish-b"]);
    const ids = sim.fish.map((fish) => fish.fishId);
    sim.setAllowedRegion(layout.middle);
    expect(sim.fish.map((fish) => fish.fishId)).toEqual(ids);
    expectInside(sim, layout.middle);
  });

  it("keeps schools without a region on full-tank bounds", () => {
    const sim = makeSimulation();
    sim.reset(32, 5);
    for (let step = 0; step < 90; step += 1) sim.update(1 / 60);
    for (const fish of sim.fish) {
      expect(Math.abs(fish.position.x)).toBeLessThanOrEqual(14 + 1e-8);
      expect(Math.abs(fish.position.y)).toBeLessThanOrEqual(8 + 1e-8);
      expect(Math.abs(fish.position.z)).toBeLessThanOrEqual(11 + 1e-8);
    }
  });
});
