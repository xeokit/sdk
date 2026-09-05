import {Scene} from "@xeokit/sdk/model/scene";
import {CameraFlightAnimation} from "@xeokit/sdk/viewing/cameraFlight";
import {ModelNavigationController} from "@xeokit/sdk/viewing/navigation/model";
import {WebGPURenderer} from "@xeokit/sdk/viewing/renderers/webGPU";
import {WebGLRenderer} from "@xeokit/sdk/viewing/renderers/webGL";
import {AmbientLight, DirLight, PickResult, Viewer} from "@xeokit/sdk/viewing/viewer";
import {RoutingPickStrategy} from "@xeokit/sdk/spatial/picking";
import {getRequestedRenderer} from "./standaloneRuntime.js";

export const FAST_STREAMING_WEBGPU_CONFIG = {
  deviceDescriptor: {
    requiredLimits: {
      maxStorageBufferBindingSize: 256 * 1024 * 1024
    }
  },
  memoryConfigs: {
    maxBatches: 48,
    maxBatchVertices: 45000,
    maxBatchIndices: 135000,
    maxBatchPrims: 45000,
    maxBatchGeometries: 1536,
    maxBatchMeshes: 1536,
    maxTiles: 512,
    compactStreamPages: true,
    compactSealedStreamPages: true
  },
  renderConfigs: {
    triangleColorMode: "auto",
    edges: false,
    depthPrepass: false
  }
};

export function createFastStreamingViewParams(params) {
  return {
    id: params.viewId || "demoView",
    htmlElement: params.htmlElement || params.canvas,
    adaptiveQuality: false,
    backgroundColor: [0.24, 0.34, 0.5],
    resolutionScale: {
      enabled: false,
      resolutionScale: 1
    },
    texturing: {
      enabled: true
    },
    effects: {
      sao: {enabled: false},
      ibl: {enabled: false},
      edges: {
        enabled: false,
        useMeshColor: true,
        edgeDarken: 0.45,
        edgeAlpha: 0.85,
        edgeWidth: 1
      },
      shadows: {enabled: false},
      atmosphere: {enabled: false},
      bloom: {enabled: false},
      depthOfField: {enabled: false},
      colorGrading: {enabled: false},
      tonemap: {enabled: false},
      antiAliasing: {enabled: false},
      sky: {
        enabled: true,
        skyColor: [0.28, 0.45, 0.66],
        horizonColor: [0.58, 0.68, 0.76],
        groundColor: [0.56, 0.58, 0.55],
        horizonBlend: 0.42,
        sunGlowIntensity: 0.12
      }
    },
    camera: params.camera
  };
}

export async function createFastStreamingViewer(params) {
  const htmlElement = resolveViewElement(params);
  const scene = new Scene({logging: false});
  const viewer = new Viewer({scene, logging: false});
  const view = must(viewer.createView(createFastStreamingViewParams({
    viewId: params.viewId,
    htmlElement,
    camera: params.camera
  })));

  configureFastStreamingLighting(view);
  view.linesMaterial.lineWidth = params.lineWidth ?? 1.75;
  view.linesMaterial.joinStyle = "round";

  const renderer = await createFastStreamingRenderer(viewer, params);
  const inputController = createFastStreamingInputController(scene, view, renderer);

  return {
    scene,
    viewer,
    view,
    renderer,
    inputController,
    cameraFlight: new CameraFlightAnimation(view, {duration: 0.9})
  };
}

export async function createFastStreamingRenderer(viewer, params = {}) {
  const rendererName = getRequestedRenderer(params.renderer);
  const renderer = rendererName === "webgl"
    ? createFastStreamingWebGLRenderer(viewer)
    : await createDefaultFastStreamingWebGPURenderer(viewer, params);
  if (params.grid !== false) {
    must(renderer.setInfiniteGridEnabled(true));
  }
  renderer.events.onError.subscribe((_renderer, error) => {
    console.error(error.error);
  });
  return renderer;
}

async function createDefaultFastStreamingWebGPURenderer(viewer, params) {
  try {
    return await createFastStreamingWebGPURenderer(viewer);
  } catch (error) {
    if (isRendererExplicit(params.renderer)) {
      throw error;
    }
    console.warn(`[xeokit example] WebGPU unavailable, falling back to WebGL: ${error instanceof Error ? error.message : String(error)}`);
    return createFastStreamingWebGLRenderer(viewer);
  }
}

async function createFastStreamingWebGPURenderer(viewer) {
  const rendererResult = await WebGPURenderer.create({
    viewer,
    logging: false,
    deviceDescriptor: FAST_STREAMING_WEBGPU_CONFIG.deviceDescriptor,
    memoryConfigs: FAST_STREAMING_WEBGPU_CONFIG.memoryConfigs,
    renderConfigs: FAST_STREAMING_WEBGPU_CONFIG.renderConfigs
  });
  if (!rendererResult.ok) {
    throw new Error(rendererResult.error);
  }
  return rendererResult.value;
}

function createFastStreamingWebGLRenderer(viewer) {
  return new WebGLRenderer({viewer, logging: false});
}

function isRendererExplicit(fallback) {
  if (fallback) {
    return true;
  }
  return new URLSearchParams(window.location.search).has("renderer");
}

export function createFastStreamingInputController(scene, view, renderer, params = {}) {
  const pickStrategy = new RoutingPickStrategy(scene, renderer);
  return new ModelNavigationController(view, {
    pick: (_view, pickParams) => pickForModelNavigation(view, pickStrategy, pickParams),
    followPointer: params.followPointer !== false,
    rotationInertia: 0,
    panInertia: 0,
    dollyInertia: 0,
    doublePickFlyTo: false,
    keyboardDollyRate: 80,
    keyboardPanRate: 50,
    mouseWheelDollyRate: 420,
    touchDollyRate: 0.22,
    ...(params.navigationParams || {})
  });
}

export function configureFastStreamingLighting(view) {
  if (view.lights?.ibl) {
    view.lights.ibl.enabled = false;
    view.lights.ibl.intensity = 0;
  }
  if (view.lights?.hemispheric) {
    view.lights.hemispheric.enabled = false;
    view.lights.hemispheric.intensity = 0;
  }
  view.clearLights();
  new AmbientLight(view, {
    color: [1, 1, 1],
    intensity: 0.28
  });
  new DirLight(view, {
    dir: [-0.8, -1.0, -0.5],
    color: [1, 1, 1],
    intensity: 0.82,
    space: "world"
  });
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
  if (result.snap) {
    navPickResult.snappedToVertex = result.snap.type === "vertex";
    navPickResult.snappedToEdge = result.snap.type === "edge";
    navPickResult.snappedCanvasPos = result.snap.canvasPos;
  }
  return {ok: true, value: navPickResult};
}

function resolveViewElement(params) {
  if (params.htmlElement) {
    return params.htmlElement;
  }
  if (params.canvas) {
    return params.canvas;
  }
  if (params.elementId) {
    const element = document.getElementById(params.elementId);
    if (element) {
      return element;
    }
    throw new Error(`[createFastStreamingViewer] Missing view element '${params.elementId}'.`);
  }
  throw new Error("[createFastStreamingViewer] Must provide canvas, htmlElement, or elementId.");
}

function must(result) {
  if (!result || result.ok === false) {
    throw new Error(result?.error || "Operation failed");
  }
  return result.value;
}
