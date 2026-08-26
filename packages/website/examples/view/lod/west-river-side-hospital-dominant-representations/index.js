import * as xeokit from "../../../../js/xeokit-studio-bundle.js";
import {signalExampleLoaded} from "../../../utils/snapshotReady.js";

const {Scene} = xeokit.model.scene;
const {Viewer} = xeokit.viewing.viewer;
const {WebGLRenderer} = xeokit.viewing.renderers.webGL;
const {WebGPURenderer} = xeokit.viewing.renderers.webGPU;
const {ModelNavigationController} = xeokit.viewing.navigation.model;
const {RepresentationLODSelector} = xeokit.viewing.lod;

// This XGF was prepared offline from the full West Riverside Hospital model.
// Its "detailed" representation references all BIM SceneObjects, while
// "dominant" references a small set of high-impact objects selected by size.
const MODEL_URL = new URL("../../../../models/WestRiverSideHospital_DominantLOD/xgf/model.xgf", import.meta.url).href;
const COORD_SYS_URL = new URL("../../../../models/WestRiverSideHospital_DominantLOD/coordSys.json", import.meta.url).href;
const DEMO_REP_RANGES = {
  detailedMinPixels: 560,
  reducedMaxPixels: 480
};

const statsElement = document.getElementById("stats");
const statusElement = document.getElementById("status");
const errorElement = document.getElementById("error");
const nearButton = document.getElementById("nearButton");
const farButton = document.getElementById("farButton");
let activeCameraFlight = null;

main().catch((error) => {
  console.error("[view/lod/west-river-side-hospital-dominant-representations]", error);
  statusElement.style.display = "none";
  errorElement.style.display = "block";
  errorElement.textContent = error instanceof Error ? error.stack || error.message : String(error);
});

async function main() {
  // The hospital model is authored in its own model coordinate system. Keep the
  // Scene in xeokit's default Z-up system, then put the loaded coordinate system
  // on the SceneModel. This matches import/xgf/west-river-side-hospital and lets
  // SceneModel.coordinateSystemMatrix rotate the hospital upright in world space.
  const modelCoordinateSystem = await loadCoordinateSystem();
  const scene = new Scene({logging: false});
  const viewer = new Viewer({scene, logging: false});

  const view = mustOk(viewer.createView({
    id: "westRiverSideHospitalDominantLOD",
    htmlElement: document.getElementById("demoCanvas"),
    backgroundColor: [0.95, 0.97, 0.98],
    camera: {
      eye: [-170, -230, 130],
      look: [0, 0, 8],
      up: [0, 0, 1]
    }
  }));
  view.effects.edges.enabled = false;

  // Install the selector before loading the model. During XGF load, the model
  // creates representation-set metadata; with the camera already at the far
  // preset, the first rendered frame can use the dominant representation
  // instead of drawing every detailed hospital object.
  const selector = new RepresentationLODSelector({viewer});

  // The generated model has one projected-size representation set. Discover it
  // from SceneModel metadata instead of hard-coding LOD state in the viewer.
  const sceneModel = await loadModel(scene, modelCoordinateSystem);
  const repSet = Object.values(sceneModel.repSets)[0];
  if (!repSet) {
    throw new Error("WestRiverSideHospital_DominantLOD contains no representation sets.");
  }
  widenProjectedSizeSwitch(repSet);
  selector.updateAllViews();
  const modelAABB = getSceneModelAABB(sceneModel);
  const initialFarViewpoint = captureViewpoint(view);
  if (modelAABB) {
    fitViewToAABB(view, modelAABB);
  }
  const nearViewpoint = captureViewpoint(view);
  const dominantMaxPixels = repSet.reps.dominant?.range?.maxPixels ?? 260;
  const farViewpoint = modelAABB
    ? createProjectedSizeViewpoint(view, nearViewpoint, modelAABB, dominantMaxPixels * 0.35)
    : initialFarViewpoint;
  applyViewpoint(view, farViewpoint);
  selector.updateView(view);
  statusElement.style.display = "none";
  signalExampleLoaded();
  await nextFrame();
  const rendererInfo = await createRenderer(viewer);
  const renderer = rendererInfo.renderer;

  // Keep startup responsive. Building a CPU spatial index for this 54k-object
  // hospital model is too expensive for the first paint path.
  const indexedObjectCount = 0;
  const controls = new ModelNavigationController(view, {
    pick: noPick,
    followPointer: true,
    doublePickFlyTo: false,
    keyboardDollyRate: 16,
    keyboardPanRate: 8,
    mouseWheelDollyRate: 120,
    touchDollyRate: 0.18
  });

  nearButton.addEventListener("click", () => {
    // The flight simulates a quick user dolly. Camera setters schedule frames;
    // the example deliberately avoids needsRender() calls.
    flyToViewpoint(view, nearViewpoint);
  });

  farButton.addEventListener("click", () => {
    // Far should select the dominant representation, reducing per-frame render
    // work while keeping the large visual structure of the hospital.
    flyToViewpoint(view, farViewpoint);
  });

  // Stats are diagnostics only. Selection is driven by the selector and the
  // representation-set metadata serialized in the XGF.
  renderStats(selector, view, repSet, indexedObjectCount, rendererInfo.kind);
  requestAnimationFrame(function tick() {
    renderStats(selector, view, repSet, indexedObjectCount, rendererInfo.kind);
    requestAnimationFrame(tick);
  });

  window.westRiverSideHospitalDominantLODDemo = {
    scene,
    viewer,
    view,
    renderer,
    rendererKind: rendererInfo.kind,
    controls,
    selector,
    raycaster: null,
    indexedObjectCount,
    sceneModel,
    repSet
  };
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
        renderer: result.value
      };
    }
    if (requested === "webgpu") {
      throw new Error(result.error);
    }
    console.warn("[view/lod/west-river-side-hospital-dominant-representations] WebGPU renderer failed; falling back to WebGL.", result.error);
  }

  return {
    kind: "webgl",
    renderer: new WebGLRenderer({viewer, logging: false})
  };
}

async function loadCoordinateSystem() {
  const response = await fetch(COORD_SYS_URL);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} fetching ${COORD_SYS_URL}`);
  }
  return response.json();
}

async function loadModel(scene, coordinateSystem) {
  // The SceneModel contains both representations. The representation set only
  // references SceneObjects; it does not own or duplicate geometry resources.
  const sceneModel = mustOk(scene.createModel({
    id: "WestRiverSideHospital_DominantLOD",
    coordinateSystem,
    updateHint: "static",
    memoryPolicy: "compact"
  }));

  sceneModel.building = true;
  let batchActive = false;
  try {
    mustOk(sceneModel.beginBatch({id: "WestRiverSideHospital_DominantLOD:xgf"}));
    batchActive = true;
    await new xeokit.formats.xgf.XGFLoader().load({
      fileData: await loadArrayBuffer(MODEL_URL),
      sceneModel
    });
    mustOk(sceneModel.commitBatch());
    batchActive = false;
    mustOk(sceneModel.seal());
  } catch (error) {
    if (batchActive) {
      mustOk(sceneModel.rollbackBatch());
    }
    throw error;
  } finally {
    sceneModel.building = false;
  }

  return sceneModel;
}

async function loadArrayBuffer(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} fetching ${url}`);
    }
    return await response.arrayBuffer();
  } catch (fetchError) {
    // Keep the example compatible with simple local static servers and browser
    // configurations that do not allow this asset request through fetch().
    return new Promise((resolve, reject) => {
      const request = new XMLHttpRequest();
      request.open("GET", url, true);
      request.responseType = "arraybuffer";
      request.onload = () => {
        if (request.status >= 200 && request.status < 300) {
          resolve(request.response);
        } else {
          reject(new Error(`HTTP ${request.status} fetching ${url}`));
        }
      };
      request.onerror = () => reject(fetchError);
      request.send();
    });
  }
}

let lastStatsSignature = "";

function renderStats(selector, view, repSet, indexedObjectCount, rendererKind) {
  // Query selector state directly so the panel follows camera motion,
  // projected-size ranges and hysteresis.
  const activeRepId = selector.getActiveRepId(view, repSet);
  const activeRep = repSet.reps[activeRepId];
  const detailed = repSet.reps.detailed;
  const dominant = repSet.reps.dominant;
  const distance = cameraDistance(view.camera.eye, view.camera.look);
  const rows = [
    ["renderer", rendererKind],
    ["active", activeRepId],
    ["mode", selector.getMode(view, repSet)],
    ["distance", distance.toFixed(1)],
    ["detailed objects", detailed ? detailed.objectIds.length : 0],
    ["dominant objects", dominant ? dominant.objectIds.length : 0],
    ["visible rep objects", activeRep ? activeRep.objectIds.length : 0],
    ["spatial index", indexedObjectCount],
    ["hysteresis", repSet.selection?.hysteresisPixels ?? 0]
  ];
  const signature = rows.map(([name, value]) => `${name}:${value}`).join("|");
  if (signature === lastStatsSignature) {
    return;
  }
  lastStatsSignature = signature;
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

function noPick() {
  return {
    ok: true,
    value: null
  };
}

function nextFrame() {
  return new Promise((resolve) => requestAnimationFrame(resolve));
}

function scaleViewpointDistance(viewpoint, scale) {
  const eyeLook = [
    viewpoint.eye[0] - viewpoint.look[0],
    viewpoint.eye[1] - viewpoint.look[1],
    viewpoint.eye[2] - viewpoint.look[2]
  ];
  return {
    eye: [
      viewpoint.look[0] + eyeLook[0] * scale,
      viewpoint.look[1] + eyeLook[1] * scale,
      viewpoint.look[2] + eyeLook[2] * scale
    ],
    look: viewpoint.look,
    up: viewpoint.up,
    fov: viewpoint.fov
  };
}

function createProjectedSizeViewpoint(view, viewpoint, aabb, targetPixels) {
  const radius = getAABBDiagonal(aabb) * 0.5;
  const width = Math.max(1, view.htmlElement.clientWidth || view.boundary?.[2] || window.innerWidth || 1);
  const height = Math.max(1, view.htmlElement.clientHeight || view.boundary?.[3] || window.innerHeight || 1);
  const proj = view.camera.projMatrix;
  const projectionScale = Math.max(Math.abs(proj[0]) * width, Math.abs(proj[5]) * height);
  const distance = Math.max(cameraDistance(viewpoint.eye, viewpoint.look), projectionScale * radius / Math.max(1, targetPixels));
  const eyeLook = [
    viewpoint.eye[0] - viewpoint.look[0],
    viewpoint.eye[1] - viewpoint.look[1],
    viewpoint.eye[2] - viewpoint.look[2]
  ];
  const dir = normalize(eyeLook);
  return {
    eye: [
      viewpoint.look[0] + dir[0] * distance,
      viewpoint.look[1] + dir[1] * distance,
      viewpoint.look[2] + dir[2] * distance
    ],
    look: viewpoint.look,
    up: viewpoint.up,
    fov: viewpoint.fov
  };
}

function captureViewpoint(view) {
  return {
    eye: Array.from(view.camera.eye),
    look: Array.from(view.camera.look),
    up: Array.from(view.camera.up),
    fov: view.camera.perspectiveProjection.fov
  };
}

function applyViewpoint(view, viewpoint) {
  view.camera.perspectiveProjection.fov = viewpoint.fov;
  view.camera.eye = viewpoint.eye;
  view.camera.look = viewpoint.look;
  view.camera.up = viewpoint.up;
}

function widenProjectedSizeSwitch(repSet) {
  // The XGF contains the real authored ranges. This tutorial widens them after
  // load so the dominant-object transition is visible during the fast flight.
  setRepRange(repSet.reps.detailed, {minPixels: DEMO_REP_RANGES.detailedMinPixels});
  setRepRange(repSet.reps.dominant, {maxPixels: DEMO_REP_RANGES.reducedMaxPixels});
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

function fitViewToAABB(view, aabb) {
  const center = getAABBCenter(aabb);
  const diag = getAABBDiagonal(aabb);
  const eyeLook = [
    view.camera.eye[0] - view.camera.look[0],
    view.camera.eye[1] - view.camera.look[1],
    view.camera.eye[2] - view.camera.look[2]
  ];
  const dir = normalize(eyeLook);
  const dist = Math.abs(diag / Math.tan(45 * Math.PI / 180));
  view.camera.eye = [
    center[0] + dir[0] * dist,
    center[1] + dir[1] * dist,
    center[2] + dir[2] * dist
  ];
  view.camera.look = center;
  view.camera.up = [0, 0, 1];
}

function getSceneModelAABB(sceneModel) {
  const aabb = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
  let found = false;

  for (const mesh of Object.values(sceneModel.meshes)) {
    const meshAABB = mesh.geometry.aabb;
    if (!meshAABB) {
      continue;
    }
    expandAABBWithTransformedAABB(aabb, meshAABB, mesh.worldMatrix);
    found = true;
  }

  return found ? aabb : null;
}

function expandAABBWithTransformedAABB(target, source, matrix) {
  const x0 = source[0];
  const y0 = source[1];
  const z0 = source[2];
  const x1 = source[3];
  const y1 = source[4];
  const z1 = source[5];

  expandAABBWithPoint(target, transformPoint(matrix, x0, y0, z0));
  expandAABBWithPoint(target, transformPoint(matrix, x1, y0, z0));
  expandAABBWithPoint(target, transformPoint(matrix, x0, y1, z0));
  expandAABBWithPoint(target, transformPoint(matrix, x1, y1, z0));
  expandAABBWithPoint(target, transformPoint(matrix, x0, y0, z1));
  expandAABBWithPoint(target, transformPoint(matrix, x1, y0, z1));
  expandAABBWithPoint(target, transformPoint(matrix, x0, y1, z1));
  expandAABBWithPoint(target, transformPoint(matrix, x1, y1, z1));
}

function transformPoint(matrix, x, y, z) {
  return [
    matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12],
    matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13],
    matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14]
  ];
}

function expandAABBWithPoint(aabb, point) {
  aabb[0] = Math.min(aabb[0], point[0]);
  aabb[1] = Math.min(aabb[1], point[1]);
  aabb[2] = Math.min(aabb[2], point[2]);
  aabb[3] = Math.max(aabb[3], point[0]);
  aabb[4] = Math.max(aabb[4], point[1]);
  aabb[5] = Math.max(aabb[5], point[2]);
}

function getAABBCenter(aabb) {
  return [
    (aabb[0] + aabb[3]) * 0.5,
    (aabb[1] + aabb[4]) * 0.5,
    (aabb[2] + aabb[5]) * 0.5
  ];
}

function getAABBDiagonal(aabb) {
  const dx = aabb[3] - aabb[0];
  const dy = aabb[4] - aabb[1];
  const dz = aabb[5] - aabb[2];
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function normalize(vec) {
  const len = Math.sqrt(vec[0] * vec[0] + vec[1] * vec[1] + vec[2] * vec[2]) || 1;
  return [
    vec[0] / len,
    vec[1] / len,
    vec[2] / len
  ];
}

function mustOk(result) {
  if (!result.ok) {
    throw new Error(result.error);
  }
  return result.value;
}
