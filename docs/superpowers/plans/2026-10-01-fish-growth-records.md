# Fish Growth Records Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add persistent per-fish growth records with stable IDs, online growth, capped offline catch-up, smooth instance scaling, and a bilingual growth panel.

**Architecture:** Keep growth as a Three.js-independent domain layer. `FishGrowthRegistry` owns individual records and pure growth calculations; `growth/storage.ts` owns versioned browser persistence. Aquarium manager and species schools bind stable IDs to rendered instances, while the UI reads registry summaries and save status without duplicating growth logic.

**Tech Stack:** TypeScript, Three.js 0.185, Vite, Vitest, browser `localStorage`.

## Global Constraints

- Adult growth target is 2 hours of accumulated age: juvenile 0–20 minutes, growing 20–80 minutes, adult 80–120 minutes, fully mature at 120 minutes.
- Offline catch-up is capped at 24 hours per load and clock rollback produces zero catch-up.
- Paused simulation does not age fish; single-step debugging ages only by the stepped `dt`.
- New fish reuse inactive records before creating records; reducing counts deactivates the youngest fish without deleting records.
- Storage writes are versioned, validated, recoverable, and must never stop the simulation when unavailable.
- The first phase does not add weather, hunger, health, lifespan, death, breeding, or new species.
- Preserve existing model loading, boids behavior, aquarium presets, and current tests.

---

### Task 1: Add growth domain types and deterministic growth math

**Files:**
- Create: `src/growth/types.ts`
- Create: `src/growth/calculator.ts`
- Test: `test/growth-calculator.test.ts`

**Interfaces:**
- Produces `FishGrowthStage`, `FishGrowthRecord`, `FishGrowthSnapshot`, `FishGrowthConfig`, `FishGrowthView`, and `GrowthStats`.
- Produces `calculateGrowth(ageSeconds, config): FishGrowthView` and `clampOfflineSeconds(savedAt, now, maxSeconds): number`.

- [ ] **Step 1: Write failing boundary and clock tests**

```ts
it("uses the agreed stages and reaches full size at two hours", () => {
  assert.strictEqual(calculateGrowth(0, DEFAULT_GROWTH_CONFIG).stage, "juvenile");
  assert.strictEqual(calculateGrowth(20 * 60, DEFAULT_GROWTH_CONFIG).stage, "growing");
  assert.strictEqual(calculateGrowth(80 * 60, DEFAULT_GROWTH_CONFIG).stage, "adult");
  assert.strictEqual(calculateGrowth(120 * 60, DEFAULT_GROWTH_CONFIG).sizeMultiplier, 1);
});

it("clamps offline catch-up and ignores a clock rollback", () => {
  assert.strictEqual(clampOfflineSeconds(0, 26 * 60 * 60 * 1000, 24 * 60 * 60), 24 * 60 * 60);
  assert.strictEqual(clampOfflineSeconds(10_000, 9_000, 24 * 60 * 60), 0);
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `rtk npm test -- test/growth-calculator.test.ts`

Expected: FAIL because the growth types and calculation functions do not exist.

- [ ] **Step 3: Implement pure types and calculations**

Use a default config with `juvenileScale: 0.55`, `juvenileEndSeconds: 20 * 60`, `adultStartSeconds: 80 * 60`, and `matureSeconds: 120 * 60`. Clamp age to zero or greater, clamp progress to `[0, 1]`, and use smoothstep interpolation from 20 to 120 minutes. Treat the adult stage as beginning at 80 minutes while size continues increasing until 120 minutes.

- [ ] **Step 4: Run the focused test and verify it passes**

Run: `rtk npm test -- test/growth-calculator.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the domain math**

```bash
git add src/growth/types.ts src/growth/calculator.ts test/growth-calculator.test.ts
git commit -m "feat: add deterministic fish growth calculations"
```

### Task 2: Implement the in-memory growth registry and lifecycle rules

**Files:**
- Create: `src/growth/registry.ts`
- Test: `test/growth-registry.test.ts`

**Interfaces:**
- `createFishGrowthRegistry(options?: { now?: () => number; idFactory?: () => string }): FishGrowthRegistry`.
- `FishGrowthRegistry.activate(speciesId: string, count: number): string[]`.
- `FishGrowthRegistry.deactivate(speciesId: string, count: number): void`.
- `FishGrowthRegistry.advanceOnline(seconds: number, growthRateMultiplier?: number): void`.
- `FishGrowthRegistry.applyOffline(seconds: number): void`.
- `FishGrowthRegistry.getRecord(fishId: string): FishGrowthRecord | undefined`.
- `FishGrowthRegistry.getRecords(speciesId?: string, includeInactive?: boolean): FishGrowthRecord[]`.
- `FishGrowthRegistry.getStats(speciesId?: string): GrowthStats`.
- `FishGrowthRegistry.snapshot(savedAt: number): FishGrowthSnapshot`.
- `FishGrowthRegistry.replace(snapshot: FishGrowthSnapshot): void`.

- [ ] **Step 1: Write failing lifecycle tests**

Cover these exact cases: activation creates unique IDs; a second activation creates only the missing records; deactivation chooses the youngest active records; reactivation returns inactive records before creating new ones; `advanceOnline` changes age only for active records; `applyOffline` updates records without exceeding the caller-provided capped duration; `snapshot` includes both active and inactive records; `replace` recomputes derived stage, progress, and size from age.

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `rtk npm test -- test/growth-registry.test.ts`

Expected: FAIL because `createFishGrowthRegistry` is not defined.

- [ ] **Step 3: Implement registry state and ID allocation**

Keep records in a `Map<string, FishGrowthRecord>`. Use `crypto.randomUUID()` when available and a deterministic counter fallback for tests. Keep `speciesId` immutable. Sort inactive records by most recent deactivation order, and sort active records by age ascending when selecting records to deactivate.

- [ ] **Step 4: Implement updates and derived views**

Update only active records in `advanceOnline`; multiply seconds by the finite, non-negative rate multiplier. Recompute the calculator view after each update. `getStats` must return active count, juvenile count, growing count, adult count, and average progress.

- [ ] **Step 5: Run the focused test and verify it passes**

Run: `rtk npm test -- test/growth-registry.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit the registry**

```bash
git add src/growth/registry.ts test/growth-registry.test.ts
git commit -m "feat: add per-fish growth registry"
```

### Task 3: Add validated versioned storage

**Files:**
- Create: `src/growth/storage.ts`
- Test: `test/growth-storage.test.ts`

**Interfaces:**
- `const GROWTH_STORAGE_KEY = "rippleAquariumFishGrowth"`.
- `loadGrowthSnapshot(storage: Storage, now: number): { snapshot: FishGrowthSnapshot | null; status: "empty" | "loaded" | "recovered" | "unavailable" }`.
- `saveGrowthSnapshot(storage: Storage, snapshot: FishGrowthSnapshot): "saved" | "unavailable"`.
- `exportGrowthSnapshot(snapshot: FishGrowthSnapshot): string`.
- `clearGrowthSnapshot(storage: Storage): "cleared" | "unavailable"`.

- [ ] **Step 1: Write failing storage tests**

Use a fake `Storage` implementation. Test save/load round trips, rejection of malformed JSON, rejection of duplicate IDs and non-finite values, backup to `rippleAquariumFishGrowth.corrupt.<timestamp>` before recovery, unsupported future schema returning `recovered`, storage exceptions returning `unavailable`, and deterministic JSON export.

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `rtk npm test -- test/growth-storage.test.ts`

Expected: FAIL because storage functions are not defined.

- [ ] **Step 3: Implement schema validation and recovery**

Validate `schemaVersion === 1`, finite timestamps, non-empty unique IDs, known stages, finite non-negative ages, and boolean `active`. Treat invalid or unsupported snapshots as recoverable; preserve the raw value under a timestamped backup key before returning an empty snapshot.

- [ ] **Step 4: Implement safe writes and export**

Serialize with `JSON.stringify`, catch all storage exceptions, and never throw into the render loop. Export the same snapshot string with a trailing newline so the UI can download it.

- [ ] **Step 5: Run the focused test and verify it passes**

Run: `rtk npm test -- test/growth-storage.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit storage**

```bash
git add src/growth/storage.ts test/growth-storage.test.ts
git commit -m "feat: persist versioned fish growth snapshots"
```

### Task 4: Bind stable IDs to fish simulation and instance scaling

**Files:**
- Modify: `src/types.ts`
- Modify: `src/fish-school-simulation.ts`
- Modify: `src/fish/instanced-school-renderer.ts`
- Modify: `src/fish-renderer.ts`
- Modify: `src/aquarium/types.ts`
- Modify: `src/aquarium/species-catalog.ts`
- Test: `test/fish-growth-rendering.test.ts`

**Interfaces:**
- Extend `FishState` with `fishId: string`.
- Extend `SchoolHandle` with `getFishIds(): string[]` and `setGrowthSizes(sizes: readonly number[]): void`.
- Change `updateFishInstances(mesh, fish, sizeMultipliers?)` so omitted multipliers preserve current rendering behavior.

- [ ] **Step 1: Write failing identity and scale tests**

Test that `FishSchoolSimulation.reset` and `setCount` accept IDs supplied by the school adapter, that reducing and increasing a school does not reorder surviving IDs, and that an instance matrix uses the base render scale multiplied by the supplied per-index growth multiplier.

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `rtk npm test -- test/fish-growth-rendering.test.ts`

Expected: FAIL because `FishState.fishId` and the scaling argument are not implemented.

- [ ] **Step 3: Add ID assignment without changing boids behavior**

Keep the existing random position, velocity, and motion state logic. Add an optional `fishIds` parameter to `reset` and a `createFish` ID parameter; retain generated IDs only as a fallback for existing callers. Never use array index as a persisted ID.

- [ ] **Step 4: Add scale-aware instanced rendering**

In `updateFishInstances`, reuse `tmpScale` and multiply the existing base scale by `sizeMultipliers[i] ?? 1`. Keep curve deformation and orientation unchanged. Have schooling, clownfish, and starfish adapters expose their active IDs and update their instance matrices or mesh scales using the same ordered multiplier array.

- [ ] **Step 5: Run focused and existing simulation tests**

Run: `rtk npm test -- test/fish-growth-rendering.test.ts test/simulation.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit rendering identity support**

```bash
git add src/types.ts src/fish-school-simulation.ts src/fish/instanced-school-renderer.ts src/fish-renderer.ts src/aquarium/types.ts src/aquarium/species-catalog.ts test/fish-growth-rendering.test.ts
git commit -m "feat: bind stable fish ids to rendered instances"
```

### Task 5: Integrate registry lifecycle with aquarium manager and scene builder

**Files:**
- Modify: `src/aquarium/manager.ts`
- Modify: `src/aquarium/scene-builder.ts`
- Modify: `src/aquarium/species-catalog.ts`
- Modify: `src/aquarium/types.ts`
- Test: `test/aquarium-growth-integration.test.ts`

**Interfaces:**
- `createAquariumManager` creates one registry for the manager lifetime and exposes `getGrowthRegistry()` and `getGrowthStats(speciesId?: string)`.
- `SpeciesCreateDeps` receives the registry.
- `AquariumSceneHandle.update(time, dt)` advances schools and applies registry size multipliers to each school’s ordered IDs.

- [ ] **Step 1: Write failing manager integration tests**

Test initial preset activation creates exactly the configured active record counts; shrinking a fish count deactivates the youngest records; restoring the count reuses their IDs; style switching preserves IDs for shared species; `update` with positive `dt` ages active fish; manager disposal does not clear the registry.

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `rtk npm test -- test/aquarium-growth-integration.test.ts`

Expected: FAIL because the manager has no growth registry.

- [ ] **Step 3: Create and populate the registry during manager initialization**

Construct the registry before `buildAquariumScene`. On `init`, load/merge later in Task 6; for this task, activate records according to the descriptor before schools are built. Pass the registry through `SpeciesCreateDeps` and keep it alive across `switchStyle` rebuilds.

- [ ] **Step 4: Synchronize descriptor counts and school IDs**

Replace count-only school setup with registry activation/deactivation. When a school is rebuilt after GLB loading, pass the same ordered IDs into the replacement school. Keep existing descriptor change notifications and count clamping unchanged.

- [ ] **Step 5: Advance and apply growth in the scene update**

Advance the registry only when the caller provides a positive simulation `dt`; query each school’s IDs, map them to size multipliers, and pass the ordered array into the school renderer. Use multiplier 1 when a record is missing so rendering remains safe.

- [ ] **Step 6: Run integration and regression tests**

Run: `rtk npm test -- test/aquarium-growth-integration.test.ts test/aquarium-manager.test.ts test/simulation.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit manager integration**

```bash
git add src/aquarium/manager.ts src/aquarium/scene-builder.ts src/aquarium/species-catalog.ts src/aquarium/types.ts test/aquarium-growth-integration.test.ts
git commit -m "feat: integrate growth records with aquarium lifecycle"
```

### Task 6: Load/save lifecycle, autosave, and bilingual growth panel

**Files:**
- Modify: `src/main.ts`
- Modify: `src/aquarium/ui-panel.ts`
- Modify: `src/i18n.ts`
- Modify: `src/styles.css`
- Test: `test/growth-ui.test.ts`

**Interfaces:**
- Add manager methods `loadGrowth()`, `saveGrowth()`, `resetGrowth()`, `exportGrowth()`, `getGrowthSaveStatus()`, and `getGrowthStats(speciesId?: string)`.
- Add UI factory `createGrowthSection(manager, container)` or keep the section private to `createProjectPanel`, but it must consume only manager interfaces and not access registry internals.

- [ ] **Step 1: Write failing save lifecycle tests**

Test that `loadGrowth()` applies at most 24 hours of offline time, `saveGrowth()` reports storage failure without throwing, `resetGrowth()` requires the UI confirmation callback, and `exportGrowth()` returns the current snapshot string.

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `rtk npm test -- test/growth-ui.test.ts`

Expected: FAIL because manager save methods and translated growth labels are not present.

- [ ] **Step 3: Connect manager load/save methods**

On startup, load the snapshot before building the first visible scene, apply capped offline time, then reconcile records with the descriptor. Keep an in-memory registry when `localStorage` is unavailable. Mark the snapshot dirty after online updates and schedule a debounced save no more often than every 10 seconds.

- [ ] **Step 4: Add lifecycle event listeners**

Register `visibilitychange` and `pagehide` handlers in `main.ts` that call `manager.saveGrowth()` when hidden or leaving. Do not depend on asynchronous `beforeunload` work. Remove listeners in the app teardown path if one is introduced.

- [ ] **Step 5: Add translated panel content**

Add Chinese and English keys for growth title, juvenile/growing/adult labels, total/average fields, saved/saving/error states, export, reset, and confirmation text. Render summary counts by fish species and lazily render the expanded individual list to avoid creating hundreds of DOM nodes by default.

- [ ] **Step 6: Add panel interactions and styles**

Add native buttons/details controls for expand, export, and reset. Reset must use `window.confirm` (or the existing app confirmation abstraction if one exists), then call `manager.resetGrowth()` and re-render. Keep the existing species count sliders independent from the growth list.

- [ ] **Step 7: Run focused UI and full tests**

Run: `rtk npm test -- test/growth-ui.test.ts && rtk npm test`

Expected: all tests PASS.

- [ ] **Step 8: Commit the application integration**

```bash
git add src/main.ts src/aquarium/ui-panel.ts src/i18n.ts src/styles.css test/growth-ui.test.ts
git commit -m "feat: add fish growth persistence and panel"
```

### Task 7: Verify build, performance, and documentation

**Files:**
- Modify: `README.md`
- Modify: `README.en.md`
- Modify: `docs/superpowers/specs/2026-10-01-fish-growth-design.md` only if implementation decisions require an approved correction.

- [ ] **Step 1: Run the complete verification suite**

Run: `rtk npm test && rtk npm run typecheck && rtk npm run build`

Expected: all commands exit successfully with no TypeScript errors.

- [ ] **Step 2: Run the browser smoke checks**

Run: `rtk npm run dev`, open the app, verify that fish visibly grow, pause prevents growth, reload preserves IDs and age, hiding the tab saves, and corrupting the storage key recovers without a blank scene. Check both language settings and each existing aquarium preset.

- [ ] **Step 3: Check performance at maximum counts**

Use the default and coral-reef presets with their maximum fish counts. Confirm the growth panel is collapsed by default, only one registry update occurs per simulation frame, and the new size multipliers do not introduce avoidable per-frame allocations.

- [ ] **Step 4: Update user-facing documentation**

Document the growth timing, 24-hour offline cap, pause behavior, export/reset controls, and browser-only storage limitation in both README files. Do not claim weather or biodiversity features are implemented yet.

- [ ] **Step 5: Commit verification documentation**

```bash
git add README.md README.en.md
git commit -m "docs: document fish growth records"
```

## Self-review checklist

- Spec coverage: tasks 1–2 cover domain data and lifecycle; task 3 covers validation and recovery; task 4 covers stable IDs and rendering; task 5 covers scene/manager integration; task 6 covers offline loading, autosave, UI and i18n; task 7 covers regression, performance and documentation.
- Placeholder scan: no `TBD`, `TODO`, or unspecified “handle edge cases” steps remain.
- Type consistency: registry methods, storage signatures, manager methods, and school handle methods are named consistently across tasks.
- Scope: weather, new species, and broader biodiversity remain explicitly deferred to separate future specs.
