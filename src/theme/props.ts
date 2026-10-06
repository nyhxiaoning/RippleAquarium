import * as THREE from "three";
import type { BoxObstacle, SphereObstacle } from "../types.js";
import type { ThemeObjectHandle, ThemeObjectId, ThemePropId } from "./types.js";
import {
  createThemeMaterial,
  createThemeMesh,
  createRoundedBoxGeometry,
  disposeThemeResources,
} from "./procedural-parts.js";

/**
 * Compact footprints used by both the scene collision pass and clownfish
 * avoidance.  The dimensions describe the unscaled, bottom-anchored model.
 * Keeping these values here means the visual prop and its gameplay footprint
 * can evolve together without making scene-builder know model details.
 */
interface ThemeFootprint {
  width: number;
  height: number;
  depth: number;
  avoidanceRadius: number;
  avoidanceStrength: number;
}

const THEME_FOOTPRINTS: Record<ThemeObjectId, ThemeFootprint> = {
  spongebob: {
    width: 2.05,
    height: 2.65,
    depth: 1.35,
    avoidanceRadius: 1.28,
    avoidanceStrength: 2.4,
  },
  patrick: {
    width: 1.85,
    height: 2.55,
    depth: 1.35,
    avoidanceRadius: 1.2,
    avoidanceStrength: 2.4,
  },
  squidward: {
    width: 2.35,
    height: 3.45,
    depth: 1.8,
    avoidanceRadius: 1.55,
    avoidanceStrength: 2.4,
  },
  "mr-krabs": {
    width: 2.75,
    height: 2.7,
    depth: 1.95,
    avoidanceRadius: 1.72,
    avoidanceStrength: 2.4,
  },
  "squidward-house": {
    width: 3.8,
    height: 4.35,
    depth: 3.25,
    avoidanceRadius: 2.45,
    avoidanceStrength: 2.15,
  },
  "krusty-krab": {
    width: 4.45,
    height: 2.85,
    depth: 3.15,
    avoidanceRadius: 2.65,
    avoidanceStrength: 2.15,
  },
  "pineapple-house": {
    width: 3.85,
    height: 6.1,
    depth: 3.65,
    avoidanceRadius: 3.1,
    avoidanceStrength: 2.45,
  },
};

const DEFAULT_FOOTPRINT: ThemeFootprint = {
  width: 2,
  height: 2,
  depth: 2,
  avoidanceRadius: 1.5,
  avoidanceStrength: 2,
};

/** Return a copy so callers cannot mutate the module's collision metadata. */
export function getThemePropFootprint(id: ThemeObjectId | string, scale = 1): ThemeFootprint {
  const footprint = THEME_FOOTPRINTS[id as ThemeObjectId] ?? DEFAULT_FOOTPRINT;
  const safeScale = Number.isFinite(scale) ? Math.max(0, scale) : 1;
  return {
    width: footprint.width * safeScale,
    height: footprint.height * safeScale,
    depth: footprint.depth * safeScale,
    avoidanceRadius: footprint.avoidanceRadius * safeScale,
    avoidanceStrength: footprint.avoidanceStrength,
  };
}

/**
 * Create an obstacle for a themed object.  `position` is the obstacle centre;
 * scene-builder supplies a floor-adjusted Y coordinate for bottom-anchored
 * objects.  The input vector is always cloned to keep descriptor data safe.
 */
export function getThemePropCollision(
  id: ThemePropId | ThemeObjectId | string,
  position: THREE.Vector3,
  scale = 1,
): BoxObstacle {
  const footprint = getThemePropFootprint(id, scale);
  return {
    position: position.clone(),
    shape: "box",
    size: new THREE.Vector3(footprint.width, footprint.height, footprint.depth),
    render: false,
  };
}

/** Alias with a more general name for characters and props together. */
export const getThemeObjectCollision = getThemePropCollision;

/**
 * Return the circular exclusion used by fish that need to steer around a
 * character or prop.  Coral/anemone attraction remains independent, so this
 * zone does not mask the whole reef when a prop is placed nearby.
 */
export function getThemeAvoidanceZone(
  id: ThemePropId | ThemeObjectId | string,
  position: THREE.Vector3,
  scale = 1,
): SphereObstacle {
  const footprint = getThemePropFootprint(id, scale);
  return {
    position: position.clone(),
    radius: footprint.avoidanceRadius,
    strength: footprint.avoidanceStrength,
  };
}

/** Alias for callers that distinguish the object kind in their own code. */
export const getThemeObjectAvoidanceZone = getThemeAvoidanceZone;

interface PropMaterials {
  stone: THREE.MeshStandardMaterial;
  stoneLight: THREE.MeshStandardMaterial;
  dark: THREE.MeshStandardMaterial;
  door: THREE.MeshStandardMaterial;
  glass: THREE.MeshStandardMaterial;
  red: THREE.MeshStandardMaterial;
  blue: THREE.MeshStandardMaterial;
  yellow: THREE.MeshStandardMaterial;
  flag: THREE.MeshStandardMaterial;
  shell: THREE.MeshStandardMaterial;
  shellDark: THREE.MeshStandardMaterial;
  leaf: THREE.MeshStandardMaterial;
  leafDark: THREE.MeshStandardMaterial;
  wood: THREE.MeshStandardMaterial;
  woodDark: THREE.MeshStandardMaterial;
}

function createMaterials(): PropMaterials {
  const standard = (color: number, roughness = 0.82) => createThemeMaterial(color, roughness);

  return {
    stone: standard(0x5f6875, 0.94),
    stoneLight: standard(0x8994a1, 0.9),
    dark: standard(0x202835, 0.72),
    door: standard(0x35596e, 0.7),
    glass: new THREE.MeshStandardMaterial({
      color: 0x8ed6e5,
      roughness: 0.18,
      transparent: true,
      opacity: 0.78,
      flatShading: true,
    }),
    red: standard(0xd53b3f, 0.7),
    blue: standard(0x2c6bb1, 0.74),
    yellow: standard(0xf1c74b, 0.63),
    flag: standard(0xffe075, 0.78),
    shell: standard(0xeaa33a, 0.8),
    shellDark: standard(0xa35d20, 0.86),
    leaf: standard(0x21965a, 0.72),
    leafDark: standard(0x146f4c, 0.76),
    wood: standard(0x9a6338, 0.78),
    woodDark: standard(0x4a3022, 0.66),
  };
}

function buildSquidwardHouse(materials: PropMaterials): THREE.Group {
  const group = new THREE.Group();
  group.name = "Squidward house prop";

  const head = createThemeMesh("Stone head", new THREE.DodecahedronGeometry(1.25, 1), materials.stone);
  head.scale.set(1.08, 1.28, 0.88);
  head.position.y = 1.55;

  const brow = createThemeMesh("Stone brow", new THREE.BoxGeometry(1.55, 0.16, 0.2), materials.stoneLight);
  brow.position.set(0, 2.25, 0.78);
  brow.rotation.z = -0.08;

  const door = createThemeMesh("Stone door", new THREE.CapsuleGeometry(0.38, 0.6, 5, 12), materials.door);
  door.scale.set(1, 1.08, 0.13);
  door.position.set(0, 0.56, 0.94);

  const doorFrame = createThemeMesh("Stone door frame", new THREE.TorusGeometry(0.43, 0.045, 6, 16), materials.dark);
  doorFrame.position.copy(door.position);
  doorFrame.scale.set(1, 1.3, 0.18);

  const window = createThemeMesh("Stone window", new THREE.CylinderGeometry(0.27, 0.27, 0.09, 8), materials.glass);
  window.position.set(0.64, 1.57, 0.73);
  window.rotation.x = Math.PI / 2;

  const windowFrame = createThemeMesh("Stone window frame", new THREE.TorusGeometry(0.3, 0.04, 6, 12), materials.dark);
  windowFrame.position.copy(window.position);
  windowFrame.rotation.copy(window.rotation);
  windowFrame.scale.z = 0.25;

  const base = createThemeMesh("Stone base", new THREE.CylinderGeometry(1.22, 1.4, 0.22, 8), materials.stoneLight);
  base.position.y = 0.1;

  group.add(head, brow, door, doorFrame, window, windowFrame, base);
  return group;
}

function buildKrustyKrab(materials: PropMaterials): THREE.Group {
  const group = new THREE.Group();
  group.name = "Krusty Krab prop";

  const counter = createThemeMesh("Krusty Krab counter", new THREE.BoxGeometry(2.5, 0.75, 1.42), materials.red);
  counter.position.y = 0.48;

  const counterTop = createThemeMesh("Krusty Krab counter top", new THREE.BoxGeometry(2.8, 0.18, 1.6), materials.yellow);
  counterTop.position.y = 0.94;

  const sign = createThemeMesh("Krusty Krab sign", new THREE.BoxGeometry(2.05, 0.62, 0.13), materials.red);
  sign.position.set(0, 2.02, 0.1);

  const signTrim = createThemeMesh("Krusty Krab sign trim", new THREE.BoxGeometry(1.78, 0.39, 0.08), materials.yellow);
  signTrim.position.set(0, 2.02, 0.18);

  const pole = createThemeMesh("Krusty Krab flag pole", new THREE.CylinderGeometry(0.055, 0.055, 1.48, 6), materials.dark);
  pole.position.set(0, 2.74, 0);

  const flag = createThemeMesh("Krusty Krab flag", new THREE.ConeGeometry(0.32, 0.72, 3), materials.flag);
  flag.position.set(0.28, 3.15, 0);
  flag.rotation.z = -Math.PI / 2;
  flag.scale.set(0.9, 1, 0.55);

  const window = createThemeMesh("Krusty Krab window", new THREE.BoxGeometry(1.18, 0.48, 0.1), materials.blue);
  window.position.set(0, 0.52, 0.75);

  group.add(counter, counterTop, sign, signTrim, pole, flag, window);
  return group;
}

/** Build a bottom-anchored, texture-free pineapple house. */
function buildPineappleHouse(materials: PropMaterials): THREE.Group {
  const group = new THREE.Group();
  group.name = "Pineapple house prop";

  const body = createThemeMesh(
    "pineapple-body",
    new THREE.SphereGeometry(1, 24, 16),
    materials.shell,
  );
  body.position.y = 2.35;
  body.scale.set(1.72, 2.22, 1.65);

  const ridges = new THREE.Group();
  ridges.name = "pineapple-ridges";
  const ridgeGeometry = createRoundedBoxGeometry(0.14, 1.25, 0.1, 0.035);
  const ridgePlacements = [
    { x: -1.12, y: 1.42, rotation: -0.58 },
    { x: -0.58, y: 2.38, rotation: -0.58 },
    { x: 0.58, y: 2.38, rotation: 0.58 },
    { x: 1.12, y: 1.42, rotation: 0.58 },
    { x: -0.58, y: 3.32, rotation: 0.58 },
    { x: 0.58, y: 3.32, rotation: -0.58 },
  ];
  for (let index = 0; index < ridgePlacements.length; index += 1) {
    const placement = ridgePlacements[index];
    const ridge = createThemeMesh(
      `pineapple-ridge-${index}`,
      ridgeGeometry,
      materials.shellDark,
    );
    ridge.position.set(placement.x, placement.y, 1.52);
    ridge.rotation.z = placement.rotation;
    ridge.scale.y = 1.18;
    ridges.add(ridge);
  }

  const leafCrown = new THREE.Group();
  leafCrown.name = "pineapple-leaf-crown";
  const leafGeometry = new THREE.ConeGeometry(0.24, 1.45, 5);
  for (let index = 0; index < 9; index += 1) {
    const angle = (index / 9) * Math.PI * 2;
    const leaf = createThemeMesh(`pineapple-leaf-${index}`, leafGeometry, index % 3 === 0 ? materials.leafDark : materials.leaf);
    const radius = index === 0 ? 0 : 0.22;
    leaf.position.set(Math.sin(angle) * radius, 4.78 + (index % 2) * 0.08, Math.cos(angle) * radius);
    leaf.rotation.set(
      THREE.MathUtils.degToRad(22 + (index % 2) * 9),
      angle,
      THREE.MathUtils.degToRad((index % 2 === 0 ? 1 : -1) * 12),
    );
    leaf.scale.set(0.78, 1.04 - (index % 3) * 0.08, 0.42);
    leafCrown.add(leaf);
  }

  const windows = new THREE.Group();
  windows.name = "pineapple-windows";
  const windowGeometry = new THREE.CylinderGeometry(0.25, 0.25, 0.1, 12);
  const windowFrameGeometry = new THREE.TorusGeometry(0.29, 0.04, 6, 16);
  for (const [index, x] of [-0.82, 0.82].entries()) {
    const window = createThemeMesh(
      `pineapple-window-${index === 0 ? "left" : "right"}`,
      windowGeometry,
      materials.glass,
    );
    window.position.set(x, index === 0 ? 2.72 : 2.9, 1.42);
    window.rotation.x = Math.PI / 2;
    window.scale.setScalar(index === 0 ? 1 : 0.9);
    const frame = createThemeMesh(
      `pineapple-window-frame-${index === 0 ? "left" : "right"}`,
      windowFrameGeometry,
      materials.woodDark,
    );
    frame.position.copy(window.position);
    frame.rotation.copy(window.rotation);
    frame.scale.copy(window.scale);
    windows.add(window, frame);
  }

  const door = createThemeMesh(
    "pineapple-door",
    new THREE.CapsuleGeometry(0.42, 0.62, 7, 14),
    materials.wood,
  );
  door.position.set(0, 0.72, 1.57);
  door.scale.set(1, 1.08, 0.12);

  const doorFrame = createThemeMesh(
    "pineapple-door-frame",
    new THREE.TorusGeometry(0.47, 0.045, 6, 16),
    materials.woodDark,
  );
  doorFrame.position.copy(door.position);
  doorFrame.scale.set(0.9, 1.22, 0.15);

  const knob = createThemeMesh("pineapple-door-knob", new THREE.SphereGeometry(0.06, 8, 6), materials.woodDark);
  knob.position.set(0.22, 0.68, 1.7);

  const base = createThemeMesh(
    "pineapple-base",
    new THREE.CylinderGeometry(1.55, 1.75, 0.22, 10),
    materials.stoneLight,
  );
  base.position.y = 0.1;

  const doorstep = createThemeMesh(
    "pineapple-doorstep",
    createRoundedBoxGeometry(0.96, 0.14, 0.52, 0.05),
    materials.stone,
  );
  doorstep.position.set(0, 0.12, 1.68);

  group.add(body, ridges, leafCrown, windows, door, doorFrame, knob, base, doorstep);
  return group;
}

/**
 * Build a procedural themed prop. Unknown IDs return null so a malformed
 * optional theme entry cannot prevent the aquarium itself from loading.
 */
export function createThemeProp(
  id: ThemePropId,
  options: { scale?: number } = {},
): ThemeObjectHandle | null {
  if (id !== "pineapple-house" && id !== "squidward-house" && id !== "krusty-krab") return null;
  const scale = Number.isFinite(options?.scale) ? Math.max(0, options.scale) : 1;

  let group: THREE.Group;
  try {
    const materials = createMaterials();
    group = id === "pineapple-house"
      ? buildPineappleHouse(materials)
      : id === "squidward-house"
        ? buildSquidwardHouse(materials)
        : buildKrustyKrab(materials);
    group.name = `Theme-${id}`;
    group.scale.setScalar(scale);
    group.userData.themePropId = id;
  } catch (error) {
    console.warn(`Theme prop ${id} could not be created.`, error);
    return null;
  }

  let disposed = false;
  return {
    group,
    update() {
      // Props are intentionally static; the lifecycle method keeps them
      // interchangeable with animated theme characters.
    },
    resize(halfSize: THREE.Vector3) {
      if (disposed) return;
      // Geometry is authored from y=0 upward, making the group bottom-anchored
      // to the tank floor while preserving its X/Z placement from the entry.
      group.position.y = -halfSize.y;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      disposeThemeResources(group);
      group.clear();
    },
  };
}
