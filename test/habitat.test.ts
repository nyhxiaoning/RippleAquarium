import { assert, describe, it } from "vitest";
import { DEFAULT_STYLE } from "../src/aquarium/presets.js";
import {
  createHabitatLayout,
  sampleHabitatPoint,
  type HabitatLayer,
  type HabitatRegion,
} from "../src/aquarium/habitat.js";

describe("habitat layout", () => {
  it("uses the expanded default aquarium bounds", () => {
    assert.deepStrictEqual(DEFAULT_STYLE.aquarium.halfSize, { x: 14, y: 8, z: 11 });
  });

  it("maps the authored default vertical layers", () => {
    const layout = createHabitatLayout(DEFAULT_STYLE.aquarium.halfSize);
    assert.deepStrictEqual(
      { min: layout.upper.min.y, max: layout.upper.max.y },
      { min: 2, max: 7.2 },
    );
    assert.deepStrictEqual(
      { min: layout.middle.min.y, max: layout.middle.max.y },
      { min: -2, max: 2 },
    );
    assert.deepStrictEqual(
      { min: layout.lower.min.y, max: layout.lower.max.y },
      { min: -7.2, max: -2 },
    );
  });

  it("keeps every resized region inside the tank", () => {
    for (const halfSize of [
      { x: 1.2, y: 1.1, z: 0.8 },
      { x: 5, y: 3.5, z: 4 },
      { x: 22, y: 12, z: 18 },
    ]) {
      const layout = createHabitatLayout(halfSize);
      for (const region of Object.values(layout)) {
        assert.ok(region.min.x >= -halfSize.x);
        assert.ok(region.max.x <= halfSize.x);
        assert.ok(region.min.y >= -halfSize.y);
        assert.ok(region.max.y <= halfSize.y);
        assert.ok(region.min.z >= -halfSize.z);
        assert.ok(region.max.z <= halfSize.z);
      }
    }
  });

  it("samples points within a region and requested margin", () => {
    const layout = createHabitatLayout({ x: 14, y: 8, z: 11 });
    const margin = 0.4;
    const values = [0.05, 0.25, 0.5, 0.75, 0.95];
    let index = 0;
    const random = () => values[index++ % values.length];

    for (const layer of ["upper", "middle", "lower", "reef"] as HabitatLayer[]) {
      const region: HabitatRegion = layout[layer];
      for (let i = 0; i < 20; i += 1) {
        const point = sampleHabitatPoint(region, random, margin);
        assert.ok(point.x >= region.min.x + margin - 1e-8);
        assert.ok(point.x <= region.max.x - margin + 1e-8);
        assert.ok(point.y >= region.min.y + margin - 1e-8);
        assert.ok(point.y <= region.max.y - margin + 1e-8);
        assert.ok(point.z >= region.min.z + margin - 1e-8);
        assert.ok(point.z <= region.max.z - margin + 1e-8);
      }
    }
  });
});
