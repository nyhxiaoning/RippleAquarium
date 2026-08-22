import * as THREE from "three";
import type { ExclusionZone, FishState, Obstacle, SimulationSettings } from "../types.js";

/** Plain serializable 3D vector (no Three.js dependency for presets/tests). */
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface AquariumTheme {
  waterBaseColor: number;
  waterHighlightColor: number;
  glassColor: number;
  backgroundColor: number;
  lighting: {
    hemiIntensity: number;
    sunIntensity: number;
  };
}

export interface DecorItem {
  id: string;
  asset: "pineapple-house" | "spongebob-patrick";
  position: Vec3;
  rotationY?: number;
  height: number;
}

export interface FishEntry {
  speciesId: string;
  count: number;
}

export interface PlantEntry {
  speciesId: string;
  count: number;
}

/** A full, serializable description of an aquarium scene. Pure data — no Three.js. */
export interface AquariumDescriptor {
  id: string;
  name: { zh: string; en: string };
  aquarium: { halfSize: Vec3 };
  theme: AquariumTheme;
  decor: DecorItem[];
  fish: FishEntry[];
  plants: PlantEntry[];
}

export type AquariumStyle = AquariumDescriptor;

/** Metadata describing an addable species, used to drive the UI list. */
export interface SpeciesMeta {
  id: string;
  name: { zh: string; en: string };
  category: "fish" | "plant";
  kind: "schooling" | "bottom" | "anchored";
  maxCount: number;
  defaultCount: number;
}

/** Minimal structural view of a coral reef, needed by the clownfish school. */
export interface CoralReefLike {
  corals: {
    visible: boolean;
    position: THREE.Vector3;
    scale: number;
  }[];
}

/** A live, buildable school of one species. Returned by species factories. */
export interface SchoolHandle {
  group: THREE.Object3D;
  update(time: number, dt: number): void;
  dispose(): void;
  setCount(n: number): void;
  getCount(): number;
  resize?(halfSize: THREE.Vector3): void;
  /** Coral reef backing the clownfish school (only set for the coral plant). */
  reef?: CoralReefLike;
  /** Clamp member positions into new bounds after a resize (schooling fish). */
  rescalePositions?(halfSize: THREE.Vector3): void;
  /** Expose a member's state for the fish-view camera (schooling fish). */
  getFish?(index: number): FishState | undefined;
}

/** Dependencies handed to species factories so they can reuse existing loaders. */
export interface SpeciesCreateDeps {
  scene: THREE.Object3D;
  renderer: THREE.WebGLRenderer;
  aquariumHalfSize: THREE.Vector3;
  waterLevelY: number;
  aquariumFloorY: number;
  obstacles: Obstacle[];
  exclusionZones: ExclusionZone[];
  clownfishAvoidanceZones: ExclusionZone[];
  settings: SimulationSettings;
  seed: number;
}

/** Live handle for one fully-built aquarium scene. Owned by the manager. */
export interface AquariumSceneHandle {
  root: THREE.Group;
  update(time: number, dt: number): void;
  dispose(): void;
  resize(halfSize: Vec3): void;
  setFishCount(speciesId: string, count: number): void;
  addFishSpecies(speciesId: string, count?: number): SchoolHandle | null;
  removeFishSpecies(speciesId: string): void;
  setPlantCount(speciesId: string, count: number): void;
  addPlantSpecies(speciesId: string, count?: number): Promise<SchoolHandle | null>;
  removePlantSpecies(speciesId: string): void;
  getFishCount(speciesId: string): number;
  getActiveFish(): FishEntry[];
  getActivePlants(): PlantEntry[];
  getWaterLevelY(): number;
  getAquariumFloorY(): number;
  getHalfSize(): THREE.Vector3;
  getWaterSurface(): { queueImpact(from: THREE.Vector3, to?: THREE.Vector3 | null): void; setSettings(settings: Record<string, number>): void };
  getFish(speciesId: string, index: number): FishState | undefined;
}

export type ManagerEvent = "change";

/** Public interface of the aquarium project manager. */
export interface AquariumManager {
  switchStyle(styleId: string): boolean;
  resize(size: Vec3): void;
  addFishSpecies(speciesId: string, count?: number): boolean;
  removeFishSpecies(speciesId: string): boolean;
  setFishCount(speciesId: string, count: number): boolean;
  addPlantSpecies(speciesId: string, count?: number): boolean;
  removePlantSpecies(speciesId: string): boolean;
  setPlantCount(speciesId: string, count: number): boolean;
  getDescriptor(): AquariumDescriptor;
  getStyleIds(): string[];
  getHalfSize(): Vec3;
  on(event: ManagerEvent, callback: (descriptor: AquariumDescriptor) => void): () => void;
  dispose(): void;
}