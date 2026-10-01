import {
  calculateGrowth,
  DEFAULT_GROWTH_CONFIG,
} from "./calculator.js";
import type {
  FishGrowthConfig,
  FishGrowthRecord,
  FishGrowthSnapshot,
  GrowthStats,
} from "./types.js";

export interface FishGrowthRegistry {
  activate(speciesId: string, count: number): string[];
  deactivate(speciesId: string, count: number): void;
  advanceOnline(seconds: number, growthRateMultiplier?: number): void;
  applyOffline(seconds: number): void;
  getRecord(fishId: string): FishGrowthRecord | undefined;
  getRecords(speciesId?: string, includeInactive?: boolean): FishGrowthRecord[];
  getStats(speciesId?: string): GrowthStats;
  snapshot(savedAt?: number): FishGrowthSnapshot;
  replace(snapshot: FishGrowthSnapshot): void;
}

export interface FishGrowthRegistryOptions {
  now?: () => number;
  idFactory?: () => string;
  config?: FishGrowthConfig;
}

function copyRecord(record: FishGrowthRecord): FishGrowthRecord {
  return { ...record };
}

function safeCount(count: number): number {
  return Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
}

/** In-memory owner of stable individual fish records and their derived views. */
export function createFishGrowthRegistry(
  options: FishGrowthRegistryOptions = {},
): FishGrowthRegistry {
  const records = new Map<string, FishGrowthRecord>();
  const now = options.now ?? (() => Date.now());
  const config = options.config ?? DEFAULT_GROWTH_CONFIG;
  let idCounter = 0;

  const defaultIdFactory = (): string => {
    const randomUuid = globalThis.crypto?.randomUUID;
    if (typeof randomUuid === "function") return randomUuid.call(globalThis.crypto);
    idCounter += 1;
    return `fish-${idCounter}`;
  };
  const idFactory = options.idFactory ?? defaultIdFactory;

  const refresh = (record: FishGrowthRecord): void => {
    Object.assign(record, calculateGrowth(record.accumulatedAgeSeconds, config));
  };

  const createId = (): string => {
    let id = idFactory();
    while (!id || records.has(id)) id = defaultIdFactory();
    return id;
  };

  const activeForSpecies = (speciesId: string): FishGrowthRecord[] =>
    [...records.values()].filter((record) => record.speciesId === speciesId && record.active);

  return {
    activate(speciesId, count) {
      const target = safeCount(count);
      if (target === 0) return [];
      const selected: FishGrowthRecord[] = [];
      // Most recently deactivated records are reused first.
      const inactive = [...records.values()]
        .filter((record) => record.speciesId === speciesId && !record.active)
        .sort((a, b) => b.lastUpdatedAt - a.lastUpdatedAt || a.fishId.localeCompare(b.fishId));
      for (const record of inactive) {
        if (selected.length >= target) break;
        record.active = true;
        record.lastUpdatedAt = now();
        refresh(record);
        selected.push(record);
      }
      while (selected.length < target) {
        const timestamp = now();
        const record: FishGrowthRecord = {
          fishId: createId(),
          speciesId,
          bornAt: timestamp,
          accumulatedAgeSeconds: 0,
          lastUpdatedAt: timestamp,
          active: true,
          ...calculateGrowth(0, config),
        };
        records.set(record.fishId, record);
        selected.push(record);
      }
      return selected.map((record) => record.fishId);
    },

    deactivate(speciesId, count) {
      const target = safeCount(count);
      const candidates = activeForSpecies(speciesId)
        .sort((a, b) => a.accumulatedAgeSeconds - b.accumulatedAgeSeconds || a.fishId.localeCompare(b.fishId));
      const timestamp = now();
      for (const record of candidates.slice(0, target)) {
        record.active = false;
        record.lastUpdatedAt = timestamp;
      }
    },

    advanceOnline(seconds, growthRateMultiplier = 1) {
      if (!Number.isFinite(seconds) || seconds <= 0) return;
      const rate = Number.isFinite(growthRateMultiplier) ? Math.max(0, growthRateMultiplier) : 0;
      const elapsed = seconds * rate;
      if (elapsed <= 0) return;
      const timestamp = now();
      for (const record of records.values()) {
        if (!record.active) continue;
        record.accumulatedAgeSeconds += elapsed;
        record.lastUpdatedAt = timestamp;
        refresh(record);
      }
    },

    applyOffline(seconds) {
      if (!Number.isFinite(seconds) || seconds <= 0) return;
      const elapsed = Math.max(0, seconds);
      const timestamp = now();
      for (const record of records.values()) {
        if (!record.active) continue;
        record.accumulatedAgeSeconds += elapsed;
        record.lastUpdatedAt = timestamp;
        refresh(record);
      }
    },

    getRecord(fishId) {
      const record = records.get(fishId);
      return record ? copyRecord(record) : undefined;
    },

    getRecords(speciesId, includeInactive = false) {
      return [...records.values()]
        .filter((record) => (speciesId === undefined || record.speciesId === speciesId)
          && (includeInactive || record.active))
        .map(copyRecord);
    },

    getStats(speciesId) {
      const active = [...records.values()].filter((record) => record.active
        && (speciesId === undefined || record.speciesId === speciesId));
      const averageProgress = active.length === 0
        ? 0
        : active.reduce((sum, record) => sum + record.growthProgress, 0) / active.length;
      return {
        activeCount: active.length,
        juvenileCount: active.filter((record) => record.stage === "juvenile").length,
        growingCount: active.filter((record) => record.stage === "growing").length,
        adultCount: active.filter((record) => record.stage === "adult").length,
        averageProgress,
      };
    },

    snapshot(savedAt = now()) {
      return {
        schemaVersion: 1,
        savedAt,
        records: [...records.values()].map(copyRecord),
      };
    },

    replace(snapshot) {
      records.clear();
      for (const source of snapshot.records ?? []) {
        if (!source || !source.fishId || records.has(source.fishId)) continue;
        const record: FishGrowthRecord = {
          fishId: source.fishId,
          speciesId: source.speciesId,
          bornAt: Number.isFinite(source.bornAt) ? source.bornAt : now(),
          accumulatedAgeSeconds: Number.isFinite(source.accumulatedAgeSeconds)
            ? Math.max(0, source.accumulatedAgeSeconds) : 0,
          lastUpdatedAt: Number.isFinite(source.lastUpdatedAt) ? source.lastUpdatedAt : now(),
          active: Boolean(source.active),
          ...calculateGrowth(source.accumulatedAgeSeconds, config),
        };
        records.set(record.fishId, record);
      }
    },
  };
}
