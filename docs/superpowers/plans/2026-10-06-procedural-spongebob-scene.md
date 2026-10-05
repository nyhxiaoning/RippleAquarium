# 纯程序化海绵宝宝主题景观实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the SpongeBob-themed scenery runtime with independently controllable procedural Three.js characters and props arranged like the supplied reference image, without changing fish, weather, ecology, or growth behavior.

**Architecture:** Add a shared procedural-parts module for reusable cartoon primitives, materials, face parts, and disposal. Extend the existing theme character/prop factories with SpongeBob, Patrick, and pineapple-house while keeping the current lifecycle handle contracts. Update catalog, presets, and scene-builder normalization so legacy `spongebob-patrick`/decor descriptors remain readable but no longer trigger GLB loading; all runtime scenery is created from theme entries and uses the existing visibility, scale, animation, collision, avoidance, and disposal paths.

**Tech Stack:** TypeScript, Three.js `0.185.x`, `MeshStandardMaterial`, `BufferGeometry`, `ShapeGeometry`/`ExtrudeGeometry`, Vitest, Vite.

## Global Constraints

- Use only pure procedural Three.js geometry and vertex/material colors; do not introduce external GLB, textures, audio, network resources, or new runtime dependencies.
- Add independent objects `spongebob`, `patrick`, `squidward`, `mr-krabs`, and `pineapple-house`; preserve `squidward-house` and `krusty-krab` as existing procedural props.
- Keep the existing theme handle contract: `group`, `update(time, dt)`, `resize(halfSize)`, `dispose()`, optional `getInteractionAnchor()`, and `setAnimationEnabled()` for characters.
- Keep existing fish models, fish-school behavior, weather controls, ecology schools, and growth persistence unchanged.
- Do not allocate Three.js objects, arrays, materials, or geometry in per-frame animation loops.
- Keep historical `spongebob-patrick` and pineapple decor descriptors readable, but do not load `src/decor/spongebob-patrick.ts` or `src/decor/pineapple-house.ts` for runtime themed scenery.
- Preserve independent visibility, scale, idle-animation, collision, avoidance, and safe double-dispose behavior.
- Run `npm test`, `npm run typecheck`, and `npm run build` before handoff.

---

### Task 1: Extract shared procedural cartoon parts

**Files:**
- Create: `src/theme/procedural-parts.ts`
- Create: `test/theme-procedural-parts.test.ts`
- Modify: `src/theme/characters.ts`
- Modify: `src/theme/props.ts`

**Interfaces:**
- Produces shared helpers used by all later character/prop factories: `createThemeMaterial(color, roughness?)`, `createThemeMesh(name, geometry, material, position?)`, `createRoundedBoxGeometry(width, height, depth, bevel)`, `createEyePair(parent, options)`, and `disposeThemeResources(root)`.
- Preserves all existing exports from `characters.ts` and `props.ts`; moving internal helper logic must not change current callers.

- [ ] **Step 1: Write failing shared-part tests**

Create a focused test that exercises the new helper contract:

```ts
import * as THREE from "three";
import { assert, describe, it } from "vitest";
import {
  createRoundedBoxGeometry,
  createThemeMaterial,
  createThemeMesh,
  disposeThemeResources,
} from "../src/theme/procedural-parts.js";

describe("procedural theme parts", () => {
  it("creates renderable geometry and disposes a theme group safely", () => {
    const group = new THREE.Group();
    const geometry = createRoundedBoxGeometry(1, 2, 0.8, 0.08);
    const material = createThemeMaterial(0xffd83d);
    const body = createThemeMesh("body", geometry, material);
    group.add(body);
    assert.ok(body.geometry.getAttribute("position").count > 0);
    assert.ok(body.geometry.getAttribute("normal").count > 0);
    disposeThemeResources(group);
    disposeThemeResources(group);
    assert.equal(group.children.length, 1);
  });
});
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `npm test -- test/theme-procedural-parts.test.ts`

Expected: FAIL because `src/theme/procedural-parts.ts` does not exist yet.

- [ ] **Step 3: Implement the shared helper module**

Implement the following concrete behavior:

```ts
export function createThemeMaterial(color: number, roughness = 0.78) {
  return new THREE.MeshStandardMaterial({
    color,
    flatShading: true,
    roughness,
    metalness: 0.02,
  });
}

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
```

Also move the existing `standardMaterial`, `mesh`, eye-pair creation, and deduplicated geometry/material disposal into this module. Keep all helpers allocation-free after object construction and set `castShadow`/`receiveShadow` on generated meshes.

- [ ] **Step 4: Replace duplicate local helpers without changing existing output contracts**

Update `characters.ts` and `props.ts` to import the shared helpers. Keep existing Squidward, Mr. Krabs, Squidward-house, and Krusty-Krab branches compiling and visually equivalent before adding new objects.

- [ ] **Step 5: Run tests and commit the shared layer**

Run: `npm test -- test/theme-procedural-parts.test.ts test/theme-characters.test.ts test/theme-props.test.ts && npm run typecheck`

Expected: PASS for the new helper test and all existing theme tests.

Commit:

```bash
git add src/theme/procedural-parts.ts src/theme/characters.ts src/theme/props.ts test/theme-procedural-parts.test.ts
git commit -m "refactor(theme): add shared procedural cartoon parts"
```

### Task 2: Add procedural SpongeBob and Patrick characters

**Files:**
- Modify: `src/theme/types.ts`
- Modify: `src/theme/characters.ts`
- Modify: `src/theme/animation.ts`
- Modify: `test/theme-characters.test.ts`

**Interfaces:**
- Consumes the shared helpers from Task 1.
- Produces `createThemeCharacter("spongebob", options)` and `createThemeCharacter("patrick", options)` handles with the same lifecycle methods as existing characters.
- Keeps `createSquidwardParts` and `createMrKrabsParts` exports and animation behavior intact.

- [ ] **Step 1: Extend the character ID type and write failing character tests**

Change the type to include `"spongebob" | "patrick"` and add tests:

```ts
it.each(["spongebob", "patrick"] as const)("creates and safely disposes %s", (id) => {
  const handle = createThemeCharacter(id, { scale: 0.8, animationEnabled: true });
  assert.equal(handle.group.name, `Theme-${id}`);
  assert.ok(handle.group.getObjectByProperty("isMesh", true));
  assert.ok(handle.getInteractionAnchor?.());
  handle.update(1.2, 1 / 60);
  handle.setAnimationEnabled(false);
  handle.resize(new THREE.Vector3(5, 3.5, 4));
  handle.dispose();
  handle.dispose();
  assert.equal(handle.group.children.length, 0);
});
```

Add a silhouette test that checks SpongeBob has a wider body than Patrick and both have at least one eye pair, mouth, and limb group by name.

- [ ] **Step 2: Run the focused tests to verify they fail**

Run: `npm test -- test/theme-characters.test.ts`

Expected: FAIL with `Unknown theme character: spongebob` or `Unknown theme character: patrick`.

- [ ] **Step 3: Add low-amplitude animation parts**

Extend `animation.ts` with explicit references:

```ts
export interface SpongeBobAnimationParts {
  readonly group: THREE.Group;
  readonly body: THREE.Object3D;
  readonly arms: readonly THREE.Object3D[];
  readonly staticBodyRotation: StaticRotation;
  readonly staticArmRotations: readonly StaticRotation[];
}

export interface PatrickAnimationParts {
  readonly group: THREE.Group;
  readonly body: THREE.Object3D;
  readonly arms: readonly THREE.Object3D[];
  readonly staticBodyRotation: StaticRotation;
  readonly staticArmRotations: readonly StaticRotation[];
}
```

Add `updateSpongeBobAnimation` and `updatePatrickAnimation` using pre-existing rotation snapshots and sine/cosine offsets no larger than `0.08` radians. When disabled, restore every stored rotation exactly.

- [ ] **Step 4: Compose the two characters**

Implement in `createThemeCharacter`:

- SpongeBob: rounded yellow box body, lighter porous spots, white eyes with dark pupils, small mouth, white shirt collar, red tie, brown shorts, thin yellow legs, black shoes, and two thin arms.
- Patrick: pink tapered capsule body, green shorts with purple patches, two arms, two short legs, and simple eyes/mouth.

Name key parts `body`, `eyes`, `mouth`, `arm-left`, `arm-right`, `leg-left`, and `leg-right` so tests and animation can find them. Use `interactionAnchor.position` around `(0, 1.8, 0.75)` for SpongeBob and `(0, 1.7, 0.7)` for Patrick. Keep authored geometry above local `y=0` so existing floor anchoring works.

- [ ] **Step 5: Run focused tests, typecheck, and commit**

Run: `npm test -- test/theme-characters.test.ts && npm run typecheck`

Expected: all old and new character tests pass; animation toggles restore static poses; double disposal does not throw.

Commit:

```bash
git add src/theme/types.ts src/theme/characters.ts src/theme/animation.ts test/theme-characters.test.ts
git commit -m "feat(theme): add procedural SpongeBob and Patrick"
```

### Task 3: Add the procedural pineapple house and expand theme footprints

**Files:**
- Modify: `src/theme/types.ts`
- Modify: `src/theme/props.ts`
- Modify: `test/theme-props.test.ts`

**Interfaces:**
- Consumes shared parts from Task 1.
- Produces `createThemeProp("pineapple-house", { scale })` and `getThemePropFootprint("pineapple-house", scale)`.
- Keeps existing Squidward-house and Krusty-Krab prop IDs and lifecycle unchanged.

- [ ] **Step 1: Add the failing pineapple prop and footprint tests**

Extend the prop test loop and collision checks:

```ts
const ids = ["pineapple-house", "squidward-house", "krusty-krab"] as const;
for (const id of ids) {
  const handle = createThemeProp(id, { scale: 0.8 });
  assert.ok(handle);
  assert.ok(handle.group.getObjectByProperty("isMesh", true));
  handle.dispose();
}
assert.ok(getThemePropFootprint("pineapple-house", 0.8).width > 0);
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `npm test -- test/theme-props.test.ts`

Expected: FAIL because `createThemeProp` currently returns `null` for `pineapple-house` and no footprint exists.

- [ ] **Step 3: Implement the pineapple house composition**

Add `pineapple-house` to `ThemePropId` and `THEME_FOOTPRINTS`. Build a bottom-anchored group with:

1. orange-yellow ellipsoid/capsule body;
2. four to six darker crossed strips made from thin curved or rotated geometry;
3. green leaf-cap cones/ellipsoids at the top;
4. a blue circular window with dark frame;
5. a wood-colored arched door and base.

Use shared materials, mark all meshes for shadows, set `group.userData.themePropId`, and reuse the existing deduplicated disposal path. Set the footprint to cover the full visual bounds and give it a stronger avoidance radius than a character so fish do not clip through the house.

- [ ] **Step 4: Run focused tests and commit**

Run: `npm test -- test/theme-props.test.ts && npm run typecheck`

Expected: all three props create valid meshes, resize to the tank floor, expose positive collision/avoidance dimensions, and dispose safely twice.

Commit:

```bash
git add src/theme/types.ts src/theme/props.ts test/theme-props.test.ts
git commit -m "feat(theme): add procedural pineapple house"
```

### Task 4: Expand catalog, presets, and legacy descriptor normalization

**Files:**
- Modify: `src/theme/types.ts`
- Modify: `src/theme/catalog.ts`
- Modify: `src/aquarium/presets.ts`
- Modify: `src/aquarium/types.ts`
- Modify: `src/aquarium/manager.ts`
- Modify: `test/theme-catalog.test.ts`
- Modify: `test/theme-presets.test.ts`

**Interfaces:**
- Consumes the new character and prop IDs from Tasks 2–3.
- Produces default/preset entries in reference-image order and a normalization function that expands legacy `spongebob-patrick` configuration exactly once.

- [ ] **Step 1: Write failing catalog and preset tests**

Update test constants and add explicit order assertions:

```ts
const THEME_IDS = [
  "pineapple-house",
  "patrick",
  "spongebob",
  "squidward",
  "mr-krabs",
  "squidward-house",
  "krusty-krab",
] as const;

assert.deepStrictEqual(
  DEFAULT_STYLE.themeEntries?.slice(0, 5).map((entry) => entry.id),
  THEME_IDS.slice(0, 5),
);
```

Add a legacy normalization test using a descriptor with `themeEntries: undefined` and a `decor` item whose asset is `spongebob-patrick`; assert exactly one SpongeBob and one Patrick entry are returned and repeated normalization does not duplicate them.

- [ ] **Step 2: Run focused tests to verify the new expectations fail**

Run: `npm test -- test/theme-catalog.test.ts test/theme-presets.test.ts`

Expected: FAIL because the catalog currently contains only Squidward, Mr. Krabs, Squidward-house, and Krusty-Krab.

- [ ] **Step 3: Add catalog metadata and reference-image placements**

Add bilingual metadata, default scale, small-tank scale, and `hideInSmallTank` flags. Make `createThemeEntriesForPreset` return the first five entries in this order for large tanks:

```ts
[
  { id: "pineapple-house", position: { x: -8.4, y: 0, z: 6.2 } },
  { id: "patrick", position: { x: -4.8, y: 0, z: 4.8 }, scale: 1.08 },
  { id: "spongebob", position: { x: 0, y: 0, z: 4.55 }, scale: 1 },
  { id: "squidward", position: { x: 4.6, y: 0, z: 5.1 }, scale: 0.98 },
  { id: "mr-krabs", position: { x: 8.6, y: 0, z: 4.65 }, scale: 1.02 },
]
```

Add scaled positions for Coral Reef and Deep Sea, and for Small Tank keep the characters at `0.65–0.75` scale while disabling large props. Preserve Squidward-house and Krusty-Krab entries after the five primary objects so existing controls remain available.

- [ ] **Step 4: Implement legacy normalization without duplication**

Add a pure function in `src/theme/catalog.ts`:

```ts
export function normalizeThemeEntries(
  entries: readonly ThemeEntry[] | undefined,
  decor: readonly { asset: string }[] = [],
): ThemeEntry[];
```

It must clone input entries, detect the legacy `spongebob-patrick` decor only when neither new ID exists, insert `spongebob` and `patrick` entries using the catalog defaults, and return the same IDs unchanged on a second call. Keep the historical decor item in the descriptor for compatibility, but mark it for runtime skipping in Task 5.

- [ ] **Step 5: Run focused tests and commit**

Run: `npm test -- test/theme-catalog.test.ts test/theme-presets.test.ts && npm run typecheck`

Expected: all catalog, preset footprint, small-tank, cloning, and legacy-normalization tests pass.

Commit:

```bash
git add src/theme/types.ts src/theme/catalog.ts src/aquarium/presets.ts src/aquarium/types.ts src/aquarium/manager.ts test/theme-catalog.test.ts test/theme-presets.test.ts
git commit -m "feat(theme): add reference-image theme entries and legacy normalization"
```

### Task 5: Route scene construction through procedural theme entries

**Files:**
- Modify: `src/aquarium/scene-builder.ts`
- Modify: `src/aquarium/presets.ts`
- Modify: `test/theme-props.test.ts`
- Create: `test/theme-scene-routing.test.ts`

**Interfaces:**
- Consumes `normalizeThemeEntries`, expanded IDs, and procedural factories from Tasks 2–4.
- Produces a scene builder that never calls legacy GLB decor loaders for `pineapple-house` or `spongebob-patrick` and creates all enabled scenery through `createThemeCharacter`/`createThemeProp`.

- [ ] **Step 1: Write the failing scene-routing test**

Add a source-level routing test that imports the scene-builder module and verifies the legacy loader functions are no longer imported by the runtime path, plus a pure collision test:

```ts
it("uses theme entries for SpongeBob scenery", async () => {
  const source = await readFile(new URL("../src/aquarium/scene-builder.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /createPineappleHouseDecor|createSpongebobPatrickDecor/);
  const entries = createDefaultThemeEntries();
  assert.ok(entries.some((entry) => entry.id === "spongebob"));
  assert.ok(getThemePropFootprint("pineapple-house", 1).avoidanceRadius > 0);
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `npm test -- test/theme-scene-routing.test.ts`

Expected: FAIL because `scene-builder.ts` currently imports and calls both legacy GLB loaders.

- [ ] **Step 3: Remove legacy runtime loading and normalize entries**

Remove the two legacy loader imports and the async `descriptor.decor` loop for the two theme assets. At scene-build start, call `normalizeThemeEntries(descriptor.themeEntries, descriptor.decor)` and use the normalized entries for handle creation. Keep non-theme decor handling unchanged if any future descriptor adds it.

Update `computeObstacles`, `computeExclusionZones`, and `computeClownfishAvoidanceZones` so legacy theme decor is ignored when matching normalized theme entries exist; otherwise old descriptors still receive a compatibility footprint. This prevents duplicate collision and avoidance zones.

- [ ] **Step 4: Verify lifecycle and visual routing**

Ensure `createThemeHandle` accepts the expanded `ThemeCharacterId`/`ThemePropId`, creates the five primary objects in the root group, applies entry position/rotation/scale, and continues to update, resize, toggle visibility, and dispose all handles. Keep fish school creation and weather setup untouched.

- [ ] **Step 5: Run focused tests and commit**

Run: `npm test -- test/theme-scene-routing.test.ts test/theme-props.test.ts test/theme-characters.test.ts test/theme-presets.test.ts && npm run typecheck`

Expected: all routing, collision, lifecycle, preset, and character tests pass; no legacy theme GLB loader appears in the scene-builder source.

Commit:

```bash
git add src/aquarium/scene-builder.ts src/aquarium/presets.ts test/theme-props.test.ts test/theme-scene-routing.test.ts
git commit -m "feat(scene): route SpongeBob scenery through procedural theme entries"
```

### Task 6: Full regression, browser preview, and cleanup

**Files:**
- Verify: `src/fish/`, `src/weather/`, `src/ecology/`, `src/growth/`
- Verify: `README.md`, `README.en.md`
- Verify: `dist/` output from the production build

**Interfaces:**
- Consumes the complete procedural theme implementation from Tasks 1–5.
- Produces verified runtime behavior with no changes to fish, weather, ecology, or growth contracts.

- [ ] **Step 1: Run the complete test suite**

Run: `npm test`

Expected: all existing tests plus the new procedural theme tests pass, including fish geometry/routing, weather controls, ecology, growth persistence, theme catalog, scene routing, and lifecycle disposal.

- [ ] **Step 2: Run typecheck and production build**

Run: `npm run typecheck && npm run build`

Expected: TypeScript reports no diagnostics and Vite produces a production bundle without missing theme asset requests. A chunk-size warning is acceptable if it does not fail the build.

- [ ] **Step 3: Perform browser preview verification**

Open `http://127.0.0.1:5173/`, select the default large-tank preset, and verify the visible composition is ordered from left to right as pineapple house, Patrick, SpongeBob, Squidward, and Mr. Krabs. Confirm the theme panel exposes each object independently, the characters idle with small motions, and fish remain visible in the center swim lane.

- [ ] **Step 4: Verify preset and compatibility behavior in the browser**

Switch to Coral Reef, Deep Sea, and Small Tank presets. Confirm character scales and object visibility adapt to each tank, the small tank hides large props, toggling an object does not rebuild fish schools, weather buttons remain manual, and growth records remain unchanged.

- [ ] **Step 5: Check the worktree and record the handoff**

Run:

```bash
git diff --check
git status --short
git log -6 --oneline
```

Expected: no whitespace errors, only intentional commits, and a clean worktree before handoff.
