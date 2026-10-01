import { assert, describe, it } from "vitest";
import { createAquariumManager } from "../src/aquarium/manager.js";
import { DEFAULT_STYLE } from "../src/aquarium/presets.js";

const mockDeps = {
  renderer: {} as never,
  scene: {} as never,
  cameraRig: { configure: () => {} },
};

describe("aquarium manager growth integration", () => {
  it("activates one record for every initial fish", () => {
    const manager = createAquariumManager(DEFAULT_STYLE, mockDeps);
    const registry = manager.getGrowthRegistry();
    assert.strictEqual(registry.getStats().activeCount, 102);
    assert.strictEqual(registry.getStats("sardine").activeCount, 60);
  });

  it("deactivates youngest fish and reuses their IDs when restoring count", () => {
    const manager = createAquariumManager(DEFAULT_STYLE, mockDeps);
    const registry = manager.getGrowthRegistry();
    const before = registry.getRecords("sardine").map((record) => record.fishId);
    registry.advanceOnline(60);
    manager.setFishCount("sardine", 58);
    assert.strictEqual(registry.getStats("sardine").activeCount, 58);
    manager.setFishCount("sardine", 60);
    const after = registry.getRecords("sardine").map((record) => record.fishId);
    assert.deepStrictEqual(new Set(after), new Set(before));
  });

  it("advances active records and leaves the registry alive after dispose", () => {
    const manager = createAquariumManager(DEFAULT_STYLE, mockDeps);
    const registry = manager.getGrowthRegistry();
    const id = registry.getRecords("sardine")[0].fishId;
    manager.update(1, 30);
    assert.strictEqual(registry.getRecord(id)!.accumulatedAgeSeconds, 30);
    manager.dispose();
    assert.ok(manager.getGrowthRegistry().getRecord(id));
  });
});
