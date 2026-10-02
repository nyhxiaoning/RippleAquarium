import { getWeatherEffects } from "./effects.js";
import { WEATHER_TRANSITION_SECONDS } from "./types.js";
import type { WeatherEffects, WeatherKind, WeatherState } from "./types.js";

export interface WeatherController {
  update(dt: number): WeatherState;
  setWeather(kind: WeatherKind): void;
  getState(): WeatherState;
  getEffects(): WeatherEffects;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function finiteDelta(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function interpolateNumber(from: number, to: number, progress: number): number {
  return from + (to - from) * progress;
}

function interpolateEffects(
  from: WeatherEffects,
  to: WeatherEffects,
  progress: number,
): WeatherEffects {
  const t = clamp01(progress);
  return Object.freeze({
    lightingMultiplier: interpolateNumber(from.lightingMultiplier, to.lightingMultiplier, t),
    fishSpeedMultiplier: interpolateNumber(from.fishSpeedMultiplier, to.fishSpeedMultiplier, t),
    growthRateMultiplier: interpolateNumber(from.growthRateMultiplier, to.growthRateMultiplier, t),
    rippleMultiplier: interpolateNumber(from.rippleMultiplier, to.rippleMultiplier, t),
    backgroundColor: interpolateNumber(from.backgroundColor, to.backgroundColor, t),
    rainIntensity: interpolateNumber(from.rainIntensity, to.rainIntensity, t),
    snowIntensity: interpolateNumber(from.snowIntensity, to.snowIntensity, t),
    lightningChance: interpolateNumber(from.lightningChance, to.lightningChance, t),
  });
}

/**
 * Owns weather timing without knowing anything about Three.js or the scene.
 * `dt` is simulation time in seconds, so callers can pause by passing zero.
 */
export function createWeatherController(): WeatherController {
  let kind: WeatherKind = "clear";
  let fromEffects = getWeatherEffects(kind);
  let progress = 1;

  const state = (): WeatherState => Object.freeze({
    kind,
    progress,
    remainingSeconds: 0,
  });

  const effects = (): WeatherEffects =>
    interpolateEffects(fromEffects, getWeatherEffects(kind), progress);

  const setMode = (next: WeatherKind): void => {
    if (next === kind) {
      fromEffects = getWeatherEffects(next);
      progress = 1;
      return;
    }
    fromEffects = effects();
    kind = next;
    progress = 0;
  };

  return {
    update(dt) {
      const seconds = finiteDelta(dt);
      if (seconds > 0 && progress < 1) {
        progress = clamp01(progress + seconds / WEATHER_TRANSITION_SECONDS);
      }
      return state();
    },

    setWeather(next) {
      setMode(next);
    },

    getState() {
      return state();
    },

    getEffects() {
      return effects();
    },
  };
}
