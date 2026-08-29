# RippleAquarium Vite 工程化设计

## 背景

RippleAquarium 当前使用 TypeScript、原生 ESM 和浏览器 importmap。`tsc` 将源码编译到 `dist/`，自定义脚本再复制 CSS 与 GLB 资源，`index.html` 则直接引用 `dist/src/main.js` 和 `dist/src/styles.css`。本地开发前必须先构建，并额外启动静态 HTTP 服务；项目没有文件监听、热更新或生产预览命令。

仓库还同时存在 npm 与 pnpm 锁文件。README、GitHub Actions 和现有脚本均以 npm 为准，因此工程化改造统一使用 npm。

## 目标

- 使用 `npm run dev` 启动 Vite 开发服务器。
- CSS 修改即时热更新；TypeScript/Three.js 模块修改后自动刷新页面并重新初始化场景。
- 使用 `npm run build` 完成类型检查和生产构建，输出可直接部署的 `dist/`。
- 使用 `npm run preview` 本地验证生产构建。
- 使用 Vitest 直接执行现有 TypeScript 测试。
- 让本地开发、生产预览和 GitHub Pages 子路径部署均能正确加载 JS、CSS 与 GLB 资源。
- 保持现有鱼群、水波、珊瑚、装饰物、相机、控制面板和国际化行为不变。

## 非目标

- 不在本次改造中启用 TypeScript strict 模式。
- 不新增 ESLint、Prettier、Husky 或提交规范。
- 不增加 WebGL 运行时监控或远程错误上报。
- 不迁移或压缩业务 GLB 模型，不处理资产许可证问题。
- 不重构水族箱业务模块和渲染算法。

## 方案选择

采用 Vite + Vitest 的统一工程化方案，而不是保留旧的 `tsc` 输出、资源复制和 Node 模块解析钩子。

Vite 将 `index.html`、TypeScript、CSS 和 GLB 纳入同一模块图。开发时由 Vite 提供文件监听与模块更新；生产时由 Vite 生成带哈希的静态资源。Vitest 复用 Vite 的模块解析能力，测试不再依赖 vendored Three.js 或自定义 resolver。

## 工程结构

### HTML 与应用入口

`index.html` 保持项目根目录入口位置，但改为直接加载 `/src/main.ts`。删除以下旧机制：

- `./dist/src/styles.css` 样式引用；
- 浏览器 importmap；
- `./dist/src/main.js` 脚本引用。

`src/main.ts` 顶部导入 `./styles.css`，让样式进入 Vite 模块图。

### Three.js 依赖

`three` 作为 npm 运行依赖存在。现有源码继续使用：

```ts
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
```

移除 `vendor/three/`。`@types/three`、TypeScript、Vite 和 Vitest 属于开发依赖。

### 静态模型资源

现有模型 URL 已采用 `new URL("...glb", import.meta.url)`，继续保留这种写法。Vite 在开发时提供源资源 URL，在构建时复制并重写为带哈希的生产资源 URL。

模型仍保存在现有 `src/coral/`、`src/fish/` 和 `src/decor/models/` 目录。删除 `scripts/copy-assets.mjs`，不再手工复制资源。

### Vite 配置

新增 `vite.config.ts`：

- 使用相对 `base`，使产物可部署到 GitHub Pages 的 `/RippleAquarium/` 子路径，也可从任意静态目录预览；
- 保持默认根入口 `index.html`；
- 保持默认输出目录 `dist/`；
- 测试使用 Node 环境并匹配 `test/**/*.test.ts`。

项目支持 Node.js `^20.19.0`、`^22.12.0` 或 `>=24.0.0`，CI 固定使用 Node 22。奇数版 Node 23 不在 Vitest 4 的正式支持范围内。

## npm 命令

`package.json` 提供以下脚本：

```json
{
  "dev": "vite",
  "typecheck": "tsc --noEmit",
  "build": "npm run typecheck && vite build",
  "preview": "vite preview",
  "test": "vitest run"
}
```

`package.json` 增加 Node.js engine 约束，并只保留 `package-lock.json`。删除 `pnpm-lock.yaml`，避免同一依赖图由两个包管理器分别锁定。

## 测试迁移

将 `test/simulation.test.ts` 和 `test/aquarium-manager.test.ts` 从 `node:test`/`node:assert` 迁移为 Vitest 的 `describe`、`it` 和 `expect`。测试内容与覆盖目标保持不变。

删除以下旧测试适配文件：

- `test/three-resolver.ts`；
- `test/three-resolver-hooks.ts`。

Vitest 直接从 npm 依赖解析 `three`，不生成测试 JavaScript 到 `dist/test/`。

## 开发时数据流

1. 浏览器向 Vite 请求 `index.html`。
2. Vite 转换并提供 `src/main.ts` 及其依赖。
3. `src/main.ts` 导入 CSS、业务模块和 npm 中的 Three.js。
4. `new URL(..., import.meta.url)` 生成开发模型地址，GLTFLoader 从 Vite 读取模型。
5. CSS 变更通过 HMR 注入；TypeScript/Three.js 模块变更触发页面刷新，使 WebGL 场景从干净状态重新初始化。

## 生产构建数据流

1. `tsc --noEmit` 验证源码和测试类型。
2. `vite build` 以 `index.html` 为入口构建应用。
3. Vite 将 JS、CSS 和被引用的 GLB 写入 `dist/`，并重写资源路径。
4. `dist/index.html` 使用相对基路径引用生产资源。
5. GitHub Actions 直接上传完整 `dist/`。

## 错误处理

- 类型错误、模块解析失败、资源解析失败或 Vite 打包失败会使 `npm run build` 非零退出，不上传不完整站点。
- 测试失败会阻止 GitHub Pages 部署。
- 保留现有模型加载失败时的 `console.warn` 与程序化 fallback 行为；本次不改变用户可见运行时降级策略。
- Three.js 模块更新采用页面刷新而不是保留场景状态，以避免旧 renderer、材质、几何体或事件监听器残留。

## GitHub Pages

更新 `.github/workflows/deploy-pages.yml`：

1. 检出仓库并配置 Node 22 与 npm 缓存；
2. 执行 `npm ci`；
3. 执行 `npm test`；
4. 执行 `npm run build`；
5. 配置 Pages 并直接上传 `dist/`；
6. 部署构建产物。

不再创建 `_site`，也不再手工复制 `index.html`、`assets`、`dist` 和 `vendor`。

## 文档更新

同步更新 `README.md` 与 `README.en.md`：

- Node.js 版本要求；
- `npm install`；
- `npm run dev`；
- `npm test`；
- `npm run typecheck`；
- `npm run build`；
- `npm run preview`；
- Vite、npm Three.js 依赖和新目录结构；
- GitHub Pages 从 `dist/` 部署。

`start.md` 保留为 2026-08-22 的分析快照，不修改为当前操作手册。

## 验收标准

- 全新 npm 安装后，`npm run dev` 能启动服务，入口页面与 GLB 模型正常加载。
- 修改 CSS 后浏览器无需手动刷新即可看到变化。
- 修改 TypeScript 后浏览器自动刷新且 WebGL 场景只初始化一次。
- `npm test` 通过全部现有测试。
- `npm run typecheck` 通过。
- `npm run build` 成功生成 `dist/index.html`、JS、CSS 和所有被引用的 GLB。
- `npm run preview` 能从生产产物加载完整水族箱。
- 生产产物不引用 `/src/`、`/vendor/` 或 `dist/src/`。
- 仓库只保留 npm 锁文件，GitHub Actions 直接部署 `dist/`。
