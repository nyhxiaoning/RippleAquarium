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
    });
    expect(getWeatherEffects("storm")).toMatchObject({
      lightingMultiplier: 0.45,
      fishSpeedMultiplier: 0.65,
      growthRateMultiplier: 0.85,
      rippleMultiplier: 2.2,
    });
  });

  it("starts clear with a full transition and the clear duration", () => {
    const controller = createWeatherController();
    expect(controller.getState()).toEqual({
      kind: "clear",
      progress: 1,
      remainingSeconds: 90,
      autoCycle: true,
    });
    expect(controller.getEffects()).toEqual(getWeatherEffects("clear"));
  });

  it("smoothly transitions after a manual weather switch and resets its timer", () => {
    const controller = createWeatherController();
    controller.setWeather("rain");

    expect(controller.getState()).toMatchObject({
      kind: "rain",
      progress: 0,
      remainingSeconds: 45,
    });
    expect(controller.getEffects().lightingMultiplier).toBeCloseTo(1);

    controller.update(4);
    expect(controller.getState().progress).toBeCloseTo(0.5);
    expect(controller.getState().remainingSeconds).toBe(41);
    expect(controller.getEffects().lightingMultiplier).toBeCloseTo(0.8);

    controller.update(4);
    expect(controller.getState().progress).toBe(1);
    expect(controller.getEffects().lightingMultiplier).toBeCloseTo(0.6);
  });

  it("cycles in the fixed order with weather-specific durations", () => {
    const controller = createWeatherController();
    controller.update(90);
    expect(controller.getState()).toMatchObject({ kind: "cloudy", remainingSeconds: 60, progress: 0 });
    controller.update(60);
    expect(controller.getState()).toMatchObject({ kind: "rain", remainingSeconds: 45, progress: 0 });
    controller.update(45);
    expect(controller.getState()).toMatchObject({ kind: "storm", remainingSeconds: 30, progress: 0 });
    controller.update(30);
    expect(controller.getState()).toMatchObject({ kind: "clear", remainingSeconds: 90, progress: 0 });
  });

  it("can pause automatic cycling without changing the selected weather", () => {
    const controller = createWeatherController();
    controller.setAutoCycle(false);
    controller.update(120);
    expect(controller.getState()).toMatchObject({ kind: "clear", remainingSeconds: 0, autoCycle: false });
    controller.setWeather("storm");
    controller.update(3);
    expect(controller.getState()).toMatchObject({ kind: "storm", remainingSeconds: 27, autoCycle: false });
  });

  it("does not advance when dt is zero", () => {
    const controller = createWeatherController();
    controller.setWeather("cloudy");
    const before = controller.getState();
    controller.update(0);
    expect(controller.getState()).toEqual(before);
  });
});
