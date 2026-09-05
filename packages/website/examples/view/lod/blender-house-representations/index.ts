import {XGFLoader} from "@xeokit/sdk/formats/xgf";
import {Scene} from "@xeokit/sdk/model/scene";
import {RepresentationLODSelector} from "@xeokit/sdk/viewing/lod";
import {ModelNavigationController} from "@xeokit/sdk/viewing/navigation/model";
import {WebGLRenderer} from "@xeokit/sdk/viewing/renderers/webGL";
import {WebGPURenderer} from "@xeokit/sdk/viewing/renderers/webGPU";
import {Viewer} from "@xeokit/sdk/viewing/viewer";
import {fetchArrayBuffer, mustElement, mustOk, noPick, signalExampleLoaded, configureExampleRenderer} from "../../../utils/standaloneRuntime.js";


// This XGF was prepared offline. It contains ordinary SceneObjects plus a
// SceneModel representation set whose reps are "detailed" and "shell".
const MODEL_URL = new URL("../../../../models/BlenderHouse_LoD/xgf/model.xgf", import.meta.url).href;
const BLENDER_HOUSE_COORDINATE_SYSTEM = {
  basis: [
    1, 0, 0,
    0, 0, 1,
    0, 1, 0
  ],
  origin: [0, 0, 0],
  units: "meters"
};
const NEAR_VIEWPOINT = {
  eye: [7.2, -4.4, 4.2],
  look: [3.4, 3.4, 2.8],
  up: [0, 0, 1]
};
const FAR_VIEWPOINT = {
  eye: [120, -155, 92],
  look: [2.8, 5.1, 4.2],
  up: [0, 0, 1]
};
const DEMO_REP_RANGES = {
  detailedMinPixels: 420,
  reducedMaxPixels: 360
};

const statsElement = mustElement("stats");
const errorElement = mustElement("error");
const nearButton = mustElement("nearButton");
const farButton = mustElement("farButton");
let activeCameraFlight = null;

main().catch((error) => {
  console.error("[view/lod/blender-house-representations]", error);
  errorElement.style.display = "block";
  errorElement.textContent = error instanceof Error ? error.stack || error.message : String(error);
});

async function main() {
  // Use the same coordinate-system metadata that was used when this XGF was
  // exported. The basis maps the model's Y-up source data into the Scene's
  // Z-up world space, which keeps the model, camera and projected-size LOD
  // tests in the same coordinate space.
  const coordinateSystem = BLENDER_HOUSE_COORDINATE_SYSTEM;
  const scene = new Scene({coordinateSystem, logging: false});
  const viewer = new Viewer({scene, logging: false});

  // The representation selector works per View. A second View could choose a
  // different representation at the same time without changing SceneModel data.
  const view = mustOk(viewer.createView({
    id: "blenderHouseLOD",
    htmlElement: mustElement("demoCanvas"),
    backgroundColor: [0.95, 0.97, 0.98],
    camera: {
      projection: "perspective",
      far: 1000000,
      eye: [16, -18, 10],
      look: [2.8, 5.1, 4.2],
      up: [0, 0, 1]
    }
  }));

  const controls = new ModelNavigationController(view, {
    pick: noPick,
    followPointer: true,
    doublePickFlyTo: true,
    keyboardDollyRate: 8,
    keyboardPanRate: 4,
    mouseWheelDollyRate: 70,
    touchDollyRate: 0.14
  });

  const sceneModel = await loadModel(scene, coordinateSystem);

  // Representation sets are model-authored metadata. The viewer discovers them
  // after loading instead of hard-coding "house", "shell" or LOD-specific IDs.
  const repSet = Object.values(sceneModel.repSets)[0];
  if (!repSet) {
    throw new Error("BlenderHouse_LoD contains no representation sets.");
  }
  widenProjectedSizeSwitch(repSet);

  // RepresentationLODSelector reads projected-size selection hints from each
  // SceneRepSet, then suppresses the non-selected representation for this View.
  const selector = new RepresentationLODSelector({viewer});
  signalExampleLoaded();
  await nextFrame();
  const rendererInfo = await createRenderer(viewer);
  const renderer = rendererInfo.renderer;

  nearButton.addEventListener("click", () => {
    // The flight simulates a quick user dolly. Camera setters schedule frames;
    flyToViewpoint(view, NEAR_VIEWPOINT);
  });

  farButton.addEventListener("click", () => {
    // At this distance, the projected-size range authored in the representation
    // set should select the single-object shell representation.
    flyToViewpoint(view, FAR_VIEWPOINT);
  });

  // The panel is diagnostic: it shows what the selector has chosen without
  // driving selection itself. Actual switching is handled by the selector.
  renderStats(selector, view, repSet, rendererInfo.kind);
  requestAnimationFrame(function tick() {
    renderStats(selector, view, repSet, rendererInfo.kind);
    requestAnimationFrame(tick);
  });

  window.blenderHouseLODDemo = {
    scene,
    viewer,
    view,
    renderer,
    rendererKind: rendererInfo.kind,
    controls,
    selector,
    sceneModel,
    repSet
  };
}

function nextFrame() {
  return new Promise((resolve) => requestAnimationFrame(resolve));
}

async function createRenderer(viewer) {
  const requested = new URLSearchParams(window.location.search).get("renderer");
  const rendererKind = requested === "webgl" || requested === "webgpu"
    ? requested
    : navigator.gpu ? "webgpu" : "webgl";

  if (rendererKind === "webgpu") {
    if (!navigator.gpu) {
      throw new Error("This browser does not expose navigator.gpu. Use renderer=webgl.");
    }
    const result = await WebGPURenderer.create({viewer, logging: false});
    if (result.ok) {
      return {
        kind: "webgpu",
        renderer: configureExampleRenderer(viewer, result.value)
      };
    }
    if (requested === "webgpu") {
      throw new Error(result.error);
    }
    console.warn("[view/lod/blender-house-representations] WebGPU renderer failed; falling back to WebGL.", result.error);
  }

  return {
    kind: "webgl",
    renderer: configureExampleRenderer(viewer, new WebGLRenderer({viewer, logging: false}))
  };
}

async function loadModel(scene, coordinateSystem) {
  // The SceneModel owns both the real model objects and the shell object. Its
  // representation set only references SceneObjects; it does not own geometry.
  const sceneModel = mustOk(scene.createModel({
    id: "BlenderHouse_LoD",
    coordinateSystem,
    updateHint: "static"
  }));

  await new XGFLoader().load({
    fileData: await fetchArrayBuffer(MODEL_URL),
    sceneModel
  });

  return sceneModel;
}

function renderStats(selector, view, repSet, rendererKind) {
  // Use selector queries rather than cached local state so the panel reflects
  // per-frame projected-size decisions and hysteresis.
  const activeRepId = selector.getActiveRepId(view, repSet);
  const activeRep = repSet.reps[activeRepId];
  const detailed = repSet.reps.detailed;
  const shell = repSet.reps.shell;
  const distance = cameraDistance(view.camera.eye, view.camera.look);
  const rows = [
    ["renderer", rendererKind],
    ["active", activeRepId],
    ["mode", selector.getMode(view, repSet)],
    ["distance", distance.toFixed(1)],
    ["detailed objects", detailed ? detailed.objectIds.length : 0],
    ["shell objects", shell ? shell.objectIds.length : 0],
    ["visible rep objects", activeRep ? activeRep.objectIds.length : 0],
    ["hysteresis", repSet.selection?.hysteresisPixels ?? 0]
  ];
  statsElement.replaceChildren(...rows.flatMap(([name, value]) => {
    const nameElement = document.createElement("div");
    nameElement.className = "name";
    nameElement.textContent = name;
    const valueElement = document.createElement("div");
    valueElement.className = "value";
    valueElement.textContent = String(value);
    return [nameElement, valueElement];
  }));
}

function cameraDistance(eye, look) {
  const dx = eye[0] - look[0];
  const dy = eye[1] - look[1];
  const dz = eye[2] - look[2];
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function widenProjectedSizeSwitch(repSet) {
  // The XGF contains the real authored ranges. This tutorial widens them after
  // load so the shell transition is obvious during the short Near/Far flight.
  setRepRange(repSet.reps.detailed, {minPixels: DEMO_REP_RANGES.detailedMinPixels});
  setRepRange(repSet.reps.shell, {maxPixels: DEMO_REP_RANGES.reducedMaxPixels});
}

function setRepRange(rep, range) {
  if (!rep) {
    return;
  }
  rep.range = {
    ...rep.range,
    ...range
  };
}

function flyToViewpoint(view, viewpoint, durationMs = 850) {
  if (activeCameraFlight) {
    cancelAnimationFrame(activeCameraFlight.frameId);
  }
  const from = captureViewpoint(view);
  const to = normalizeViewpoint(view, viewpoint);
  const started = performance.now();
  const flight = {frameId: 0};
  activeCameraFlight = flight;

  function step(now) {
    if (activeCameraFlight !== flight) {
      return;
    }
    const t = Math.min(1, (now - started) / durationMs);
    applyInterpolatedViewpoint(view, from, to, easeInOutCubic(t));
    if (t < 1) {
      flight.frameId = requestAnimationFrame(step);
      return;
    }
    applyViewpoint(view, to);
    activeCameraFlight = null;
  }

  flight.frameId = requestAnimationFrame(step);
}

function captureViewpoint(view) {
  return {
    eye: Array.from(view.camera.eye),
    look: Array.from(view.camera.look),
    up: Array.from(view.camera.up),
    fov: view.camera.perspectiveProjection.fov
  };
}

function normalizeViewpoint(view, viewpoint) {
  return {
    eye: Array.from(viewpoint.eye),
    look: Array.from(viewpoint.look),
    up: Array.from(viewpoint.up),
    fov: viewpoint.fov ?? view.camera.perspectiveProjection.fov
  };
}

function applyInterpolatedViewpoint(view, from, to, t) {
  view.camera.perspectiveProjection.fov = lerp(from.fov, to.fov, t);
  view.camera.eye = lerpVec3(from.eye, to.eye, t);
  view.camera.look = lerpVec3(from.look, to.look, t);
  view.camera.up = normalize(lerpVec3(from.up, to.up, t));
}

function applyViewpoint(view, viewpoint) {
  view.camera.perspectiveProjection.fov = viewpoint.fov;
  view.camera.eye = viewpoint.eye;
  view.camera.look = viewpoint.look;
  view.camera.up = viewpoint.up;
}

function lerpVec3(a, b, t) {
  return [
    lerp(a[0], b[0], t),
    lerp(a[1], b[1], t),
    lerp(a[2], b[2], t)
  ];
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) * 0.5;
}

function normalize(vec) {
  const len = Math.sqrt(vec[0] * vec[0] + vec[1] * vec[1] + vec[2] * vec[2]) || 1;
  return [
    vec[0] / len,
    vec[1] / len,
    vec[2] / len
  ];
}
