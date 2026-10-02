import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { FishModelInstance } from "../types.js";

/** Keys for fish that are built entirely from Three.js geometry. */
export type ProceduralFishKey = "angelfish" | "blue-tang" | "pufferfish";

const ANGEL_BODY = new THREE.Color(0xd7e4e2);
const ANGEL_BELLY = new THREE.Color(0xf4d78d);
const ANGEL_STRIPE = new THREE.Color(0x27364a);
const ANGEL_FIN = new THREE.Color(0x9e7b42);
const TANG_BODY = new THREE.Color(0x1768c1);
const TANG_DARK = new THREE.Color(0x081c4b);
const TANG_YELLOW = new THREE.Color(0xf6ce35);
const TANG_BELLY = new THREE.Color(0x4d9bca);
const PUFFER_BODY = new THREE.Color(0xe0ae38);
const PUFFER_BELLY = new THREE.Color(0xffe6a1);
const PUFFER_FIN = new THREE.Color(0xc66d25);
const BLACK = new THREE.Color(0x090c12);

const localForward = new THREE.Vector3(0, 1, 0);
const tmpAxis = new THREE.Vector3();
const tmpQuaternion = new THREE.Quaternion();
const tmpVertex = new THREE.Vector3();

/** Create a fresh, disposable geometry/material pair for one procedural species. */
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
  const parts: THREE.BufferGeometry[] = [];
  const body = new THREE.SphereGeometry(1, 32, 20);
  body.scale(0.74, 1.08, 0.46);
  body.translate(0, 0.16, 0);
  paint(body, (position) => {
    const stripe = [0.62, 0.15, -0.31, -0.7].some((center) => Math.abs(position.y - center) < 0.1);
    return stripe ? ANGEL_STRIPE : position.z < -0.08 ? ANGEL_BELLY : ANGEL_BODY;
  });
  parts.push(body);
  parts.push(tailFan(0.62, 0.7, ANGEL_BODY, -1.06));
  parts.push(finTriangle(0.92, 1.18, 0.28, 0.28, 0.43, ANGEL_FIN, "dorsal"));
  parts.push(finTriangle(0.84, 1.02, 0.26, -0.31, -0.39, ANGEL_FIN, "ventral"));
  parts.push(finTriangle(0.58, 0.72, 0.2, 0.28, 0.34, ANGEL_FIN, "pectoral-left"));
  parts.push(finTriangle(0.58, 0.72, 0.2, 0.28, -0.34, ANGEL_FIN, "pectoral-right"));
  parts.push(eye(0.36, 0.77, 0.17, 0.36));
  parts.push(eye(-0.36, 0.77, 0.17, 0.36));
  parts.push(mouth(0.1, 0.98, 0.02));
  return finish(parts);
}

function createBlueTang(): FishModelInstance {
  const parts: THREE.BufferGeometry[] = [];
  const body = new THREE.SphereGeometry(1, 32, 20);
  body.scale(0.8, 0.98, 0.47);
  body.translate(0, 0.08, 0);
  paint(body, (position) => {
    if (position.y < -0.68) return TANG_YELLOW;
    if (Math.abs(position.x) > 0.42 && position.y > -0.1) return TANG_DARK;
    return position.z < -0.16 ? TANG_BELLY : TANG_BODY;
  });
  parts.push(body);
  parts.push(tailFan(0.64, 0.64, TANG_YELLOW, -1.0));
  parts.push(finTriangle(0.72, 0.82, 0.18, 0.2, 0.43, TANG_DARK, "dorsal"));
  parts.push(finTriangle(0.64, 0.75, 0.18, 0.17, -0.4, TANG_DARK, "ventral"));
  parts.push(finTriangle(0.64, 0.74, 0.2, 0.28, 0.38, TANG_DARK, "pectoral-left"));
  parts.push(finTriangle(0.64, 0.74, 0.2, 0.28, -0.38, TANG_DARK, "pectoral-right"));
  parts.push(eye(0.4, 0.72, 0.17, 0.4));
  parts.push(eye(-0.4, 0.72, 0.17, 0.4));
  parts.push(mouth(0.12, 0.96, 0.02));
  return finish(parts);
}

function createPufferfish(): FishModelInstance {
  const parts: THREE.BufferGeometry[] = [];
  const body = new THREE.SphereGeometry(1, 30, 22);
  body.scale(0.84, 0.82, 0.78);
  body.translate(0, 0.02, 0);
  paint(body, (position) => position.z < -0.14 ? PUFFER_BELLY : PUFFER_BODY);
  parts.push(body);
  parts.push(finTriangle(0.44, 0.48, 0.2, 0.18, 0.72, PUFFER_FIN, "dorsal"));
  parts.push(finTriangle(0.44, 0.48, 0.2, 0.14, -0.72, PUFFER_FIN, "ventral"));
  parts.push(finTriangle(0.46, 0.52, 0.22, 0.6, 0.1, PUFFER_FIN, "pectoral-left"));
  parts.push(finTriangle(0.46, 0.52, 0.22, 0.6, -0.1, PUFFER_FIN, "pectoral-right"));
  parts.push(eye(0.46, 0.46, 0.2, 0.48));
  parts.push(eye(-0.46, 0.46, 0.2, 0.48));
  parts.push(mouth(0.12, 0.72, 0.02));

  const spineDirections = [
    [0.8, 0.25, 0.45], [-0.8, 0.25, 0.45], [0.78, 0.16, -0.48], [-0.78, 0.16, -0.48],
    [0.42, 0.54, 0.55], [-0.42, 0.54, 0.55], [0.38, -0.56, 0.54], [-0.38, -0.56, 0.54],
    [0.46, 0.38, -0.58], [-0.46, 0.38, -0.58],
  ];
  for (const [x, y, z] of spineDirections) {
    tmpAxis.set(x, y, z).normalize();
    const spine = new THREE.ConeGeometry(0.07, 0.28, 5);
    tmpQuaternion.setFromUnitVectors(localForward, tmpAxis);
    spine.applyQuaternion(tmpQuaternion);
    spine.translate(tmpAxis.x * 0.68, tmpAxis.y * 0.68, tmpAxis.z * 0.68);
    paint(spine, () => PUFFER_FIN);
    parts.push(spine);
  }
  return finish(parts);
}

function tailFan(width: number, height: number, color: THREE.Color, y: number): THREE.BufferGeometry {
  const geometry = new THREE.ConeGeometry(width, height, 8);
  geometry.rotateZ(Math.PI);
  geometry.translate(0, y, 0);
  paint(geometry, () => color);
  return geometry;
}

function finTriangle(
  span: number,
  height: number,
  thickness: number,
  y: number,
  z: number,
  color: THREE.Color,
  placement: string,
): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(-span * 0.5, 0);
  shape.lineTo(span * 0.5, 0.04);
  shape.lineTo(span * 0.12, height);
  shape.lineTo(-span * 0.18, height * 0.72);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: true,
    bevelSegments: 1,
    bevelSize: 0.018,
    bevelThickness: 0.012,
  });
  geometry.translate(0, y, z);
  if (placement === "dorsal" || placement === "ventral") {
    geometry.rotateX(Math.PI / 2);
  } else {
    geometry.rotateY(Math.PI / 2);
  }
  paint(geometry, () => color);
  return geometry;
}

function eye(x: number, y: number, z: number, radius: number): THREE.BufferGeometry {
  const geometry = new THREE.SphereGeometry(radius * 0.18, 12, 8);
  geometry.translate(x, y, z);
  paint(geometry, () => BLACK);
  return geometry;
}

function mouth(x: number, y: number, z: number): THREE.BufferGeometry {
  const geometry = new THREE.SphereGeometry(0.05, 8, 6);
  geometry.scale(1.2, 0.65, 0.65);
  geometry.translate(x, y, z);
  paint(geometry, () => BLACK);
  return geometry;
}

function paint(
  geometry: THREE.BufferGeometry,
  color: THREE.Color | ((position: THREE.Vector3) => THREE.Color),
): void {
  const positions = geometry.getAttribute("position");
  const colors = new Float32Array(positions.count * 3);
  for (let index = 0; index < positions.count; index += 1) {
    tmpVertex.fromBufferAttribute(positions, index);
    const selected = typeof color === "function" ? color(tmpVertex) : color;
    selected.toArray(colors, index * 3);
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
}

function finish(parts: THREE.BufferGeometry[]): FishModelInstance {
  const normalized = parts.map((part) => {
    const geometry = part.index ? part.toNonIndexed() : part;
    geometry.deleteAttribute("uv");
    return geometry;
  });
  const geometry = mergeGeometries(normalized, false);
  for (const part of parts) part.dispose();
  if (!geometry) throw new Error("Unable to merge procedural fish geometry");
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return {
    geometry,
    material: new THREE.MeshStandardMaterial({
      color: 0xffffff,
      vertexColors: true,
      roughness: 0.48,
      metalness: 0.02,
      side: THREE.DoubleSide,
    }),
    renderScale: 1,
    useAppearanceVariants: false,
  };
}
