import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { getFishHeadPose } from "./fish-renderer.js";

const CAMERA_MODE = {
  orbit: "orbit",
  fish: "fish",
};

const DEFAULT_HALF_SIZE = new THREE.Vector3(14, 8, 11);
const DEFAULT_CAMERA_POSITION = new THREE.Vector3(0, 11.6, 34);
const DEFAULT_TARGET = new THREE.Vector3(0, 1.9, 0);
const DEFAULT_MAX_DISTANCE = 46;
const DEFAULT_MIN_DISTANCE = 7;

const FISH_CAMERA_POSITION_RESPONSE = 10;
const FISH_CAMERA_DIRECTION_RESPONSE = 5;
const FISH_CAMERA_LOOK_AHEAD = 3.6;
const worldUp = new THREE.Vector3(0, 1, 0);
const fallbackUp = new THREE.Vector3(1, 0, 0);

export function createCameraRig(renderer) {
  const orbitCamera = new THREE.PerspectiveCamera(55, 1, 0.1, 120);
  orbitCamera.position.copy(DEFAULT_CAMERA_POSITION);

  const fishCamera = new THREE.PerspectiveCamera(74, 1, 0.03, 90);

  const controls = new OrbitControls(orbitCamera, renderer.domElement);
  controls.enableDamping = true;
  controls.target.copy(DEFAULT_TARGET);
  controls.maxDistance = DEFAULT_MAX_DISTANCE;
  controls.minDistance = DEFAULT_MIN_DISTANCE;

  const pose = {
    position: new THREE.Vector3(),
    direction: new THREE.Vector3(0, 0, -1),
  };
  const smoothedFishPosition = new THREE.Vector3();
  const smoothedFishDirection = new THREE.Vector3(0, 0, -1);
  const target = new THREE.Vector3();
  const up = new THREE.Vector3();
  let mode = CAMERA_MODE.orbit;
  let fishCameraInitialized = false;

  return {
    get activeCamera() {
      return mode === CAMERA_MODE.fish ? fishCamera : orbitCamera;
    },

    get mode() {
      return mode;
    },

    toggle() {
      mode = mode === CAMERA_MODE.orbit ? CAMERA_MODE.fish : CAMERA_MODE.orbit;
      controls.enabled = mode === CAMERA_MODE.orbit;
    },

    update() {
      if (controls.enabled) {
        controls.update();
      }
    },

    updateFishCamera(fish, dt = 0) {
      if (!fish) return;

      getFishHeadPose(fish, pose);

      if (!fishCameraInitialized || dt <= 0) {
        smoothedFishPosition.copy(pose.position);
        smoothedFishDirection.copy(pose.direction);
        fishCameraInitialized = true;
      } else {
        const positionAlpha = 1 - Math.exp(-FISH_CAMERA_POSITION_RESPONSE * dt);
        const directionAlpha = 1 - Math.exp(-FISH_CAMERA_DIRECTION_RESPONSE * dt);
        smoothedFishPosition.lerp(pose.position, positionAlpha);
        smoothedFishDirection.lerp(pose.direction, directionAlpha).normalize();
      }

      fishCamera.position.copy(smoothedFishPosition);
      up.copy(worldUp).addScaledVector(
        smoothedFishDirection,
        -worldUp.dot(smoothedFishDirection),
      );
      if (up.lengthSq() < 0.0001) {
        up.copy(fallbackUp).addScaledVector(
          smoothedFishDirection,
          -fallbackUp.dot(smoothedFishDirection),
        );
      }
      fishCamera.up.copy(up.normalize());
      fishCamera.lookAt(
        target
          .copy(smoothedFishPosition)
          .addScaledVector(smoothedFishDirection, FISH_CAMERA_LOOK_AHEAD),
      );
    },

    resize(width, height) {
      const aspect = Math.max(1, width) / Math.max(1, height);

      orbitCamera.aspect = aspect;
      orbitCamera.updateProjectionMatrix();
      fishCamera.aspect = aspect;
      fishCamera.updateProjectionMatrix();
    },

    /** Frame the orbit camera for a given tank size. Scales from the default
     *  size, so the default style keeps its exact original framing. */
    configure(halfSize) {
      const sx = halfSize.x / DEFAULT_HALF_SIZE.x;
      const sy = halfSize.y / DEFAULT_HALF_SIZE.y;
      const sz = halfSize.z / DEFAULT_HALF_SIZE.z;

      orbitCamera.position.set(
        DEFAULT_CAMERA_POSITION.x * sx,
        DEFAULT_CAMERA_POSITION.y * sy,
        DEFAULT_CAMERA_POSITION.z * sz,
      );
      controls.target.set(
        DEFAULT_TARGET.x * sx,
        DEFAULT_TARGET.y * sy,
        DEFAULT_TARGET.z * sz,
      );
      controls.maxDistance = DEFAULT_MAX_DISTANCE * Math.max(sx, sz);
      controls.minDistance = DEFAULT_MIN_DISTANCE * Math.min(sx, sz);
      controls.update();
    },
  };
}

export function bindCameraToggle(cameraRig) {
  window.addEventListener("keydown", (event) => {
    if (event.code !== "Space" || event.repeat) return;

    event.preventDefault();
    cameraRig.toggle();
  });
}
