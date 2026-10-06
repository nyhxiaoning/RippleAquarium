import * as THREE from "three";
import type { ThemeCharacterId, ThemeObjectHandle } from "./types.js";
import {
  type MrKrabsAnimationParts,
  type PatrickAnimationParts,
  type SquidwardAnimationParts,
  type SpongeBobAnimationParts,
  type StaticRotation,
  updateMrKrabsAnimation,
  updatePatrickAnimation,
  updateSquidwardAnimation,
  updateSpongeBobAnimation,
} from "./animation.js";
import {
  createEyePair,
  createRoundedBoxGeometry,
  createThemeMaterial,
  createThemeMesh,
  disposeThemeResources,
} from "./procedural-parts.js";

export type {
  MrKrabsAnimationParts,
  PatrickAnimationParts,
  SquidwardAnimationParts,
  SpongeBobAnimationParts,
} from "./animation.js";

export interface ThemeCharacterOptions {
  scale: number;
  animationEnabled: boolean;
}

export interface ThemeCharacterHandle extends ThemeObjectHandle {
  /** Runtime-only setting; it is intentionally not part of the theme save data. */
  setAnimationEnabled(enabled: boolean): void;
}

const SQUIDWARD_SKIN = 0x7196a2;
const SQUIDWARD_DARK = 0x4e707b;
const SQUIDWARD_PURPLE = 0x704c87;
const EYE_WHITE = 0xf7f5e8;
const EYE_DARK = 0x19222c;
const MR_KRABS_RED = 0xc73d4d;
const MR_KRABS_DARK_RED = 0x8e2336;
const MR_KRABS_BLUE = 0x315aa7;
const MR_KRABS_YELLOW = 0xf4d45f;
const SPONGEBOB_YELLOW = 0xf7d83d;
const SPONGEBOB_LIGHT = 0xffed72;
const SPONGEBOB_SPOT = 0xb9ad2b;
const SPONGEBOB_WHITE = 0xf8f4df;
const SPONGEBOB_RED = 0xd73332;
const SPONGEBOB_BROWN = 0x9a542d;
const SPONGEBOB_BLACK = 0x171a1d;
const PATRICK_PINK = 0xef8f9a;
const PATRICK_LIGHT = 0xf5a8ad;
const PATRICK_GREEN = 0x73ad4c;
const PATRICK_PURPLE = 0x7e55ae;

function snapshotRotation(object: THREE.Object3D): StaticRotation {
  return { x: object.rotation.x, y: object.rotation.y, z: object.rotation.z };
}

/** Build Squidward's model and return the references used by its animation. */
export function createSquidwardParts(group: THREE.Group): SquidwardAnimationParts {
  const skin = createThemeMaterial(SQUIDWARD_SKIN);
  const darkSkin = createThemeMaterial(SQUIDWARD_DARK);
  const purple = createThemeMaterial(SQUIDWARD_PURPLE);
  const white = createThemeMaterial(EYE_WHITE, 0.68);
  const dark = createThemeMaterial(EYE_DARK, 0.52);

  const body = createThemeMesh(
    "body",
    new THREE.CapsuleGeometry(0.42, 0.72, 4, 8),
    darkSkin,
    { x: 0, y: 0.98, z: 0 },
  );
  body.scale.set(1.02, 1.08, 0.83);
  group.add(body);

  const head = createThemeMesh("head", new THREE.SphereGeometry(0.73, 12, 8), skin, { x: 0, y: 1.85, z: 0 });
  head.scale.set(0.98, 1.08, 0.82);
  group.add(head);

  const nose = createThemeMesh("nose", new THREE.ConeGeometry(0.2, 0.62, 8), skin, { x: 0, y: 1.71, z: 0.61 });
  nose.rotation.x = Math.PI / 2;
  group.add(nose);

  createEyePair(group, {
    eyeGroupName: "eyes",
    eyeWhiteMaterial: white,
    eyeDarkMaterial: dark,
    y: 2.13,
    z: 0.52,
    spacing: 0.22,
    eyeScale: 1.12,
  });

  const mouth = createThemeMesh("mouth", new THREE.BoxGeometry(0.35, 0.035, 0.025), dark, { x: 0, y: 1.46, z: 0.69 });
  mouth.rotation.z = -0.08;
  group.add(mouth);

  const tentacles: THREE.Object3D[] = [];
  const tentaclePositions = [
    { x: -0.43, y: 0.82, z: 0.16, rz: -0.16, rx: -0.04 },
    { x: -0.14, y: 0.72, z: -0.1, rz: -0.04, rx: 0.02 },
    { x: 0.14, y: 0.72, z: -0.1, rz: 0.04, rx: 0.02 },
    { x: 0.43, y: 0.82, z: 0.16, rz: 0.16, rx: -0.04 },
  ];
  for (let index = 0; index < tentaclePositions.length; index += 1) {
    const placement = tentaclePositions[index];
    const tentacle = new THREE.Group();
    tentacle.name = `tentacle-${index}`;
    tentacle.position.set(placement.x, placement.y, placement.z);
    tentacle.rotation.set(placement.rx, 0, placement.rz);
    const segment = createThemeMesh(
      `tentacle-${index}-segment`,
      new THREE.CylinderGeometry(0.13, 0.17, 0.82, 7),
      purple,
      { x: 0, y: -0.32, z: 0 },
    );
    segment.rotation.z = index < 2 ? -0.04 : 0.04;
    tentacle.add(segment);
    const foot = createThemeMesh(
      `tentacle-${index}-foot`,
      new THREE.SphereGeometry(0.18, 7, 5),
      purple,
      { x: 0, y: -0.72, z: 0 },
    );
    foot.scale.set(1.1, 0.45, 1.05);
    tentacle.add(foot);
    group.add(tentacle);
    tentacles.push(tentacle);
  }

  const staticTentacleRotations: StaticRotation[] = [];
  for (let index = 0; index < tentacles.length; index += 1) {
    staticTentacleRotations.push(snapshotRotation(tentacles[index]));
  }
  return {
    group,
    body,
    tentacles,
    staticBodyRotation: snapshotRotation(body),
    staticTentacleRotations,
  };
}

/** Build Mr. Krabs' model and return the references used by its animation. */
export function createMrKrabsParts(group: THREE.Group): MrKrabsAnimationParts {
  const red = createThemeMaterial(MR_KRABS_RED);
  const darkRed = createThemeMaterial(MR_KRABS_DARK_RED);
  const blue = createThemeMaterial(MR_KRABS_BLUE);
  const yellow = createThemeMaterial(MR_KRABS_YELLOW, 0.62);
  const white = createThemeMaterial(EYE_WHITE, 0.68);
  const dark = createThemeMaterial(EYE_DARK, 0.52);

  const body = createThemeMesh(
    "body",
    new THREE.SphereGeometry(0.9, 12, 8),
    red,
    { x: 0, y: 1.12, z: 0 },
  );
  body.scale.set(1.12, 0.78, 0.78);
  group.add(body);

  const clothing = createThemeMesh("clothing", new THREE.BoxGeometry(1.15, 0.38, 0.82), blue, { x: 0, y: 0.65, z: 0 });
  clothing.scale.set(1, 0.9, 0.92);
  group.add(clothing);

  const belt = createThemeMesh("belt", new THREE.BoxGeometry(1.03, 0.08, 0.86), darkRed, { x: 0, y: 0.86, z: 0.03 });
  group.add(belt);

  const eyes = new THREE.Group();
  eyes.name = "eyes";
  for (let index = 0; index < 2; index += 1) {
    const x = index === 0 ? -0.22 : 0.22;
    const stalk = createThemeMesh(`eye-stalk-${index}`, new THREE.CylinderGeometry(0.055, 0.065, 0.42, 6), red, { x, y: 2.05, z: 0 });
    const eye = createThemeMesh(`eye-${index}`, new THREE.SphereGeometry(0.18, 8, 6), yellow, { x, y: 2.28, z: 0 });
    const pupil = createThemeMesh(`pupil-${index}`, new THREE.SphereGeometry(0.07, 7, 5), dark, { x, y: 2.28, z: 0.15 });
    eyes.add(stalk, eye, pupil);
  }
  group.add(eyes);

  const mouth = createThemeMesh("mouth", new THREE.BoxGeometry(0.36, 0.055, 0.025), darkRed, { x: 0, y: 1.03, z: 0.71 });
  group.add(mouth);

  const claws: THREE.Object3D[] = [];
  const clawPositions = [
    { x: -1.02, y: 1.26, z: 0, rotation: -0.16 },
    { x: 1.02, y: 1.26, z: 0, rotation: 0.16 },
  ];
  for (let index = 0; index < clawPositions.length; index += 1) {
    const placement = clawPositions[index];
    const claw = new THREE.Group();
    claw.name = index === 0 ? "claw-left" : "claw-right";
    claw.position.set(placement.x, placement.y, placement.z);
    claw.rotation.z = placement.rotation;
    const arm = createThemeMesh(`claw-${index}-arm`, new THREE.CylinderGeometry(0.13, 0.16, 0.58, 7), red, { x: index === 0 ? 0.2 : -0.2, y: 0, z: 0 });
    arm.rotation.z = index === 0 ? -Math.PI / 2 : Math.PI / 2;
    claw.add(arm);
    const palm = createThemeMesh(`claw-${index}-palm`, new THREE.SphereGeometry(0.31, 8, 6), red, { x: index === 0 ? 0.45 : -0.45, y: 0, z: 0 });
    palm.scale.set(1.05, 0.82, 0.8);
    claw.add(palm);
    const pincerUpper = createThemeMesh(`claw-${index}-upper`, new THREE.ConeGeometry(0.12, 0.48, 6), red, { x: index === 0 ? 0.68 : -0.68, y: 0.15, z: 0 });
    pincerUpper.rotation.z = index === 0 ? -Math.PI / 2.8 : Math.PI / 2.8;
    claw.add(pincerUpper);
    const pincerLower = createThemeMesh(`claw-${index}-lower`, new THREE.ConeGeometry(0.12, 0.42, 6), red, { x: index === 0 ? 0.68 : -0.68, y: -0.14, z: 0 });
    pincerLower.rotation.z = index === 0 ? -Math.PI / 2.3 : Math.PI / 2.3;
    claw.add(pincerLower);
    group.add(claw);
    claws.push(claw);
  }

  const staticClawRotations: StaticRotation[] = [];
  for (let index = 0; index < claws.length; index += 1) {
    staticClawRotations.push(snapshotRotation(claws[index]));
  }
  return {
    group,
    body,
    claws,
    staticBodyRotation: snapshotRotation(body),
    staticClawRotations,
  };
}

function createArm(
  group: THREE.Group,
  name: "arm-left" | "arm-right",
  x: number,
  y: number,
  material: THREE.Material,
  handMaterial: THREE.Material = material,
): THREE.Object3D {
  const arm = new THREE.Group();
  arm.name = name;
  arm.position.set(x, y, 0.02);
  arm.rotation.z = x < 0 ? -0.16 : 0.16;
  const segment = createThemeMesh(
    `${name}-segment`,
    new THREE.CylinderGeometry(0.065, 0.085, 0.5, 7),
    material,
    { x: x < 0 ? -0.2 : 0.2, y: 0, z: 0 },
  );
  segment.rotation.z = x < 0 ? -Math.PI / 2 : Math.PI / 2;
  const hand = createThemeMesh(
    `${name}-hand`,
    new THREE.SphereGeometry(0.105, 7, 5),
    handMaterial,
    { x: x < 0 ? -0.46 : 0.46, y: 0, z: 0 },
  );
  hand.scale.set(1.1, 0.78, 0.9);
  arm.add(segment, hand);
  group.add(arm);
  return arm;
}

function createLeg(
  group: THREE.Group,
  name: "leg-left" | "leg-right",
  x: number,
  material: THREE.Material,
  shoeMaterial: THREE.Material,
): void {
  const leg = new THREE.Group();
  leg.name = name;
  leg.position.set(x, 0.43, 0);
  const segment = createThemeMesh(
    `${name}-segment`,
    new THREE.CylinderGeometry(0.055, 0.06, 0.48, 7),
    material,
    { x: 0, y: -0.2, z: 0 },
  );
  const shoe = createThemeMesh(
    `${name}-shoe`,
    new THREE.SphereGeometry(0.14, 8, 5),
    shoeMaterial,
    { x: x < 0 ? -0.06 : 0.06, y: -0.47, z: 0.08 },
  );
  shoe.scale.set(1.25, 0.58, 1.35);
  leg.add(segment, shoe);
  group.add(leg);
}

/** Build SpongeBob's recognizable square silhouette from reusable primitives. */
export function createSpongeBobParts(group: THREE.Group): SpongeBobAnimationParts {
  const yellow = createThemeMaterial(SPONGEBOB_YELLOW, 0.72);
  const lightYellow = createThemeMaterial(SPONGEBOB_LIGHT, 0.76);
  const spot = createThemeMaterial(SPONGEBOB_SPOT, 0.82);
  const white = createThemeMaterial(SPONGEBOB_WHITE, 0.66);
  const dark = createThemeMaterial(EYE_DARK, 0.5);
  const red = createThemeMaterial(SPONGEBOB_RED, 0.68);
  const brown = createThemeMaterial(SPONGEBOB_BROWN, 0.84);
  const black = createThemeMaterial(SPONGEBOB_BLACK, 0.54);

  const body = createThemeMesh(
    "body",
    createRoundedBoxGeometry(1.08, 1.22, 0.72, 0.12),
    yellow,
    { x: 0, y: 1.42, z: -0.34 },
  );
  group.add(body);

  const spotPositions = [
    { x: -0.38, y: 1.77, z: 0.04, scale: 1.05 },
    { x: 0.37, y: 1.56, z: 0.04, scale: 0.8 },
    { x: -0.35, y: 1.12, z: 0.04, scale: 0.72 },
    { x: 0.34, y: 1.08, z: 0.04, scale: 0.95 },
    { x: 0.02, y: 1.92, z: 0.04, scale: 0.58 },
  ];
  for (let index = 0; index < spotPositions.length; index += 1) {
    const placement = spotPositions[index];
    const porousSpot = createThemeMesh(
      `porous-spot-${index}`,
      new THREE.SphereGeometry(0.105, 7, 5),
      spot,
      placement,
    );
    porousSpot.scale.set(placement.scale, 0.72 * placement.scale, 0.18);
    group.add(porousSpot);
  }

  createEyePair(group, {
    eyeGroupName: "eyes",
    eyeWhiteMaterial: white,
    eyeDarkMaterial: dark,
    y: 1.78,
    z: 0.48,
    spacing: 0.17,
    eyeScale: 1.08,
  });
  const mouth = createThemeMesh(
    "mouth",
    new THREE.BoxGeometry(0.34, 0.2, 0.04),
    dark,
    { x: 0, y: 1.42, z: 0.48 },
  );
  const tongue = createThemeMesh(
    "mouth-tongue",
    new THREE.SphereGeometry(0.1, 8, 5),
    red,
    { x: 0, y: 1.39, z: 0.51 },
  );
  tongue.scale.set(1.3, 0.48, 0.2);
  group.add(mouth, tongue);

  const collarLeft = createThemeMesh(
    "shirt-collar-left",
    new THREE.ConeGeometry(0.15, 0.2, 4),
    white,
    { x: -0.16, y: 0.99, z: 0.43 },
  );
  const collarRight = createThemeMesh(
    "shirt-collar-right",
    new THREE.ConeGeometry(0.15, 0.2, 4),
    white,
    { x: 0.16, y: 0.99, z: 0.43 },
  );
  collarLeft.rotation.z = -0.55;
  collarRight.rotation.z = 0.55;
  const tie = createThemeMesh(
    "tie",
    new THREE.ConeGeometry(0.09, 0.32, 4),
    red,
    { x: 0, y: 0.9, z: 0.48 },
  );
  tie.rotation.z = Math.PI;
  const shorts = createThemeMesh(
    "shorts",
    createRoundedBoxGeometry(0.9, 0.38, 0.66, 0.06),
    brown,
    { x: 0, y: 0.75, z: -0.3 },
  );
  group.add(collarLeft, collarRight, tie, shorts);

  const arms = [
    createArm(group, "arm-left", -0.68, 1.28, yellow, lightYellow),
    createArm(group, "arm-right", 0.68, 1.28, yellow, lightYellow),
  ];
  createLeg(group, "leg-left", -0.22, white, black);
  createLeg(group, "leg-right", 0.22, white, black);

  const staticArmRotations: StaticRotation[] = [];
  for (let index = 0; index < arms.length; index += 1) {
    staticArmRotations.push(snapshotRotation(arms[index]));
  }
  return {
    group,
    body,
    arms,
    staticBodyRotation: snapshotRotation(body),
    staticArmRotations,
  };
}

/** Build Patrick's tapered pink silhouette and green-purple shorts. */
export function createPatrickParts(group: THREE.Group): PatrickAnimationParts {
  const pink = createThemeMaterial(PATRICK_PINK, 0.74);
  const lightPink = createThemeMaterial(PATRICK_LIGHT, 0.78);
  const green = createThemeMaterial(PATRICK_GREEN, 0.8);
  const purple = createThemeMaterial(PATRICK_PURPLE, 0.76);
  const white = createThemeMaterial(EYE_WHITE, 0.66);
  const dark = createThemeMaterial(EYE_DARK, 0.5);

  const body = createThemeMesh(
    "body",
    new THREE.CapsuleGeometry(0.56, 0.74, 6, 12),
    pink,
    { x: 0, y: 1.2, z: 0 },
  );
  body.scale.set(0.92, 1.08, 0.72);
  group.add(body);

  const belly = createThemeMesh(
    "belly",
    new THREE.SphereGeometry(0.36, 9, 6),
    lightPink,
    { x: 0, y: 0.98, z: 0.4 },
  );
  belly.scale.set(1.18, 0.8, 0.18);
  group.add(belly);

  createEyePair(group, {
    eyeGroupName: "eyes",
    eyeWhiteMaterial: white,
    eyeDarkMaterial: dark,
    y: 1.78,
    z: 0.41,
    spacing: 0.14,
    eyeScale: 0.85,
  });
  const mouth = createThemeMesh(
    "mouth",
    new THREE.BoxGeometry(0.25, 0.04, 0.03),
    dark,
    { x: 0, y: 1.52, z: 0.46 },
  );
  mouth.rotation.z = -0.12;
  group.add(mouth);

  const shorts = createThemeMesh(
    "shorts",
    createRoundedBoxGeometry(0.82, 0.4, 0.58, 0.08),
    green,
    { x: 0, y: 0.68, z: -0.25 },
  );
  group.add(shorts);
  const patchPositions = [
    { x: -0.26, y: 0.79, z: 0.08, rotation: -0.4 },
    { x: 0.24, y: 0.61, z: 0.08, rotation: 0.55 },
    { x: 0.02, y: 0.84, z: 0.08, rotation: 0.15 },
  ];
  for (let index = 0; index < patchPositions.length; index += 1) {
    const placement = patchPositions[index];
    const patch = createThemeMesh(
      `shorts-patch-${index}`,
      new THREE.SphereGeometry(0.12, 7, 5),
      purple,
      placement,
    );
    patch.scale.set(1.35, 0.6, 0.16);
    patch.rotation.z = placement.rotation;
    group.add(patch);
  }

  const arms = [
    createArm(group, "arm-left", -0.58, 1.2, pink, lightPink),
    createArm(group, "arm-right", 0.58, 1.2, pink, lightPink),
  ];
  createLeg(group, "leg-left", -0.2, green, pink);
  createLeg(group, "leg-right", 0.2, green, pink);

  const staticArmRotations: StaticRotation[] = [];
  for (let index = 0; index < arms.length; index += 1) {
    staticArmRotations.push(snapshotRotation(arms[index]));
  }
  return {
    group,
    body,
    arms,
    staticBodyRotation: snapshotRotation(body),
    staticArmRotations,
  };
}

function clampRootToTank(group: THREE.Group, halfSize: THREE.Vector3): void {
  const margin = Math.max(0.45, Math.abs(group.scale.x) * 1.25);
  const maxX = Math.max(0, Math.abs(halfSize.x) - margin);
  const maxZ = Math.max(0, Math.abs(halfSize.z) - margin);
  group.position.x = THREE.MathUtils.clamp(group.position.x, -maxX, maxX);
  group.position.z = THREE.MathUtils.clamp(group.position.z, -maxZ, maxZ);
  // Character geometry is authored above local y=0, so resize anchors its
  // root at the tank floor while preserving the descriptor's x/z placement.
  group.position.y = -Math.abs(halfSize.y);
}

/** Create one of the procedural SpongeBob-themed characters. */
export function createThemeCharacter(
  id: ThemeCharacterId,
  options: ThemeCharacterOptions,
): ThemeCharacterHandle {
  const group = new THREE.Group();
  group.name = `Theme-${id}`;
  const scale = Number.isFinite(options.scale) ? Math.max(0.01, options.scale) : 1;
  group.scale.setScalar(scale);

  let animationEnabled = Boolean(options.animationEnabled);
  let parts: SquidwardAnimationParts | MrKrabsAnimationParts | SpongeBobAnimationParts | PatrickAnimationParts;
  if (id === "spongebob") {
    parts = createSpongeBobParts(group);
  } else if (id === "patrick") {
    parts = createPatrickParts(group);
  } else if (id === "squidward") {
    parts = createSquidwardParts(group);
  } else if (id === "mr-krabs") {
    parts = createMrKrabsParts(group);
  } else {
    throw new Error(`Unknown theme character: ${String(id)}`);
  }

  let disposed = false;
  const interactionAnchor = new THREE.Object3D();
  interactionAnchor.name = `${id}-interaction-anchor`;
  interactionAnchor.position.set(
    0,
    id === "spongebob" ? 1.8 : id === "patrick" ? 1.7 : id === "squidward" ? 1.7 : 1.55,
    id === "spongebob" ? 0.75 : id === "patrick" ? 0.7 : 0.72,
  );
  group.add(interactionAnchor);
  const handle: ThemeCharacterHandle = {
    group,
    update(time: number, _dt: number) {
      if (disposed) return;
      if (id === "squidward") {
        updateSquidwardAnimation(parts as SquidwardAnimationParts, time, animationEnabled);
      } else if (id === "mr-krabs") {
        updateMrKrabsAnimation(parts as MrKrabsAnimationParts, time, animationEnabled);
      } else if (id === "spongebob") {
        updateSpongeBobAnimation(parts as SpongeBobAnimationParts, time, animationEnabled);
      } else {
        updatePatrickAnimation(parts as PatrickAnimationParts, time, animationEnabled);
      }
    },
    resize(halfSize: THREE.Vector3) {
      if (disposed) return;
      clampRootToTank(group, halfSize);
    },
    setAnimationEnabled(enabled: boolean) {
      animationEnabled = Boolean(enabled);
      group.userData.animationEnabled = animationEnabled;
      if (!animationEnabled) handle.update(0, 0);
    },
    getInteractionAnchor() {
      return interactionAnchor;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      group.visible = false;
      disposeThemeResources(group);
      group.clear();
    },
  };
  group.userData.themeCharacterId = id;
  group.userData.animationEnabled = animationEnabled;
  handle.update(0, 0);
  return handle;
}
