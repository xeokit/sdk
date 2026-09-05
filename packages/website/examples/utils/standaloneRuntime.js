import {Scene} from "@xeokit/sdk/model/scene";
import {CameraFlightAnimation} from "@xeokit/sdk/viewing/cameraFlight";
import {ModelNavigationController} from "@xeokit/sdk/viewing/navigation/model";
import {WebGPURenderer} from "@xeokit/sdk/viewing/renderers/webGPU";
import {WebGLRenderer} from "@xeokit/sdk/viewing/renderers/webGL";
import {AmbientLight, PickResult, Viewer} from "@xeokit/sdk/viewing/viewer";
import {RoutingPickStrategy} from "@xeokit/sdk/spatial/picking";
import {signalExampleLoaded, signalExampleLoadedOnNextRender} from "./snapshotReady.js";

export {signalExampleLoaded};

const DEFAULT_EXAMPLE_BACKGROUND_COLOR = [0.78, 0.86, 0.94];
const DEFAULT_EXAMPLE_SKY = {
  enabled: true,
  skyColor: [0.58, 0.74, 0.92],
  horizonColor: [0.78, 0.86, 0.92],
  groundColor: [0.5, 0.54, 0.5],
  horizonBlend: 0.42,
  sunGlowIntensity: 0.12
};

export async function createStandaloneRuntime(params = {}) {
  const canvas = mustElement(params.canvasId || "demoCanvas");
  const scene = new Scene({logging: params.logging === true});
  const viewer = new Viewer({scene, logging: params.logging === true});
  const view = createExampleView(viewer, {
    id: params.viewId || "demoView",
    htmlElement: canvas,
    adaptiveQuality: false,
    texturing: {enabled: true},
    ...(params.viewParams || {})
  });
  const renderer = await createExampleRenderer(viewer, params);
  renderer.events.onError.subscribe((_renderer, error) => {
    if (params.statusId) {
      setStatus(params.statusId, error.error, "error");
    }
  });
  const picker = params.pick === false ? null : new RoutingPickStrategy(scene, renderer);
  const inputController = params.navigation === false ? null : new ModelNavigationController(view, {
    pick: picker ? createModelNavigationPickAdapter(view, picker) : noPick,
    followPointer: params.followPointer !== false,
    rotationInertia: 0,
    panInertia: 0,
    dollyInertia: 0,
    doublePickFlyTo: false,
    keyboardDollyRate: 10,
    keyboardPanRate: 4,
    mouseWheelDollyRate: 70,
    touchDollyRate: 0.16,
    ...(params.navigationParams || {})
  });
  return {canvas, scene, viewer, view, renderer, picker, inputController};
}

export function createWebGLRuntime(params = {}) {
  const canvas = mustElement(params.canvasId || "demoCanvas");
  const scene = new Scene({logging: params.logging === true});
  const viewer = new Viewer({scene, logging: params.logging === true});
  const view = createExampleView(viewer, {
    id: params.viewId || "demoView",
    htmlElement: canvas,
    ...(params.viewParams || {})
  });
  const renderer = new WebGLRenderer({viewer, logging: params.logging === true});
  renderer.events.onError.subscribe((_renderer, error) => {
    if (params.statusId) {
      setStatus(params.statusId, error.error, "error");
    }
  });
  const picker = params.pick === false ? null : new RoutingPickStrategy(scene, renderer);
  const inputController = params.navigation === false ? null : new ModelNavigationController(view, {
    pick: picker ? createModelNavigationPickAdapter(view, picker) : noPick,
    followPointer: params.followPointer !== false,
    rotationInertia: 0,
    panInertia: 0,
    dollyInertia: 0,
    doublePickFlyTo: false,
    keyboardDollyRate: 10,
    keyboardPanRate: 4,
    mouseWheelDollyRate: 70,
    touchDollyRate: 0.16,
    ...(params.navigationParams || {})
  });
  if (params.grid !== false) {
    mustOk(renderer.setInfiniteGridEnabled(true));
  }
  return {canvas, scene, viewer, view, renderer, picker, inputController};
}

export async function createExampleRenderer(viewer, params = {}) {
  const rendererName = getRequestedRenderer(params.renderer);
  const renderer = rendererName === "webgl"
    ? new WebGLRenderer({viewer, logging: params.logging === true})
    : await createDefaultWebGPURenderer(viewer, params);
  return configureExampleRenderer(viewer, renderer, params);
}

export function getRequestedRenderer(fallback = "webgpu") {
  const urlRenderer = new URLSearchParams(window.location.search).get("renderer");
  const renderer = (urlRenderer || fallback || "webgpu").toLowerCase();
  if (renderer === "webgl" || renderer === "webgpu") {
    return renderer;
  }
  console.warn(`[xeokit example] Unsupported renderer '${renderer}', using WebGPU.`);
  return "webgpu";
}

async function createWebGPURenderer(viewer, params) {
  const result = await WebGPURenderer.create({
    viewer,
    logging: false,
    ...params
  });
  if (!result.ok) {
    throw new Error(result.error);
  }
  return result.value;
}

async function createDefaultWebGPURenderer(viewer, params) {
  try {
    return await createWebGPURenderer(viewer, params.webGPU || {});
  } catch (error) {
    if (isRendererExplicit(params.renderer)) {
      throw error;
    }
    console.warn(`[xeokit example] WebGPU unavailable, falling back to WebGL: ${error instanceof Error ? error.message : String(error)}`);
    return new WebGLRenderer({viewer, logging: params.logging === true});
  }
}

function isRendererExplicit(fallback) {
  if (fallback) {
    return true;
  }
  return new URLSearchParams(window.location.search).has("renderer");
}

export function finishExample(renderer, view) {
  signalExampleLoadedOnNextRender(renderer, view);
}

export function fitViewToScene(view, params = {}) {
  new CameraFlightAnimation(view, {duration: 0}).jumpTo({
    fitFOV: 45,
    ...params
  });
}

export async function fetchJSON(src) {
  const response = await fetch(src);
  if (!response.ok) {
    throw new Error(`Unable to load ${src}: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

export async function fetchArrayBuffer(src) {
  const response = await fetch(src);
  if (!response.ok) {
    throw new Error(`Unable to load ${src}: ${response.status} ${response.statusText}`);
  }
  return response.arrayBuffer();
}

export async function fetchText(src) {
  const response = await fetch(src);
  if (!response.ok) {
    throw new Error(`Unable to load ${src}: ${response.status} ${response.statusText}`);
  }
  return response.text();
}

export function failExample(label, error, statusId = "status") {
  const message = error instanceof Error ? error.message : String(error);
  setStatus(statusId, message, "error");
  signalExampleLoaded();
  console.error(label, message);
}

export function setStatus(id, message, state = "ok") {
  const status = document.getElementById(id);
  if (!status) {
    return;
  }
  status.dataset.state = state;
  status.textContent = message;
}

export function addRadioGroup(container, label, value, options, onChange) {
  const fieldset = document.createElement("fieldset");
  const legend = document.createElement("legend");
  legend.textContent = label;
  fieldset.appendChild(legend);
  for (const option of options) {
    const optionId = `${label}-${option.value}`.replace(/\W+/g, "-");
    const row = document.createElement("label");
    row.htmlFor = optionId;
    const input = document.createElement("input");
    input.type = "radio";
    input.name = label;
    input.id = optionId;
    input.value = option.value;
    input.checked = option.value === value;
    input.addEventListener("change", () => {
      if (input.checked) {
        onChange(input.value);
      }
    });
    row.append(input, document.createTextNode(option.label));
    fieldset.appendChild(row);
  }
  container.appendChild(fieldset);
}

export function addSlider(container, params) {
  const row = document.createElement("label");
  const text = document.createElement("span");
  const value = document.createElement("output");
  const input = document.createElement("input");
  text.textContent = params.label;
  input.type = "range";
  input.min = String(params.min);
  input.max = String(params.max);
  input.step = String(params.step ?? 1);
  input.value = String(params.value);
  const digits = params.digits ?? 0;
  const update = () => {
    const number = Number(input.value);
    value.textContent = number.toFixed(digits);
    params.onChange(number);
  };
  input.addEventListener("input", update);
  value.textContent = Number(input.value).toFixed(digits);
  row.append(text, input, value);
  container.appendChild(row);
}

export function noPick() {
  return {ok: true, value: null};
}

export function withExampleEnvironment(viewParams = {}) {
  const effects = viewParams.effects || {};
  return {
    backgroundColor: DEFAULT_EXAMPLE_BACKGROUND_COLOR,
    ...viewParams,
    effects: {
      ...effects,
      ...(effects.sky === undefined ? {sky: {...DEFAULT_EXAMPLE_SKY}} : {})
    }
  };
}

export function createExampleView(viewer, viewParams = {}) {
  const view = mustOk(viewer.createView(withExampleEnvironment(viewParams)));
  disableAmbientWhenHemisphericEnabled(view);
  return view;
}

function disableAmbientWhenHemisphericEnabled(view) {
  const hemispheric = view.lights?.hemispheric;
  if (!hemispheric?.enabled || hemispheric.intensity <= 0) {
    return;
  }

  let zeroAmbient = null;
  for (const light of [...view.lightsList]) {
    if (!(light instanceof AmbientLight)) {
      continue;
    }
    if (light.id === "zeroAmbientWhenHemispheric") {
      zeroAmbient = light;
      continue;
    }
    light.destroy();
  }

  if (zeroAmbient) {
    zeroAmbient.color = [0, 0, 0];
    zeroAmbient.intensity = 0;
    return;
  }

  new AmbientLight(view, {
    id: "zeroAmbientWhenHemispheric",
    color: [0, 0, 0],
    intensity: 0
  });
}

export function applyExampleEnvironmentToViews(viewer, params = {}) {
  if (params.sky === false) {
    return;
  }
  for (const view of viewer.viewList || []) {
    if (!view.effects?.sky) {
      continue;
    }
    if (view.effects.sky.enabled) {
      continue;
    }
    view.effects.sky.enabled = true;
    view.effects.sky.skyColor = DEFAULT_EXAMPLE_SKY.skyColor;
    view.effects.sky.horizonColor = DEFAULT_EXAMPLE_SKY.horizonColor;
    view.effects.sky.groundColor = DEFAULT_EXAMPLE_SKY.groundColor;
    view.effects.sky.horizonBlend = DEFAULT_EXAMPLE_SKY.horizonBlend;
    view.effects.sky.sunGlowIntensity = DEFAULT_EXAMPLE_SKY.sunGlowIntensity;
  }
}

export function configureExampleRenderer(viewer, renderer, params = {}) {
  applyExampleEnvironmentToViews(viewer, params);
  if (params.grid !== false) {
    mustOk(renderer.setInfiniteGridEnabled(true));
  }
  return renderer;
}

export function createModelNavigationPickAdapter(view, pickStrategy) {
  return (_view, pickParams) => {
    const result = pickStrategy.pick({
      view,
      canvasPos: pickParams.canvasPos,
      snapRadius: pickParams.snapRadius,
      snapToVertex: pickParams.snapToVertex,
      snapToEdge: pickParams.snapToEdge,
      pickInvisible: pickParams.pickInvisible,
      pickSurfaceNormal: pickParams.pickSurfaceNormal
    });
    if (!result.hit) {
      return {ok: true, value: null};
    }

    return {ok: true, value: toNavigationPick(view, result, pickParams.canvasPos)};
  };
}

export function toNavigationPick(view, pickResult, fallbackCanvasPos = null) {
  const navPickResult = new PickResult();
  navPickResult.view = view;
  navPickResult.viewObject = pickResult.objectId ? view.objects[pickResult.objectId] : null;
  navPickResult.canvasPos = pickResult.canvasPos || fallbackCanvasPos;
  navPickResult.origin = pickResult.rayOrigin;
  navPickResult.direction = pickResult.rayDir;
  navPickResult.worldPos = pickResult.worldPos;
  navPickResult.worldNormal = pickResult.worldNormal;
  navPickResult.localPos = pickResult.localPos;
  navPickResult.uv = pickResult.uv;
  if (pickResult.snap) {
    navPickResult.snappedToVertex = pickResult.snap.type === "vertex";
    navPickResult.snappedToEdge = pickResult.snap.type === "edge";
    navPickResult.snappedCanvasPos = pickResult.snap.canvasPos;
  }
  return navPickResult;
}

export function mustOk(result) {
  if (!result.ok) {
    throw new Error(result.error || result.message || "SDK operation failed");
  }
  return result.value;
}

export function mustElement(id) {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Missing #${id}`);
  }
  return element;
}
