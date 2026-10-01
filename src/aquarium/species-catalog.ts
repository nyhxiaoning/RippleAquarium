import * as THREE from "three";
import { FishSchoolSimulation } from "../fish-school-simulation.js";
import {
  createFishMeshByKey,
  disposeFishMesh,
  setFishMeshCount,
  updateFishInstances,
} from "../fish-renderer.js";
import { createClownfishSchool } from "../clownfish-school.js";
import { createCoralReef } from "../coral-reef.js";
import type {
  SchoolHandle,
  SpeciesCreateDeps,
} from "./types.js";
import { createHabitatLayout, type HabitatLayer, type HabitatRegion } from "./habitat.js";

export interface FishCatalogEntry {
  id: string;
  name: { zh: string; en: string };
  kind: "schooling" | "bottom";
  maxCount: number;
  defaultCount: number;
  /** Procedural/GLB model key used by the shared instanced renderer. */
  modelKey?: string;
  /** Preferred habitat, consumed by the habitat-aware school task. */
  habitatLayer?: HabitatLayer;
  /** Species-specific boids speed multiplier. */
  defaultSpeedScale?: number;
  /** Species-specific adult size multiplier. */
  growthScale?: number;
}

export interface PlantCatalogEntry {
  id: string;
  name: { zh: string; en: string };
  maxCount: number;
  defaultCount: number;
}

export const FISH_CATALOG: FishCatalogEntry[] = [
  { id: "sardine", name: { zh: "沙丁鱼", en: "Sardine" }, kind: "schooling", maxCount: 260, defaultCount: 60, modelKey: "cartoon", habitatLayer: "middle", defaultSpeedScale: 1, growthScale: 1 },
  { id: "koi", name: { zh: "锦鲤", en: "Koi" }, kind: "schooling", maxCount: 120, defaultCount: 24, modelKey: "koi", habitatLayer: "middle", defaultSpeedScale: 0.82, growthScale: 1.08 },
  { id: "clownfish", name: { zh: "小丑鱼", en: "Clownfish" }, kind: "bottom", maxCount: 40, defaultCount: 18, modelKey: "clown", habitatLayer: "reef", defaultSpeedScale: 0.45, growthScale: 0.78 },
  { id: "starfish", name: { zh: "海星", en: "Starfish" }, kind: "bottom", maxCount: 30, defaultCount: 14, modelKey: "starfish", habitatLayer: "lower", defaultSpeedScale: 0.2, growthScale: 0.9 },
  { id: "angelfish", name: { zh: "天使鱼", en: "Angelfish" }, kind: "schooling", maxCount: 60, defaultCount: 12, modelKey: "angelfish", habitatLayer: "middle", defaultSpeedScale: 0.82, growthScale: 1.05 },
  { id: "blue-tang", name: { zh: "蓝吊鱼", en: "Blue Tang" }, kind: "schooling", maxCount: 50, defaultCount: 10, modelKey: "blue-tang", habitatLayer: "upper", defaultSpeedScale: 1.08, growthScale: 0.98 },
  { id: "pufferfish", name: { zh: "河豚", en: "Pufferfish" }, kind: "schooling", maxCount: 24, defaultCount: 6, modelKey: "pufferfish", habitatLayer: "lower", defaultSpeedScale: 0.52, growthScale: 1.12 },
];

export const PLANT_CATALOG: PlantCatalogEntry[] = [
  { id: "coral", name: { zh: "珊瑚", en: "Coral" }, maxCount: 200, defaultCount: 100 },
  { id: "seaweed", name: { zh: "海草", en: "Seaweed" }, maxCount: 40, defaultCount: 26 },
];

export function getFishMeta(speciesId: string) {
  return FISH_CATALOG.find((meta) => meta.id === speciesId);
}

export function getPlantMeta(speciesId: string) {
  return PLANT_CATALOG.find((meta) => meta.id === speciesId);
}

interface CreateContext {
  coralReef?: SchoolHandle | null;
  anemonePositions?: readonly THREE.Vector3[];
}

export interface SeaweedVariant {
  height: number;
  color: number;
  phase: number;
  sway: number;
}

/** Return stable per-blade variation so a rebuild does not reshuffle the reef. */
export function createSeaweedVariant(index: number, seed = 73): SeaweedVariant {
  const safeIndex = Number.isFinite(index) ? Math.floor(index) : 0;
  const safeSeed = Number.isFinite(seed) ? Math.floor(seed) : 0;
  const random = mulberry32(safeSeed + safeIndex * 7919 + 31337);
  const palette = [0x2f8a4d, 0x3d9b52, 0x216f45, 0x55aa5b];
  return {
    height: THREE.MathUtils.lerp(0.7, 1.5, random()),
    color: palette[Math.floor(random() * palette.length) % palette.length],
    phase: random() * Math.PI * 2,
    sway: THREE.MathUtils.lerp(0.04, 0.14, random()),
  };
}

export function createFishSchool(
  speciesId: string,
  count: number,
  deps: SpeciesCreateDeps,
  ctx: CreateContext = {},
): SchoolHandle | null {
  const fishIds = deps.growthRegistry
    .getRecords(speciesId)
    .map((record) => record.fishId)
    .slice(0, Math.max(0, Math.floor(count)));
  switch (speciesId) {
    case "sardine":
      return createBoidsSchool("cartoon", "sardine", count, deps, 260, fishIds);
    case "koi":
      return createBoidsSchool("koi", "koi", count, deps, 120, fishIds);
    case "clownfish": {
      const reef = ctx.coralReef?.reef;
      if (!reef) return null;
      const school = createClownfishSchool(reef, {
        count,
        fishIds,
        avoidanceZones: deps.clownfishAvoidanceZones,
        anemonePositions: ctx.anemonePositions,
      });
      return {
        group: school.mesh,
        update: (_time, dt) => school.update(_time, dt),
        dispose: () => school.dispose(),
        setCount: (n, ids) => school.setCount(n, ids),
        getCount: () => school.mesh.count,
        getFishIds: () => school.getFishIds(),
        setGrowthSizes: (sizes) => school.setGrowthSizes(sizes),
        setHabitatAnchors: (positions) => school.setHabitatAnchors(positions),
      };
    }
    case "starfish":
      return createStarfishSchool(count, deps, fishIds);
    case "angelfish":
      return createBoidsSchool("angelfish", "angelfish", count, deps, 60, fishIds);
    case "blue-tang":
      return createBoidsSchool("blue-tang", "blue-tang", count, deps, 50, fishIds);
    case "pufferfish":
      return createBoidsSchool("pufferfish", "pufferfish", count, deps, 24, fishIds);
    default:
      return null;
  }
}

export async function createPlantSchool(
  speciesId: string,
  count: number,
  deps: SpeciesCreateDeps,
): Promise<SchoolHandle | null> {
  switch (speciesId) {
    case "coral":
      return createCoralSchool(count, deps);
    case "seaweed":
      return createSeaweedSchool(count, deps);
    default:
      return null;
  }
}

function createBoidsSchool(
  modelKey: string,
  speciesId: string,
  count: number,
  deps: SpeciesCreateDeps,
  capacity: number,
  fishIds: readonly string[] = [],
): SchoolHandle {
  const settings = { ...deps.settings };
  const entry = getFishMeta(speciesId);
  const habitatLayout = deps.habitatLayout ?? createHabitatLayout(deps.aquariumHalfSize);
  const allowedRegion: HabitatRegion | undefined = entry?.habitatLayer
    ? habitatLayout[entry.habitatLayer]
    : undefined;
  const sim = new FishSchoolSimulation({
    aquariumHalfSize: deps.aquariumHalfSize,
    obstacles: deps.obstacles,
    settings,
    allowedRegion,
  });
  sim.reset(count, 42, fishIds);

  const mesh = createFishMeshByKey(capacity, modelKey);
  setFishMeshCount(mesh, sim.fish.length);
  updateFishInstances(mesh, sim.fish);
  let growthSizes: readonly number[] = [];

  return {
    group: mesh,
    update(_time, dt) {
      sim.update(dt);
      updateFishInstances(mesh, sim.fish, growthSizes);
    },
    dispose() {
      disposeFishMesh(mesh);
    },
    setCount(n) {
      const ids = deps.growthRegistry.getRecords(speciesId).map((record) => record.fishId);
      sim.setCount(n, ids);
      setFishMeshCount(mesh, sim.fish.length);
      updateFishInstances(mesh, sim.fish, growthSizes);
    },
    getCount() {
      return sim.fish.length;
    },
    getFishIds() {
      return sim.fish.map((fish) => fish.fishId);
    },
    setGrowthSizes(sizes) {
      growthSizes = sizes;
      updateFishInstances(mesh, sim.fish, growthSizes);
    },
    getFish(index) {
      return sim.fish[index];
    },
    setSettings(settings) {
      Object.assign(sim.settings, settings);
    },
    resize(halfSize) {
      sim.setBounds(halfSize);
    },
    setAllowedRegion(region) {
      sim.setAllowedRegion(region);
      updateFishInstances(mesh, sim.fish, growthSizes);
    },
    rescalePositions(halfSize) {
      // FishSchoolSimulation owns both the tank bounds and optional habitat
      // region; use its shared clamp so a resize cannot leak a fish out of its
      // layer. The argument is retained for the SchoolHandle contract.
      void halfSize;
      sim.clampPositions(0.6);
      updateFishInstances(mesh, sim.fish, growthSizes);
    },
  };
}

async function createCoralSchool(count: number, deps: SpeciesCreateDeps): Promise<SchoolHandle> {
  const reef = await createCoralReef({
    count,
    scale: 2,
    maxCount: 200,
    exclusionZones: deps.exclusionZones,
    halfSize: deps.aquariumHalfSize,
  });
  return {
    group: reef.group,
    reef,
    update(time) {
      reef.update(time);
    },
    dispose() {
      reef.dispose();
    },
    setCount(n) {
      reef.rebuild({ count: n, scale: reef.scale, growth: null });
    },
    getCount() {
      return reef.count;
    },
    getFishIds() {
      return [];
    },
    setGrowthSizes() {},
    setSettings({ count, scale }) {
      reef.rebuild({
        count: Number.isFinite(count) ? count : reef.count,
        scale: Number.isFinite(scale) ? scale : reef.scale,
        growth: null,
      });
    },
    rebuildWithGrowth(count, scale, growth) {
      reef.rebuild({ count, scale, growth });
    },
    getMaxCount() {
      return reef.maxCount;
    },
    resize(halfSize) {
      reef.resize(halfSize);
    },
  };
}

function createStarfishSchool(count: number, deps: SpeciesCreateDeps, fishIds: readonly string[] = []): SchoolHandle {
  const MAX = 30;
  const geometry = createStarfishGeometry();
  const material = new THREE.MeshStandardMaterial({
    color: 0xd97757,
    roughness: 0.78,
    metalness: 0.05,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.InstancedMesh(geometry, material, MAX);
  mesh.name = "Starfish bottom school";
  mesh.count = count;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  let items = Array.from({ length: MAX }, (_, index) => {
    const position = sampleBottomPosition(deps, index);
    return {
      index,
      position,
      velocity: new THREE.Vector3((Math.random() - 0.5) * 0.4, 0, (Math.random() - 0.5) * 0.4),
      phase: Math.random() * Math.PI * 2,
      size: THREE.MathUtils.lerp(0.5, 0.85, Math.random()),
      fishId: fishIds[index] ?? `starfish-${index}`,
    };
  });

  const tmpMatrix = new THREE.Matrix4();
  const tmpScale = new THREE.Vector3();
  let growthSizes: readonly number[] = [];

  function update(_time, dt) {
    const floorY = deps.aquariumFloorY + 0.07;
    const margin = 1.4;
    for (const item of items) {
      if (item.index >= mesh.count) continue;

      item.velocity.x += Math.sin(item.phase + _time * 0.6) * 0.06 * dt;
      item.velocity.z += Math.cos(item.phase + _time * 0.5) * 0.06 * dt;
      item.velocity.clampLength(0.12, 0.42);
      item.position.addScaledVector(item.velocity, dt);
      item.position.y = floorY;

      const limit = deps.aquariumHalfSize;
      item.position.x = THREE.MathUtils.clamp(item.position.x, -limit.x + margin, limit.x - margin);
      item.position.z = THREE.MathUtils.clamp(item.position.z, -limit.z + margin, limit.z - margin);

      const growth = growthSizes[item.index] ?? 1;
      tmpMatrix.compose(item.position, new THREE.Quaternion(), tmpScale.setScalar(item.size * (Number.isFinite(growth) ? growth : 1)));
      mesh.setMatrixAt(item.index, tmpMatrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }

  update(0, 0);

  return {
    group: mesh,
    update,
    dispose() {
      geometry.dispose();
      material.dispose();
    },
    setCount(n, fishIds) {
      fishIds = fishIds ?? deps.growthRegistry.getRecords("starfish").map((record) => record.fishId);
      if (fishIds) {
        const byId = new Map(items.map((item) => [item.fishId, item]));
        const ordered = fishIds.map((id) => byId.get(id)).filter((item): item is (typeof items)[number] => Boolean(item));
        const remaining = items.filter((item) => !fishIds.includes(item.fishId));
        items = [...ordered, ...remaining];
        items.forEach((item, index) => { item.index = index; });
      }
      mesh.count = THREE.MathUtils.clamp(Math.floor(n), 0, MAX);
    },
    getCount() {
      return mesh.count;
    },
    getFishIds() {
      return items.slice(0, mesh.count).map((item) => item.fishId);
    },
    setGrowthSizes(sizes) {
      growthSizes = sizes;
      update(0, 0);
    },
  };
}

function createSeaweedSchool(count: number, deps: SpeciesCreateDeps): SchoolHandle {
  const MAX = 40;
  const geometry = createSeaweedBladeGeometry();
  const material = new THREE.MeshStandardMaterial({
    color: 0x2f8a4d,
    roughness: 0.85,
    metalness: 0,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.92,
    vertexColors: true,
  });
  const mesh = new THREE.InstancedMesh(geometry, material, MAX);
  mesh.name = "Seaweed plants";
  mesh.count = count;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  const items = Array.from({ length: MAX }, (_, index) => {
    const position = sampleBottomPosition(deps, index);
    const variant = createSeaweedVariant(index, deps.seed + 173);
    return {
      index,
      position,
      phase: variant.phase,
      height: variant.height,
      sway: variant.sway,
      color: new THREE.Color(variant.color),
    };
  });

  for (const item of items) mesh.setColorAt(item.index, item.color);

  const tmpMatrix = new THREE.Matrix4();
  const tmpQuaternion = new THREE.Quaternion();
  const tmpScale = new THREE.Vector3();
  const tmpAxis = new THREE.Vector3(1, 0, 0);

  function update(time) {
    const floorY = deps.aquariumFloorY + 0.02;
    for (const item of items) {
      if (item.index >= mesh.count) continue;

      const tilt = Math.sin(time * 1.6 + item.phase) * item.sway;
      tmpQuaternion.setFromAxisAngle(tmpAxis, tilt);
      tmpMatrix.compose(
        new THREE.Vector3(item.position.x, floorY, item.position.z),
        tmpQuaternion,
        tmpScale.set(item.height, item.height, item.height),
      );
      mesh.setMatrixAt(item.index, tmpMatrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }

  update(0);

  return {
    group: mesh,
    update,
    dispose() {
      geometry.dispose();
      material.dispose();
    },
    setCount(n) {
      mesh.count = THREE.MathUtils.clamp(Math.floor(n), 0, MAX);
    },
    getCount() {
      return mesh.count;
    },
    getFishIds() {
      return [];
    },
    setGrowthSizes() {},
  };
}

function sampleBottomPosition(deps: SpeciesCreateDeps, seed: number): THREE.Vector3 {
  const half = deps.aquariumHalfSize;
  const inset = 1.6;
  const rng = mulberry32(seed + 17);
  const exclusionZones = deps.exclusionZones;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const position = new THREE.Vector3(
      (rng() * 2 - 1) * (half.x - inset),
      deps.aquariumFloorY,
      (rng() * 2 - 1) * (half.z - inset),
    );
    if (!isInExclusionZone(position, exclusionZones)) {
      return position;
    }
  }
  return new THREE.Vector3(
    THREE.MathUtils.clamp(0, -half.x + inset, half.x - inset),
    deps.aquariumFloorY,
    THREE.MathUtils.clamp(0, -half.z + inset, half.z - inset),
  );
}

function isInExclusionZone(position: THREE.Vector3, zones: SpeciesCreateDeps["exclusionZones"]): boolean {
  for (const zone of zones) {
    if (zone.shape === "box") {
      const halfX = zone.size.x * 0.5;
      const halfZ = zone.size.y * 0.5;
      if (Math.abs(position.x - zone.position.x) < halfX && Math.abs(position.z - zone.position.z) < halfZ) {
        return true;
      }
      continue;
    }
    const radius = "radius" in zone ? zone.radius : 0;
    if (radius <= 0) continue;
    const dx = position.x - zone.position.x;
    const dz = position.z - zone.position.z;
    if (dx * dx + dz * dz < radius * radius) {
      return true;
    }
  }
  return false;
}

function createStarfishGeometry(): THREE.BufferGeometry {
  const segments = 5;
  const outerR = 0.45;
  const innerR = 0.18;
  const height = 0.16;
  const points: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i < segments * 2; i += 1) {
    const angle = (i / (segments * 2)) * Math.PI * 2 - Math.PI / 2;
    const r = i % 2 === 0 ? outerR : innerR;
    points.push(Math.cos(angle) * r, -height * 0.5, Math.sin(angle) * r);
  }
  const base = points.length / 3;
  for (let i = 0; i < segments * 2; i += 1) {
    const angle = (i / (segments * 2)) * Math.PI * 2 - Math.PI / 2;
    const r = i % 2 === 0 ? outerR : innerR;
    points.push(Math.cos(angle) * r, height * 0.5, Math.sin(angle) * r);
  }
  for (let i = 0; i < segments * 2; i += 1) {
    const j = (i + 1) % (segments * 2);
    indices.push(i, base + i, base + j);
    indices.push(i, base + j, j);
  }
  const bottomCenter = points.length / 3;
  points.push(0, -height * 0.5, 0);
  for (let i = 0; i < segments * 2; i += 2) {
    const j = (i + 2) % (segments * 2);
    indices.push(bottomCenter, i, j);
  }
  const topCenter = points.length / 3;
  points.push(0, height * 0.5, 0);
  for (let i = 1; i < segments * 2; i += 2) {
    const j = (i + 2) % (segments * 2);
    indices.push(topCenter, j, i);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function createSeaweedBladeGeometry(): THREE.BufferGeometry {
  const segments = 6;
  const points: number[] = [];
  const indices: number[] = [];

  for (let s = 0; s <= segments; s += 1) {
    const t = s / segments;
    const y = t * 1.3;
    const halfWidth = 0.16 * (1 - t) + 0.02;
    points.push(-halfWidth, y, 0);
    points.push(halfWidth, y, 0);
  }
  for (let s = 0; s < segments; s += 1) {
    const a = s * 2;
    const b = a + 1;
    const c = a + 2;
    const d = a + 3;
    indices.push(a, c, b);
    indices.push(b, c, d);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function mulberry32(seed: number): () => number {
  return function next() {
    let value = (seed += 0x6d2b79f5);
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}
