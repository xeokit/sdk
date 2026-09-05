import * as xeokit from "../../../../../js/xeokit-studio-bundle.js";

const {sdkProgress} = xeokit.base.core;

const INDEX_URL = "../../../../../models/Lyon/xgfstream/index.runtime.json";
const AUTO_BATCH_SIZE = 2;
const FETCH_CONCURRENCY = 4;
const CAMERA_DEBOUNCE_MS = 140;
const STREAM_RESUME_AFTER_CAMERA_IDLE_MS = 500;
const STREAM_STALL_STORAGE_KEY = "xeokit.streaming/xgf/lyon.stallStreamingWhileMoving";
const DEFAULT_STALL_STREAMING_WHILE_MOVING = true;
const CACHE_XGF_FILE_BYTES = true;
const MAX_CACHED_XGF_FILE_BYTES = 128 * 1024 * 1024;
const FAR_CLIP = 100000;
const OUTDOOR_DAYLIGHT = {
  iblIntensity: 0.42,
  hemisphereIntensity: 0.12,
  hemisphereSkyColor: [0.72, 0.84, 0.96],
  hemisphereGroundColor: [0.44, 0.45, 0.40],
  ambientIntensity: 0.08,
  sunDir: [-0.42, -0.62, -0.72],
  sunColor: [1.0, 0.96, 0.88],
  sunIntensity: 1.18
};
let outdoorDaylightHDRBuffer = null;

const VIEWPOINTS = [
  {
    id: "LYON-01",
    title: "Central cluster",
    location: "Street-scale inspection",
    eye: [1843210.4175, -5175854.7, 661.9057083129883],
    look: [1842761.9375, -5174733.5, 263.3831024169922],
    up: [0, 0, 1],
    fov: 24
  },
  {
    id: "LYON-02",
    title: "East blocks",
    location: "Local building group",
    eye: [1846060, -5175820, 650],
    look: [1844660, -5174480, 265],
    up: [0, 0, 1],
    fov: 26
  },
  {
    id: "LYON-03",
    title: "West blocks",
    location: "Low oblique inspection",
    eye: [1839700, -5175840, 650],
    look: [1840660, -5174480, 265],
    up: [0, 0, 1],
    fov: 26
  },
  {
    id: "LYON-04",
    title: "South overview",
    location: "Broad city approach",
    eye: [1843160, -5181640, 1650],
    look: [1842760, -5175120, 265],
    up: [0, 0, 1],
    fov: 32
  },
  {
    id: "LYON-05",
    title: "Northwest overview",
    location: "Merged district extent",
    eye: [1836560, -5170030, 1700],
    look: [1842760, -5174730, 265],
    up: [0, 0, 1],
    fov: 35
  }
];

const INITIAL_VIEWPOINT = VIEWPOINTS[0];

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
    stallStreamingToggle: document.getElementById("stallStreamingToggle"),
    streamStatus: document.getElementById("streamStatus"),
    signalFrustumLoaded: createInitialFrustumReadyHandler()
  };

  const view = studio.viewManager.createView({
    id: "demoView",
    adaptiveQuality: false,
    backgroundColor: [0.76, 0.85, 0.91],
    effects: {
      sao: {
        enabled: false
      },
      edges: {
        enabled: false
      },
      shadows: {
        enabled: false
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
        enabled: false
      },
      tonemap: {
        enabled: false
      },
      antiAliasing: {
        enabled: false
      },
      sky: {
        enabled: false
      }
    },
    camera: {
      perspectiveProjection: {fov: INITIAL_VIEWPOINT.fov, far: FAR_CLIP},
      eye: INITIAL_VIEWPOINT.eye,
      look: INITIAL_VIEWPOINT.look,
      up: INITIAL_VIEWPOINT.up
    }
  });
  studio.viewProfiles?.setActiveProfile(null);
  disableExpensiveEffects(view);
  configureLyonDaylight(view, OUTDOOR_DAYLIGHT);

  try {
    setStatus(ui, "Preparing stream index");
    const index = await fetchStreamingIndex(INDEX_URL);
    setStatus(ui, "Scheduling first frustum");

    const sceneModel = must(scene.createModel({
      id: "Lyon",
      updateHint: "static"
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
    bindCameraStreaming(studio, view, streamController, ui.stallStreamingToggle);
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

function disableExpensiveEffects(view) {
  const effects = view.effects || {};
  for (const effectId of [
    "sao",
    "edges",
    "shadows",
    "atmosphere",
    "bloom",
    "depthOfField",
    "colorGrading",
    "tonemap",
    "antiAliasing",
    "sky"
  ]) {
    if (effects[effectId]) {
      effects[effectId].enabled = false;
    }
  }
}

function configureLyonDaylight(view, config) {
  if (view.lights?.ibl) {
    view.lights.ibl.enabled = config.iblIntensity > 0;
    view.lights.ibl.intensity = config.iblIntensity ?? 0.42;
    if (view.lights.ibl.enabled) {
      const iblResult = applyOutdoorIBLEnvironment(view, config);
      if (!iblResult) {
        view.lights.ibl.enabled = false;
        view.lights.ibl.intensity = 0;
      }
    }
  }
  if (view.lights?.hemispheric) {
    view.lights.hemispheric.enabled = config.hemisphereIntensity > 0;
    view.lights.hemispheric.intensity = config.hemisphereIntensity ?? 0.12;
    view.lights.hemispheric.skyColor = config.hemisphereSkyColor || [0.72, 0.84, 0.96];
    view.lights.hemispheric.groundColor = config.hemisphereGroundColor || [0.44, 0.45, 0.40];
    view.lights.hemispheric.worldUp = [0, 0, 1];
  }
  view.clearLights();
  new xeokit.viewing.viewer.AmbientLight(view, {
    id: "lyonAmbient",
    color: [1.0, 1.0, 1.0],
    intensity: config.ambientIntensity ?? 0.08
  });
  new xeokit.viewing.viewer.DirLight(view, {
    id: "lyonSun",
    dir: config.sunDir || [-0.42, -0.62, -0.72],
    color: config.sunColor || [1.0, 0.96, 0.88],
    intensity: config.sunIntensity ?? 1.18,
    space: "world"
  });
}

function applyOutdoorIBLEnvironment(view, config) {
  const paint = xeokit.model?.generation?.paintEnvironments;
  if (!paint?.paintSunSkyHDR || !paint?.encodeRadianceHDR) {
    return false;
  }
  if (!outdoorDaylightHDRBuffer) {
    const sunDirection = normalizeVec3(config.sunDirection || negateVec3(config.sunDir || [-0.42, -0.62, -0.72]));
    const hdrPixels = paint.paintSunSkyHDR(512, 256, {sunDirection});
    outdoorDaylightHDRBuffer = paint.encodeRadianceHDR(hdrPixels, 512, 256);
  }
  const result = view.lights.ibl.setEnvironmentHDRBuffer(outdoorDaylightHDRBuffer);
  if (!result.ok) {
    console.warn("[streaming/xgf/lyon] Outdoor IBL setup failed:", result.error);
    return false;
  }
  return true;
}

function negateVec3(value) {
  return [-value[0], -value[1], -value[2]];
}

function normalizeVec3(value) {
  const length = Math.hypot(value[0], value[1], value[2]) || 1;
  return [value[0] / length, value[1] / length, value[2] / length];
}

function hideStartupSpinner() {
  startupSpinnerDismissed = true;
  document.body.classList.add("xeokit-loading-spinner-ready");
  const overlay = document.getElementById("xeokit-boot-loading-overlay");
  if (overlay) {
    overlay.style.display = "none";
  }
}

function bindCameraStreaming(studio, view, streamController, stallStreamingToggle) {
  let resumeTimer;
  let stallStreamingWhileMoving = readPersistentBoolean(
    STREAM_STALL_STORAGE_KEY,
    DEFAULT_STALL_STREAMING_WHILE_MOVING
  );

  const clearResumeTimer = () => {
    if (resumeTimer !== undefined) {
      window.clearTimeout(resumeTimer);
      resumeTimer = undefined;
    }
  };

  if (stallStreamingToggle) {
    stallStreamingToggle.checked = stallStreamingWhileMoving;
    stallStreamingToggle.addEventListener("change", () => {
      stallStreamingWhileMoving = stallStreamingToggle.checked;
      writePersistentBoolean(STREAM_STALL_STORAGE_KEY, stallStreamingWhileMoving);
      if (!stallStreamingWhileMoving) {
        clearResumeTimer();
        if (streamController.paused) {
          streamController.resume("Camera stream");
        } else {
          streamController.schedule("Camera stream");
        }
      }
    });
  }

  const onCamera = (target) => {
    if (target === view || target === view.camera) {
      if (!stallStreamingWhileMoving) {
        streamController.schedule("Camera stream");
        return;
      }
      streamController.pause();
      clearResumeTimer();
      resumeTimer = window.setTimeout(() => {
        resumeTimer = undefined;
        streamController.resume("Camera settled");
      }, STREAM_RESUME_AFTER_CAMERA_IDLE_MS);
    }
  };
  studio.viewer.events.onCameraViewMatrixUpdated.subscribe(onCamera);
  studio.viewer.events.onCameraProjMatrixUpdated.subscribe(onCamera);
}

function readPersistentBoolean(key, fallback) {
  try {
    const value = window.localStorage.getItem(key);
    if (value === "true") {
      return true;
    }
    if (value === "false") {
      return false;
    }
  } catch (error) {
    // Ignore blocked storage and keep the example usable.
  }
  return fallback;
}

function writePersistentBoolean(key, value) {
  try {
    window.localStorage.setItem(key, value ? "true" : "false");
  } catch (error) {
    // Ignore blocked storage and keep the in-memory toggle usable.
  }
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
  document.body.classList.add("xeokit-loading-spinner-ready");
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
