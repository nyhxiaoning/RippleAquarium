import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { aquariumFloorY, aquariumHalfSize } from "./config.js";
import { mulberry32 } from "./random.js";
import type { ExclusionZone, RandomSource } from "./types.js";

interface CoralModel {
  geometry: THREE.BufferGeometry;
  material: THREE.MeshStandardMaterial;
}

interface CoralState {
  modelIndex: number;
  instanceIndex: number;
  variant: ReefVariant;
  visible: boolean;
  position: THREE.Vector3;
  scale: number;
  baseY: number;
  baseRotationY: number;
  baseScale: number;
  growth: number;
  growthStartedAt: number;
  growing: boolean;
}

interface CoralReefSettings {
  count?: number;
  scale?: number;
  maxCount?: number;
  seed?: number;
  variantSeed?: number;
  exclusionZones?: ExclusionZone[];
  halfSize?: THREE.Vector3;
}

type CoralRebuildSettings = Partial<Pick<CoralReef, "count" | "scale">> & {
  growth?: number[] | null;
  variantSeed?: number;
};

export type ReefVariant = "branch" | "brain" | "plate";

/**
 * Select a visual reef family deterministically. Keeping the index in the
 * hash makes adjacent instances cover all three families for any seed while
 * still allowing a different seed to rotate the pattern.
 */
export function createReefVariant(index: number, seed = 73): ReefVariant {
  const variants: ReefVariant[] = ["branch", "brain", "plate"];
  const normalizedIndex = Number.isFinite(index) ? Math.floor(index) : 0;
  const normalizedSeed = Number.isFinite(seed) ? Math.floor(seed) : 0;
  return variants[Math.abs(normalizedIndex + normalizedSeed) % variants.length];
}

export interface CoralReef {
  group: THREE.Group;
  count: number;
  scale: number;
  maxCount: number;
  animatedGrowth: number[] | null;
  seed: number;
  variantSeed: number;
  exclusionZones: ExclusionZone[];
  halfSize: THREE.Vector3;
  corals: CoralState[];
  meshes: THREE.InstancedMesh[];
  rebuild(nextSettings?: CoralRebuildSettings): void;
  update(now?: number): void;
  resize(halfSize: THREE.Vector3): void;
  dispose(): void;
}

const coralUrls = Array.from(
  { length: 7 },
  (_, index) => new URL(`./coral/Coral${index}.glb`, import.meta.url),
);

const coralColors = [
  new THREE.Color(0x0b6b4c),
  new THREE.Color(0x1f8a4d),
  new THREE.Color(0x5da331),
  new THREE.Color(0xb24c3c),
  new THREE.Color(0xd05b73),
  new THREE.Color(0xd78b52),
  new THREE.Color(0x7e5ac7),
];

const addedCoralGrowthDuration = 1800;
const coralPlacementInset = 1.35;

const tmpMatrix = new THREE.Matrix4();
const tmpQuaternion = new THREE.Quaternion();
const tmpScale = new THREE.Vector3();
const tmpPosition = new THREE.Vector3();
const hiddenScale = new THREE.Vector3(0, 0, 0);

export async function createCoralReef({
  count = 100,
  scale = 2,
  maxCount = 200,
  seed = 73,
  variantSeed,
  exclusionZones = [],
  halfSize = aquariumHalfSize,
}: CoralReefSettings = {}): Promise<CoralReef> {
  const models = await loadCoralModels();
  const group = new THREE.Group();
  group.name = "Coral reef";

  const reef: CoralReef = {
    group,
    count,
    scale,
    maxCount,
    animatedGrowth: null,
    seed,
    variantSeed: variantSeed ?? seed,
    exclusionZones,
    halfSize,
    // Logical corals shared with consumers (e.g. clownfish avoidance). Each entry
    // mirrors what a standalone Mesh used to expose: visible, world position,
    // rendered uniform scale.
    corals: [],
    meshes: [],
    rebuild(nextSettings = {}) {
      const previousCount = getTargetCount(reef);
      const previousGrowth = Array.isArray(reef.animatedGrowth)
        ? reef.animatedGrowth
        : null;
      if (Number.isFinite(nextSettings.count)) reef.count = nextSettings.count;
      if (Number.isFinite(nextSettings.scale)) reef.scale = nextSettings.scale;
      if (Number.isFinite(nextSettings.variantSeed)) {
        reef.variantSeed = nextSettings.variantSeed as number;
        applyCoralVariants(reef);
      }
      if (Array.isArray(nextSettings.growth)) reef.animatedGrowth = nextSettings.growth;
      if (nextSettings.growth === null) reef.animatedGrowth = null;
      if (!Array.isArray(reef.animatedGrowth)) {
        prepareCoralGrowth(reef, previousCount, previousGrowth);
      }
      syncCorals(reef);
    },
    update(now = performance.now()) {
      if (Array.isArray(reef.animatedGrowth)) return;
      if (updateCoralGrowth(reef, now)) syncCorals(reef);
    },
    resize(nextHalfSize: THREE.Vector3) {
      reef.halfSize = nextHalfSize;
      // Keep corals where they are; only re-sample those that fall outside the new
      // tank footprint so a shrink/grow feels continuous rather than jarring.
      const reseed = mulberry32(reef.seed + 4242);
      for (const coral of reef.corals) {
        const inset = coralPlacementInset;
        if (
          Math.abs(coral.position.x) > reef.halfSize.x - inset ||
          Math.abs(coral.position.z) > reef.halfSize.z - inset
        ) {
          const position = sampleCoralPosition(reseed, reef.exclusionZones, reef.halfSize);
          coral.position.set(position.x, aquariumFloorY + 0.015, position.z);
        }
      }
      syncCorals(reef);
    },
    dispose() {
      group.clear();
      for (const mesh of reef.meshes) {
        mesh.geometry.dispose();
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const material of materials) {
          material.dispose();
        }
      }
      reef.meshes.length = 0;
    },
  };

  buildCoralPool(reef, models);
  syncCorals(reef);
  return reef;
}

async function loadCoralModels() {
  const loader = new GLTFLoader();
  const gltfs = await Promise.all(coralUrls.map((url) => loader.loadAsync(url.href)));
  return gltfs.map((gltf, index) => {
    const mesh = findPrimaryMesh(gltf.scene);
    if (!mesh) throw new Error(`Coral${index}.glb does not contain a mesh.`);

    const geometry = normalizeCoralGeometry(mesh.geometry);
    const material = new THREE.MeshStandardMaterial({
      color: coralColors[index % coralColors.length],
      vertexColors: true,
      roughness: 0.82,
      metalness: 0,
    });
    return { geometry, material };
  });
}

function findPrimaryMesh(root: THREE.Object3D): THREE.Mesh | null {
  let result: THREE.Mesh | null = null;
  root.traverse((object) => {
    if (object instanceof THREE.Mesh && object.geometry && !result) {
      result = object;
    }
  });
  return result;
}

function normalizeCoralGeometry(sourceGeometry: THREE.BufferGeometry): THREE.BufferGeometry {
  const geometry = sourceGeometry.clone();
  geometry.computeBoundingBox();
  const box = geometry.boundingBox;
  const center = new THREE.Vector3();
  const size = new THREE.Vector3();
  box.getCenter(center);
  box.getSize(size);

  const height = Math.max(size.y, 0.0001);
  geometry.translate(-center.x, -box.min.y, -center.z);
  geometry.scale(1 / height, 1 / height, 1 / height);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function buildCoralPool(reef: CoralReef, models: CoralModel[]): void {
  const random = mulberry32(reef.seed);
  // One InstancedMesh per coral model. Corals are assigned round-robin by model,
  // so per-model instance counts are tracked first, then meshes are allocated.
  const perModelCounts = new Array(models.length).fill(0);
  for (let i = 0; i < reef.maxCount; i += 1) {
    perModelCounts[i % models.length] += 1;
  }

  reef.meshes = models.map((model, modelIndex) => {
    const mesh = new THREE.InstancedMesh(
      model.geometry,
      model.material,
      Math.max(1, perModelCounts[modelIndex]),
    );
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.count = perModelCounts[modelIndex];
    reef.group.add(mesh);
    return mesh;
  });

  const nextInstanceIndex = new Array(models.length).fill(0);
  reef.corals = [];
  for (let i = 0; i < reef.maxCount; i += 1) {
    const modelIndex = i % models.length;
    const instanceIndex = nextInstanceIndex[modelIndex];
    nextInstanceIndex[modelIndex] += 1;

    const position = sampleCoralPosition(random, reef.exclusionZones);
    const baseScale = THREE.MathUtils.lerp(0.38, 0.95, random());

    reef.corals.push({
      modelIndex,
      instanceIndex,
      variant: createReefVariant(i, reef.variantSeed),
      visible: i < reef.count,
      position: new THREE.Vector3(position.x, aquariumFloorY + 0.015, position.z),
      scale: 0,
      baseY: aquariumFloorY + 0.015,
      baseRotationY: random() * Math.PI * 2,
      baseScale,
      growth: i < reef.count ? 1 : 0,
      growthStartedAt: 0,
      growing: false,
    });
  }
}

function applyCoralVariants(reef: CoralReef): void {
  const random = mulberry32(reef.variantSeed + 101);
  for (let index = 0; index < reef.corals.length; index += 1) {
    const coral = reef.corals[index];
    coral.variant = createReefVariant(index, reef.variantSeed);
    // Keep the original placement stable when changing a variant seed, but
    // give the new visual family a deterministic scale and orientation.
    coral.baseScale = THREE.MathUtils.lerp(0.38, 0.95, random());
    coral.baseRotationY = random() * Math.PI * 2;
  }
}

function sampleCoralPosition(random: RandomSource, exclusionZones: ExclusionZone[], halfSize: THREE.Vector3 = aquariumHalfSize) {
  const fallback = { x: 0, z: 0 };

  for (let attempt = 0; attempt < 32; attempt += 1) {
    const position = {
      x: randomSignedRange(random, halfSize.x - coralPlacementInset),
      z: randomSignedRange(random, halfSize.z - coralPlacementInset),
    };
    fallback.x = position.x;
    fallback.z = position.z;

    if (!isInExclusionZone(position, exclusionZones)) {
      return position;
    }
  }

  fallback.x = THREE.MathUtils.clamp(
    fallback.x,
    -halfSize.x + coralPlacementInset,
    halfSize.x - coralPlacementInset,
  );
  fallback.z = fallback.z < 0
    ? -halfSize.z + coralPlacementInset
    : halfSize.z - coralPlacementInset;
  return fallback;
}

function randomSignedRange(random: RandomSource, halfRange: number): number {
  return (random() * 2 - 1) * halfRange;
}

function isInExclusionZone(position: { x: number; z: number }, exclusionZones: ExclusionZone[]): boolean {
  for (const zone of exclusionZones) {
    if (zone.shape === "box" && isInBoxExclusionZone(position, zone)) {
      return true;
    }

    if (isInCircleExclusionZone(position, zone)) {
      return true;
    }
  }

  return false;
}

function isInCircleExclusionZone(position: { x: number; z: number }, zone: ExclusionZone): boolean {
  const radius = "radius" in zone ? zone.radius : 0;
  if (radius <= 0) return false;

  const dx = position.x - zone.position.x;
  const dz = position.z - zone.position.z;
  return dx * dx + dz * dz < radius * radius;
}

function isInBoxExclusionZone(position: { x: number; z: number }, zone: Extract<ExclusionZone, { shape: "box" }>): boolean {
  const halfX = zone.size.x * 0.5;
  const halfZ = zone.size.y * 0.5;
  const dx = Math.abs(position.x - zone.position.x);
  const dz = Math.abs(position.z - zone.position.z);

  return dx < halfX && dz < halfZ;
}

function getTargetCount(reef: CoralReef): number {
  return Math.max(0, Math.min(reef.maxCount, Math.floor(reef.count)));
}

function prepareCoralGrowth(
  reef: CoralReef,
  previousCount: number,
  previousGrowth: number[] | null = null,
): void {
  const targetCount = getTargetCount(reef);
  const now = performance.now();

  for (let i = 0; i < reef.corals.length; i += 1) {
    const coral = reef.corals[i];
    if (i >= targetCount) {
      coral.growth = 0;
      coral.growing = false;
      continue;
    }

    if (i >= previousCount) {
      coral.growth = 0;
      coral.growthStartedAt = now;
      coral.growing = true;
      continue;
    }

    if (previousGrowth) {
      coral.growth = previousGrowth[i] ?? coral.growth;
      coral.growthStartedAt = now - coral.growth * addedCoralGrowthDuration;
      coral.growing = coral.growth < 1;
      continue;
    }

    if (!coral.growing && coral.growth <= 0.001) {
      coral.growth = 1;
    }
  }
}

function updateCoralGrowth(reef: CoralReef, now: number): boolean {
  let changed = false;

  for (const coral of reef.corals) {
    if (!coral.growing) continue;

    const progress = THREE.MathUtils.clamp(
      (now - coral.growthStartedAt) / addedCoralGrowthDuration,
      0,
      1,
    );
    coral.growth = progress * progress * (3 - 2 * progress);
    changed = true;

    if (progress >= 1) {
      coral.growth = 1;
      coral.growing = false;
    }
  }

  return changed;
}

function syncCorals(reef: CoralReef): void {
  const targetCount = getTargetCount(reef);
  for (let i = 0; i < reef.corals.length; i += 1) {
    const coral = reef.corals[i];
    const visible = i < targetCount;
    coral.visible = visible;

    const mesh = reef.meshes[coral.modelIndex];
    mesh.setColorAt(coral.instanceIndex, coralVariantColor(coral.variant));
    if (!visible) {
      coral.scale = 0;
      tmpMatrix.compose(coral.position, identityQuaternion(), hiddenScale);
      mesh.setMatrixAt(coral.instanceIndex, tmpMatrix);
      continue;
    }

    const growth = reef.animatedGrowth?.[i] ?? coral.growth ?? 1;
    const renderScale = coral.baseScale * reef.scale * growth;
    coral.scale = renderScale;

    tmpPosition.set(
      coral.position.x,
      coral.baseY - (1 - growth) * 0.18,
      coral.position.z,
    );
    coral.position.y = tmpPosition.y;
    tmpQuaternion.setFromAxisAngle(
      Y_AXIS,
      coral.baseRotationY + (1 - growth) * 0.22,
    );
    const shape = coralVariantShape(coral.variant);
    tmpScale.set(renderScale * shape.x, renderScale * shape.y, renderScale * shape.z);
    tmpMatrix.compose(tmpPosition, tmpQuaternion, tmpScale);
    mesh.setMatrixAt(coral.instanceIndex, tmpMatrix);
  }

  for (const mesh of reef.meshes) {
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }
}

function coralVariantShape(variant: ReefVariant): THREE.Vector3 {
  switch (variant) {
    case "branch":
      return new THREE.Vector3(0.8, 1.24, 0.8);
    case "brain":
      return new THREE.Vector3(1.12, 0.94, 1.12);
    case "plate":
      return new THREE.Vector3(1.35, 0.56, 1.35);
  }
}

function coralVariantColor(variant: ReefVariant): THREE.Color {
  switch (variant) {
    case "branch":
      return new THREE.Color(0x55ad73);
    case "brain":
      return new THREE.Color(0xc76572);
    case "plate":
      return new THREE.Color(0xd89a58);
  }
}

const Y_AXIS = new THREE.Vector3(0, 1, 0);
const reusableIdentityQuaternion = new THREE.Quaternion();

function identityQuaternion() {
  return reusableIdentityQuaternion.identity();
}
