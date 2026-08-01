import * as xeokit from "../../js/xeokit-studio-bundle.js";

const {sdkProgress} = xeokit.base.core;
const {RealisticRender} = xeokit.base.constants;

const BUILDINGS_INDEX_URL = "../../models/Zurich_Building_LoD2_V10/xgfstream/index.runtime.json";
const BUILDINGS_MODEL_ID = "Zurich_Building_LoD2_V10";
const TERRAIN_MODEL_ID = "Zurich_Terrain_TIN";
const TERRAIN_INDEX_URL = `../../models/${TERRAIN_MODEL_ID}/xgfstream/index.runtime.json`;
const READY_MARKER_ID = "XGFStreamingZurichBuildingsReady";
const AUTO_BATCH_SIZE = 16;
const TERRAIN_AUTO_BATCH_SIZE = 6;
const FETCH_CONCURRENCY = 12;
const CHUNK_COMMIT_FRAME_BUDGET_MS = 4;
const STREAM_PROGRESS_CADENCE_MS = 80;
const CAMERA_DEBOUNCE_MS = 140;
const STREAM_RESUME_AFTER_CAMERA_IDLE_MS = 500;
const FRUSTUM_DEPTH_MULTIPLIER = 2.8;
const FRUSTUM_MIN_DEPTH = 650;
const VIEWPOINT_MOTION_STORAGE_KEY = "xeokit.formats_xgf_streaming_zurich_buildings.viewpointMotion";
const DEFAULT_VIEWPOINT_MOTION = "jump";
const CACHE_XGF_FILE_BYTES = true;
const MAX_CACHED_XGF_FILE_BYTES = 512 * 1024 * 1024;
const TERRAIN_MAX_CACHED_XGF_FILE_BYTES = 128 * 1024 * 1024;
const AUTO_LOAD_FRUSTUM_CHUNKS_ONLY = true;
const FAR_CLIP = 80000;

const REVIEW_VIEWPOINTS = [
  {
    id: "ZRH-101",
    title: "ZRH-101 Core block closeup",
    location: "Central block cluster",
    eye: [4435, -4365, 245],
    look: [4547, -4234, 15],
    up: [0, 0, 1],
    fov: 48
  },
  {
    id: "ZRH-118",
    title: "ZRH-118 West pocket review",
    location: "West district pocket",
    eye: [1775, -6005, 180],
    look: [1850, -5920, 12],
    up: [0, 0, 1],
    fov: 46
  },
  {
    id: "ZRH-136",
    title: "ZRH-136 Hillside close review",
    location: "North slope edge",
    eye: [4680, -2940, 240],
    look: [4780, -3060, 16],
    up: [0, 0, 1],
    fov: 46
  },
  {
    id: "ZRH-149",
    title: "ZRH-149 East street pocket",
    location: "East corridor pocket",
    eye: [6100, -5145, 150],
    look: [6040, -5100, 12],
    up: [0, 0, 1],
    fov: 44
  },
  {
    id: "ZRH-164",
    title: "ZRH-164 Southeast close review",
    location: "Southeast block face",
    eye: [7115, -4080, 210],
    look: [7040, -4190, 12],
    up: [0, 0, 1],
    fov: 46
  },
  {
    id: "ZRH-190",
    title: "ZRH-190 South block pocket",
    location: "Southern review pocket",
    badge: "close perspective",
    eye: [3070, -6600, 195],
    look: [3150, -6500, 12],
    up: [0, 0, 1],
    fov: 46
  }
];

const INITIAL_VIEWPOINT = REVIEW_VIEWPOINTS[0];

sdkProgress.setPhase("Booting Zurich XGF stream");

const studio = new xeokit.studio.Studio({
  maxViews: 1
});
const viewpointCards = createViewpointCards(document.getElementById("viewpointCards"), REVIEW_VIEWPOINTS);

studio.init().then(async () => {
  const {scene} = studio;

  const ui = {
    loadedChunks: document.getElementById("loadedChunks"),
    chunkTarget: document.getElementById("chunkTarget"),
    objectCount: document.getElementById("objectCount"),
    objectTarget: document.getElementById("objectTarget"),
    meshCount: document.getElementById("meshCount"),
    chunkProgress: document.getElementById("chunkProgress"),
    status: document.getElementById("status"),
    stallStreamingToggle: document.getElementById("stallStreamingToggle"),
    viewpointMotionToggle: document.getElementById("viewpointMotionToggle"),
    signalReady: createReadyHandler(studio),
    viewpointProgress: null
  };

  try {
    setStatus(ui, "Loading stream index");
    const buildingIndex = await fetchStreamingIndex(BUILDINGS_INDEX_URL);
    const terrainIndex = await fetchStreamingIndex(TERRAIN_INDEX_URL);
    ui.objectTarget.textContent = `/ ${formatInt(countReferenceObjects(buildingIndex) + countReferenceObjects(terrainIndex))}`;

    const view = studio.viewManager.createView({
      id: "demoView",
      adaptiveQuality: true,
      backgroundColor: [0.82, 0.88, 0.91],
      renderMode: RealisticRender,
      effects: {
        edges: {
          renderModes: [RealisticRender],
          useMeshColor: true,
          edgeDarken: 0.82,
          edgeAlpha: 0.58,
          edgeWidth: 1.1
        },
        sky: {
          enabled: true,
          skyColor: [0.64, 0.76, 0.86],
          horizonColor: [0.88, 0.93, 0.96],
          groundColor: [0.70, 0.76, 0.69],
          blend: 0.42,
          intensity: 0.9
        }
      },
      camera: {
        perspectiveProjection: {
          fov: INITIAL_VIEWPOINT.fov,
          far: FAR_CLIP
        },
        eye: INITIAL_VIEWPOINT.eye,
        look: INITIAL_VIEWPOINT.look,
        up: INITIAL_VIEWPOINT.up
      }
    });

    const sceneModel = must(scene.createModel({
      id: BUILDINGS_MODEL_ID,
      updateHint: "static",
      coordinateSystem: buildingIndex.coordinateSystem
    }));
    const terrainSceneModel = must(scene.createModel({
      id: TERRAIN_MODEL_ID,
      updateHint: "static",
      coordinateSystem: terrainIndex.coordinateSystem
    }));
    let renderScheduled = false;
    let streamController;
    let terrainStreamController;
    const scheduleRender = () => {
      if (renderScheduled || !streamController) {
        return;
      }
      renderScheduled = true;
      window.requestAnimationFrame(() => {
        renderScheduled = false;
        render(ui, streamController, terrainStreamController);
      });
    };

    streamController = new xeokit.formats.xgfstream.XGFViewStreamController({
      index: buildingIndex,
      loader: new xeokit.formats.xgfstream.XGFStreamingLoader(),
      sceneModel,
      view,
      batchSize: AUTO_BATCH_SIZE,
      fetchConcurrency: FETCH_CONCURRENCY,
      commitFrameBudgetMs: CHUNK_COMMIT_FRAME_BUDGET_MS,
      progressCadenceMs: STREAM_PROGRESS_CADENCE_MS,
      cameraDebounceMs: CAMERA_DEBOUNCE_MS,
      frustumOnly: AUTO_LOAD_FRUSTUM_CHUNKS_ONLY,
      cacheFileData: CACHE_XGF_FILE_BYTES,
      maxCachedFileBytes: MAX_CACHED_XGF_FILE_BYTES,
      onStatus: (status) => setStatus(ui, status),
      onProgress: () => scheduleRender(),
      onChunksLoading: () => hideStartupSpinner(),
      onError: (error) => {
        console.error(error);
        setStatus(ui, String(error?.message || error));
        scheduleRender();
      }
    });
    terrainStreamController = new xeokit.formats.xgfstream.XGFViewStreamController({
      index: terrainIndex,
      loader: new xeokit.formats.xgfstream.XGFStreamingLoader(),
      sceneModel: terrainSceneModel,
      view,
      batchSize: TERRAIN_AUTO_BATCH_SIZE,
      fetchConcurrency: FETCH_CONCURRENCY,
      commitFrameBudgetMs: CHUNK_COMMIT_FRAME_BUDGET_MS,
      progressCadenceMs: STREAM_PROGRESS_CADENCE_MS,
      cameraDebounceMs: CAMERA_DEBOUNCE_MS,
      frustumOnly: AUTO_LOAD_FRUSTUM_CHUNKS_ONLY,
      cacheFileData: CACHE_XGF_FILE_BYTES,
      maxCachedFileBytes: TERRAIN_MAX_CACHED_XGF_FILE_BYTES,
      onProgress: () => scheduleRender(),
      onChunksLoading: () => hideStartupSpinner(),
      onError: (error) => {
        console.error(error);
        setStatus(ui, String(error?.message || error));
        scheduleRender();
      }
    });
    ui.viewpointProgress = createViewpointLoadProgressTracker(view, viewpointCards, streamController, REVIEW_VIEWPOINTS);

    streamController.prefetchInitial(AUTO_BATCH_SIZE * 2);
    terrainStreamController.prefetchInitial(TERRAIN_AUTO_BATCH_SIZE * 2);
    streamController.schedule("Load Zurich buildings");
    terrainStreamController.schedule("Load Zurich terrain");
    const streamGroup = createStreamControllerGroup([streamController, terrainStreamController]);
    const cameraStreaming = bindCameraStreaming(studio, view, streamGroup, ui.stallStreamingToggle);
    const getViewpointMotion = bindViewpointMotionToggle(ui.viewpointMotionToggle);
    const cameraFlight = studio.viewManager.views?.[view.id]?.cameraFlight;
    bindViewpointCards(view, viewpointCards, cameraStreaming, cameraFlight, getViewpointMotion);
    render(ui, streamController, terrainStreamController);
    hideStartupSpinner();
    window.zurichBuildingsStreamingExample = {
      studio,
      view,
      streamController,
      terrainStreamController
    };
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
    chunks: (index.chunks || []).map(resolveChunkUri)
  };
}

function resolveUri(uri, baseUrl) {
  if (!uri || isAbsoluteUrl(uri)) {
    return uri;
  }
  return new URL(uri, baseUrl).href;
}

function isAbsoluteUrl(uri) {
  return /^[a-z][a-z0-9+.-]*:/i.test(uri);
}

function render(ui, streamController, terrainStreamController) {
  const controllers = [streamController, terrainStreamController].filter(Boolean);
  const loadedChunks = sumControllers(controllers, (controller) => controller.loadedChunkIds.size);
  const totalChunks = sumControllers(controllers, (controller) => controller.chunkManifests.length);
  ui.loadedChunks.textContent = formatInt(loadedChunks);
  ui.chunkTarget.textContent = `/ ${formatInt(totalChunks)}`;
  ui.objectCount.textContent = formatInt(sumControllers(controllers, (controller) => controller.loadedTotals.objects));
  ui.meshCount.textContent = formatInt(sumControllers(controllers, (controller) => controller.loadedTotals.meshes));
  ui.chunkProgress.max = String(Math.max(totalChunks, 1));
  ui.chunkProgress.value = String(loadedChunks);
  ui.viewpointProgress?.update(streamController.loadedChunkIds);

  if (streamController.loadedTotals.objects > 0) {
    ui.signalReady();
  }

  if (totalChunks > 0 && controllers.every((controller) => controller.loadedChunkIds.size >= controller.chunkManifests.length)) {
    setStatus(ui, "Loaded");
  }
}

function sumControllers(controllers, readValue) {
  return controllers.reduce((sum, controller) => sum + readValue(controller), 0);
}

function createStreamControllerGroup(controllers) {
  return {
    get paused() {
      return controllers.some((controller) => controller.paused);
    },
    pause: () => {
      for (const controller of controllers) {
        controller.pause();
      }
    },
    resume: (label) => {
      for (const controller of controllers) {
        controller.resume(label);
      }
    },
    schedule: (label) => {
      for (const controller of controllers) {
        controller.schedule(label);
      }
    }
  };
}

function bindCameraStreaming(studio, view, streamController, stallStreamingToggle) {
  let resumeTimer;
  let settledStreamLabel;

  const clearResumeTimer = () => {
    if (resumeTimer !== undefined) {
      window.clearTimeout(resumeTimer);
      resumeTimer = undefined;
    }
  };

  if (stallStreamingToggle) {
    stallStreamingToggle.checked = true;
    stallStreamingToggle.disabled = true;
  }

  const scheduleCameraStream = (label = "Camera stream") => {
    const resumeLabel = settledStreamLabel || label;
    clearResumeTimer();
    if (!streamController.paused) {
      streamController.pause();
    }
    resumeTimer = window.setTimeout(() => {
      resumeTimer = undefined;
      settledStreamLabel = undefined;
      streamController.resume(resumeLabel);
    }, STREAM_RESUME_AFTER_CAMERA_IDLE_MS);
  };

  studio.viewer.events.onCameraViewMatrixUpdated.subscribe(() => {
    updateDepthOfFieldFocus(view);
    scheduleCameraStream(settledStreamLabel || "Camera settled");
  });
  studio.viewer.events.onCameraProjMatrixUpdated.subscribe(() => {
    scheduleCameraStream(settledStreamLabel || "Camera settled");
  });

  return {
    schedule: scheduleCameraStream,
    preferSettledLabel: (label) => {
      settledStreamLabel = label;
    }
  };
}

function updateDepthOfFieldFocus(view) {
  const camera = view.camera;
  const eye = camera.eye;
  const look = camera.look;
  const distance = Math.hypot(eye[0] - look[0], eye[1] - look[1], eye[2] - look[2]);
  if (view.effects?.depthOfField) {
    view.effects.depthOfField.focusDistance = distance;
  }
}

function countReferenceObjects(index) {
  return (index.chunks || []).reduce((total, manifest) => {
    return manifest.role === "referencesOnly"
      ? total + (manifest.counts?.objects || 0)
      : total;
  }, 0);
}

function bindViewpointMotionToggle(viewpointMotionToggle) {
  let viewpointMotion = readPersistentChoice(
    VIEWPOINT_MOTION_STORAGE_KEY,
    DEFAULT_VIEWPOINT_MOTION,
    ["jump", "fly"]
  );

  const updateToggle = () => {
    if (viewpointMotionToggle) {
      viewpointMotionToggle.checked = viewpointMotion === "fly";
    }
  };

  if (viewpointMotionToggle) {
    updateToggle();
    viewpointMotionToggle.addEventListener("change", () => {
      viewpointMotion = viewpointMotionToggle.checked ? "fly" : "jump";
      writePersistentChoice(VIEWPOINT_MOTION_STORAGE_KEY, viewpointMotion);
      updateToggle();
    });
  }

  return () => viewpointMotion;
}

function readPersistentChoice(key, fallback, choices) {
  try {
    const value = window.localStorage.getItem(key);
    if (choices.includes(value)) {
      return value;
    }
  } catch (error) {
    // Persistence is optional for browser modes that block storage.
  }
  return fallback;
}

function writePersistentChoice(key, value) {
  try {
    window.localStorage.setItem(key, value);
  } catch (error) {
    // Persistence is optional for browser modes that block storage.
  }
}

function bindViewpointCards(view, cards, cameraStreaming, cameraFlight, getViewpointMotion) {
  const viewpoints = new Map(REVIEW_VIEWPOINTS.map((viewpoint) => [viewpoint.id, viewpoint]));

  const setActive = (activeId) => {
    for (const card of cards) {
      card.setAttribute("aria-pressed", card.dataset.viewpointId === activeId ? "true" : "false");
    }
  };

  setActive(INITIAL_VIEWPOINT.id);

  for (const card of cards) {
    card.addEventListener("click", () => {
      const viewpoint = viewpoints.get(card.dataset.viewpointId);
      if (!viewpoint) {
        return;
      }
      setActive(viewpoint.id);
      cameraStreaming.preferSettledLabel(viewpoint.id);
      if (getViewpointMotion() === "fly" && cameraFlight && typeof cameraFlight.flyTo === "function") {
        applyViewpointProjection(view, viewpoint);
        cameraFlight.flyTo({
          eye: viewpoint.eye,
          look: viewpoint.look,
          up: viewpoint.up,
          duration: 0.9
        });
      } else {
        applyViewpointToCamera(view, viewpoint);
      }
      cameraStreaming.schedule(viewpoint.id);
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
  view.camera.perspectiveProjection.fov = viewpoint.fov || 42;
}

function createViewpointLoadProgressTracker(view, cards, streamController, viewpoints) {
  const cardById = new Map(cards.map((card) => [card.dataset.viewpointId, card]));
  const cameraState = captureCameraState(view);
  const targetsById = new Map();

  for (const viewpoint of viewpoints) {
    applyViewpointToCamera(view, viewpoint);
    const targetChunkIds = streamController.chunkManifests
      .filter((manifest) => manifest.role === "referencesOnly" && isAABBVisibleForStreaming(view.camera, manifest.aabb))
      .map((manifest) => manifest.id);
    targetsById.set(viewpoint.id, targetChunkIds);
    const card = cardById.get(viewpoint.id);
    if (card) {
      card.dataset.targetChunks = String(targetChunkIds.length);
      card.style.setProperty("--view-load-progress", "0%");
    }
  }

  restoreCameraState(view, cameraState);

  return {
    update: (loadedChunkIds) => {
      for (const [viewpointId, targetChunkIds] of targetsById) {
        const card = cardById.get(viewpointId);
        if (!card) {
          continue;
        }
        const loaded = targetChunkIds.reduce((count, chunkId) => {
          return count + (loadedChunkIds.has(chunkId) ? 1 : 0);
        }, 0);
        const progress = targetChunkIds.length > 0 ? (loaded / targetChunkIds.length) * 100 : 100;
        card.style.setProperty("--view-load-progress", `${clampPercentage(progress)}%`);
      }
    }
  };
}

function captureCameraState(view) {
  return {
    eye: Array.from(view.camera.eye),
    look: Array.from(view.camera.look),
    up: Array.from(view.camera.up),
    fov: view.camera.perspectiveProjection.fov
  };
}

function restoreCameraState(view, state) {
  view.camera.perspectiveProjection.fov = state.fov;
  view.camera.eye = state.eye;
  view.camera.look = state.look;
  view.camera.up = state.up;
}

function isAABBVisibleFromCamera(camera, aabb) {
  const frustum = camera.frustum;
  if (!frustum || !aabb) {
    return true;
  }
  for (const plane of frustum.planes) {
    const x = aabb[plane.testVertex[0] ? 3 : 0];
    const y = aabb[plane.testVertex[1] ? 4 : 1];
    const z = aabb[plane.testVertex[2] ? 5 : 2];
    if ((plane.normal[0] * x) + (plane.normal[1] * y) + (plane.normal[2] * z) + plane.offset < 0) {
      return false;
    }
  }
  return true;
}

function isAABBVisibleForStreaming(camera, aabb) {
  return isAABBVisibleFromCamera(camera, aabb) && intersectsStreamingDepth(camera, aabb);
}

function intersectsStreamingDepth(camera, aabb) {
  if (!aabb) {
    return true;
  }
  const eye = camera.eye;
  const look = camera.look;
  if (!eye || !look) {
    return true;
  }
  const dx = look[0] - eye[0];
  const dy = look[1] - eye[1];
  const dz = look[2] - eye[2];
  const lookDistance = Math.hypot(dx, dy, dz);
  if (!Number.isFinite(lookDistance) || lookDistance <= 0) {
    return true;
  }
  const invDistance = 1 / lookDistance;
  const dirX = dx * invDistance;
  const dirY = dy * invDistance;
  const dirZ = dz * invDistance;
  const centerX = (aabb[0] + aabb[3]) * 0.5;
  const centerY = (aabb[1] + aabb[4]) * 0.5;
  const centerZ = (aabb[2] + aabb[5]) * 0.5;
  const halfX = (aabb[3] - aabb[0]) * 0.5;
  const halfY = (aabb[4] - aabb[1]) * 0.5;
  const halfZ = (aabb[5] - aabb[2]) * 0.5;
  const centerDepth =
    (centerX - eye[0]) * dirX +
    (centerY - eye[1]) * dirY +
    (centerZ - eye[2]) * dirZ;
  const radius =
    Math.abs(dirX) * halfX +
    Math.abs(dirY) * halfY +
    Math.abs(dirZ) * halfZ;
  const nearestDepth = centerDepth - radius;
  return nearestDepth <= Math.max(lookDistance * FRUSTUM_DEPTH_MULTIPLIER, FRUSTUM_MIN_DEPTH);
}

function clampPercentage(value) {
  return Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
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
    if (viewpoint.badge) {
      const badge = document.createElement("em");
      badge.textContent = viewpoint.badge;
      card.append(badge);
    }
    container.append(card);
    return card;
  });
}

function createReadyHandler(studio) {
  let signaled = false;
  return () => {
    if (signaled) {
      return;
    }
    signaled = true;
    signalReady();
    studio.finished();
  };
}

function signalReady() {
  if (!document.getElementById("ExampleLoaded")) {
    const exampleMarker = document.createElement("div");
    exampleMarker.id = "ExampleLoaded";
    exampleMarker.hidden = true;
    document.body.appendChild(exampleMarker);
  }
  if (!document.getElementById(READY_MARKER_ID)) {
    const marker = document.createElement("div");
    marker.id = READY_MARKER_ID;
    marker.hidden = true;
    document.body.appendChild(marker);
  }
}

function hideStartupSpinner() {
  const overlay = document.getElementById("xeokit-boot-loading-overlay");
  if (overlay) {
    overlay.style.display = "none";
  }
}

function setStatus(ui, status) {
  sdkProgress.setPhase(status);
  ui.status.textContent = status;
}

function formatInt(value) {
  return new Intl.NumberFormat().format(value || 0);
}

function must(result) {
  if (!result || result.ok === false) {
    throw new Error(result?.error || "Unexpected SDK failure");
  }
  return result.value;
}
