import {
  aquariumHalfSize,
  pineappleHouseDecor,
  spongebobPatrickDecor,
} from "../config.js";
import type { AquariumStyle, Vec3 } from "./types.js";

function vec3(v: Vec3): Vec3 {
  return { x: v.x, y: v.y, z: v.z };
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
  fish: [
    { speciesId: "sardine", count: 60 },
    { speciesId: "koi", count: 24 },
    { speciesId: "clownfish", count: 18 },
  ],
  plants: [{ speciesId: "coral", count: 100 }],
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
  fish: [
    { speciesId: "sardine", count: 80 },
    { speciesId: "koi", count: 30 },
    { speciesId: "clownfish", count: 24 },
    { speciesId: "starfish", count: 14 },
  ],
  plants: [
    { speciesId: "coral", count: 160 },
    { speciesId: "seaweed", count: 26 },
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
  fish: [
    { speciesId: "sardine", count: 40 },
    { speciesId: "koi", count: 10 },
    { speciesId: "clownfish", count: 8 },
  ],
  plants: [{ speciesId: "coral", count: 60 }],
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
  fish: [
    { speciesId: "sardine", count: 18 },
    { speciesId: "koi", count: 6 },
    { speciesId: "clownfish", count: 6 },
  ],
  plants: [{ speciesId: "coral", count: 34 }],
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