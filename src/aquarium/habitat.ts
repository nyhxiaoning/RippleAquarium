import type { Vec3 } from "./types.js";

/** Spatial zones used by fish and ecological organisms. */
export type HabitatLayer = "upper" | "middle" | "lower" | "reef";

export interface HabitatRegion {
  layer: HabitatLayer;
  min: Vec3;
  max: Vec3;
}

function positiveHalfSize(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0.001;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function region(
  layer: HabitatLayer,
  halfSize: { x: number; y: number; z: number },
  minY: number,
  maxY: number,
): HabitatRegion {
  const horizontalInset = Math.min(0.45, halfSize.x * 0.08, halfSize.z * 0.08);
  return {
    layer,
    min: {
      x: -halfSize.x + horizontalInset,
      y: clamp(minY, -halfSize.y, halfSize.y),
      z: -halfSize.z + horizontalInset,
    },
    max: {
      x: halfSize.x - horizontalInset,
      y: clamp(maxY, -halfSize.y, halfSize.y),
      z: halfSize.z - horizontalInset,
    },
  };
}

/**
 * Create normalized vertical habitat zones for the current tank size.
 *
 * The default tank (14, 8, 11) maps to the authored ranges upper 2..7.2,
 * middle -2..2, and lower -7.2..-2. Other tank sizes preserve those relative
 * proportions while remaining inside the glass bounds.
 */
export function createHabitatLayout(
  halfSize: Vec3,
): Readonly<Record<HabitatLayer, HabitatRegion>> {
  const x = positiveHalfSize(halfSize.x);
  const y = positiveHalfSize(halfSize.y);
  const z = positiveHalfSize(halfSize.z);

  // The authored values above correspond to these fractions of the half-height.
  const middle = y * 0.25;
  const waterInterior = y * 0.9;
  const layout = {
    upper: region("upper", { x, y, z }, middle, waterInterior),
    middle: region("middle", { x, y, z }, -middle, middle),
    lower: region("lower", { x, y, z }, -waterInterior, -middle),
    // Reef life occupies a bottom band. sampleHabitatPoint chooses one of the
    // two side reefs so callers can use one rectangular region safely.
    reef: region("reef", { x, y, z }, -waterInterior, -y * 0.62),
  } satisfies Record<HabitatLayer, HabitatRegion>;

  return layout;
}

function sampleAxis(min: number, max: number, random: () => number, margin: number): number {
  const inset = Math.max(0, Number.isFinite(margin) ? margin : 0);
  const lower = min + inset;
  const upper = max - inset;
  if (lower >= upper) return (min + max) * 0.5;
  const candidate = random();
  const value = Number.isFinite(candidate) ? candidate : 0.5;
  return lower + (upper - lower) * clamp(value, 0, 1);
}

/** Sample a point inside a region, keeping the requested margin from its faces. */
export function sampleHabitatPoint(
  habitatRegion: HabitatRegion,
  random: () => number,
  margin = 0,
): Vec3 {
  const sample = () => sampleAxis(0, 1, random, 0);
  let minX = habitatRegion.min.x;
  let maxX = habitatRegion.max.x;

  if (habitatRegion.layer === "reef") {
    // Keep reef decoration on both sides of the tank while retaining a single
    // region interface for consumers.
    const side = sample() < 0.5 ? -1 : 1;
    const midpoint = (habitatRegion.min.x + habitatRegion.max.x) * 0.5;
    if (side < 0) maxX = midpoint - Math.max(0.6, margin);
    else minX = midpoint + Math.max(0.6, margin);
  }

  return {
    x: sampleAxis(minX, maxX, random, margin),
    y: sampleAxis(habitatRegion.min.y, habitatRegion.max.y, random, margin),
    z: sampleAxis(habitatRegion.min.z, habitatRegion.max.z, random, margin),
  };
}
