import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { FishModelInstance } from "../types.js";

/** Keys for fish that are built entirely from Three.js geometry. */
export type ProceduralFishKey =
  | "sardine"
  | "koi"
  | "clownfish"
  | "starfish"
  | "angelfish"
  | "blue-tang"
  | "pufferfish";

const SARDINE_BODY = new THREE.Color(0x879eaf);
const SARDINE_BELLY = new THREE.Color(0xdce7e9);
const SARDINE_STRIPE = new THREE.Color(0x36556b);
const SARDINE_FIN = new THREE.Color(0x6d8693);
const KOI_BODY = new THREE.Color(0xfff3d6);
const KOI_BELLY = new THREE.Color(0xe9d9bd);
const KOI_ORANGE = new THREE.Color(0xd45d35);
const KOI_FIN = new THREE.Color(0xe7aa6f);
const CLOWNFISH_BODY = new THREE.Color(0xf47a27);
const CLOWNFISH_WHITE = new THREE.Color(0xfff7dc);
const CLOWNFISH_BLACK = new THREE.Color(0x171b20);
const CLOWNFISH_FIN = new THREE.Color(0xc44f20);
const CLOWNFISH_BELLY = new THREE.Color(0xdc6028);
const STARFISH_BODY = new THREE.Color(0xd9684d);
const STARFISH_HIGHLIGHT = new THREE.Color(0xf28a62);
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
    case "sardine":
      return createSardine();
    case "koi":
      return createKoi();
    case "clownfish":
      return createClownfish();
    case "starfish":
      return createStarfish();
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
  return (
    key === "sardine" ||
    key === "koi" ||
    key === "clownfish" ||
    key === "starfish" ||
    key === "angelfish" ||
    key === "blue-tang" ||
    key === "pufferfish"
  );
}

function createSardine(): FishModelInstance {
  const parts: THREE.BufferGeometry[] = [];
  const body = new THREE.SphereGeometry(1, 32, 18);
  body.scale(0.42, 1.08, 0.23);
  body.translate(0, 0.08, 0);
  paint(body, (position) => {
    if (position.z < -0.11) return SARDINE_BELLY;
    if (position.z > 0.1 && position.y < 0.45) return SARDINE_STRIPE;
    return SARDINE_BODY;
  });
  parts.push(body);
  parts.push(forkedTail(0.62, 0.72, 0.12, -0.94, SARDINE_FIN));
  parts.push(finTriangle(0.46, 0.4, 0.14, 0.08, 0.2, SARDINE_FIN, "dorsal"));
  parts.push(finTriangle(0.38, 0.3, 0.12, -0.34, -0.2, SARDINE_FIN, "ventral"));
  parts.push(finTriangle(0.42, 0.34, 0.14, 0.3, 0.2, SARDINE_FIN, "pectoral-left"));
  parts.push(finTriangle(0.42, 0.34, 0.14, 0.3, -0.2, SARDINE_FIN, "pectoral-right"));
  parts.push(eye(0.23, 0.86, 0.12, 0.28));
  parts.push(eye(-0.23, 0.86, 0.12, 0.28));
  parts.push(mouth(0.06, 1.12, 0.01));
  return finish(parts);
}

function createKoi(): FishModelInstance {
  const parts: THREE.BufferGeometry[] = [];
  const body = new THREE.SphereGeometry(1, 32, 20);
  body.scale(0.58, 1.08, 0.34);
  body.translate(0, 0.02, 0);
  paint(body, (position) => {
    const headPatch = position.y > 0.58 && position.z > -0.2;
    const midPatch = position.y > -0.12 && position.y < 0.32 && Math.abs(position.x) < 0.45;
    const rearPatch = position.y < -0.42 && position.x > -0.22;
    if (headPatch || midPatch || rearPatch) return KOI_ORANGE;
    return position.z < -0.15 ? KOI_BELLY : KOI_BODY;
  });
  parts.push(body);
  parts.push(forkedTail(0.82, 0.78, 0.16, -1.0, KOI_FIN));
  parts.push(finTriangle(0.7, 0.55, 0.18, 0.18, 0.3, KOI_FIN, "dorsal"));
  parts.push(finTriangle(0.58, 0.38, 0.16, -0.32, -0.28, KOI_FIN, "ventral"));
  parts.push(finTriangle(0.56, 0.44, 0.18, 0.32, 0.3, KOI_FIN, "pectoral-left"));
  parts.push(finTriangle(0.56, 0.44, 0.18, 0.32, -0.3, KOI_FIN, "pectoral-right"));
  parts.push(eye(0.34, 0.88, 0.2, 0.3));
  parts.push(eye(-0.34, 0.88, 0.2, 0.3));
  parts.push(mouth(0.08, 1.12, 0.01));
  return finish(parts);
}

function createClownfish(): FishModelInstance {
  const parts: THREE.BufferGeometry[] = [];
  const body = new THREE.SphereGeometry(1, 32, 20);
  body.scale(0.48, 0.88, 0.3);
  body.translate(0, 0.06, 0);
  paint(body, (position) => {
    const bands = [0.45, 0.02, -0.4];
    for (const center of bands) {
      const distance = Math.abs(position.y - center);
      if (distance < 0.095) return CLOWNFISH_WHITE;
      if (distance < 0.14) return CLOWNFISH_BLACK;
    }
    return position.z < -0.14 ? CLOWNFISH_BELLY : CLOWNFISH_BODY;
  });
  parts.push(body);
  parts.push(forkedTail(0.68, 0.68, 0.14, -0.88, CLOWNFISH_FIN));
  parts.push(finTriangle(0.56, 0.54, 0.16, 0.12, 0.28, CLOWNFISH_BLACK, "dorsal"));
  parts.push(finTriangle(0.48, 0.36, 0.14, -0.3, -0.26, CLOWNFISH_BLACK, "ventral"));
  parts.push(finTriangle(0.46, 0.4, 0.16, 0.28, 0.3, CLOWNFISH_FIN, "pectoral-left"));
  parts.push(finTriangle(0.46, 0.4, 0.16, 0.28, -0.3, CLOWNFISH_FIN, "pectoral-right"));
  parts.push(eye(0.28, 0.7, 0.2, 0.3));
  parts.push(eye(-0.28, 0.7, 0.2, 0.3));
  parts.push(mouth(0.08, 0.96, 0.02));
  return finish(parts);
}

function createStarfish(): FishModelInstance {
  const parts: THREE.BufferGeometry[] = [];
  const shape = new THREE.Shape();
  const outerRadius = 0.9;
  const innerRadius = 0.38;
  for (let index = 0; index < 10; index += 1) {
    const angle = Math.PI / 2 + index * (Math.PI / 5);
    const radius = index % 2 === 0 ? outerRadius : innerRadius;
    const point = new THREE.Vector2(Math.cos(angle) * radius, Math.sin(angle) * radius);
    if (index === 0) shape.moveTo(point.x, point.y);
    else shape.lineTo(point.x, point.y);
  }
  shape.closePath();
  const body = new THREE.ExtrudeGeometry(shape, {
    depth: 0.22,
    bevelEnabled: true,
    bevelSegments: 2,
    bevelSize: 0.06,
    bevelThickness: 0.04,
    curveSegments: 4,
  });
  body.translate(0, 0, -0.11);
  paint(body, (position) => (position.z > 0.06 ? STARFISH_HIGHLIGHT : STARFISH_BODY));
  parts.push(body);
  const center = new THREE.SphereGeometry(0.24, 16, 10);
  center.scale(1, 1, 0.34);
  center.translate(0, 0, 0.12);
  paint(center, () => STARFISH_HIGHLIGHT);
  parts.push(center);
  return finish(parts);
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

/** A thin, beveled, forked caudal fin with the aquarium's +Y swim direction. */
function forkedTail(
  width: number,
  height: number,
  thickness: number,
  y: number,
  color: THREE.Color,
): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(-width * 0.5, 0);
  shape.lineTo(width * 0.5, 0);
  shape.lineTo(width * 0.42, -height * 0.72);
  shape.lineTo(width * 0.16, -height * 0.56);
  shape.lineTo(0, -height * 0.36);
  shape.lineTo(-width * 0.16, -height * 0.56);
  shape.lineTo(-width * 0.42, -height * 0.72);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: true,
    bevelSegments: 1,
    bevelSize: 0.016,
    bevelThickness: 0.01,
  });
  geometry.translate(0, y, -thickness * 0.5);
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
