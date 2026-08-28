import * as xeokit from "../../../../js/xeokit-studio-bundle.js";

const {sdkProgress} = xeokit.base.core;

const INDEX_URL = "../../../../models/Archipelago/xgfstream/index.runtime.json";
const AUTO_BATCH_SIZE = 2;
const FETCH_CONCURRENCY = 4;
const CAMERA_DEBOUNCE_MS = 140;
const CACHE_XGF_FILE_BYTES = true;
const MAX_CACHED_XGF_FILE_BYTES = 128 * 1024 * 1024;
const FAR_CLIP = 200000;
const URL_PARAMS = new URLSearchParams(window.location.search);
const RENDERER = URL_PARAMS.get("renderer") || "auto";
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
    id: "ARCH-01",
    title: "Duplex island",
    location: "Central island building",
    eye: [267277.5, 6549630.4, 75.9],
    look: [267207.5, 6549725.4, 15.9],
    up: [0, 0, 1],
    fov: 24
  },
  {
    id: "ARCH-02",
    title: "IfcOpenHouse4 island",
    location: "North-west island building",
    eye: [260722.4, 6559401.5, 95.3],
    look: [260612.4, 6559536.5, 35.3],
    up: [0, 0, 1],
    fov: 24
  },
  {
    id: "ARCH-03",
    title: "Ferry",
    location: "South-east waterline",
    eye: [275660, 6541270, 85],
    look: [275500, 6541500, 20],
    up: [0, 0, 1],
    fov: 22
  },
  {
    id: "ARCH-04",
    title: "Full archipelago",
    location: "56 km overview",
    eye: [267000, 6509000, 31000],
    look: [267000, 6550000, 0],
    up: [0, 0, 1],
    fov: 48
  }
];

const INITIAL_VIEWPOINT = VIEWPOINTS[0];
let startupSpinnerDismissed = false;

sdkProgress.setPhase("Loading...");

const studio = new xeokit.studio.Studio({
  renderer: RENDERER
});
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
    signalFrustumLoaded: createInitialFrustumReadyHandler(studio)
  };

  const view = studio.viewManager.createView({
    id: "demoView",
    adaptiveQuality: false,
    backgroundColor: [0.76, 0.85, 0.91],
    effects: {
      edges: {
        enabled: true
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
      perspectiveProjection: {fov: INITIAL_VIEWPOINT.fov, near: 0.1, far: FAR_CLIP},
      eye: INITIAL_VIEWPOINT.eye,
      look: INITIAL_VIEWPOINT.look,
      up: INITIAL_VIEWPOINT.up
    }
  });
  studio.viewProfiles?.setActiveProfile(null);
  disableExpensiveEffects(view);
  configureArchipelagoDaylight(view, OUTDOOR_DAYLIGHT);

  try {
    setStatus(ui, "Preparing stream index");
    const index = await fetchStreamingIndex(INDEX_URL);
    setStatus(ui, "Scheduling first frustum");

    const sceneModel = must(scene.createModel({
      id: "Archipelago",
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
  return resolveStreamingIndexUris(result.value, url);
}

function resolveStreamingIndexUris(index, indexUrl) {
  const baseUrl = new URL(".", new URL(indexUrl, window.location.href));
  for (const chunk of index.chunks || []) {
    if (chunk.uri) {
      chunk.uri = new URL(chunk.uri, baseUrl).href;
    }
    for (const dependency of chunk.dependencies?.chunks || []) {
      if (dependency.uri) {
        dependency.uri = new URL(dependency.uri, baseUrl).href;
      }
    }
  }
  return index;
}

async function fetchJSON(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }
  return response.json();
}

function render(ui, streamController) {
  ui.loadedChunks.textContent = `${streamController.loadedChunkIds.size}/${streamController.chunkManifests.length}`;
  ui.objectCount.textContent = streamController.loadedTotals.objects.toLocaleString();
  ui.meshCount.textContent = streamController.loadedTotals.meshes.toLocaleString();
  const progress = streamController.queueProgress;
  const total = Math.max(progress.queued, 1);
  ui.frustumQueueLabel.textContent = `${progress.loaded}/${progress.queued} loaded`;
  ui.frustumQueueProgress.max = total;
  ui.frustumQueueProgress.value = progress.loaded;
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
    "shadows",
    "atmosphere",
    "bloom",
    "depthOfField",
    "colorGrading",
    "tonemap",
    "antiAliasing"
  ]) {
    if (effects[effectId]) {
      effects[effectId].enabled = false;
    }
  }
}

function configureArchipelagoDaylight(view, config) {
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
    id: "archipelagoAmbient",
    color: [1.0, 1.0, 1.0],
    intensity: config.ambientIntensity ?? 0.08
  });
  new xeokit.viewing.viewer.DirLight(view, {
    id: "archipelagoSun",
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
    console.warn("[streaming/xgf/archipelago] Outdoor IBL setup failed:", result.error);
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

function bindCameraStreaming(studio, view, streamController) {
  const onCamera = (camera) => {
    if (camera !== view.camera) {
      return;
    }
    streamController.schedule("Current frustum");
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
  return viewpoints.map((viewpoint) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "viewpoint-card";
    card.dataset.viewpointId = viewpoint.id;
    card.innerHTML = `<strong>${viewpoint.title}</strong><span>${viewpoint.location}</span>`;
    container.appendChild(card);
    return card;
  });
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

function createInitialFrustumReadyHandler(studio) {
  let signaled = false;
  return (progress) => {
    if (signaled || !progress || progress.queued <= 0 || progress.loaded < progress.queued) {
      return;
    }
    signaled = true;
    signalReady();
    studio.finished();
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
  marker.id = "XGFStreamingArchipelagoReady";
  marker.hidden = true;
  document.body.appendChild(marker);
}

function must(result) {
  if (!result || result.ok === false) {
    throw new Error(result?.error || "Operation failed");
  }
  return result.value;
}
