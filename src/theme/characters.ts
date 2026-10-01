import * as THREE from "three";
import type { ThemeCharacterId, ThemeObjectHandle } from "./types.js";
import {
  type MrKrabsAnimationParts,
  type SquidwardAnimationParts,
  type StaticRotation,
  updateMrKrabsAnimation,
  updateSquidwardAnimation,
} from "./animation.js";

export type { MrKrabsAnimationParts, SquidwardAnimationParts } from "./animation.js";

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

function standardMaterial(color: number, roughness = 0.78): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    flatShading: true,
    roughness,
    metalness: 0.02,
  });
}

function mesh(
  name: string,
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  position?: { x: number; y: number; z: number },
): THREE.Mesh {
  const result = new THREE.Mesh(geometry, material);
  result.name = name;
  if (position) result.position.set(position.x, position.y, position.z);
  result.castShadow = true;
  result.receiveShadow = true;
  return result;
}

function snapshotRotation(object: THREE.Object3D): StaticRotation {
  return { x: object.rotation.x, y: object.rotation.y, z: object.rotation.z };
}

function addEyePair(
  parent: THREE.Object3D,
  eyeGroupName: string,
  eyeWhiteMaterial: THREE.Material,
  eyeDarkMaterial: THREE.Material,
  y: number,
  z: number,
  spacing: number,
  eyeScale: number,
): THREE.Group {
  const eyes = new THREE.Group();
  eyes.name = eyeGroupName;
  const whiteGeometry = new THREE.SphereGeometry(0.2 * eyeScale, 8, 6);
  const pupilGeometry = new THREE.SphereGeometry(0.085 * eyeScale, 7, 5);
  const left = mesh("eye-left", whiteGeometry.clone(), eyeWhiteMaterial, { x: -spacing, y, z });
  const right = mesh("eye-right", whiteGeometry, eyeWhiteMaterial, { x: spacing, y, z });
  const leftPupil = mesh("pupil-left", pupilGeometry.clone(), eyeDarkMaterial, { x: -spacing, y, z: z + 0.16 * eyeScale });
  const rightPupil = mesh("pupil-right", pupilGeometry, eyeDarkMaterial, { x: spacing, y, z: z + 0.16 * eyeScale });
  eyes.add(left, right, leftPupil, rightPupil);
  parent.add(eyes);
  return eyes;
}

/** Build Squidward's model and return the references used by its animation. */
export function createSquidwardParts(group: THREE.Group): SquidwardAnimationParts {
  const skin = standardMaterial(SQUIDWARD_SKIN);
  const darkSkin = standardMaterial(SQUIDWARD_DARK);
  const purple = standardMaterial(SQUIDWARD_PURPLE);
  const white = standardMaterial(EYE_WHITE, 0.68);
  const dark = standardMaterial(EYE_DARK, 0.52);

  const body = mesh(
    "body",
    new THREE.CapsuleGeometry(0.42, 0.72, 4, 8),
    darkSkin,
    { x: 0, y: 0.98, z: 0 },
  );
  body.scale.set(1.02, 1.08, 0.83);
  group.add(body);

  const head = mesh("head", new THREE.SphereGeometry(0.73, 12, 8), skin, { x: 0, y: 1.85, z: 0 });
  head.scale.set(0.98, 1.08, 0.82);
  group.add(head);

  const nose = mesh("nose", new THREE.ConeGeometry(0.2, 0.62, 8), skin, { x: 0, y: 1.71, z: 0.61 });
  nose.rotation.x = Math.PI / 2;
  group.add(nose);

  addEyePair(group, "eyes", white, dark, 2.13, 0.52, 0.22, 1.12);

  const mouth = mesh("mouth", new THREE.BoxGeometry(0.35, 0.035, 0.025), dark, { x: 0, y: 1.46, z: 0.69 });
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
    const segment = mesh(
      `tentacle-${index}-segment`,
      new THREE.CylinderGeometry(0.13, 0.17, 0.82, 7),
      purple,
      { x: 0, y: -0.32, z: 0 },
    );
    segment.rotation.z = index < 2 ? -0.04 : 0.04;
    tentacle.add(segment);
    const foot = mesh(
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
  const red = standardMaterial(MR_KRABS_RED);
  const darkRed = standardMaterial(MR_KRABS_DARK_RED);
  const blue = standardMaterial(MR_KRABS_BLUE);
  const yellow = standardMaterial(MR_KRABS_YELLOW, 0.62);
  const white = standardMaterial(EYE_WHITE, 0.68);
  const dark = standardMaterial(EYE_DARK, 0.52);

  const body = mesh(
    "body",
    new THREE.SphereGeometry(0.9, 12, 8),
    red,
    { x: 0, y: 1.12, z: 0 },
  );
  body.scale.set(1.12, 0.78, 0.78);
  group.add(body);

  const clothing = mesh("clothing", new THREE.BoxGeometry(1.15, 0.38, 0.82), blue, { x: 0, y: 0.65, z: 0 });
  clothing.scale.set(1, 0.9, 0.92);
  group.add(clothing);

  const belt = mesh("belt", new THREE.BoxGeometry(1.03, 0.08, 0.86), darkRed, { x: 0, y: 0.86, z: 0.03 });
  group.add(belt);

  const eyes = new THREE.Group();
  eyes.name = "eyes";
  for (let index = 0; index < 2; index += 1) {
    const x = index === 0 ? -0.22 : 0.22;
    const stalk = mesh(`eye-stalk-${index}`, new THREE.CylinderGeometry(0.055, 0.065, 0.42, 6), red, { x, y: 2.05, z: 0 });
    const eye = mesh(`eye-${index}`, new THREE.SphereGeometry(0.18, 8, 6), yellow, { x, y: 2.28, z: 0 });
    const pupil = mesh(`pupil-${index}`, new THREE.SphereGeometry(0.07, 7, 5), dark, { x, y: 2.28, z: 0.15 });
    eyes.add(stalk, eye, pupil);
  }
  group.add(eyes);

  const mouth = mesh("mouth", new THREE.BoxGeometry(0.36, 0.055, 0.025), darkRed, { x: 0, y: 1.03, z: 0.71 });
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
    const arm = mesh(`claw-${index}-arm`, new THREE.CylinderGeometry(0.13, 0.16, 0.58, 7), red, { x: index === 0 ? 0.2 : -0.2, y: 0, z: 0 });
    arm.rotation.z = index === 0 ? -Math.PI / 2 : Math.PI / 2;
    claw.add(arm);
    const palm = mesh(`claw-${index}-palm`, new THREE.SphereGeometry(0.31, 8, 6), red, { x: index === 0 ? 0.45 : -0.45, y: 0, z: 0 });
    palm.scale.set(1.05, 0.82, 0.8);
    claw.add(palm);
    const pincerUpper = mesh(`claw-${index}-upper`, new THREE.ConeGeometry(0.12, 0.48, 6), red, { x: index === 0 ? 0.68 : -0.68, y: 0.15, z: 0 });
    pincerUpper.rotation.z = index === 0 ? -Math.PI / 2.8 : Math.PI / 2.8;
    claw.add(pincerUpper);
    const pincerLower = mesh(`claw-${index}-lower`, new THREE.ConeGeometry(0.12, 0.42, 6), red, { x: index === 0 ? 0.68 : -0.68, y: -0.14, z: 0 });
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

function disposeGroup(group: THREE.Group): void {
  group.traverse((object) => {
    const meshObject = object as THREE.Mesh;
    if (meshObject.geometry) meshObject.geometry.dispose();
    const material = meshObject.material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(material)) {
      for (let index = 0; index < material.length; index += 1) material[index].dispose();
    } else if (material) {
      material.dispose();
    }
  });
}

/** Create one of the procedural SpongeBob-themed characters. */
export function createThemeCharacter(
  id: ThemeCharacterId,
  options: ThemeCharacterOptions,
): ThemeCharacterHandle {
  const group = new THREE.Group();
  group.name = id === "squidward" ? "Theme-squidward" : "Theme-mr-krabs";
  const scale = Number.isFinite(options.scale) ? Math.max(0.01, options.scale) : 1;
  group.scale.setScalar(scale);

  let animationEnabled = Boolean(options.animationEnabled);
  let parts: SquidwardAnimationParts | MrKrabsAnimationParts;
  if (id === "squidward") {
    parts = createSquidwardParts(group);
  } else if (id === "mr-krabs") {
    parts = createMrKrabsParts(group);
  } else {
    throw new Error(`Unknown theme character: ${String(id)}`);
  }

  let disposed = false;
  const interactionAnchor = new THREE.Object3D();
  interactionAnchor.name = `${id}-interaction-anchor`;
  interactionAnchor.position.set(0, id === "squidward" ? 1.7 : 1.55, 0.72);
  group.add(interactionAnchor);
  const handle: ThemeCharacterHandle = {
    group,
    update(time: number, _dt: number) {
      if (disposed) return;
      if (id === "squidward") {
        updateSquidwardAnimation(parts as SquidwardAnimationParts, time, animationEnabled);
      } else {
        updateMrKrabsAnimation(parts as MrKrabsAnimationParts, time, animationEnabled);
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
      disposeGroup(group);
      group.clear();
    },
  };
  group.userData.themeCharacterId = id;
  group.userData.animationEnabled = animationEnabled;
  handle.update(0, 0);
  return handle;
}
