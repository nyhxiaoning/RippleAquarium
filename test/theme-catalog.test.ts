import { assert, describe, it } from "vitest";
import { DEFAULT_STYLE } from "../src/aquarium/presets.js";
import { createAquariumManager } from "../src/aquarium/manager.js";
import {
  THEME_CATALOG,
  createDefaultThemeEntries,
  createThemeEntry,
  getThemeMeta,
  normalizeThemeEntries,
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
    const characterIds: ThemeCharacterId[] = ["patrick", "spongebob", "squidward", "mr-krabs"];
    const propIds: ThemePropId[] = ["squidward-house", "krusty-krab"];
    assert.deepStrictEqual(ids, ["pineapple-house", ...characterIds, ...propIds]);
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
    assert.strictEqual(first.length, 7);
    assert.ok(first.every((entry) => entry.enabled));
    assert.deepStrictEqual(first, second);
    first[0].position.x += 1;
    assert.notStrictEqual(first[0].position.x, second[0].position.x);
    assert.strictEqual(createThemeEntry("squidward").kind, "character");
    assert.strictEqual(getThemeMeta("krusty-krab")?.kind, "prop");
  });

  it("normalizes legacy SpongeBob and pineapple decor exactly once", () => {
    const decor = [
      { asset: "spongebob-patrick" },
      { asset: "pineapple-house" },
    ];
    const first = normalizeThemeEntries(undefined, decor);
    assert.deepStrictEqual(first.map((entry) => entry.id), ["spongebob", "patrick", "pineapple-house"]);
    const second = normalizeThemeEntries(first, decor);
    assert.deepStrictEqual(second.map((entry) => entry.id), first.map((entry) => entry.id));
    first[0].position.x += 10;
    assert.notStrictEqual(first[0].position.x, second[0].position.x);
  });
});

describe("theme descriptor compatibility", () => {
  it("normalizes descriptors without theme entries", () => {
    const legacyDescriptor = { ...DEFAULT_STYLE, themeEntries: undefined };
    const manager = createAquariumManager(legacyDescriptor, mockDeps);
    assert.deepStrictEqual(
      manager.getThemeEntries().map((entry) => entry.id),
      ["spongebob", "patrick", "pineapple-house"],
    );
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
    assert.strictEqual(descriptor.themeEntries.find((entry) => entry.id === "squidward")?.enabled, true);
    assert.strictEqual(descriptor.themeEntries.find((entry) => entry.id === "mr-krabs")?.scale, 1.02);
  });
});
