import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { FishModelInstance } from "../types.js";

/** Keys for the low-poly fish that do not need an external GLB asset. */
export type ProceduralFishKey = "angelfish" | "blue-tang" | "pufferfish";

const SILVER = new THREE.Color(0xd9e8e6);
const ANGEL_GOLD = new THREE.Color(0xe7bd4f);
const ANGEL_DARK = new THREE.Color(0x26364a);
const BLUE = new THREE.Color(0x1768c1);
const BLUE_DARK = new THREE.Color(0x0c2e6b);
const TAIL_YELLOW = new THREE.Color(0xf3cc35);
const PUFFER_GOLD = new THREE.Color(0xe2b52f);
const PUFFER_BELLY = new THREE.Color(0xffe8a0);
const PUFFER_FIN = new THREE.Color(0xc87824);
const BLACK = new THREE.Color(0x111318);

/**
 * Create a fresh geometry/material pair for one of the procedural species.
 *
 * The returned resources intentionally are not cached: an InstancedMesh owns
 * and disposes its model resources, while callers of this function can safely
 * dispose a model without affecting another school.
 */
export function createProceduralFishModel(key: ProceduralFishKey): FishModelInstance {
  switch (key) {
    case "angelfish":
      return createAngelfish();
    case "blue-tang":
      return createBlueTang();
    case "pufferfish":
      return createPufferfish();
    default:
      throw new Error(`Unknown procedural fish model: ${String(key)}`);
  }
}

export function isProceduralFishKey(key: string): key is ProceduralFishKey {
  return key === "angelfish" || key === "blue-tang" || key === "pufferfish";
}

function createAngelfish(): FishModelInstance {
  const parts = [
    colored(new THREE.SphereGeometry(0.72, 12, 8), SILVER, { x: 0.62, y: 1.04, z: 0.34 }),
    colored(transformed(new THREE.ConeGeometry(0.46, 0.58, 4), { y: -0.72 }), ANGEL_GOLD),
    colored(transformed(new THREE.ConeGeometry(0.13, 0.92, 3), { z: 0.47, rx: Math.PI / 2 }), ANGEL_DARK),
    colored(transformed(new THREE.ConeGeometry(0.13, 0.82, 3), { z: -0.46, rx: Math.PI / 2 }), ANGEL_GOLD),
    colored(transformed(new THREE.ConeGeometry(0.15, 0.72, 3), { x: 0.34, y: 0.05, rz: Math.PI / 2 }), ANGEL_DARK),
    colored(transformed(new THREE.ConeGeometry(0.15, 0.72, 3), { x: -0.34, y: 0.05, rz: -Math.PI / 2 }), ANGEL_DARK),
  ];
  return finish(parts, new THREE.MeshStandardMaterial({
    color: 0xffffff,
    vertexColors: true,
    flatShading: true,
    roughness: 0.76,
    metalness: 0.04,
  }));
}

function createBlueTang(): FishModelInstance {
  const parts = [
    colored(new THREE.SphereGeometry(0.68, 12, 8), BLUE, { x: 0.6, y: 1.06, z: 0.32 }),
    colored(transformed(new THREE.ConeGeometry(0.43, 0.62, 4), { y: -0.78 }), TAIL_YELLOW),
    colored(transformed(new THREE.ConeGeometry(0.11, 0.62, 3), { z: 0.42, rx: Math.PI / 2 }), BLUE_DARK),
    colored(transformed(new THREE.ConeGeometry(0.11, 0.58, 3), { z: -0.41, rx: Math.PI / 2 }), BLUE_DARK),
    colored(transformed(new THREE.ConeGeometry(0.14, 0.52, 3), { x: 0.3, y: 0.1, rz: Math.PI / 2 }), BLUE_DARK),
    colored(transformed(new THREE.ConeGeometry(0.14, 0.52, 3), { x: -0.3, y: 0.1, rz: -Math.PI / 2 }), BLUE_DARK),
    colored(transformed(new THREE.SphereGeometry(0.1, 8, 6), { x: 0.34, y: 0.54, z: 0.2 }), BLACK),
    colored(transformed(new THREE.SphereGeometry(0.1, 8, 6), { x: -0.34, y: 0.54, z: 0.2 }), BLACK),
  ];
  return finish(parts, new THREE.MeshStandardMaterial({
    color: 0xffffff,
    vertexColors: true,
    flatShading: true,
    roughness: 0.72,
    metalness: 0.06,
  }));
}

function createPufferfish(): FishModelInstance {
  const parts = [
    colored(new THREE.SphereGeometry(0.72, 12, 8), PUFFER_GOLD, { x: 0.82, y: 0.8, z: 0.66 }),
    colored(transformed(new THREE.SphereGeometry(0.1, 8, 6), { x: 0.44, y: 0.46, z: 0.3 }), BLACK),
    colored(transformed(new THREE.SphereGeometry(0.1, 8, 6), { x: -0.44, y: 0.46, z: 0.3 }), BLACK),
    colored(transformed(new THREE.ConeGeometry(0.11, 0.42, 5), { z: 0.68, rx: Math.PI / 2 }), PUFFER_FIN),
    colored(transformed(new THREE.ConeGeometry(0.11, 0.42, 5), { z: -0.68, rx: Math.PI / 2 }), PUFFER_FIN),
    colored(transformed(new THREE.ConeGeometry(0.13, 0.46, 5), { x: 0.68, y: 0.04, rz: Math.PI / 2 }), PUFFER_FIN),
    colored(transformed(new THREE.ConeGeometry(0.13, 0.46, 5), { x: -0.68, y: 0.04, rz: -Math.PI / 2 }), PUFFER_FIN),
    colored(transformed(new THREE.ConeGeometry(0.07, 0.28, 5), { y: 0.15, z: 0.63, rx: Math.PI / 2 }), PUFFER_BELLY),
    colored(transformed(new THREE.ConeGeometry(0.07, 0.28, 5), { y: -0.12, z: 0.64, rx: Math.PI / 2 }), PUFFER_BELLY),
  ];
  return finish(parts, new THREE.MeshStandardMaterial({
    color: 0xffffff,
    vertexColors: true,
    flatShading: true,
    roughness: 0.82,
    metalness: 0,
  }));
}

interface Transform {
  x?: number;
  y?: number;
  z?: number;
  rx?: number;
  ry?: number;
  rz?: number;
}

function transformed(geometry: THREE.BufferGeometry, transform: Transform): THREE.BufferGeometry {
  if (transform.rx) geometry.rotateX(transform.rx);
  if (transform.ry) geometry.rotateY(transform.ry);
  if (transform.rz) geometry.rotateZ(transform.rz);
  geometry.translate(transform.x ?? 0, transform.y ?? 0, transform.z ?? 0);
  return geometry;
}

function colored(
  geometry: THREE.BufferGeometry,
  color: THREE.Color,
  scale: { x: number; y: number; z: number } = { x: 1, y: 1, z: 1 },
): THREE.BufferGeometry {
  geometry.scale(scale.x, scale.y, scale.z);
  const count = geometry.getAttribute("position").count;
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) color.toArray(colors, i * 3);
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return geometry;
}

function finish(parts: THREE.BufferGeometry[], material: THREE.Material): FishModelInstance {
  const geometry = mergeGeometries(parts);
  for (const part of parts) part.dispose();
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return {
    geometry,
    material,
    renderScale: 1,
    useAppearanceVariants: false,
  };
}
