import { assert, describe, it } from "vitest";
import { createAquariumManager } from "../src/aquarium/manager.js";
import { DEFAULT_STYLE } from "../src/aquarium/presets.js";

const mockDeps = {
  renderer: {} as never,
  scene: {} as never,
  cameraRig: { configure: () => {} },
};

describe("weather integration", () => {
  it("exposes serializable weather state and applies manual changes", () => {
    const manager = createAquariumManager(DEFAULT_STYLE, mockDeps);
    assert.deepStrictEqual(manager.getWeatherState(), {
      kind: "clear",
      progress: 1,
      remainingSeconds: 0,
    });

    manager.setWeather("rain");
    assert.strictEqual(manager.getWeatherState().kind, "rain");
    assert.strictEqual(manager.getWeatherState().progress, 0);
    // Effects are interpolated during the eight-second transition.
    assert.strictEqual(manager.getWeatherEffects().rippleMultiplier, 1);
    assert.doesNotThrow(() => JSON.stringify(manager.getWeatherState()));
  });

  it("forwards weather growth multiplier and keeps paused updates stable", () => {
    const manager = createAquariumManager(DEFAULT_STYLE, mockDeps);
    const record = manager.getGrowthRecords("sardine")[0];
    assert.ok(record);

    manager.setWeather("snow");
    manager.update(1, 4);
    assert.strictEqual(manager.getGrowthRecords("sardine")[0].accumulatedAgeSeconds, 3.84);

    const beforePause = manager.getGrowthRecords("sardine")[0].accumulatedAgeSeconds;
    const beforeState = manager.getWeatherState();
    manager.update(1, 0);
    assert.strictEqual(manager.getGrowthRecords("sardine")[0].accumulatedAgeSeconds, beforePause);
    assert.deepStrictEqual(manager.getWeatherState(), beforeState);
  });

  it("keeps a manually selected mode after a long update", () => {
    const manager = createAquariumManager(DEFAULT_STYLE, mockDeps);
    manager.setWeather("snow");
    manager.update(1, 120);
    const state = manager.getWeatherState();
    assert.strictEqual(state.kind, "snow");
    assert.strictEqual(state.progress, 1);
    assert.strictEqual(state.remainingSeconds, 0);
  });
});
