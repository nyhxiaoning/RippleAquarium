import { getWeatherEffects } from "./effects.js";
import {
  WEATHER_DURATIONS,
  WEATHER_KINDS,
  WEATHER_TRANSITION_SECONDS,
} from "./types.js";
import type { WeatherEffects, WeatherKind, WeatherState } from "./types.js";

export interface WeatherController {
  update(dt: number): WeatherState;
  setWeather(kind: WeatherKind): void;
  setAutoCycle(enabled: boolean): void;
  getState(): WeatherState;
  getEffects(): WeatherEffects;
}

export interface WeatherControllerOptions {
  now?: () => number;
  random?: () => number;
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
    lightningChance: interpolateNumber(from.lightningChance, to.lightningChance, t),
  });
}

/**
 * Owns weather timing without knowing anything about Three.js or the scene.
 * `dt` is simulation time in seconds, so callers can pause by passing zero.
 */
export function createWeatherController(
  options: WeatherControllerOptions = {},
): WeatherController {
  // Kept as injectable dependencies for deterministic scene integrations that
  // add lightning events. The weather state itself is advanced exclusively by dt.
  void options.now;
  void options.random;

  let kind: WeatherKind = "clear";
  let fromEffects = getWeatherEffects(kind);
  let progress = 1;
  let remainingSeconds = WEATHER_DURATIONS[kind];
  let autoCycle = true;

  const state = (): WeatherState => Object.freeze({
    kind,
    progress,
    remainingSeconds,
    autoCycle,
  });

  const effects = (): WeatherEffects =>
    interpolateEffects(fromEffects, getWeatherEffects(kind), progress);

  const setMode = (next: WeatherKind): void => {
    if (next === kind) {
      fromEffects = getWeatherEffects(next);
      progress = 1;
      remainingSeconds = WEATHER_DURATIONS[next];
      return;
    }
    fromEffects = effects();
    kind = next;
    progress = 0;
    remainingSeconds = WEATHER_DURATIONS[next];
  };

  const nextMode = (): WeatherKind => {
    const index = WEATHER_KINDS.indexOf(kind);
    return WEATHER_KINDS[(index + 1) % WEATHER_KINDS.length];
  };

  return {
    update(dt) {
      let timeLeft = finiteDelta(dt);
      if (timeLeft === 0) return state();

      while (timeLeft > 0) {
        const transitionLeft = progress < 1
          ? (1 - progress) * WEATHER_TRANSITION_SECONDS
          : Number.POSITIVE_INFINITY;
        const timerLeft = remainingSeconds > 0 ? remainingSeconds : 0;
        const eventIn = autoCycle
          ? Math.min(transitionLeft, timerLeft)
          : transitionLeft;
        const step = Math.min(timeLeft, eventIn);

        if (progress < 1 && step > 0) {
          progress = clamp01(progress + step / WEATHER_TRANSITION_SECONDS);
        }
        if (remainingSeconds > 0 && step > 0) {
          remainingSeconds = Math.max(0, remainingSeconds - step);
        }
        timeLeft -= step;

        const transitionDone = progress >= 1;
        const weatherDone = remainingSeconds <= 0;
        if (autoCycle && weatherDone) {
          setMode(nextMode());
          continue;
        }

        // Avoid a zero-length loop when auto-cycle is disabled and its timer is
        // already exhausted, while still allowing a transition to finish.
        if (step === 0 || (!autoCycle && transitionDone)) break;
      }

      return state();
    },

    setWeather(next) {
      setMode(next);
    },

    setAutoCycle(enabled) {
      autoCycle = Boolean(enabled);
    },

    getState() {
      return state();
    },

    getEffects() {
      return effects();
    },
  };
}

