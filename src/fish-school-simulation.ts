import * as THREE from "three";
import {
  createFishMotionScratch,
  createFishMotionState,
  updateFishMotionState,
} from "./fish/motion-state.js";
import { SpatialGrid } from "./fish/spatial-grid.js";
import {
  createRayDirections,
  mulberry32,
  randomPointInAquarium,
  randomPointInSphere,
} from "./random.js";
import type {
  FishMotionScratch,
  FishSimulationTrace,
  FishState,
  Obstacle,
  RandomSource,
  SimulationSettings,
} from "./types.js";
import type { HabitatRegion } from "./aquarium/habitat.js";

export interface FishSchoolSimulationOptions {
  aquariumHalfSize: THREE.Vector3;
  obstacles: Obstacle[];
  settings: SimulationSettings;
  /** Optional spatial habitat restriction for this school. */
  allowedRegion?: HabitatRegion;
}

interface UpdateOptions {
  traceIndex?: number;
}

export class FishSchoolSimulation {
  aquariumHalfSize: THREE.Vector3;
  allowedRegion?: HabitatRegion;
  obstacles: Obstacle[];
  settings: SimulationSettings;
  fish: FishState[];
  random: RandomSource;
  rayDirections: THREE.Vector3[];
  fishMotionScratch: FishMotionScratch;
  grid: SpatialGrid<FishState>;
  nextVelocities: THREE.Vector3[];
  nextPositions: THREE.Vector3[];
  tmpOffset: THREE.Vector3;
  tmpNeighborDir: THREE.Vector3;
  tmpAvoid: THREE.Vector3;
  tmpForward: THREE.Vector3;
  tmpDesired: THREE.Vector3;
  accel: THREE.Vector3;
  headingSum: THREE.Vector3;
  centerSum: THREE.Vector3;
  avoidanceSum: THREE.Vector3;
  steerOut: THREE.Vector3;
  boundaryOut: THREE.Vector3;
  clearDirOut: THREE.Vector3;
  tmpRayDir: THREE.Vector3;
  tmpRayEnd: THREE.Vector3;
  tmpRayLocalOrigin: THREE.Vector3;
  tmpRayLocalDir: THREE.Vector3;
  tmpTurnCurrent: THREE.Vector3;
  tmpTurnDesired: THREE.Vector3;
  tmpQuat: THREE.Quaternion;
  forwardAxis: THREE.Vector3;

  constructor({ aquariumHalfSize, obstacles, settings, allowedRegion }: FishSchoolSimulationOptions) {
    this.aquariumHalfSize = aquariumHalfSize;
    this.allowedRegion = allowedRegion;
    this.obstacles = obstacles;
    this.settings = settings;
    this.fish = [];
    this.random = mulberry32(42);
    this.rayDirections = createRayDirections(300);
    this.fishMotionScratch = createFishMotionScratch();
    this.grid = new SpatialGrid(settings.perceptionRadius);

    // Pooled per-fish results, grown on demand (see ensureBuffers).
    this.nextVelocities = [];
    this.nextPositions = [];

    // Scratch reused inside update(). Named by role so overlapping lifetimes
    // are obvious and never alias across helper calls.
    this.tmpOffset = new THREE.Vector3();
    this.tmpNeighborDir = new THREE.Vector3();
    this.tmpAvoid = new THREE.Vector3();
    this.tmpForward = new THREE.Vector3();
    this.tmpDesired = new THREE.Vector3();
    this.accel = new THREE.Vector3();
    this.headingSum = new THREE.Vector3();
    this.centerSum = new THREE.Vector3();
    this.avoidanceSum = new THREE.Vector3();
    this.steerOut = new THREE.Vector3();
    this.boundaryOut = new THREE.Vector3();
    this.clearDirOut = new THREE.Vector3();

    // Scratch reserved for ray/collision helpers (no overlap with the flock
    // accumulators above, which stay live across these calls).
    this.tmpRayDir = new THREE.Vector3();
    this.tmpRayEnd = new THREE.Vector3();
    this.tmpRayLocalOrigin = new THREE.Vector3();
    this.tmpRayLocalDir = new THREE.Vector3();
    this.tmpTurnCurrent = new THREE.Vector3();
    this.tmpTurnDesired = new THREE.Vector3();
    this.tmpQuat = new THREE.Quaternion();
    this.forwardAxis = new THREE.Vector3(0, 0, 1);
  }

  reset(count: number, seed = 42, fishIds?: readonly string[]): void {
    const targetCount = normalizeFishCount(count, 0);
    this.fish.length = 0;
    this.random = mulberry32(seed);

    for (let i = 0; i < targetCount; i += 1) {
      this.fish.push(this.createFish(i, fishIds?.[i]));
    }
  }

  setCount(count: number, fishIds?: readonly string[]): void {
    const targetCount = normalizeFishCount(count, this.fish.length);

    if (fishIds) {
      const existing = new Map(this.fish.map((fish) => [fish.fishId, fish]));
      const next: FishState[] = [];
      for (let i = 0; i < targetCount; i += 1) {
        const id = fishIds[i];
        const current = id ? existing.get(id) : undefined;
        next.push(current ?? this.createFish(i, id));
      }
      this.fish = next;
      return;
    }

    if (targetCount < this.fish.length) {
      this.fish.length = targetCount;
      return;
    }

    while (this.fish.length < targetCount) {
      this.fish.push(this.createFish(this.fish.length));
    }
  }

  /** Point the simulation at a live, mutable bounds vector (owned by AquariumManager). */
  setBounds(halfSize: THREE.Vector3): void {
    this.aquariumHalfSize = halfSize;
    this.clampPositions();
  }

  /**
   * Restrict this school to a habitat region. Existing fish are moved inside
   * the new region immediately so a resize or a layer change cannot leave a
   * member stranded outside its allowed water column.
   */
  setAllowedRegion(region?: HabitatRegion): void {
    this.allowedRegion = region;
    this.clampPositions();
  }

  /** Clamp all current members to the active tank/region bounds. */
  clampPositions(margin = this.settings.boundsRadius): void {
    const bounds = this.regionBounds();
    const xMargin = Math.min(Math.max(0, margin), Math.max(0, (bounds.maxX - bounds.minX) * 0.5));
    const yMargin = Math.min(Math.max(0, margin), Math.max(0, (bounds.maxY - bounds.minY) * 0.5));
    const zMargin = Math.min(Math.max(0, margin), Math.max(0, (bounds.maxZ - bounds.minZ) * 0.5));
    for (const fish of this.fish) {
      fish.position.x = THREE.MathUtils.clamp(fish.position.x, bounds.minX + xMargin, bounds.maxX - xMargin);
      fish.position.y = THREE.MathUtils.clamp(fish.position.y, bounds.minY + yMargin, bounds.maxY - yMargin);
      fish.position.z = THREE.MathUtils.clamp(fish.position.z, bounds.minZ + zMargin, bounds.maxZ - zMargin);
    }
  }

  createFish(index = this.fish.length, fishId?: string): FishState {
    const position = this.allowedRegion
      ? this.sampleAllowedRegion(0.62)
      : randomPointInAquarium(this.random, this.aquariumHalfSize, 0.62);
    const direction = randomPointInSphere(this.random, 1).normalize();
    const speed = THREE.MathUtils.lerp(
      this.settings.minSpeed,
      this.settings.maxSpeed,
      this.random(),
    );

    return {
      fishId: fishId ?? `sim-fish-${index}`,
      position,
      velocity: direction.multiplyScalar(speed),
      ...this.createMotionState(index),
    };
  }

  createMotionState(index = this.fish.length) {
    return createFishMotionState(index);
  }

  private sampleAllowedRegion(margin: number): THREE.Vector3 {
    if (!this.allowedRegion) return randomPointInAquarium(this.random, this.aquariumHalfSize, margin);
    const bounds = this.regionBounds();
    const sampleAxis = (min: number, max: number): number => {
      const inset = Math.max(0, Math.min(margin, (max - min) * 0.5));
      const low = min + inset;
      const high = max - inset;
      return low >= high ? (min + max) * 0.5 : low + (high - low) * this.random();
    };
    return new THREE.Vector3(
      sampleAxis(bounds.minX, bounds.maxX),
      sampleAxis(bounds.minY, bounds.maxY),
      sampleAxis(bounds.minZ, bounds.maxZ),
    );
  }

  private regionBounds() {
    const region = this.allowedRegion;
    const regionMinX = region?.min.x ?? -this.aquariumHalfSize.x;
    const regionMaxX = region?.max.x ?? this.aquariumHalfSize.x;
    const regionMinY = region?.min.y ?? -this.aquariumHalfSize.y;
    const regionMaxY = region?.max.y ?? this.aquariumHalfSize.y;
    const regionMinZ = region?.min.z ?? -this.aquariumHalfSize.z;
    const regionMaxZ = region?.max.z ?? this.aquariumHalfSize.z;
    return {
      minX: Math.max(-this.aquariumHalfSize.x, regionMinX),
      maxX: Math.min(this.aquariumHalfSize.x, regionMaxX),
      minY: Math.max(-this.aquariumHalfSize.y, regionMinY),
      maxY: Math.min(this.aquariumHalfSize.y, regionMaxY),
      minZ: Math.max(-this.aquariumHalfSize.z, regionMinZ),
      maxZ: Math.min(this.aquariumHalfSize.z, regionMaxZ),
    };
  }

  private clampPoint(point: THREE.Vector3, margin = 0): void {
    const bounds = this.regionBounds();
    const xMargin = Math.min(Math.max(0, margin), Math.max(0, (bounds.maxX - bounds.minX) * 0.5));
    const yMargin = Math.min(Math.max(0, margin), Math.max(0, (bounds.maxY - bounds.minY) * 0.5));
    const zMargin = Math.min(Math.max(0, margin), Math.max(0, (bounds.maxZ - bounds.minZ) * 0.5));
    point.x = THREE.MathUtils.clamp(point.x, bounds.minX + xMargin, bounds.maxX - xMargin);
    point.y = THREE.MathUtils.clamp(point.y, bounds.minY + yMargin, bounds.maxY - yMargin);
    point.z = THREE.MathUtils.clamp(point.z, bounds.minZ + zMargin, bounds.maxZ - zMargin);
  }

  ensureBuffers(count: number): void {
    while (this.nextVelocities.length < count) {
      this.nextVelocities.push(new THREE.Vector3());
      this.nextPositions.push(new THREE.Vector3());
    }
  }

  update(dt: number, options: UpdateOptions = {}): FishSimulationTrace | null {
    const count = this.fish.length;
    this.ensureBuffers(count);
    this.grid.setCellSize(this.settings.perceptionRadius);
    this.grid.build(this.fish);

    const nextVelocities = this.nextVelocities;
    const nextPositions = this.nextPositions;
    let trace = null;

    const perceptionSq = this.settings.perceptionRadius * this.settings.perceptionRadius;
    const avoidanceSq = this.settings.avoidanceRadius * this.settings.avoidanceRadius;

    for (let i = 0; i < count; i += 1) {
      const fish = this.fish[i];
      if (!fish) continue;
      const acceleration = this.accel.set(0, 0, 0);
      const components = options.traceIndex === i ? {
        align: new THREE.Vector3(),
        cohesion: new THREE.Vector3(),
        separation: new THREE.Vector3(),
        obstacle: new THREE.Vector3(),
        boundary: new THREE.Vector3(),
      } : null;
      const headingSum = this.headingSum.set(0, 0, 0);
      const centerSum = this.centerSum.set(0, 0, 0);
      const avoidanceSum = this.avoidanceSum.set(0, 0, 0);
      let neighborCount = 0;
      let collisionAvoidanceActive = false;
      let boundaryAvoidanceActive = false;

      const neighbors = this.grid.queryNeighbors(fish.position);
      for (let n = 0; n < neighbors.length; n += 1) {
        const j = neighbors[n];
        if (i === j) continue;
        const other = this.fish[j];
        if (!other) continue;
        const offset = this.tmpOffset.subVectors(other.position, fish.position);
        const distanceSq = offset.lengthSq();

        if (distanceSq < perceptionSq) {
          neighborCount += 1;
          headingSum.add(this.tmpNeighborDir.copy(other.velocity).normalize());
          centerSum.add(other.position);

          if (distanceSq < avoidanceSq) {
            const distance = Math.sqrt(Math.max(distanceSq, 0.0001));
            avoidanceSum.add(this.tmpAvoid.copy(offset).multiplyScalar(-1 / distance));
          }
        }
      }

      if (neighborCount > 0) {
        centerSum.multiplyScalar(1 / neighborCount);
        const align = this.steerTowards(headingSum, fish.velocity, this.steerOut)
          .multiplyScalar(this.settings.alignWeight);
        if (components) components.align.copy(align);
        acceleration.add(align);

        const cohesion = this.steerTowards(
          centerSum.sub(fish.position),
          fish.velocity,
          this.steerOut,
        ).multiplyScalar(this.settings.cohesionWeight);
        if (components) components.cohesion.copy(cohesion);
        acceleration.add(cohesion);

        const separation = this.steerTowards(avoidanceSum, fish.velocity, this.steerOut)
          .multiplyScalar(this.settings.separateWeight);
        if (components) components.separation.copy(separation);
        acceleration.add(separation);
      }

      const forward = this.tmpForward.copy(fish.velocity).normalize();
      if (this.isHeadingForCollision(fish.position, forward)) {
        collisionAvoidanceActive = true;
        const clearDirection = this.obstacleRays(fish.position, forward);
        const obstacle = this.steerTowards(clearDirection, fish.velocity, this.steerOut)
          .multiplyScalar(this.settings.avoidCollisionWeight);
        acceleration.add(obstacle);
        if (components) {
          components.obstacle.copy(obstacle);
        }
      }

      const boundary = this.aquariumBoundarySteer(fish.position);
      if (boundary.lengthSq() > 0) {
        boundaryAvoidanceActive = true;
        const boundaryForce = this.steerTowards(boundary, fish.velocity, this.steerOut)
          .multiplyScalar(this.settings.boundaryWeight);
        acceleration.add(boundaryForce);
        if (components) {
          components.boundary.copy(boundaryForce);
        }
      }

      const desiredVelocity = this.tmpDesired
        .copy(fish.velocity)
        .addScaledVector(acceleration, dt);
      const speed = THREE.MathUtils.clamp(
        desiredVelocity.length(),
        this.settings.minSpeed,
        this.settings.maxSpeed,
      );
      desiredVelocity.normalize().multiplyScalar(speed);
      const nextVelocity = nextVelocities[i];
      const nextPosition = nextPositions[i];
      const velocity = this.limitTurn(fish.velocity, desiredVelocity, dt, nextVelocity);

      nextPosition.copy(fish.position).addScaledVector(velocity, dt);
      this.clampPoint(nextPosition, this.settings.boundsRadius);

      if (components) {
        trace = {
          components,
          neighborCount,
          collisionAvoidanceActive,
          boundaryAvoidanceActive,
          previousVelocity: fish.velocity.clone(),
          nextVelocity: velocity.clone(),
        };
      }
    }

    for (let i = 0; i < count; i += 1) {
      const fish = this.fish[i];
      if (!fish) continue;
      updateFishMotionState(fish, nextVelocities[i], dt, this.fishMotionScratch);
      fish.velocity.copy(nextVelocities[i]);
      fish.position.copy(nextPositions[i]);
    }

    return trace;
  }

  steerTowards(vector: THREE.Vector3, velocity: THREE.Vector3, out: THREE.Vector3): THREE.Vector3 {
    if (vector.lengthSq() < 0.000001) {
      return out.set(0, 0, 0);
    }

    return out
      .copy(vector)
      .normalize()
      .multiplyScalar(this.settings.maxSpeed)
      .sub(velocity)
      .clampLength(0, this.settings.maxSteerForce);
  }

  limitTurn(
    currentVelocity: THREE.Vector3,
    desiredVelocity: THREE.Vector3,
    dt: number,
    out: THREE.Vector3,
  ): THREE.Vector3 {
    const speed = desiredVelocity.length();
    const currentDirection = this.tmpTurnCurrent.copy(currentVelocity).normalize();
    const desiredDirection = this.tmpTurnDesired.copy(desiredVelocity).normalize();
    const angle = currentDirection.angleTo(desiredDirection);
    const maxAngle = this.settings.maxTurnRate * dt;

    if (angle <= maxAngle || angle < 0.000001) {
      return out.copy(desiredVelocity);
    }

    const t = maxAngle / angle;
    const sinAngle = Math.sin(angle);

    if (Math.abs(sinAngle) > 0.000001) {
      out
        .copy(currentDirection)
        .multiplyScalar(Math.sin((1 - t) * angle) / sinAngle)
        .addScaledVector(desiredDirection, Math.sin(t * angle) / sinAngle)
        .normalize();
    } else {
      out.copy(currentDirection).lerp(desiredDirection, t).normalize();
    }

    return out.multiplyScalar(speed);
  }

  isHeadingForCollision(position: THREE.Vector3, forward: THREE.Vector3): boolean {
    if (this.rayHitsObstacle(position, forward, this.settings.collisionAvoidDistance)) {
      return true;
    }

    const end = this.tmpRayEnd.copy(position).addScaledVector(
      forward,
      this.settings.collisionAvoidDistance,
    );
    return !this.isInsidePredictedAquarium(end, this.settings.boundsRadius);
  }

  obstacleRays(position: THREE.Vector3, forward: THREE.Vector3): THREE.Vector3 {
    this.tmpQuat.setFromUnitVectors(this.forwardAxis, forward);

    for (const localDirection of this.rayDirections) {
      const direction = this.tmpRayDir
        .copy(localDirection)
        .applyQuaternion(this.tmpQuat)
        .normalize();
      const end = this.tmpRayEnd.copy(position).addScaledVector(
        direction,
        this.settings.collisionAvoidDistance,
      );

      if (!this.rayHitsObstacle(position, direction, this.settings.collisionAvoidDistance)) {
        if (this.isInsidePredictedAquarium(end, this.settings.boundsRadius)) {
          return this.clearDirOut.copy(direction);
        }
      }
    }

    return this.clearDirOut.copy(forward);
  }

  rayHitsObstacle(origin: THREE.Vector3, direction: THREE.Vector3, maxDistance: number): boolean {
    for (const obstacle of this.obstacles) {
      if (this.rayHitsSingleObstacle(origin, direction, maxDistance, obstacle)) {
        return true;
      }
    }

    return false;
  }

  rayHitsSingleObstacle(
    origin: THREE.Vector3,
    direction: THREE.Vector3,
    maxDistance: number,
    obstacle: Obstacle,
  ): boolean {
    if ((obstacle.shape === "box" || obstacle.shape === "plate") && obstacle.size) {
      return this.rayHitsBoxObstacle(origin, direction, maxDistance, obstacle);
    }

    const radius = obstacle.radius;
    if (typeof radius === "number") {
      return this.rayHitsSphereObstacle(origin, direction, maxDistance, {
        ...obstacle,
        radius,
      });
    }

    return false;
  }

  rayHitsBoxObstacle(
    origin: THREE.Vector3,
    direction: THREE.Vector3,
    maxDistance: number,
    obstacle: Extract<Obstacle, { shape: "box" | "plate" }>,
  ): boolean {
    const localOrigin = this.tmpRayLocalOrigin.subVectors(origin, obstacle.position);
    const localDirection = this.tmpRayLocalDir.copy(direction);

    if (obstacle.rotationY) {
      this.rotateAroundY(localOrigin, -obstacle.rotationY);
      this.rotateAroundY(localDirection, -obstacle.rotationY);
    }

    const inset = this.settings.boundsRadius;
    const halfX = obstacle.size.x * 0.5 + inset;
    const halfY = obstacle.size.y * 0.5 + inset;
    const halfZ = obstacle.size.z * 0.5 + inset;

    return rayIntersectsExpandedBox(localOrigin, localDirection, halfX, halfY, halfZ, maxDistance);
  }

  rayHitsSphereObstacle(
    origin: THREE.Vector3,
    direction: THREE.Vector3,
    maxDistance: number,
    obstacle: Obstacle & { radius: number },
  ): boolean {
    const radius = obstacle.radius + this.settings.boundsRadius;
    const offset = this.tmpRayLocalOrigin.subVectors(origin, obstacle.position);
    const b = offset.dot(direction);
    const c = offset.lengthSq() - radius * radius;
    const discriminant = b * b - c;

    if (discriminant < 0) {
      return false;
    }

    const root = Math.sqrt(discriminant);
    const near = -b - root;
    const far = -b + root;

    return (near >= 0 && near <= maxDistance) || (far >= 0 && far <= maxDistance);
  }

  rotateAroundY(vector: THREE.Vector3, angle: number): THREE.Vector3 {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const x = vector.x;
    const z = vector.z;

    vector.x = x * cos + z * sin;
    vector.z = -x * sin + z * cos;
    return vector;
  }

  aquariumBoundarySteer(position: THREE.Vector3): THREE.Vector3 {
    const steer = this.boundaryOut.set(0, 0, 0);
    const horizontalMargin = this.settings.horizontalBoundaryMargin ?? this.settings.boundaryMargin;
    const topMargin = this.settings.topBoundaryMargin ?? this.settings.boundaryMargin;
    const bottomMargin = this.settings.bottomBoundaryMargin ?? this.settings.boundaryMargin;
    const bounds = this.regionBounds();

    for (const axis of ["x", "z"] as const) {
      const min = axis === "x" ? bounds.minX : bounds.minZ;
      const max = axis === "x" ? bounds.maxX : bounds.maxZ;
      const margin = Math.min(horizontalMargin, Math.max(0, (max - min) * 0.5));
      const innerMin = min + margin;
      const innerMax = max - margin;

      if (position[axis] > innerMax) {
        steer[axis] -= (position[axis] - innerMax) / Math.max(margin, 0.000001);
      } else if (position[axis] < innerMin) {
        steer[axis] += (innerMin - position[axis]) / Math.max(margin, 0.000001);
      }
    }

    const topInset = Math.min(topMargin, Math.max(0, (bounds.maxY - bounds.minY) * 0.5));
    const bottomInset = Math.min(bottomMargin, Math.max(0, (bounds.maxY - bounds.minY) * 0.5));
    const topInnerLimit = bounds.maxY - topInset;
    const bottomInnerLimit = bounds.minY + bottomInset;
    if (position.y > topInnerLimit) {
      steer.y -= (position.y - topInnerLimit) / Math.max(topInset, 0.000001);
    } else if (position.y < bottomInnerLimit) {
      steer.y += (bottomInnerLimit - position.y) / Math.max(bottomInset, 0.000001);
    }

    return steer;
  }

  isInsideAquarium(point: THREE.Vector3, inset = 0): boolean {
    const bounds = this.regionBounds();
    return (
      point.x >= bounds.minX + inset &&
      point.x <= bounds.maxX - inset &&
      point.y >= bounds.minY + inset &&
      point.y <= bounds.maxY - inset &&
      point.z >= bounds.minZ + inset &&
      point.z <= bounds.maxZ - inset
    );
  }

  isInsidePredictedAquarium(point: THREE.Vector3, inset = 0): boolean {
    const bounds = this.regionBounds();
    const topInset = Math.min(inset, this.settings.topBoundaryMargin ?? inset);

    return (
      point.x >= bounds.minX + inset &&
      point.x <= bounds.maxX - inset &&
      point.y <= bounds.maxY - topInset &&
      point.y >= bounds.minY + inset &&
      point.z >= bounds.minZ + inset &&
      point.z <= bounds.maxZ - inset
    );
  }
}

function normalizeFishCount(count: number, fallback: number): number {
  if (!Number.isFinite(count)) {
    return fallback;
  }

  return Math.max(0, Math.floor(count));
}

function rayIntersectsExpandedBox(
  origin: THREE.Vector3,
  direction: THREE.Vector3,
  halfX: number,
  halfY: number,
  halfZ: number,
  maxDistance: number,
): boolean {
  let near = 0;
  let far = maxDistance;

  if (Math.abs(direction.x) < 0.000001) {
    if (origin.x < -halfX || origin.x > halfX) return false;
  } else {
    const inverseDirection = 1 / direction.x;
    let axisNear = (-halfX - origin.x) * inverseDirection;
    let axisFar = (halfX - origin.x) * inverseDirection;
    if (axisNear > axisFar) {
      const swap = axisNear;
      axisNear = axisFar;
      axisFar = swap;
    }
    near = Math.max(near, axisNear);
    far = Math.min(far, axisFar);
    if (near > far) return false;
  }

  if (Math.abs(direction.y) < 0.000001) {
    if (origin.y < -halfY || origin.y > halfY) return false;
  } else {
    const inverseDirection = 1 / direction.y;
    let axisNear = (-halfY - origin.y) * inverseDirection;
    let axisFar = (halfY - origin.y) * inverseDirection;
    if (axisNear > axisFar) {
      const swap = axisNear;
      axisNear = axisFar;
      axisFar = swap;
    }
    near = Math.max(near, axisNear);
    far = Math.min(far, axisFar);
    if (near > far) return false;
  }

  if (Math.abs(direction.z) < 0.000001) {
    if (origin.z < -halfZ || origin.z > halfZ) return false;
  } else {
    const inverseDirection = 1 / direction.z;
    let axisNear = (-halfZ - origin.z) * inverseDirection;
    let axisFar = (halfZ - origin.z) * inverseDirection;
    if (axisNear > axisFar) {
      const swap = axisNear;
      axisNear = axisFar;
      axisFar = swap;
    }
    near = Math.max(near, axisNear);
    far = Math.min(far, axisFar);
    if (near > far) return false;
  }

  return far >= 0 && near <= maxDistance;
}
