# Natural Fish Geometry Refinement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refine all seven procedural Three.js fish models so their body proportions, tail peduncles, fins, and species markings read as natural fish while preserving instancing, growth scaling, motion, and disposal behavior.

**Architecture:** Keep one model factory in `src/fish/procedural-species.ts`. Replace the current chunky primitive composition with reusable parameterized body, peduncle, caudal-fin, and membrane-fin builders; each species composes those builders and paints vertex colors before `finish()` merges non-indexed geometry and creates one disposable material. Keep routing, school behavior, weather, biodiversity, persistence, and public model-loader interfaces unchanged.

**Tech Stack:** TypeScript, Three.js `0.185.x`, `BufferGeometry`, `SphereGeometry`, custom `BufferGeometry`, `ExtrudeGeometry` only where a thin beveled profile is still appropriate, `BufferGeometryUtils.mergeGeometries`, Vitest, Vite.

## Global Constraints

- Do not introduce external `.glb`, textures, network resources, or new runtime dependencies.
- Modify only the procedural geometry and its quality tests; do not change weather, ocean organisms, fish-school behavior, growth storage, or model-loader interfaces.
- Every species returns one merged `BufferGeometry` and one disposable `MeshStandardMaterial` with vertex colors enabled.
- Use 28–36 radial segments for ellipsoid bodies, a short tapered tail peduncle, caudal-fin thickness between `0.04` and `0.12`, and thin double-sided membrane fins with small non-zero thickness.
- Preserve `InstancedMesh.count`, `disposeFishMesh`, starfish-school disposal, growth `setGrowthSizes`, stable `fishId`, and all existing model routing.
- Do not allocate geometry, materials, arrays, or Three.js objects per animation frame.
- Run `npm test`, `npm run typecheck`, and `npm run build` before declaring completion.

---

### Task 1: Add shared natural-geometry builders and quality assertions

**Files:**
- Modify: `src/fish/procedural-species.ts`
- Modify: `test/procedural-species.test.ts`

**Interfaces:**
- Produces `createNaturalBody(options)`, `createTailPeduncle(options)`, `createCaudalFin(options)`, and `createMembraneFin(options)` as private builders used by every species factory.
- Preserves the existing public `ProceduralFishKey`, `createProceduralFishModel`, and `FishModelInstance` interfaces.

- [ ] **Step 1: Write the failing geometry-quality tests**

Extend the existing parameterized test with checks that every model is non-indexed, has finite bounds, and has enough geometry for smooth bodies and thin appendages:

```ts
const position = model.geometry.getAttribute("position");
const normal = model.geometry.getAttribute("normal");
const bounds = model.geometry.boundingBox;
expect(model.geometry.index).toBeNull();
expect(position.count).toBeGreaterThan(300);
expect(normal.count).toBe(position.count);
expect(bounds).not.toBeNull();
expect(bounds?.min.toArray().every(Number.isFinite)).toBe(true);
expect(bounds?.max.toArray().every(Number.isFinite)).toBe(true);
```

Add an aspect-ratio regression test that will fail while the old chunky geometry is still in place:

```ts
const sardine = createProceduralFishModel("sardine");
const angelfish = createProceduralFishModel("angelfish");
const sardineSize = sardine.geometry.boundingBox!.getSize(new THREE.Vector3());
const angelfishSize = angelfish.geometry.boundingBox!.getSize(new THREE.Vector3());
expect(angelfishSize.z / angelfishSize.x).toBeGreaterThan(sardineSize.z / sardineSize.x);
```

Import `* as THREE` in the test and dispose both models after the assertions.

- [ ] **Step 2: Run the focused test and record the baseline**

Run: `npm test -- test/procedural-species.test.ts`

Expected: the existing suite remains green or identifies the exact invariants that need to be preserved during the refactor. Do not weaken the new assertions; they are the geometry-quality gate for the later species migrations.

- [ ] **Step 3: Implement the shared body and appendage builders**

Add these private option types and builders above the species factories:

```ts
type BodyColor = (position: THREE.Vector3, normalizedY: number) => THREE.Color;

interface NaturalBodyOptions {
  scale: THREE.Vector3;
  center?: THREE.Vector3;
  radialSegments?: number;
  verticalSegments?: number;
  taper?: number;
  headFullness?: number;
  colorAt: BodyColor;
}

function createNaturalBody(options: NaturalBodyOptions): THREE.BufferGeometry;
function createTailPeduncle(options: {
  y: number;
  length: number;
  bodyRadius: number;
  tailRadius: number;
  color: THREE.Color;
}): THREE.BufferGeometry;
function createCaudalFin(options: {
  y: number;
  width: number;
  height: number;
  thickness: number;
  color: THREE.Color;
  fork: number;
}): THREE.BufferGeometry;
function createMembraneFin(options: {
  baseY: number;
  baseZ: number;
  span: number;
  height: number;
  thickness: number;
  color: THREE.Color;
  orientation: "dorsal" | "ventral" | "pectoral";
}): THREE.BufferGeometry;
```

`createNaturalBody` should start from `SphereGeometry(1, radialSegments ?? 32, verticalSegments ?? 20)`, warp each vertex by normalized `y` so the head is fuller and the rear tapers, apply `scale` and `center`, then call `paint`. `createTailPeduncle` should use a tapered `CylinderGeometry` aligned to the +Y swim axis and positioned so its front overlaps the body and its rear meets the caudal fin. `createCaudalFin` should use a `THREE.Shape` with two rounded lobes and a center fork, then `ExtrudeGeometry` with `depth: thickness`, `bevelSegments: 2`, and bevel values no larger than `0.02`. `createMembraneFin` should create a thin double-sided four-edge membrane with a curved outer edge, not a solid triangular prism. All builders must set vertex colors before returning.

- [ ] **Step 4: Update `finish()` for consistent smooth output**

In `finish(parts)`, clone indexed parts with `toNonIndexed()`, delete `uv`, merge with `mergeGeometries(normalized, false)`, compute vertex normals, bounds, and a bounding sphere, then dispose every source part. Keep `MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.48, metalness: 0.02, side: THREE.DoubleSide })` and the existing `FishModelInstance` flags unchanged.

- [ ] **Step 5: Run the focused tests and commit the shared layer**

Run: `npm test -- test/procedural-species.test.ts`

Expected: PASS for the existing renderability checks and the shared finalization invariants. Species-specific silhouette checks are added and tightened in Tasks 2–3 after each corresponding factory is migrated.

Commit:

```bash
git add src/fish/procedural-species.ts test/procedural-species.test.ts
git commit -m "refactor(fish): add natural procedural geometry builders"
```

### Task 2: Refine sardine, koi, and clownfish compositions

**Files:**
- Modify: `src/fish/procedural-species.ts`
- Modify: `test/procedural-species.test.ts`

**Interfaces:**
- Consumes the shared builders from Task 1.
- Produces the same `createSardine()`, `createKoi()`, and `createClownfish()` return types and keeps all fish keys unchanged.

- [ ] **Step 1: Add species-specific geometry regression checks**

Add a test that compares bounds and color richness for the three species:

```ts
const sardine = createProceduralFishModel("sardine");
const koi = createProceduralFishModel("koi");
const clownfish = createProceduralFishModel("clownfish");
const sardineSize = sardine.geometry.boundingBox!.getSize(new THREE.Vector3());
const koiSize = koi.geometry.boundingBox!.getSize(new THREE.Vector3());
const clownfishSize = clownfish.geometry.boundingBox!.getSize(new THREE.Vector3());
expect(koiSize.x).toBeGreaterThan(sardineSize.x);
expect(clownfishSize.y).toBeLessThan(sardineSize.y);
expect(sardine.geometry.getAttribute("color").count).toBeGreaterThan(300);
expect(koi.geometry.getAttribute("color").count).toBeGreaterThan(300);
expect(clownfish.geometry.getAttribute("color").count).toBeGreaterThan(300);
for (const model of [sardine, koi, clownfish]) {
  model.geometry.dispose();
  model.material.dispose();
}
```

Use one model instance per assertion and dispose every extra instance returned by the `size` helper.

- [ ] **Step 2: Run the new focused test and record the baseline**

Run: `npm test -- test/procedural-species.test.ts`

Expected: the checks either pass as a baseline or identify a proportion that needs to be preserved while the shared builders replace the old primitives. Keep the checks as regression guards; do not relax them to accommodate the refactor.

- [ ] **Step 3: Migrate sardine to natural proportions**

Compose the sardine with a narrow natural body (`scale` around `(0.42, 1.08, 0.23)`, 32 radial segments), a short peduncle ending near `y = -0.94`, a forked caudal fin with `thickness` around `0.06`, and four membrane fins. Paint a silver-blue back, pale belly, and a narrow dark lateral stripe by normalized height and `z`; keep both eyes and the mouth as the existing small black detail geometry.

- [ ] **Step 4: Migrate koi to natural proportions**

Use a fuller body (`scale` around `(0.58, 1.08, 0.34)`) with a rounder head, a thicker but tapered peduncle, a wide thin caudal fin, and softened red-orange patch boundaries based on smooth distance functions instead of hard rectangular bands. Keep the cream belly and the existing eyes/mouth.

- [ ] **Step 5: Migrate clownfish to natural proportions**

Use a compact body (`scale` around `(0.48, 0.88, 0.30)`), a narrow peduncle, a small forked tail, and three curved white bands with narrower black borders evaluated from normalized `y` distance. Use warm orange membrane fins and preserve the current eye/mouth details.

- [ ] **Step 6: Run tests, typecheck, and commit**

Run: `npm test -- test/procedural-species.test.ts && npm run typecheck`

Expected: PASS with no changes to public routing or growth APIs.

Commit:

```bash
git add src/fish/procedural-species.ts test/procedural-species.test.ts
git commit -m "feat(fish): refine sardine koi and clownfish geometry"
```

### Task 3: Refine angelfish, blue tang, pufferfish, and starfish

**Files:**
- Modify: `src/fish/procedural-species.ts`
- Modify: `test/procedural-species.test.ts`

**Interfaces:**
- Consumes the shared builders from Task 1 and the species conventions established in Task 2.
- Produces unchanged `createAngelfish()`, `createBlueTang()`, `createPufferfish()`, and `createStarfish()` model-factory signatures.

- [ ] **Step 1: Add remaining species shape checks**

Add tests for the intended silhouettes:

```ts
const angelfish = createProceduralFishModel("angelfish");
const pufferfish = createProceduralFishModel("pufferfish");
const starfish = createProceduralFishModel("starfish");
const angelfishSize = angelfish.geometry.boundingBox!.getSize(new THREE.Vector3());
const pufferSize = pufferfish.geometry.boundingBox!.getSize(new THREE.Vector3());
const starSize = starfish.geometry.boundingBox!.getSize(new THREE.Vector3());
expect(angelfishSize.z).toBeGreaterThan(angelfishSize.x * 1.2);
expect(pufferSize.x).toBeGreaterThan(pufferSize.y * 0.7);
expect(Math.abs(starSize.x - starSize.y)).toBeLessThan(0.15);
for (const model of [angelfish, pufferfish, starfish]) {
  model.geometry.dispose();
  model.material.dispose();
}
```

- [ ] **Step 2: Run the focused test and record the baseline**

Run: `npm test -- test/procedural-species.test.ts`

Expected: the checks establish the intended tall, rounded, and radial silhouettes before the remaining factories are rewritten. Any failing check is fixed by the model migration, not by weakening the expected silhouette.

- [ ] **Step 3: Migrate angelfish and blue tang**

For angelfish, keep the tall body silhouette, use a narrow peduncle, long thin dorsal/ventral membranes, and retain four softened vertical stripe gradients. For blue tang, keep the laterally compressed body, make the back/belly arcs smooth, use a clear yellow tail/peduncle transition, and use rounded dark membrane fins. Both species retain existing eye and mouth geometry.

- [ ] **Step 4: Migrate pufferfish**

Use a 34–36 segment rounded body with a gentle belly taper, smaller rounded membrane fins, and fewer/smaller spines placed along the silhouette. Build each spine from a short low-sided cone only once during model creation, orient it with the existing quaternion scratch objects, and paint it with `PUFFER_FIN`; do not create spines per frame.

- [ ] **Step 5: Refine starfish as a radial natural mesh**

Replace the sharp ten-point extrude profile with five curved arms built from a radial profile that has a rounded arm root, a slightly tapered arm tip, and a shallow raised center. Keep the model centered in the XY plane, retain a small center dome, paint a smooth orange-red center-to-tip gradient, and ensure the final geometry is still compatible with the starfish school’s existing bottom-layer motion and disposal path.

- [ ] **Step 6: Run tests, typecheck, and commit**

Run: `npm test -- test/procedural-species.test.ts test/fish-model-routing.test.ts && npm run typecheck`

Expected: PASS; all seven model keys still resolve through the procedural loader and all geometry attributes remain valid.

Commit:

```bash
git add src/fish/procedural-species.ts test/procedural-species.test.ts
git commit -m "feat(fish): refine angelfish tang pufferfish and starfish"
```

### Task 4: Verify lifecycle compatibility and production build

**Files:**
- Verify only: `src/fish/model-loader.ts`, fish-school modules, growth modules, and existing routing/lifecycle tests

**Interfaces:**
- Consumes the unchanged model factory and loader contracts from Tasks 1–3.
- Produces evidence that the unchanged routing, lifecycle, growth, weather, and biodiversity contracts still work with the refined geometry.

- [ ] **Step 1: Run the complete automated suite**

Run: `npm test`

Expected: all existing tests pass, including fish routing, growth compatibility, weather controls, biodiversity, and procedural geometry tests.

- [ ] **Step 2: Run static checks and production build**

Run: `npm run typecheck && npm run build`

Expected: TypeScript emits no diagnostics and Vite completes a production build.

- [ ] **Step 3: Perform a browser smoke check**

Start the dev server with `npm run dev -- --host 127.0.0.1`, open `http://127.0.0.1:5173/`, select a preset containing all seven species, and verify:

1. fish bodies, peduncles, fins, and tails appear smooth rather than blocky;
2. angelfish remains tall, pufferfish remains rounded, and starfish remains radial;
3. weather buttons still change weather only on click;
4. fish growth controls and saved growth records still work;
5. switching presets does not leak stale meshes or throw disposal errors.

- [ ] **Step 4: Record final verification**

Record the final `npm test`, `npm run typecheck`, and `npm run build` results in the handoff response. No routing, lifecycle, or documentation files should be changed by this geometry-only task.
