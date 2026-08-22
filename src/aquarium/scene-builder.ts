import * as THREE from "three";
import { pineappleHouseDecor, simulationSettings } from "../config.js";
import { addLighting, addObstacles, createAquariumShell } from "../scene-setup.js";
import { createPineappleHouseDecor } from "../decor/pineapple-house.js";
import { createSpongebobPatrickDecor } from "../decor/spongebob-patrick.js";
import { createFishSchool, createPlantSchool } from "./species-catalog.js";
import type {
  AquariumDescriptor,
  AquariumSceneHandle,
  SchoolHandle,
  SpeciesCreateDeps,
} from "./types.js";
import type { ExclusionZone, Obstacle } from "../types.js";

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

export async function buildAquariumScene(
  descriptor: AquariumDescriptor,
  deps: { renderer: THREE.WebGLRenderer; scene: THREE.Scene },
): Promise<AquariumSceneHandle> {
  const { renderer, scene } = deps;
  const root = new THREE.Group();
  root.name = `Aquarium-${descriptor.id}`;

  const halfSize = new THREE.Vector3(
    descriptor.aquarium.halfSize.x,
    descriptor.aquarium.halfSize.y,
    descriptor.aquarium.halfSize.z,
  );
  let waterLevelY = halfSize.y - 0.72;
  let aquariumFloorY = -halfSize.y;

  const lighting = addLighting(root);
  lighting.setIntensity(descriptor.theme.lighting.hemiIntensity);

  const shell = createAquariumShell(root, renderer, halfSize);
  const obstacles = computeObstacles(descriptor.decor, halfSize);
  addObstacles(root, obstacles);

  const exclusionZones = computeExclusionZones(descriptor.decor);
  const clownfishAvoidanceZones = computeClownfishAvoidanceZones(descriptor.decor);

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
  };

  const fishSchools = new Map<string, SchoolHandle>();
  const plantSchools = new Map<string, SchoolHandle>();

  // Plants first: the clownfish school needs the coral reef to avoid.
  for (const entry of descriptor.plants) {
    const school = await createPlantSchool(entry.speciesId, entry.count, speciesDeps);
    if (school) {
      school.group.name = `Plant-${entry.speciesId}`;
      root.add(school.group);
      plantSchools.set(entry.speciesId, school);
    }
  }

  const ctx = { coralReef: plantSchools.get("coral") ?? null };

  function buildFishSchools(entries: AquariumDescriptor["fish"], context: typeof ctx) {
    for (const entry of entries) {
      const school = createFishSchool(entry.speciesId, entry.count, speciesDeps, context);
      if (school) {
        school.group.name = `Fish-${entry.speciesId}`;
        root.add(school.group);
        fishSchools.set(entry.speciesId, school);
      }
    }
  }

  /** Rebuild only the fish schools after their GLBs finish loading, preserving
   *  the coral intro growth state and everything else. */
  function refreshFishMeshes() {
    const context = { coralReef: plantSchools.get("coral") ?? null };
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

  buildFishSchools(descriptor.fish, ctx);

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
    for (const school of fishSchools.values()) {
      school.update(time, dt);
    }
    for (const school of plantSchools.values()) {
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
    shell.resize(halfSize);
    for (const school of fishSchools.values()) {
      school.resize?.(halfSize);
      school.rescalePositions?.(halfSize);
    }
    for (const school of plantSchools.values()) {
      school.resize?.(halfSize);
    }
  }

  function setFishCount(speciesId: string, count: number) {
    fishSchools.get(speciesId)?.setCount(count);
  }

  function setPlantCount(speciesId: string, count: number) {
    plantSchools.get(speciesId)?.setCount(count);
  }

  function addFish(speciesId: string, count: number): SchoolHandle | null {
    if (fishSchools.has(speciesId)) return null;
    const school = createFishSchool(speciesId, count, speciesDeps, ctx);
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

  function dispose() {
    for (const school of fishSchools.values()) school.dispose();
    for (const school of plantSchools.values()) school.dispose();
    fishSchools.clear();
    plantSchools.clear();
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
    getFishCount: (speciesId) => fishSchools.get(speciesId)?.getCount() ?? 0,
    getActiveFish: () => descriptor.fish.map((entry) => ({
      speciesId: entry.speciesId,
      count: fishSchools.get(entry.speciesId)?.getCount() ?? entry.count,
    })),
    getActivePlants: () => descriptor.plants.map((entry) => ({
      speciesId: entry.speciesId,
      count: plantSchools.get(entry.speciesId)?.getCount() ?? entry.count,
    })),
    getWaterLevelY: () => waterLevelY,
    getAquariumFloorY: () => aquariumFloorY,
    getHalfSize: () => halfSize,
    getWaterSurface: () => shell.waterSurface,
    getFish: (speciesId, index) => fishSchools.get(speciesId)?.getFish?.(index) ?? undefined,
    getLighting: () => lighting,
    setBoidsSettings(speciesId, settings) {
      fishSchools.get(speciesId)?.setSettings?.(settings);
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
  };
}