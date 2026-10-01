# SpongeBob Theme Content Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add procedural Squidward and Mr. Krabs characters, their themed props, low-amplitude idle animations, preset configuration, controls, and future interaction hooks without external assets.

**Architecture:** Add a self-contained `src/theme/` module that creates character and prop handles, updates animation parts, and exposes catalog metadata. The aquarium descriptor and scene builder consume theme entries through the existing object lifecycle; theme obstacles and clownfish avoidance zones are merged into existing scene calculations. Runtime theme settings stay separate from fish growth storage.

**Tech Stack:** TypeScript, Three.js 0.185, Vite, Vitest, shared low-poly geometries/materials, existing aquarium manager and scene builder.

## Global Constraints

- Characters are `squidward` and `mr-krabs`; props are `squidward-house` and `krusty-krab`.
- No external GLB, texture, audio, or network dependency is added.
- Character height stays between 15% and 22% of tank height; small-tank characters use 65%–75% scale.
- Squidward tentacles sway at low amplitude; Mr. Krabs claws alternate opening and closing.
- Theme objects are bottom-anchored, participate in obstacle/avoidance zones, and do not join fish boids or fish growth records.
- Theme updates allocate no per-frame arrays, colors, or Three.js objects.
- Theme creation failures fall back to simple geometry or skip only the failed prop.
- Existing pineapple house, SpongeBob/Patrick, fish, weather, ecology, growth storage, presets, and tests remain compatible.

---

### Task 1: Add theme types, catalog, and descriptor support

**Files:**
- Create: `src/theme/types.ts`
- Create: `src/theme/catalog.ts`
- Modify: `src/aquarium/types.ts`
- Modify: `src/aquarium/manager.ts`
- Test: `test/theme-catalog.test.ts`

**Interfaces:**
- Export `ThemeCharacterId = "squidward" | "mr-krabs"`.
- Export `ThemePropId = "squidward-house" | "krusty-krab"`.
- Export `ThemeObjectHandle { group: THREE.Group; update(time, dt): void; resize(halfSize): void; dispose(): void }`.
- Export `ThemeEntry { id: ThemeCharacterId | ThemePropId; kind: "character" | "prop"; enabled: boolean; position: Vec3; rotationY: number; scale: number }`.
- Extend `DecorItem.asset` with the four theme IDs while retaining current assets.
- Extend `AquariumDescriptor` with optional `theme?: ThemeEntry[]` and normalize missing theme to an empty list.
- Add manager methods `getThemeEntries()`, `setThemeEnabled(id, enabled)`, `setThemeAnimationEnabled(enabled)`, `setThemeScale(id, scale)`.

- [ ] **Step 1: Write failing catalog and compatibility tests**

Assert the four IDs and bilingual labels exist, default theme entries are valid, missing `theme` fields normalize without throwing, and existing descriptors containing only pineapple/SpongeBob decor still clone and build.

- [ ] **Step 2: Run focused tests to verify failure**

Run: `rtk npm test -- test/theme-catalog.test.ts`

Expected: FAIL because theme types and catalog exports do not exist.

- [ ] **Step 3: Implement theme types and catalog defaults**

Define default positions relative to the current expanded tank: Squidward on the left rear reef side and Mr. Krabs on the right rear bottom side. Define smaller prop scales for the small-tank preset. Keep labels in Chinese and English and keep theme settings separate from growth snapshots.

- [ ] **Step 4: Implement manager theme state methods**

Clone theme entries with descriptors, update enabled/scale state without mutating shared presets, notify existing `change` listeners, and return false for unknown IDs. Keep animation enabled as a runtime scene setting.

- [ ] **Step 5: Run focused and existing manager tests**

Run: `rtk npm test -- test/theme-catalog.test.ts test/aquarium-manager.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit theme data contracts**

```bash
git add src/theme/types.ts src/theme/catalog.ts src/aquarium/types.ts src/aquarium/manager.ts test/theme-catalog.test.ts
git commit -m "feat: add theme content data contracts"
```

### Task 2: Create procedural Squidward and Mr. Krabs characters

**Files:**
- Create: `src/theme/characters.ts`
- Create: `src/theme/animation.ts`
- Test: `test/theme-characters.test.ts`

**Interfaces:**
- Export `createThemeCharacter(id: ThemeCharacterId, options: { scale: number; animationEnabled: boolean }): ThemeObjectHandle`.
- Export `createSquidwardParts(group): SquidwardAnimationParts` and `createMrKrabsParts(group): MrKrabsAnimationParts`.
- Export `updateSquidwardAnimation(parts, time, enabled): void` and `updateMrKrabsAnimation(parts, time, enabled): void`.

- [ ] **Step 1: Write failing character and animation tests**

Assert both character factories return named groups with body, eyes, and movable parts; animation-enabled updates change tentacle or claw rotations; disabled updates restore the static pose; repeated `dispose` is safe.

- [ ] **Step 2: Run focused tests to verify failure**

Run: `rtk npm test -- test/theme-characters.test.ts`

Expected: FAIL because the theme character module does not exist.

- [ ] **Step 3: Implement shared low-poly geometry and materials**

Create simple `SphereGeometry`, `CapsuleGeometry`, `ConeGeometry`, and `BoxGeometry` combinations with flat-shaded shared materials. Build Squidward’s gray-blue head/body, purple tentacle accents, eyes, and mouth; build Mr. Krabs’ red body, blue clothing, yellow eyes, and red claws. Store part references in `userData` or typed animation-part objects rather than querying the scene every frame.

- [ ] **Step 4: Implement no-allocation idle animation**

Use sine waves and preallocated part references: Squidward tentacles sway at different phases and body yaw shifts slightly; Mr. Krabs claws alternate opening/closing and body pitch shifts occasionally. When disabled, set all animated parts to their recorded static rotations.

- [ ] **Step 5: Run focused and type tests**

Run: `rtk npm test -- test/theme-characters.test.ts && rtk npm run typecheck`

Expected: PASS.

- [ ] **Step 6: Commit character models**

```bash
git add src/theme/characters.ts src/theme/animation.ts test/theme-characters.test.ts
git commit -m "feat: add procedural theme characters"
```

### Task 3: Create theme props, collision zones, and fallback behavior

**Files:**
- Create: `src/theme/props.ts`
- Modify: `src/aquarium/scene-builder.ts`
- Modify: `src/clownfish-school.ts`
- Test: `test/theme-props.test.ts`

**Interfaces:**
- Export `createThemeProp(id: ThemePropId, options: { scale: number }): ThemeObjectHandle`.
- Export `getThemePropCollision(id, position, scale): Obstacle`.
- Export `getThemeAvoidanceZone(id, position, scale): ExclusionZone`.
- Extend scene-builder collision calculations to consume theme entries along with existing decor.

- [ ] **Step 1: Write failing prop and collision tests**

Assert both props create named groups, return positive collision radii, generate stable obstacle/exclusion records, and can be disposed twice. Assert creating an unknown prop returns null or the documented fallback.

- [ ] **Step 2: Run focused tests to verify failure**

Run: `rtk npm test -- test/theme-props.test.ts`

Expected: FAIL because theme prop functions do not exist.

- [ ] **Step 3: Implement Squidward house and Krusty Krab props**

Build the Squidward prop from a stylized stone head, small door and window; build the Krusty Krab prop from a low counter, sign, and flag. Reuse shared materials within the module and keep total geometry small.

- [ ] **Step 4: Merge obstacle and avoidance zones**

Add enabled theme props/characters to `computeObstacles`, `computeExclusionZones`, and `computeClownfishAvoidanceZones`. Give characters bottom collision footprints and props slightly wider clearance. Keep coral/anemone anchors available to clownfish and never mask the entire reef region.

- [ ] **Step 5: Implement fallback and cleanup**

Catch geometry creation failures, return a basic box/sphere fallback for characters, skip only a failed prop, and dispose shared resources once. Preserve existing pineapple/SpongeBob behavior.

- [ ] **Step 6: Run focused and scene regressions**

Run: `rtk npm test -- test/theme-props.test.ts test/reef-variants.test.ts test/aquarium-growth-integration.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit props and collision integration**

```bash
git add src/theme/props.ts src/aquarium/scene-builder.ts src/clownfish-school.ts test/theme-props.test.ts
git commit -m "feat: add themed props and collision zones"
```

### Task 4: Integrate theme object lifecycle and preset-specific placement

**Files:**
- Modify: `src/aquarium/presets.ts`
- Modify: `src/aquarium/scene-builder.ts`
- Modify: `src/aquarium/types.ts`
- Test: `test/theme-presets.test.ts`

**Interfaces:**
- Extend `AquariumSceneHandle` with `setThemeEnabled`, `setThemeAnimationEnabled`, and `setThemeScale`.
- Scene builder receives `themeEntries` and creates `ThemeObjectHandle` instances after base decor.
- Scene update calls every theme handle’s `update(time, dt)`; resize calls `resize(halfSize)`; dispose calls `dispose()`.

- [ ] **Step 1: Write failing preset and lifecycle tests**

Assert default preset enables both characters and both props, coral-reef/deep-sea use reduced prop scale, small-tank uses 65%–75% character scale and hides or disables large props, and rebuilding/switching presets does not duplicate theme objects.

- [ ] **Step 2: Run focused tests to verify failure**

Run: `rtk npm test -- test/theme-presets.test.ts`

Expected: FAIL because presets and scene handles do not expose theme entries.

- [ ] **Step 3: Add theme entries to all presets**

Use the catalog helper to create descriptor theme arrays. Keep positions inside each preset’s half-size, place Squidward left/rear and Mr. Krabs right/rear, and apply the small-tank fallback rule.

- [ ] **Step 4: Build and update theme handles**

Create handles only for enabled entries, name groups `Theme-squidward`, `Theme-mr-krabs`, `Theme-squidward-house`, and `Theme-krusty-krab`, and keep them in a map keyed by ID. Toggle visibility without recreating resources where possible.

- [ ] **Step 5: Run focused and full scene tests**

Run: `rtk npm test -- test/theme-presets.test.ts test/aquarium-manager.test.ts test/aquarium-growth-integration.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit scene and preset integration**

```bash
git add src/aquarium/presets.ts src/aquarium/scene-builder.ts src/aquarium/types.ts test/theme-presets.test.ts
git commit -m "feat: integrate theme objects with aquarium presets"
```

### Task 5: Add theme controls, translations, and future interaction hooks

**Files:**
- Modify: `src/aquarium/manager.ts`
- Modify: `src/aquarium/ui-panel.ts`
- Modify: `src/i18n.ts`
- Modify: `src/styles.css`
- Modify: `src/main.ts`
- Test: `test/theme-controls.test.ts`

**Interfaces:**
- Manager methods: `setThemeEnabled(id, enabled): boolean`, `setThemeAnimationEnabled(enabled): void`, `setThemeScale(id, scale): boolean`, `getThemeEntries(): ThemeEntry[]`.
- Add optional `onThemeInteraction(id, anchor): void` callback to the scene handle without wiring click behavior yet.

- [ ] **Step 1: Write failing UI/control tests**

Assert toggling character/prop visibility, animation, and scale updates the scene and descriptor state; unknown IDs return false; theme labels switch between Chinese and English; existing fish/weather/ecology controls remain rendered.

- [ ] **Step 2: Run focused tests to verify failure**

Run: `rtk npm test -- test/theme-controls.test.ts`

Expected: FAIL because theme controls and translations do not exist.

- [ ] **Step 3: Implement manager-to-scene controls**

Update descriptor theme entries and delegate visibility/animation/scale to the live scene handle. Notify existing change listeners so the panel rerenders without resetting fish growth or weather state.

- [ ] **Step 4: Add bilingual theme panel**

Add a “海绵宝宝主题 / SpongeBob Theme” section with character toggles, prop toggles, animation checkbox, and per-character scale sliders. Keep controls compact and hide large-prop sliders when the small-tank preset has them disabled.

- [ ] **Step 5: Add future interaction anchors**

Expose character interaction anchors through the theme handle and scene map, but do not add click listeners or dialogs. Keep the callback optional and inert by default.

- [ ] **Step 6: Run focused and full tests**

Run: `rtk npm test -- test/theme-controls.test.ts && rtk npm test && rtk npm run typecheck`

Expected: all tests and typecheck PASS.

- [ ] **Step 7: Commit controls and hooks**

```bash
git add src/aquarium/manager.ts src/aquarium/ui-panel.ts src/i18n.ts src/styles.css src/main.ts test/theme-controls.test.ts
git commit -m "feat: add SpongeBob theme controls and interaction hooks"
```

### Task 6: Documentation, browser verification, and final regression

**Files:**
- Modify: `README.md`
- Modify: `README.en.md`
- Test: existing full suite; no new source test file required beyond Tasks 1–5.

- [ ] **Step 1: Run complete automated verification**

Run: `rtk npm test && rtk npm run typecheck && rtk npm run build`

Expected: all tests, typecheck, and build pass; an existing large-chunk warning may remain non-blocking.

- [ ] **Step 2: Run browser smoke checks**

Run: `rtk npm run dev`, open the app, verify both characters and props in the default preset, toggle each visibility control, disable/enable animation, resize the tank, switch all presets, and confirm no duplicate theme groups or console errors.

- [ ] **Step 3: Update documentation**

Document the new characters, themed props, idle animations, controls, procedural/no-external-asset approach, small-tank fallback, and future-interaction boundary in both README files. State that clicking/dialog/mini-game behavior is reserved for a later feature.

- [ ] **Step 4: Check repository hygiene**

Run: `rtk git diff --check && rtk git status --short`

Expected: no whitespace errors and a clean worktree after the final commit.

- [ ] **Step 5: Commit documentation**

```bash
git add README.md README.en.md
git commit -m "docs: document SpongeBob theme content"
```

## Self-review checklist

- Spec coverage: Task 1 covers types/catalog; Task 2 characters/animation; Task 3 props/collision/fallback; Task 4 presets and lifecycle; Task 5 controls and future hooks; Task 6 documentation and verification.
- Placeholder scan: no `TBD`, `TODO`, or unspecified implementation steps remain.
- Type consistency: theme IDs, handles, manager methods, scene methods, and catalog entries are defined before later tasks consume them.
- Scope: no external assets, click gameplay, dialogue, tasks, collectibles, or mini-games are included in this release.
