/** The three visible phases of an individual fish's growth. */
export type FishGrowthStage = "juvenile" | "growing" | "adult";

/** Configuration shared by the first version of the growth system. */
export interface FishGrowthConfig {
  /** Size relative to a fully mature fish at birth. */
  juvenileScale: number;
  /** Age at which a juvenile enters the growing phase. */
  juvenileEndSeconds: number;
  /** Age at which the adult phase begins. */
  adultStartSeconds: number;
  /** Age at which the fish reaches its full size. */
  matureSeconds: number;
}

/** Derived values used by the simulation and growth UI. */
export interface FishGrowthView {
  stage: FishGrowthStage;
  growthProgress: number;
  sizeMultiplier: number;
}

/** Persisted state for one individual fish. */
export interface FishGrowthRecord extends FishGrowthView {
  fishId: string;
  speciesId: string;
  bornAt: number;
  accumulatedAgeSeconds: number;
  lastUpdatedAt: number;
  active: boolean;
}

/** Versioned, serializable growth state. */
export interface FishGrowthSnapshot {
  schemaVersion: 1;
  savedAt: number;
  records: FishGrowthRecord[];
}

/** Aggregate values for active records. */
export interface GrowthStats {
  activeCount: number;
  juvenileCount: number;
  growingCount: number;
  adultCount: number;
  averageProgress: number;
}

