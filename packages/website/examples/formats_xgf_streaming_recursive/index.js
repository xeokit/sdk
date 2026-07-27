import * as xeokit from "../../js/xeokit-studio-bundle.js";

const {sdkProgress} = xeokit.base.core;

const INDEX_URL = "../../models/RecursiveStream/xgfstream/index.runtime.json";
const AUTO_BATCH_SIZE = 8;
const FETCH_CONCURRENCY = 8;
const CHUNK_COMMIT_FRAME_BUDGET_MS = 0;
const CAMERA_DEBOUNCE_MS = 140;
const ENABLE_LRU_CHUNK_EVICTION = false;
const MAX_RESIDENT_REFERENCE_CHUNKS = 900;
const CACHE_XGF_FILE_BYTES = true;
const MAX_CACHED_XGF_FILE_BYTES = 256 * 1024 * 1024;
const FAR_CLIP = 10000000;
const ROOT_COORDINATE_SYSTEM = {
  basis: [1, 0, 0, 0, 0, 1, 0, 1, 0],
  origin: [0, 0, 0],
  units: "meters",
  scaleToMeters: 1
};

const VIEWPOINTS = [
  {
    id: "RECURSIVE-MAP",
    title: "MAP",
    location: "Apartment model",
    streamId: "map",
    frame: "map-close",
    eye: [1841983.9793816847, 5173218.058046154, 31.505221592627464],
    look: [1842021.9793816847, 5173302.058046154, -10.494778407372538],
    up: [0, 0, 1],
    fov: 50
  },
  {
    id: "RECURSIVE-BAKU",
    title: "Baku Stadium",
    location: "Inside roof truss bay",
    streamId: "bakuStadium",
    frame: "baku-truss",
    eye: [-10.013358641817196, -17.09653564573386, 38.18532582659813],
    look: [0, -4.009059817478885, 31.981220564890783],
    up: [-0.09, 0.03, 0.996],
    fov: 30
  },
  {
    id: "RECURSIVE-LYON",
    title: "Lyon",
    location: "Street-scale inspection",
    streamId: "lyon",
    frame: "lyon-close",
    eye: [-1827450, -900, 5175100],
    look: [-1827894.3125, -229.10794067382812, 5174767.775161743],
    up: [0, 0, 1],
    fov: 35
  },
  {
    id: "RECURSIVE-OTC",
    title: "OTC Conference Center",
    location: "Atrium overview",
    streamId: "otcConferenceCenter",
    frame: "oblique",
    eye: [49.10087301025389, -1229.4820915561136, 220],
    look: [49.10087301025389, -1229.4820915561136, 9.234829595688334],
    up: [0, 1, 0],
    fov: 35
  },
  {
    id: "RECURSIVE-HOUSEPLAN",
    title: "HousePlan",
    location: "Plan overview",
    streamId: "housePlan",
    frame: "house-room",
    eye: [1384.7661437988281, 960.450080871582, 85],
    look: [1384.7661437988281, 960.450080871582, 0.5749999881158104],
    up: [0, 1, 0],
    fov: 28
  }
];

const INITIAL_VIEWPOINT = VIEWPOINTS[0];
const ALL_RENDER_MODES = [
  xeokit.base.constants.NavigationRender,
  xeokit.base.constants.DetailedRender,
  xeokit.base.constants.RealisticRender
];
let startupSpinnerDismissed = false;

sdkProgress.setPhase("Loading...");

const studio = new xeokit.studio.Studio({});
const viewpointCards = createViewpointCards(document.getElementById("viewpointCards"), VIEWPOINTS);
const viewpointProgress = createViewpointProgress(viewpointCards);
let activeViewpointId = INITIAL_VIEWPOINT.id;

studio.init().then(async () => {
  const {scene} = studio;
  const ui = {
    loadedChunks: document.getElementById("loadedChunks"),
    objectCount: document.getElementById("objectCount"),
    meshCount: document.getElementById("meshCount"),
    frustumQueueLabel: document.getElementById("frustumQueueLabel"),
    frustumQueueProgress: document.getElementById("frustumQueueProgress"),
    streamStatus: document.getElementById("streamStatus"),
    signalFrustumLoaded: createInitialFrustumReadyHandler()
  };

  const view = studio.viewManager.createView({
    id: "demoView",
    htmlElement: document.getElementById("viewerCanvas"),
    adaptiveQuality: false,
    backgroundColor: [0.76, 0.85, 0.91],
    effects: {
      sao: {
        renderModes: [xeokit.base.constants.RealisticRender]
      },
      edges: {
        renderModes: ALL_RENDER_MODES
      },
      shadows: {
        renderModes: [xeokit.base.constants.RealisticRender]
      },
      tonemap: {
        renderModes: []
      },
      sky: {
        enabled: true,
        skyColor: [0.48, 0.68, 0.84],
        horizonColor: [0.82, 0.91, 0.95],
        groundColor: [0.82, 0.86, 0.82],
        blend: 0.5,
        intensity: 1.0
      }
    },
    camera: {
      perspectiveProjection: {fov: INITIAL_VIEWPOINT.fov, near: 0.001, far: FAR_CLIP},
      eye: INITIAL_VIEWPOINT.eye,
      look: INITIAL_VIEWPOINT.look,
      up: INITIAL_VIEWPOINT.up
    }
  });

  try {
    setStatus(ui, "Preparing recursive stream index");
    const index = await fetchStreamingIndex(INDEX_URL);
    updateViewpointsFromStreams(index);
    applyViewpointToCamera(view, INITIAL_VIEWPOINT);
    const indexBaseURI = new URL(INDEX_URL, window.location.href).href;
    const totalObjectCount = await countStreamObjects(index, indexBaseURI);
    setStatus(ui, "Scheduling first frustum");

    const sceneModel = must(scene.createModel({
      id: "RecursiveStream",
      coordinateSystem: ROOT_COORDINATE_SYSTEM
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
        render(ui, streamController, totalObjectCount);
      });
    };

    streamController = new xeokit.formats.xgfstream.XGFViewStreamController({
      index,
      streamIndexBaseURI: indexBaseURI,
      loader,
      sceneModel,
      view,
      batchSize: AUTO_BATCH_SIZE,
      fetchConcurrency: FETCH_CONCURRENCY,
      commitFrameBudgetMs: CHUNK_COMMIT_FRAME_BUDGET_MS,
      cameraDebounceMs: CAMERA_DEBOUNCE_MS,
      frustumDepthMultiplier: 3,
      frustumMinDepth: 900,
      enableLRUEviction: ENABLE_LRU_CHUNK_EVICTION,
      maxResidentChunks: MAX_RESIDENT_REFERENCE_CHUNKS,
      cacheFileData: CACHE_XGF_FILE_BYTES,
      maxCachedFileBytes: MAX_CACHED_XGF_FILE_BYTES,
      frustumOnly: true,
      unloadInactiveStreams: false,
      onStatus: (status) => setStatus(ui, status),
      onProgress: () => {
        updateViewpointProgress(viewpointProgress, activeViewpointId, streamController.queueProgress);
        scheduleRender();
        ui.signalFrustumLoaded(streamController.queueProgress);
      },
      onChunksLoading: () => hideStartupSpinner(),
      onError: (error) => {
        console.error(error);
        setStatus(ui, String(error?.message || error));
        scheduleRender();
      }
    });

    hideStartupSpinner();
    streamController.prefetchInitial(AUTO_BATCH_SIZE * 2);
    streamController.schedule("Current frustum");
    render(ui, streamController, totalObjectCount);
    bindCameraStreaming(studio, view, streamController);
    bindViewpointCards(studio, view, streamController, viewpointCards, (viewpointId) => {
      activeViewpointId = viewpointId;
      markViewpointProgressPending(viewpointProgress, viewpointId);
    });
    setActiveViewpoint(viewpointCards, INITIAL_VIEWPOINT.id);
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
  return result.value;
}

async function fetchJSON(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }
  return response.json();
}

function render(ui, streamController, totalObjectCount) {
  ui.loadedChunks.textContent = `${streamController.loadedChunkIds.size}/${streamController.chunkManifests.length}`;
  ui.objectCount.textContent = streamController.loadedTotals.objects.toLocaleString();
  ui.meshCount.textContent = streamController.loadedTotals.meshes.toLocaleString();
  const loadedObjects = streamController.loadedTotals.objects;
  const totalObjects = Math.max(totalObjectCount, loadedObjects, 1);
  ui.frustumQueueLabel.textContent = `${formatInt(loadedObjects)}/${formatInt(totalObjects)} objects`;
  ui.frustumQueueProgress.max = totalObjects;
  ui.frustumQueueProgress.value = loadedObjects;
}

function updateViewpointsFromStreams(index) {
  const streamsById = new Map((index.streams || []).map((stream) => [stream.id, stream]));
  for (const viewpoint of VIEWPOINTS) {
    if (!viewpoint.streamId) {
      continue;
    }
    const stream = streamsById.get(viewpoint.streamId);
    const worldAABB = stream?.aabb;
    if (!worldAABB) {
      continue;
    }
    const center = aabbCenter(worldAABB);
    const extents = aabbExtents(worldAABB);
    const span = Math.max(extents[0], extents[1], extents[2], 1);
    const height = Math.max(extents[2], span * 0.35, 25);
    viewpoint.look = center;
    if (viewpoint.frame === "top") {
      viewpoint.eye = [center[0], center[1] + Math.max(span * 3.2, 80), center[2]];
      viewpoint.up = [0, 0, 1];
      viewpoint.fov = 28;
    } else if (viewpoint.frame === "map-close") {
      viewpoint.eye = [center[0], worldAABB[1] - span * 0.72, center[2] + Math.max(extents[2] * 0.62, 18)];
      viewpoint.look = [center[0], center[1], center[2] + extents[2] * 0.1];
      viewpoint.up = [0, 0, 1];
      viewpoint.fov = 28;
    } else if (viewpoint.frame === "baku-truss") {
      viewpoint.eye = [center[0] - span * 0.16, center[1] + span * 0.13, center[2] + extents[2] * 0.25];
      viewpoint.look = [center[0] + span * 0.02, center[1] - span * 0.04, center[2] + extents[2] * 0.24];
      viewpoint.up = [0, 0, 1];
      viewpoint.fov = 24;
    } else if (viewpoint.frame === "large-oblique") {
      viewpoint.eye = [center[0] + span * 0.55, center[1] - span * 0.75, center[2] + height];
      viewpoint.up = [0, 0, 1];
      viewpoint.fov = 38;
    } else if (viewpoint.frame === "lyon-close") {
      viewpoint.eye = [center[0] + span * 0.04, center[1] - span * 0.1, center[2] + Math.max(extents[2] * 1.75, 260)];
      viewpoint.up = [0, 0, 1];
      viewpoint.fov = 24;
    } else if (viewpoint.frame === "house-room") {
      viewpoint.eye = [worldAABB[0] + extents[0] * 0.16, worldAABB[1] + extents[1] * 0.18, worldAABB[2] + Math.min(extents[2] * 1.12, 2.85)];
      viewpoint.look = [worldAABB[0] + extents[0] * 0.62, worldAABB[1] + extents[1] * 0.58, worldAABB[2] + Math.min(extents[2] * 0.12, 0.55)];
      viewpoint.up = [0, 0, 1];
      viewpoint.fov = 66;
    } else {
      viewpoint.eye = [center[0] + span * 1.15, center[1] - span * 1.25, center[2] + height];
      viewpoint.up = [0, 0, 1];
      viewpoint.fov = 42;
    }
  }
}

function aabbCenter(aabb) {
  return [
    (aabb[0] + aabb[3]) / 2,
    (aabb[1] + aabb[4]) / 2,
    (aabb[2] + aabb[5]) / 2
  ];
}

function aabbExtents(aabb) {
  return [
    aabb[3] - aabb[0],
    aabb[4] - aabb[1],
    aabb[5] - aabb[2]
  ];
}

async function countStreamObjects(index, indexURL) {
  const childCounts = await Promise.all((index.streams || []).map(async (stream) => {
    const childIndexURL = new URL(stream.uri, indexURL).href;
    const childIndex = await fetchStreamingIndex(childIndexURL);
    return countStreamObjects(childIndex, childIndexURL);
  }));
  return childCounts.reduce((total, count) => total + count, countReferenceObjects(index));
}

function countReferenceObjects(index) {
  return (index.chunks || []).reduce((total, manifest) => {
    return manifest.role === "referencesOnly"
      ? total + (manifest.counts?.objects || 0)
      : total;
  }, 0);
}

function formatInt(value) {
  return Math.round(value).toLocaleString();
}

function setStatus(ui, status) {
  if (!startupSpinnerDismissed) {
    sdkProgress.setPhase(status);
  }
  if (ui.streamStatus) {
    ui.streamStatus.textContent = status;
  }
}

function bindCameraStreaming(studio, view, streamController) {
  const onCamera = (changedView) => {
    if (changedView === view) {
      streamController.schedule("Camera stream");
    }
  };
  studio.viewer.events.onCameraViewMatrixUpdated.subscribe(onCamera);
  studio.viewer.events.onCameraProjMatrixUpdated.subscribe(onCamera);
}

function bindViewpointCards(studio, view, streamController, cards, onSelect) {
  const viewpointsById = new Map(VIEWPOINTS.map((viewpoint) => [viewpoint.id, viewpoint]));
  for (const card of cards) {
    card.addEventListener("click", () => {
      const viewpoint = viewpointsById.get(card.dataset.viewpointId);
      if (!viewpoint) {
        return;
      }
      setActiveViewpoint(cards, viewpoint.id);
      onSelect?.(viewpoint.id);
      applyViewpointToCamera(view, viewpoint);
      streamController.schedule(viewpoint.id);
    });
  }
}

function applyViewpointToCamera(view, viewpoint) {
  applyViewpointProjection(view, viewpoint);
  view.camera.eye = viewpoint.eye;
  view.camera.look = viewpoint.look;
  view.camera.up = viewpoint.up;
}

function applyViewpointProjection(view, viewpoint) {
  view.camera.perspectiveProjection.fov = viewpoint.fov || 35;
  view.camera.perspectiveProjection.far = FAR_CLIP;
}

function createViewpointCards(container, viewpoints) {
  return viewpoints.map((viewpoint) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "viewpoint-card";
    card.dataset.viewpointId = viewpoint.id;
    card.innerHTML = `
      <strong>${viewpoint.title}</strong>
      <span>${viewpoint.location}</span>
      <div class="viewpoint-progress-row">
        <span class="viewpoint-progress-label">Not loaded</span>
        <span class="viewpoint-progress-count">0/0</span>
      </div>
      <div class="viewpoint-progress-track" aria-hidden="true">
        <div class="viewpoint-progress-fill"></div>
      </div>`;
    container.appendChild(card);
    return card;
  });
}

function createViewpointProgress(cards) {
  const progressByViewpoint = new Map();
  for (const card of cards) {
    progressByViewpoint.set(card.dataset.viewpointId, {
      card,
      label: card.querySelector(".viewpoint-progress-label"),
      count: card.querySelector(".viewpoint-progress-count"),
      fill: card.querySelector(".viewpoint-progress-fill")
    });
  }
  return progressByViewpoint;
}

function markViewpointProgressPending(progressByViewpoint, viewpointId) {
  const entry = progressByViewpoint.get(viewpointId);
  if (!entry) {
    return;
  }
  entry.card.classList.remove("loaded");
  entry.label.textContent = "Scheduling";
  entry.count.textContent = "0/0";
  entry.fill.style.setProperty("--progress", "0%");
}

function updateViewpointProgress(progressByViewpoint, viewpointId, progress) {
  const entry = progressByViewpoint.get(viewpointId);
  if (!entry || !progress) {
    return;
  }
  const queued = Math.max(progress.queued, 0);
  const loaded = Math.max(Math.min(progress.loaded, queued), 0);
  const percent = queued > 0 ? (loaded / queued) * 100 : 100;
  const complete = queued === 0 || loaded >= queued;
  entry.card.classList.toggle("loaded", complete);
  entry.label.textContent = complete ? "Loaded" : "Loading";
  entry.count.textContent = `${loaded}/${queued}`;
  entry.fill.style.setProperty("--progress", `${Math.max(0, Math.min(100, percent))}%`);
}

function setActiveViewpoint(cards, id) {
  for (const card of cards) {
    card.classList.toggle("active", card.dataset.viewpointId === id);
  }
}

function hideStartupSpinner() {
  if (startupSpinnerDismissed) {
    return;
  }
  startupSpinnerDismissed = true;
  document.body.classList.add("xeokit-loading-spinner-ready");
  const overlay = document.getElementById("xeokit-boot-loading-overlay");
  if (overlay) {
    overlay.style.display = "none";
  }
}

function must(result) {
  if (!result || result.ok === false) {
    throw new Error(result?.error || "Operation failed");
  }
  return result.value;
}

function createInitialFrustumReadyHandler() {
  let signaled = false;
  return (progress) => {
    const readyChunkCount = Math.min(progress?.queued || 0, 16);
    if (signaled || !progress || readyChunkCount <= 0 || progress.loaded < readyChunkCount) {
      return;
    }
    signaled = true;
    signalReady();
    hideStartupSpinner();
  };
}

function signalReady() {
  if (document.getElementById("ExampleLoaded")) {
    return;
  }
  const exampleMarker = document.createElement("div");
  exampleMarker.id = "ExampleLoaded";
  exampleMarker.hidden = true;
  document.body.appendChild(exampleMarker);

  const marker = document.createElement("div");
  marker.id = "XGFStreamingRecursiveReady";
  marker.hidden = true;
  document.body.appendChild(marker);
}
