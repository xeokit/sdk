import * as xeokit from "../../js/xeokit-studio-bundle.js";

const INDEX_URL = "../../models/HousePlan/xgfstream/index.runtime.json";
const MODEL_ID = "HousePlan";
const AUTO_BATCH_SIZE = 8;
const FETCH_CONCURRENCY = 8;
const CHUNK_COMMIT_FRAME_BUDGET_MS = 0;
const CAMERA_DEBOUNCE_MS = 140;

const INITIAL_CAMERA = {
  eye: [1396.192488512606, -228.91295922593062, 7.605782942380627],
  look: [1389.9821022363608, -234.97883380249922, 1.9956860109231078],
  up: [-0.3882818817391334, -0.3792467944611508, 0.8398863311210985],
  fov: 55
};

const studio = new xeokit.studio.Studio({});

studio.init().then(async () => {
  const {scene} = studio;
  const ui = {
    loadedChunks: document.getElementById("loadedChunks"),
    objectCount: document.getElementById("objectCount"),
    meshCount: document.getElementById("meshCount"),
    chunkProgress: document.getElementById("chunkProgress"),
    status: document.getElementById("status")
  };

  const view = studio.viewManager.createView({
    id: "demoView",
    adaptiveQuality: false,
    backgroundColor: [0.93, 0.95, 0.96],
    camera: {
      perspectiveProjection: {fov: INITIAL_CAMERA.fov},
      eye: INITIAL_CAMERA.eye,
      look: INITIAL_CAMERA.look,
      up: INITIAL_CAMERA.up
    }
  });

  try {
    setStatus(ui, "Loading stream index");
    const index = await fetchStreamingIndex(INDEX_URL);
    const sceneModel = must(scene.createModel({
      id: MODEL_ID,
      updateHint: "dynamic",
      coordinateSystem: index.coordinateSystem
    }));
    const loader = new xeokit.formats.xgfstream.XGFStreamingLoader();
    let renderScheduled = false;
    let streamController;
    const scheduleRender = () => {
      if (renderScheduled || !streamController) {
        return;
      }
      renderScheduled = true;
      window.requestAnimationFrame(() => {
        renderScheduled = false;
        render(ui, streamController);
      });
    };

    streamController = new xeokit.formats.xgfstream.XGFViewStreamController({
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
    bindCameraStreaming(studio, streamController);
    studio.finished();
  } catch (error) {
    console.error(error);
    setStatus(ui, String(error?.message || error));
  }
});

async function fetchStreamingIndex(url) {
  const runtimeIndex = await fetchJSON(url);
  const result = xeokit.formats.xgfstream.readXGFStreamingRuntimeIndex(runtimeIndex);
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
  }
}

function bindCameraStreaming(studio, streamController) {
  const onCamera = () => streamController.schedule("Camera changed");
  studio.viewer.events.onCameraViewMatrixUpdated.subscribe(onCamera);
  studio.viewer.events.onCameraProjMatrixUpdated.subscribe(onCamera);
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
