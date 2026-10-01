import { FISH_CATALOG, PLANT_CATALOG, getFishMeta, getPlantMeta } from "./species-catalog.js";
import { getStyleById, listStyleIds } from "./presets.js";
import { getLanguage, t } from "../i18n.js";
import type { AquariumManager } from "./types.js";
import { WEATHER_KINDS, type WeatherKind } from "../weather/types.js";

export function createProjectPanel(manager: AquariumManager, container: HTMLElement) {
  const root = document.createElement("section");
  root.className = "project-panel";
  root.setAttribute("data-i18n-aria-label", "projectAria");
  container.insertBefore(root, container.firstChild);

  let suppressRender = false;
  let weatherTimer: ReturnType<typeof setInterval> | null = null;

  manager.on("change", () => {
    if (suppressRender) return;
    render();
  });
  const handleLanguageChange = () => render();
  document.addEventListener("languagechange", handleLanguageChange);

  function render() {
    root.innerHTML = "";
    const descriptor = manager.getDescriptor();

    // Header: title + reset button
    const header = document.createElement("div");
    header.className = "panel-header";
    const h2 = document.createElement("h2");
    h2.textContent = t("projectTitle");
    header.appendChild(h2);
    const resetBtn = document.createElement("button");
    resetBtn.type = "button";
    resetBtn.textContent = t("resetStyle");
    resetBtn.addEventListener("click", () => {
      suppressRender = true;
      void manager.switchStyle("default").then(() => {
        suppressRender = false;
        render();
      });
    });
    header.appendChild(resetBtn);
    root.appendChild(header);

    // Style chips
    const styleGroup = document.createElement("div");
    styleGroup.className = "style-chips";
    styleGroup.setAttribute("data-i18n-aria-label", "styleAria");
    for (const styleId of listStyleIds()) {
      const style = getStyleById(styleId)!;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "style-chip" + (styleId === descriptor.id ? " is-active" : "");
      btn.textContent = style.name[getLanguage()];
      btn.addEventListener("click", () => {
        suppressRender = true;
        void manager.switchStyle(styleId).then(() => {
          suppressRender = false;
          render();
        });
      });
      styleGroup.appendChild(btn);
    }
    root.appendChild(styleGroup);

    // Tank size
    const sizeTitle = document.createElement("h3");
    sizeTitle.textContent = t("aquariumSize");
    root.appendChild(sizeTitle);
    const sizeFields = [
      { key: "x" as const, label: t("sizeX"), min: 3, max: 30, step: 0.5 },
      { key: "y" as const, label: t("sizeY"), min: 2, max: 20, step: 0.5 },
      { key: "z" as const, label: t("sizeZ"), min: 3, max: 24, step: 0.5 },
    ];
    for (const field of sizeFields) {
      const label = document.createElement("label");
      label.textContent = field.label;
      const input = document.createElement("input");
      input.type = "range";
      input.min = String(field.min);
      input.max = String(field.max);
      input.step = String(field.step);
      input.value = String(descriptor.aquarium.halfSize[field.key]);
      input.addEventListener("input", () => {
        suppressRender = true;
        manager.resize({ ...descriptor.aquarium.halfSize, [field.key]: Number(input.value) });
        suppressRender = false;
      });
      const output = document.createElement("output");
      output.value = input.value;
      input.addEventListener("input", () => {
        output.value = input.value;
      });
      label.appendChild(input);
      label.appendChild(output);
      root.appendChild(label);
    }

    // Fish species
    const fishTitle = document.createElement("h3");
    fishTitle.textContent = t("fishSpecies");
    root.appendChild(fishTitle);
    const fishList = document.createElement("div");
    fishList.className = "species-list";
    for (const entry of descriptor.fish) {
      fishList.appendChild(renderSpeciesRow(entry, "fish", manager));
    }
    root.appendChild(fishList);
    root.appendChild(buildAddSelect("fish", descriptor, manager));

    root.appendChild(buildWeatherSection(manager));

    // Plant species
    const plantTitle = document.createElement("h3");
    plantTitle.textContent = t("plantSpecies");
    root.appendChild(plantTitle);
    const plantList = document.createElement("div");
    plantList.className = "species-list";
    for (const entry of descriptor.plants) {
      plantList.appendChild(renderSpeciesRow(entry, "plant", manager));
    }
    root.appendChild(plantList);
    root.appendChild(buildAddSelect("plant", descriptor, manager));

    root.appendChild(buildGrowthSection(manager, descriptor));
  }

  function buildWeatherSection(manager: AquariumManager) {
    const section = document.createElement("section");
    section.className = "weather-section";
    const title = document.createElement("h3");
    title.textContent = t("weatherTitle");
    section.appendChild(title);

    const status = document.createElement("p");
    status.className = "weather-status";
    const updateStatus = () => {
      const state = manager.getWeatherState();
      status.textContent = `${t(`weather_${state.kind}`)} · ${Math.ceil(state.remainingSeconds)}s`;
    };
    updateStatus();
    section.appendChild(status);

    const controls = document.createElement("div");
    controls.className = "weather-controls";
    const select = document.createElement("select");
    select.className = "add-select";
    select.setAttribute("aria-label", t("weatherSelect"));
    const current = manager.getWeatherState().kind;
    for (const kind of WEATHER_KINDS) {
      const option = document.createElement("option");
      option.value = kind;
      option.textContent = t(`weather_${kind}`);
      option.selected = kind === current;
      select.appendChild(option);
    }
    controls.appendChild(select);

    const switchButton = document.createElement("button");
    switchButton.type = "button";
    switchButton.textContent = t("weatherSwitch");
    switchButton.addEventListener("click", () => {
      manager.setWeather(select.value as WeatherKind);
      render();
    });
    controls.appendChild(switchButton);
    section.appendChild(controls);

    const autoLabel = document.createElement("label");
    autoLabel.className = "weather-auto-label";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = manager.getWeatherState().autoCycle;
    checkbox.addEventListener("change", () => {
      manager.setWeatherAutoCycle(checkbox.checked);
      updateStatus();
    });
    autoLabel.appendChild(checkbox);
    autoLabel.appendChild(document.createTextNode(t("weatherAutoCycle")));
    section.appendChild(autoLabel);

    if (weatherTimer === null) {
      weatherTimer = setInterval(() => {
        if (root.isConnected) updateStatus();
      }, 1000);
    }
    return section;
  }

  function buildGrowthSection(manager: AquariumManager, descriptor: ReturnType<AquariumManager["getDescriptor"]>) {
    const section = document.createElement("section");
    section.className = "growth-section";
    const title = document.createElement("h3");
    title.textContent = t("growthTitle");
    section.appendChild(title);

    const stats = manager.getGrowthStats();
    const summary = document.createElement("p");
    summary.className = "growth-summary";
    summary.textContent = `${t("growthTotal")}: ${stats.activeCount} · ${t("growthAverage")}: ${Math.round(stats.averageProgress * 100)}%`;
    section.appendChild(summary);

    const speciesList = document.createElement("div");
    speciesList.className = "growth-species-list";
    for (const entry of descriptor.fish) {
      const speciesMeta = getFishMeta(entry.speciesId);
      const speciesStats = manager.getGrowthStats(entry.speciesId);
      const details = document.createElement("details");
      details.className = "growth-species";
      const caption = document.createElement("summary");
      caption.textContent = `${speciesMeta?.name[getLanguage()] ?? entry.speciesId} · ${speciesStats.activeCount} · ${Math.round(speciesStats.averageProgress * 100)}%`;
      details.appendChild(caption);
      details.addEventListener("toggle", () => {
        if (!details.open || details.dataset.loaded === "true") return;
        const list = document.createElement("ul");
        list.className = "growth-fish-list";
        for (const record of manager.getGrowthRecords(entry.speciesId)) {
          const item = document.createElement("li");
          item.textContent = `${record.fishId.slice(0, 8)} · ${t(`growthStage_${record.stage}`)} · ${Math.round(record.growthProgress * 100)}% · ${Math.floor(record.accumulatedAgeSeconds / 60)}m`;
          list.appendChild(item);
        }
        details.appendChild(list);
        details.dataset.loaded = "true";
      });
      speciesList.appendChild(details);
    }
    section.appendChild(speciesList);

    const actions = document.createElement("div");
    actions.className = "growth-actions";
    const exportButton = document.createElement("button");
    exportButton.type = "button";
    exportButton.textContent = t("growthExport");
    exportButton.addEventListener("click", () => {
      const blob = new Blob([manager.exportGrowth()], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "ripple-aquarium-fish-growth.json";
      link.click();
      URL.revokeObjectURL(url);
    });
    actions.appendChild(exportButton);
    const resetButton = document.createElement("button");
    resetButton.type = "button";
    resetButton.className = "remove-btn";
    resetButton.textContent = t("growthReset");
    resetButton.addEventListener("click", () => {
      if (!window.confirm(t("growthResetConfirm"))) return;
      manager.resetGrowth();
      render();
    });
    actions.appendChild(resetButton);
    section.appendChild(actions);
    const status = document.createElement("small");
    status.className = "growth-save-status";
    status.textContent = `${t("growthSaveStatus")}: ${manager.getGrowthSaveStatus()}`;
    section.appendChild(status);
    return section;
  }

  function renderSpeciesRow(
    entry: { speciesId: string; count: number },
    kind: "fish" | "plant",
    manager: AquariumManager,
  ) {
    const row = document.createElement("div");
    row.className = "species-row";

    const catalog = kind === "fish" ? FISH_CATALOG : PLANT_CATALOG;
    const meta = catalog.find((m) => m.id === entry.speciesId);
    const name = document.createElement("span");
    name.className = "species-name";
    name.textContent = meta ? meta.name[getLanguage()] : entry.speciesId;
    row.appendChild(name);

    const slider = document.createElement("input");
    slider.type = "range";
    slider.min = "0";
    slider.max = String(meta?.maxCount ?? entry.count);
    slider.step = "1";
    slider.value = String(entry.count);
    slider.addEventListener("input", () => {
      suppressRender = true;
      if (kind === "fish") {
        manager.setFishCount(entry.speciesId, Number(slider.value));
      } else {
        manager.setPlantCount(entry.speciesId, Number(slider.value));
      }
      suppressRender = false;
    });
    row.appendChild(slider);

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "remove-btn";
    removeBtn.textContent = t("remove");
    removeBtn.addEventListener("click", () => {
      suppressRender = true;
      if (kind === "fish") {
        manager.removeFishSpecies(entry.speciesId);
      } else {
        manager.removePlantSpecies(entry.speciesId);
      }
      suppressRender = false;
      render();
    });
    row.appendChild(removeBtn);

    return row;
  }

  function buildAddSelect(
    kind: "fish" | "plant",
    descriptor: ReturnType<AquariumManager["getDescriptor"]>,
    manager: AquariumManager,
  ) {
    const select = document.createElement("select");
    select.className = "add-select";
    select.setAttribute("data-i18n-aria-label", kind === "fish" ? "addFish" : "addPlant");

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = kind === "fish" ? t("addFish") : t("addPlant");
    select.appendChild(placeholder);

    const catalog = kind === "fish" ? FISH_CATALOG : PLANT_CATALOG;
    const active = kind === "fish" ? descriptor.fish : descriptor.plants;
    for (const meta of catalog) {
      if (active.some((entry) => entry.speciesId === meta.id)) continue;
      const opt = document.createElement("option");
      opt.value = meta.id;
      opt.textContent = meta.name[getLanguage()];
      select.appendChild(opt);
    }

    select.addEventListener("change", () => {
      if (!select.value) return;
      const meta = (kind === "fish" ? getFishMeta(select.value) : getPlantMeta(select.value));
      suppressRender = true;
      if (kind === "fish") {
        manager.addFishSpecies(select.value, meta?.defaultCount ?? 1);
      } else {
        void manager.addPlantSpecies(select.value, meta?.defaultCount ?? 1).then(() => {
          suppressRender = false;
          render();
        });
        return;
      }
      suppressRender = false;
      render();
      select.value = "";
    });

    return select;
  }

  render();

  return {
    dispose() {
      if (weatherTimer !== null) clearInterval(weatherTimer);
      weatherTimer = null;
      document.removeEventListener("languagechange", handleLanguageChange);
      root.remove();
    },
  };
}
