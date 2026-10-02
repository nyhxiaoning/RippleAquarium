import { describe, expect, it } from "vitest";
import { createWeatherController } from "../src/weather/controller.js";
import { getWeatherEffects } from "../src/weather/effects.js";

describe("weather effects", () => {
  it("exposes the agreed effect multipliers for every weather kind", () => {
    expect(getWeatherEffects("clear")).toMatchObject({
      lightingMultiplier: 1,
      fishSpeedMultiplier: 1,
      growthRateMultiplier: 1,
      rippleMultiplier: 1,
      rainIntensity: 0,
      snowIntensity: 0,
    });
    expect(getWeatherEffects("cloudy")).toMatchObject({
      lightingMultiplier: 0.75,
      fishSpeedMultiplier: 0.92,
      growthRateMultiplier: 0.98,
      rippleMultiplier: 1.1,
    });
    expect(getWeatherEffects("rain")).toMatchObject({
      lightingMultiplier: 0.6,
      fishSpeedMultiplier: 0.82,
      growthRateMultiplier: 0.95,
      rippleMultiplier: 1.6,
      snowIntensity: 0,
    });
    expect(getWeatherEffects("snow")).toMatchObject({
      lightingMultiplier: 0.68,
      fishSpeedMultiplier: 0.86,
      growthRateMultiplier: 0.92,
      rippleMultiplier: 1.15,
      rainIntensity: 0,
      snowIntensity: 0.55,
    });
  });

  it("starts clear with a full transition and no expiry timer", () => {
    const controller = createWeatherController();
    expect(controller.getState()).toEqual({
      kind: "clear",
      progress: 1,
      remainingSeconds: 0,
    });
    expect(controller.getEffects()).toEqual(getWeatherEffects("clear"));
  });

  it("smoothly transitions after a manual weather switch", () => {
    const controller = createWeatherController();
    controller.setWeather("rain");

    expect(controller.getState()).toMatchObject({
      kind: "rain",
      progress: 0,
      remainingSeconds: 0,
    });
    expect(controller.getEffects().lightingMultiplier).toBeCloseTo(1);

    controller.update(4);
    expect(controller.getState().progress).toBeCloseTo(0.5);
    expect(controller.getState().remainingSeconds).toBe(0);
    expect(controller.getEffects().lightingMultiplier).toBeCloseTo(0.8);

    controller.update(4);
    expect(controller.getState().progress).toBe(1);
    expect(controller.getEffects().lightingMultiplier).toBeCloseTo(0.6);
  });

  it("keeps the selected weather after a long update", () => {
    const controller = createWeatherController();
    controller.setWeather("snow");
    controller.update(120);
    expect(controller.getState()).toEqual({ kind: "snow", progress: 1, remainingSeconds: 0 });
    expect(controller.getEffects().snowIntensity).toBe(0.55);
  });

  it("does not advance when dt is zero", () => {
    const controller = createWeatherController();
    controller.setWeather("cloudy");
    const before = controller.getState();
    controller.update(0);
    expect(controller.getState()).toEqual(before);
  });
});
