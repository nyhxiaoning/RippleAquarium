import type { WeatherEffects, WeatherKind } from "./types.js";

const EFFECTS: Readonly<Record<WeatherKind, WeatherEffects>> = Object.freeze({
  clear: Object.freeze({
    lightingMultiplier: 1,
    fishSpeedMultiplier: 1,
    growthRateMultiplier: 1,
    rippleMultiplier: 1,
    backgroundColor: 0x081016,
    rainIntensity: 0,
    lightningChance: 0,
  }),
  cloudy: Object.freeze({
    lightingMultiplier: 0.75,
    fishSpeedMultiplier: 0.92,
    growthRateMultiplier: 0.98,
    rippleMultiplier: 1.1,
    backgroundColor: 0x0a141c,
    rainIntensity: 0,
    lightningChance: 0,
  }),
  rain: Object.freeze({
    lightingMultiplier: 0.6,
    fishSpeedMultiplier: 0.82,
    growthRateMultiplier: 0.95,
    rippleMultiplier: 1.6,
    backgroundColor: 0x071018,
    rainIntensity: 0.35,
    lightningChance: 0.08,
  }),
  storm: Object.freeze({
    lightingMultiplier: 0.45,
    fishSpeedMultiplier: 0.65,
    growthRateMultiplier: 0.85,
    rippleMultiplier: 2.2,
    backgroundColor: 0x03070b,
    rainIntensity: 0.85,
    lightningChance: 0.25,
  }),
});

/** Return the immutable base effects for one weather mode. */
export function getWeatherEffects(kind: WeatherKind): WeatherEffects {
  return EFFECTS[kind];
}

