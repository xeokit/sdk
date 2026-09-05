import {XGFStreamingLoader, XGFViewStreamController, readXGFStreamingRuntimeIndex} from "@xeokit/sdk/formats/xgfstream";
import {Scene} from "@xeokit/sdk/model/scene";
import {CameraFlightAnimation} from "@xeokit/sdk/viewing/cameraFlight";
import {ModelNavigationController} from "@xeokit/sdk/viewing/navigation/model";
import {WebGPURenderer} from "@xeokit/sdk/viewing/renderers/webGPU";
import {WebGLRenderer} from "@xeokit/sdk/viewing/renderers/webGL";
import {AmbientLight, DirLight, PickResult, Viewer} from "@xeokit/sdk/viewing/viewer";
import {SceneCollisionIndex} from "@xeokit/sdk/spatial/collision";
import {RoutingPickStrategy} from "@xeokit/sdk/spatial/picking";
import {fetchJSON, getRequestedRenderer, mustElement, mustOk, noPick, withExampleEnvironment} from "./standaloneRuntime.js";

export const XGF_IDENTITY_COORDINATE_SYSTEM = {
  basis: [1, 0, 0, 0, 1, 0, 0, 0, 1],
  origin: [0, 0, 0],
  units: "meters",
  scaleToMeters: 1
};

export async function createXGFViewer(params = {}) {
  const htmlElement = params.htmlElement || mustElement(params.canvasId || "demoCanvas");
  const scene = new Scene({logging: params.logging === true});
  const viewer = new Viewer({scene, logging: params.logging === true});
  const viewParams = withExampleEnvironment({
    adaptiveQuality: false,
    texturing: {enabled: true},
    ...(params.viewParams || {})
  });
  const view = mustOk(viewer.createView({
    id: params.viewId || "demoView",
    htmlElement,
    ...viewParams
  }));
  const rendererName = getRequestedRenderer(params.renderer);
  const renderer = rendererName === "webgl"
    ? new WebGLRenderer({viewer, logging: params.logging === true})
    : await createDefaultWebGPURenderer(viewer, params);
  if (params.grid !== false) {
    mustOk(renderer.setInfiniteGridEnabled(true));
  }
  const collisionIndex = new SceneCollisionIndex(scene);
  const picker = params.pick === false ? null : new RoutingPickStrategy(scene, renderer);
  const inputController = params.navigation === false ? null : new ModelNavigationController(view, {
    pick: picker ? (_view, pickParams) => pickForModelNavigation(view, picker, pickParams) : noPick,
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
  return {
    scene,
    viewer,
    view,
    renderer,
    collisionIndex,
    picker,
    inputController,
    cameraFlight: new CameraFlightAnimation(view, {duration: params.flightDuration ?? 0})
  };
}

export async function loadXGFStreamIndex(url) {
  const runtimeIndex = await fetchJSON(url);
  const result = readXGFStreamingRuntimeIndex(runtimeIndex);
  if (!result.ok) {
    throw new Error(result.error);
  }
  return resolveIndexRelativeChunkUris(result.value, url);
}

export function createXGFStreamController(params) {
  return new XGFViewStreamController({
    loader: new XGFStreamingLoader(),
    batchSize: 8,
    fetchConcurrency: 8,
    cameraDebounceMs: 140,
    cacheFileData: true,
    maxCachedFileBytes: 128 * 1024 * 1024,
    frustumOnly: true,
    ...params
  });
}

export function configureSimpleDaylight(view, params = {}) {
  view.clearLights();
  if (view.lights?.ibl) {
    view.lights.ibl.enabled = false;
    view.lights.ibl.intensity = 0;
  }
  if (view.lights?.hemispheric) {
    view.lights.hemispheric.enabled = params.hemisphericEnabled ?? true;
    view.lights.hemispheric.intensity = params.hemisphericIntensity ?? 0.18;
    view.lights.hemispheric.skyColor = params.hemisphericSkyColor || [0.72, 0.82, 0.94];
    view.lights.hemispheric.groundColor = params.hemisphericGroundColor || [0.42, 0.44, 0.4];
  }
  new AmbientLight(view, {
    color: params.ambientColor || [1, 1, 1],
    intensity: params.ambientIntensity ?? 0.16
  });
  new DirLight(view, {
    dir: params.sunDir || [-0.42, -0.62, -0.72],
    color: params.sunColor || [1, 0.96, 0.88],
    intensity: params.sunIntensity ?? 1.2,
    space: "world"
  });
}

export function signalReadyOnNextRender(renderer, view) {
  renderer.events.onViewRendered.one(() => signalReady());
}

export function signalReady() {
  if (document.getElementById("ExampleLoaded")) {
    return;
  }
  const marker = document.createElement("div");
  marker.id = "ExampleLoaded";
  marker.hidden = true;
  document.body.appendChild(marker);
}

export function hideStatus(statusId = "status") {
  const status = document.getElementById(statusId);
  if (status) {
    status.style.display = "none";
  }
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

function pickForModelNavigation(view, pickStrategy, pickParams) {
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
  const navPickResult = new PickResult();
  navPickResult.view = view;
  navPickResult.viewObject = result.objectId ? view.objects[result.objectId] : null;
  navPickResult.canvasPos = result.canvasPos || pickParams.canvasPos;
  navPickResult.origin = result.rayOrigin;
  navPickResult.direction = result.rayDir;
  navPickResult.worldPos = result.worldPos;
  navPickResult.worldNormal = result.worldNormal;
  navPickResult.localPos = result.localPos;
  navPickResult.uv = result.uv;
  return {ok: true, value: navPickResult};
}

function resolveIndexRelativeChunkUris(index, indexURL) {
  const baseURL = new URL(indexURL, window.location.href).href;
  return {
    ...index,
    chunks: (index.chunks || []).map((manifest) => ({
      ...manifest,
      uri: manifest.uri ? new URL(manifest.uri, baseURL).href : manifest.uri,
      dependencies: {
        ...manifest.dependencies,
        chunks: (manifest.dependencies?.chunks || []).map((dependency) => ({
          ...dependency,
          uri: dependency.uri ? new URL(dependency.uri, baseURL).href : dependency.uri
        }))
      }
    }))
  };
}
