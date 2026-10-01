import type * as THREE from "three";
import type { HabitatLayer, HabitatRegion } from "../aquarium/habitat.js";
import type { SchoolHandle } from "../aquarium/types.js";

/** Non-fish life that can be added to an aquarium scene. */
export type EcologyKind = "anemone" | "urchin" | "shell" | "jellyfish";

export interface EcologyEntry {
  speciesId: EcologyKind;
  count: number;
}

export interface EcologyMeta {
  id: EcologyKind;
  speciesId: EcologyKind;
  name: { zh: string; en: string };
  category: "ecology";
  kind: "anchored" | "bottom" | "drifting";
  layer: HabitatLayer;
  maxCount: number;
  defaultCount: number;
}

/** Dependencies shared by procedural ecology factories. */
export interface EcologyCreateDeps {
  aquariumHalfSize: THREE.Vector3;
  waterLevelY: number;
  aquariumFloorY: number;
  habitat?: Readonly<Record<HabitatLayer, HabitatRegion>>;
  seed?: number;
}

export type EcologySchoolHandle = SchoolHandle;
