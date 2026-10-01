import * as THREE from "three";

/** A copy of a part's initial rotation used to restore the idle pose. */
export interface StaticRotation {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/** References held by Squidward's low-amplitude idle animation. */
export interface SquidwardAnimationParts {
  readonly group: THREE.Group;
  readonly body: THREE.Object3D;
  readonly tentacles: readonly THREE.Object3D[];
  readonly staticBodyRotation: StaticRotation;
  readonly staticTentacleRotations: readonly StaticRotation[];
}

/** References held by Mr. Krabs' low-amplitude idle animation. */
export interface MrKrabsAnimationParts {
  readonly group: THREE.Group;
  readonly body: THREE.Object3D;
  readonly claws: readonly THREE.Object3D[];
  readonly staticBodyRotation: StaticRotation;
  readonly staticClawRotations: readonly StaticRotation[];
}

function restoreRotation(object: THREE.Object3D, rotation: StaticRotation): void {
  object.rotation.set(rotation.x, rotation.y, rotation.z);
}

/**
 * Update Squidward's tentacles and body without creating per-frame objects.
 *
 * `enabled === false` is deliberately a static-pose operation rather than an
 * early return, so toggling animation off always restores the authored pose.
 */
export function updateSquidwardAnimation(
  parts: SquidwardAnimationParts,
  time: number,
  enabled: boolean,
): void {
  if (!enabled) {
    restoreRotation(parts.body, parts.staticBodyRotation);
    for (let index = 0; index < parts.tentacles.length; index += 1) {
      restoreRotation(parts.tentacles[index], parts.staticTentacleRotations[index]);
    }
    return;
  }

  const bodyPose = parts.staticBodyRotation;
  parts.body.rotation.x = bodyPose.x + Math.sin(time * 0.72) * 0.025;
  parts.body.rotation.y = bodyPose.y + Math.sin(time * 0.58) * 0.04;
  parts.body.rotation.z = bodyPose.z + Math.cos(time * 0.66) * 0.018;

  // Each tentacle has a separate phase so the motion reads as a soft wave.
  for (let index = 0; index < parts.tentacles.length; index += 1) {
    const pose = parts.staticTentacleRotations[index];
    const phase = index * 0.83;
    const tentacle = parts.tentacles[index];
    tentacle.rotation.x = pose.x + Math.sin(time * 1.08 + phase) * 0.035;
    tentacle.rotation.y = pose.y + Math.cos(time * 0.92 + phase) * 0.025;
    tentacle.rotation.z = pose.z + Math.sin(time * 1.24 + phase) * 0.09;
  }
}

/** Update Mr. Krabs' alternating claw motion without per-frame allocations. */
export function updateMrKrabsAnimation(
  parts: MrKrabsAnimationParts,
  time: number,
  enabled: boolean,
): void {
  if (!enabled) {
    restoreRotation(parts.body, parts.staticBodyRotation);
    for (let index = 0; index < parts.claws.length; index += 1) {
      restoreRotation(parts.claws[index], parts.staticClawRotations[index]);
    }
    return;
  }

  const bodyPose = parts.staticBodyRotation;
  parts.body.rotation.x = bodyPose.x + Math.sin(time * 0.64) * 0.03;
  parts.body.rotation.y = bodyPose.y + Math.cos(time * 0.5) * 0.035;
  parts.body.rotation.z = bodyPose.z + Math.sin(time * 0.45) * 0.02;

  for (let index = 0; index < parts.claws.length; index += 1) {
    const pose = parts.staticClawRotations[index];
    const phase = index === 0 ? 0 : Math.PI;
    const claw = parts.claws[index];
    const opening = Math.sin(time * 1.3 + phase) * 0.14;
    claw.rotation.x = pose.x + Math.cos(time * 0.73 + phase) * 0.025;
    claw.rotation.y = pose.y + Math.sin(time * 0.88 + phase) * 0.035;
    claw.rotation.z = pose.z + opening;
  }
}

