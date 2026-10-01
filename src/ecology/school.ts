import * as THREE from "three";
import { createHabitatLayout, sampleHabitatPoint } from "../aquarium/habitat.js";
import type { SchoolHandle } from "../aquarium/types.js";
import type { EcologyCreateDeps, EcologyKind } from "./types.js";

type SharedResource = {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  extraGeometry?: THREE.BufferGeometry;
  extraMaterial?: THREE.Material;
  refs: number;
};

/**
 * Resources are shared by all schools of the same kind. Ref-counting keeps a
 * second school from disposing geometry that is still used by the first one.
 */
const resourcePool = new Map<EcologyKind, SharedResource>();

function resourcesFor(kind: EcologyKind): SharedResource {
  const existing = resourcePool.get(kind);
  if (existing) {
    existing.refs += 1;
    return existing;
  }

  let resource: SharedResource;
  switch (kind) {
    case "anemone":
      resource = {
        geometry: new THREE.ConeGeometry(0.2, 0.85, 7),
        material: new THREE.MeshStandardMaterial({ color: 0xe56e8f, roughness: 0.75 }),
        refs: 1,
      };
      break;
    case "urchin":
      resource = {
        geometry: new THREE.IcosahedronGeometry(0.32, 1),
        material: new THREE.MeshStandardMaterial({ color: 0x5c3448, roughness: 0.86 }),
        extraGeometry: new THREE.ConeGeometry(0.045, 0.36, 5),
        extraMaterial: new THREE.MeshStandardMaterial({ color: 0x2c1727, roughness: 0.9 }),
        refs: 1,
      };
      break;
    case "shell":
      resource = {
        geometry: new THREE.SphereGeometry(0.43, 10, 5, 0, Math.PI * 2, 0, Math.PI * 0.55),
        material: new THREE.MeshStandardMaterial({ color: 0xf0bd9b, roughness: 0.8, side: THREE.DoubleSide }),
        refs: 1,
      };
      break;
    case "jellyfish":
      resource = {
        geometry: new THREE.SphereGeometry(0.48, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.58),
        material: new THREE.MeshPhysicalMaterial({
          color: 0x9edcff,
          transparent: true,
          opacity: 0.66,
          roughness: 0.25,
          transmission: 0.1,
          depthWrite: false,
        }),
        extraGeometry: new THREE.CylinderGeometry(0.035, 0.015, 0.72, 5),
        extraMaterial: new THREE.MeshBasicMaterial({ color: 0xc6efff, transparent: true, opacity: 0.7 }),
        refs: 1,
      };
      break;
  }
  resourcePool.set(kind, resource);
  return resource;
}

function releaseResources(kind: EcologyKind, resource: SharedResource): void {
  if (resource.refs > 0) resource.refs -= 1;
  if (resource.refs !== 0) return;
  resource.geometry.dispose();
  resource.material.dispose();
  resource.extraGeometry?.dispose();
  resource.extraMaterial?.dispose();
  resourcePool.delete(kind);
}

function mulberry32(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value = (value + 0x6d2b79f5) | 0;
    let t = Math.imul(value ^ (value >>> 15), value | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface EcologyItem {
  position: THREE.Vector3;
  basePosition: THREE.Vector3;
  phase: number;
  scale: number;
  yaw: number;
  drift: THREE.Vector3;
}

function regionFor(kind: EcologyKind, deps: EcologyCreateDeps) {
  const layout = deps.habitat ?? createHabitatLayout(deps.aquariumHalfSize);
  return layout[kind === "anemone" ? "reef" : kind === "jellyfish" ? "upper" : "lower"];
}

function pointFor(kind: EcologyKind, deps: EcologyCreateDeps, random: () => number, scale: number): THREE.Vector3 {
  const region = regionFor(kind, deps);
  const point = sampleHabitatPoint(region, random, Math.min(0.6, scale * 0.6));
  if (kind === "anemone" || kind === "urchin" || kind === "shell") {
    point.y = THREE.MathUtils.clamp(deps.aquariumFloorY + (kind === "anemone" ? 0.2 : 0.12), region.min.y, region.max.y);
  }
  return new THREE.Vector3(point.x, point.y, point.z);
}

function makeMatrix(
  matrix: THREE.Matrix4,
  position: THREE.Vector3,
  scale: number,
  yaw: number,
  quaternion: THREE.Quaternion,
  scaleVector: THREE.Vector3,
) {
  quaternion.setFromEuler(new THREE.Euler(0, yaw, 0));
  matrix.compose(position, quaternion, scaleVector.setScalar(scale));
}

/** Build one instanced procedural ecology school. */
export function createEcologySchool(
  kind: EcologyKind,
  requestedCount: number,
  deps: EcologyCreateDeps,
  maxCount: number,
): SchoolHandle {
  const capacity = Math.max(0, Math.floor(maxCount));
  const count = THREE.MathUtils.clamp(Number.isFinite(requestedCount) ? Math.floor(requestedCount) : 0, 0, capacity);
  const resources = resourcesFor(kind);
  const group = new THREE.Group();
  group.name = `${kind} ecology school`;

  const mesh = new THREE.InstancedMesh(resources.geometry, resources.material, capacity);
  mesh.count = count;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.castShadow = kind !== "jellyfish";
  mesh.receiveShadow = kind !== "jellyfish";
  group.add(mesh);

  const extraMesh = resources.extraGeometry && resources.extraMaterial
    ? new THREE.InstancedMesh(resources.extraGeometry, resources.extraMaterial, capacity * (kind === "urchin" ? 8 : 1))
    : null;
  if (extraMesh) {
    extraMesh.count = kind === "urchin" ? count * 8 : count;
    extraMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    extraMesh.castShadow = kind === "urchin";
    group.add(extraMesh);
  }

  let currentHalfSize = deps.aquariumHalfSize.clone();
  const random = mulberry32((deps.seed ?? 73) + kind.length * 997);
  const items: EcologyItem[] = Array.from({ length: capacity }, () => {
    const scale = kind === "jellyfish" ? THREE.MathUtils.lerp(0.8, 1.25, random()) : THREE.MathUtils.lerp(0.72, 1.15, random());
    const position = pointFor(kind, { ...deps, aquariumHalfSize: currentHalfSize }, random, scale);
    return {
      position,
      basePosition: position.clone(),
      phase: random() * Math.PI * 2,
      scale,
      yaw: random() * Math.PI * 2,
      drift: new THREE.Vector3((random() - 0.5) * 0.08, (random() - 0.5) * 0.04, (random() - 0.5) * 0.08),
    };
  });

  const matrix = new THREE.Matrix4();
  const extraMatrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const extraQuaternion = new THREE.Quaternion();
  const scaleVector = new THREE.Vector3();
  const extraScaleVector = new THREE.Vector3();
  const spikePosition = new THREE.Vector3();
  const tentaclePosition = new THREE.Vector3();
  const layoutFor = () => regionFor(kind, { ...deps, aquariumHalfSize: currentHalfSize });

  function update(time: number) {
    const region = layoutFor();
    for (let index = 0; index < items.length; index += 1) {
      const item = items[index];
      if (index >= mesh.count) continue;
      if (kind === "anemone") {
        item.position.copy(item.basePosition);
        item.position.y = THREE.MathUtils.clamp(
          item.position.y + Math.sin(time * 1.6 + item.phase) * 0.035,
          region.min.y,
          region.max.y,
        );
        makeMatrix(matrix, item.position, item.scale, item.yaw + Math.sin(time * 1.2 + item.phase) * 0.08, quaternion, scaleVector);
        mesh.setMatrixAt(index, matrix);
      } else if (kind === "urchin") {
        item.position.copy(item.basePosition);
        item.position.x += item.drift.x * Math.sin(time * 0.35 + item.phase);
        item.position.z += item.drift.z * Math.cos(time * 0.31 + item.phase);
        item.position.x = THREE.MathUtils.clamp(item.position.x, region.min.x + 0.5, region.max.x - 0.5);
        item.position.z = THREE.MathUtils.clamp(item.position.z, region.min.z + 0.5, region.max.z - 0.5);
        makeMatrix(matrix, item.position, item.scale, item.yaw + time * 0.12, quaternion, scaleVector);
        mesh.setMatrixAt(index, matrix);
        if (extraMesh) {
          for (let spike = 0; spike < 8; spike += 1) {
            const angle = (spike / 8) * Math.PI * 2;
            spikePosition.copy(item.position).x += Math.cos(angle) * 0.18;
            spikePosition.y += 0.05;
            spikePosition.z += Math.sin(angle) * 0.18;
            extraQuaternion.setFromEuler(new THREE.Euler(Math.sin(angle) * 0.8, -angle, Math.cos(angle) * 0.8));
            extraMatrix.compose(spikePosition, extraQuaternion, extraScaleVector.setScalar(item.scale));
            extraMesh.setMatrixAt(index * 8 + spike, extraMatrix);
          }
        }
      } else if (kind === "shell") {
        item.position.copy(item.basePosition);
        makeMatrix(matrix, item.position, item.scale, item.yaw, quaternion, scaleVector.set(item.scale * 1.1, item.scale * 0.55, item.scale));
        mesh.setMatrixAt(index, matrix);
      } else {
        item.position.copy(item.basePosition);
        item.position.x += Math.sin(time * 0.28 + item.phase) * 0.6;
        item.position.y += Math.sin(time * 0.5 + item.phase) * 0.42;
        item.position.z += Math.cos(time * 0.22 + item.phase) * 0.45;
        item.position.x = THREE.MathUtils.clamp(item.position.x, region.min.x + 0.6, region.max.x - 0.6);
        item.position.y = THREE.MathUtils.clamp(item.position.y, region.min.y + 0.6, region.max.y - 0.6);
        item.position.z = THREE.MathUtils.clamp(item.position.z, region.min.z + 0.6, region.max.z - 0.6);
        makeMatrix(matrix, item.position, item.scale, 0, quaternion, scaleVector);
        mesh.setMatrixAt(index, matrix);
        if (extraMesh) {
          tentaclePosition.copy(item.position);
          tentaclePosition.y -= 0.55 * item.scale;
          makeMatrix(extraMatrix, tentaclePosition, item.scale, 0, extraQuaternion, extraScaleVector.set(1, 1, 1));
          extraMesh.setMatrixAt(index, extraMatrix);
        }
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (extraMesh) extraMesh.instanceMatrix.needsUpdate = true;
  }

  function resize(nextHalfSize: THREE.Vector3) {
    currentHalfSize.copy(nextHalfSize);
    const region = layoutFor();
    for (const item of items) {
      item.basePosition.x = THREE.MathUtils.clamp(item.basePosition.x, region.min.x + 0.5, region.max.x - 0.5);
      item.basePosition.y = THREE.MathUtils.clamp(item.basePosition.y, region.min.y + 0.15, region.max.y - 0.15);
      item.basePosition.z = THREE.MathUtils.clamp(item.basePosition.z, region.min.z + 0.5, region.max.z - 0.5);
      item.position.copy(item.basePosition);
    }
    update(0);
  }

  update(0);
  let disposed = false;
  return {
    group,
    update,
    dispose() {
      if (disposed) return;
      disposed = true;
      releaseResources(kind, resources);
      group.clear();
    },
    setCount(next) {
      mesh.count = THREE.MathUtils.clamp(Number.isFinite(next) ? Math.floor(next) : 0, 0, capacity);
      if (extraMesh) extraMesh.count = kind === "urchin" ? mesh.count * 8 : mesh.count;
      update(0);
    },
    getCount: () => mesh.count,
    getFishIds: () => [],
    setGrowthSizes: () => {},
    resize,
    getMaxCount: () => capacity,
  };
}
