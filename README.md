<p align="center">
  <a href="./README.en.md">English</a> | <span>简体中文</span>
</p>

<div align="center">

# 🐠 涟漪鱼缸

**纯前端 WebGL 水族箱 · boids 鱼群 + 实时水面涟漪**

<p>
  <a href="https://www.gnu.org/licenses/agpl-3.0.html">
    <img src="https://img.shields.io/badge/License-AGPL--3.0-blue.svg?style=flat-square" alt="License">
  </a>
  <a href="https://threejs.org/">
    <img src="https://img.shields.io/badge/Three.js-WebGL-black?style=flat-square&logo=three.js" alt="Made with Three.js">
  </a>
  <a href="https://github.com/SeanWong17/RippleAquarium/pulls">
    <img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square" alt="PRs Welcome">
  </a>
  <a href="https://seanwong17.github.io/RippleAquarium/">
    <img src="https://img.shields.io/badge/Demo-GitHub%20Pages-2ea44f?style=flat-square&logo=github" alt="Live Demo">
  </a>
</p>

<h3>
  👉 <a href="https://seanwong17.github.io/RippleAquarium/">点击查看在线演示 (Live Demo)</a> 👈
</h3>

<p style="font-size: 13px; color: #666;">
  注：在线演示会直接加载默认鱼缸场景，支持鼠标点击/拖动水面触发涟漪。
</p>

<img src="assets/demo.webp" alt="涟漪鱼缸演示" width="80%">

</div>

---

## 📋 项目简介

**涟漪鱼缸** 是一个在浏览器里实时运行的 3D 水族箱，无需安装，打开网页就能玩。

整缸鱼用 boids 群体行为自主游动，会聚集、转向、互相避让；鱼游近水面或你点击、拖动水面，都会荡开真实传播的水波；珊瑚则在页面打开时从无到有、慢慢生长成形。所有效果都在 WebGL 里逐帧实时计算，构成一个会自我运转的小世界，而不是一段预录动画。

---

## ✨ 核心特性

| 模块 | 功能描述 |
|------|----------|
| **鱼群** | 沙丁鱼、锦鲤、天使鱼、蓝吊鱼和河豚独立集群活动，使用一致的 boids 行为逻辑，支持数量、速度和行为参数调节 |
| **小丑鱼** | 底栖活动模式，会在珊瑚和海葵附近巡游，并避开装饰物 |
| **鱼类成长记录** | 为每条鱼保存独立 ID、年龄、成长阶段和体型；支持在线成长、离线补算与成长记录导出 |
| **天气变化** | 晴天、雨天、雪天和阴天由右侧四个按钮手动切换；天气会联动光照、水面、鱼速和成长速度 |
| **海洋生物多样性** | 海葵、海胆、贝壳和水母与珊瑚、海草共同组成分层生态景观 |
| **扩容鱼缸** | 默认半尺寸为 `14 × 8 × 11`（完整尺寸 `28 × 16 × 22`），鱼类按上层、中层、下层和珊瑚礁区域活动 |
| **海绵宝宝主题** | 章鱼哥、蟹老板、章鱼哥房屋和蟹堡王主题道具，配有低幅度待机动画和独立开关 |
| **水面** | 高度场水面模拟，鱼靠近水线、鼠标点击和鼠标拖动都可以触发涟漪 |
| **珊瑚** | 页面打开或刷新时从 0 个、0 尺寸逐步生长到默认状态，营造生命感 |
| **控制面板** | 右侧可折叠菜单，提供鱼群、水面、珊瑚、光照和显示效果等中文参数 |
| **多语言** | 可视化界面和 README 支持中文/英文切换 |
| **部署** | TypeScript 构建后的静态前端项目，可部署到 GitHub Pages |

### 鱼类成长与存档

每条鱼都有独立的稳定 ID。鱼类从幼鱼开始，默认按累计模拟时间成长：0–20 分钟为幼鱼，20–80 分钟为成长期，80 分钟进入成鱼阶段，累计 120 分钟达到完整体型。体型会平滑变化，不会在阶段边界突然跳变。

- 只有模拟正在播放时才会累计在线成长；点击“暂停”或使用暂停状态下的单步不会产生额外的后台成长。
- 重新打开页面时会根据上次保存时间补算离线成长，最多补算 24 小时。
- 成长记录保存在浏览器的 `localStorage` 中，不依赖后端服务；通常每 10 秒自动保存一次，页面隐藏或离开时也会尝试立即保存。
- 控制面板的“鱼类成长”区域会显示鱼数、平均成长、各鱼种统计和单鱼记录，并提供“导出成长记录”和确认后的“重置成长记录”。导出文件为 JSON，可用于备份或检查。

成长记录只保存鱼类个体的年龄和体型，不会改变存档格式；天气倍率只在运行时生效。切换样式、调整数量或缩放鱼缸不会丢失已有鱼的稳定 ID。

### 天气与海洋生态

右侧项目面板提供晴天、雨天、雪天和阴天四个天气按钮，天气不会自动循环或随机切换。每次选择会在 8 秒内平滑过渡：晴天光照和活动最强，阴天更柔和，雨天增加水面扰动，雪天显示缓慢下落的雪花并降低鱼速与成长倍率。

默认鱼缸包含六种主要鱼类（沙丁鱼、锦鲤、小丑鱼、天使鱼、蓝吊鱼和河豚）以及海葵、海胆、贝壳和水母。鱼类会遵守上层、中层、下层和珊瑚礁栖息层；小缸预设降低鱼和生态生物数量，以保持紧凑画面。面板中的滑块使用每种目录的容量上限，扩容只会增加活动空间，不会自动无限生成鱼。

沙丁鱼、锦鲤、小丑鱼、海星、神仙鱼、蓝吊鱼和河豚全部使用纯程序化 Three.js 网格：平滑鱼身、独立尾鳍/背鳍/胸鳍、物种配色分区、眼睛与河豚少量刺点全部在运行时生成，不依赖新增外部模型文件，并继续使用实例化渲染和成长缩放。

当前版本明确不包含食物链、水质变化、繁殖、死亡或捕食模拟；这些是未来可以在现有运行时接口上继续扩展的方向。性能下降时会优先减少水母、雨滴和装饰实例，保留鱼群核心模拟。

### 海绵宝宝主题内容

默认鱼缸在左右后侧提供两处主题角落：左侧是章鱼哥和章鱼哥房屋（复活节岛头像风格），右侧是蟹老板和蟹堡王招牌/柜台。角色和道具固定锚定在缸底，使用独立的碰撞与鱼群避让区域；它们不会加入 boids 鱼群，也不会写入鱼类成长存档。

- 章鱼哥使用灰蓝色身体和紫色触手，触手以不同相位缓慢摆动，身体做轻微左右晃动。
- 蟹老板使用红色身体、蓝色衣物和黄色眼睛，两只钳子交替开合，身体偶尔轻微前倾。
- 主题角色、房屋和蟹堡王道具全部由 Three.js 基础几何程序化生成，不增加新的 GLB、贴图、音频或网络依赖；共享材质和低多边形几何有助于保持场景轻量。
- 右侧面板的“海绵宝宝主题”区域可以分别显示/隐藏章鱼哥、蟹老板及两处道具，切换主题待机动画，并调整角色缩放。主题设置属于运行时场景配置，与成长存档分离。
- 珊瑚礁和深海预设会缩小主题道具，为生态景观留出空间；小缸预设将角色缩放到约 65%–75%，必要时隐藏较大的主题道具，避免遮挡鱼群。

主题模块已经暴露角色锚点和可选回调，但当前版本不绑定点击监听、对话框或任务。后续可以在不重写场景生命周期的前提下增加点击互动、台词提示、收集品挂点或小游戏触发器。

---

## 🚀 快速开始

这是一个 TypeScript + Three.js + Vite 项目，不依赖后端服务。开发环境支持文件监听与热更新，生产构建可直接部署到 GitHub Pages。

环境要求：Node.js `20.19+`、`22.12+` 或 `24+`（不支持奇数版 Node 23），npm 使用随受支持 Node.js 版本提供的版本即可。

### 1. 获取项目

```bash
git clone https://github.com/SeanWong17/RippleAquarium.git
cd RippleAquarium
```

### 2. 安装依赖

```bash
npm install
```

### 3. 启动实时开发

```bash
npm run dev
```

打开终端输出的本地地址。Vite 会监听 TypeScript、CSS 与模型资源变化；CSS 会即时热更新，Three.js 模块修改后页面会自动刷新并重新初始化场景。

### 4. 测试、类型检查与生产构建

```bash
npm test
npm run typecheck
npm run build
```

生产文件生成到 `dist/`。构建命令会先运行 TypeScript 类型检查，再执行 Vite 打包。

### 5. 预览生产构建

```bash
npm run preview
```

打开终端输出的预览地址，验证实际 `dist/` 产物。

---

## 🎮 交互方式

| 操作 | 效果 |
|------|------|
| 鼠标点击水面 | 产生一次涟漪 |
| 鼠标按住并拖动水面 | 沿拖动路径产生连续涟漪 |
| 右侧按钮 | 隐藏或显示参数面板 |
| 左上角语言按钮 | 在中文和英文界面之间切换 |
| 左上角 GitHub 图标 | 跳转到项目仓库 |
| 空格键 | 在外部环绕相机和鱼视角相机之间切换 |
| `1` / `2` | 显示或隐藏界面面板 |
| 主题面板 | 单独控制章鱼哥、蟹老板、主题道具、待机动画和角色缩放 |

---

## 🛠️ 技术实现

| 模块 | 实现要点 |
|------|----------|
| **渲染** | Three.js + WebGL，使用实例化渲染绘制主鱼群 |
| **鱼群行为** | boids 对齐、聚集、分离、避障、边界回避与独立鱼群参数 |
| **性能** | 使用均匀空间网格做邻居查询，将鱼群行为从 O(n²) 降到近 O(n)，热路径复用对象避免每帧分配 |
| **鱼体运动** | 基于速度方向和姿态变化驱动鱼体朝向，锦鲤复用沙丁鱼行为逻辑并保留更粗胖的体型 |
| **水面涟漪** | 使用水面网格高度场传播波动，支持鼠标与鱼体触发 |
| **珊瑚生长** | 初始化阶段按统一成长进度驱动每个珊瑚从小到大生长 |
| **主题内容** | `src/theme/` 使用共享低多边形几何创建章鱼哥、蟹老板及主题道具；动画只更新预存的部件引用，热路径不分配数组、颜色或 Three.js 对象 |
| **工程化** | Vite 提供开发服务器、CSS 热更新、TypeScript/GLB 资源处理和生产构建；Vitest 直接运行 TypeScript 测试 |
| **依赖** | Three.js 作为 npm 运行依赖；TypeScript、Vite、Vitest 与类型声明作为开发依赖 |
| **国际化** | 轻量级前端 i18n 字典，界面文案可在中英文之间切换 |

### 项目结构

```text
RippleAquarium/
├── assets/                 # README 演示动图
├── src/
│   ├── aquarium/           # 水族箱配置、预设、场景构建与项目面板
│   ├── fish/               # 鱼模型加载、姿态、变形、实例化渲染与空间网格
│   ├── coral/              # 珊瑚模型资源
│   ├── theme/              # 主题角色、道具、动画和目录
│   ├── fish-school-simulation.ts
│   ├── water-surface.ts
│   ├── coral-reef.ts
│   ├── clownfish-school.ts
│   ├── i18n.ts
│   └── main.ts
├── test/                   # Vitest 单元测试
├── dist/                   # Vite 生产构建产物（本地生成，不提交）
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── README.md
├── README.en.md
└── LICENSE
```

---

## 🙏 项目来源与参考

本项目是在以下开源/公开项目和模型资源基础上整合、改造和再设计得到的：

| 项目 | 借鉴内容 |
|------|----------|
| [vibe-motion/threejs-boids](https://github.com/vibe-motion/threejs-boids) | 当前项目的鱼群行为基础，提供沙丁鱼式 boids 运动、Three.js 场景和实例化鱼群渲染的起点 |
| [aisparkedu/ripple](https://github.com/aisparkedu/ripple) | 参考水面涟漪交互思路，并改造成当前鱼缸中的鼠标/鱼体触发水波效果 |
| [Jaydeep-P/aquarium](https://github.com/Jaydeep-P/aquarium) | 参考水族箱题材资源，借鉴珊瑚、小丑鱼和锦鲤等视觉元素方向；当前项目中珊瑚和小丑鱼模型资源来自该项目 |
| [Bfbbr-SpongeBob Pineapple House](https://sketchfab.com/3d-models/bfbbr-spongebob-pineapple-house-4e2d36c5f95645448b44af409432ae82) | 鱼缸底部菠萝屋装饰模型，作者 SMF Features Developed From Cheryl Hill，Sketchfab 标注为 CC Attribution |
| [NASB2 - SpongeBob and Patrick](https://sketchfab.com/3d-models/nasb2-spongebob-and-patrick-717a58577d554b86802162db847c7f13) | 鱼缸底部角色装饰模型，作者 SMF Features Developed From Cheryl Hill，Sketchfab 标注为 CC Attribution |

如果你继续分发或部署本项目，请保留这些来源说明，并检查上游项目的许可证要求。

---

## 🤝 贡献与反馈

欢迎提交 Issue 或 Pull Request。

* **Issues**: [Bug 反馈与功能建议](https://github.com/SeanWong17/RippleAquarium/issues)
* **Pull Requests**: [提交改进](https://github.com/SeanWong17/RippleAquarium/pulls)

---

## 📄 License

本项目使用 [GNU Affero General Public License v3.0](./LICENSE)。

---

<div align="center">
  <br>
  Made with ❤️ by <a href="https://github.com/seanwong17">seanwong17</a>
</div>
