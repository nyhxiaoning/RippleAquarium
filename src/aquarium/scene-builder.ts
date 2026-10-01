import * as THREE from "three";
import { pineappleHouseDecor, simulationSettings } from "../config.js";
import { addLighting, addObstacles, createAquariumShell } from "../scene-setup.js";
import { createPineappleHouseDecor } from "../decor/pineapple-house.js";
import { createSpongebobPatrickDecor } from "../decor/spongebob-patrick.js";
import { createFishSchool, createPlantSchool, getFishMeta } from "./species-catalog.js";
import { createEcologySchool } from "../ecology/catalog.js";
import type { EcologyEntry, EcologyKind } from "../ecology/types.js";
import { createHabitatLayout } from "./habitat.js";
import type {
  AquariumDescriptor,
  AquariumSceneHandle,
  SchoolHandle,
  SpeciesCreateDeps,
} from "./types.js";
import type { ExclusionZone, Obstacle } from "../types.js";
import { getWeatherEffects } from "../weather/effects.js";
import type { WeatherEffects, WeatherState } from "../weather/types.js";

const PINEAPPLE_OBSTACLE_SIZE = new THREE.Vector3(4.35, 5.1, 4.05);
const PINEAPPLE_FOOTPRINT_RADIUS = 3.53;
const SPONGEBOB_FOOTPRINT_RADIUS = 1.65;
const FRONT_CORAL_MASK_OFFSET = new THREE.Vector3(0.8, 0, 4.35);
const FRONT_CORAL_MASK_SIZE = new THREE.Vector2(5.5, 3.75);

function findDecor(decor: AquariumDescriptor["decor"], asset: string) {
  return decor.find((item) => item.asset === asset);
}

function computeObstacles(decor: AquariumDescriptor["decor"], halfSize: THREE.Vector3): Obstacle[] {
  const pineapple = findDecor(decor, "pineapple-house");
  if (!pineapple) return [];
  return [
    {
      position: new THREE.Vector3(
        pineapple.position.x,
        -halfSize.y + pineapple.height * 0.42,
        pineapple.position.z,
      ),
      shape: "box",
      size: PINEAPPLE_OBSTACLE_SIZE.clone(),
      rotationY: pineapple.rotationY ?? 0,
      render: false,
    },
  ];
}

function computeExclusionZones(decor: AquariumDescriptor["decor"]): ExclusionZone[] {
  const zones: ExclusionZone[] = [];
  const pineapple = findDecor(decor, "pineapple-house");
  if (pineapple) {
    zones.push({
      position: new THREE.Vector3(pineapple.position.x, 0, pineapple.position.z),
      radius: PINEAPPLE_FOOTPRINT_RADIUS,
    });
    zones.push({
      position: new THREE.Vector3(
        pineapple.position.x + FRONT_CORAL_MASK_OFFSET.x,
        0,
        pineapple.position.z + FRONT_CORAL_MASK_OFFSET.z,
      ),
      shape: "box",
      size: FRONT_CORAL_MASK_SIZE.clone(),
    });
  }
  return zones;
}

function computeClownfishAvoidanceZones(decor: AquariumDescriptor["decor"]): ExclusionZone[] {
  const zones: ExclusionZone[] = [];
  const pineapple = findDecor(decor, "pineapple-house");
  if (pineapple) {
    zones.push({
      position: new THREE.Vector3(pineapple.position.x, 0, pineapple.position.z),
      radius: PINEAPPLE_FOOTPRINT_RADIUS + 0.55,
      strength: 2.2,
    });
  }
  const spongebob = findDecor(decor, "spongebob-patrick");
  if (spongebob) {
    zones.push({
      position: new THREE.Vector3(spongebob.position.x, 0, spongebob.position.z),
      radius: SPONGEBOB_FOOTPRINT_RADIUS + 0.45,
      strength: 2.8,
    });
  }
  if (pineapple) {
    zones.push({
      position: new THREE.Vector3(
        pineapple.position.x + FRONT_CORAL_MASK_OFFSET.x,
        0,
        pineapple.position.z + FRONT_CORAL_MASK_OFFSET.z,
      ),
      shape: "box",
      size: FRONT_CORAL_MASK_SIZE.clone().add(new THREE.Vector2(0.7, 0.65)),
      strength: 2.5,
    });
  }
  return zones;
}

function collectAnemoneAnchors(school: SchoolHandle | undefined): THREE.Vector3[] {
  if (!school) return [];
  const mesh = school.group.children.find(
    (child): child is THREE.InstancedMesh => child instanceof THREE.InstancedMesh,
  );
  if (!mesh) return [];

  const anchors: THREE.Vector3[] = [];
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  for (let index = 0; index < mesh.count; index += 1) {
    mesh.getMatrixAt(index, matrix);
    matrix.decompose(position, quaternion, scale);
    anchors.push(position.clone());
  }
  return anchors;
}

export async function buildAquariumScene(
  descriptor: AquariumDescriptor,
  deps: { renderer: THREE.WebGLRenderer; scene: THREE.Scene; growthRegistry: import("../growth/registry.js").FishGrowthRegistry },
): Promise<AquariumSceneHandle> {
  const { renderer, scene, growthRegistry } = deps;
  const root = new THREE.Group();
  root.name = `Aquarium-${descriptor.id}`;

  const halfSize = new THREE.Vector3(
    descriptor.aquarium.halfSize.x,
    descriptor.aquarium.halfSize.y,
    descriptor.aquarium.halfSize.z,
  );
  let waterLevelY = halfSize.y - 0.72;
  let aquariumFloorY = -halfSize.y;

  const lighting = addLighting(root, halfSize);
  lighting.setIntensity(descriptor.theme.lighting.hemiIntensity);
  scene.background = new THREE.Color(descriptor.theme.backgroundColor);

  const shell = createAquariumShell(root, renderer, halfSize);
  const obstacles = computeObstacles(descriptor.decor, halfSize);
  addObstacles(root, obstacles);

  const exclusionZones = computeExclusionZones(descriptor.decor);
  const clownfishAvoidanceZones = computeClownfishAvoidanceZones(descriptor.decor);
  let habitatLayout = createHabitatLayout({ x: halfSize.x, y: halfSize.y, z: halfSize.z });

  const speciesDeps: SpeciesCreateDeps = {
    scene: root,
    renderer,
    aquariumHalfSize: halfSize,
    waterLevelY,
    aquariumFloorY,
    obstacles,
    exclusionZones,
    clownfishAvoidanceZones,
    settings: { ...simulationSettings },
    seed: 73,
    growthRegistry,
    habitatLayout,
  };
  const ecologyDeps = {
    aquariumHalfSize: halfSize,
    waterLevelY,
    aquariumFloorY,
    habitat: habitatLayout,
    seed: 73,
  };

  const fishSchools = new Map<string, SchoolHandle>();
  const plantSchools = new Map<string, SchoolHandle>();
  const ecologySchools = new Map<EcologyKind, SchoolHandle>();
  const ecologyEntries: EcologyEntry[] = (descriptor.ecology ?? []).map((entry) => ({ ...entry }));
  let weatherEffects: WeatherEffects = getWeatherEffects("clear");
  let weatherState: WeatherState = Object.freeze({
    kind: "clear",
    progress: 1,
    remainingSeconds: 90,
    autoCycle: true,
  });
  let lastLightningCheck = -Infinity;
  let lightningFlashUntil = -Infinity;
  const baseBoidsSettings = new Map<string, Record<string, number>>();

  function applyWeatherBoidsSettings() {
    for (const [speciesId, base] of baseBoidsSettings) {
      const school = fishSchools.get(speciesId);
      if (!school) continue;
      school.setSettings?.({
        ...base,
        minSpeed: (base.minSpeed ?? simulationSettings.minSpeed) * weatherEffects.fishSpeedMultiplier,
        maxSpeed: (base.maxSpeed ?? simulationSettings.maxSpeed) * weatherEffects.fishSpeedMultiplier,
      });
    }
  }

  // Plants first: the clownfish school needs the coral reef to avoid.
  for (const entry of descriptor.plants) {
    const school = await createPlantSchool(entry.speciesId, entry.count, speciesDeps);
    if (school) {
      school.group.name = `Plant-${entry.speciesId}`;
      root.add(school.group);
      plantSchools.set(entry.speciesId, school);
    }
  }

  for (const entry of ecologyEntries) {
    const school = createEcologySchool(entry.speciesId, entry.count, ecologyDeps);
    if (school) {
      school.group.name = `Ecology-${entry.speciesId}`;
      root.add(school.group);
      ecologySchools.set(entry.speciesId, school);
      entry.count = school.getCount();
    }
  }

  const createFishContext = () => ({
    coralReef: plantSchools.get("coral") ?? null,
    anemonePositions: collectAnemoneAnchors(ecologySchools.get("anemone")),
  });

  function buildFishSchools(entries: AquariumDescriptor["fish"], context = createFishContext()) {
    for (const entry of entries) {
      const school = createFishSchool(entry.speciesId, entry.count, speciesDeps, context);
      if (school) {
        school.group.name = `Fish-${entry.speciesId}`;
        root.add(school.group);
        fishSchools.set(entry.speciesId, school);
        if (!baseBoidsSettings.has(entry.speciesId)) {
          baseBoidsSettings.set(entry.speciesId, {
            minSpeed: speciesDeps.settings.minSpeed,
            maxSpeed: speciesDeps.settings.maxSpeed,
          });
        }
      }
    }
    applyWeatherBoidsSettings();
  }

  /** Rebuild only the fish schools after their GLBs finish loading, preserving
   *  the coral intro growth state and everything else. */
  function refreshFishMeshes() {
    const context = createFishContext();
    for (const entry of descriptor.fish) {
      const old = fishSchools.get(entry.speciesId);
      if (old) {
        root.remove(old.group);
        old.dispose();
        fishSchools.delete(entry.speciesId);
      }
    }
    buildFishSchools(descriptor.fish, context);
  }

  buildFishSchools(descriptor.fish);

  // Decor models (pineapple house, spongebob & patrick) stream in async.
  for (const item of descriptor.decor) {
    const position = new THREE.Vector3(item.position.x, item.position.y, item.position.z);
    const object =
      item.asset === "pineapple-house"
        ? await createPineappleHouseDecor({
            ...pineappleHouseDecor,
            position,
            rotationY: item.rotationY ?? pineappleHouseDecor.rotationY,
            height: item.height,
          })
        : await createSpongebobPatrickDecor({
            position,
            height: item.height,
          });
    if (object) {
      object.name = `Decor-${item.asset}`;
      root.add(object);
    }
  }

  scene.add(root);

  function update(time: number, dt: number) {
    if (dt > 0) growthRegistry.advanceOnline(dt * weatherEffects.growthRateMultiplier);
    if (weatherEffects.lightningChance > 0 && time >= lastLightningCheck + 1.5) {
      lastLightningCheck = time;
      // A deterministic, throttled check keeps storm flashes rare without
      // allocating random state or making a frame-dependent visual effect.
      const roll = (Math.sin(time * 12.9898 + 78.233) * 43758.5453) % 1;
      if (Math.abs(roll) < weatherEffects.lightningChance) {
        lightningFlashUntil = time + 0.16;
      }
    }
    lighting.setLightningFlash?.(time < lightningFlashUntil ? 2.4 : 1);
    for (const school of fishSchools.values()) {
      school.update(time, dt);
      const ids = school.getFishIds();
      school.setGrowthSizes(ids.map((id) => growthRegistry.getRecord(id)?.sizeMultiplier ?? 1));
    }
    for (const school of plantSchools.values()) {
      school.update(time, dt);
    }
    for (const school of ecologySchools.values()) {
      school.update(time, dt);
    }
    shell.update(time);
  }

  function resize(nextHalfSize: THREE.Vector3) {
    halfSize.copy(nextHalfSize);
    waterLevelY = halfSize.y - 0.72;
    aquariumFloorY = -halfSize.y;
    speciesDeps.waterLevelY = waterLevelY;
    speciesDeps.aquariumFloorY = aquariumFloorY;
    ecologyDeps.waterLevelY = waterLevelY;
    ecologyDeps.aquariumFloorY = aquariumFloorY;
    habitatLayout = createHabitatLayout({ x: halfSize.x, y: halfSize.y, z: halfSize.z });
    speciesDeps.habitatLayout = habitatLayout;
    ecologyDeps.habitat = habitatLayout;
    lighting.resize?.(halfSize);
    shell.resize(halfSize);
    for (const entry of descriptor.fish) {
      const school = fishSchools.get(entry.speciesId);
      if (!school) continue;
      const layer = getFishMeta(entry.speciesId)?.habitatLayer;
      school.setAllowedRegion?.(layer ? habitatLayout[layer] : undefined);
      school.resize?.(halfSize);
      school.rescalePositions?.(halfSize);
    }
    for (const school of plantSchools.values()) {
      school.resize?.(halfSize);
    }
    for (const school of ecologySchools.values()) {
      school.resize?.(halfSize);
    }
    refreshClownfishHabitatAnchors();
  }

  function setFishCount(speciesId: string, count: number) {
    const school = fishSchools.get(speciesId);
    school?.setCount(count);
    if (school) {
      const ids = school.getFishIds();
      school.setGrowthSizes(ids.map((id) => growthRegistry.getRecord(id)?.sizeMultiplier ?? 1));
    }
  }

  function setPlantCount(speciesId: string, count: number) {
    plantSchools.get(speciesId)?.setCount(count);
  }

  function addFish(speciesId: string, count: number): SchoolHandle | null {
    if (fishSchools.has(speciesId)) return null;
    const school = createFishSchool(speciesId, count, speciesDeps, createFishContext());
    if (!school) return null;
    school.group.name = `Fish-${speciesId}`;
    root.add(school.group);
    fishSchools.set(speciesId, school);
    return school;
  }

  function removeFish(speciesId: string) {
    const school = fishSchools.get(speciesId);
    if (!school) return;
    school.dispose();
    root.remove(school.group);
    fishSchools.delete(speciesId);
    baseBoidsSettings.delete(speciesId);
  }

  async function addPlant(speciesId: string, count: number): Promise<SchoolHandle | null> {
    if (plantSchools.has(speciesId)) return null;
    const school = await createPlantSchool(speciesId, count, speciesDeps);
    if (!school) return null;
    school.group.name = `Plant-${speciesId}`;
    root.add(school.group);
    plantSchools.set(speciesId, school);
    return school;
  }

  function removePlant(speciesId: string) {
    const school = plantSchools.get(speciesId);
    if (!school) return;
    school.dispose();
    root.remove(school.group);
    plantSchools.delete(speciesId);
  }

  function setEcologyCount(speciesId: EcologyKind, count: number) {
    const school = ecologySchools.get(speciesId);
    if (!school) return;
    school.setCount(count);
    const entry = ecologyEntries.find((item) => item.speciesId === speciesId);
    if (entry) entry.count = school.getCount();
    refreshClownfishHabitatAnchors();
  }

  function addEcology(speciesId: EcologyKind, count: number): SchoolHandle | null {
    if (ecologySchools.has(speciesId)) return null;
    const school = createEcologySchool(speciesId, count, ecologyDeps);
    if (!school) return null;
    school.group.name = `Ecology-${speciesId}`;
    root.add(school.group);
    ecologySchools.set(speciesId, school);
    ecologyEntries.push({ speciesId, count: school.getCount() });
    refreshClownfishHabitatAnchors();
    return school;
  }

  function removeEcology(speciesId: EcologyKind) {
    const school = ecologySchools.get(speciesId);
    if (!school) return;
    school.dispose();
    root.remove(school.group);
    ecologySchools.delete(speciesId);
    const index = ecologyEntries.findIndex((entry) => entry.speciesId === speciesId);
    if (index >= 0) ecologyEntries.splice(index, 1);
    refreshClownfishHabitatAnchors();
  }

  function refreshClownfishHabitatAnchors() {
    const school = fishSchools.get("clownfish") as (SchoolHandle & {
      setHabitatAnchors?: (positions: readonly THREE.Vector3[]) => void;
    }) | undefined;
    school?.setHabitatAnchors?.(collectAnemoneAnchors(ecologySchools.get("anemone")));
  }

  function dispose() {
    for (const school of fishSchools.values()) school.dispose();
    for (const school of plantSchools.values()) school.dispose();
    for (const school of ecologySchools.values()) school.dispose();
    fishSchools.clear();
    plantSchools.clear();
    ecologySchools.clear();
    baseBoidsSettings.clear();
    shell.dispose();
    lighting; // lights are part of the root group, cleared with it
    root.clear();
  }

  return {
    root,
    update,
    dispose,
    resize,
    setFishCount,
    addFishSpecies: addFish,
    removeFishSpecies: removeFish,
    setPlantCount,
    addPlantSpecies: addPlant,
    removePlantSpecies: removePlant,
    setEcologyCount,
    addEcologySpecies: addEcology,
    removeEcologySpecies: removeEcology,
    getFishCount: (speciesId) => fishSchools.get(speciesId)?.getCount() ?? 0,
    getActiveFish: () => descriptor.fish.map((entry) => ({
      speciesId: entry.speciesId,
      count: fishSchools.get(entry.speciesId)?.getCount() ?? entry.count,
    })),
    getActivePlants: () => descriptor.plants.map((entry) => ({
      speciesId: entry.speciesId,
      count: plantSchools.get(entry.speciesId)?.getCount() ?? entry.count,
    })),
    getEcologyCount: (speciesId) => ecologySchools.get(speciesId)?.getCount() ?? 0,
    getActiveEcology: () => ecologyEntries.map((entry) => ({
      speciesId: entry.speciesId,
      count: ecologySchools.get(entry.speciesId)?.getCount() ?? entry.count,
    })),
    getWaterLevelY: () => waterLevelY,
    getAquariumFloorY: () => aquariumFloorY,
    getHalfSize: () => halfSize,
    getWaterSurface: () => shell.waterSurface,
    getFish: (speciesId, index) => fishSchools.get(speciesId)?.getFish?.(index) ?? undefined,
    getLighting: () => lighting,
    setBoidsSettings(speciesId, settings) {
      const base = {
        ...(baseBoidsSettings.get(speciesId) ?? {}),
        ...settings,
      };
      baseBoidsSettings.set(speciesId, base);
      const weathered = {
        ...base,
        minSpeed: (base.minSpeed ?? simulationSettings.minSpeed) * weatherEffects.fishSpeedMultiplier,
        maxSpeed: (base.maxSpeed ?? simulationSettings.maxSpeed) * weatherEffects.fishSpeedMultiplier,
      };
      fishSchools.get(speciesId)?.setSettings?.(weathered);
    },
    setPlantSettings(speciesId, settings) {
      plantSchools.get(speciesId)?.setSettings?.(settings);
    },
    setCoralGrowth(count, scale, growth) {
      const school = plantSchools.get("coral");
      school?.rebuildWithGrowth?.(count, scale, growth);
    },
    getCoralMaxCount() {
      return plantSchools.get("coral")?.getMaxCount?.() ?? 0;
    },
    refreshFishMeshes,
    setWeatherEffects(effects, state) {
      weatherEffects = effects;
      if (state) weatherState = Object.freeze({ ...state });
      lighting.setWeatherMultiplier?.(effects.lightingMultiplier);
      shell.waterSurface.setWeatherEffects?.(effects);
      applyWeatherBoidsSettings();
      if (scene.background instanceof THREE.Color) {
        scene.background.set(effects.backgroundColor);
      }
    },
    getWeatherState: () => weatherState,
  };
}
