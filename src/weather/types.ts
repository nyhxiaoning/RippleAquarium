/** The weather modes supported by the aquarium. */
export type WeatherKind = "clear" | "rain" | "snow" | "cloudy";

/** Public, serializable weather state used by the scene and control panel. */
export interface WeatherState {
  readonly kind: WeatherKind;
  /** 0 while a mode is beginning, 1 once its transition is complete. */
  readonly progress: number;
  /** Retained for a stable serializable shape; manual modes do not expire. */
  readonly remainingSeconds: number;
}

/** Runtime multipliers and visual parameters emitted by the weather controller. */
export interface WeatherEffects {
  readonly lightingMultiplier: number;
  readonly fishSpeedMultiplier: number;
  readonly growthRateMultiplier: number;
  readonly rippleMultiplier: number;
  readonly backgroundColor: number;
  readonly rainIntensity: number;
  readonly snowIntensity: number;
  readonly lightningChance: number;
}

export const WEATHER_KINDS: readonly WeatherKind[] = [
  "clear",
  "rain",
  "snow",
  "cloudy",
];

export const WEATHER_TRANSITION_SECONDS = 8;
