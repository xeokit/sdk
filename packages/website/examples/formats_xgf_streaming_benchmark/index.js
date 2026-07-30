import * as xeokit from "../../js/xeokit-studio-bundle.js";

const INDEX_URL = "./chunks/index.runtime.json";
const AUTO_BATCH_SIZE = 8;
const FETCH_CONCURRENCY = 8;
const CAMERA_DEBOUNCE_MS = 120;
const CACHE_XGF_FILE_BYTES = true;
const MAX_CACHED_XGF_FILE_BYTES = 128 * 1024 * 1024;
const ENABLE_LRU_CHUNK_EVICTION = false;
const STREAM_CURRENT_FRUSTUM_ONLY = false;
const UNLOAD_INVISIBLE_ON_CAMERA_MOVE = false;
const CHUNK_PRIORITY_TARGET = "look";

const studio = new xeokit.studio.Studio({});

studio.init().then(async () => {
  const {scene} = studio;

  // The controller prioritizes chunks in the current view first, but with
  // frustumOnly disabled it continues loading the whole chunk set.
  const view = studio.viewManager.createView({
    id: "demoView",
    adaptiveQuality: false,
    camera: {
      eye: [115, -135, 92],
      look: [0, 0, 8],
      up: [0, 0, 1]
    }
  });

  const ui = {
    status: document.getElementById("benchmarkStatus"),
    chunkList: document.getElementById("chunkList"),
    loadedChunks: document.getElementById("loadedChunks"),
    objectCount: document.getElementById("objectCount"),
    meshCount: document.getElementById("meshCount"),
    queueStatus: document.getElementById("queueStatus"),
    budget: document.getElementById("budget"),
    signalStreamingStarted: createStreamingStartedHandler(studio)
  };

  try {
    // The compact runtime index contains scheduling and dependency metadata.
    // The full chunks/index.json remains available for debugging/tooling.
    const index = await fetchStreamingIndex(INDEX_URL);
    const sceneModel = must(scene.createModel({id: "streaming-benchmark-city", updateHint: "dynamic"}));
    const loader = new xeokit.formats.xgfstream.XGFStreamingLoader();
    let streamController;

    streamController = new xeokit.formats.xgfstream.XGFViewStreamController({
      index,
      loader,
      sceneModel,
      view,
      batchSize: AUTO_BATCH_SIZE,
      fetchConcurrency: FETCH_CONCURRENCY,
      cameraDebounceMs: CAMERA_DEBOUNCE_MS,
      frustumOnly: STREAM_CURRENT_FRUSTUM_ONLY,
      chunkPriorityTarget: CHUNK_PRIORITY_TARGET,
      enableLRUEviction: ENABLE_LRU_CHUNK_EVICTION,
      cacheFileData: CACHE_XGF_FILE_BYTES,
      maxCachedFileBytes: MAX_CACHED_XGF_FILE_BYTES,
      onStatus: (status) => {
        ui.status.textContent = status;
      },
      onProgress: (progress) => {
        scheduleRender(ui, streamController);
        ui.signalStreamingStarted(progress);
      },
      onError: (error) => {
        ui.status.textContent = `Streaming error: ${error.message || error}`;
        console.error(error);
      }
    });

    bindCameraStreaming(studio, view, streamController);
    streamController.prefetchInitial(AUTO_BATCH_SIZE * 2);
    streamController.schedule("Priority stream");
    render(ui, streamController);
  } catch (error) {
    ui.status.textContent = `Failed to initialize XGF streaming benchmark: ${error.message || error}`;
    console.error(error);
  }
});

async function fetchStreamingIndex(url) {
  const runtimeIndex = await fetchJSON(url);
  const result = xeokit.formats.xgfstream.readXGFStreamingRuntimeIndex(runtimeIndex);
  if (!result.ok) {
    throw new Error(result.error);
  }
  return result.value;
}

function scheduleRender(ui, streamController) {
  if (scheduleRender.pending) {
    return;
  }
  scheduleRender.pending = true;
  window.requestAnimationFrame(() => {
    scheduleRender.pending = false;
    render(ui, streamController);
  });
}

function render(ui, streamController) {
  const progress = streamController.queueProgress;
  ui.loadedChunks.textContent = `${streamController.loadedChunkIds.size}/${streamController.chunkManifests.length}`;
  ui.objectCount.textContent = formatInt(streamController.loadedTotals.objects);
  ui.meshCount.textContent = formatInt(streamController.loadedTotals.meshes);
  ui.queueStatus.textContent = `${progress.loaded}/${progress.queued} queued chunk(s) loaded`;
  ui.budget.textContent = `${streamController.chunkManifests.length} total chunks`;
  ui.chunkList.replaceChildren(...streamController.prioritizeChunks().slice(0, 40).map((manifest) => {
    const loaded = streamController.loadedChunkIds.has(manifest.id);
    const loading = streamController.loadingChunkIds.has(manifest.id);
    const item = document.createElement("article");
    item.className = "chunk";
    item.innerHTML = `
      <div>
        <strong>${manifest.id}</strong>
        <small>${manifest.counts.objects} objects, ${manifest.counts.meshes} meshes</small>
      </div>
      <span class="state ${loaded ? "loaded" : ""}">${loaded ? "loaded" : loading ? "loading" : "queued"}</span>
    `;
    return item;
  }));
}

scheduleRender.pending = false;

function bindCameraStreaming(studio, view, streamController) {
  let timer;
  const onCamera = (camera) => {
    if (camera !== view.camera) {
      return;
    }
    if (timer !== undefined) {
      clearTimeout(timer);
    }
    timer = setTimeout(() => {
      timer = undefined;
      if (UNLOAD_INVISIBLE_ON_CAMERA_MOVE) {
        streamController.unloadInvisibleChunks();
      }
      streamController.schedule("Priority stream");
    }, CAMERA_DEBOUNCE_MS);
  };
  studio.viewer.events.onCameraViewMatrixUpdated.subscribe(onCamera);
  studio.viewer.events.onCameraProjMatrixUpdated.subscribe(onCamera);
}

async function fetchJSON(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} fetching ${url}`);
  }
  return response.json();
}

function formatInt(value) {
  return new Intl.NumberFormat().format(value);
}

function must(result) {
  if (!result.ok) {
    throw new Error(result.error);
  }
  return result.value;
}

function createStreamingStartedHandler(studio) {
  let signaled = false;
  return (progress) => {
    if (signaled || !progress || progress.loaded <= 0) {
      return;
    }
    signaled = true;
    signalBenchmarkReady();
    studio.finished();
  };
}

function signalBenchmarkReady() {
  if (document.getElementById("ExampleLoaded")) {
    return;
  }
  const exampleMarker = document.createElement("div");
  exampleMarker.id = "ExampleLoaded";
  exampleMarker.hidden = true;
  document.body.appendChild(exampleMarker);

  const marker = document.createElement("div");
  marker.id = "XGFStreamingBenchmarkReady";
  marker.hidden = true;
  document.body.appendChild(marker);
}
