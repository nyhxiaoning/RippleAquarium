import { describe, expect, it } from "vitest";
import {
  GROWTH_STORAGE_KEY,
  clearGrowthSnapshot,
  exportGrowthSnapshot,
  loadGrowthSnapshot,
  saveGrowthSnapshot,
} from "../src/growth/storage.js";
import type { FishGrowthSnapshot } from "../src/growth/types.js";

class FakeStorage implements Storage {
  readonly data = new Map<string, string>();
  throwOnAccess = false;

  get length(): number { return this.data.size; }
  clear(): void { this.data.clear(); }
  getItem(key: string): string | null {
    if (this.throwOnAccess) throw new Error("storage unavailable");
    return this.data.get(key) ?? null;
  }
  key(index: number): string | null { return [...this.data.keys()][index] ?? null; }
  removeItem(key: string): void {
    if (this.throwOnAccess) throw new Error("storage unavailable");
    this.data.delete(key);
  }
  setItem(key: string, value: string): void {
    if (this.throwOnAccess) throw new Error("storage unavailable");
    this.data.set(key, value);
  }
}

const snapshot: FishGrowthSnapshot = {
  schemaVersion: 1,
  savedAt: 1000,
  records: [{
    fishId: "fish-1",
    speciesId: "clownfish",
    bornAt: 500,
    accumulatedAgeSeconds: 10,
    lastUpdatedAt: 1000,
    active: true,
    stage: "juvenile",
    growthProgress: 0,
    sizeMultiplier: 0.55,
  }],
};

describe("growth storage", () => {
  it("saves and loads a validated snapshot", () => {
    const storage = new FakeStorage();
    expect(saveGrowthSnapshot(storage, snapshot)).toBe("saved");
    expect(loadGrowthSnapshot(storage, 2000)).toEqual({ snapshot, status: "loaded" });
  });

  it("backs up malformed snapshots before recovering", () => {
    const storage = new FakeStorage();
    storage.setItem(GROWTH_STORAGE_KEY, "not-json");
    expect(loadGrowthSnapshot(storage, 1234)).toEqual({ snapshot: null, status: "recovered" });
    expect(storage.data.get(`${GROWTH_STORAGE_KEY}.corrupt.1234`)).toBe("not-json");
    expect(storage.getItem(GROWTH_STORAGE_KEY)).toBeNull();
  });

  it("rejects duplicate IDs, invalid values, and future schema versions", () => {
    const storage = new FakeStorage();
    const duplicate = { ...snapshot, records: [snapshot.records[0], snapshot.records[0]] };
    storage.setItem(GROWTH_STORAGE_KEY, JSON.stringify(duplicate));
    expect(loadGrowthSnapshot(storage, 2000).status).toBe("recovered");

    storage.setItem(GROWTH_STORAGE_KEY, JSON.stringify({ ...snapshot, schemaVersion: 2 }));
    expect(loadGrowthSnapshot(storage, 3000).status).toBe("recovered");
  });

  it("reports unavailable storage and exports deterministic JSON", () => {
    const storage = new FakeStorage();
    storage.throwOnAccess = true;
    expect(loadGrowthSnapshot(storage, 1000)).toEqual({ snapshot: null, status: "unavailable" });
    expect(saveGrowthSnapshot(storage, snapshot)).toBe("unavailable");
    expect(clearGrowthSnapshot(storage)).toBe("unavailable");
    expect(exportGrowthSnapshot(snapshot)).toBe(`${JSON.stringify(snapshot)}\n`);
  });
});
