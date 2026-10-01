import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { createReefVariant } from "../src/coral-reef.js";
import { createSeaweedVariant } from "../src/aquarium/species-catalog.js";
import { createClownfishSchool } from "../src/clownfish-school.js";

describe("reef diversity", () => {
  it("selects coral families deterministically while covering the three shapes", () => {
    const first = Array.from({ length: 9 }, (_, index) => createReefVariant(index, 41));
    const second = Array.from({ length: 9 }, (_, index) => createReefVariant(index, 41));

    expect(second).toEqual(first);
    expect(new Set(first)).toEqual(new Set(["branch", "brain", "plate"]));
    expect(createReefVariant(0, 41)).not.toBe(createReefVariant(1, 41));
  });

  it("gives seaweed stable height, color and phase variation", () => {
    const first = Array.from({ length: 12 }, (_, index) => createSeaweedVariant(index, 17));
    const second = Array.from({ length: 12 }, (_, index) => createSeaweedVariant(index, 17));

    expect(second).toEqual(first);
    expect(new Set(first.map((item) => item.height)).size).toBeGreaterThan(1);
    expect(new Set(first.map((item) => item.color)).size).toBeGreaterThan(1);
    expect(new Set(first.map((item) => item.phase)).size).toBeGreaterThan(1);
  });

  it("spawns clownfish around coral and anemone anchors", () => {
    const coralAnchor = new THREE.Vector3(-2, -7, -1);
    const anemoneAnchor = new THREE.Vector3(3, -7, 2);
    const school = createClownfishSchool(
      { corals: [{ visible: true, position: coralAnchor, scale: 1 }] },
      { count: 6, seed: 11, avoidanceZones: [], anemonePositions: [anemoneAnchor] },
    );

    const positions: THREE.Vector3[] = [];
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    for (let index = 0; index < school.mesh.count; index += 1) {
      school.mesh.getMatrixAt(index, matrix);
      matrix.decompose(position, quaternion, scale);
      positions.push(position.clone());
    }

    expect(positions.some((position) => position.distanceTo(coralAnchor) < 1.4)).toBe(true);
    expect(positions.some((position) => position.distanceTo(anemoneAnchor) < 1.4)).toBe(true);
    school.dispose();
  });
});
