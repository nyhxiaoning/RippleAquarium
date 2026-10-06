import * as THREE from "three";

/** Shared options for the simple front-facing cartoon eye pair. */
export interface ThemeEyePairOptions {
  /** Name assigned to the group that contains the four eye meshes. */
  eyeGroupName?: string;
  eyeWhiteMaterial: THREE.Material;
  eyeDarkMaterial: THREE.Material;
  y: number;
  z: number;
  spacing: number;
  eyeScale?: number;
}

/**
 * Create the standard matte material used by procedural theme geometry.
 * Keeping material construction here makes the later character factories use
 * the same lighting response without sharing mutable material instances.
 */
export function createThemeMaterial(
  color: number,
  roughness = 0.78,
): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    flatShading: true,
    roughness,
    metalness: 0.02,
  });
}

/** Create a named, shadow-casting theme mesh and optionally place it. */
export function createThemeMesh(
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

/**
 * Build a shallow rounded rectangular prism without relying on textures.
 * The geometry is centered on the X/Y axes and extends from z=0 to z=depth,
 * matching Three.js ExtrudeGeometry's normal orientation.
 */
export function createRoundedBoxGeometry(
  width: number,
  height: number,
  depth: number,
  bevel: number,
): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  const halfWidth = width * 0.5;
  const halfHeight = height * 0.5;
  const radius = Math.min(Math.max(0.001, bevel), halfWidth, halfHeight);
  shape.moveTo(-halfWidth + radius, -halfHeight);
  shape.lineTo(halfWidth - radius, -halfHeight);
  shape.quadraticCurveTo(halfWidth, -halfHeight, halfWidth, -halfHeight + radius);
  shape.lineTo(halfWidth, halfHeight - radius);
  shape.quadraticCurveTo(halfWidth, halfHeight, halfWidth - radius, halfHeight);
  shape.lineTo(-halfWidth + radius, halfHeight);
  shape.quadraticCurveTo(-halfWidth, halfHeight, -halfWidth, halfHeight - radius);
  shape.lineTo(-halfWidth, -halfHeight + radius);
  shape.quadraticCurveTo(-halfWidth, -halfHeight, -halfWidth + radius, -halfHeight);
  return new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelSegments: 2,
    bevelSize: radius * 0.45,
    bevelThickness: radius * 0.35,
    curveSegments: 4,
  });
}

/**
 * Add a pair of white eyes and dark pupils to a parent group.  Materials are
 * supplied by the caller so each character can own and dispose its palette.
 */
export function createEyePair(
  parent: THREE.Object3D,
  options: ThemeEyePairOptions,
): THREE.Group {
  const eyes = new THREE.Group();
  eyes.name = options.eyeGroupName ?? "eyes";
  const eyeScale = Number.isFinite(options.eyeScale) ? Math.max(0.01, options.eyeScale ?? 1) : 1;
  const whiteGeometry = new THREE.SphereGeometry(0.2 * eyeScale, 8, 6);
  const pupilGeometry = new THREE.SphereGeometry(0.085 * eyeScale, 7, 5);
  const left = createThemeMesh(
    "eye-left",
    whiteGeometry.clone(),
    options.eyeWhiteMaterial,
    { x: -options.spacing, y: options.y, z: options.z },
  );
  const right = createThemeMesh(
    "eye-right",
    whiteGeometry,
    options.eyeWhiteMaterial,
    { x: options.spacing, y: options.y, z: options.z },
  );
  const leftPupil = createThemeMesh(
    "pupil-left",
    pupilGeometry.clone(),
    options.eyeDarkMaterial,
    { x: -options.spacing, y: options.y, z: options.z + 0.16 * eyeScale },
  );
  const rightPupil = createThemeMesh(
    "pupil-right",
    pupilGeometry,
    options.eyeDarkMaterial,
    { x: options.spacing, y: options.y, z: options.z + 0.16 * eyeScale },
  );
  eyes.add(left, right, leftPupil, rightPupil);
  parent.add(eyes);
  return eyes;
}

/** Dispose every unique geometry/material below a theme root. */
export function disposeThemeResources(root: THREE.Object3D): void {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    if (object.geometry) geometries.add(object.geometry);
    const meshMaterials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of meshMaterials) if (material) materials.add(material);
  });
  for (const geometry of geometries) geometry.dispose();
  for (const material of materials) material.dispose();
}
