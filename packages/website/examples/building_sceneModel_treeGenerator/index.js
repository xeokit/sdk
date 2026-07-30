import * as xeokit from "../../js/xeokit-studio-bundle.js";

const {RealisticRender} = xeokit.base.constants;
const TreeGenerator = xeokit.model.procgen.treeGenerator.TreeGenerator;
const PRESETS = TreeGenerator.PRESETS;

const controlIds = [
  "height",
  "levels",
  "spread",
  "density",
  "leafSize",
  "trunkRadius"
];

const studio = new xeokit.studio.Studio({});
let scene;
let currentModel = null;
let generation = 0;
let rebuildTimer = 0;
let initialized = false;
const treeGenerator = new TreeGenerator();

studio.init().then(() => {
  scene = studio.scene;

  const view = studio.viewManager.createView({
    id: "demoView",
    elementId: "demoCanvas",
    backgroundColor: [0.88, 0.91, 0.86],
    renderMode: RealisticRender,
    effects: {
      edges: {
        renderModes: []
      }
    },
    camera: {
      eye: [16, -24, 13],
      look: [0, 0, 7],
      up: [0, 0, 1],
      projectionType: "perspective",
      perspectiveProjection: {
        fov: 34
      }
    }
  });

  configureLighting(view);
  bindControls();
  applyPreset("oak");
  rebuildTree();
  initialized = true;
  suppressAutoInfoPanel();
  studio.finished();
});

function configureLighting(view) {
  view.lights.hemispheric.intensity = 0.55;
  view.lights.hemispheric.skyColor = [0.62, 0.72, 0.82];
  view.lights.hemispheric.groundColor = [0.36, 0.30, 0.23];
  view.lights.hemispheric.worldUp = [0, 0, 1];
  view.lights.ibl.intensity = 0.35;
}

function suppressAutoInfoPanel() {
  const panel = studio.openInfoPanel({id: "building_sceneModel_treeGenerator", title: "Procedural Tree Generator"});
  panel.destroy();
}

function bindControls() {
  document.getElementById("species").addEventListener("change", (event) => {
    applyPreset(event.target.value);
    rebuildTree();
  });

  for (const id of controlIds) {
    const input = document.getElementById(id);
    input.addEventListener("input", () => {
      syncControlValue(id);
      scheduleRebuild();
    });
    syncControlValue(id);
  }

  document.getElementById("seed").addEventListener("change", () => {
    clampSeed();
    rebuildTree();
  });

  document.getElementById("randomize").addEventListener("click", () => {
    document.getElementById("seed").value = String(1 + Math.floor(Math.random() * 999999));
    rebuildTree();
  });

  document.getElementById("reset").addEventListener("click", () => {
    applyPreset(document.getElementById("species").value);
    rebuildTree();
  });
}

function applyPreset(name) {
  const preset = PRESETS[name] || PRESETS.oak;
  document.getElementById("species").value = name;
  for (const id of controlIds) {
    document.getElementById(id).value = String(preset[id]);
    syncControlValue(id);
  }
}

function syncControlValue(id) {
  const input = document.getElementById(id);
  const value = Number(input.value);
  const valueEl = document.getElementById(`${id}Value`);
  if (!valueEl) {
    return;
  }
  valueEl.textContent = input.step === "1" ? String(value | 0) : value.toFixed(id === "height" ? 1 : 2);
}

function scheduleRebuild() {
  clearTimeout(rebuildTimer);
  rebuildTimer = setTimeout(rebuildTree, initialized ? 110 : 0);
}

function clampSeed() {
  const seedInput = document.getElementById("seed");
  const seed = Math.max(1, Math.min(999999, parseInt(seedInput.value, 10) || 1));
  seedInput.value = String(seed);
}

function getSettings() {
  const species = document.getElementById("species").value;
  const preset = PRESETS[species] || PRESETS.oak;
  clampSeed();
  return {
    ...preset,
    species,
    seed: parseInt(document.getElementById("seed").value, 10),
    height: Number(document.getElementById("height").value),
    levels: Number(document.getElementById("levels").value),
    spread: Number(document.getElementById("spread").value),
    density: Number(document.getElementById("density").value),
    leafSize: Number(document.getElementById("leafSize").value),
    trunkRadius: Number(document.getElementById("trunkRadius").value)
  };
}

function rebuildTree() {
  if (!scene) {
    return;
  }
  const settings = getSettings();
  if (currentModel && !currentModel.destroyed) {
    must(currentModel.destroy());
  }

  const sceneModel = must(scene.createModel({id: `treeGenerator_${generation++}`,
  updateHint: "dynamic"}));
  currentModel = sceneModel;

  const stats = treeGenerator.generate(sceneModel, settings);
  updateStats(stats);
}

function updateStats(stats) {
  document.getElementById("branchCount").textContent = String(stats.branches);
  document.getElementById("leafCount").textContent = String(stats.leaves);
  document.getElementById("meshCount").textContent = String(stats.meshes);
}

function must(result) {
  if (!result || !result.ok) {
    throw new Error(result ? result.error : "SDK operation failed");
  }
  return result.value;
}
