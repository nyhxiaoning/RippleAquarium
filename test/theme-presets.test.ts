import { assert, describe, it } from "vitest";
import {
  AQUARIUM_STYLES,
  CORAL_REEF_STYLE,
  DEFAULT_STYLE,
  DEEP_SEA_STYLE,
  SMALL_TANK_STYLE,
  createThemeEntriesForPreset,
} from "../src/aquarium/presets.js";

const THEME_IDS = ["squidward", "mr-krabs", "squidward-house", "krusty-krab"] as const;

describe("theme preset placement", () => {
  it("enables both characters and props in the default preset", () => {
    assert.deepStrictEqual(DEFAULT_STYLE.themeEntries?.map((entry) => entry.id), [...THEME_IDS]);
    assert.ok(DEFAULT_STYLE.themeEntries?.every((entry) => entry.enabled));
    assert.ok(DEFAULT_STYLE.themeEntries?.every((entry) => entry.scale === 1));
  });

  it("keeps theme entries inside each preset footprint", () => {
    for (const style of AQUARIUM_STYLES) {
      for (const entry of style.themeEntries ?? []) {
        assert.ok(Math.abs(entry.position.x) < style.aquarium.halfSize.x, `${style.id}/${entry.id} x`);
        assert.ok(Math.abs(entry.position.z) < style.aquarium.halfSize.z, `${style.id}/${entry.id} z`);
      }
    }
  });

  it("uses reduced props in larger themed presets", () => {
    for (const style of [CORAL_REEF_STYLE, DEEP_SEA_STYLE]) {
      const props = style.themeEntries?.filter((entry) => entry.kind === "prop") ?? [];
      assert.strictEqual(props.length, 2);
      assert.ok(props.every((entry) => entry.enabled && entry.scale < 1));
    }
  });

  it("keeps small-tank characters at 70% and hides large props", () => {
    const entries = SMALL_TANK_STYLE.themeEntries ?? [];
    const characters = entries.filter((entry) => entry.kind === "character");
    const props = entries.filter((entry) => entry.kind === "prop");
    assert.ok(characters.every((entry) => entry.enabled && entry.scale >= 0.65 && entry.scale <= 0.75));
    assert.ok(props.every((entry) => !entry.enabled && entry.scale >= 0.65 && entry.scale <= 0.75));
  });

  it("returns independent theme placement data for every preset", () => {
    const first = createThemeEntriesForPreset("default");
    const second = createThemeEntriesForPreset("default");
    first[0].position.x += 3;
    first[0].enabled = false;
    assert.notStrictEqual(first[0].position.x, second[0].position.x);
    assert.strictEqual(second[0].enabled, true);
  });
});
