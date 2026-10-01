import { assert, describe, it } from "vitest";
import { DEFAULT_STYLE } from "../src/aquarium/presets.js";
import { createAquariumManager } from "../src/aquarium/manager.js";
import {
  THEME_CATALOG,
  createDefaultThemeEntries,
  createThemeEntry,
  getThemeMeta,
} from "../src/theme/catalog.js";
import type { ThemeCharacterId, ThemePropId } from "../src/theme/types.js";

const mockDeps = {
  renderer: {} as never,
  scene: {} as never,
  cameraRig: { configure: () => {} },
};

describe("theme catalog", () => {
  it("contains both themed characters and props with bilingual labels", () => {
    const ids = THEME_CATALOG.map((entry) => entry.id);
    const characterIds: ThemeCharacterId[] = ["squidward", "mr-krabs"];
    const propIds: ThemePropId[] = ["squidward-house", "krusty-krab"];
    assert.deepStrictEqual(ids, [...characterIds, ...propIds]);
    for (const entry of THEME_CATALOG) {
      assert.ok(entry.name.zh);
      assert.ok(entry.name.en);
      assert.ok(entry.defaultScale > 0);
      assert.ok(entry.smallTankScale > 0);
    }
  });

  it("creates independent default entries with stable placements", () => {
    const first = createDefaultThemeEntries();
    const second = createDefaultThemeEntries();
    assert.strictEqual(first.length, 4);
    assert.ok(first.every((entry) => entry.enabled));
    assert.deepStrictEqual(first, second);
    first[0].position.x += 1;
    assert.notStrictEqual(first[0].position.x, second[0].position.x);
    assert.strictEqual(createThemeEntry("squidward").kind, "character");
    assert.strictEqual(getThemeMeta("krusty-krab")?.kind, "prop");
  });
});

describe("theme descriptor compatibility", () => {
  it("normalizes descriptors without theme entries", () => {
    const manager = createAquariumManager(DEFAULT_STYLE, mockDeps);
    assert.deepStrictEqual(manager.getThemeEntries(), []);
    assert.strictEqual(manager.setThemeEnabled("squidward", false), false);
    assert.strictEqual(manager.setThemeScale("mr-krabs", 0.75), false);
  });

  it("clones and updates theme entries without mutating the source descriptor", () => {
    const descriptor = {
      ...DEFAULT_STYLE,
      themeEntries: createDefaultThemeEntries(),
    };
    const manager = createAquariumManager(descriptor, mockDeps);
    assert.strictEqual(manager.setThemeEnabled("squidward", false), true);
    assert.strictEqual(manager.setThemeScale("mr-krabs", 0.72), true);
    assert.strictEqual(manager.getThemeEntries().find((entry) => entry.id === "squidward")?.enabled, false);
    assert.strictEqual(manager.getThemeEntries().find((entry) => entry.id === "mr-krabs")?.scale, 0.72);
    assert.strictEqual(descriptor.themeEntries[0].enabled, true);
    assert.strictEqual(descriptor.themeEntries[1].scale, 1);
  });
});
