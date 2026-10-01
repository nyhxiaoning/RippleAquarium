import * as THREE from "three";
import { fishConfig, simulationSettings } from "../config.js";
import { loadFishModel } from "../fish-renderer.js";
import { getFishMeta, getPlantMeta } from "./species-catalog.js";
import { getEcologyMeta } from "../ecology/catalog.js";
import type { EcologyKind } from "../ecology/types.js";
import { getStyleById, listStyleIds } from "./presets.js";
import { buildAquariumScene } from "./scene-builder.js";
import { createFishGrowthRegistry } from "../growth/registry.js";
import { clampOfflineSeconds } from "../growth/calculator.js";
import {
  clearGrowthSnapshot,
  exportGrowthSnapshot,
  loadGrowthSnapshot,
  saveGrowthSnapshot,
} from "../growth/storage.js";
import type { GrowthLoadResult } from "../growth/storage.js";
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
    ecology: descriptor.ecology?.map((entry) => ({ ...entry })),
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
  const growthRegistry = createFishGrowthRegistry();
  // Keep the manager immediately usable for callers that inspect it before
  // init(); init() may replace these records with a persisted snapshot.
  for (const entry of descriptor.fish) growthRegistry.activate(entry.speciesId, entry.count);
  let growthSaveStatus = "empty";
  let growthSaveTimer: ReturnType<typeof setTimeout> | null = null;
  const listeners = new Set<(descriptor: AquariumDescriptor) => void>();

  function reconcileGrowth() {
    const desired = new Map(descriptor.fish.map((entry) => [entry.speciesId, entry.count]));
    const species = new Set([...desired.keys(), ...growthRegistry.getRecords(undefined, true).map((record) => record.speciesId)]);
    for (const speciesId of species) {
      const target = desired.get(speciesId) ?? 0;
      const current = growthRegistry.getStats(speciesId).activeCount;
      if (target > current) growthRegistry.activate(speciesId, target - current);
      else if (target < current) growthRegistry.deactivate(speciesId, current - target);
    }
  }

  function markGrowthDirty() {
    growthSaveStatus = "unsaved";
    if (growthSaveTimer !== null) return;
    growthSaveTimer = setTimeout(() => {
      growthSaveTimer = null;
      saveGrowth();
    }, 10_000);
  }

  function storageOrNull(): Storage | null {
    try {
      return typeof localStorage === "undefined" ? null : localStorage;
    } catch {
      return null;
    }
  }

  function loadGrowth(): GrowthLoadResult {
    const storage = storageOrNull();
    if (!storage) {
      reconcileGrowth();
      growthSaveStatus = "unavailable";
      return { snapshot: null, status: "unavailable" };
    }
    const result = loadGrowthSnapshot(storage, Date.now());
    if (result.snapshot) {
      growthRegistry.replace(result.snapshot);
      const elapsed = clampOfflineSeconds(result.snapshot.savedAt, Date.now(), 24 * 60 * 60);
      growthRegistry.applyOffline(elapsed);
    }
    reconcileGrowth();
    growthSaveStatus = result.status;
    return result;
  }

  function saveGrowth(): "saved" | "unavailable" {
    const storage = storageOrNull();
    if (!storage) {
      growthSaveStatus = "error";
      return "unavailable";
    }
    growthSaveStatus = "saving";
    const result = saveGrowthSnapshot(storage, growthRegistry.snapshot(Date.now()));
    growthSaveStatus = result === "saved" ? "saved" : "error";
    return result;
  }

  function resetGrowth(): "cleared" | "unavailable" {
    const storage = storageOrNull();
    const result = storage ? clearGrowthSnapshot(storage) : "unavailable";
    growthRegistry.replace({ schemaVersion: 1, savedAt: Date.now(), records: [] });
    reconcileGrowth();
    growthSaveStatus = result === "cleared" ? "saved" : "error";
    return result;
  }

  function notify() {
    for (const cb of listeners) cb(descriptor);
  }

  async function rebuild() {
    if (handle) {
      scene.remove(handle.root);
      handle.dispose();
    }
    handle = await buildAquariumScene(descriptor, { renderer, scene, growthRegistry });
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
      if (handle) handle.update(time, dt);
      else if (dt > 0) growthRegistry.advanceOnline(dt);
      if (dt > 0) markGrowthDirty();
    },
    on(event, cb) {
      if (event !== "change") return () => {};
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    async switchStyle(styleId) {
      const style = getStyleById(styleId);
      if (!style) return false;
      const previous = new Map(descriptor.fish.map((entry) => [entry.speciesId, entry.count]));
      const nextSpecies = new Set(style.fish.map((entry) => entry.speciesId));
      for (const entry of descriptor.fish) {
        if (!nextSpecies.has(entry.speciesId)) growthRegistry.deactivate(entry.speciesId, entry.count);
      }
      for (const entry of style.fish) {
        const current = previous.get(entry.speciesId) ?? 0;
        if (entry.count > current) growthRegistry.activate(entry.speciesId, entry.count - current);
        else if (entry.count < current) growthRegistry.deactivate(entry.speciesId, current - entry.count);
      }
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
      const previous = entry.count;
      if (count > previous) growthRegistry.activate(speciesId, count - previous);
      else if (count < previous) growthRegistry.deactivate(speciesId, previous - count);
      entry.count = count;
      handle?.setFishCount(speciesId, count);
      notify();
      return true;
    },
    addFishSpecies(speciesId, count) {
      const meta = getFishMeta(speciesId);
      if (!meta || descriptor.fish.some((f) => f.speciesId === speciesId)) return false;
      if (!handle) return false;
      const requested = count ?? meta.defaultCount;
      growthRegistry.activate(speciesId, requested);
      const school = handle.addFishSpecies(speciesId, requested);
      if (!school) return false;
      descriptor = { ...descriptor, fish: [...descriptor.fish, { speciesId, count: school.getCount() }] };
      notify();
      return true;
    },
    removeFishSpecies(speciesId) {
      if (!descriptor.fish.some((f) => f.speciesId === speciesId)) return false;
      const entry = descriptor.fish.find((f) => f.speciesId === speciesId);
      if (entry) growthRegistry.deactivate(speciesId, entry.count);
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
    setEcologyCount(speciesId: EcologyKind, count: number) {
      const entry = descriptor.ecology?.find((item) => item.speciesId === speciesId);
      if (!entry) return false;
      handle?.setEcologyCount(speciesId, count);
      entry.count = handle?.getEcologyCount(speciesId) ?? entry.count;
      notify();
      return true;
    },
    addEcologySpecies(speciesId: EcologyKind, count) {
      const meta = getEcologyMeta(speciesId);
      const ecology = descriptor.ecology ?? [];
      if (!meta || ecology.some((entry) => entry.speciesId === speciesId) || !handle) return false;
      const school = handle.addEcologySpecies(speciesId, count ?? meta.defaultCount);
      if (!school) return false;
      descriptor = { ...descriptor, ecology: [...ecology, { speciesId, count: school.getCount() }] };
      notify();
      return true;
    },
    removeEcologySpecies(speciesId: EcologyKind) {
      if (!descriptor.ecology?.some((entry) => entry.speciesId === speciesId)) return false;
      handle?.removeEcologySpecies(speciesId);
      descriptor = {
        ...descriptor,
        ecology: descriptor.ecology?.filter((entry) => entry.speciesId !== speciesId),
      };
      notify();
      return true;
    },
    getEcologyCount: (speciesId: EcologyKind) => handle?.getEcologyCount(speciesId) ?? 0,
    getActiveEcology: () => handle?.getActiveEcology() ?? descriptor.ecology ?? [],
    async loadModels() {
      await loadFishModel();
      handle?.refreshFishMeshes();
    },
    async init() {
      loadGrowth();
      await rebuild();
      // Wait for the high-detail fish models before resolving so callers can
      // hide the loading overlay at the right moment.
      await this.loadModels();
    },
    dispose() {
      if (growthSaveTimer !== null) clearTimeout(growthSaveTimer);
      growthSaveTimer = null;
      handle?.dispose();
      handle = null;
      listeners.clear();
    },
    getGrowthRegistry: () => growthRegistry,
    getGrowthStats: (speciesId) => growthRegistry.getStats(speciesId),
    loadGrowth,
    saveGrowth,
    resetGrowth,
    exportGrowth: () => exportGrowthSnapshot(growthRegistry.snapshot(Date.now())),
    getGrowthSaveStatus: () => growthSaveStatus,
    getGrowthRecords: (speciesId, includeInactive = false) => growthRegistry.getRecords(speciesId, includeInactive),
  };
}
