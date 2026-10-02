import type { WeatherEffects, WeatherKind } from "./types.js";

const EFFECTS: Readonly<Record<WeatherKind, WeatherEffects>> = Object.freeze({
  clear: Object.freeze({
    lightingMultiplier: 1,
    fishSpeedMultiplier: 1,
    growthRateMultiplier: 1,
    rippleMultiplier: 1,
    backgroundColor: 0x081016,
    rainIntensity: 0,
    snowIntensity: 0,
    lightningChance: 0,
  }),
  cloudy: Object.freeze({
    lightingMultiplier: 0.75,
    fishSpeedMultiplier: 0.92,
    growthRateMultiplier: 0.98,
    rippleMultiplier: 1.1,
    backgroundColor: 0x0a141c,
    rainIntensity: 0,
    snowIntensity: 0,
    lightningChance: 0,
  }),
  rain: Object.freeze({
    lightingMultiplier: 0.6,
    fishSpeedMultiplier: 0.82,
    growthRateMultiplier: 0.95,
    rippleMultiplier: 1.6,
    backgroundColor: 0x071018,
    rainIntensity: 0.35,
    snowIntensity: 0,
    lightningChance: 0,
  }),
  snow: Object.freeze({
    lightingMultiplier: 0.68,
    fishSpeedMultiplier: 0.86,
    growthRateMultiplier: 0.92,
    rippleMultiplier: 1.15,
    backgroundColor: 0x091722,
    rainIntensity: 0,
    snowIntensity: 0.55,
    lightningChance: 0,
  }),
});

/** Return the immutable base effects for one weather mode. */
export function getWeatherEffects(kind: WeatherKind): WeatherEffects {
  return EFFECTS[kind];
}
