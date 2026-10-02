import * as THREE from "three";
import type { WeatherEffects } from "./types.js";

/** Number of snowflakes kept in the single draw call. */
export const SNOW_PARTICLE_COUNT = 180;

/**
 * The weather effects interface grows over time, so keep this boundary
 * backwards-compatible with descriptors created before snow was introduced.
 * A missing intensity is treated as zero (no precipitation).
 */
type SnowWeatherEffects = WeatherEffects & {
  readonly snowIntensity?: number;
};

export interface WeatherPrecipitationHandle {
  readonly points: THREE.Points;
  setWeatherEffects(effects: SnowWeatherEffects): void;
  update(time: number): void;
  resize(halfSize: THREE.Vector3): void;
  dispose(): void;
}

interface SnowSeed {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly phase: number;
  readonly speed: number;
  readonly drift: number;
}

function seededUnit(index: number, channel: number): number {
  // A small integer hash gives stable positions without maintaining mutable
  // random state. This makes screenshots and tests repeatable across reloads.
  const value = Math.sin((index + 1) * 12.9898 + channel * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

function finiteTime(time: number): number {
  return Number.isFinite(time) ? time : 0;
}

function wrap(value: number, min: number, length: number): number {
  const offset = value - min;
  return min + ((offset % length) + length) % length;
}

/**
 * Create deterministic, GPU-friendly snow. The effect owns one Points draw
 * call and updates only its position attribute, so it remains inexpensive
 * even when the aquarium contains many fish instances.
 */
export function createWeatherPrecipitation(
  scene: THREE.Object3D,
  initialHalfSize: THREE.Vector3,
): WeatherPrecipitationHandle {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(SNOW_PARTICLE_COUNT * 3);
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

  const material = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 0.09,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  const points = new THREE.Points(geometry, material);
  points.name = "WeatherSnow";
  points.frustumCulled = false;
  points.visible = false;
  scene.add(points);

  const seeds: SnowSeed[] = [];
  for (let index = 0; index < SNOW_PARTICLE_COUNT; index += 1) {
    seeds.push({
      x: seededUnit(index, 0) * 2 - 1,
      y: seededUnit(index, 1),
      z: seededUnit(index, 2) * 2 - 1,
      phase: seededUnit(index, 3),
      speed: 0.16 + seededUnit(index, 4) * 0.18,
      drift: 0.04 + seededUnit(index, 5) * 0.1,
    });
  }

  let halfSize = initialHalfSize.clone();
  let snowIntensity = 0;
  let lastTime = 0;
  let disposed = false;

  function writePositions(time: number) {
    const floorY = -halfSize.y + 0.18;
    const topY = halfSize.y + 0.24;
    const height = Math.max(0.5, topY - floorY);
    const xRadius = Math.max(0.2, halfSize.x);
    const zRadius = Math.max(0.2, halfSize.z);
    const safeTime = finiteTime(time);

    for (let index = 0; index < seeds.length; index += 1) {
      const seed = seeds[index];
      const fall = wrap(
        floorY + seed.y * height - safeTime * seed.speed,
        floorY,
        height,
      );
      const offset = index * 3;
      positions[offset] = seed.x * xRadius + Math.sin(safeTime * 0.32 + seed.phase * Math.PI * 2) * seed.drift;
      positions[offset + 1] = fall;
      positions[offset + 2] = seed.z * zRadius + Math.cos(safeTime * 0.27 + seed.phase * Math.PI * 2) * seed.drift;
    }

    geometry.attributes.position.needsUpdate = true;
  }

  writePositions(0);

  return {
    points,

    setWeatherEffects(effects) {
      if (disposed) return;
      const nextIntensity = Number.isFinite(effects.snowIntensity)
        ? THREE.MathUtils.clamp(effects.snowIntensity ?? 0, 0, 1)
        : 0;
      snowIntensity = nextIntensity;
      material.opacity = nextIntensity;
      points.visible = nextIntensity > 0;
    },

    update(time) {
      if (disposed || snowIntensity <= 0) return;
      lastTime = finiteTime(time);
      writePositions(lastTime);
    },

    resize(nextHalfSize) {
      if (disposed) return;
      halfSize.copy(nextHalfSize);
      writePositions(lastTime);
    },

    dispose() {
      if (disposed) return;
      disposed = true;
      scene.remove(points);
      geometry.dispose();
      material.dispose();
    },
  };
}
