# RippleAquarium Vite Engineering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Convert RippleAquarium into an npm-only Vite project with live development, Vitest tests, reproducible production builds, and direct GitHub Pages deployment.

**Architecture:** Vite owns the browser module graph from root `index.html` through TypeScript, CSS, Three.js, and GLB assets. Vitest resolves the same npm modules directly in TypeScript tests, while `tsc --noEmit` remains the type gate before Vite writes `dist/`.

**Tech Stack:** Node.js `^20.19.0`, `^22.12.0`, or `>=24.0.0`; npm; TypeScript 6.0.3; Three.js 0.185.0; Vite 8.2.2; Vitest 4.1.11; GitHub Pages.

## Global Constraints

- Use npm as the only package manager and keep only `package-lock.json`.
- Preserve all aquarium rendering, simulation, controls, camera, i18n, and fallback behavior.
- Keep TypeScript strict mode disabled in this migration.
- Keep business GLB assets in their current `src/` directories.
- Use relative Vite build URLs so the generated site works below `/RippleAquarium/`.
- Do not add linting, formatting, Git hooks, runtime telemetry, or unrelated refactors.
- Run all repository shell commands through `rtk`.

---

### Task 1: Establish the Vite and Vitest toolchain

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `vite.config.ts`
- Delete: `pnpm-lock.yaml`

**Interfaces:**
- Consumes: existing npm package metadata and TypeScript source layout.
- Produces: `npm run dev`, `npm run typecheck`, `npm run build`, `npm run preview`, and `npm test`; Vite config exporting a relative-base build and Node test environment.

- [x] **Step 1: Record the baseline failure for the missing dev command**

Run:

```bash
rtk npm run dev
```

Expected: FAIL with `Missing script: "dev"`.

- [x] **Step 2: Replace the package scripts and dependency roles**

Set `package.json` to include these exact fields while preserving the existing name, version, description, module type, and private flag:

```json
{
  "engines": {
    "node": "^20.19.0 || ^22.12.0 || >=24.0.0"
  },
  "scripts": {
    "dev": "vite",
    "typecheck": "tsc --noEmit",
    "build": "npm run typecheck && vite build",
    "preview": "vite preview",
    "test": "vitest run"
  },
  "dependencies": {
    "three": "^0.185.0"
  },
  "devDependencies": {
    "@types/node": "^26.0.1",
    "@types/three": "^0.185.0",
    "typescript": "^6.0.3",
    "vite": "^8.2.2",
    "vitest": "^4.1.11"
  }
}
```

- [x] **Step 3: Add the shared Vite/Vitest configuration**

Create `vite.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  base: "./",
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
  },
});
```

- [x] **Step 4: Regenerate the npm dependency graph**

Delete `pnpm-lock.yaml`, then run:

```bash
rtk npm install
```

Expected: `package-lock.json` records Vite 8.2.2 and Vitest 4.1.11, with no pnpm lock file remaining.

- [x] **Step 5: Verify the new commands are discoverable**

Run:

```bash
rtk npm run
rtk npx vite --version
rtk npx vitest --version
```

Expected: all five scripts are listed; Vite reports 8.2.2 and Vitest reports 4.1.11.

- [x] **Step 6: Commit the toolchain**

```bash
rtk git add package.json package-lock.json pnpm-lock.yaml vite.config.ts
rtk git commit -m "build: add Vite and Vitest toolchain"
```

### Task 2: Move the browser entry and assets into Vite

**Files:**
- Modify: `index.html`
- Modify: `src/main.ts`
- Delete: `scripts/copy-assets.mjs`
- Delete: `vendor/three/three.module.js`
- Delete: `vendor/three/addons/controls/OrbitControls.js`
- Delete: `vendor/three/addons/loaders/GLTFLoader.js`
- Delete: `vendor/three/addons/utils/BufferGeometryUtils.js`

**Interfaces:**
- Consumes: Vite root entry convention and the existing `new URL(..., import.meta.url)` model references.
- Produces: a browser entry at `/src/main.ts`, CSS imported by TypeScript, and Vite-managed Three.js/GLB output.

- [x] **Step 1: Prove the old entry bypasses Vite's source module graph**

Run:

```bash
rtk rg -n 'dist/src|importmap|vendor/three' index.html
```

Expected: matches for the compiled CSS, importmap, vendored Three.js, and compiled JavaScript entry.

- [x] **Step 2: Convert `index.html` into a Vite entry**

Remove the stylesheet link and the complete importmap block. Replace the final script with:

```html
<script type="module" src="/src/main.ts"></script>
```

- [x] **Step 3: Attach CSS to the application module graph**

Add this as the first import in `src/main.ts`:

```ts
import "./styles.css";
```

Keep every existing application import and initialization statement otherwise unchanged.

- [x] **Step 4: Remove obsolete copy and vendored runtime files**

Delete `scripts/copy-assets.mjs` and the four tracked files under `vendor/three/`. Remove their now-empty directories.

- [x] **Step 5: Build and inspect the Vite artifact graph**

Run:

```bash
rtk npm run build
rtk rg -n '/src/|/vendor/|dist/src/' dist/index.html dist/assets
rtk rg --files dist
```

Expected: build passes; the forbidden-path search returns no matches; `dist/` contains `index.html`, hashed JS/CSS, and the referenced GLB assets.

- [x] **Step 6: Smoke-test the development server**

Start:

```bash
rtk npm run dev -- --host 127.0.0.1
```

Request `/`, `/src/main.ts`, and one transformed GLB URL. Expected: HTTP 200 responses and no missing-module error in the returned module graph. Stop the server after the checks.

- [x] **Step 7: Commit the Vite browser pipeline**

```bash
rtk git add index.html src/main.ts scripts/copy-assets.mjs vendor
rtk git commit -m "build: move browser pipeline to Vite"
```

### Task 3: Migrate the existing tests to Vitest

**Files:**
- Modify: `test/simulation.test.ts`
- Modify: `test/aquarium-manager.test.ts`
- Delete: `test/three-resolver.ts`
- Delete: `test/three-resolver-hooks.ts`

**Interfaces:**
- Consumes: Vitest globals imported explicitly from `vitest` and npm-resolved `three`.
- Produces: the same 24 behavioral tests running directly from `.ts` sources with `npm test`.

- [x] **Step 1: Capture the expected migration failure**

Run:

```bash
rtk npm test
```

Expected: FAIL because the current tests import `node:test` and are not yet collected/executed as Vitest suites correctly.

- [x] **Step 2: Convert the simulation test registration and preserve assertions**

Replace the two Node test imports with:

```ts
import { assert, test } from "vitest";
```

Keep the existing assertions through Vitest's `assert` interface. Change Node's strict `assert.equal` calls to Vitest's explicit strict equivalent:

```ts
assert.equal(actual, expected) -> assert.strictEqual(actual, expected)
```

Preserve existing diagnostic messages, for example:

```ts
assert.strictEqual(result, out, "writes into the provided output vector");
assert.ok(candidates.has(j), `grid missed neighbour ${j} of ${i}`);
```

- [x] **Step 3: Convert the aquarium manager test registration**

Replace Node imports with:

```ts
import { assert, beforeEach, describe, it } from "vitest";
```

Keep the existing `strictEqual`, `deepStrictEqual`, and `ok` calls through Vitest's `assert` interface so their semantics remain unchanged.

- [x] **Step 4: Remove the obsolete resolver hooks**

Delete `test/three-resolver.ts` and `test/three-resolver-hooks.ts`; no replacement is needed because Vitest resolves `three` from npm.

- [x] **Step 5: Verify tests and types**

Run:

```bash
rtk npm test
rtk npm run typecheck
```

Expected: 2 test files and 24 tests pass; TypeScript reports no errors.

- [x] **Step 6: Commit the test migration**

```bash
rtk git add test
rtk git commit -m "test: migrate suites to Vitest"
```

### Task 4: Align deployment and project documentation

**Files:**
- Modify: `.github/workflows/deploy-pages.yml`
- Modify: `README.md`
- Modify: `README.en.md`

**Interfaces:**
- Consumes: the scripts and `dist/` contract produced by Tasks 1-3.
- Produces: CI that tests and directly deploys Vite output, plus accurate Chinese and English operating instructions.

- [x] **Step 1: Make GitHub Pages test and upload Vite output**

Keep the existing permissions, concurrency, and deploy job. In the build job:

- keep Node 22, npm cache, `npm ci`, and `npm run build`;
- add this step after dependency installation:

```yaml
- name: Test
  run: npm test
```

- delete the `Prepare static site` step;
- change the upload path from `_site` to `dist`.

- [x] **Step 2: Rewrite the Chinese quick-start contract**

Document Node.js `20.19+` or `22.12+`, then use these commands and meanings:

```bash
npm install
npm run dev
npm test
npm run typecheck
npm run build
npm run preview
```

State that Vite serves the development URL printed in the terminal, watches source files, and emits production files to `dist/`. Replace vendored Three.js, Python server, copy script, and Node built-in test-runner descriptions.

- [x] **Step 3: Mirror the operating contract in English**

Apply the same version floor, commands, Vite behavior, Vitest description, dependency model, directory tree, and `dist/` deployment explanation to `README.en.md`.

- [x] **Step 4: Run full acceptance checks**

Run:

```bash
rtk npm test
rtk npm run typecheck
rtk npm run build
rtk git diff --check
rtk rg -n 'vendor/three|python3 -m http.server|Node 内置 test runner|Node built-in test runner|_site|dist/src' README.md README.en.md index.html package.json .github/workflows/deploy-pages.yml dist/index.html
```

Expected: tests, types, build, and whitespace checks pass; the stale-reference search returns no matches.

- [x] **Step 5: Preview and inspect production output**

Start:

```bash
rtk npm run preview -- --host 127.0.0.1
```

Request the preview root, hashed JS, CSS, and all GLB URLs listed by `dist/`. Expected: HTTP 200 for every resource. Stop the preview server after verification.

- [x] **Step 6: Commit deployment and documentation**

```bash
rtk git add .github/workflows/deploy-pages.yml README.md README.en.md
rtk git commit -m "docs: document Vite development workflow"
```

### Task 5: Final repository audit

**Files:**
- Verify only; no planned file changes.

**Interfaces:**
- Consumes: all artifacts from Tasks 1-4.
- Produces: evidence that the repository is npm-only, reproducible, testable, buildable, and deployable.

- [x] **Step 1: Verify tracked structure and obsolete-file removal**

Run:

```bash
rtk git status --short
rtk rg --files | rtk rg '^(pnpm-lock.yaml|vendor/|scripts/copy-assets.mjs|test/three-resolver)'
```

Expected: clean worktree and no obsolete tracked paths.

- [x] **Step 2: Verify a clean npm installation contract**

Use a temporary copy that excludes `.git`, `node_modules`, and `dist`; run `npm ci`, `npm test`, and `npm run build` there. Expected: all commands pass without using files from the working checkout.

- [x] **Step 3: Report exact acceptance evidence**

Record the Node/npm versions, test file/test counts, typecheck result, Vite build result, generated asset categories, development-server HTTP checks, production-preview HTTP checks, and any validation limitation. Do not claim a real browser/WebGL visual check unless one was performed.
