import * as THREE from "three";
import { assert, describe, it } from "vitest";
import { createHabitatLayout } from "../src/aquarium/habitat.js";
import { createEcologySchool, ECOLOGY_CATALOG, getEcologyMeta } from "../src/ecology/catalog.js";
import type { EcologyKind } from "../src/ecology/types.js";

const halfSize = new THREE.Vector3(14, 8, 11);
const deps = {
  aquariumHalfSize: halfSize,
  waterLevelY: 7.28,
  aquariumFloorY: -8,
  habitat: createHabitatLayout({ x: 14, y: 8, z: 11 }),
  seed: 17,
};

function firstPosition(handle: ReturnType<typeof createEcologySchool>): THREE.Vector3 {
  const mesh = handle!.group.children[0] as THREE.InstancedMesh;
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  mesh.getMatrixAt(0, matrix);
  matrix.decompose(position, new THREE.Quaternion(), new THREE.Vector3());
  return position;
}

describe("procedural ecology catalog", () => {
  it("describes all four supported organisms", () => {
    assert.deepStrictEqual(ECOLOGY_CATALOG.map((entry) => entry.id), ["anemone", "urchin", "shell", "jellyfish"]);
    assert.strictEqual(getEcologyMeta("missing"), undefined);
    assert.strictEqual(getEcologyMeta("jellyfish")?.category, "ecology");
  });

  it("clamps requested counts to each catalog capacity", () => {
    for (const kind of ECOLOGY_CATALOG.map((entry) => entry.id)) {
      const meta = getEcologyMeta(kind)!;
      const school = createEcologySchool(kind, meta.maxCount + 100, deps);
      assert.ok(school);
      assert.strictEqual(school.getCount(), meta.maxCount);
      school.setCount(-4);
      assert.strictEqual(school.getCount(), 0);
      school.dispose();
    }
  });

  it("places organisms in their configured habitat layers", () => {
    const layout = deps.habitat;
    const ranges: Record<EcologyKind, { min: number; max: number }> = {
      anemone: { min: layout.reef.min.y, max: layout.reef.max.y },
      urchin: { min: layout.lower.min.y, max: layout.lower.max.y },
      shell: { min: layout.lower.min.y, max: layout.lower.max.y },
      jellyfish: { min: layout.upper.min.y, max: layout.upper.max.y },
    };
    for (const kind of Object.keys(ranges) as EcologyKind[]) {
      const school = createEcologySchool(kind, 1, deps)!;
      const position = firstPosition(school);
      assert.ok(position.y >= ranges[kind].min - 1e-6);
      assert.ok(position.y <= ranges[kind].max + 1e-6);
      school.dispose();
    }
  });

  it("updates, resizes, and safely disposes shared resources", () => {
    const first = createEcologySchool("jellyfish", 2, deps)!;
    const second = createEcologySchool("jellyfish", 2, deps)!;
    first.update(2.5, 1 / 60);
    first.resize(new THREE.Vector3(5, 3.5, 4));
    first.dispose();
    // The second school still owns the pooled geometry after the first release.
    second.update(3, 1 / 60);
    second.dispose();
    second.dispose();
  });
});
