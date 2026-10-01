# Weather, Fish Species, and Ecology Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add four-mode weather, three procedural fish species, four ecological organisms, habitat layers, and a larger default aquarium while preserving growth saves and existing species behavior.

**Architecture:** Keep the existing manager/scene/catalog/school lifecycle and add isolated `weather`, `ecology`, `procedural species`, and `habitat` modules. Weather emits pure effect multipliers; habitat emits pure spatial regions; species and ecology factories consume those values and expose existing `SchoolHandle` lifecycle methods. Existing `FishGrowthRegistry` receives only a runtime growth multiplier and keeps its snapshot schema unchanged.

**Tech Stack:** TypeScript, Three.js 0.185, Vite, Vitest, instanced meshes, existing GLSL water simulation.

## Global Constraints

- Default aquarium half-size becomes `{ x: 14, y: 8, z: 11 }`, or complete dimensions `28 × 16 × 22`.
- Weather kinds are `clear`, `cloudy`, `rain`, and `storm`; transitions last 8 seconds.
- Weather durations are 90s, 60s, 45s, and 30s respectively; paused simulation pauses weather time.
- New fish are `angelfish`, `blue-tang`, and `pufferfish`, using procedural geometry and existing stable IDs/growth scaling.
- New ecology entries are `anemone`, `urchin`, `shell`, and `jellyfish`; no food chain, death, breeding, or water-quality simulation is added.
- Default weather multipliers are: clear `(light 1, fish 1, growth 1, ripple 1)`, cloudy `(0.75, 0.92, 0.98, 1.10)`, rain `(0.60, 0.82, 0.95, 1.60)`, storm `(0.45, 0.65, 0.85, 2.20)`.
- Existing fish, growth saves, exports, reset behavior, small-tank preset, boids tests, and water tests must remain compatible.
- Reuse shared geometries/materials and instanced rendering; do not add remote model dependencies.

---

### Task 1: Add pure habitat layout and larger default bounds

**Files:**
- Create: `src/aquarium/habitat.ts`
- Modify: `src/aquarium/presets.ts`
- Modify: `src/config.ts`
- Modify: `src/camera-rig.ts`
- Modify: `src/scene-setup.ts`
- Test: `test/habitat.test.ts`

**Interfaces:**
- Create `HabitatLayer = "upper" | "middle" | "lower" | "reef"`.
- Create `HabitatRegion { layer: HabitatLayer; min: Vec3; max: Vec3 }`.
- Export `createHabitatLayout(halfSize: Vec3): Readonly<Record<HabitatLayer, HabitatRegion>>`.
- Export `sampleHabitatPoint(region, random, margin): Vec3`.

- [ ] **Step 1: Write failing layout tests**

Assert the default preset uses `{ x: 14, y: 8, z: 11 }`, upper bounds cover `y=2..7.2`, middle covers `y=-2..2`, lower covers `y=-7.2..-2`, and every region remains inside arbitrary resized half-sizes. Assert sampled points stay within the selected region and margin.

- [ ] **Step 2: Run the focused test to verify failure**

Run: `rtk npm test -- test/habitat.test.ts`

Expected: FAIL because `createHabitatLayout` and the new default size do not exist.

- [ ] **Step 3: Implement layout and update size consumers**

Use normalized vertical fractions for non-default sizes, clamp layer boundaries to the tank interior, and keep reef regions on both bottom sides. Update default config/preset size, camera default framing, directional-light shadow bounds, bubble start positions, and any hard-coded water world-size assumptions to use the current half-size.

- [ ] **Step 4: Run focused and existing size tests**

Run: `rtk npm test -- test/habitat.test.ts test/aquarium-manager.test.ts`

Expected: PASS; the small-tank preset remains unchanged and resize clamping still works.

- [ ] **Step 5: Commit the habitat foundation**

```bash
git add src/aquarium/habitat.ts src/aquarium/presets.ts src/config.ts src/camera-rig.ts src/scene-setup.ts test/habitat.test.ts
git commit -m "feat: add habitat layers and expand default aquarium"
```

### Task 2: Implement weather controller and effect mapping

**Files:**
- Create: `src/weather/types.ts`
- Create: `src/weather/controller.ts`
- Create: `src/weather/effects.ts`
- Test: `test/weather-controller.test.ts`

**Interfaces:**
- Export `WeatherKind`, `WeatherState`, and `WeatherEffects` from `src/weather/types.ts`.
- Export `createWeatherController(options?: { now?: () => number; random?: () => number }): WeatherController`.
- `WeatherController.update(dt: number): WeatherState`.
- `WeatherController.setWeather(kind: WeatherKind): void`.
- `WeatherController.setAutoCycle(enabled: boolean): void`.
- `WeatherController.getState(): WeatherState` and `getEffects(): WeatherEffects`.
- Export `getWeatherEffects(kind: WeatherKind): WeatherEffects` from `effects.ts`.

- [ ] **Step 1: Write failing weather tests**

Test default clear state, automatic sequence and durations, manual switch resetting the timer, 8-second transition progress, auto-cycle disable, paused `dt=0`, and exact effect multipliers for all four kinds. Use a deterministic random source for lightning chance.

- [ ] **Step 2: Run focused tests to verify failure**

Run: `rtk npm test -- test/weather-controller.test.ts`

Expected: FAIL because the weather modules do not exist.

- [ ] **Step 3: Implement pure effect mapping**

Return immutable effect objects for the four weather kinds. Keep `growthRateMultiplier` separate from lighting and ripple multipliers so the scene can pass it only to `FishGrowthRegistry.advanceOnline`.

- [ ] **Step 4: Implement controller transitions and cycle**

Track current and target weather, elapsed transition time, remaining duration, and auto-cycle. Interpolate numeric effects over 8 seconds; when a weather duration expires, advance in the fixed order clear → cloudy → rain → storm → clear. With auto-cycle disabled, keep the selected state and clamp remaining time at zero.

- [ ] **Step 5: Run focused tests and commit**

Run: `rtk npm test -- test/weather-controller.test.ts`

Expected: PASS.

```bash
git add src/weather/types.ts src/weather/controller.ts src/weather/effects.ts test/weather-controller.test.ts
git commit -m "feat: add weather controller and effect mappings"
```

### Task 3: Add procedural fish models and species catalog entries

**Files:**
- Create: `src/fish/procedural-species.ts`
- Modify: `src/fish/model-loader.ts`
- Modify: `src/fish/instanced-school-renderer.ts`
- Modify: `src/aquarium/species-catalog.ts`
- Modify: `src/aquarium/types.ts`
- Test: `test/procedural-species.test.ts`

**Interfaces:**
- Export `ProceduralFishKey = "angelfish" | "blue-tang" | "pufferfish"`.
- Export `createProceduralFishModel(key: ProceduralFishKey): FishModelInstance`.
- Extend `FishCatalogEntry` with `modelKey`, `habitatLayer`, `defaultSpeedScale`, and `growthScale` fields while keeping current entries valid.
- Add catalog entries: angelfish default 12/max 60, blue-tang default 10/max 50, pufferfish default 6/max 24.

- [ ] **Step 1: Write failing geometry and metadata tests**

Assert each model key creates non-empty geometry/material resources, each catalog entry has the agreed names/counts/layer, and unknown procedural keys are rejected. Test that disposing returned geometry/material does not throw.

- [ ] **Step 2: Run focused tests to verify failure**

Run: `rtk npm test -- test/procedural-species.test.ts`

Expected: FAIL because the procedural factory and catalog entries do not exist.

- [ ] **Step 3: Implement shared procedural meshes**

Build low-poly body geometry with reusable buffers: flattened body and fins for angelfish, oval body/tail for blue-tang, and rounded body/eyes/fins for pufferfish. Use one material per species with flat-shaded color variants. Return the existing `FishModelInstance` shape so the instanced renderer can reuse curve attributes and growth scaling.

- [ ] **Step 4: Wire model lookup and catalog metadata**

In `createFishModelInstanceByKey`, route the three new keys to the procedural factory. Update `createFishSchool` to create boids schools using each entry’s model key and habitat layer; pass stable IDs from the existing growth registry exactly as for current fish.

- [ ] **Step 5: Run focused, existing rendering and manager tests**

Run: `rtk npm test -- test/procedural-species.test.ts test/fish-growth-rendering.test.ts test/aquarium-manager.test.ts`

Expected: PASS; existing cartoon/koi/clownfish/starfish paths remain unchanged.

- [ ] **Step 6: Commit procedural species**

```bash
git add src/fish/procedural-species.ts src/fish/model-loader.ts src/fish/instanced-school-renderer.ts src/aquarium/species-catalog.ts src/aquarium/types.ts test/procedural-species.test.ts
git commit -m "feat: add procedural angelfish blue tang and pufferfish"
```

### Task 4: Apply habitat constraints to fish schools

**Files:**
- Modify: `src/fish-school-simulation.ts`
- Modify: `src/aquarium/species-catalog.ts`
- Modify: `src/aquarium/scene-builder.ts`
- Modify: `src/aquarium/types.ts`
- Test: `test/habitat-fish-school.test.ts`

**Interfaces:**
- Extend `SpeciesCreateDeps` with `habitatLayout`.
- Extend `FishSchoolSimulation` options with optional `allowedRegion?: HabitatRegion` and add `setAllowedRegion(region): void`.
- `createBoidsSchool` receives the fish entry’s `habitatLayer` and clamps positions/steering to that region.

- [ ] **Step 1: Write failing habitat behavior tests**

Create a simulation with a middle region and assert reset, update, resize, and `setCount` keep every fish inside the region. Assert a school without a region retains existing full-tank behavior.

- [ ] **Step 2: Run focused tests to verify failure**

Run: `rtk npm test -- test/habitat-fish-school.test.ts`

Expected: FAIL because simulations have no allowed-region constraint.

- [ ] **Step 3: Implement region-aware spawn and boundary steering**

Sample new positions from the region, use region min/max instead of tank bounds for boundary avoidance, and clamp surviving positions on resize. Keep obstacle avoidance and boids neighbor logic unchanged.

- [ ] **Step 4: Pass layout through scene dependencies**

Compute layout once per scene build, pass it into each species factory, and update it on resize. Give old species explicit full-tank or existing behavior regions so current presets do not unexpectedly change.

- [ ] **Step 5: Run focused and regression tests**

Run: `rtk npm test -- test/habitat-fish-school.test.ts test/simulation.test.ts test/aquarium-growth-integration.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit habitat-aware schools**

```bash
git add src/fish-school-simulation.ts src/aquarium/species-catalog.ts src/aquarium/scene-builder.ts src/aquarium/types.ts test/habitat-fish-school.test.ts
git commit -m "feat: constrain fish schools to habitat layers"
```

### Task 5: Add ecology catalog and procedural organisms

**Files:**
- Create: `src/ecology/types.ts`
- Create: `src/ecology/catalog.ts`
- Create: `src/ecology/school.ts`
- Modify: `src/aquarium/types.ts`
- Modify: `src/aquarium/scene-builder.ts`
- Test: `test/ecology.test.ts`

**Interfaces:**
- Export `EcologyKind = "anemone" | "urchin" | "shell" | "jellyfish"`.
- Export `EcologyEntry { speciesId: EcologyKind; count: number }` and `EcologyMeta`.
- Export `ECOLOGY_CATALOG`, `getEcologyMeta`, and `createEcologySchool(kind, count, deps): SchoolHandle | null`.
- Extend `AquariumDescriptor` with optional `ecology?: EcologyEntry[]`, defaulting to an empty list for old presets.
- Extend `AquariumSceneHandle` and `AquariumManager` with ecology count/list methods parallel to plant methods.

- [ ] **Step 1: Write failing ecology tests**

Assert catalog metadata, count clamping, region placement, and lifecycle for all four organisms. Assert anemones use reef positions, urchins/shells use lower positions, and jellyfish use upper/middle positions. Assert shared resources are disposed once.

- [ ] **Step 2: Run focused tests to verify failure**

Run: `rtk npm test -- test/ecology.test.ts`

Expected: FAIL because ecology types and factories do not exist.

- [ ] **Step 3: Implement shared procedural resources**

Use instanced meshes and pooled animation state: tentacle curves for anemones, sphere-plus-spikes for urchins, shell geometry with color/yaw variants, and transparent dome-plus-tentacle meshes for jellyfish. Update positions with reusable vectors and no per-frame arrays.

- [ ] **Step 4: Wire ecology into scene lifecycle**

Create ecology schools after habitat layout is available, add them to the root, update them each frame, resize them with the tank, expose count controls, and dispose them with the scene. Truncate requested counts to catalog capacity without changing fish records.

- [ ] **Step 5: Run focused and scene regression tests**

Run: `rtk npm test -- test/ecology.test.ts test/aquarium-growth-integration.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit ecology organisms**

```bash
git add src/ecology src/aquarium/types.ts src/aquarium/scene-builder.ts test/ecology.test.ts
git commit -m "feat: add procedural marine ecology organisms"
```

### Task 6: Add coral/seaweed variants and clownfish reef habitats

**Files:**
- Modify: `src/coral-reef.ts`
- Modify: `src/aquarium/species-catalog.ts`
- Modify: `src/clownfish-school.ts`
- Modify: `src/aquarium/scene-builder.ts`
- Test: `test/reef-variants.test.ts`

**Interfaces:**
- Extend coral rebuild options with `variantSeed` and preserve growth-array behavior.
- Add deterministic `createReefVariant(index, seed): "branch" | "brain" | "plate"`.
- Extend clownfish dependencies with anemone positions in addition to coral reef positions.

- [ ] **Step 1: Write failing variant and habitat tests**

Assert the same seed produces the same coral variants, different indices produce more than one shape, existing growth values survive rebuilds, and clownfish can select both coral and anemone positions while respecting avoidance zones.

- [ ] **Step 2: Run focused tests to verify failure**

Run: `rtk npm test -- test/reef-variants.test.ts`

Expected: FAIL because variants and anemone habitat are not defined.

- [ ] **Step 3: Implement deterministic coral and seaweed variation**

Reuse the existing coral resources where possible, vary scale/rotation/material tint by seeded variant, and keep growth interpolation independent of the visual variant. Add seeded height/color/phase values to seaweed instances.

- [ ] **Step 4: Add reef habitat anchors**

Collect visible coral and anemone anchors from the scene, expose them to clownfish creation, and fall back to coral-only behavior when no anemone exists. Keep existing obstacle avoidance and removal behavior.

- [ ] **Step 5: Run focused and existing clownfish/coral tests**

Run: `rtk npm test -- test/reef-variants.test.ts test/aquarium-manager.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit reef diversity**

```bash
git add src/coral-reef.ts src/aquarium/species-catalog.ts src/clownfish-school.ts src/aquarium/scene-builder.ts test/reef-variants.test.ts
git commit -m "feat: diversify reef visuals and clownfish habitats"
```

### Task 7: Integrate weather with scene, growth, water, and controls

**Files:**
- Modify: `src/aquarium/manager.ts`
- Modify: `src/aquarium/scene-builder.ts`
- Modify: `src/water-surface.ts`
- Modify: `src/main.ts`
- Modify: `src/aquarium/types.ts`
- Modify: `src/i18n.ts`
- Modify: `src/aquarium/ui-panel.ts`
- Modify: `src/styles.css`
- Test: `test/weather-integration.test.ts`

**Interfaces:**
- Add manager methods `getWeatherState()`, `setWeather(kind)`, `setWeatherAutoCycle(enabled)`, and `getWeatherEffects()`.
- Add scene methods `setWeatherEffects(effects)` and `getWeatherState()`.
- Add water surface setting `rippleMultiplier` without changing existing shader defaults.

- [ ] **Step 1: Write failing integration tests**

Test manual weather updates, auto-cycle toggles, effect application to lighting/water settings, fish speed settings, growth multiplier forwarding, and paused updates. Assert `getWeatherState()` is stable and serializable for UI use.

- [ ] **Step 2: Run focused tests to verify failure**

Run: `rtk npm test -- test/weather-integration.test.ts`

Expected: FAIL because manager and scene have no weather methods.

- [ ] **Step 3: Add weather controller to manager/scene**

Create one controller per manager, update it from the existing simulation clock, and apply interpolated effects to the current scene. Keep weather runtime-only; do not alter growth snapshot schema.

- [ ] **Step 4: Apply visual and behavioral effects**

Scale light intensity, background color, water ripple settings, boids speed settings, and growth rate using reusable base values. Add pooled rain impacts and a throttled lightning flash for rain/storm without allocating per frame.

- [ ] **Step 5: Add bilingual weather controls**

Render current weather, remaining seconds, auto-cycle checkbox, weather select, and immediate switch button. Re-render controls on weather change and keep existing language switching behavior.

- [ ] **Step 6: Run focused and full tests**

Run: `rtk npm test -- test/weather-integration.test.ts && rtk npm test && rtk npm run typecheck`

Expected: all tests and typecheck PASS.

- [ ] **Step 7: Commit weather integration**

```bash
git add src/aquarium/manager.ts src/aquarium/scene-builder.ts src/water-surface.ts src/main.ts src/aquarium/types.ts src/i18n.ts src/aquarium/ui-panel.ts src/styles.css test/weather-integration.test.ts
git commit -m "feat: integrate weather effects and controls"
```

### Task 8: Add complete presets, capacity controls, documentation, and final verification

**Files:**
- Modify: `src/aquarium/presets.ts`
- Modify: `src/aquarium/manager.ts`
- Modify: `src/aquarium/ui-panel.ts`
- Modify: `src/i18n.ts`
- Modify: `README.md`
- Modify: `README.en.md`
- Test: `test/ecosystem-presets.test.ts`

- [ ] **Step 1: Write failing preset tests**

Assert default descriptor size, approximately 150 default fish after adding new species, ecology entries and counts, all existing style descriptors remain valid, and small-tank counts stay within their original compact limits.

- [ ] **Step 2: Run focused tests to verify failure**

Run: `rtk npm test -- test/ecosystem-presets.test.ts`

Expected: FAIL because presets and UI catalog lists do not include the new content.

- [ ] **Step 3: Update presets and count controls**

Add the three fish and four ecology entries to appropriate styles, keeping small-tank density low. Extend size slider limits and add ecology count controls. Use existing volume clamping and catalog maxima.

- [ ] **Step 4: Run full automated verification**

Run: `rtk npm test && rtk npm run typecheck && rtk npm run build`

Expected: all tests, typecheck, and build pass; the existing large-chunk warning may remain non-blocking.

- [ ] **Step 5: Run browser smoke checks**

Run: `rtk npm run dev`, open the app, switch each weather manually, let the cycle run, add/remove all new fish and ecology types, resize the tank, switch presets, reload growth data, and verify no object escapes its habitat. Confirm the small-tank preset remains usable.

- [ ] **Step 6: Update documentation**

Document new weather controls, fish species, ecology entries, default dimensions, habitat layers, capacity behavior, and performance fallback in both README files. State that food chain, water quality, breeding, and death are not part of this release.

- [ ] **Step 7: Commit the release integration**

```bash
git add src/aquarium/presets.ts src/aquarium/manager.ts src/aquarium/ui-panel.ts src/i18n.ts README.md README.en.md test/ecosystem-presets.test.ts
git commit -m "feat: ship expanded aquarium ecosystem presets"
```

## Self-review checklist

- Spec coverage: Task 1 covers habitat and expansion; Task 2 weather core; Task 3 new fish; Task 4 habitat constraints; Task 5 ecology; Task 6 reef diversity; Task 7 weather integration; Task 8 presets, docs, and final verification.
- Placeholder scan: no TBD, TODO, or unspecified implementation steps remain.
- Type consistency: `WeatherEffects`, `HabitatRegion`, `ProceduralFishKey`, `EcologyEntry`, and manager/scene methods are defined before use by later tasks.
- Scope: no food chain, water quality, breeding, death, remote assets, or cloud synchronization are included.
