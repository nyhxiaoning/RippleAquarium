import type { FishGrowthConfig, FishGrowthStage, FishGrowthView } from "./types.js";

export const DEFAULT_GROWTH_CONFIG: FishGrowthConfig = {
  juvenileScale: 0.55,
  juvenileEndSeconds: 20 * 60,
  adultStartSeconds: 80 * 60,
  matureSeconds: 120 * 60,
};

function smoothstep(value: number): number {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
}

/** Calculate the display and rendering values for an age in seconds. */
export function calculateGrowth(
  ageSeconds: number,
  config: FishGrowthConfig = DEFAULT_GROWTH_CONFIG,
): FishGrowthView {
  const age = Number.isFinite(ageSeconds) ? Math.max(0, ageSeconds) : 0;
  const juvenileEnd = Math.max(0, config.juvenileEndSeconds);
  const adultStart = Math.max(juvenileEnd, config.adultStartSeconds);
  const mature = Math.max(adultStart, config.matureSeconds);
  const juvenileScale = Number.isFinite(config.juvenileScale)
    ? Math.max(0, Math.min(1, config.juvenileScale))
    : DEFAULT_GROWTH_CONFIG.juvenileScale;

  let stage: FishGrowthStage;
  if (age < juvenileEnd) stage = "juvenile";
  else if (age < adultStart) stage = "growing";
  else stage = "adult";

  const progress = mature === juvenileEnd
    ? age >= mature ? 1 : 0
    : smoothstep((age - juvenileEnd) / (mature - juvenileEnd));
  const sizeMultiplier = juvenileScale + (1 - juvenileScale) * progress;

  return {
    stage,
    growthProgress: progress,
    sizeMultiplier,
  };
}

/** Return a safe offline duration, with timestamps in milliseconds. */
export function clampOfflineSeconds(
  savedAt: number,
  now: number,
  maxSeconds: number,
): number {
  if (!Number.isFinite(savedAt) || !Number.isFinite(now) || now <= savedAt) return 0;
  const cap = Number.isFinite(maxSeconds) ? Math.max(0, maxSeconds) : 0;
  return Math.min((now - savedAt) / 1000, cap);
}

