import * as THREE from "three";
import { aquariumHalfSize } from "./config.js";
import { createWaterSurface } from "./water-surface.js";

export function createRenderer(canvas) {
  if (!canvas) {
    throw new Error("A canvas element is required to create the renderer.");
  }

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  return renderer;
}

export function createScene() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x081016);
  return scene;
}

export function addLighting(scene, halfSize = aquariumHalfSize) {
  const hemiBaseIntensity = 2.6;
  const sunBaseIntensity = 2.2;
  const hemiLight = new THREE.HemisphereLight(
    0x9fd8ff,
    0x1b3024,
    hemiBaseIntensity,
  );
  scene.add(hemiLight);

  const sun = new THREE.DirectionalLight(0xffffff, sunBaseIntensity);
  sun.position.set(0.8, halfSize.y + 7, 0.6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const horizontalShadowExtent = Math.max(halfSize.x, halfSize.z) + 4;
  const verticalShadowExtent = halfSize.y + 4;
  sun.shadow.camera.left = -horizontalShadowExtent;
  sun.shadow.camera.right = horizontalShadowExtent;
  sun.shadow.camera.top = verticalShadowExtent;
  sun.shadow.camera.bottom = -verticalShadowExtent;
  sun.shadow.camera.near = 0.5;
  sun.shadow.camera.far = halfSize.y + 34;
  sun.shadow.camera.updateProjectionMatrix();
  scene.add(sun);

  let userMultiplier = 1;
  let weatherMultiplier = 1;
  let lightningMultiplier = 1;

  function applyIntensity() {
    const multiplier = userMultiplier * weatherMultiplier * lightningMultiplier;
    hemiLight.intensity = hemiBaseIntensity * multiplier;
    sun.intensity = sunBaseIntensity * multiplier;
  }

  return {
    setIntensity(multiplier) {
      userMultiplier = Number.isFinite(multiplier) ? multiplier : 1;
      applyIntensity();
    },
    setWeatherMultiplier(multiplier) {
      weatherMultiplier = Number.isFinite(multiplier) ? Math.max(0, multiplier) : 1;
      applyIntensity();
    },
    setLightningFlash(multiplier) {
      lightningMultiplier = Number.isFinite(multiplier) ? Math.max(1, multiplier) : 1;
      applyIntensity();
    },
    resize(nextHalfSize) {
      sun.position.y = nextHalfSize.y + 7;
      const horizontalShadowExtent = Math.max(nextHalfSize.x, nextHalfSize.z) + 4;
      const verticalShadowExtent = nextHalfSize.y + 4;
      sun.shadow.camera.left = -horizontalShadowExtent;
      sun.shadow.camera.right = horizontalShadowExtent;
      sun.shadow.camera.top = verticalShadowExtent;
      sun.shadow.camera.bottom = -verticalShadowExtent;
      sun.shadow.camera.far = nextHalfSize.y + 34;
      sun.shadow.camera.updateProjectionMatrix();
    },
  };
}

export function createAquariumShell(scene, renderer, halfSize) {
  const effects = [];

  const glassMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x9bdcff,
    roughness: 0.02,
    metalness: 0,
    transparent: true,
    opacity: 0.12,
    side: THREE.DoubleSide,
    depthWrite: false,
    forceSinglePass: true,
    clearcoat: 1,
    clearcoatRoughness: 0.08,
  });

  const aquariumGlass = new THREE.Mesh(
    new THREE.BoxGeometry(halfSize.x * 2, halfSize.y * 2, halfSize.z * 2),
    glassMaterial,
  );
  scene.add(aquariumGlass);

  const aquariumEdges = new THREE.LineSegments(
    new THREE.EdgesGeometry(aquariumGlass.geometry),
    new THREE.LineBasicMaterial({
      color: 0xc6efff,
      transparent: true,
      opacity: 0.42,
    }),
  );
  scene.add(aquariumEdges);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(halfSize.x * 2, halfSize.z * 2),
    new THREE.MeshStandardMaterial({
      color: 0x17222a,
      roughness: 0.9,
      metalness: 0,
    }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -halfSize.y - 0.008;
  floor.receiveShadow = true;
  scene.add(floor);

  const floorEdges = new THREE.LineSegments(
    new THREE.EdgesGeometry(floor.geometry),
    new THREE.LineBasicMaterial({
      color: 0x78b6c7,
      transparent: true,
      opacity: 0.5,
    }),
  );
  floorEdges.rotation.copy(floor.rotation);
  floorEdges.position.copy(floor.position);
  scene.add(floorEdges);

  const waterSurface = createWaterSurface(renderer);
  waterSurface.resize(halfSize);
  scene.add(waterSurface.mesh);
  effects.push(waterSurface);
  const bubbles = addBubbleColumns(scene, halfSize);
  effects.push(bubbles);

  return {
    glass: aquariumGlass,
    floor,
    floorEdges,
    aquariumEdges,
    waterSurface,
    update(time) {
      for (const effect of effects) {
        effect.update?.(time);
      }
    },
    resize(nextHalfSize) {
      aquariumGlass.geometry.dispose();
      aquariumGlass.geometry = new THREE.BoxGeometry(
        nextHalfSize.x * 2,
        nextHalfSize.y * 2,
        nextHalfSize.z * 2,
      );
      aquariumEdges.geometry = new THREE.EdgesGeometry(aquariumGlass.geometry);

      floor.geometry.dispose();
      floor.geometry = new THREE.PlaneGeometry(nextHalfSize.x * 2, nextHalfSize.z * 2);
      floorEdges.geometry = new THREE.EdgesGeometry(floor.geometry);
      floor.position.y = -nextHalfSize.y - 0.008;
      floorEdges.position.copy(floor.position);

      waterSurface.resize(nextHalfSize);
      bubbles.resize?.(nextHalfSize);
    },
    dispose() {
      aquariumGlass.geometry.dispose();
      aquariumEdges.geometry.dispose();
      floor.geometry.dispose();
      floorEdges.geometry.dispose();
    },
  };
}

/** Backwards-compatible wrapper around createAquariumShell using the default size. */
export function addAquarium(scene, renderer) {
  return createAquariumShell(scene, renderer, aquariumHalfSize);
}

export function addObstacles(scene, obstacles) {
  const obstacleMaterial = new THREE.MeshStandardMaterial({
    color: 0xb8584c,
    roughness: 0.52,
    metalness: 0.08,
  });

  for (const obstacle of obstacles) {
    if (obstacle.render === false) continue;

    const mesh = new THREE.Mesh(createObstacleGeometry(obstacle), obstacleMaterial);
    mesh.position.copy(obstacle.position);
    if (obstacle.rotationY) {
      mesh.rotation.y = obstacle.rotationY;
    }
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
  }
}

function createObstacleGeometry(obstacle) {
  if (obstacle.shape === "box" || obstacle.shape === "plate") {
    return new THREE.BoxGeometry(obstacle.size.x, obstacle.size.y, obstacle.size.z);
  }

  return new THREE.SphereGeometry(obstacle.radius, 32, 18);
}

function addBubbleColumns(scene, halfSize) {
  const count = 84;
  const geometry = new THREE.SphereGeometry(0.035, 8, 6);
  const material = new THREE.MeshPhysicalMaterial({
    color: 0xd8fbff,
    roughness: 0.08,
    metalness: 0,
    transmission: 0.2,
    transparent: true,
    opacity: 0.54,
    depthWrite: false,
  });
  const bubbles = new THREE.InstancedMesh(geometry, material, count);
  bubbles.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  scene.add(bubbles);

  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const scale = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const starts = [];

  function rebuildStarts(bounds) {
    starts.length = 0;
    const xFractions = [-0.76, 0.02, 0.71];
    const zFractions = [-0.68, 0.74, -0.55];
    for (let i = 0; i < count; i += 1) {
      const column = i % 3;
      const ring = Math.floor(i / 3);
      const baseX = xFractions[column] * bounds.x;
      const baseZ = zFractions[column] * bounds.z;
      starts.push({
        x: baseX + Math.sin(ring * 1.7) * Math.min(0.42, bounds.x * 0.03),
        z: baseZ + Math.cos(ring * 1.31) * Math.min(0.36, bounds.z * 0.03),
        phase: (i * 0.137) % 1,
        size: 0.58 + ((i * 37) % 29) / 50,
        speed: 0.045 + ((i * 17) % 13) * 0.003,
      });
    }
  }

  rebuildStarts(halfSize);

  function update(time) {
    const floorY = -halfSize.y;
    const waterY = halfSize.y - 0.72;
    const height = waterY - floorY - 0.45;

    for (let i = 0; i < count; i += 1) {
      const bubble = starts[i];
      const t = (bubble.phase + time * bubble.speed) % 1;
      position.set(
        bubble.x + Math.sin(time * 1.2 + i) * 0.08,
        floorY + 0.24 + t * height,
        bubble.z + Math.cos(time * 1.45 + i * 0.7) * 0.08,
      );
      const s = bubble.size * (0.55 + t * 0.55);
      scale.setScalar(s);
      matrix.compose(position, quaternion, scale);
      bubbles.setMatrixAt(i, matrix);
    }

    bubbles.instanceMatrix.needsUpdate = true;
  }

  update(0);

  return {
    update,
    resize(nextHalfSize) {
      halfSize = nextHalfSize;
      rebuildStarts(nextHalfSize);
    },
  };
}
