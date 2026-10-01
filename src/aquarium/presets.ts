import {
  aquariumHalfSize,
  pineappleHouseDecor,
  spongebobPatrickDecor,
} from "../config.js";
import type { AquariumStyle, Vec3 } from "./types.js";
import { createThemeEntry } from "../theme/catalog.js";
import type { ThemeEntry, ThemeObjectId } from "../theme/types.js";

function vec3(v: Vec3): Vec3 {
  return { x: v.x, y: v.y, z: v.z };
}

type ThemePresetId = "default" | "coral-reef" | "deep-sea" | "small-tank";

interface ThemePlacement {
  id: ThemeObjectId;
  position: Vec3;
  rotationY?: number;
  scale?: number;
  enabled?: boolean;
}

/**
 * Build independent theme data for a preset.  Theme entries intentionally
 * remain plain serializable values so switching styles cannot mutate the
 * catalog or another style's placement.
 */
export function createThemeEntriesForPreset(preset: ThemePresetId): ThemeEntry[] {
  const placements: Record<ThemePresetId, ThemePlacement[]> = {
    default: [
      { id: "squidward", position: { x: -7.9, y: 0, z: 5.1 }, rotationY: 0.16 },
      { id: "mr-krabs", position: { x: 7.8, y: 0, z: 5.0 }, rotationY: -0.16 },
      { id: "squidward-house", position: { x: -7.8, y: 0, z: 5.6 }, rotationY: 0.12 },
      { id: "krusty-krab", position: { x: 7.6, y: 0, z: 5.55 }, rotationY: -0.12 },
    ],
    "coral-reef": [
      { id: "squidward", position: { x: -10.8, y: 0, z: 6.8 }, rotationY: 0.16, scale: 0.92 },
      { id: "mr-krabs", position: { x: 10.7, y: 0, z: 6.75 }, rotationY: -0.16, scale: 0.92 },
      { id: "squidward-house", position: { x: -10.65, y: 0, z: 7.45 }, rotationY: 0.12, scale: 0.82 },
      { id: "krusty-krab", position: { x: 10.45, y: 0, z: 7.35 }, rotationY: -0.12, scale: 0.82 },
    ],
    "deep-sea": [
      { id: "squidward", position: { x: -6.8, y: 0, z: 4.05 }, rotationY: 0.16, scale: 0.9 },
      { id: "mr-krabs", position: { x: 6.7, y: 0, z: 4.0 }, rotationY: -0.16, scale: 0.9 },
      { id: "squidward-house", position: { x: -6.65, y: 0, z: 4.65 }, rotationY: 0.12, scale: 0.8 },
      { id: "krusty-krab", position: { x: 6.45, y: 0, z: 4.6 }, rotationY: -0.12, scale: 0.8 },
    ],
    "small-tank": [
      // Characters stay visible at 70% scale, while their larger props are
      // disabled to preserve a clear swim lane in the compact tank.
      { id: "squidward", position: { x: -2.35, y: 0, z: 1.8 }, rotationY: 0.16, scale: 0.7 },
      { id: "mr-krabs", position: { x: 2.35, y: 0, z: 1.8 }, rotationY: -0.16, scale: 0.7 },
      { id: "squidward-house", position: { x: -2.25, y: 0, z: 2.2 }, rotationY: 0.12, scale: 0.68, enabled: false },
      { id: "krusty-krab", position: { x: 2.2, y: 0, z: 2.2 }, rotationY: -0.12, scale: 0.68, enabled: false },
    ],
  };

  return placements[preset].map((placement) => {
    const entry = createThemeEntry(placement.id, {
      enabled: placement.enabled,
      scale: placement.scale,
    });
    entry.position = { ...placement.position };
    entry.rotationY = placement.rotationY ?? entry.rotationY;
    return entry;
  });
}

/** The default style is generated from the existing config constants so the
 *  initial look stays byte-for-byte identical to before this feature. */
export const DEFAULT_STYLE: AquariumStyle = {
  id: "default",
  name: { zh: "默认鱼缸", en: "Default" },
  aquarium: { halfSize: vec3(aquariumHalfSize) },
  theme: {
    waterBaseColor: 0x126d8c,
    waterHighlightColor: 0xd8fbff,
    glassColor: 0x9bdcff,
    backgroundColor: 0x081016,
    lighting: { hemiIntensity: 2.6, sunIntensity: 2.2 },
  },
  decor: [
    {
      id: "pineapple-house",
      asset: "pineapple-house",
      position: vec3(pineappleHouseDecor.position),
      rotationY: pineappleHouseDecor.rotationY,
      height: pineappleHouseDecor.height,
    },
    {
      id: "spongebob-patrick",
      asset: "spongebob-patrick",
      position: vec3(spongebobPatrickDecor.position),
      height: spongebobPatrickDecor.height,
    },
  ],
  themeEntries: createThemeEntriesForPreset("default"),
  fish: [
    { speciesId: "sardine", count: 60 },
    { speciesId: "koi", count: 24 },
    { speciesId: "clownfish", count: 18 },
    { speciesId: "angelfish", count: 12 },
    { speciesId: "blue-tang", count: 10 },
    { speciesId: "pufferfish", count: 6 },
  ],
  plants: [{ speciesId: "coral", count: 100 }],
  ecology: [
    { speciesId: "anemone", count: 8 },
    { speciesId: "urchin", count: 8 },
    { speciesId: "shell", count: 16 },
    { speciesId: "jellyfish", count: 6 },
  ],
};

export const CORAL_REEF_STYLE: AquariumStyle = {
  id: "coral-reef",
  name: { zh: "珊瑚礁", en: "Coral Reef" },
  aquarium: { halfSize: { x: 14, y: 7.5, z: 10 } },
  theme: {
    waterBaseColor: 0x0f5b66,
    waterHighlightColor: 0xbfeefb,
    glassColor: 0x7fb6cf,
    backgroundColor: 0x060d12,
    lighting: { hemiIntensity: 2.4, sunIntensity: 2.0 },
  },
  decor: [
    {
      id: "pineapple-house",
      asset: "pineapple-house",
      position: { x: -5.2, y: 0, z: 3.1 },
      rotationY: 0.28,
      height: 6.08,
    },
    {
      id: "spongebob-patrick",
      asset: "spongebob-patrick",
      position: { x: -3.6, y: 0, z: 7.3 },
      height: 2.35,
    },
  ],
  themeEntries: createThemeEntriesForPreset("coral-reef"),
  fish: [
    { speciesId: "sardine", count: 80 },
    { speciesId: "koi", count: 30 },
    { speciesId: "clownfish", count: 24 },
    { speciesId: "starfish", count: 14 },
    { speciesId: "angelfish", count: 16 },
    { speciesId: "blue-tang", count: 14 },
    { speciesId: "pufferfish", count: 8 },
  ],
  plants: [
    { speciesId: "coral", count: 160 },
    { speciesId: "seaweed", count: 26 },
  ],
  ecology: [
    { speciesId: "anemone", count: 14 },
    { speciesId: "urchin", count: 12 },
    { speciesId: "shell", count: 24 },
    { speciesId: "jellyfish", count: 8 },
  ],
};

export const DEEP_SEA_STYLE: AquariumStyle = {
  id: "deep-sea",
  name: { zh: "深海", en: "Deep Sea" },
  aquarium: { halfSize: { x: 10, y: 9, z: 7 } },
  theme: {
    waterBaseColor: 0x0a3a44,
    waterHighlightColor: 0x9af0ff,
    glassColor: 0x5f8aa0,
    backgroundColor: 0x04080b,
    lighting: { hemiIntensity: 1.8, sunIntensity: 1.6 },
  },
  decor: [
    {
      id: "pineapple-house",
      asset: "pineapple-house",
      position: { x: -3.8, y: 0, z: 2.2 },
      rotationY: -0.2,
      height: 6.08,
    },
  ],
  themeEntries: createThemeEntriesForPreset("deep-sea"),
  fish: [
    { speciesId: "sardine", count: 40 },
    { speciesId: "koi", count: 10 },
    { speciesId: "clownfish", count: 8 },
    { speciesId: "angelfish", count: 6 },
    { speciesId: "blue-tang", count: 5 },
    { speciesId: "pufferfish", count: 3 },
  ],
  plants: [{ speciesId: "coral", count: 60 }],
  ecology: [
    { speciesId: "anemone", count: 6 },
    { speciesId: "urchin", count: 4 },
    { speciesId: "shell", count: 8 },
    { speciesId: "jellyfish", count: 4 },
  ],
};

export const SMALL_TANK_STYLE: AquariumStyle = {
  id: "small-tank",
  name: { zh: "小缸", en: "Small Tank" },
  aquarium: { halfSize: { x: 5, y: 3.5, z: 4 } },
  theme: {
    waterBaseColor: 0x1a7a8c,
    waterHighlightColor: 0xdaf6ff,
    glassColor: 0x9fd0e0,
    backgroundColor: 0x081016,
    lighting: { hemiIntensity: 2.6, sunIntensity: 2.2 },
  },
  decor: [
    {
      id: "pineapple-house",
      asset: "pineapple-house",
      position: { x: -2.1, y: 0, z: 1.3 },
      rotationY: 0.4,
      height: 4.2,
    },
  ],
  themeEntries: createThemeEntriesForPreset("small-tank"),
  fish: [
    { speciesId: "sardine", count: 18 },
    { speciesId: "koi", count: 6 },
    { speciesId: "clownfish", count: 6 },
    { speciesId: "angelfish", count: 2 },
    { speciesId: "blue-tang", count: 1 },
    { speciesId: "pufferfish", count: 1 },
  ],
  plants: [{ speciesId: "coral", count: 34 }],
  ecology: [
    { speciesId: "anemone", count: 2 },
    { speciesId: "urchin", count: 1 },
    { speciesId: "shell", count: 4 },
    { speciesId: "jellyfish", count: 1 },
  ],
};

export const AQUARIUM_STYLES: readonly AquariumStyle[] = [
  DEFAULT_STYLE,
  CORAL_REEF_STYLE,
  DEEP_SEA_STYLE,
  SMALL_TANK_STYLE,
];

export function getStyleById(styleId: string): AquariumStyle | undefined {
  return AQUARIUM_STYLES.find((style) => style.id === styleId);
}

export function listStyleIds(): string[] {
  return AQUARIUM_STYLES.map((style) => style.id);
}
