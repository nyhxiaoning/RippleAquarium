import type { Vec3 } from "../aquarium/types.js";
import type * as THREE from "three";

/** Characters provided by the SpongeBob-themed aquarium content pack. */
export type ThemeCharacterId = "spongebob" | "patrick" | "squidward" | "mr-krabs";

/** Static props provided by the SpongeBob-themed aquarium content pack. */
export type ThemePropId = "squidward-house" | "krusty-krab";

export type ThemeObjectId = ThemeCharacterId | ThemePropId;

/** A small lifecycle contract shared by theme characters and props. */
export interface ThemeObjectHandle {
  readonly group: THREE.Group;
  update(time: number, dt: number): void;
  resize(halfSize: THREE.Vector3): void;
  dispose(): void;
  /** Optional anchor for future character interactions and collectibles. */
  getInteractionAnchor?(): THREE.Object3D;
}

/** Serializable placement and visibility data for one theme object. */
export interface ThemeEntry {
  id: ThemeObjectId;
  kind: "character" | "prop";
  enabled: boolean;
  position: Vec3;
  rotationY: number;
  scale: number;
}

export interface ThemeMeta {
  id: ThemeObjectId;
  kind: ThemeEntry["kind"];
  name: { zh: string; en: string };
  defaultPosition: Vec3;
  defaultRotationY: number;
  defaultScale: number;
  /** Scale used when the small-tank preset keeps this object visible. */
  smallTankScale: number;
  /** Large props may be hidden in a small tank to preserve a clear swim lane. */
  hideInSmallTank?: boolean;
}
