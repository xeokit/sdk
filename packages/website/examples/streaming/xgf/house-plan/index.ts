import {XGFStreamingLoader, XGFViewStreamController, readXGFStreamingRuntimeIndex} from "@xeokit/sdk/formats/xgfstream";
import {Scene} from "@xeokit/sdk/model/scene";
import {encodeRadianceHDR, paintStudioHDR} from "@xeokit/sdk/model/generation/paintEnvironments";
import {ModelNavigationController} from "@xeokit/sdk/viewing/navigation/model";
import {WebGPURenderer} from "@xeokit/sdk/viewing/renderers/webGPU";
import {AmbientLight, DirLight, Viewer} from "@xeokit/sdk/viewing/viewer";

const INDEX_URL = "../../../../models/HousePlan/xgfstream/index.runtime.json";
const MODEL_ID = "HousePlan";
const AUTO_BATCH_SIZE = 8;
const FETCH_CONCURRENCY = 8;
const CHUNK_COMMIT_FRAME_BUDGET_MS = 0;
const CAMERA_DEBOUNCE_MS = 140;
const SUN_DIRECTION = [-0.46, -0.54, -0.70];

const INITIAL_CAMERA = {
  eye: [1396.192488512606, -228.91295922593062, 7.605782942380627],
  look: [1389.9821022363608, -234.97883380249922, 1.9956860109231078],
  up: [-0.3882818817391334, -0.3792467944611508, 0.8398863311210985],
  fov: 55
};

main().catch((error) => {
  console.error(error);
  const status = document.getElementById("status");
  if (status) {
    status.textContent = String(error?.message || error);
  }
});

async function main() {
  const ui = {
    loadedChunks: document.getElementById("loadedChunks"),
    objectCount: document.getElementById("objectCount"),
    meshCount: document.getElementById("meshCount"),
    chunkProgress: document.getElementById("chunkProgress"),
    status: document.getElementById("status")
  };

  const scene = new Scene({logging: false});
  const viewer = new Viewer({scene, logging: false});
  const view = must(viewer.createView({
    id: "demoView",
    htmlElement: document.getElementById("demoCanvas"),
    adaptiveQuality: true,
    backgroundColor: [0.96, 0.955, 0.94],
    resolutionScale: {
      enabled: true,
      resolutionScale: 1
    },
    effects: {
      sao: {
        enabled: true,
        intensity: 0.11,
        scale: 0.85,
        radius: 14,
        bias: 0.04,
        blur: true
      },
      ibl: {
        enabled: true,
        intensity: 1.0
      },
      edges: {
        enabled: false
      },
      shadows: {
        enabled: true,
        intensity: 0.44,
        bias: 0.001,
        normalOffsetBias: 0.01,
        slopeBias: 0.0008,
        resolution: 2048,
        direction: SUN_DIRECTION,
        autoFit: true,
        projectionSize: 180,
        lightDistance: 420,
        maxDistance: 320,
        padding: 1.25,
        pcfKernelSize: 2,
        cascadeCount: 4,
        cascadeSplitLambda: 0.55
      },
      atmosphere: {
        enabled: false
      },
      bloom: {
        enabled: false
      },
      depthOfField: {
        enabled: false
      },
      colorGrading: {
        enabled: true,
        brightness: 0.0,
        contrast: 1.04,
        saturation: 1.04,
        gamma: 0.98,
        temperature: 0.06,
        tint: 0.04
      },
      tonemap: {
        enabled: true,
        mode: "aces",
        exposure: 0.95,
        sRGBEncode: true
      },
      antiAliasing: {
        enabled: true
      },
      sky: {
        enabled: false
      }
    },
    camera: {
      perspectiveProjection: {fov: INITIAL_CAMERA.fov},
      eye: INITIAL_CAMERA.eye,
      look: INITIAL_CAMERA.look,
      up: INITIAL_CAMERA.up
    }
  }));
  view.clearLights();
  new AmbientLight(view, {
    color: [1, 1, 1],
    intensity: 0.34
  });
  new DirLight(view, {
    dir: SUN_DIRECTION,
    color: [1.0, 0.96, 0.88],
    intensity: 1.18,
    space: "world"
  });
  installStudioIBL(view);
  new ModelNavigationController(view, {
    followPointer: false,
    doublePickFlyTo: false
  });
  const rendererResult = await WebGPURenderer.create({
    viewer,
    logging: false,
    renderConfigs: {
      triangleColorMode: "auto",
      edges: false,
      depthPrepass: true,
      renderBundleCaching: true
    }
  });
  if (!rendererResult.ok) {
    throw new Error(rendererResult.error);
  }
  const renderer = rendererResult.value;
  must(renderer.setInfiniteGridEnabled(true));
  renderer.events.onError.subscribe((_renderer, error) => {
    console.error(error.error);
  });

  try {
    setStatus(ui, "Loading stream index");
    const index = await fetchStreamingIndex(INDEX_URL);
    const sceneModel = must(scene.createModel({
      id: MODEL_ID,
      updateHint: "dynamic",
      coordinateSystem: index.coordinateSystem
    }));
    const loader = new XGFStreamingLoader();
    let renderScheduled = false;
    let streamController;
    let readySignaled = false;
    const scheduleRender = () => {
      if (renderScheduled || !streamController) {
        return;
      }
      renderScheduled = true;
      window.requestAnimationFrame(() => {
        renderScheduled = false;
        const loaded = render(ui, streamController);
        if (loaded && !readySignaled) {
          readySignaled = true;
          window.requestAnimationFrame(() => window.requestAnimationFrame(signalReady));
        }
      });
    };

    streamController = new XGFViewStreamController({
      index,
      loader,
      sceneModel,
      view,
      batchSize: AUTO_BATCH_SIZE,
      fetchConcurrency: FETCH_CONCURRENCY,
      commitFrameBudgetMs: CHUNK_COMMIT_FRAME_BUDGET_MS,
      cameraDebounceMs: CAMERA_DEBOUNCE_MS,
      frustumOnly: false,
      onStatus: (status) => setStatus(ui, status),
      onProgress: () => scheduleRender(),
      onError: (error) => {
        console.error(error);
        setStatus(ui, String(error?.message || error));
        scheduleRender();
      }
    });

    render(ui, streamController);
    streamController.schedule("Load HousePlan stream");
    bindCameraStreaming(viewer, streamController);
  } catch (error) {
    console.error(error);
    setStatus(ui, String(error?.message || error));
  }
}

async function fetchStreamingIndex(url) {
  const runtimeIndex = await fetchJSON(url);
  const result = readXGFStreamingRuntimeIndex(runtimeIndex);
  if (!result.ok) {
    throw new Error(result.error);
  }
  return resolveIndexRelativeChunkUris(result.value, url);
}

async function fetchJSON(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }
  return response.json();
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

function render(ui, streamController) {
  const loaded = streamController.loadedChunkIds.size;
  const total = streamController.chunkManifests.length;
  ui.loadedChunks.textContent = `${loaded}/${total}`;
  ui.objectCount.textContent = streamController.loadedTotals.objects.toLocaleString();
  ui.meshCount.textContent = streamController.loadedTotals.meshes.toLocaleString();
  ui.chunkProgress.max = Math.max(total, 1);
  ui.chunkProgress.value = loaded;
  if (total > 0 && loaded >= total) {
    setStatus(ui, "Loaded");
    return true;
  }
  return false;
}

function bindCameraStreaming(viewer, streamController) {
  const onCamera = () => streamController.schedule("Camera changed");
  viewer.events.onCameraViewMatrixUpdated.subscribe(onCamera);
  viewer.events.onCameraProjMatrixUpdated.subscribe(onCamera);
}

function setStatus(ui, status) {
  ui.status.textContent = status;
}

function must(result) {
  if (!result || result.ok === false) {
    throw new Error(result?.error || "Unexpected SDK failure");
  }
  return result.value;
}

function installStudioIBL(view) {
  if (!view.lights?.ibl) {
    return;
  }
  const hdrPixels = paintStudioHDR(1024, 512);
  const hdrBuffer = encodeRadianceHDR(hdrPixels, 1024, 512);
  const result = view.lights.ibl.setEnvironmentHDRBuffer(hdrBuffer);
  if (!result.ok) {
    console.warn("[streaming/xgf/house-plan] IBL setup failed:", result.error);
    view.lights.ibl.enabled = false;
    view.lights.ibl.intensity = 0;
  }
}

function signalReady() {
  document.body.classList.add("xeokit-loading-spinner-ready");
  if (document.getElementById("ExampleLoaded")) {
    return;
  }
  const marker = document.createElement("div");
  marker.id = "ExampleLoaded";
  marker.hidden = true;
  document.body.appendChild(marker);
}
