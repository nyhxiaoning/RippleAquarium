import * as THREE from "three";
import { describe, expect, it } from "vitest";
import {
  createWeatherPrecipitation,
  SNOW_PARTICLE_COUNT,
} from "../src/weather/precipitation.js";
import type { WeatherEffects } from "../src/weather/types.js";

type SnowEffects = WeatherEffects & { snowIntensity: number };

function weatherEffects(snowIntensity: number, rainIntensity = 0): SnowEffects {
  return {
    lightingMultiplier: 1,
    fishSpeedMultiplier: 1,
    growthRateMultiplier: 1,
    rippleMultiplier: 1,
    backgroundColor: 0x081016,
    rainIntensity,
    lightningChance: 0,
    snowIntensity,
  };
}

function positions(effect: ReturnType<typeof createWeatherPrecipitation>): number[] {
  const attribute = effect.points.geometry.getAttribute("position");
  return Array.from(attribute.array as Float32Array);
}

describe("weather precipitation", () => {
  it("creates a deterministic snow field and only responds to snow intensity", () => {
    const firstScene = new THREE.Scene();
    const secondScene = new THREE.Scene();
    const bounds = new THREE.Vector3(7, 4, 8);
    const first = createWeatherPrecipitation(firstScene, bounds);
    const second = createWeatherPrecipitation(secondScene, bounds);

    expect(first.points).toBeInstanceOf(THREE.Points);
    expect(first.points.geometry.getAttribute("position").count).toBe(SNOW_PARTICLE_COUNT);
    expect(first.points.visible).toBe(false);

    first.setWeatherEffects(weatherEffects(0, 1));
    expect(first.points.visible).toBe(false);
    expect((first.points.material as THREE.PointsMaterial).opacity).toBe(0);

    first.setWeatherEffects(weatherEffects(0.7));
    second.setWeatherEffects(weatherEffects(0.7));
    first.update(12.5);
    second.update(12.5);
    expect(first.points.visible).toBe(true);
    expect((first.points.material as THREE.PointsMaterial).opacity).toBeCloseTo(0.7);
    expect(positions(first)).toEqual(positions(second));

    first.dispose();
    second.dispose();
  });

  it("wraps falling flakes and rebuilds bounds without replacing the material", () => {
    const scene = new THREE.Scene();
    const effect = createWeatherPrecipitation(scene, new THREE.Vector3(4, 3, 4));
    effect.setWeatherEffects(weatherEffects(1));
    effect.update(0);
    const material = effect.points.material;
    const beforeResize = positions(effect);

    effect.update(240);
    const afterFall = positions(effect);
    expect(afterFall).not.toEqual(beforeResize);
    expect(afterFall.every(Number.isFinite)).toBe(true);

    effect.resize(new THREE.Vector3(9, 6, 11));
    expect(effect.points.material).toBe(material);
    const afterResize = positions(effect);
    expect(afterResize).not.toEqual(afterFall);
    expect(scene.children).toContain(effect.points);

    effect.dispose();
    expect(scene.children).not.toContain(effect.points);
    expect(() => effect.update(1)).not.toThrow();
    expect(() => effect.resize(new THREE.Vector3(2, 2, 2))).not.toThrow();
  });
});
