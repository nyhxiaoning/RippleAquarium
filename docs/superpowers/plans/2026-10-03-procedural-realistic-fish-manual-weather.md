# 程序化真实鱼类与手动天气控制实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将神仙鱼、蓝吊、河豚升级为平滑且具真实比例的纯程序化 Three.js 模型，并把天气改为晴/雨/雪/阴四个手动按钮。

**Architecture:** 保留现有 `FishModelInstance`、`InstancedMesh` 与成长缩放管线，只重写程序鱼几何的细节和材质分区。天气控制器移除自动循环状态，天气效果新增雪强度；独立的降雪粒子效果挂到水族馆场景根节点，由 `setWeatherEffects` 更新强度和边界。

**Tech Stack:** TypeScript 6、Three.js 0.185、Vite、Vitest、现有 `AquariumManager`/`AquariumSceneHandle`。

## Global Constraints

- 不引入外部 `.glb` 鱼类资源；新增鱼类必须由 Three.js 程序几何构造。
- 保留现有 `InstancedMesh`、鱼群运动、成长缩放与 `disposeFishMesh` 生命周期。
- 天气只允许 `clear`、`rain`、`snow`、`cloudy`；没有自动循环或随机切换。
- 天气按钮必须可访问，当前模式使用 `aria-pressed="true"` 表示。
- 所有测试和脚本命令使用 `rtk` 前缀。

---

### Task 1: 收敛天气领域模型为四种手动模式

**Files:**
- Modify: `src/weather/types.ts`
- Modify: `src/weather/effects.ts`
- Modify: `src/weather/controller.ts`
- Modify: `src/aquarium/types.ts`
- Modify: `src/aquarium/manager.ts`
- Test: `test/weather-controller.test.ts`
- Test: `test/weather-integration.test.ts`

**Interfaces:**
- `WeatherKind = "clear" | "rain" | "snow" | "cloudy"`。
- `WeatherEffects` 新增 `snowIntensity: number`。
- `WeatherState` 只保留 `kind`、`progress`、`remainingSeconds`；不再有 `autoCycle`。
- `WeatherController` 暴露 `update(dt)`、`setWeather(kind)`、`getState()`、`getEffects()`，移除 `setAutoCycle`。
- `AquariumManager` 保留 `setWeather(kind)`，移除 `setWeatherAutoCycle`。

- [ ] **Step 1: Write the failing tests**

```ts
expect(getWeatherEffects("snow")).toMatchObject({ snowIntensity: 0.55, rainIntensity: 0 });
expect(createWeatherController().getState()).toEqual({
  kind: "clear",
  progress: 1,
  remainingSeconds: 0,
});
const controller = createWeatherController();
controller.setWeather("snow");
controller.update(120);
expect(controller.getState().kind).toBe("snow");
```

- [ ] **Step 2: Run tests to verify failure**

Run: `rtk npm test -- --run test/weather-controller.test.ts test/weather-integration.test.ts`

Expected: FAIL because `snow` is not a `WeatherKind`, the state still exposes `autoCycle`, and the controller still cycles.

- [ ] **Step 3: Implement the minimal domain change**

Update `src/weather/types.ts` to use the four kinds and add `snowIntensity`. Replace the controller timer loop with a transition-only update:

```ts
function update(dt: number): WeatherState {
  const seconds = finiteDelta(dt);
  if (seconds > 0 && progress < 1) {
    progress = clamp01(progress + seconds / WEATHER_TRANSITION_SECONDS);
  }
  return state();
}
```

Set `remainingSeconds` to `0` for every mode, remove `WEATHER_KINDS` cycling and `setAutoCycle`, and forward the new state from `manager.ts`.

- [ ] **Step 4: Run focused tests**

Run: `rtk npm test -- --run test/weather-controller.test.ts test/weather-integration.test.ts`

Expected: PASS, including the assertion that 120 seconds leaves the selected mode unchanged.

- [ ] **Step 5: Commit**

```bash
rtk git add src/weather/types.ts src/weather/effects.ts src/weather/controller.ts src/aquarium/types.ts src/aquarium/manager.ts test/weather-controller.test.ts test/weather-integration.test.ts
rtk git commit -m "feat: make weather modes manual"
```

### Task 2: Add snow effects and scene integration

**Files:**
- Create: `src/weather/precipitation.ts`
- Modify: `src/aquarium/scene-builder.ts`
- Modify: `src/weather/effects.ts`
- Modify: `src/water-surface.ts`
- Test: `test/weather-precipitation.test.ts`

**Interfaces:**
- `createWeatherPrecipitation(scene: THREE.Object3D, halfSize: THREE.Vector3)` returns `{ setWeatherEffects(effects), update(time), resize(halfSize), dispose() }`.
- The effect creates one `THREE.Points` snow field with deterministic positions and no per-frame allocations.

- [ ] **Step 1: Write the failing tests**

```ts
it("exposes snow intensity separately from rain intensity", () => {
  expect(getWeatherEffects("snow").snowIntensity).toBeGreaterThan(0);
  expect(getWeatherEffects("snow").rainIntensity).toBe(0);
});
```

- [ ] **Step 2: Run the focused test**

Run: `rtk npm test -- --run test/weather-precipitation.test.ts`

Expected: FAIL because the precipitation module and `snowIntensity` do not exist.

- [ ] **Step 3: Implement precipitation**

Create a 180-particle `THREE.Points` cloud using a `PointsMaterial` with white color, size `0.09`, transparency, and deterministic seed positions. `setWeatherEffects` maps `snowIntensity` to opacity; `update(time)` moves particles downward and wraps them to the top; `resize` rebuilds bounds without replacing the material.

In `buildAquariumScene`, create the effect after `createAquariumShell`, call it from `setWeatherEffects`, `update`, `resize`, and `dispose`. Extend `water-surface.ts` only to ignore the new `snowIntensity` field while continuing to use `rainIntensity` for ripple impacts.

- [ ] **Step 4: Run focused tests and typecheck**

Run: `rtk npm test -- --run test/weather-precipitation.test.ts && rtk npm run typecheck`

Expected: PASS with no TypeScript errors.

- [ ] **Step 5: Commit**

```bash
rtk git add src/weather/precipitation.ts src/aquarium/scene-builder.ts src/weather/effects.ts src/water-surface.ts test/weather-precipitation.test.ts
rtk git commit -m "feat: add manual snow precipitation effect"
```

### Task 3: Replace weather selector with four manual buttons

**Files:**
- Modify: `src/aquarium/ui-panel.ts`
- Modify: `src/styles.css`
- Modify: `src/i18n.ts`
- Test: `test/weather-controls.test.ts`

**Interfaces:**
- `buildWeatherSection` renders four `button.weather-button` elements, one for each `WEATHER_KINDS` entry.
- The active button has `data-weather-kind` equal to the selected kind and `aria-pressed="true"`.
- No weather timer, `<select>`, “立即切换” button, or auto-cycle checkbox remains.

- [ ] **Step 1: Write the failing UI assertions**

```ts
const buttons = root.querySelectorAll<HTMLButtonElement>("button.weather-button");
expect([...buttons].map((button) => button.dataset.weatherKind)).toEqual([
  "clear", "rain", "snow", "cloudy",
]);
expect(root.querySelector(".weather-auto-label")).toBeNull();
expect(root.querySelector("select")).toBeNull();
```

- [ ] **Step 2: Run the focused test**

Run: `rtk npm test -- --run test/weather-controls.test.ts`

Expected: FAIL because the panel currently renders a select, switch button, timer status and auto-cycle checkbox.

- [ ] **Step 3: Implement the button UI**

Replace `buildWeatherSection` with a status line and a `.weather-buttons` group. For each kind, set `button.dataset.weatherKind`, `button.setAttribute("aria-pressed", String(kind === current))`, and call `manager.setWeather(kind); render()` in the click handler. Remove `weatherTimer`, `setInterval`, `setWeatherAutoCycle`, and the obsolete translation keys.

Add Chinese/English labels: `weather_clear` 晴天/Sunny, `weather_rain` 雨天/Rain, `weather_snow` 雪天/Snow, `weather_cloudy` 阴天/Cloudy. Style the buttons as a four-column responsive grid with `.is-active` and `[aria-pressed="true"]` accent states.

- [ ] **Step 4: Run UI tests and typecheck**

Run: `rtk npm test -- --run test/weather-controls.test.ts && rtk npm run typecheck`

Expected: PASS and no references to `setWeatherAutoCycle` or `weatherAutoCycle` remain in `src`.

- [ ] **Step 5: Commit**

```bash
rtk git add src/aquarium/ui-panel.ts src/styles.css src/i18n.ts test/weather-controls.test.ts
rtk git commit -m "feat: add manual weather buttons"
```

### Task 4: Upgrade procedural fish geometry and materials

**Files:**
- Modify: `src/fish/procedural-species.ts`
- Modify: `src/fish/model-loader.ts`
- Test: `test/procedural-species.test.ts`

**Interfaces:**
- Keep `ProceduralFishKey` and `createProceduralFishModel(key)` unchanged.
- Each returned `FishModelInstance` remains one merged `BufferGeometry` plus one disposable material.
- New helper signatures are local to `procedural-species.ts`: `ellipsoid(...)`, `fin(...)`, `eye(...)`, `mergeModel(...)`.

- [ ] **Step 1: Write the failing geometry quality assertions**

```ts
it.each(["angelfish", "blue-tang", "pufferfish"] as const)("has smooth normals and multiple material regions for %s", (key) => {
  const model = createProceduralFishModel(key);
  expect(model.geometry.getAttribute("position").count).toBeGreaterThan(120);
  expect(model.geometry.getAttribute("normal").count).toBeGreaterThan(120);
  expect(model.geometry.getAttribute("color").count).toBe(model.geometry.getAttribute("position").count);
  model.geometry.dispose();
  model.material.dispose();
});
```

- [ ] **Step 2: Run the focused test**

Run: `rtk npm test -- --run test/procedural-species.test.ts`

Expected: FAIL for the current low-resolution models or missing vertex-color coverage.

- [ ] **Step 3: Implement the realistic procedural models**

Use 24×16 or 28×18 segments for smooth ellipsoid bodies. Build each species from the body, tail peduncle, tail fin, dorsal/ventral fins, pectoral fins, eyes, and species-specific color bands. Use `MeshStandardMaterial({ vertexColors: true, roughness: 0.48, metalness: 0.02 })` with `flatShading: false`; use a second transparent fin material only when the merged model can preserve instanced rendering, otherwise encode fins through vertex colors and alpha-free geometry. Add 8–12 pufferfish cone spines, not hundreds.

Ensure every part receives a color attribute before `mergeGeometries`, compute smooth vertex normals after merging, and keep `renderScale: 1` plus `useAppearanceVariants: false`.

- [ ] **Step 4: Run fish tests, full tests, typecheck and build**

Run: `rtk npm test -- --run test/procedural-species.test.ts && rtk npm run typecheck && rtk npm run build`

Expected: PASS; build may retain the existing chunk-size warning but must exit successfully.

- [ ] **Step 5: Commit**

```bash
rtk git add src/fish/procedural-species.ts src/fish/model-loader.ts test/procedural-species.test.ts
rtk git commit -m "feat: improve procedural fish realism"
```

### Task 5: Regression verification and browser smoke check

**Files:**
- Modify: `README.md` (document the four manual weather buttons and procedural fish models)
- Test: `test/weather-controller.test.ts`
- Test: `test/weather-integration.test.ts`
- Test: `test/weather-controls.test.ts`
- Test: `test/procedural-species.test.ts`

**Interfaces:**
- No new runtime interfaces; this task validates the completed changes.

- [ ] **Step 1: Run the complete test suite**

Run: `rtk npm test`

Expected: all Vitest files pass with zero failures.

- [ ] **Step 2: Run typecheck and production build**

Run: `rtk npm run typecheck && rtk npm run build`

Expected: both commands exit 0.

- [ ] **Step 3: Run the dev server and browser smoke check**

Run: `rtk npm run dev -- --host 127.0.0.1`.

In the browser, verify the panel shows exactly four weather buttons labelled 晴天/雨天/雪天/阴天, clicking 雪天 reveals falling snow, clicking 雨天 produces rain ripple impacts, and switching back to 晴天 hides precipitation. Verify the three added fish render as smooth, colored bodies and continue to scale with growth.

- [ ] **Step 4: Update documentation and commit**

Add a short “Weather and procedural fish” section to `README.md` describing the four manual modes and the three procedural species.

```bash
rtk git add README.md
rtk git commit -m "docs: describe manual weather and procedural fish"
```

## Self-review checklist

- Spec coverage: model geometry/material requirements are covered by Task 4; four manual weather modes, snow effects, UI buttons, manager/controller interfaces and tests are covered by Tasks 1–3; verification and docs are covered by Task 5.
- Placeholder scan: no `TODO`, `TBD`, or unspecified implementation step is used.
- Type consistency: `snowIntensity` is defined in `WeatherEffects`, consumed by precipitation, and existing water-surface code continues to consume only `rainIntensity`; `WeatherState` no longer contains `autoCycle` in all listed consumers.
