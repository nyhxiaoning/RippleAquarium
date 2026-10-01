import type { FishGrowthRecord, FishGrowthSnapshot, FishGrowthStage } from "./types.js";

export const GROWTH_STORAGE_KEY = "rippleAquariumFishGrowth";

export type GrowthStorageStatus = "empty" | "loaded" | "recovered" | "unavailable";

export interface GrowthLoadResult {
  snapshot: FishGrowthSnapshot | null;
  status: GrowthStorageStatus;
}

const STAGES: ReadonlySet<FishGrowthStage> = new Set(["juvenile", "growing", "adult"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isValidRecord(value: unknown): value is FishGrowthRecord {
  if (!isRecord(value)) return false;
  return (
    typeof value.fishId === "string" && value.fishId.length > 0 &&
    typeof value.speciesId === "string" && value.speciesId.length > 0 &&
    isFiniteNumber(value.bornAt) &&
    isFiniteNumber(value.accumulatedAgeSeconds) && value.accumulatedAgeSeconds >= 0 &&
    isFiniteNumber(value.lastUpdatedAt) &&
    typeof value.active === "boolean" &&
    STAGES.has(value.stage as FishGrowthStage) &&
    isFiniteNumber(value.growthProgress) && value.growthProgress >= 0 && value.growthProgress <= 1 &&
    isFiniteNumber(value.sizeMultiplier) && value.sizeMultiplier >= 0
  );
}

function isValidSnapshot(value: unknown): value is FishGrowthSnapshot {
  if (!isRecord(value) || value.schemaVersion !== 1 || !isFiniteNumber(value.savedAt)) {
    return false;
  }
  if (!Array.isArray(value.records)) return false;

  const ids = new Set<string>();
  for (const record of value.records) {
    if (!isValidRecord(record) || ids.has(record.fishId)) return false;
    ids.add(record.fishId);
  }
  return true;
}

function serializeSnapshot(snapshot: FishGrowthSnapshot): string {
  return JSON.stringify(snapshot);
}

function backupKey(now: number): string {
  return `${GROWTH_STORAGE_KEY}.corrupt.${Number.isFinite(now) ? now : Date.now()}`;
}

/** Load and validate the current growth snapshot without allowing storage errors to escape. */
export function loadGrowthSnapshot(storage: Storage, now: number): GrowthLoadResult {
  let raw: string | null;
  try {
    raw = storage.getItem(GROWTH_STORAGE_KEY);
  } catch {
    return { snapshot: null, status: "unavailable" };
  }

  if (raw === null) return { snapshot: null, status: "empty" };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = null;
  }

  if (isValidSnapshot(parsed)) return { snapshot: parsed, status: "loaded" };

  // Keep the bad payload for diagnostics, then clear the active key so the next
  // save can recover cleanly. If either operation fails, callers must treat the
  // storage as unavailable rather than silently losing the original payload.
  try {
    storage.setItem(backupKey(now), raw);
    storage.removeItem(GROWTH_STORAGE_KEY);
  } catch {
    return { snapshot: null, status: "unavailable" };
  }
  return { snapshot: null, status: "recovered" };
}

/** Persist a validated snapshot. Storage failures are reported to the caller. */
export function saveGrowthSnapshot(
  storage: Storage,
  snapshot: FishGrowthSnapshot,
): "saved" | "unavailable" {
  if (!isValidSnapshot(snapshot)) return "unavailable";
  try {
    storage.setItem(GROWTH_STORAGE_KEY, serializeSnapshot(snapshot));
    return "saved";
  } catch {
    return "unavailable";
  }
}

/** Return a stable, downloadable representation of a growth snapshot. */
export function exportGrowthSnapshot(snapshot: FishGrowthSnapshot): string {
  return `${serializeSnapshot(snapshot)}\n`;
}

export function clearGrowthSnapshot(storage: Storage): "cleared" | "unavailable" {
  try {
    storage.removeItem(GROWTH_STORAGE_KEY);
    return "cleared";
  } catch {
    return "unavailable";
  }
}
