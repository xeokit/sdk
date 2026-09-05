// Streaming 3D Gaussian Splats — dynamic load / unload ("streamed walkthrough").
//
// Splats are a first-class SceneModel primitive, so creating a splat SceneModel
// streams its splats INTO the renderer's shared SplatBatch (SplatBatch.addSplats
// -> PortionDataTexture.getPortion), and destroying it streams them OUT
// (removeSplats -> putPortion, freeing the texture region for reuse). That's the
// exact path GaussianSplatLoader drives, so this demo verifies the on-demand /
// load-as-you-go behaviour a streamed walkthrough needs.
//
// To keep the spatial context legible this is shown from an elevated overview,
// NOT a first-person walkthrough: the camera stays put (free-orbit) framing the
// whole grid, while a streaming "focus" sweeps across it. Every grid slot has a
// faint always-present marker, so you can see the full grid and watch bright
// tiles load around the focus and unload behind it. Each bright tile is its own
// procedurally-generated SceneModel; a real scene would instead fetch +
// GaussianSplatLoader.load() each tile's .splat into the same per-tile model.
import * as xeokit from "../../../../../js/xeokit-studio-bundle.js";

const SPLATS = xeokit.base.constants.GaussianSplatsPrimitive;

// --- Grid / streaming tuning ------------------------------------------------
const GRID_N          = 8;          // GRID_N × GRID_N tile slots
const TILE            = 4.0;        // world-space spacing between tile centres
const TILE_FOOTPRINT  = 3.0;        // splat spread within a tile (< TILE: tiles stay distinct)
const TILE_HEIGHT     = 2.6;        // tile height along +Z (SDK is Z-up)
const SPLATS_PER_TILE = 20000;      // GRID_N² × this stays under the ~1.5M batch budget
const LOAD_RADIUS     = 2.2 * TILE; // create tiles within this distance of the focus
const UNLOAD_RADIUS   = 3.1 * TILE; // destroy tiles beyond this (hysteresis avoids thrash)
const LOADS_PER_FRAME = 2;          // cap tile creations per frame to keep things smooth
const SWEEP_SPEED     = 0.00002;    // focus path-parameter units per millisecond

const GRID_SPAN = (GRID_N - 1) * TILE;
const GRID_HALF = GRID_SPAN / 2;

const tileCx = (gx) => gx * TILE - GRID_HALF;
const tileCy = (gy) => gy * TILE - GRID_HALF;

const studio = new xeokit.studio.Studio({});

studio.init().then(() => {

  const { scene } = studio;

  // Elevated overview that frames the whole grid; the user can orbit/zoom freely.
  const view = studio.viewManager.createView({
    camera: {
      eye:  [0, -GRID_SPAN * 1.05, GRID_SPAN * 0.85],
      look: [0, 0, 1],
      up:   [0, 0, 1]
    }
  });

  const hudEl = document.getElementById("hud");

  // Faint always-present markers at every grid slot, so the full grid footprint
  // is visible even where no tile is loaded. One static SceneModel, built once.
  createGridMarkers(scene);

  // key "gx_gy" -> the loaded tile's SceneModel
  const loaded = new Map();
  let loadCount = 0;
  let unloadCount = 0;

  function loadTile(gx, gy) {
    const key = `${gx}_${gy}`;
    const result = scene.createModel({ id: `tile_${key}` });
    if (!result.ok) {
      console.error(`[stream] createModel failed: ${result.error}`);
      return;
    }
    const sceneModel = result.value;
    const tile = makeTile(tileCx(gx), tileCy(gy), (gx * GRID_N + gy) / (GRID_N * GRID_N));
    sceneModel.createGeometry({
      id: "g",
      primitive: SPLATS,
      positions: tile.positions,
      scales: tile.scales,
      rotations: tile.rotations,
      colorsCompressed: tile.colors
    });
    sceneModel.createMesh({ id: "m", geometryId: "g" });   // streams the splats into the batch
    // SceneObject ids are scene-global (geometry/mesh ids are per-model), so the
    // object id must be unique across tiles.
    sceneModel.createObject({ id: `obj_${key}`, meshIds: ["m"] });
    loaded.set(key, sceneModel);
    loadCount++;
  }

  function unloadTile(key) {
    loaded.get(key).destroy();   // streams the splats back out of the batch
    loaded.delete(key);
    unloadCount++;
  }

  function updateStreaming(fx, fy) {
    // Unload tiles that have fallen outside the focus region.
    for (const key of loaded.keys()) {
      const [gx, gy] = key.split("_").map(Number);
      if (Math.hypot(tileCx(gx) - fx, tileCy(gy) - fy) > UNLOAD_RADIUS) {
        unloadTile(key);
      }
    }
    // Load tiles near the focus, budgeted per frame.
    let budget = LOADS_PER_FRAME;
    for (let gx = 0; gx < GRID_N && budget > 0; gx++) {
      for (let gy = 0; gy < GRID_N && budget > 0; gy++) {
        const key = `${gx}_${gy}`;
        if (loaded.has(key)) {
          continue;
        }
        if (Math.hypot(tileCx(gx) - fx, tileCy(gy) - fy) < LOAD_RADIUS) {
          loadTile(gx, gy);
          budget--;
        }
      }
    }
  }

  // The streaming focus sweeps a serpentine path row-by-row across the grid.
  function focusPos(s) {
    const rowFloat = s * GRID_N;
    const row = Math.min(GRID_N - 1, Math.floor(rowFloat));
    const f = rowFloat - row;
    const y = tileCy(row);
    const x = (row % 2 === 0) ? (-GRID_HALF + f * GRID_SPAN) : (GRID_HALF - f * GRID_SPAN);
    return [x, y];
  }

  let s = 0;
  let sweeping = true;
  let lastT = performance.now();

  const toggleBtn = document.getElementById("toggleAuto");
  toggleBtn.addEventListener("click", () => {
    sweeping = !sweeping;
    toggleBtn.textContent = sweeping ? "Pause sweep" : "Resume sweep";
  });
  document.getElementById("unloadAll").addEventListener("click", () => {
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

    hudEl.innerHTML =
      `resident tiles: <b>${loaded.size}</b> / ${GRID_N * GRID_N}<br>` +
      `resident splats: <b>${(loaded.size * SPLATS_PER_TILE).toLocaleString()}</b><br>` +
      `loads: <b>${loadCount}</b>&nbsp;&nbsp;unloads: <b>${unloadCount}</b><br>` +
      `focus: ${fx.toFixed(1)}, ${fy.toFixed(1)}`;

    requestAnimationFrame(frame);
  }

  studio.finished();
  requestAnimationFrame(frame);
});

// One static SceneModel holding a faint grey marker cluster at every grid slot,
// so the whole grid footprint stays visible while tiles stream in and out.
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
        positions[i * 3]     = cx + (Math.random() - 0.5) * TILE_FOOTPRINT;
        positions[i * 3 + 1] = cy + (Math.random() - 0.5) * TILE_FOOTPRINT;
        positions[i * 3 + 2] = Math.random() * 0.15;   // flat patch on the ground
        const sc = 0.05 + Math.random() * 0.02;
        scales[i * 3] = sc;
        scales[i * 3 + 1] = sc;
        scales[i * 3 + 2] = sc;
        rotations[i * 4 + 3] = 1;   // identity quaternion (xyzw)
        colors[i * 4]     = 90;
        colors[i * 4 + 1] = 95;
        colors[i * 4 + 2] = 110;
        colors[i * 4 + 3] = 130;    // faint
        i++;
      }
    }
  }
  const sceneModel = scene.createModel({ id: "gridMarkers" }).value;
  sceneModel.createGeometry({ id: "g", primitive: SPLATS, positions, scales, rotations, colorsCompressed: colors });
  sceneModel.createMesh({ id: "m", geometryId: "g" });
  sceneModel.createObject({ id: "gridMarkers_obj", meshIds: ["m"] });
}

// Generates one tile's splat attributes: a box-shaped cloud of small isotropic
// gaussians, flat-coloured by `hue` so each tile is visually distinct.
function makeTile(cx, cy, hue) {
  const n = SPLATS_PER_TILE;
  const positions = new Float32Array(n * 3);
  const scales = new Float32Array(n * 3);
  const rotations = new Float32Array(n * 4);
  const colors = new Uint8Array(n * 4);
  const [r, g, b] = hslToRgb(hue, 0.7, 0.55);
  for (let i = 0; i < n; i++) {
    positions[i * 3]     = cx + (Math.random() - 0.5) * TILE_FOOTPRINT;
    positions[i * 3 + 1] = cy + (Math.random() - 0.5) * TILE_FOOTPRINT;
    positions[i * 3 + 2] = 0.2 + Math.random() * TILE_HEIGHT;
    const sc = 0.045 + Math.random() * 0.03;
    scales[i * 3] = sc;
    scales[i * 3 + 1] = sc;
    scales[i * 3 + 2] = sc;
    rotations[i * 4 + 3] = 1;   // identity quaternion (xyzw)
    colors[i * 4]     = r;
    colors[i * 4 + 1] = g;
    colors[i * 4 + 2] = b;
    colors[i * 4 + 3] = 235;
  }
  return { positions, scales, rotations, colors };
}

function hslToRgb(h, s, l) {
  const k = (n) => (n + h * 12) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}
