import * as THREE from "three";
import { fishConfig, simulationSettings } from "../config.js";
import { loadFishModel } from "../fish-renderer.js";
import { getFishMeta, getPlantMeta } from "./species-catalog.js";
import { getStyleById, listStyleIds } from "./presets.js";
import { buildAquariumScene } from "./scene-builder.js";
import type {
  AquariumDescriptor,
  AquariumManager,
  AquariumSceneHandle,
} from "./types.js";

function volume(halfSize: { x: number; y: number; z: number }) {
  return halfSize.x * 2 * halfSize.y * 2 * halfSize.z * 2;
}

// When the tank shrinks, scale each species' count with the volume change so a
// small tank is not overcrowded. Enlarging the tank never spawns fish — density
// falls on its own, and counts stay at whatever the user/preset set.
function clampFishCounts(
  fish: AquariumDescriptor["fish"],
  halfSize: { x: number; y: number; z: number },
  prevVolume: number,
): AquariumDescriptor["fish"] {
  const newVolume = volume(halfSize);
  if (prevVolume <= 0 || newVolume >= prevVolume) {
    return fish.map((entry) => ({ ...entry }));
  }
  const ratio = newVolume / prevVolume;
  return fish.map((entry) => {
    const scaled = Math.max(0, Math.round(entry.count * ratio));
    const meta = getFishMeta(entry.speciesId);
    const max = meta?.maxCount ?? entry.count;
    return { ...entry, count: Math.min(scaled, max) };
  });
}

function cloneDescriptor(descriptor: AquariumDescriptor): AquariumDescriptor {
  return {
    ...descriptor,
    aquarium: {
      ...descriptor.aquarium,
      halfSize: { ...descriptor.aquarium.halfSize },
    },
    theme: {
      ...descriptor.theme,
      lighting: { ...descriptor.theme.lighting },
    },
    decor: descriptor.decor.map((item) => ({ ...item })),
    fish: descriptor.fish.map((entry) => ({ ...entry })),
    plants: descriptor.plants.map((entry) => ({ ...entry })),
  };
}

export function createAquariumManager(
  initialDescriptor: AquariumDescriptor,
  deps: { renderer: THREE.WebGLRenderer; scene: THREE.Scene; cameraRig: { configure(halfSize: THREE.Vector3): void } },
): AquariumManager {
  const { renderer, scene, cameraRig } = deps;
  // Work on a private copy so adjusting counts never mutates the shared preset.
  let descriptor = cloneDescriptor(initialDescriptor);
  let handle: AquariumSceneHandle | null = null;
  const listeners = new Set<(descriptor: AquariumDescriptor) => void>();

  function notify() {
    for (const cb of listeners) cb(descriptor);
  }

  async function rebuild() {
    if (handle) {
      scene.remove(handle.root);
      handle.dispose();
    }
    handle = await buildAquariumScene(descriptor, { renderer, scene });
    cameraRig.configure(
      new THREE.Vector3(
        descriptor.aquarium.halfSize.x,
        descriptor.aquarium.halfSize.y,
        descriptor.aquarium.halfSize.z,
      ),
    );
    notify();
  }

  return {
    getDescriptor: () => descriptor,
    getStyleIds: listStyleIds,
    getHalfSize: () => descriptor.aquarium.halfSize,
    getWaterLevelY: () => handle!.getWaterLevelY(),
    getWaterSurface: () => handle!.getWaterSurface(),
    getLighting: () => handle!.getLighting(),
    getCameraFish: () => handle?.getFish?.("sardine", fishConfig.highlightedIndex) ?? null,
    setBoidsSettings(speciesId, settings) {
      handle?.setBoidsSettings(speciesId, settings);
    },
    setBoidsSpeedScale(speciesId, scale) {
      const base = simulationSettings;
      const normalizedScale = Number.isFinite(scale) ? scale : 1;
      handle?.setBoidsSettings(speciesId, {
        minSpeed: base.minSpeed * normalizedScale,
        maxSpeed: base.maxSpeed * normalizedScale,
      });
    },
    setPlantSettings(speciesId, settings) {
      handle?.setPlantSettings(speciesId, settings);
    },
    setCoralGrowth(count, scale, growth) {
      handle?.setCoralGrowth(count, scale, growth);
    },
    getCoralMaxCount: () => handle!.getCoralMaxCount(),
    update(time, dt) {
      handle?.update(time, dt);
    },
    on(event, cb) {
      if (event !== "change") return () => {};
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    async switchStyle(styleId) {
      const style = getStyleById(styleId);
      if (!style) return false;
      descriptor = cloneDescriptor(style);
      await rebuild();
      return true;
    },
    resize(size) {
      const prevVolume = volume(descriptor.aquarium.halfSize);
      descriptor = {
        ...descriptor,
        aquarium: { ...descriptor.aquarium, halfSize: { ...size } },
      };
      const halfSize = new THREE.Vector3(size.x, size.y, size.z);
      handle?.resize(halfSize);
      cameraRig.configure(halfSize);

      // Clamp fish counts to the new volume so a small tank is not overcrowded.
      const clampedFish = clampFishCounts(descriptor.fish, descriptor.aquarium.halfSize, prevVolume);
      for (const entry of clampedFish) {
        if (entry.count !== descriptor.fish.find((f) => f.speciesId === entry.speciesId)!.count) {
          handle?.setFishCount(entry.speciesId, entry.count);
        }
      }
      descriptor = { ...descriptor, fish: clampedFish };
      notify();
    },
    setFishCount(speciesId, count) {
      const entry = descriptor.fish.find((f) => f.speciesId === speciesId);
      if (!entry) return false;
      entry.count = count;
      handle?.setFishCount(speciesId, count);
      notify();
      return true;
    },
    addFishSpecies(speciesId, count) {
      const meta = getFishMeta(speciesId);
      if (!meta || descriptor.fish.some((f) => f.speciesId === speciesId)) return false;
      const school = handle?.addFishSpecies(speciesId, count ?? meta.defaultCount);
      if (!school) return false;
      descriptor = { ...descriptor, fish: [...descriptor.fish, { speciesId, count: school.getCount() }] };
      notify();
      return true;
    },
    removeFishSpecies(speciesId) {
      if (!descriptor.fish.some((f) => f.speciesId === speciesId)) return false;
      handle?.removeFishSpecies(speciesId);
      descriptor = { ...descriptor, fish: descriptor.fish.filter((f) => f.speciesId !== speciesId) };
      notify();
      return true;
    },
    setPlantCount(speciesId, count) {
      const entry = descriptor.plants.find((p) => p.speciesId === speciesId);
      if (!entry) return false;
      entry.count = count;
      handle?.setPlantCount(speciesId, count);
      notify();
      return true;
    },
    async addPlantSpecies(speciesId, count) {
      const meta = getPlantMeta(speciesId);
      if (!meta || descriptor.plants.some((p) => p.speciesId === speciesId)) return false;
      const school = await handle?.addPlantSpecies(speciesId, count ?? meta.defaultCount);
      if (!school) return false;
      descriptor = { ...descriptor, plants: [...descriptor.plants, { speciesId, count: school.getCount() }] };
      notify();
      return true;
    },
    removePlantSpecies(speciesId) {
      if (!descriptor.plants.some((p) => p.speciesId === speciesId)) return false;
      handle?.removePlantSpecies(speciesId);
      descriptor = { ...descriptor, plants: descriptor.plants.filter((p) => p.speciesId !== speciesId) };
      notify();
      return true;
    },
    async loadModels() {
      await loadFishModel();
      handle?.refreshFishMeshes();
    },
    async init() {
      await rebuild();
      // Wait for the high-detail fish models before resolving so callers can
      // hide the loading overlay at the right moment.
      await this.loadModels();
    },
    dispose() {
      handle?.dispose();
      handle = null;
      listeners.clear();
    },
  };
}