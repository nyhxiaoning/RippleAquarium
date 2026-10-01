import type { SchoolHandle } from "../aquarium/types.js";
import { createEcologySchool as createSchool } from "./school.js";
import type { EcologyCreateDeps, EcologyKind, EcologyMeta } from "./types.js";

export const ECOLOGY_CATALOG: readonly EcologyMeta[] = [
  {
    id: "anemone",
    speciesId: "anemone",
    name: { zh: "海葵", en: "Anemone" },
    category: "ecology",
    kind: "anchored",
    layer: "reef",
    maxCount: 36,
    defaultCount: 12,
  },
  {
    id: "urchin",
    speciesId: "urchin",
    name: { zh: "海胆", en: "Sea Urchin" },
    category: "ecology",
    kind: "bottom",
    layer: "lower",
    maxCount: 32,
    defaultCount: 10,
  },
  {
    id: "shell",
    speciesId: "shell",
    name: { zh: "贝壳", en: "Shell" },
    category: "ecology",
    kind: "anchored",
    layer: "lower",
    maxCount: 48,
    defaultCount: 18,
  },
  {
    id: "jellyfish",
    speciesId: "jellyfish",
    name: { zh: "水母", en: "Jellyfish" },
    category: "ecology",
    kind: "drifting",
    layer: "upper",
    maxCount: 24,
    defaultCount: 8,
  },
];

export function getEcologyMeta(kind: string): EcologyMeta | undefined {
  return ECOLOGY_CATALOG.find((meta) => meta.id === kind);
}

export function createEcologySchool(
  kind: EcologyKind | string,
  count: number,
  deps: EcologyCreateDeps,
): SchoolHandle | null {
  const meta = getEcologyMeta(kind);
  if (!meta) return null;
  return createSchool(meta.id, count, deps, meta.maxCount);
}
