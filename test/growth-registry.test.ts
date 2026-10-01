import { describe, expect, it } from "vitest";
import { createFishGrowthRegistry } from "../src/growth/registry.js";

describe("fish growth registry", () => {
  it("creates unique IDs and only creates missing records on a second activation", () => {
    let nextId = 0;
    const registry = createFishGrowthRegistry({ idFactory: () => `fish-${++nextId}` });
    const first = registry.activate("clownfish", 2);
    const second = registry.activate("clownfish", 1);

    expect(first).toHaveLength(2);
    expect(new Set([...first, ...second]).size).toBe(3);
    expect(registry.getRecords("clownfish")).toHaveLength(3);
  });

  it("deactivates the youngest records and reuses inactive IDs first", () => {
    let clock = 1_000;
    let nextId = 0;
    const registry = createFishGrowthRegistry({
      now: () => clock,
      idFactory: () => `fish-${++nextId}`,
    });
    const ids = registry.activate("tetra", 3);
    registry.advanceOnline(60);
    clock += 1;
    registry.deactivate("tetra", 2);
    const inactive = registry.getRecords("tetra", true).filter((record) => !record.active);
    expect(inactive).toHaveLength(2);
    expect(inactive.map((record) => record.fishId)).toContain(ids[0]);
    expect(inactive.map((record) => record.fishId)).toContain(ids[1]);

    const reused = registry.activate("tetra", 2);
    expect(new Set(reused)).toEqual(new Set(inactive.map((record) => record.fishId)));
    expect(registry.activate("tetra", 1)).toEqual([ids[3] ?? "fish-4"]);
  });

  it("advances only active records and applies capped offline time supplied by the caller", () => {
    const registry = createFishGrowthRegistry({ idFactory: (() => {
      let index = 0;
      return () => `fish-${++index}`;
    })() });
    registry.activate("guppy", 1);
    registry.activate("guppy", 1);
    registry.deactivate("guppy", 1);
    const activeId = registry.getRecords("guppy").find((record) => record.active)!.fishId;
    const inactiveId = registry.getRecords("guppy", true).find((record) => !record.active)!.fishId;
    registry.advanceOnline(30, 2);
    registry.applyOffline(24 * 60 * 60);
    expect(registry.getRecord(activeId)!.accumulatedAgeSeconds).toBe(24 * 60 * 60 + 60);
    expect(registry.getRecord(inactiveId)!.accumulatedAgeSeconds).toBe(0);
  });

  it("snapshots active and inactive records and recomputes derived fields on replace", () => {
    let nextId = 0;
    const registry = createFishGrowthRegistry({ idFactory: () => `fish-${++nextId}` });
    registry.activate("angelfish", 2);
    registry.advanceOnline(90 * 60);
    registry.deactivate("angelfish", 1);
    const snapshot = registry.snapshot(1234);
    expect(snapshot.records).toHaveLength(2);
    expect(snapshot.records.some((record) => !record.active)).toBe(true);

    const restored = createFishGrowthRegistry({ idFactory: () => `new-${++nextId}` });
    restored.replace({
      ...snapshot,
      records: snapshot.records.map((record) => ({ ...record, stage: "juvenile", growthProgress: 0, sizeMultiplier: 0.55 })),
    });
    const restoredRecord = restored.getRecords("angelfish", true).find((record) => record.active)!;
    expect(restoredRecord.stage).toBe("adult");
    expect(restoredRecord.growthProgress).toBeGreaterThan(0);
    expect(restoredRecord.sizeMultiplier).toBeGreaterThan(0.55);
  });
});
