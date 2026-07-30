import * as xeokit from "../../js/xeokit-studio-bundle.js";

const INDEX_URL = "../../models/BakuStadium_xgfstream_2000/xgfstream/index.runtime.json";
const {
  NavigationRender
} = xeokit.base.constants;

const params = new URLSearchParams(location.search);
const INITIAL_MODE = normalizeStorageMode(params.get("mode")) || "dtx";
const AUTO_BATCH_SIZE = clampInteger(params.get("batchSize"), 96, 1, 512);
const FETCH_CONCURRENCY = clampInteger(params.get("fetchConcurrency"), 24, 1, 96);
const PREFETCH_CHUNKS = clampInteger(params.get("prefetch"), AUTO_BATCH_SIZE * 4, 0, 2048);
const MODEL_UPDATE_HINT = INITIAL_MODE === "vbo" ? "static" : "dynamic";
const CACHE_XGF_FILE_BYTES = true;
const MAX_CACHED_XGF_FILE_BYTES = 512 * 1024 * 1024;
const CHUNK_LIST_LIMIT = 28;

const ui = {
  buttons: Array.from(document.querySelectorAll("[data-mode]")),
  loadedChunks: document.getElementById("loadedChunks"),
  objectCount: document.getElementById("objectCount"),
  meshCount: document.getElementById("meshCount"),
  handledPrims: document.getElementById("handledPrims"),
  fallbackPrims: document.getElementById("fallbackPrims"),
  rebuilds: document.getElementById("rebuilds"),
  activePath: document.getElementById("activePath"),
  warmPrims: document.getElementById("warmPrims"),
  elapsed: document.getElementById("elapsed"),
  queue: document.getElementById("queue"),
  assetChunks: document.getElementById("assetChunks"),
  status: document.getElementById("status"),
  chunkList: document.getElementById("chunkList")
};

const startedAt = performance.now();
const studio = new xeokit.studio.Studio({
  maxViews: 1
});
window.studio = studio;

let streamController = null;
let statsSampler = null;
let lastVBOStats = null;

studio.init().then(async () => {
  const {scene} = studio;
  const view = studio.viewManager.createView({
    id: "bakuRenderPathView",
    adaptiveQuality: false,
    backgroundColor: [0.62, 0.74, 0.82],
    renderMode: NavigationRender,
    effects: {
      edges: {renderModes: []},
      sao: {renderModes: []},
      shadows: {renderModes: []},
      tonemap: {renderModes: []},
      antiAliasing: {renderModes: []}
    },
    camera: {
      eye: [-158.0, -42.0, 74.0],
      look: [-128.05097674666933, -12.118816326439152, 52.119495073629665],
      up: [0.28, 0.16, 0.95],
      perspectiveProjection: {fov: 48}
    }
  });

  view.renderMode = NavigationRender;
  view.effects.sao.renderModes = [];
  view.effects.shadows.renderModes = [];
  view.effects.edges.renderModes = [];
  view.effects.tonemap.renderModes = [];
  view.effects.antiAliasing.renderModes = [];
  view.effects.bloom.renderModes = [];
  view.effects.atmosphere.renderModes = [];

  bindModeControls(view);
  statsSampler = startRenderStatsSampler(studio, view);
  updateModeUI();
  setStatus("Fetching Baku stream index...");

  const index = await fetchStreamingIndex(INDEX_URL);
  const sceneModel = must(scene.createModel({
    id: "BakuStadiumRenderPaths",
    updateHint: MODEL_UPDATE_HINT
  }));
  const loader = new xeokit.formats.xgfstream.XGFStreamingLoader();

  streamController = new xeokit.formats.xgfstream.XGFViewStreamController({
    index,
    loader,
    sceneModel,
    view,
    batchSize: AUTO_BATCH_SIZE,
    fetchConcurrency: FETCH_CONCURRENCY,
    commitFrameBudgetMs: 0,
    cameraDebounceMs: 0,
    frustumOnly: false,
    chunkPriorityTarget: "look",
    enableLRUEviction: false,
    cacheFileData: CACHE_XGF_FILE_BYTES,
    maxCachedFileBytes: MAX_CACHED_XGF_FILE_BYTES,
    onStatus: (status) => {
      setStatus(status);
    },
    onProgress: () => {
      scheduleRender(view);
      scheduleUIRender();
      signalReadyAfterFirstChunk();
      signalCompleteAfterFullStream();
    },
    onError: (error) => {
      setStatus(`Streaming error: ${error.message || error}`);
      console.error(error);
    }
  });

  bindCameraPriorityRefresh(studio, view);
  streamController.prefetchInitial(Math.min(PREFETCH_CHUNKS, streamController.chunkManifests.length));
  streamController.schedule("Full Baku stream");
  scheduleUIRender();
  statsSampler.sample();

  window.bakuRenderPathsExample = {
    studio,
    view,
    streamController,
    setMode: (mode) => {
      if (!activateStorageMode(normalizeStorageMode(mode) || "dtx", true)) {
        return;
      }
      view.needsRender();
      statsSampler.sample();
      scheduleUIRender();
    },
    getMode: getStorageMode,
    sample: () => statsSampler.sample(),
    getStats: () => lastVBOStats,
  };
  window.otcRenderPathsExample = window.bakuRenderPathsExample;
}).catch((error) => {
  setStatus(`Failed to initialize: ${error.message || error}`);
  console.error(error);
});

function bindModeControls(view) {
  for (const button of ui.buttons) {
    button.addEventListener("click", () => {
      const mode = normalizeStorageMode(button.dataset.mode) || "dtx";
      if (!activateStorageMode(mode, true)) {
        return;
      }
      updateModeUI();
      view.needsRender();
      statsSampler?.sample();
      scheduleUIRender();
    });
  }
}

function bindCameraPriorityRefresh(studio, view) {
  let scheduled = false;
  const onCamera = (camera) => {
    if (camera !== view.camera || !streamController || scheduled) {
      return;
    }
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      streamController.schedule("Full Baku stream");
    });
  };
  studio.viewer.events.onCameraViewMatrixUpdated.subscribe(onCamera);
  studio.viewer.events.onCameraProjMatrixUpdated.subscribe(onCamera);
}

function startRenderStatsSampler(studio, view) {
  const inspectorResult = studio.renderer.getRenderInspector();
  if (inspectorResult.ok === false) {
    console.warn(inspectorResult.error);
    return {sample: async () => null};
  }
  const inspector = inspectorResult.value;
  let sampling = false;
  const sample = async () => {
    if (sampling) {
      return lastVBOStats;
    }
    sampling = true;
    try {
      view.needsRender();
      const [frame] = await inspector.captureFrames(1);
      lastVBOStats = getFrameVBOStats(frame);
      updateStatsUI(lastVBOStats);
      return lastVBOStats;
    } catch (error) {
      console.warn("[formats_xgf_streaming_baku_renderPaths] render stats capture failed", error);
      return null;
    } finally {
      sampling = false;
    }
  };
  window.setInterval(sample, 1000);
  return {sample};
}

function getFrameVBOStats(frame) {
  const geometry = frame?.vboGeometryTriangles;
  if (!geometry) {
    return null;
  }
  return {
    handledBatches: geometry.handledBatches || 0,
    fallbackBatches: geometry.fallbackBatches || 0,
    blockedBatches: geometry.blockedBatches || 0,
    handledPrims: geometry.handledPrims || 0,
    fallbackPrims: geometry.fallbackPrims || 0,
    blockedPrims: geometry.blockedPrims || 0
  };
}

async function fetchStreamingIndex(url) {
  const runtimeIndex = await fetchJSON(url);
  const result = xeokit.formats.xgfstream.readXGFStreamingRuntimeIndex(runtimeIndex);
  if (!result.ok) {
    throw new Error(result.error);
  }
  return resolveIndexRelativeChunkUris(result.value, url);
}

function resolveIndexRelativeChunkUris(index, indexUrl) {
  const baseUrl = new URL(".", new URL(indexUrl, window.location.href)).href;
  return {
    ...index,
    chunks: index.chunks.map((manifest) => ({
      ...manifest,
      uri: resolveUri(manifest.uri, baseUrl),
      dependencies: {
        ...manifest.dependencies,
        chunks: (manifest.dependencies?.chunks || []).map((dependency) => ({
          ...dependency,
          uri: resolveUri(dependency.uri, baseUrl)
        }))
      }
    }))
  };
}

function resolveUri(uri, baseUrl) {
  if (!uri || /^[a-z][a-z0-9+.-]*:/i.test(uri)) {
    return uri;
  }
  return new URL(uri, baseUrl).href;
}

async function fetchJSON(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} fetching ${url}`);
  }
  return response.json();
}

function activateStorageMode(mode, updateUrl) {
  const storageMode = normalizeStorageMode(mode) || "dtx";
  if (storageMode !== INITIAL_MODE) {
    const url = new URL(location.href);
    url.searchParams.set("mode", storageMode);
    location.assign(url);
    return false;
  }
  if (updateUrl) {
    const url = new URL(location.href);
    url.searchParams.set("mode", storageMode);
    history.replaceState(null, "", url);
  }
  updateModeUI();
  return true;
}

function getStorageMode() {
  return INITIAL_MODE;
}

function normalizeStorageMode(mode) {
  if (mode === "dtx" || mode === "dtx-only") {
    return "dtx";
  }
  if (mode === "vbo" || mode === "vbo-only" || mode === "baked") {
    return "vbo";
  }
  return null;
}

function updateModeUI() {
  const mode = getStorageMode();
  for (const button of ui.buttons) {
    button.classList.toggle("active", normalizeStorageMode(button.dataset.mode) === mode);
  }
  if (ui.activePath) {
    ui.activePath.textContent = labelForMode(mode);
  }
}

function updateStatsUI(stats) {
  const handledPrims = stats?.handledPrims || 0;
  const fallbackPrims = stats?.fallbackPrims || 0;
  const blockedPrims = stats?.blockedPrims || 0;
  ui.handledPrims.textContent = formatCompactInt(handledPrims);
  ui.fallbackPrims.textContent = formatCompactInt(fallbackPrims + blockedPrims);
  ui.rebuilds.textContent = formatCompactInt(stats?.blockedBatches || 0);
  ui.warmPrims.textContent = formatCompactInt(stats?.handledBatches || 0);
}

function scheduleUIRender() {
  if (scheduleUIRender.pending) {
    return;
  }
  scheduleUIRender.pending = true;
  requestAnimationFrame(() => {
    scheduleUIRender.pending = false;
    renderUI();
  });
}
scheduleUIRender.pending = false;

function scheduleRender(view) {
  if (scheduleRender.pending) {
    return;
  }
  scheduleRender.pending = true;
  requestAnimationFrame(() => {
    scheduleRender.pending = false;
    view.needsRender();
  });
}
scheduleRender.pending = false;

function renderUI() {
  if (!streamController) {
    return;
  }
  const totalChunks = streamController.chunkManifests.length;
  const loadedChunks = streamController.loadedChunkIds.size;
  const progress = streamController.queueProgress;
  ui.loadedChunks.textContent = `${formatInt(loadedChunks)}/${formatInt(totalChunks)}`;
  ui.objectCount.textContent = formatCompactInt(streamController.loadedTotals.objects);
  ui.meshCount.textContent = formatCompactInt(streamController.loadedTotals.meshes);
  ui.queue.textContent = `${formatInt(progress.loaded)}/${formatInt(progress.queued)}`;
  ui.assetChunks.textContent = formatInt(streamController.loadedAssetLibraryIds.size);
  ui.elapsed.textContent = `${((performance.now() - startedAt) / 1000).toFixed(1)}s`;
  updateModeUI();
  renderChunkList();
}

function renderChunkList() {
  const manifests = streamController.prioritizeChunks().slice(0, CHUNK_LIST_LIMIT);
  ui.chunkList.replaceChildren(...manifests.map((manifest) => {
    const loaded = streamController.loadedChunkIds.has(manifest.id);
    const loading = streamController.loadingChunkIds.has(manifest.id);
    const item = document.createElement("article");
    item.className = "chunk";
    const label = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = manifest.id;
    const meta = document.createElement("small");
    meta.textContent = `${formatInt(manifest.counts?.objects || 0)} objects, ${formatInt(manifest.counts?.meshes || 0)} meshes`;
    label.append(title, meta);
    const state = document.createElement("span");
    state.className = `state ${loaded ? "loaded" : loading ? "loading" : ""}`;
    state.textContent = loaded ? "loaded" : loading ? "loading" : "queued";
    item.append(label, state);
    return item;
  }));
}

function setStatus(status) {
  ui.status.textContent = status;
}

function signalReadyAfterFirstChunk() {
  if (document.getElementById("ExampleLoaded") || !streamController || streamController.loadedChunkIds.size <= 0) {
    return;
  }
  appendHiddenMarker("ExampleLoaded");
  appendHiddenMarker("BakuRenderPathsReady");
  appendHiddenMarker("OTCRenderPathsReady");
  studio.finished();
}

function signalCompleteAfterFullStream() {
  if (
    document.getElementById("BakuRenderPathsComplete") ||
    !streamController ||
    streamController.loadedChunkIds.size < streamController.chunkManifests.length
  ) {
    return;
  }
  appendHiddenMarker("BakuRenderPathsComplete");
  appendHiddenMarker("OTCRenderPathsComplete");
}

function appendHiddenMarker(id) {
  const marker = document.createElement("div");
  marker.id = id;
  marker.hidden = true;
  document.body.appendChild(marker);
}

function labelForMode(mode) {
  return mode === "vbo" ? "VBO (static)" : "DTX (dynamic)";
}

function formatInt(value) {
  return new Intl.NumberFormat().format(value || 0);
}

function formatCompactInt(value) {
  return new Intl.NumberFormat(undefined, {
    notation: "compact",
    maximumFractionDigits: 1
  }).format(value || 0);
}

function clampInteger(value, fallback, min, max) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, parsed));
}

function clampNumber(value, fallback, min, max) {
  const parsed = typeof value === "number" ? value : Number.parseFloat(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, parsed));
}

function must(result) {
  if (!result.ok) {
    throw new Error(result.error);
  }
  return result.value;
}
