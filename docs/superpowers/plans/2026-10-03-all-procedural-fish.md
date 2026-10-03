# 全鱼类程序化真实模型实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让沙丁鱼、锦鲤、小丑鱼、海星、神仙鱼、蓝吊和河豚都使用统一的纯程序化 Three.js 真实外观，同时保持现有行为、成长和天气功能。

**Architecture:** 扩展现有 `src/fish/procedural-species.ts` 成为七物种模型工厂，普通鱼继续通过 `createFishMeshByKey` 进入共享 `InstancedMesh`；小丑鱼保留珊瑚避让学校但改用新的程序模型；海星保留底栖独立运动，只替换其几何材质来源。旧 GLB 加载器保留为兼容路径，但默认鱼类不再依赖它们。

**Tech Stack:** TypeScript 6、Three.js 0.185、Vite、Vitest、现有 `FishModelInstance`/`InstancedMesh` 管线。

## Global Constraints

- 不增加 `.glb`、纹理或网络资源；七个物种必须由程序化 Three.js 几何生成。
- 所有可实例化鱼模型返回一个合并 `BufferGeometry` 和一个可释放材质。
- 本地前方统一沿 +Y，兼容现有姿态四元数和鱼群运动。
- 保留成长倍率、稳定 fishId、天气倍率和现有海洋生态行为。
- 高数量物种必须仍是一物种一个 `InstancedMesh`，不得每条鱼创建独立 Three.js 对象。
- 所有命令使用 `rtk` 前缀。

---

### Task 1: 扩展七物种程序化模型工厂

**Files:**
- Modify: `src/fish/procedural-species.ts`
- Test: `test/procedural-species.test.ts`

**Interfaces:**
- `ProceduralFishKey` 扩展为 `"sardine" | "koi" | "clownfish" | "starfish" | "angelfish" | "blue-tang" | "pufferfish"`。
- `createProceduralFishModel(key)` 和 `isProceduralFishKey(key)` 签名不变。
- 每个模型仍返回 `{ geometry, material, renderScale, useAppearanceVariants }`。

- [ ] **Step 1: Write the failing tests**

```ts
const proceduralKeys = [
  "sardine", "koi", "clownfish", "starfish",
  "angelfish", "blue-tang", "pufferfish",
] as const;

it.each(proceduralKeys)("creates a smooth colored %s model", (key) => {
  const model = createProceduralFishModel(key);
  const positions = model.geometry.getAttribute("position");
  expect(positions.count).toBeGreaterThan(120);
  expect(model.geometry.getAttribute("normal").count).toBe(positions.count);
  expect(model.geometry.getAttribute("color").count).toBe(positions.count);
  model.geometry.dispose();
  model.material.dispose();
});
```

- [ ] **Step 2: Run the focused test to verify failure**

Run: `rtk npm test -- --run test/procedural-species.test.ts`

Expected: FAIL because the factory currently recognizes only angelfish, blue-tang, and pufferfish.

- [ ] **Step 3: Implement the four missing models**

Add `createSardine`, `createKoi`, `createClownfish`, and `createStarfish` branches. Use 24–32 segment ellipsoid bodies, attach tail/fins/eyes as merged parts, and call the existing geometry normalization before `mergeGeometries`.

Use these fixed visual rules:

```ts
// sardine: silver belly + blue-gray back + dark lateral line
// koi: white body + three red/gold irregular patches + broad tail
// clownfish: orange body + three white bands with dark edges
// starfish: five extruded radial arms + orange/red vertex gradient
```

For the starfish, create a radial `THREE.Shape` with five tapered arms, extrude it by `0.12`, bevel by `0.02`, add a smaller center dome, and merge both before calculating smooth normals. Keep the puffer spine count at the existing low quantity.

- [ ] **Step 4: Run focused tests**

Run: `rtk npm test -- --run test/procedural-species.test.ts`

Expected: PASS for all seven keys and the existing unknown-key error test.

- [ ] **Step 5: Commit**

```bash
rtk git add src/fish/procedural-species.ts test/procedural-species.test.ts
rtk git commit -m "feat: add procedural models for every fish species"
```

### Task 2: Rewire model loading and species schools

**Files:**
- Modify: `src/fish/model-loader.ts`
- Modify: `src/aquarium/species-catalog.ts`
- Modify: `src/clownfish-school.ts`
- Test: `test/procedural-species.test.ts`
- Test: `test/aquarium-manager.test.ts`

**Interfaces:**
- `createFishModelInstanceByKey("sardine" | "koi" | "clownfish" | "starfish")` returns the corresponding procedural model.
- `createBoidsSchool` continues to accept a model key string and keeps its existing school handle contract.
- `createStarfishSchool` continues to expose `setCount`, `getCount`, `getFishIds`, `setGrowthSizes`, `update`, and `dispose`.

- [ ] **Step 1: Write the failing integration assertions**

```ts
for (const key of ["sardine", "koi", "clownfish", "starfish"] as const) {
  const model = createFishModelInstanceByKey(key);
  expect(model.geometry.getAttribute("color")).toBeDefined();
  model.geometry.dispose();
  model.material.dispose();
}
```

Add a catalog assertion that `getFishMeta("clownfish")?.modelKey` is `"clownfish"` while all seven entries remain present in the same order.

- [ ] **Step 2: Run focused tests to verify failure**

Run: `rtk npm test -- --run test/procedural-species.test.ts test/aquarium-manager.test.ts`

Expected: FAIL because the loader routes the keys through GLB/fallback paths and the clownfish catalog still uses `"clown"`.

- [ ] **Step 3: Implement the routing changes**

Keep `fishModelSources` for backward compatibility, but let `isProceduralFishKey` catch all seven keys before GLB lookup. Update `FISH_CATALOG` clownfish `modelKey` to `"clownfish"`; update `createFishSchool` to call `createBoidsSchool("clownfish", ...)` only where the key is used by the shared renderer, while preserving `createClownfishSchool` for reef avoidance and changing its internal model request from `"clown"` to `"clownfish"`.

In `createStarfishSchool`, replace the local `createStarfishGeometry`/single-color material with `createProceduralFishModel("starfish")`, set `material.vertexColors` as provided, and dispose the returned geometry/material in the existing school `dispose` method. Keep its current bottom sampling and stable fish IDs untouched.

- [ ] **Step 4: Run integration tests and typecheck**

Run: `rtk npm test -- --run test/procedural-species.test.ts test/aquarium-manager.test.ts && rtk npm run typecheck`

Expected: PASS with no changes to weather, growth, or habitat behavior.

- [ ] **Step 5: Commit**

```bash
rtk git add src/fish/model-loader.ts src/aquarium/species-catalog.ts src/clownfish-school.ts test/procedural-species.test.ts test/aquarium-manager.test.ts
rtk git commit -m "feat: route all fish schools through procedural models"
```

### Task 3: Regression coverage for rendering and growth compatibility

**Files:**
- Modify: `test/fish-growth-rendering.test.ts`
- Modify: `test/habitat-fish-school.test.ts`
- Modify: `test/aquarium-growth-integration.test.ts`

**Interfaces:**
- No runtime interface changes; tests must continue to use the existing manager and school contracts.

- [ ] **Step 1: Add model and growth assertions**

Add tests that create the seven species through the existing manager/preset path, advance growth, and assert that each active fish school still returns stable IDs and a positive growth size multiplier. Add a habitat assertion that the school regions for upper/middle/lower/reef remain unchanged.

- [ ] **Step 2: Run the focused regression files**

Run: `rtk npm test -- --run test/fish-growth-rendering.test.ts test/habitat-fish-school.test.ts test/aquarium-growth-integration.test.ts`

Expected: PASS; no fish school loses its growth records or habitat bounds.

- [ ] **Step 3: Commit**

```bash
rtk git add test/fish-growth-rendering.test.ts test/habitat-fish-school.test.ts test/aquarium-growth-integration.test.ts
rtk git commit -m "test: cover procedural fish growth compatibility"
```

### Task 4: Documentation and full verification

**Files:**
- Modify: `README.md`
- Modify: `README.en.md`

- [ ] **Step 1: Document all seven procedural species**

Update the model section to state that sardine, koi, clownfish, starfish, angelfish, blue tang, and pufferfish are generated procedurally with smooth bodies, fins, species-specific color regions, and no new external assets.

- [ ] **Step 2: Run the complete test, typecheck, and build commands**

Run: `rtk npm test && rtk npm run typecheck && rtk npm run build`

Expected: all tests pass; typecheck and build exit with code 0. The existing Vite chunk-size warning is acceptable if no new error appears.

- [ ] **Step 3: Browser smoke check**

Run: `rtk npm run dev -- --host 127.0.0.1` and open `http://127.0.0.1:5173/`. Verify the default tank renders all seven catalog species, the three existing weather controls still work, and changing counts/growth does not replace fish IDs.

- [ ] **Step 4: Commit documentation**

```bash
rtk git add README.md README.en.md
rtk git commit -m "docs: describe all procedural fish models"
```

## Self-review checklist

- Spec coverage: all seven model shapes and colors are covered by Task 1; GLB/model routing and starfish lifecycle are covered by Task 2; growth/habitat compatibility is covered by Task 3; docs and final verification are covered by Task 4.
- Placeholder scan: no `TODO`, `TBD`, or unspecified implementation step remains.
- Type consistency: `ProceduralFishKey` is expanded once and consumed by model-loader; starfish keeps its existing school handle while sharing the new geometry factory.
