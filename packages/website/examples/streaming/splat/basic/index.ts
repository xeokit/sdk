// Streaming 3D Gaussian Splats - dynamic load/unload.
//
// Each bright tile is a separate procedural SceneModel. Creating the model
// streams its splats into the renderer's shared splat batches; destroying it
// streams them back out.
import {GaussianSplatsPrimitive} from "@xeokit/sdk/base/constants";
import {Scene} from "@xeokit/sdk/model/scene";
import {ModelNavigationController} from "@xeokit/sdk/viewing/navigation/model";
import {Viewer} from "@xeokit/sdk/viewing/viewer";
import {RoutingPickStrategy} from "@xeokit/sdk/spatial/picking";
import {finishExample, mustElement, mustOk, toNavigationPick, createExampleRenderer} from "../../../utils/standaloneRuntime.js";

const GRID_N = 8;
const TILE = 4.0;
const TILE_FOOTPRINT = 3.0;
const TILE_HEIGHT = 2.6;
const SPLATS_PER_TILE = 20000;
const LOAD_RADIUS = 2.2 * TILE;
const UNLOAD_RADIUS = 3.1 * TILE;
const LOADS_PER_FRAME = 2;
const SWEEP_SPEED = 0.00002;
const GRID_SPAN = (GRID_N - 1) * TILE;
const GRID_HALF = GRID_SPAN / 2;
const SCENE_Z_UP_COORDINATE_SYSTEM = {
  basis: [1, 0, 0, 0, 0, 1, 0, 1, 0],
  origin: [0, 0, 0],
  units: "meters",
  scaleToMeters: 1
};

const tileCx = (gx) => gx * TILE - GRID_HALF;
const tileCy = (gy) => gy * TILE - GRID_HALF;

main().catch((error) => {
  console.error(error);
  const hud = document.getElementById("hud");
  if (hud) {
    hud.textContent = String(error?.message || error);
  }
});

async function main() {
  // Create the SDK runtime explicitly; the helper only selects/configures the
  // renderer and gives this standalone example the common sky/grid treatment.
  const scene = new Scene({logging: false});
  const viewer = new Viewer({scene, logging: false});
  const view = mustOk(viewer.createView({
    id: "demoView",
    htmlElement: mustElement("demoCanvas"),
    camera: {
      eye: [0, -GRID_SPAN * 1.05, GRID_SPAN * 0.85],
      look: [0, 0, 1],
      up: [0, 0, 1]
    },
    effects: {
      sky: {enabled: true},
      sao: {enabled: false},
      bloom: {enabled: false},
      atmosphere: {enabled: false},
      depthOfField: {enabled: false},
      shadows: {enabled: false},
      edges: {enabled: false}
    }
  }));
  const renderer = await createExampleRenderer(viewer);
  const picker = new RoutingPickStrategy(scene, renderer);
  const inputController = new ModelNavigationController(view, {
    pick: (_view, pickParams) => {
      const pickResult = picker.pick({view, canvasPos: pickParams.canvasPos});
      return {ok: true, value: pickResult.hit ? toNavigationPick(view, pickResult, pickParams.canvasPos) : null};
    }
  });
  const hudEl = document.getElementById("hud");

  createGridMarkers(scene);

  const loaded = new Map();
  let loadCount = 0;
  let unloadCount = 0;

  function loadTile(gx, gy) {
    const key = `${gx}_${gy}`;
    const sceneModel = mustOk(scene.createModel({
      id: `tile_${key}`,
      // Procedural splats below are generated directly in xeokit's default
      // Z-up scene basis, so this model uses that same coordinate system.
      coordinateSystem: SCENE_Z_UP_COORDINATE_SYSTEM
    }));
    const tile = makeTile(tileCx(gx), tileCy(gy), (gx * GRID_N + gy) / (GRID_N * GRID_N));
    mustOk(sceneModel.createGeometry({
      id: "g",
      primitive: GaussianSplatsPrimitive,
      positions: tile.positions,
      scales: tile.scales,
      rotations: tile.rotations,
      colorsCompressed: tile.colors
    }));
    mustOk(sceneModel.createMesh({id: "m", geometryId: "g"}));
    mustOk(sceneModel.createObject({id: `obj_${key}`, meshIds: ["m"]}));
    loaded.set(key, sceneModel);
    loadCount++;
  }

  function unloadTile(key) {
    loaded.get(key).destroy();
    loaded.delete(key);
    unloadCount++;
  }

  function updateStreaming(fx, fy) {
    for (const key of loaded.keys()) {
      const [gx, gy] = key.split("_").map(Number);
      if (Math.hypot(tileCx(gx) - fx, tileCy(gy) - fy) > UNLOAD_RADIUS) {
        unloadTile(key);
      }
    }
    let budget = LOADS_PER_FRAME;
    for (let gx = 0; gx < GRID_N && budget > 0; gx++) {
      for (let gy = 0; gy < GRID_N && budget > 0; gy++) {
        const key = `${gx}_${gy}`;
        if (!loaded.has(key) && Math.hypot(tileCx(gx) - fx, tileCy(gy) - fy) < LOAD_RADIUS) {
          loadTile(gx, gy);
          budget--;
        }
      }
    }
  }

  function focusPos(s) {
    const rowFloat = s * GRID_N;
    const row = Math.min(GRID_N - 1, Math.floor(rowFloat));
    const f = rowFloat - row;
    const y = tileCy(row);
    const x = row % 2 === 0 ? -GRID_HALF + f * GRID_SPAN : GRID_HALF - f * GRID_SPAN;
    return [x, y];
  }

  let s = 0;
  let sweeping = true;
  let lastT = performance.now();
  const toggleBtn = document.getElementById("toggleAuto");
  toggleBtn?.addEventListener("click", () => {
    sweeping = !sweeping;
    toggleBtn.textContent = sweeping ? "Pause sweep" : "Resume sweep";
  });
  document.getElementById("unloadAll")?.addEventListener("click", () => {
    for (const key of [...loaded.keys()]) {
      unloadTile(key);
    }
  });

  function frame(t) {
    const dt = t - lastT;
    lastT = t;
    if (sweeping) {
      s = (s + SWEEP_SPEED * dt) % 1;
    }
    const [fx, fy] = focusPos(s);
    updateStreaming(fx, fy);
    if (hudEl) {
      hudEl.innerHTML =
        `resident tiles: <b>${loaded.size}</b> / ${GRID_N * GRID_N}<br>` +
        `resident splats: <b>${(loaded.size * SPLATS_PER_TILE).toLocaleString()}</b><br>` +
        `loads: <b>${loadCount}</b>&nbsp;&nbsp;unloads: <b>${unloadCount}</b><br>` +
        `focus: ${fx.toFixed(1)}, ${fy.toFixed(1)}`;
    }
    requestAnimationFrame(frame);
  }

  finishExample(renderer, view);
  window.splatStreamingBasicExample = {scene, viewer, view, renderer, picker, inputController, loaded};
  requestAnimationFrame(frame);
}

function createGridMarkers(scene) {
  const perSlot = 120;
  const n = GRID_N * GRID_N * perSlot;
  const positions = new Float32Array(n * 3);
  const scales = new Float32Array(n * 3);
  const rotations = new Float32Array(n * 4);
  const colors = new Uint8Array(n * 4);
  let i = 0;
  for (let gx = 0; gx < GRID_N; gx++) {
    for (let gy = 0; gy < GRID_N; gy++) {
      const cx = tileCx(gx);
      const cy = tileCy(gy);
      for (let k = 0; k < perSlot; k++) {
        positions[i * 3] = cx + (Math.random() - 0.5) * TILE_FOOTPRINT;
        positions[i * 3 + 1] = cy + (Math.random() - 0.5) * TILE_FOOTPRINT;
        positions[i * 3 + 2] = Math.random() * 0.15;
        const sc = 0.05 + Math.random() * 0.02;
        scales[i * 3] = sc;
        scales[i * 3 + 1] = sc;
        scales[i * 3 + 2] = sc;
        rotations[i * 4 + 3] = 1;
        colors[i * 4] = 90;
        colors[i * 4 + 1] = 95;
        colors[i * 4 + 2] = 110;
        colors[i * 4 + 3] = 130;
        i++;
      }
    }
  }
  const sceneModel = mustOk(scene.createModel({
    id: "gridMarkers",
    coordinateSystem: SCENE_Z_UP_COORDINATE_SYSTEM
  }));
  mustOk(sceneModel.createGeometry({id: "g", primitive: GaussianSplatsPrimitive, positions, scales, rotations, colorsCompressed: colors}));
  mustOk(sceneModel.createMesh({id: "m", geometryId: "g"}));
  mustOk(sceneModel.createObject({id: "gridMarkers_obj", meshIds: ["m"]}));
}

function makeTile(cx, cy, hue) {
  const n = SPLATS_PER_TILE;
  const positions = new Float32Array(n * 3);
  const scales = new Float32Array(n * 3);
  const rotations = new Float32Array(n * 4);
  const colors = new Uint8Array(n * 4);
  const [r, g, b] = hslToRgb(hue, 0.7, 0.55);
  for (let i = 0; i < n; i++) {
    positions[i * 3] = cx + (Math.random() - 0.5) * TILE_FOOTPRINT;
    positions[i * 3 + 1] = cy + (Math.random() - 0.5) * TILE_FOOTPRINT;
    positions[i * 3 + 2] = 0.2 + Math.random() * TILE_HEIGHT;
    const sc = 0.045 + Math.random() * 0.03;
    scales[i * 3] = sc;
    scales[i * 3 + 1] = sc;
    scales[i * 3 + 2] = sc;
    rotations[i * 4 + 3] = 1;
    colors[i * 4] = r;
    colors[i * 4 + 1] = g;
    colors[i * 4 + 2] = b;
    colors[i * 4 + 3] = 235;
  }
  return {positions, scales, rotations, colors};
}

function hslToRgb(h, s, l) {
  const k = (n) => (n + h * 12) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}
