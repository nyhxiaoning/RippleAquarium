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
const tmpColor = new THREE.Color();

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

type BodyColor = (position: THREE.Vector3, normalizedY: number) => THREE.Color;

interface NaturalBodyOptions {
  scale: THREE.Vector3;
  center?: THREE.Vector3;
  radialSegments?: number;
  verticalSegments?: number;
  taper?: number;
  headFullness?: number;
  colorAt: BodyColor;
}

/**
 * Build a smooth, slightly tapered ellipsoid with the aquarium's +Y swim axis.
 * The taper is applied to the rear third while headFullness rounds the front
 * third, giving species a natural caudal transition without frame-time work.
 */
function createNaturalBody(options: NaturalBodyOptions): THREE.BufferGeometry {
  const radialSegments = Math.max(28, Math.floor(options.radialSegments ?? 32));
  const verticalSegments = Math.max(12, Math.floor(options.verticalSegments ?? 20));
  const taper = THREE.MathUtils.clamp(options.taper ?? 0.16, 0, 0.8);
  const headFullness = THREE.MathUtils.clamp(options.headFullness ?? 0.12, 0, 0.8);
  const geometry = new THREE.SphereGeometry(1, radialSegments, verticalSegments);
  const position = geometry.getAttribute("position");

  for (let index = 0; index < position.count; index += 1) {
    const x = position.getX(index);
    const y = position.getY(index);
    const z = position.getZ(index);
    const normalizedY = THREE.MathUtils.clamp((y + 1) * 0.5, 0, 1);
    const headMask = THREE.MathUtils.smoothstep(normalizedY, 0.56, 1);
    const rearMask = THREE.MathUtils.smoothstep(1 - normalizedY, 0.52, 1);
    const radialFactor = Math.max(0.2, 1 + headFullness * headMask - taper * rearMask);
    position.setXYZ(index, x * radialFactor, y, z * radialFactor);
  }
  position.needsUpdate = true;
  geometry.scale(options.scale.x, options.scale.y, options.scale.z);
  if (options.center) geometry.translate(options.center.x, options.center.y, options.center.z);

  const centerY = options.center?.y ?? 0;
  paint(geometry, (vertex) => {
    const normalizedY = THREE.MathUtils.clamp(
      (vertex.y - centerY) / Math.max(0.0001, options.scale.y) * 0.5 + 0.5,
      0,
      1,
    );
    return options.colorAt(vertex, normalizedY);
  });
  return geometry;
}

/** Build a short, tapered transition between a body and its caudal fin. */
function createTailPeduncle(options: {
  y: number;
  length: number;
  bodyRadius: number;
  tailRadius: number;
  color: THREE.Color;
}): THREE.BufferGeometry {
  const length = Math.max(0.02, options.length);
  const geometry = new THREE.CylinderGeometry(
    Math.max(0.001, options.tailRadius),
    Math.max(0.001, options.bodyRadius),
    length,
    20,
    1,
    false,
  );
  // CylinderGeometry's +Y end is the body-facing end; y is the rear endpoint.
  geometry.translate(0, options.y - length * 0.5, 0);
  paint(geometry, () => options.color);
  return geometry;
}

/** Build a thin, softly rounded forked caudal fin. */
function createCaudalFin(options: {
  y: number;
  width: number;
  height: number;
  thickness: number;
  color: THREE.Color;
  fork: number;
}): THREE.BufferGeometry {
  const width = Math.max(0.02, options.width);
  const height = Math.max(0.02, options.height);
  const fork = THREE.MathUtils.clamp(options.fork, 0.05, 0.85);
  const shape = new THREE.Shape();
  shape.moveTo(-width * 0.06, 0);
  shape.quadraticCurveTo(-width * 0.42, -height * 0.02, -width * 0.5, -height * 0.35);
  shape.quadraticCurveTo(-width * 0.48, -height * 0.7, -width * 0.22, -height * 0.66);
  shape.quadraticCurveTo(-width * 0.08, -height * 0.63, 0, -height * (0.35 + fork * 0.35));
  shape.quadraticCurveTo(width * 0.08, -height * 0.63, width * 0.22, -height * 0.66);
  shape.quadraticCurveTo(width * 0.48, -height * 0.7, width * 0.5, -height * 0.35);
  shape.quadraticCurveTo(width * 0.42, -height * 0.02, width * 0.06, 0);
  shape.closePath();
  const thickness = Math.max(0.04, options.thickness);
  const bevel = Math.min(0.018, thickness * 0.2);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: true,
    bevelSegments: 2,
    bevelSize: bevel,
    bevelThickness: bevel,
    curveSegments: 4,
  });
  // The shape is authored in an x/z profile. Extrude along local z, then
  // rotate it so the fin's thickness follows the swim axis (+Y).
  geometry.rotateX(Math.PI / 2);
  geometry.translate(0, options.y + thickness * 0.5, 0);
  paint(geometry, () => options.color);
  return geometry;
}

/** Build a thin curved membrane fin rather than a chunky triangular prism. */
function createMembraneFin(options: {
  baseY: number;
  baseZ: number;
  span: number;
  height: number;
  thickness: number;
  color: THREE.Color;
  orientation: "dorsal" | "ventral" | "pectoral";
}): THREE.BufferGeometry {
  const span = Math.max(0.02, options.span);
  const height = Math.max(0.02, options.height);
  const shape = new THREE.Shape();
  shape.moveTo(-span * 0.5, 0);
  shape.lineTo(span * 0.5, 0);
  shape.quadraticCurveTo(span * 0.42, height * 0.58, span * 0.08, height);
  shape.quadraticCurveTo(-span * 0.28, height * 0.86, -span * 0.5, 0);
  shape.closePath();
  const thickness = Math.max(0.025, options.thickness);
  const bevel = Math.min(0.012, thickness * 0.2);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: true,
    bevelSegments: 1,
    bevelSize: bevel,
    bevelThickness: bevel,
    curveSegments: 4,
  });
  if (options.orientation === "dorsal") {
    geometry.rotateX(Math.PI / 2);
  } else if (options.orientation === "ventral") {
    geometry.rotateX(-Math.PI / 2);
  } else {
    geometry.rotateZ(Math.PI / 2);
  }
  geometry.translate(0, options.baseY, options.baseZ);
  paint(geometry, () => options.color);
  return geometry;
}

function createSardine(): FishModelInstance {
  const parts: THREE.BufferGeometry[] = [];
  const body = createNaturalBody({
    scale: new THREE.Vector3(0.42, 1.08, 0.23),
    center: new THREE.Vector3(0, 0.08, 0),
    radialSegments: 32,
    verticalSegments: 20,
    taper: 0.2,
    headFullness: 0.14,
    colorAt: (position, normalizedY) => {
      if (position.z < -0.08) return SARDINE_BELLY;
      if (position.z > 0.095 && normalizedY < 0.78) return SARDINE_STRIPE;
      return SARDINE_BODY;
    },
  });
  parts.push(body);
  parts.push(createTailPeduncle({
    y: -0.98,
    length: 0.3,
    bodyRadius: 0.14,
    tailRadius: 0.07,
    color: SARDINE_FIN,
  }));
  parts.push(createCaudalFin({
    y: -1.15,
    width: 0.64,
    height: 0.54,
    thickness: 0.06,
    color: SARDINE_FIN,
    fork: 0.32,
  }));
  parts.push(createMembraneFin({
    baseY: 0.24,
    baseZ: 0.18,
    span: 0.48,
    height: 0.18,
    thickness: 0.04,
    color: SARDINE_FIN,
    orientation: "dorsal",
  }));
  parts.push(createMembraneFin({
    baseY: -0.34,
    baseZ: -0.18,
    span: 0.38,
    height: 0.12,
    thickness: 0.04,
    color: SARDINE_FIN,
    orientation: "ventral",
  }));
  parts.push(createMembraneFin({
    baseY: 0.36,
    baseZ: 0.02,
    span: 0.3,
    height: 0.11,
    thickness: 0.035,
    color: SARDINE_FIN,
    orientation: "pectoral",
  }));
  const sardinePectoral = createMembraneFin({
    baseY: 0.36,
    baseZ: 0.02,
    span: 0.3,
    height: 0.11,
    thickness: 0.035,
    color: SARDINE_FIN,
    orientation: "pectoral",
  });
  sardinePectoral.scale(-1, 1, 1);
  parts.push(sardinePectoral);
  parts.push(eye(0.23, 0.86, 0.12, 0.28));
  parts.push(eye(-0.23, 0.86, 0.12, 0.28));
  parts.push(mouth(0.06, 1.12, 0.01));
  return finish(parts);
}

function createKoi(): FishModelInstance {
  const parts: THREE.BufferGeometry[] = [];
  const body = createNaturalBody({
    scale: new THREE.Vector3(0.58, 1.08, 0.34),
    center: new THREE.Vector3(0, 0.02, 0),
    radialSegments: 32,
    verticalSegments: 20,
    taper: 0.14,
    headFullness: 0.22,
    colorAt: (position) => {
      const bellyWeight = 1 - THREE.MathUtils.smoothstep(position.z, -0.22, -0.04);
      const headDistance = Math.hypot((position.y - 0.62) / 0.42, position.x / 0.5);
      const midDistance = Math.hypot((position.y - 0.06) / 0.42, position.x / 0.56);
      const rearDistance = Math.hypot((position.y + 0.54) / 0.36, (position.x - 0.08) / 0.42);
      const headPatch = 1 - THREE.MathUtils.smoothstep(headDistance, 0.38, 0.86);
      const midPatch = 1 - THREE.MathUtils.smoothstep(midDistance, 0.42, 0.9);
      const rearPatch = 1 - THREE.MathUtils.smoothstep(rearDistance, 0.38, 0.88);
      const orangeWeight = Math.max(headPatch, midPatch, rearPatch);
      tmpColor.copy(KOI_BODY).lerp(KOI_BELLY, bellyWeight);
      return tmpColor.lerp(KOI_ORANGE, orangeWeight);
    },
  });
  parts.push(body);
  parts.push(createTailPeduncle({
    y: -1.0,
    length: 0.34,
    bodyRadius: 0.22,
    tailRadius: 0.1,
    color: KOI_FIN,
  }));
  parts.push(createCaudalFin({
    y: -1.2,
    width: 0.9,
    height: 0.68,
    thickness: 0.08,
    color: KOI_FIN,
    fork: 0.28,
  }));
  parts.push(createMembraneFin({
    baseY: 0.22,
    baseZ: 0.29,
    span: 0.62,
    height: 0.22,
    thickness: 0.05,
    color: KOI_FIN,
    orientation: "dorsal",
  }));
  parts.push(createMembraneFin({
    baseY: -0.34,
    baseZ: -0.28,
    span: 0.48,
    height: 0.15,
    thickness: 0.045,
    color: KOI_FIN,
    orientation: "ventral",
  }));
  parts.push(createMembraneFin({
    baseY: 0.42,
    baseZ: 0.02,
    span: 0.4,
    height: 0.15,
    thickness: 0.04,
    color: KOI_FIN,
    orientation: "pectoral",
  }));
  const koiPectoral = createMembraneFin({
    baseY: 0.42,
    baseZ: 0.02,
    span: 0.4,
    height: 0.15,
    thickness: 0.04,
    color: KOI_FIN,
    orientation: "pectoral",
  });
  koiPectoral.scale(-1, 1, 1);
  parts.push(koiPectoral);
  parts.push(eye(0.34, 0.88, 0.2, 0.3));
  parts.push(eye(-0.34, 0.88, 0.2, 0.3));
  parts.push(mouth(0.08, 1.12, 0.01));
  return finish(parts);
}

function createClownfish(): FishModelInstance {
  const parts: THREE.BufferGeometry[] = [];
  const body = createNaturalBody({
    scale: new THREE.Vector3(0.48, 0.88, 0.3),
    center: new THREE.Vector3(0, 0.06, 0),
    radialSegments: 32,
    verticalSegments: 20,
    taper: 0.16,
    headFullness: 0.18,
    colorAt: (position) => {
      tmpColor.copy(position.z < -0.14 ? CLOWNFISH_BELLY : CLOWNFISH_BODY);
      let whiteWeight = 0;
      let blackWeight = 0;
      for (const center of [0.45, 0.02, -0.4]) {
        const distance = Math.abs(position.y - center);
        whiteWeight = Math.max(whiteWeight, 1 - THREE.MathUtils.smoothstep(distance, 0.055, 0.11));
        blackWeight = Math.max(blackWeight, 1 - THREE.MathUtils.smoothstep(distance, 0.1, 0.16));
      }
      tmpColor.lerp(CLOWNFISH_BLACK, blackWeight);
      return tmpColor.lerp(CLOWNFISH_WHITE, whiteWeight);
    },
  });
  parts.push(body);
  parts.push(createTailPeduncle({
    y: -0.82,
    length: 0.28,
    bodyRadius: 0.15,
    tailRadius: 0.075,
    color: CLOWNFISH_FIN,
  }));
  parts.push(createCaudalFin({
    y: -1.0,
    width: 0.68,
    height: 0.56,
    thickness: 0.06,
    color: CLOWNFISH_FIN,
    fork: 0.3,
  }));
  parts.push(createMembraneFin({
    baseY: 0.22,
    baseZ: 0.25,
    span: 0.52,
    height: 0.2,
    thickness: 0.045,
    color: CLOWNFISH_BLACK,
    orientation: "dorsal",
  }));
  parts.push(createMembraneFin({
    baseY: -0.3,
    baseZ: -0.24,
    span: 0.4,
    height: 0.14,
    thickness: 0.04,
    color: CLOWNFISH_BLACK,
    orientation: "ventral",
  }));
  parts.push(createMembraneFin({
    baseY: 0.34,
    baseZ: 0.02,
    span: 0.36,
    height: 0.14,
    thickness: 0.04,
    color: CLOWNFISH_FIN,
    orientation: "pectoral",
  }));
  const clownfishPectoral = createMembraneFin({
    baseY: 0.34,
    baseZ: 0.02,
    span: 0.36,
    height: 0.14,
    thickness: 0.04,
    color: CLOWNFISH_FIN,
    orientation: "pectoral",
  });
  clownfishPectoral.scale(-1, 1, 1);
  parts.push(clownfishPectoral);
  parts.push(eye(0.28, 0.7, 0.2, 0.3));
  parts.push(eye(-0.28, 0.7, 0.2, 0.3));
  parts.push(mouth(0.08, 0.96, 0.02));
  return finish(parts);
}

function createStarfish(): FishModelInstance {
  const parts: THREE.BufferGeometry[] = [];
  const shape = new THREE.Shape();
  const armCount = 5;
  const samplesPerArm = 8;
  const armLength = 0.82;
  const rootRadius = 0.34;
  const profile: THREE.Vector2[] = [];
  for (let arm = 0; arm < armCount; arm += 1) {
    const centerAngle = Math.PI / 2 + (arm * Math.PI * 2) / armCount;
    for (let sample = 0; sample < samplesPerArm; sample += 1) {
      const t = sample / samplesPerArm;
      const localAngle = THREE.MathUtils.lerp(-Math.PI / 5, Math.PI / 5, t);
      const armWeight = Math.pow(Math.cos(localAngle * 2.5), 0.7);
      const radius = rootRadius + armLength * Math.max(0, armWeight);
      const angle = centerAngle + localAngle;
      profile.push(new THREE.Vector2(Math.cos(angle) * radius, Math.sin(angle) * radius));
    }
  }
  shape.moveTo(profile[0].x, profile[0].y);
  shape.splineThru([...profile.slice(1), profile[0]]);
  shape.closePath();
  const body = new THREE.ExtrudeGeometry(shape, {
    depth: 0.16,
    bevelEnabled: true,
    bevelSegments: 3,
    bevelSize: 0.045,
    bevelThickness: 0.035,
    curveSegments: 6,
  });
  body.translate(0, 0, -0.08);
  paint(body, (position) => {
    const radial = Math.min(1, Math.hypot(position.x, position.y) / 1.12);
    return tmpColor.copy(STARFISH_HIGHLIGHT).lerp(STARFISH_BODY, radial);
  });
  parts.push(body);
  const center = new THREE.SphereGeometry(0.27, 20, 12);
  center.scale(1, 1, 0.28);
  center.translate(0, 0, 0.1);
  paint(center, () => STARFISH_HIGHLIGHT);
  parts.push(center);
  return finish(parts);
}

function createAngelfish(): FishModelInstance {
  const parts: THREE.BufferGeometry[] = [];
  const body = createNaturalBody({
    scale: new THREE.Vector3(0.56, 1.06, 0.44),
    center: new THREE.Vector3(0, 0.12, 0),
    radialSegments: 32,
    verticalSegments: 20,
    taper: 0.12,
    headFullness: 0.2,
    colorAt: (position) => {
      const stripeWeight = [0.62, 0.15, -0.31, -0.7].reduce(
        (weight, center) =>
          Math.max(weight, 1 - THREE.MathUtils.smoothstep(Math.abs(position.y - center), 0.065, 0.14)),
        0,
      );
      tmpColor.copy(position.z < -0.08 ? ANGEL_BELLY : ANGEL_BODY);
      return tmpColor.lerp(ANGEL_STRIPE, stripeWeight);
    },
  });
  parts.push(body);
  parts.push(createTailPeduncle({ y: -0.96, length: 0.3, bodyRadius: 0.17, tailRadius: 0.08, color: ANGEL_BODY }));
  parts.push(createCaudalFin({ y: -1.14, width: 0.74, height: 0.58, thickness: 0.06, color: ANGEL_BODY, fork: 0.26 }));
  parts.push(createMembraneFin({ baseY: 0.22, baseZ: 0.36, span: 1.38, height: 0.78, thickness: 0.045, color: ANGEL_FIN, orientation: "dorsal" }));
  parts.push(createMembraneFin({ baseY: -0.2, baseZ: -0.34, span: 1.22, height: 0.68, thickness: 0.045, color: ANGEL_FIN, orientation: "ventral" }));
  parts.push(createMembraneFin({ baseY: 0.46, baseZ: 0.24, span: 0.48, height: 0.18, thickness: 0.04, color: ANGEL_FIN, orientation: "pectoral" }));
  const angelfishPectoral = createMembraneFin({ baseY: 0.46, baseZ: 0.24, span: 0.48, height: 0.18, thickness: 0.04, color: ANGEL_FIN, orientation: "pectoral" });
  angelfishPectoral.scale(-1, 1, 1);
  parts.push(angelfishPectoral);
  parts.push(eye(0.36, 0.77, 0.17, 0.36));
  parts.push(eye(-0.36, 0.77, 0.17, 0.36));
  parts.push(mouth(0.1, 0.98, 0.02));
  return finish(parts);
}

function createBlueTang(): FishModelInstance {
  const parts: THREE.BufferGeometry[] = [];
  const body = createNaturalBody({
    scale: new THREE.Vector3(0.76, 0.98, 0.32),
    center: new THREE.Vector3(0, 0.08, 0),
    radialSegments: 32,
    verticalSegments: 20,
    taper: 0.12,
    headFullness: 0.16,
    colorAt: (position) => {
      const yellowWeight = THREE.MathUtils.smoothstep(-position.y, 0.55, 0.9);
      const darkWeight = Math.max(
        1 - THREE.MathUtils.smoothstep(Math.abs(position.x), 0.42, 0.66),
        1 - THREE.MathUtils.smoothstep(position.y, -0.05, 0.42),
      );
      tmpColor.copy(position.z < -0.12 ? TANG_BELLY : TANG_BODY);
      tmpColor.lerp(TANG_DARK, darkWeight * 0.78);
      return tmpColor.lerp(TANG_YELLOW, yellowWeight);
    },
  });
  parts.push(body);
  parts.push(createTailPeduncle({ y: -0.94, length: 0.3, bodyRadius: 0.18, tailRadius: 0.08, color: TANG_YELLOW }));
  parts.push(createCaudalFin({ y: -1.12, width: 0.78, height: 0.58, thickness: 0.065, color: TANG_YELLOW, fork: 0.3 }));
  parts.push(createMembraneFin({ baseY: 0.2, baseZ: 0.27, span: 0.76, height: 0.2, thickness: 0.04, color: TANG_DARK, orientation: "dorsal" }));
  parts.push(createMembraneFin({ baseY: -0.22, baseZ: -0.25, span: 0.68, height: 0.18, thickness: 0.04, color: TANG_DARK, orientation: "ventral" }));
  parts.push(createMembraneFin({ baseY: 0.44, baseZ: 0.1, span: 0.42, height: 0.2, thickness: 0.04, color: TANG_DARK, orientation: "pectoral" }));
  const tangPectoral = createMembraneFin({ baseY: 0.44, baseZ: 0.1, span: 0.42, height: 0.2, thickness: 0.04, color: TANG_DARK, orientation: "pectoral" });
  tangPectoral.scale(-1, 1, 1);
  parts.push(tangPectoral);
  parts.push(eye(0.4, 0.72, 0.17, 0.4));
  parts.push(eye(-0.4, 0.72, 0.17, 0.4));
  parts.push(mouth(0.12, 0.96, 0.02));
  return finish(parts);
}

function createPufferfish(): FishModelInstance {
  const parts: THREE.BufferGeometry[] = [];
  const body = createNaturalBody({
    scale: new THREE.Vector3(0.84, 0.82, 0.78),
    center: new THREE.Vector3(0, 0.02, 0),
    radialSegments: 36,
    verticalSegments: 24,
    taper: 0.05,
    headFullness: 0.08,
    colorAt: (position) => (position.z < -0.14 ? PUFFER_BELLY : PUFFER_BODY),
  });
  parts.push(body);
  parts.push(createMembraneFin({ baseY: 0.28, baseZ: 0.7, span: 0.42, height: 0.18, thickness: 0.04, color: PUFFER_FIN, orientation: "dorsal" }));
  parts.push(createMembraneFin({ baseY: -0.24, baseZ: -0.7, span: 0.42, height: 0.16, thickness: 0.04, color: PUFFER_FIN, orientation: "ventral" }));
  parts.push(createMembraneFin({ baseY: 0.36, baseZ: 0.16, span: 0.36, height: 0.18, thickness: 0.04, color: PUFFER_FIN, orientation: "pectoral" }));
  const pufferPectoral = createMembraneFin({ baseY: 0.36, baseZ: 0.16, span: 0.36, height: 0.18, thickness: 0.04, color: PUFFER_FIN, orientation: "pectoral" });
  pufferPectoral.scale(-1, 1, 1);
  parts.push(pufferPectoral);
  parts.push(eye(0.46, 0.46, 0.2, 0.48));
  parts.push(eye(-0.46, 0.46, 0.2, 0.48));
  parts.push(mouth(0.12, 0.72, 0.02));

  const spineDirections = [
    [0.76, 0.25, 0.46], [-0.76, 0.25, 0.46], [0.72, 0.18, -0.5], [-0.72, 0.18, -0.5],
    [0.42, 0.52, 0.56], [-0.42, 0.52, 0.56], [0.38, -0.54, 0.56], [-0.38, -0.54, 0.56],
  ];
  for (const [x, y, z] of spineDirections) {
    tmpAxis.set(x, y, z).normalize();
    const spine = new THREE.ConeGeometry(0.045, 0.16, 5);
    tmpQuaternion.setFromUnitVectors(localForward, tmpAxis);
    spine.applyQuaternion(tmpQuaternion);
    spine.translate(tmpAxis.x * 0.75, tmpAxis.y * 0.75, tmpAxis.z * 0.75);
    paint(spine, () => PUFFER_FIN);
    parts.push(spine);
  }
  return finish(parts);
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
  for (const part of normalized) part.dispose();
  for (const part of parts) {
    if (!normalized.includes(part)) part.dispose();
  }
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
