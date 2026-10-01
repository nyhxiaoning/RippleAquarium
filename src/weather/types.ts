/** The weather modes supported by the aquarium. */
export type WeatherKind = "clear" | "cloudy" | "rain" | "storm";

/** Public, serializable weather state used by the scene and control panel. */
export interface WeatherState {
  readonly kind: WeatherKind;
  /** 0 while a mode is beginning, 1 once its transition is complete. */
  readonly progress: number;
  /** Seconds left in this mode. This reaches zero when auto-cycle is off. */
  readonly remainingSeconds: number;
  readonly autoCycle: boolean;
}

/** Runtime multipliers and visual parameters emitted by the weather controller. */
export interface WeatherEffects {
  readonly lightingMultiplier: number;
  readonly fishSpeedMultiplier: number;
  readonly growthRateMultiplier: number;
  readonly rippleMultiplier: number;
  readonly backgroundColor: number;
  readonly rainIntensity: number;
  readonly lightningChance: number;
}

export const WEATHER_KINDS: readonly WeatherKind[] = [
  "clear",
  "cloudy",
  "rain",
  "storm",
];

export const WEATHER_DURATIONS: Readonly<Record<WeatherKind, number>> = Object.freeze({
  clear: 90,
  cloudy: 60,
  rain: 45,
  storm: 30,
});

export const WEATHER_TRANSITION_SECONDS = 8;

