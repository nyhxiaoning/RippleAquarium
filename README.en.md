<p align="center">
  <span>English</span> | <a href="./README.md">简体中文</a>
</p>

<div align="center">

# 🐠 Ripple Aquarium

**A pure front-end WebGL aquarium · boids fish schools + real-time water ripples**

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
  👉 <a href="https://seanwong17.github.io/RippleAquarium/">Open the Live Demo</a> 👈
</h3>

<p style="font-size: 13px; color: #666;">
  The demo loads the default aquarium scene. Click or drag on the water surface to create ripples.
</p>

<img src="assets/demo.webp" alt="Ripple Aquarium demo" width="80%">

</div>

---

## 📋 Introduction

**Ripple Aquarium** is a 3D aquarium that runs in real time in your browser — nothing to install, just open the page and play.

A whole tank of fish swims on its own using boids flocking: they gather, turn, and steer around each other. When a fish nears the surface, or you click and drag on the water, real ripples spread out across it. Meanwhile the coral grows from nothing into a full reef as the page loads. Every effect is computed frame by frame in WebGL, making a small world that runs itself rather than a pre-recorded clip.

---

## ✨ Core Features

| Module | Description |
|--------|-------------|
| **Fish schools** | Sardines and koi move as independent schools using the same boids behavior, with separate count, speed, and behavior controls |
| **Clownfish** | Bottom-dwelling movement around the reef and the small water region above it, with coral avoidance |
| **Water surface** | Height-field water simulation triggered by mouse clicks, mouse drags, and fish near the waterline |
| **Coral reef** | On page load or refresh, corals grow from zero count and zero scale into the default reef |
| **Control drawer** | Collapsible right-side panel for fish, water, coral, lighting, and visual parameters |
| **Internationalization** | The UI and README support Chinese and English |
| **Deployment** | TypeScript-built static frontend deployable on GitHub Pages |

---

## 🚀 Quick Start

This is a TypeScript + Three.js + Vite project with no backend dependency. The development environment watches files and supports hot updates, while the production build can be deployed directly to GitHub Pages.

Requirements: Node.js `20.19+`, `22.12+`, or `24+` (odd-numbered Node 23 is not supported). Use the npm version bundled with a supported Node.js release.

### 1. Get the project

```bash
git clone https://github.com/SeanWong17/RippleAquarium.git
cd RippleAquarium
```

### 2. Install dependencies

```bash
npm install
```

### 3. Start live development

```bash
npm run dev
```

Open the local URL printed in the terminal. Vite watches TypeScript, CSS, and model assets; CSS updates immediately, while Three.js module changes reload the page and initialize a clean scene.

### 4. Test, type-check, and build for production

```bash
npm test
npm run typecheck
npm run build
```

Production files are written to `dist/`. The build command runs the TypeScript type check before Vite bundles the application.

### 5. Preview the production build

```bash
npm run preview
```

Open the preview URL printed in the terminal to verify the actual `dist/` output.

---

## 🎮 Controls

| Action | Result |
|--------|--------|
| Click the water surface | Create one ripple |
| Hold and drag on the water surface | Create continuous ripples along the drag path |
| Right-side button | Hide or show the control drawer |
| Top-left language buttons | Switch between Chinese and English |
| Top-left GitHub icon | Open the repository |
| Space | Switch between the orbit camera and fish camera |
| `1` / `2` | Show or hide UI panels |

---

## 🛠️ Technical Notes

| Module | Implementation |
|--------|----------------|
| **Rendering** | Three.js + WebGL, with instanced rendering for the main fish schools |
| **Boids** | Alignment, cohesion, separation, obstacle avoidance, boundary steering, and independent school parameters |
| **Performance** | A uniform spatial grid powers neighbour queries, reducing the flocking cost from O(n²) to roughly O(n); hot paths reuse objects to avoid per-frame allocation |
| **Fish motion** | Fish orientation follows velocity and pose changes; koi reuse sardine behavior while keeping a thicker body shape |
| **Ripples** | Water mesh height-field propagation with mouse-triggered and fish-triggered disturbance |
| **Coral growth** | The initialization sequence drives each coral from small to full size |
| **Tooling** | Vite provides the development server, CSS hot updates, TypeScript/GLB asset handling, and production builds; Vitest runs TypeScript tests directly |
| **Dependencies** | Three.js is an npm runtime dependency; TypeScript, Vite, Vitest, and type declarations are development dependencies |
| **i18n** | Lightweight frontend dictionary for Chinese/English UI text |

### Project Structure

```text
RippleAquarium/
├── assets/                 # README demo GIF
├── src/
│   ├── aquarium/           # Aquarium configuration, presets, scene building, and project panel
│   ├── fish/               # Fish model loading, pose, deformation, instanced rendering, and spatial grid
│   ├── coral/              # Coral model assets
│   ├── fish-school-simulation.ts
│   ├── water-surface.ts
│   ├── coral-reef.ts
│   ├── clownfish-school.ts
│   ├── i18n.ts
│   └── main.ts
├── test/                   # Vitest unit tests
├── dist/                   # Vite production output (generated locally, not committed)
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── README.md
├── README.en.md
└── LICENSE
```

---

## 🙏 Credits And References

This project integrates, adapts, and redesigns ideas and assets from these public/open-source projects and model resources:

| Project | Reference |
|---------|-----------|
| [vibe-motion/threejs-boids](https://github.com/vibe-motion/threejs-boids) | Base fish-school behavior, sardine-style boids movement, Three.js scene, and instanced fish rendering |
| [aisparkedu/ripple](https://github.com/aisparkedu/ripple) | Interactive water-ripple behavior, adapted here into mouse-triggered and fish-triggered aquarium surface waves |
| [Jaydeep-P/aquarium](https://github.com/Jaydeep-P/aquarium) | Aquarium visual direction, coral, clownfish, and koi references; coral and clownfish model assets in this project come from that project |
| [Bfbbr-SpongeBob Pineapple House](https://sketchfab.com/3d-models/bfbbr-spongebob-pineapple-house-4e2d36c5f95645448b44af409432ae82) | Pineapple house seabed decor model by SMF Features Developed From Cheryl Hill, listed on Sketchfab as CC Attribution |
| [NASB2 - SpongeBob and Patrick](https://sketchfab.com/3d-models/nasb2-spongebob-and-patrick-717a58577d554b86802162db847c7f13) | Character seabed decor model by SMF Features Developed From Cheryl Hill, listed on Sketchfab as CC Attribution |

If you redistribute or deploy this project, keep these credits and review the license requirements of the upstream projects as well.

---

## 🤝 Contribution

Issues and Pull Requests are welcome.

* **Issues**: [Bug reports and feature requests](https://github.com/SeanWong17/RippleAquarium/issues)
* **Pull Requests**: [Submit improvements](https://github.com/SeanWong17/RippleAquarium/pulls)

---

## 📄 License

This project is licensed under the [GNU Affero General Public License v3.0](./LICENSE).

---

<div align="center">
  <br>
  Made with ❤️ by <a href="https://github.com/seanwong17">seanwong17</a>
</div>
