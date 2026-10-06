import type { ThemeEntry, ThemeMeta, ThemeObjectId } from "./types.js";

/**
 * Theme content metadata is intentionally plain data so presets and controls
 * can consume it without importing Three.js or constructing scene objects.
 */
export const THEME_CATALOG: readonly ThemeMeta[] = [
  {
    id: "pineapple-house",
    kind: "prop",
    name: { zh: "菠萝屋", en: "Pineapple House" },
    defaultPosition: { x: -8.4, y: 0, z: 6.2 },
    defaultRotationY: 0.28,
    defaultScale: 1,
    smallTankScale: 0.7,
    hideInSmallTank: true,
  },
  {
    id: "patrick",
    kind: "character",
    name: { zh: "派大星", en: "Patrick" },
    defaultPosition: { x: -4.8, y: 0, z: 4.8 },
    defaultRotationY: 0.1,
    defaultScale: 1.08,
    smallTankScale: 0.7,
  },
  {
    id: "spongebob",
    kind: "character",
    name: { zh: "海绵宝宝", en: "SpongeBob" },
    defaultPosition: { x: 0, y: 0, z: 4.55 },
    defaultRotationY: 0,
    defaultScale: 1,
    smallTankScale: 0.7,
  },
  {
    id: "squidward",
    kind: "character",
    name: { zh: "章鱼哥", en: "Squidward" },
    defaultPosition: { x: 4.6, y: 0, z: 5.1 },
    defaultRotationY: 0.16,
    defaultScale: 0.98,
    smallTankScale: 0.7,
  },
  {
    id: "mr-krabs",
    kind: "character",
    name: { zh: "蟹老板", en: "Mr. Krabs" },
    defaultPosition: { x: 8.6, y: 0, z: 4.65 },
    defaultRotationY: -0.16,
    defaultScale: 1.02,
    smallTankScale: 0.7,
  },
  {
    id: "squidward-house",
    kind: "prop",
    name: { zh: "章鱼哥房屋", en: "Squidward's House" },
    defaultPosition: { x: -8.7, y: 0, z: 4.65 },
    defaultRotationY: 0.12,
    defaultScale: 1,
    smallTankScale: 0.68,
    hideInSmallTank: true,
  },
  {
    id: "krusty-krab",
    kind: "prop",
    name: { zh: "蟹堡王", en: "Krusty Krab" },
    defaultPosition: { x: 8.5, y: 0, z: 4.55 },
    defaultRotationY: -0.12,
    defaultScale: 1,
    smallTankScale: 0.68,
    hideInSmallTank: true,
  },
];

const THEME_CATALOG_BY_ID = new Map<ThemeObjectId, ThemeMeta>(
  THEME_CATALOG.map((entry) => [entry.id, entry]),
);

export function getThemeMeta(id: string): ThemeMeta | undefined {
  return THEME_CATALOG_BY_ID.get(id as ThemeObjectId);
}

export function createThemeEntry(id: ThemeObjectId, options: Partial<Pick<ThemeEntry, "enabled" | "scale">> = {}): ThemeEntry {
  const meta = THEME_CATALOG_BY_ID.get(id);
  if (!meta) throw new Error(`Unknown theme object: ${id}`);
  return {
    id: meta.id,
    kind: meta.kind,
    enabled: options.enabled ?? true,
    position: { ...meta.defaultPosition },
    rotationY: meta.defaultRotationY,
    scale: Number.isFinite(options.scale) ? Math.max(0, options.scale as number) : meta.defaultScale,
  };
}

export function createDefaultThemeEntries(): ThemeEntry[] {
  return THEME_CATALOG.map((meta) => createThemeEntry(meta.id));
}

/** Alias used by preset builders and callers that prefer a getter name. */
export const getDefaultThemeEntries = createDefaultThemeEntries;

export function cloneThemeEntries(entries: readonly ThemeEntry[] | undefined): ThemeEntry[] {
  return (entries ?? []).map((entry) => ({
    ...entry,
    position: { ...entry.position },
  }));
}

/**
 * Expand theme objects from descriptors written before the procedural theme
 * entries existed. The input is never mutated, and an already-normalized
 * descriptor remains unchanged when normalized again.
 */
export function normalizeThemeEntries(
  entries: readonly ThemeEntry[] | undefined,
  decor: readonly { asset: string }[] = [],
): ThemeEntry[] {
  const normalized = cloneThemeEntries(entries);
  const ids = new Set(normalized.map((entry) => entry.id));

  if (
    decor.some((item) => item.asset === "spongebob-patrick") &&
    !ids.has("spongebob") &&
    !ids.has("patrick")
  ) {
    normalized.push(createThemeEntry("spongebob"));
    normalized.push(createThemeEntry("patrick"));
    ids.add("spongebob");
    ids.add("patrick");
  }

  if (decor.some((item) => item.asset === "pineapple-house") && !ids.has("pineapple-house")) {
    normalized.push(createThemeEntry("pineapple-house"));
  }

  return normalized;
}
