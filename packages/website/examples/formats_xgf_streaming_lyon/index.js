import * as xeokit from "../../js/xeokit-studio-bundle.js";

const {sdkProgress} = xeokit.base.core;

const INDEX_URL = "../../models/Lyon/xgfstream/index.runtime.json";
const AUTO_BATCH_SIZE = 2;
const FETCH_CONCURRENCY = 4;
const CAMERA_DEBOUNCE_MS = 140;
const CACHE_XGF_FILE_BYTES = true;
const MAX_CACHED_XGF_FILE_BYTES = 128 * 1024 * 1024;
const FAR_CLIP = 100000;

const VIEWPOINTS = [
  {
    id: "LYON-01",
    title: "Central blocks",
    location: "Close city inspection",
    eye: [472, 1432, 392],
    look: [-128, -768, 2],
    up: [0, 0, 1],
    fov: 18
  },
  {
    id: "LYON-02",
    title: "East district",
    location: "Dense urban fabric",
    eye: [3672, 3232, 922],
    look: [172, -232, 32],
    up: [0, 0, 1],
    fov: 24
  },
  {
    id: "LYON-03",
    title: "Western sector",
    location: "Low oblique inspection",
    eye: [-6428, 2432, 672],
    look: [-2328, -868, 22],
    up: [0, 0, 1],
    fov: 22
  },
  {
    id: "LYON-04",
    title: "South approach",
    location: "Long view through the city",
    eye: [972, -7868, 572],
    look: [-328, -1268, 32],
    up: [0, 0, 1],
    fov: 22
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
    adaptiveQuality: true,
    backgroundColor: [0.76, 0.85, 0.91],
    effects: {
      edges: {
        renderModes: ALL_RENDER_MODES
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
      perspectiveProjection: {fov: INITIAL_VIEWPOINT.fov, far: FAR_CLIP},
      eye: INITIAL_VIEWPOINT.eye,
      look: INITIAL_VIEWPOINT.look,
      up: INITIAL_VIEWPOINT.up
    },
    resolutionScale: {
      renderModes: [xeokit.base.constants.NavigationRender],
      resolutionScale: 1.0
    }
  });

  try {
    setStatus(ui, "Preparing stream index");
    const index = await fetchStreamingIndex(INDEX_URL);
    setStatus(ui, "Scheduling first frustum");

    const sceneModel = must(scene.createModel({
      id: "Lyon",
      coordinateSystem: {
        basis: [1, 0, 0, 0, 1, 0, 0, 0, 1],
        origin: [-1842828.125, -227.6079330444336, 5174732.125],
        units: "meters",
        scaleToMeters: 1
      }
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
      cameraDebounceMs: CAMERA_DEBOUNCE_MS,
      cacheFileData: CACHE_XGF_FILE_BYTES,
      maxCachedFileBytes: MAX_CACHED_XGF_FILE_BYTES,
      frustumOnly: true,
      onStatus: (status) => setStatus(ui, status),
      onProgress: (progress) => {
        scheduleRender();
        ui.signalFrustumLoaded(progress);
      },
      onChunksLoading: () => hideStartupSpinner(),
      onError: (error) => {
        console.error(error);
        setStatus(ui, String(error?.message || error));
        scheduleRender();
      }
    });

    hideStartupSpinner();
    streamController.schedule("Current frustum");
    render(ui, streamController);
    bindCameraStreaming(studio, view, streamController);
    bindViewpointCards(studio, view, streamController, viewpointCards);
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
  return resolveIndexRelativeChunkUris(result.value, url);
}

function resolveIndexRelativeChunkUris(index, indexUrl) {
  const baseUrl = new URL(".", new URL(indexUrl, window.location.href)).href;
  const resolveChunkUri = (manifest) => ({
    ...manifest,
    uri: resolveUri(manifest.uri, baseUrl),
    dependencies: {
      ...manifest.dependencies,
      chunks: (manifest.dependencies?.chunks || []).map((dependency) => ({
        ...dependency,
        uri: resolveUri(dependency.uri, baseUrl)
      }))
    }
  });
  return {
    ...index,
    chunks: index.chunks.map(resolveChunkUri)
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
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }
  return response.json();
}

function render(ui, streamController) {
  const queueProgress = streamController.queueProgress;
  ui.loadedChunks.textContent = `${streamController.loadedChunkIds.size}/${streamController.chunkManifests.length}`;
  ui.objectCount.textContent = formatInt(streamController.loadedTotals.objects);
  ui.meshCount.textContent = formatInt(streamController.loadedTotals.meshes);
  ui.frustumQueueProgress.max = String(Math.max(queueProgress.queued, 1));
  ui.frustumQueueProgress.value = String(queueProgress.loaded);
  if (queueProgress.queued === 0 || queueProgress.loaded >= queueProgress.queued) {
    ui.frustumQueueLabel.textContent = "Frustum loaded";
    ui.signalFrustumLoaded?.(queueProgress);
  } else {
    ui.frustumQueueLabel.textContent = `${formatInt(queueProgress.loaded)}/${formatInt(queueProgress.queued)} loaded`;
  }
}

function setStatus(ui, status) {
  if (!startupSpinnerDismissed) {
    sdkProgress.setPhase(status);
  }
  if (ui.streamStatus) {
    ui.streamStatus.textContent = status;
  }
}

function hideStartupSpinner() {
  startupSpinnerDismissed = true;
  document.body.classList.add("xeokit-loading-spinner-ready");
  const overlay = document.getElementById("xeokit-boot-loading-overlay");
  if (overlay) {
    overlay.style.display = "none";
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

function bindViewpointCards(studio, view, streamController, cards) {
  const viewpoints = new Map(VIEWPOINTS.map((viewpoint) => [viewpoint.id, viewpoint]));
  const cameraFlight = studio.viewManager.views?.[view.id]?.cameraFlight;

  for (const card of cards) {
    card.addEventListener("click", () => {
      const viewpoint = viewpoints.get(card.dataset.viewpointId);
      if (!viewpoint) {
        return;
      }
      setActiveViewpoint(cards, viewpoint.id);
      view.camera.perspectiveProjection.fov = viewpoint.fov || 35;
      view.camera.perspectiveProjection.far = FAR_CLIP;
      if (cameraFlight && typeof cameraFlight.flyTo === "function") {
        cameraFlight.flyTo({
          eye: viewpoint.eye,
          look: viewpoint.look,
          up: viewpoint.up,
          duration: 0.9
        });
      } else {
        view.camera.eye = viewpoint.eye;
        view.camera.look = viewpoint.look;
        view.camera.up = viewpoint.up;
      }
      streamController.schedule(viewpoint.id);
      window.setTimeout(() => streamController.schedule(`${viewpoint.id} settled`), 950);
    });
  }
}

function createViewpointCards(container, viewpoints) {
  if (!container) {
    return [];
  }
  container.replaceChildren();
  return viewpoints.map((viewpoint) => {
    const card = document.createElement("button");
    card.className = "viewpoint-card";
    card.type = "button";
    card.dataset.viewpointId = viewpoint.id;
    card.setAttribute("aria-pressed", "false");

    const title = document.createElement("strong");
    title.textContent = viewpoint.title;

    const location = document.createElement("span");
    location.textContent = viewpoint.location;

    card.append(title, location);
    container.append(card);
    return card;
  });
}

function setActiveViewpoint(cards, activeId) {
  for (const card of cards) {
    card.setAttribute("aria-pressed", card.dataset.viewpointId === activeId ? "true" : "false");
  }
}

function formatInt(value) {
  return Math.round(value || 0).toLocaleString();
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
  marker.id = "XGFStreamingLyonReady";
  marker.hidden = true;
  document.body.appendChild(marker);
}
