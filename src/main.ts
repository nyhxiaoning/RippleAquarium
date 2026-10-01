import "./styles.css";
import * as THREE from "three";
import { DEFAULT_STYLE } from "./aquarium/presets.js";
import { createAquariumManager } from "./aquarium/manager.js";
import { createProjectPanel } from "./aquarium/ui-panel.js";
import { createCameraRig, bindCameraToggle } from "./camera-rig.js";
import {
  applyTranslations,
  getLanguage,
  setLanguage,
  t,
} from "./i18n.js";
import { createRenderer, createScene } from "./scene-setup.js";
import { createHeadingDebugger } from "./heading-debugger.js";

const STEP_FRAME_SECONDS = 1 / 60;
const baseMinSpeed = 3;
const baseMaxSpeed = 7.5;
const app = getRequiredElement("#app");
const canvas = getRequiredElement("#scene");
const renderer = createRenderer(canvas);
const scene = createScene();
const clock = new THREE.Clock();
const cameraRig = createCameraRig(renderer);
const query = new URLSearchParams(window.location.search);
const headingDebugger = createHeadingDebugger({
  enabled: query.get("debugHeading") === "1",
  frameLimit: Number(query.get("debugFrames")) || undefined,
});

const manager = createAquariumManager(DEFAULT_STYLE, {
  renderer,
  scene,
  cameraRig,
});

// Theme characters expose interaction anchors for a later click/dialog
// feature. Keep the hook intentionally inert until that feature is designed;
// no pointer listener invokes it in this release.
manager.setThemeInteractionCallback((_id, _anchor) => {});

const controls = {
  count: createControl("#count", "#count-value"),
  koiCount: createControl("#koi-count", "#koi-count-value"),
  perception: createControl("#perception", "#perception-value"),
  speedScale: createControl("#speed-scale", "#speed-scale-value"),
  separation: createControl("#separation", "#separation-value"),
  avoidance: createControl("#avoidance", "#avoidance-value"),
  turnRate: createControl("#turn-rate", "#turn-rate-value"),
  topMargin: createControl("#top-margin", "#top-margin-value"),
  koiPerception: createControl("#koi-perception", "#koi-perception-value"),
  koiSeparation: createControl("#koi-separation", "#koi-separation-value"),
  koiAvoidance: createControl("#koi-avoidance", "#koi-avoidance-value"),
  koiTurnRate: createControl("#koi-turn-rate", "#koi-turn-rate-value"),
  koiTopMargin: createControl("#koi-top-margin", "#koi-top-margin-value"),
  koiSpeedScale: createControl("#koi-speed-scale", "#koi-speed-scale-value"),
  waterForce: createControl("#water-force", "#water-force-value"),
  waterRadius: createControl("#water-radius", "#water-radius-value"),
  waterHeight: createControl("#water-height", "#water-height-value"),
  waterPersistence: createControl("#water-persistence", "#water-persistence-value"),
  surfaceBand: createControl("#surface-band", "#surface-band-value"),
  coralCount: createControl("#coral-count", "#coral-count-value"),
  coralScale: createControl("#coral-scale", "#coral-scale-value"),
  clownfishCount: createControl("#clownfish-count", "#clownfish-count-value"),
  light: createControl("#light", "#light-value"),
};

const simulationControlSettings = {
  perception: "perceptionRadius",
  separation: "separateWeight",
  avoidance: "avoidCollisionWeight",
  turnRate: "maxTurnRate",
  topMargin: "topBoundaryMargin",
};
const koiControlSettings = {
  koiPerception: "perceptionRadius",
  koiSeparation: "separateWeight",
  koiAvoidance: "avoidCollisionWeight",
  koiTurnRate: "maxTurnRate",
  koiTopMargin: "topBoundaryMargin",
};

let simulationPaused = false;
let pendingSimulationSteps = 0;
let simulationTime = 0;
const waterPointer = {
  raycaster: new THREE.Raycaster(),
  pointer: new THREE.Vector2(),
  previousPoint: null,
};
let controlsPanelHidden = false;
let coralIntro: {
  startedAt: number;
  duration: number;
  targetCount: number;
  targetScale: number;
  growthBuffer: number[];
} | null = null;

const fishSurfaceState = new WeakMap();

bindControls();
bindPlaybackControls();
bindCameraToggle(cameraRig);
bindUiPanelShortcuts();
bindControlsPanel();
bindLanguageSwitcher();
bindWaterPointer();
const cameraPanel = bindCameraPanel(cameraRig);
const modelLoading = bindModelLoading();
createProjectPanel(manager, getRequiredElement("#control-panel"));

// Growth snapshots are browser-local and should be flushed whenever the page
// is backgrounded or discarded. These events are synchronous by design.
const saveGrowthOnPageLifecycle = () => {
  if (document.visibilityState === "hidden") manager.saveGrowth();
};
document.addEventListener("visibilitychange", saveGrowthOnPageLifecycle);
window.addEventListener("pagehide", () => manager.saveGrowth());

// Build the default scene immediately (fallback fish models), then hot-swap to
// the high-detail GLBs once they stream in.
void manager.init().then(() => {
  applySimulationSettingsFromControls();
  applyKoiSettingsFromControls();
  applyWaterSettingsFromControls();
  startCoralIntro();
  modelLoading.finish();
});
manager.on("change", () => {
  syncControlsToggle();
});

resize();
window.addEventListener("resize", resize);
renderer.setAnimationLoop(animate);

function bindControls() {
  for (const [key, control] of Object.entries(controls)) {
    syncControlOutput(control);
    control.input.addEventListener("input", () => {
      syncControlOutput(control);
      applyControlChange(key);
    });
  }
}

function bindPlaybackControls() {
  const toggleButton = getRequiredElement("#playback-toggle");
  const stepButton = getRequiredElement("#step-frame");

  toggleButton.addEventListener("click", () => {
    simulationPaused = !simulationPaused;
    if (!simulationPaused) {
      pendingSimulationSteps = 0;
    }
    syncPlaybackControls(toggleButton, stepButton);
  });

  stepButton.addEventListener("click", () => {
    if (!simulationPaused) return;
    pendingSimulationSteps += 1;
  });

  syncPlaybackControls(toggleButton, stepButton);
}

function bindLanguageSwitcher() {
  applyCurrentLanguage();

  document.querySelectorAll<HTMLElement>(".lang-btn").forEach((button) => {
    button.addEventListener("click", () => {
      if (!setLanguage(button.dataset.lang)) return;
      applyCurrentLanguage();
      // Dynamic project controls (including weather) listen for this event so
      // their labels are rebuilt in the newly selected language.
      document.dispatchEvent(new Event("languagechange"));
    });
  });
}

function applyCurrentLanguage() {
  applyTranslations();
  syncLanguageButtons();
  syncControlsToggle();
  syncPlaybackControls(
    getRequiredElement("#playback-toggle"),
    getRequiredElement("#step-frame"),
  );
}

function syncLanguageButtons() {
  const language = getLanguage();
  document.querySelectorAll<HTMLElement>(".lang-btn").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.lang === language);
  });
}

function bindUiPanelShortcuts() {
  window.addEventListener("keydown", (event) => {
    if (event.repeat) return;

    if (event.key === "2") {
      event.preventDefault();
      app.dataset.uiPanels = "hidden";
    } else if (event.key === "1") {
      event.preventDefault();
      app.dataset.uiPanels = "visible";
    }
  });
}

function bindControlsPanel() {
  const toggleButton = getRequiredElement("#controls-toggle");

  toggleButton.addEventListener("click", () => {
    controlsPanelHidden = !controlsPanelHidden;
    app.dataset.controlsPanel = controlsPanelHidden ? "hidden" : "visible";
    syncControlsToggle();
  });
}

function syncControlsToggle() {
  const toggleButton = getRequiredElement("#controls-toggle");
  toggleButton.textContent = controlsPanelHidden ? t("showParams") : t("hideParams");
  toggleButton.setAttribute("aria-expanded", String(!controlsPanelHidden));
}

function bindWaterPointer() {
  canvas.addEventListener("mousedown", (event) => {
    if (event.target !== canvas) return;
    if (event.button !== 0) return;

    const point = getWaterIntersection(event);
    if (!point) return;

    event.preventDefault();
    manager.getWaterSurface().queueImpact(point);
    waterPointer.previousPoint = point.clone();
  });

  canvas.addEventListener("mousemove", (event) => {
    if ((event.buttons & 1) === 0 || !waterPointer.previousPoint) return;

    const point = getWaterIntersection(event);
    if (!point) return;

    event.preventDefault();
    manager.getWaterSurface().queueImpact(waterPointer.previousPoint, point);
    waterPointer.previousPoint.copy(point);
  });

  window.addEventListener("mouseup", () => {
    waterPointer.previousPoint = null;
  });

  canvas.addEventListener("mouseleave", () => {
    waterPointer.previousPoint = null;
  });
}

function getWaterIntersection(event) {
  const rect = canvas.getBoundingClientRect();
  waterPointer.pointer.set(
    ((event.clientX - rect.left) / rect.width) * 2 - 1,
    -((event.clientY - rect.top) / rect.height) * 2 + 1,
  );
  waterPointer.raycaster.setFromCamera(waterPointer.pointer, cameraRig.activeCamera);

  const halfSize = manager.getHalfSize();
  const directionY = waterPointer.raycaster.ray.direction.y;
  if (Math.abs(directionY) < 0.000001) return null;

  const distance = (manager.getWaterLevelY() - waterPointer.raycaster.ray.origin.y) / directionY;
  if (distance < 0) return null;

  const point = waterPointer.raycaster.ray.at(distance, new THREE.Vector3());
  if (Math.abs(point.x) > halfSize.x || Math.abs(point.z) > halfSize.z) {
    return null;
  }

  return point;
}

function queueFishSurfaceImpacts(fish) {
  const surfaceBand = readControlValue("surfaceBand");
  const cooldownSeconds = 0.16;

  for (const item of fish) {
    const distanceToSurface = manager.getWaterLevelY() - item.position.y;
    const previous = fishSurfaceState.get(item);

    if (
      distanceToSurface >= 0 &&
      distanceToSurface < surfaceBand &&
      item.velocity.y > -0.08 &&
      (!previous || simulationTime - previous.time > cooldownSeconds)
    ) {
      const previousPoint = previous?.point ?? item.position;
      manager.getWaterSurface().queueImpact(previousPoint, item.position);
      fishSurfaceState.set(item, {
        time: simulationTime,
        point: item.position.clone(),
      });
      continue;
    }

    if (!previous) {
      fishSurfaceState.set(item, {
        time: -Infinity,
        point: item.position.clone(),
      });
    } else {
      previous.point.copy(item.position);
    }
  }
}

function syncPlaybackControls(toggleButton, stepButton) {
  toggleButton.textContent = simulationPaused ? t("resume") : t("pause");
  toggleButton.setAttribute("aria-pressed", String(simulationPaused));
  stepButton.disabled = !simulationPaused;
}

function applyControlChange(key) {
  if (key === "count") {
    manager.setFishCount("sardine", readControlValue(key));
    return;
  }

  if (key === "koiCount") {
    manager.setFishCount("koi", readControlValue(key));
    return;
  }

  if (key === "light") {
    manager.getLighting().setIntensity(readControlValue(key));
    return;
  }

  if (key === "clownfishCount") {
    manager.setFishCount("clownfish", readControlValue(key));
    return;
  }

  if (key.startsWith("coral")) {
    applyCoralSettingsFromControls();
    return;
  }

  if (key.startsWith("water") || key === "surfaceBand") {
    applyWaterSettingsFromControls();
    return;
  }

  if (key.startsWith("koi")) {
    applyKoiSettingsFromControls();
    return;
  }

  applySimulationSettingsFromControls();
}

function applySimulationSettingsFromControls() {
  const patch: Record<string, number> = {};
  for (const [key, settingName] of Object.entries(simulationControlSettings)) {
    patch[settingName] = readControlValue(key);
  }
  manager.setBoidsSettings("sardine", patch);
  manager.setBoidsSpeedScale("sardine", readControlValue("speedScale"));
}

function applyKoiSettingsFromControls() {
  const patch: Record<string, number> = {};
  for (const [key, settingName] of Object.entries(koiControlSettings)) {
    patch[settingName] = readControlValue(key);
  }
  manager.setBoidsSettings("koi", patch);
  manager.setBoidsSpeedScale("koi", readControlValue("koiSpeedScale"));
}

function applyWaterSettingsFromControls() {
  manager.getWaterSurface().setSettings({
    force: readControlValue("waterForce"),
    radius: readControlValue("waterRadius"),
    displacement: readControlValue("waterHeight"),
    persistence: readControlValue("waterPersistence"),
  });
}

function applyCoralSettingsFromControls() {
  manager.setPlantSettings("coral", {
    count: readControlValue("coralCount"),
    scale: readControlValue("coralScale"),
  });
}

function startCoralIntro() {
  const targetCount = readControlValue("coralCount");
  const targetScale = readControlValue("coralScale");
  const maxCount = manager.getCoralMaxCount();
  coralIntro = {
    startedAt: performance.now(),
    duration: 3600,
    targetCount,
    targetScale,
    growthBuffer: new Array(maxCount).fill(0),
  };
  manager.setCoralGrowth(0, 0, new Array(maxCount).fill(0));
}

function updateCoralIntro() {
  if (!coralIntro) return;

  const progress = Math.min(
    1,
    (performance.now() - coralIntro.startedAt) / coralIntro.duration,
  );
  const growth = coralIntro.growthBuffer;
  let visibleCount = 0;
  for (let index = 0; index < growth.length; index += 1) {
    if (index >= coralIntro.targetCount) {
      growth[index] = 0;
      continue;
    }

    const orderProgress = index / Math.max(1, coralIntro.targetCount - 1);
    const local = THREE.MathUtils.clamp((progress - orderProgress * 0.58) / 0.42, 0, 1);
    const value = local * local * (3 - 2 * local);
    growth[index] = value;
    if (value > 0.001) visibleCount += 1;
  }

  manager.setCoralGrowth(visibleCount, coralIntro.targetScale, growth);

  if (progress >= 1) {
    manager.setCoralGrowth(coralIntro.targetCount, coralIntro.targetScale, null);
    coralIntro = null;
  }
}

function animate() {
  const frameDt = Math.min(clock.getDelta(), 1 / 30);
  const simulationDt = getSimulationDelta(frameDt);

  if (simulationDt > 0) {
    simulationTime += simulationDt;
    manager.update(simulationTime, simulationDt);

    const cameraFish = manager.getCameraFish();
    headingDebugger?.sample({
      dt: simulationDt,
      fish: cameraFish ?? undefined,
      trace: null,
    });
    cameraRig.updateFishCamera(cameraFish, simulationDt);

    queueFishSurfaceImpacts(cameraFish ? [cameraFish] : []);
  }

  updateCoralIntro();
  cameraRig.update();
  cameraPanel.update();
  renderer.render(scene, cameraRig.activeCamera);
}

function getSimulationDelta(frameDt) {
  if (!simulationPaused) {
    return frameDt;
  }

  if (pendingSimulationSteps <= 0) {
    return 0;
  }

  pendingSimulationSteps -= 1;
  return STEP_FRAME_SECONDS;
}

function resize() {
  const width = Math.max(1, window.innerWidth);
  const height = Math.max(1, window.innerHeight);
  cameraRig.resize(width, height);
  renderer.setSize(width, height, false);
  cameraPanel.update();
}

function bindCameraPanel(rig) {
  const copyButton = getRequiredElement("#copy-camera-json");
  const copyStatus = getRequiredElement("#copy-camera-status");
  let copyStatusTimeout = 0;

  copyButton.addEventListener("click", async () => {
    const json = JSON.stringify(readCameraTransformSnapshot(rig), null, 2);
    const copied = await copyText(json);
    copyStatus.textContent = copied ? t("copySuccess") : t("copyFailed");
    window.clearTimeout(copyStatusTimeout);
    copyStatusTimeout = window.setTimeout(() => {
      copyStatus.textContent = "";
    }, 1800);
  });

  return { update() {} };
}

function bindModelLoading() {
  const container = getRequiredElement("#model-loading");

  return {
    finish() {
      container.classList.add("is-complete");
      container.setAttribute("aria-hidden", "true");
      container.hidden = true;
    },
  };
}

function readCameraTransformSnapshot(rig) {
  const camera = rig.activeCamera;

  return {
    mode: rig.mode,
    transform: {
      position: vectorToJSON(camera.position),
      rotation: {
        x: roundCameraNumber(camera.rotation.x),
        y: roundCameraNumber(camera.rotation.y),
        z: roundCameraNumber(camera.rotation.z),
        order: camera.rotation.order,
      },
      quaternion: {
        x: roundCameraNumber(camera.quaternion.x),
        y: roundCameraNumber(camera.quaternion.y),
        z: roundCameraNumber(camera.quaternion.z),
        w: roundCameraNumber(camera.quaternion.w),
      },
      up: vectorToJSON(camera.up),
    },
  };
}

async function copyText(text) {
  if (!navigator.clipboard?.writeText) {
    return fallbackCopyText(text);
  }

  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return fallbackCopyText(text);
  }
}

function fallbackCopyText(text) {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.top = "-999px";
  document.body.append(textarea);
  textarea.focus();
  textarea.select();

  try {
    return document.execCommand("copy");
  } finally {
    textarea.remove();
  }
}

function vectorToJSON(vector) {
  return {
    x: roundCameraNumber(vector.x),
    y: roundCameraNumber(vector.y),
    z: roundCameraNumber(vector.z),
  };
}

function roundCameraNumber(value) {
  return Number(value.toFixed(4));
}

function createControl(inputSelector, outputSelector) {
  return {
    input: getRequiredInput(inputSelector),
    output: getRequiredElement(outputSelector),
  };
}

function syncControlOutput({ input, output }) {
  output.value = input.value;
}

function readControlValue(key) {
  return readInputNumber(controls[key].input);
}

function readInputNumber(input) {
  if (Number.isFinite(input.valueAsNumber)) {
    return input.valueAsNumber;
  }

  const defaultValue = Number(input.defaultValue);
  return Number.isFinite(defaultValue) ? defaultValue : 0;
}

function getRequiredElement(selector) {
  const element = document.querySelector(selector);

  if (!element) {
    throw new Error(`Missing required element: ${selector}`);
  }

  return element;
}

function getRequiredInput(selector) {
  const element = getRequiredElement(selector);
  if (!(element instanceof HTMLInputElement)) {
    throw new Error(`Expected ${selector} to be an input element.`);
  }

  return element;
}
