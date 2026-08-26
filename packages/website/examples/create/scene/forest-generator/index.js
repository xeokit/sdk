import * as xeokit from "../../../../js/xeokit-studio-bundle.js";

const {
  TrianglesPrimitive
} = xeokit.base.constants;
const TreeGenerator = xeokit.model.generation.treeGenerator.TreeGenerator;
const PRESETS = TreeGenerator.PRESETS;

const DEFAULTS = {
  forestType: "mixed",
  treeCount: 72,
  areaSize: 78,
  variation: 0.62,
  canopy: 0.56,
  seed: 81241
};

const controlIds = [
  "treeCount",
  "areaSize",
  "variation",
  "canopy"
];

const studio = new xeokit.studio.Studio({});
const treeGenerator = new TreeGenerator();
let scene;
let currentModel = null;
let generation = 0;
let rebuildTimer = 0;
let initialized = false;

studio.init().then(() => {
  scene = studio.scene;

  const view = studio.viewManager.createView({
    id: "forestView",
    elementId: "demoCanvas",
    backgroundColor: [0.78, 0.84, 0.75],
    effects: {
      edges: {
        enabled: false
      }
    },
    camera: {
      eye: [70, -96, 52],
      look: [0, 0, 7],
      up: [0, 0, 1],
      projectionType: "perspective",
      perspectiveProjection: {
        fov: 42,
        near: 0.05,
        far: 10000
      }
    }
  });

  configureLighting(view);
  bindControls();
  applyDefaults();
  rebuildForest();
  initialized = true;
  suppressAutoInfoPanel();
  studio.finished();
});

function configureLighting(view) {
  view.lights.hemispheric.intensity = 0.62;
  view.lights.hemispheric.skyColor = [0.62, 0.73, 0.83];
  view.lights.hemispheric.groundColor = [0.30, 0.26, 0.20];
  view.lights.hemispheric.worldUp = [0, 0, 1];
  view.lights.ibl.intensity = 0.28;
}

function suppressAutoInfoPanel() {
  const panel = studio.openInfoPanel({id: "create/scene/forest-generator", title: "Procedural Forest Generator"});
  panel.destroy();
}

function bindControls() {
  document.getElementById("forestType").addEventListener("change", rebuildForest);

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
    rebuildForest();
  });

  document.getElementById("randomize").addEventListener("click", () => {
    document.getElementById("seed").value = String(1 + Math.floor(Math.random() * 999999));
    rebuildForest();
  });

  document.getElementById("reset").addEventListener("click", () => {
    applyDefaults();
    rebuildForest();
  });
}

function applyDefaults() {
  document.getElementById("forestType").value = DEFAULTS.forestType;
  document.getElementById("seed").value = String(DEFAULTS.seed);
  for (const id of controlIds) {
    document.getElementById(id).value = String(DEFAULTS[id]);
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
  valueEl.textContent = input.step === "1" ? String(value | 0) : value.toFixed(2);
}

function scheduleRebuild() {
  clearTimeout(rebuildTimer);
  rebuildTimer = setTimeout(rebuildForest, initialized ? 140 : 0);
}

function clampSeed() {
  const seedInput = document.getElementById("seed");
  const seed = Math.max(1, Math.min(999999, parseInt(seedInput.value, 10) || 1));
  seedInput.value = String(seed);
}

function getSettings() {
  clampSeed();
  return {
    forestType: document.getElementById("forestType").value,
    treeCount: Number(document.getElementById("treeCount").value),
    areaSize: Number(document.getElementById("areaSize").value),
    variation: Number(document.getElementById("variation").value),
    canopy: Number(document.getElementById("canopy").value),
    seed: parseInt(document.getElementById("seed").value, 10)
  };
}

function rebuildForest() {
  if (!scene) {
    return;
  }

  const settings = getSettings();
  if (currentModel && !currentModel.destroyed) {
    must(currentModel.destroy());
  }

  const sceneModel = must(scene.createModel({id: `forestGenerator_${generation++}`, updateHint: "dynamic"}));
  currentModel = sceneModel;

  createTerrain(sceneModel, settings);
  const stats = createForest(sceneModel, settings);
  stats.meshes = sceneModel.stats.numMeshes;
  updateStats(stats);
}

function createForest(sceneModel, settings) {
  const random = mulberry32(settings.seed);
  const positions = sampleTreePositions(settings);
  const totals = {trees: positions.length, branches: 0, leaves: 0, meshes: 0};

  for (let i = 0; i < positions.length; i++) {
    const placement = positions[i];
    const species = chooseSpecies(settings.forestType, random, placement);
    const preset = PRESETS[species];
    const crowdFactor = settings.treeCount > 180 ? 0.52 : settings.treeCount > 120 ? 0.64 : settings.treeCount > 90 ? 0.76 : settings.treeCount > 65 ? 0.88 : 1;
    const size = (0.56 + random() * (0.42 + settings.variation * 0.24)) * (species === "columnar" ? 1.08 : 1);
    const rings = Math.max(2, Math.round((2 + settings.canopy * (species === "pine" ? 2.2 : 1.7)) * crowdFactor));
    const branchCount = Math.max(2, Math.round((2 + settings.canopy * (species === "pine" ? 2.6 : 1.8)) * crowdFactor));
    const levels = settings.treeCount > 160
      ? 2
      : Math.max(2, Math.min(3, Math.round((2.15 + settings.canopy * 0.75 + random() * settings.variation) * crowdFactor)));

    const treeStats = treeGenerator.generate(sceneModel, {
      ...preset,
      idPrefix: `tree_${i}_`,
      geometryIdPrefix: "forestTree_",
      includeGround: false,
      species,
      seed: settings.seed + i * 7919 + 17,
      position: [placement.x, placement.y, terrainHeight(placement.x, placement.y, settings.seed) + 0.04],
      rotation: random() * Math.PI * 2,
      scale: size,
      height: preset.height * (0.82 + jitter(random, 0.18) * settings.variation),
      spread: preset.spread * (0.82 + random() * 0.34 * settings.variation),
      density: clamp(0.24 + settings.canopy * 0.55 + jitter(random, 0.10), 0.16, 0.84),
      leafSize: preset.leafSize * (0.72 + random() * 0.28),
      trunkRadius: preset.trunkRadius * (0.84 + random() * 0.22),
      branchRings: rings,
      ringBranches: branchCount,
      levels
    });

    totals.branches += treeStats.branches;
    totals.leaves += treeStats.leaves;
    totals.meshes += treeStats.meshes;
  }

  return totals;
}

function chooseSpecies(type, random, placement) {
  if (type === "conifer") {
    return random() < 0.78 ? "pine" : "columnar";
  }
  if (type === "broadleaf") {
    return random() < 0.82 ? "oak" : "columnar";
  }
  if (type === "coastal") {
    return random() < 0.64 || Math.abs(placement.x) > Math.abs(placement.y) ? "windswept" : "pine";
  }
  const r = random();
  if (r < 0.48) {
    return "oak";
  }
  if (r < 0.78) {
    return "pine";
  }
  return r < 0.90 ? "columnar" : "windswept";
}

function sampleTreePositions(settings) {
  const random = mulberry32(settings.seed ^ 0x9E3779B9);
  const positions = [];
  let minDistance = Math.max(1.9, settings.areaSize / Math.sqrt(settings.treeCount) * 0.48);
  const pathWidth = Math.max(2.2, settings.areaSize * 0.045);

  for (let pass = 0; pass < 4 && positions.length < settings.treeCount; pass++) {
    const attempts = settings.treeCount * 80;
    for (let attempt = 0; attempt < attempts && positions.length < settings.treeCount; attempt++) {
      const x = (random() - 0.5) * settings.areaSize;
      const y = (random() - 0.5) * settings.areaSize;
      if (Math.abs(y - trailCenterY(x, settings)) < pathWidth) {
        continue;
      }
      if (isTooClose(x, y, positions, minDistance)) {
        continue;
      }
      positions.push({x, y});
    }
    minDistance *= 0.78;
  }

  return positions;
}

function isTooClose(x, y, positions, minDistance) {
  const minDistanceSq = minDistance * minDistance;
  for (let i = 0; i < positions.length; i++) {
    const dx = x - positions[i].x;
    const dy = y - positions[i].y;
    if (dx * dx + dy * dy < minDistanceSq) {
      return true;
    }
  }
  return false;
}

function createTerrain(sceneModel, settings) {
  const terrain = buildTerrainGeometry(settings);
  must(sceneModel.createGeometry({
    id: "terrainGeometry",
    primitive: TrianglesPrimitive,
    positions: terrain.positions,
    normals: terrain.normals,
    indices: terrain.indices
  }));
  must(sceneModel.createMesh({
    id: "terrainMesh",
    geometryId: "terrainGeometry",
    color: [0.31, 0.42, 0.25]
  }));
  must(sceneModel.createObject({id: "terrainObject", meshIds: ["terrainMesh"]}));

  const trail = buildTrailGeometry(settings);
  must(sceneModel.createGeometry({
    id: "trailGeometry",
    primitive: TrianglesPrimitive,
    positions: trail.positions,
    normals: trail.normals,
    indices: trail.indices
  }));
  must(sceneModel.createMesh({
    id: "trailMesh",
    geometryId: "trailGeometry",
    color: [0.48, 0.42, 0.31]
  }));
  must(sceneModel.createObject({id: "trailObject", meshIds: ["trailMesh"]}));
}

function buildTerrainGeometry(settings) {
  const segments = 48;
  const size = settings.areaSize * 1.26;
  const half = size / 2;
  const step = size / segments;
  const positions = [];
  const normals = [];
  const indices = [];

  for (let iy = 0; iy <= segments; iy++) {
    const y = -half + iy * step;
    for (let ix = 0; ix <= segments; ix++) {
      const x = -half + ix * step;
      const z = terrainHeight(x, y, settings.seed);
      positions.push(x, y, z);
      normals.push(...terrainNormal(x, y, settings.seed, step));
    }
  }

  const row = segments + 1;
  for (let iy = 0; iy < segments; iy++) {
    for (let ix = 0; ix < segments; ix++) {
      const a = iy * row + ix;
      const b = a + 1;
      const c = a + row;
      const d = c + 1;
      indices.push(a, b, c, b, d, c);
    }
  }

  return {positions, normals, indices};
}

function buildTrailGeometry(settings) {
  const segments = 96;
  const size = settings.areaSize * 1.18;
  const half = size / 2;
  const width = Math.max(2.0, settings.areaSize * 0.035);
  const positions = [];
  const normals = [];
  const indices = [];

  for (let i = 0; i <= segments; i++) {
    const x = -half + (i / segments) * size;
    const centerY = trailCenterY(x, settings);
    const slope = (trailCenterY(x + 0.2, settings) - trailCenterY(x - 0.2, settings)) / 0.4;
    const side = normalize([-slope, 1, 0]);

    for (const sign of [-1, 1]) {
      const y = centerY + side[1] * width * sign;
      const px = x + side[0] * width * sign;
      positions.push(px, y, terrainHeight(px, y, settings.seed) + 0.055);
      normals.push(0, 0, 1);
    }
  }

  for (let i = 0; i < segments; i++) {
    const a = i * 2;
    const b = a + 1;
    const c = a + 2;
    const d = a + 3;
    indices.push(a, c, b, b, c, d);
  }

  return {positions, normals, indices};
}

function terrainHeight(x, y, seed) {
  return (
    Math.sin((x + seed * 0.013) * 0.075) * 0.72 +
    Math.cos((y - seed * 0.017) * 0.065) * 0.54 +
    Math.sin((x + y) * 0.036) * 0.38
  );
}

function terrainNormal(x, y, seed, step) {
  const hL = terrainHeight(x - step, y, seed);
  const hR = terrainHeight(x + step, y, seed);
  const hD = terrainHeight(x, y - step, seed);
  const hU = terrainHeight(x, y + step, seed);
  return normalize([hL - hR, hD - hU, step * 2]);
}

function trailCenterY(x, settings) {
  return Math.sin(x * 0.085 + settings.seed * 0.00009) * Math.max(2.5, settings.areaSize * 0.055);
}

function updateStats(stats) {
  document.getElementById("treeStat").textContent = String(stats.trees);
  document.getElementById("branchStat").textContent = String(stats.branches);
  document.getElementById("leafStat").textContent = String(stats.leaves);
  document.getElementById("meshStat").textContent = String(stats.meshes);
}

function must(result) {
  if (!result || !result.ok) {
    throw new Error(result ? result.error : "SDK operation failed");
  }
  return result.value;
}

function mulberry32(seed) {
  return function next() {
    seed |= 0;
    seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function jitter(random, amount) {
  return (random() - 0.5) * amount;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalize(v) {
  const len = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / len, v[1] / len, v[2] / len];
}
