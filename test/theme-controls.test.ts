import { assert, describe, it } from "vitest";
import { DEFAULT_STYLE } from "../src/aquarium/presets.js";
import { createAquariumManager } from "../src/aquarium/manager.js";
import { getLanguage, t } from "../src/i18n.js";

const mockDeps = {
  renderer: {} as never,
  scene: {} as never,
  cameraRig: { configure: () => {} },
};

describe("SpongeBob theme controls", () => {
  it("updates visibility and scale without mutating the shared preset", () => {
    const manager = createAquariumManager(DEFAULT_STYLE, mockDeps);
    const changes: number[] = [];
    manager.on("change", () => changes.push(1));

    assert.strictEqual(manager.setThemeEnabled("squidward", false), true);
    assert.strictEqual(manager.setThemeScale("mr-krabs", 0.75), true);
    assert.strictEqual(manager.getThemeEntries().find((entry) => entry.id === "squidward")?.enabled, false);
    assert.strictEqual(manager.getThemeEntries().find((entry) => entry.id === "mr-krabs")?.scale, 0.75);
    assert.strictEqual(DEFAULT_STYLE.themeEntries?.find((entry) => entry.id === "squidward")?.enabled, true);
    assert.strictEqual(DEFAULT_STYLE.themeEntries?.find((entry) => entry.id === "mr-krabs")?.scale, 1);
    assert.strictEqual(changes.length, 2);
  });

  it("keeps animation as runtime state and rejects unknown objects", () => {
    const manager = createAquariumManager(DEFAULT_STYLE, mockDeps);
    assert.strictEqual(manager.getThemeAnimationEnabled(), true);
    manager.setThemeAnimationEnabled(false);
    assert.strictEqual(manager.getThemeAnimationEnabled(), false);
    assert.strictEqual(manager.setThemeEnabled("unknown", false), false);
    assert.strictEqual(manager.setThemeScale("unknown", 0.5), false);
    assert.strictEqual(manager.setThemeScale("squidward", Number.NaN), false);
  });

  it("exposes bilingual panel labels", () => {
    assert.ok(t("themeTitle"));
    assert.ok(t("themeAnimation"));
    assert.ok(t("themeVisibility"));
    assert.ok(t("themeScale"));
    assert.ok(["zh", "en"].includes(getLanguage()));
  });
});
