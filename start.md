# 涟漪鱼缸（RippleAquarium）项目分析

> 分析时间：2026-08-22 | 分支：feature/dev | 基于当前工作区只读阅读，未修改任何代码

---

## 1. 项目是做什么的

这是一个**纯前端 WebGL 3D 水族箱模拟**（中文名「涟漪鱼缸」，npm 包名 `threejs-boids`），打开浏览器即可运行，无需后端。

核心玩法是「会自我运转的小世界」，包含四类实时模拟：

- **鱼群（boids）**：沙丁鱼与锦鲤各成独立集群，使用对齐 / 聚集 / 分离 / 避障 / 边界回避的群体行为逻辑，参数可在右侧面板实时调节。
- **小丑鱼**：底栖活动模式，只在珊瑚附近小范围巡游，并主动避开珊瑚和装饰物。
- **水面涟漪**：用 WebGL 高度场（384×384 双缓冲渲染到纹理）模拟波动传播；鼠标点击 / 拖动、鱼游近水面都能触发真实传播的水波。
- **珊瑚生长**：页面刷新时珊瑚从 0 个、0 尺寸逐步生长到默认状态，营造「生命感」。

交互方式：鼠标点击/拖动水面产生涟漪、右侧折叠控制面板、中英文切换、空格键切换「环绕相机 / 鱼视角相机」、`1`/`2` 显隐 UI 面板、复制相机参数等。

项目来源是整合多个开源/公开资源（vibe-motion/threejs-boids 的 boids 基础、aisparkedu/ripple 的涟漪思路、Jaydeep-P/aquarium 的珊瑚/小丑鱼/锦鲤模型资源、Sketchfab 的菠萝屋与海绵宝宝模型），采用 **AGPL-3.0** 许可证。

---

## 2. 技术栈

| 层 | 技术 | 说明 |
|---|---|---|
| 3D 渲染 | **Three.js r0.185.0** | WebGL；实例化渲染（InstancedMesh）绘制主鱼群与珊瑚；自定义 GLSL 着色器做水面高度场模拟与水波渲染 |
| 语言 | **TypeScript 6.0.3** | 编译到 `dist/`；目标 ES2022，模块 `NodeNext` |
| 运行时 | **原生 ESM + 浏览器 importmap** | `index.html` 内联 importmap 把 `three` / `three/addons/` 映射到 `vendor/` 本地文件，无打包步骤 |
| 构建 | `tsc` + 自定义 `scripts/copy-assets.mjs` | 无 bundler；静态资源（CSS、GLB、珊瑚、装饰模型）复制到 `dist/` |
| 测试 | **Node 内置 test runner** (`node:test`) | 仅覆盖模拟逻辑；通过 `test/three-resolver.js` 注册模块解析钩子，让 Node 能像浏览器一样解析 `three` |
| 样式 | 单个 `src/styles.css` | 控制面板、按钮、加载层等 UI |
| 工作流 | GitHub Actions → GitHub Pages | `main` 分支 push 时自动构建部署 |

**依赖情况**：`devDependencies` 只有 4 个（`@types/node`、`@types/three`、`three`、`typescript`）。Three.js 运行时与 addons **已本地化到 `vendor/`**（`vendor/three/three.module.js` + `addons/`），因此生产运行时不依赖 npm 包。当前工作区 `node_modules/` **不存在**，需要 `npm install` 拉取开发依赖。

---

## 3. 目录结构组织

```
RippleAquarium/
├── index.html                # 唯一入口页（SPA），含 importmap、控制面板 HTML、i18n data-* 标记
├── package.json              # 脚本：typecheck / build / test
├── tsconfig.json             # 编译配置（rootDir=., outDir=dist, strict=false）
├── package-lock.json         # lockfileVersion 3
├── README.md / README.en.md  # 中/英文文档
├── LICENSE                   # AGPL-3.0
├── .gitignore                # .DS_Store, dist/, node_modules/
├── .gitattributes            # vendor/** 标记为 vendored（不影响语言统计）
├── .github/workflows/deploy-pages.yml  # GitHub Pages 自动部署
├── assets/demo.webp          # 演示动图
├── vendor/three/             # 本地化 Three.js 运行时 + OrbitControls / GLTFLoader / BufferGeometryUtils
├── scripts/copy-assets.mjs   # 构建期把 CSS、GLB、模型目录复制到 dist/
├── src/                      # 源码（TypeScript）
│   ├── main.ts               # 应用入口：装配场景、绑定控制与交互、主循环 animate()
│   ├── config.ts             # 全局常量：鱼缸尺寸、水面高度、鱼群/锦鲤/珊瑚/装饰参数、障碍物、排除区
│   ├── types.ts              # 接口：SimulationSettings / Obstacle / FishState / FishConfig 等
│   ├── i18n.ts               # 中英文字典 + applyTranslations（基于 data-i18n 属性）
│   ├── scene-setup.ts        # 场景/渲染器/光照/鱼缸玻璃/地板/气泡列/水面创建
│   ├── camera-rig.ts         # 环绕相机 + 鱼视角相机的切换与插值
│   ├── water-surface.ts      # 水面：GLSL 高度场模拟 + 水波渲染着色器
│   ├── coral-reef.ts         # 珊瑚：7 个 GLB 模型 → InstancedMesh 池 + 生长动画
│   ├── clownfish-school.ts   # 小丑鱼：底栖 boids + 避障 + 实例化渲染
│   ├── fish-school-simulation.ts  # 通用 boids 仿真（沙丁鱼/锦鲤复用）
│   ├── heading-debugger.ts   # 可选的朝向调试工具（URL 参数 debugHeading/debugFrames）
│   ├── random.ts             # mulberry32 / 空间随机 / 均匀分布射线方向
│   ├── styles.css            # UI 样式
│   ├── three-extras.d.ts      # OrbitControls / GLTFLoader 的类型声明
│   ├── decor/
│   │   ├── pineapple-house.ts     # 菠萝屋（GLB 加载 + 程序化 fallback）
│   │   ├── spongebob-patrick.ts  # 海绵宝宝与派大星（GLB 加载 + fallback=null）
│   │   └── models/*.glb
│   └── fish/
│       ├── instanced-school-renderer.ts  # 鱼网格工厂、实例数调整、每帧实例矩阵更新
│       ├── model-loader.ts               # 鱼 GLB 加载（cartoon/clown）、锦鲤派生、fallback 兜底
│       ├── motion-state.ts               # 鱼的 bank / 游泳相位 / 曲率弯曲更新
│       ├── pose.ts                       # 鱼朝向四元数与头部位姿
│       ├── curve-deformation.ts          # 鱼体曲线弯曲的顶点属性
│       ├── spatial-grid.ts               # 均匀空间网格（O(1) 邻居查询）
│       ├── config.ts                     # 鱼的渲染/行为参数
│       └── cartoon.glb / models/clownFish.glb
├── test/
│   ├── simulation.test.ts      # boids 逻辑单元测试（6 个用例）
│   ├── three-resolver.js       # Node 模块注册钩子入口
│   └── three-resolver-hooks.js # 解析 three / three/addons 的自定义钩子
└── dist/                      # 构建产物（gitignored，不提交）
```

**入口与构建产物对应关系**：`index.html` 引用 `./dist/src/main.js` 与 `./dist/src/styles.css`；`tsconfig.rootDir=.` 使 `src/main.ts` 编译到 `dist/src/main.js`，`copy-assets.mjs` 再把 CSS 与 GLB 复制到 `dist/src/...`。

---

## 4. 启动、构建、测试命令

### 安装依赖（首次必需）
```bash
npm install
```
拉取 `typescript` / `three` / `@types/three` / `@types/node` 四个开发依赖（运行时不需，Three.js 已在 `vendor/`）。

### 类型检查
```bash
npm run typecheck      # = tsc --noEmit
```

### 构建
```bash
npm run build         # = tsc && node scripts/copy-assets.mjs
```
产出 `dist/`（含 `dist/src/*.js`、`dist/src/styles.css`、`dist/src/coral/*.glb`、`dist/src/fish/*.glb`、`dist/src/decor/models/*.glb`）。

### 本地运行（注意：不能直接双击 index.html）
```bash
python3 -m http.server 8001
# 浏览器打开 http://127.0.0.1:8001/index.html
```
原因：使用原生 ESM + importmap，`file://` 协议下模块加载会被浏览器拦截，必须走 HTTP 服务器。项目**没有提供 dev server 脚本**，需借助系统自带的 `python3 -m http.server` 或任何静态服务器。

### 测试
```bash
npm test             # = npm run build && node --import ./dist/test/three-resolver.js --test dist/test/*.test.js
```
- 先构建，再用 Node 内置 test runner 运行 `dist/test/*.test.js`。
- 仅覆盖 `fish-school-simulation.ts` 与 `spatial-grid.ts` 的纯逻辑（共 6 个用例：steerTowards 零向量/钳制、limitTurn 小角度与大角度上限、射线命中箱体/球体、空间网格邻居查询、鱼群边界保持、固定种子确定性）。
- 无渲染、水面、珊瑚、i18n、DOM 相关测试。

### 部署
```bash
npm run build
# CI (.github/workflows/deploy-pages.yml) 在 main push 时自动执行：
#   npm ci && npm run build && mkdir _site && cp index.html _site/ && cp -a assets dist vendor _site/
#   → 上传到 GitHub Pages
```
线上演示地址：https://seanwong17.github.io/RippleAquarium/

---

## 5. 新增一个页面应该从哪里开始

**首先要认识到：这是一个单页应用（SPA），整个项目只有 `index.html` 一个页面，没有路由系统。**

因此「新增页面」有两种情形：

**情形 A：在同一个页面内新增一个「视图/面板」（推荐，符合项目架构）**
1. 在 `index.html` 的 `<main id="app">` 内新增一个 `<section class="panel">`，给需要翻译的文案加 `data-i18n` / `data-i18n-title` / `data-i18n-aria-label`。
2. 在 `src/i18n.ts` 的 `translations.zh` 与 `translations.en` 中新增对应 key。
3. 在 `src/main.ts` 中：
   - 如果是控制参数面板，仿照 `controls` 对象与 `createControl()` / `applyControlChange()` 接一条输入 → 应用函数的链路；
   - 如果是一次性展示/功能，在 `animate()` 或某个初始化函数（如 `loadBackgroundSceneDetails()`）中绑定交互；
   - 如果需要每帧更新，在 `animate()` 里调用对应 `update()`；
   - 如果需要相机/渲染相关，在 `scene-setup.ts` 或 `camera-rig.ts` 扩展。
4. 样式加到 `src/styles.css`。
5. `npm run build` 后通过 HTTP 服务器查看。

**情形 B：新增一个真正的独立 HTML 页面（如 About / Settings 页）**
1. 复制 `index.html` 结构，按需修改内容与 `data-i18n` key。
2. 新增对应的入口 TS（如 `src/about.ts`），构建后 `dist/src/about.js`。
3. 因为项目没有路由，需要手动维护页面间的跳转链接。
4. 如果要随 GitHub Pages 一起发布，需在 `.github/workflows/deploy-pages.yml` 的 `cp -a ...` 或 `_site` 准备步骤中确保新页面被拷贝。

**关键文件锚点**：
- 应用装配与主循环：`src/main.ts:1-160`（初始化）、`src/main.ts:518-553`（`animate` 主循环）
- 场景/渲染/光照/气泡：`src/scene-setup.ts`
- 控制面板数据绑定：`src/main.ts:64-88`（controls）、`src/main.ts:386-424`（`applyControlChange`）
- 国际化：`src/i18n.ts`
- 全局常量/参数：`src/config.ts`

---

## 6. 当前项目的明显维护风险

### 6.1 构建与运行链路脆弱
- `index.html` 硬编码引用 `./dist/src/main.js` 和 `./dist/src/styles.css`，而 `dist/` 是 **gitignored 不提交**的。克隆仓库后**必须先 `npm install && npm run build`**，否则页面是空的。新手易踩坑。
- `npm test` 会先执行完整 `npm run build`，测试套件慢且耦合构建。
- 没有 `npm start` / dev server 脚本，本地预览依赖 `python3 -m http.server`（环境需有 Python）。

### 6.2 类型安全宽松
- `tsconfig.json` 中 `strict: false`、`noImplicitAny: false`，只开了 `noImplicitOverride`。大量 `any` 隐式存在（如 `createClownfishSchool(coralReef, ...)` 的 `coralReef` 参数未类型化），IDE 与编译器兜底能力弱，重构风险高。

### 6.3 测试覆盖极低
- 只有 6 个纯逻辑单元测试，且都集中在 boids 数学部分。
- 渲染、水面着色器、珊瑚生长、小丑鱼、i18n、DOM 交互、GLB 加载全部**零测试**。`npm test` 实际上只是「构建 + 跑 6 个断言」。
- 无 CI 测试门禁（工作流只有部署，没有 test 步骤），`npm test` 未接入 CI。

### 6.4 无 lint / format / 提交规范
- 没有 ESLint、Prettier、Husky / lint-staged，代码风格与质量完全依赖作者自觉。
- 提交信息风格不统一（中英混合、动词不一致）。

### 6.5 大型二进制资产直接入库
- `src/fish/cartoon.glb` 达 **4MB**，珊瑚 GLB 7 个、装饰模型 2 个均提交到 git。仓库体积增长快，且不利于 fork/克隆。
- 与 `vendor/three/`（ linguist-vendored 标记）不同，业务 GLB 未做任何 LFS 或外链处理。

### 6.6 第三方资产许可风险
- 项目是 **AGPL-3.0**，但引用的模型资源来自 Sketchfab（CC Attribution）与 GitHub 项目。AGPL 与 CC-BY 的兼容性、以及「衍生作品」界定需要法务确认，README 已提示但未给出明确结论。

### 6.7 隐式状态与热路径耦合
- `config.ts` 中的 `simulationSettings` 是模块级可变对象，`applySimulationSettingsFromControls()` 直接在其中写值；锦鲤用的是模块加载时的浅拷贝 `koiSettings`。两者共享同一份 `SimulationSettings` 形状，一旦结构不一致（如新增字段）容易静默失效。
- `fishConfig.appearanceVariants` 已标注「当前模型 useAppearanceVariants=false，暂未启用」——死配置未清理，易误导后续维护者。
- `koiMesh` 在 `rebuildKoiMesh()` 中由 `createFishMeshByKey("koi")` 创建，但 koi 模型是 `loadFishModel()` 异步返回后才动态 push 进 `fishModels` 的。首次构建时 key 查不到会静默回退到 fallback 模型，依赖时序正确性（代码里有注释说明，但属于隐式约定）。

### 6.8 调试与错误处理
- `headingDebugger` 仅通过 URL 参数 `?debugHeading=1` 开启，是开发期临时工具，未纳入正式测试。
- 模型加载失败时（GLB 损坏/网络失败）全部走 `console.warn` + fallback 静默降级，用户无感知；小丑鱼、珊瑚、装饰物同理。生产环境无错误上报。

### 6.9 文档与实际代码的漂移
- README 中「项目结构」小节列出的文件是简化版，未包含 `camera-rig.ts`、`scene-setup.ts`、`config.ts`、`types.ts`、`decor/`、`fish/` 子目录等实际存在的重要文件，新人按图索骥会找不到入口。
- README「技术实现」表中「实例化渲染绘制主鱼群」等描述与实际一致，但未提及 fallback 鱼模型（程序化生成）在首帧的作用。

### 6.10 性能与浏览器兼容
- 水面用 384×384 的 HalfFloat 双渲染目标 + 每帧一次额外 `renderer.render`，移动端或低配 GPU 上可能有压力（未做降级开关）。
- `renderer.shadowMap` 开启 PCFSoftShadowMap + 2048 阴影贴图，对移动端功耗较大。
- 依赖 `navigator.clipboard.writeText` 与 `document.execCommand` 的 fallback，部分旧浏览器行为不一致。

---

## 7. 总结

这是一个**完成度较高、视觉表现力强的单文件 Three.js 水族箱**：boids 仿真、空间网格优化、GLSL 水面、实例化渲染、i18n 都做得比较扎实，代码注释与变量命名清晰，热路径做了对象复用。

主要短板集中在**工程化**：测试稀疏、类型检查宽松、无 lint/CI 测试门禁、构建产物不入库带来的「首次运行」门槛、大型二进制资产直接入库，以及 AGPL 与第三方 CC 资产的许可兼容性待确认。若要长期维护，建议优先补齐测试与类型严格度，并把 `npm test` 接入 CI。