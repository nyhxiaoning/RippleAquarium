import { assert, afterEach, describe, it } from "vitest";
import { createAquariumManager } from "../src/aquarium/manager.js";
import { DEFAULT_STYLE } from "../src/aquarium/presets.js";

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, String(value)); }
}

const mockDeps = {
  renderer: {} as never,
  scene: {} as never,
  cameraRig: { configure: () => {} },
};

afterEach(() => {
  delete (globalThis as { localStorage?: Storage }).localStorage;
});

describe("growth manager persistence APIs", () => {
  it("loads offline growth with the 24-hour cap and exports the snapshot", () => {
    const storage = new MemoryStorage();
    Object.defineProperty(globalThis, "localStorage", { configurable: true, value: storage });
    const source = createAquariumManager(DEFAULT_STYLE, mockDeps);
    source.saveGrowth();
    const saved = JSON.parse(storage.getItem("rippleAquariumFishGrowth")!);
    saved.savedAt = Date.now() - 48 * 60 * 60 * 1000;
    storage.setItem("rippleAquariumFishGrowth", JSON.stringify(saved));

    const manager = createAquariumManager(DEFAULT_STYLE, mockDeps);
    const result = manager.loadGrowth();
    assert.strictEqual(result.status, "loaded");
    assert.strictEqual(manager.getGrowthRecords("sardine")[0].accumulatedAgeSeconds, 24 * 60 * 60);
    assert.ok(manager.exportGrowth().endsWith("\n"));
  });

  it("reports storage unavailability without throwing", () => {
    const manager = createAquariumManager(DEFAULT_STYLE, mockDeps);
    assert.strictEqual(manager.saveGrowth(), "unavailable");
    assert.strictEqual(manager.resetGrowth(), "unavailable");
  });
});
