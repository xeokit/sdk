import {XGFLoader} from "@xeokit/sdk/formats/xgf";
import {Scene} from "@xeokit/sdk/model/scene";
import {BVHPickStrategy, RoutingPickStrategy} from "@xeokit/sdk/spatial/picking";
import {ModelNavigationController} from "@xeokit/sdk/viewing/navigation/model";
import {WebGLRenderer} from "@xeokit/sdk/viewing/renderers/webGL";
import {WebGPURenderer} from "@xeokit/sdk/viewing/renderers/webGPU";
import {AmbientLight, DirLight, Viewer} from "@xeokit/sdk/viewing/viewer";
import {fetchArrayBuffer, finishExample, mustOk, signalExampleLoaded} from "../../../utils/standaloneRuntime.js";

const XGF_URL = "../../../../models/SportsCar/xgf/model.xgf";

const webglCanvas = document.getElementById("webglCanvas");
const webgpuCanvas = document.getElementById("webgpuCanvas");
const webglStatus = document.getElementById("webglStatus");
const webgpuStatus = document.getElementById("webgpuStatus");
const styleBinControls = document.getElementById("styleBinControls");
const styleBinLegend = document.getElementById("styleBinLegend");

const TOOL_IDS = ["xrayed", "selected", "highlighted", "clear"];
const STYLE_BIN_IDS = ["xrayed", "selected", "highlighted"];

const STYLE_BIN_PARAMS = [
  {
    id: "xrayed",
    priority: 10,
    fill: true,
    fillColor: [0.50, 0.74, 1.0],
    fillAlpha: 0.22,
    edges: true,
    edgeColor: [0.10, 0.26, 0.44],
    edgeAlpha: 0.92,
    clearDepthBefore: true
  },
  {
    id: "highlighted",
    priority: 60,
    fill: true,
    fillColor: [1.0, 0.80, 0.12],
    fillAlpha: 1.0,
    edges: true,
    edgeColor: [0.50, 0.32, 0.02],
    edgeAlpha: 1.0,
    clearDepthBefore: true
  },
  {
    id: "selected",
    priority: 100,
    fill: true,
    fillColor: [0.05, 0.62, 1.0],
    fillAlpha: 1.0,
    edges: true,
    edgeColor: [0.0, 0.10, 0.26],
    edgeAlpha: 1.0,
    clearDepthBefore: true
  }
];

const TOOL_LABELS = {
  xrayed: "Xray",
  selected: "Select",
  highlighted: "Highlight",
  clear: "Clear"
};

const runtime = {
  scene: null,
  sceneModel: null,
  webglViewer: null,
  webgpuViewer: null,
  webglView: null,
  webgpuView: null,
  webglRenderer: null,
  webgpuRenderer: null,
  webgpuError: null,
  webglPicker: null,
  webgpuPicker: null,
  objectIds: [],
  activeTool: "selected",
  lastPickedObjectId: null
};

window.webglWebgpuStyleBinsDemo = runtime;

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  setStatus(webglStatus, "error", message);
  setStatus(webgpuStatus, "error", message);
  console.error("[view/renderers/webgl-webgpu-style-bins]", error);
});

async function main() {
  const scene = new Scene({logging: false});
  const sceneModel = mustOk(scene.createModel({
    id: "sportsCarStyleBins",
    coordinateSystem: {
      basis: [
        1, 0, 0,
        0, 1, 0,
        0, 0, 1
      ],
      origin: [0, 0, 0],
      units: "meters",
      scaleToMeters: 1
    }
  }));

  runtime.scene = scene;
  runtime.sceneModel = sceneModel;

  const viewParams = {
    backgroundColor: [0.92, 0.94, 0.96],
    camera: {
      projection: "perspective",
      eye: [3.27, 3.91, 2.39],
      look: [0, 0, 0],
      up: [-0.18, -0.28, 0.93]
    },
    styleBins: clone(STYLE_BIN_PARAMS),
    effects: {
      edges: {
        enabled: true
      },
      sao: {
        enabled: true,
        intensity: 0.50,
        kernelRadius: 34,
        numSamples: 12
      },
      tonemap: {
        sRGBEncode: true
      }
    }
  };

  const webglViewer = new Viewer({scene, logging: false});
  const webgpuViewer = new Viewer({scene, logging: false});
  runtime.webglViewer = webglViewer;
  runtime.webgpuViewer = webgpuViewer;

  const webglView = mustOk(webglViewer.createView({
    id: "styleBinsWebGL",
    htmlElement: webglCanvas,
    ...clone(viewParams)
  }));
  const webgpuView = mustOk(webgpuViewer.createView({
    id: "styleBinsWebGPU",
    htmlElement: webgpuCanvas,
    ...clone(viewParams)
  }));
  runtime.webglView = webglView;
  runtime.webgpuView = webgpuView;

  configureLights(webglView, AmbientLight, DirLight);
  configureLights(webgpuView, AmbientLight, DirLight);
  syncViewCameras(webglView, webgpuView);
  setupControls();
  updateLegend();
  setStatus(webglStatus, "ok", "Loading SportsCar XGF.");
  setStatus(webgpuStatus, "warn", "Loading SportsCar XGF.");

  const fileData = await fetchArrayBuffer(XGF_URL);
  await new XGFLoader().load({fileData, sceneModel});
  runtime.objectIds = webglView.objectIds.slice();

  const webglRenderer = new WebGLRenderer({
    viewer: webglViewer,
    logging: false
  });
  runtime.webglRenderer = webglRenderer;
  const webglPicker = new RoutingPickStrategy(scene, webglRenderer);
  runtime.webglPicker = webglPicker;
  createInputController(ModelNavigationController, webglView, webglPicker);

  let webgpuRenderer = null;
  if (navigator.gpu) {
    const result = await WebGPURenderer.create({
      viewer: webgpuViewer,
      logging: false
    });
    if (result.ok) {
      webgpuRenderer = result.value;
      runtime.webgpuRenderer = webgpuRenderer;
      webgpuRenderer.events.onError.subscribe((_renderer, error) => {
        runtime.webgpuError = error.error;
        setStatus(webgpuStatus, "error", error.error);
        console.error("[view/renderers/webgl-webgpu-style-bins] WebGPU", error.error);
      });
      const webgpuPicker = new BVHPickStrategy(scene);
      runtime.webgpuPicker = webgpuPicker;
      createInputController(ModelNavigationController, webgpuView, webgpuPicker);
    } else {
      setStatus(webgpuStatus, "warn", result.error);
    }
  } else {
    setStatus(webgpuStatus, "warn", "WebGPU unavailable in this browser.");
  }

  clearInitialStyles([webglView, webgpuView]);
  installClickTool(webglView, webglPicker, "WebGL");
  if (runtime.webgpuPicker) {
    installClickTool(webgpuView, runtime.webgpuPicker, "WebGPU");
  }
  updateLegend();
  updateStatusText();

  finishExample(webglRenderer, webglView);
  setTimeout(signalExampleLoaded, 1500);
}

function clearInitialStyles(views) {
  for (const view of views) {
    clearBins(view, runtime.objectIds);
  }
}

function installClickTool(view, picker, title) {
  view.htmlElement.addEventListener("click", (event) => {
    const pickedId = pickObjectId(view, picker, event);
    if (!pickedId) {
      runtime.lastPickedObjectId = null;
      updateStatusText(`${title}: no object at click position.`);
      return;
    }
    applyToolToObject(pickedId);
    updateStatusText(`${title}: ${TOOL_LABELS[runtime.activeTool]} applied to ${pickedId}.`);
  });
}

function pickObjectId(view, picker, event) {
  const rect = view.htmlElement.getBoundingClientRect();
  const canvasPos = [
    event.clientX - rect.left,
    event.clientY - rect.top
  ];
  const result = picker.pick({view, canvasPos});
  if (!result || result.hit !== true) {
    return null;
  }
  return result.objectId || null;
}

function applyToolToObject(objectId) {
  runtime.lastPickedObjectId = objectId;
  for (const view of [runtime.webglView, runtime.webgpuView].filter(Boolean)) {
    const viewObject = view.objects[objectId];
    if (!viewObject) {
      continue;
    }
    for (const binId of STYLE_BIN_IDS) {
      mustOk(viewObject.setStyleBin(binId, false));
    }
    if (runtime.activeTool !== "clear") {
      mustOk(viewObject.setStyleBin(runtime.activeTool, true));
    }
  }
  updateLegend();
}

function clearBins(view, objectIds) {
  for (const binId of STYLE_BIN_IDS) {
    mustOk(view.setObjectsInStyleBin(binId, objectIds, false));
  }
}

function setupControls() {
  styleBinControls.replaceChildren(...TOOL_IDS.map((toolId) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = TOOL_LABELS[toolId];
    button.setAttribute("aria-pressed", runtime.activeTool === toolId ? "true" : "false");
    button.addEventListener("click", () => {
      runtime.activeTool = toolId;
      setupControls();
      updateStatusText();
    });
    return button;
  }));
}

function updateLegend() {
  const view = runtime.webglView;
  styleBinLegend.replaceChildren(...STYLE_BIN_PARAMS.map((params) => {
    const bin = view?.styleBins.get(params.id);
    const card = document.createElement("div");
    card.className = "bin-card";
    card.dataset.enabled = bin?.enabled !== false ? "true" : "false";

    const name = document.createElement("div");
    name.className = "bin-name";
    const swatch = document.createElement("span");
    swatch.className = "swatch";
    swatch.style.backgroundColor = toCssColor(params.fillColor);
    name.appendChild(swatch);
    name.appendChild(document.createTextNode(params.id));

    const meta = document.createElement("div");
    meta.className = "bin-meta";
    meta.textContent = `priority ${params.priority}; ${bin?.numObjects ?? 0} objects`;

    card.appendChild(name);
    card.appendChild(meta);
    return card;
  }));
}

function updateStatusText(message = null) {
  const state = getDemoState();
  const base = `Active tool: ${TOOL_LABELS[state.activeTool]}. Click any car part to move it into that style bin.`;
  const counts = `Counts: ${state.memberships}.`;
  const picked = state.lastPickedObjectId ? `Last object: ${state.lastPickedObjectId}.` : "The car starts with no style-bin memberships.";
  setStatus(webglStatus, "ok", message || `${base} ${counts} ${picked}`);
  if (runtime.webgpuRenderer) {
    if (runtime.webgpuError) {
      setStatus(webgpuStatus, "error", runtime.webgpuError);
    } else {
      setStatus(webgpuStatus, "ok", message || `${base} ${counts} ${picked}`);
    }
  }
}

function getDemoState() {
  const view = runtime.webglView;
  const counts = STYLE_BIN_IDS.map((id) => `${id}=${view?.styleBins.get(id)?.numObjects ?? 0}`);
  return {
    activeTool: runtime.activeTool,
    lastPickedObjectId: runtime.lastPickedObjectId,
    objectCount: runtime.objectIds.length,
    memberships: counts.join(" ")
  };
}

runtime.setActiveTool = (toolId) => {
  if (!TOOL_IDS.includes(toolId)) {
    throw new Error(`Unknown tool: ${toolId}`);
  }
  runtime.activeTool = toolId;
  setupControls();
  updateStatusText();
};
runtime.applyToolToObject = (objectId, toolId = runtime.activeTool) => {
  const previousTool = runtime.activeTool;
  runtime.activeTool = toolId;
  applyToolToObject(objectId);
  runtime.activeTool = previousTool;
  setupControls();
  updateStatusText();
};
runtime.clearAll = () => {
  for (const view of [runtime.webglView, runtime.webgpuView].filter(Boolean)) {
    clearBins(view, runtime.objectIds);
  }
  updateLegend();
  updateStatusText();
};
runtime.getState = getDemoState;


function configureLights(view, AmbientLight, DirLight) {
  view.clearLights();
  new AmbientLight(view, {
    color: [0.72, 0.75, 0.78],
    intensity: 0.78
  });
  new DirLight(view, {
    dir: [-0.40, -0.35, -0.84],
    color: [1.0, 0.95, 0.86],
    intensity: 1.45,
    space: "world"
  });
  new DirLight(view, {
    dir: [0.55, 0.25, -0.58],
    color: [0.58, 0.70, 1.0],
    intensity: 0.40,
    space: "world"
  });
}

function createInputController(InputController, view, picker) {
  try {
    return new InputController(view, {
      pick: (_view, pickParams) => adaptPickResult(_view, picker.pick({
        view: _view,
        ...pickParams
      })),
      keyboardEnabled: true,
      followPointer: true,
      rotationInertia: 0,
      panInertia: 0,
      dollyInertia: 0,
      doublePickFlyTo: true
    });
  } catch {
    return new InputController(view, {
      pick: (_view, pickParams) => adaptPickResult(_view, picker.pick({
        view: _view,
        ...pickParams
      }))
    });
  }
}

function adaptPickResult(view, pickResult) {
  if (!pickResult || !pickResult.hit) {
    return {
      ok: true,
      value: null
    };
  }
  return {
    ok: true,
    value: {
      ...pickResult,
      viewObject: pickResult.objectId ? view.objects[pickResult.objectId] || null : null,
      snappedToVertex: pickResult.snap?.type === "vertex",
      snappedToEdge: pickResult.snap?.type === "edge",
      snappedCanvasPos: pickResult.snap?.canvasPos || null
    }
  };
}

function syncViewCameras(viewA, viewB) {
  let syncing = false;
  const sync = (source, target) => {
    if (syncing) {
      return;
    }
    if (
      vectorEquals(source.camera.eye, target.camera.eye) &&
      vectorEquals(source.camera.look, target.camera.look) &&
      vectorEquals(source.camera.up, target.camera.up)
    ) {
      return;
    }
    syncing = true;
    target.camera.eye = copyVector(source.camera.eye);
    target.camera.look = copyVector(source.camera.look);
    target.camera.up = copyVector(source.camera.up);
    syncing = false;
  };
  viewA.viewer.events.onCameraViewMatrixUpdated.subscribe((changedView) => {
    if (changedView === viewA) {
      sync(viewA, viewB);
    }
  });
  viewB.viewer.events.onCameraViewMatrixUpdated.subscribe((changedView) => {
    if (changedView === viewB) {
      sync(viewB, viewA);
    }
  });
}

function vectorEquals(a, b) {
  return a && b && a.length === b.length && a.every((value, i) => value === b[i]);
}

function copyVector(value) {
  return Array.from(value || []);
}

function toCssColor(color) {
  return `rgb(${color.map((component) => Math.round(component * 255)).join(", ")})`;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function setStatus(element, state, message) {
  element.dataset.state = state;
  element.textContent = message;
}
