import * as xeokit from "../../../../../js/xeokit-studio-bundle.js?v=stream-publish-queue-20260815";

const {sdkProgress} = xeokit.base.core;

const INDEX_URL = "../../../../../models/WestRiverSideHospital/xgfstream/index.runtime.json";
const MODEL_ID = "WestRiverSideHospital";
const GLOBAL_EXAMPLE_NAME = "westRiverSideHospitalStreamingStaticExample";
const READY_MARKER_ID = "XGFStreamingWestRiverSideHospitalStaticReady";
const AUTO_BATCH_SIZE = 8;
const FETCH_CONCURRENCY = 8;
const CHUNK_COMMIT_FRAME_BUDGET_MS = 4;
const STREAM_PROGRESS_CADENCE_MS = 80;
const AUTO_LOAD_FRUSTUM_CHUNKS_ONLY = true;
const CAMERA_DEBOUNCE_MS = 140;
const STREAM_RESUME_AFTER_CAMERA_IDLE_MS = 500;
const STREAM_STALL_STORAGE_KEY = "xeokit.streaming/xgf/west-river-side-hospital-static.stallStreamingWhileMoving";
const DEFAULT_STALL_STREAMING_WHILE_MOVING = true;
const VIEWPOINT_MOTION_STORAGE_KEY = "xeokit.streaming/xgf/west-river-side-hospital-static.viewpointMotion";
const DEFAULT_VIEWPOINT_MOTION = "jump";
const ENABLE_LRU_CHUNK_EVICTION = false;
const MAX_RESIDENT_REFERENCE_CHUNKS = 300;
const CACHE_XGF_FILE_BYTES = true;
const MAX_CACHED_XGF_FILE_BYTES = 192 * 1024 * 1024;
const EXAMPLE_VERSION = "stream-publish-queue-20260815";

window.__westRiverSideHospitalStreamingPublishQueue = EXAMPLE_VERSION;
console.info(`[streaming/xgf/west-river-side-hospital-static] ${EXAMPLE_VERSION} loaded`);

const demoCanvas = document.getElementById("demoCanvas");
demoCanvas.style.visibility = "hidden";

const REVIEW_VIEWPOINTS = [
  {
    id: "HSP-101",
    title: "HSP-101 Roof helicopter review",
    location: "Roof helipad",
    eye: [27.0, -139.0, 221.0],
    look: [42.0, -107.0, 202.0],
    up: [0, 0, 1],
    fov: 14
  },
  {
    id: "HSP-118",
    title: "HSP-118 Ward facade context",
    location: "North patient wing",
    eye: [32.0, 62.0, 190.0],
    look: [40.0, -12.0, 178.0],
    up: [0, 0, 1],
    fov: 30
  },
  {
    id: "HSP-136",
    title: "HSP-136 Plant deck clearance",
    location: "Roof services",
    eye: [44.0, -82.0, 252.0],
    look: [44.0, -86.0, 196.0],
    up: [0, 1, 0],
    fov: 26
  },
  {
    id: "HSP-149",
    title: "HSP-149 Service yard sightline",
    location: "East loading bay",
    eye: [144.0, -48.0, 188.0],
    look: [82.0, -54.0, 176.0],
    up: [0, 0, 1],
    fov: 24
  },
  {
    id: "HSP-164",
    title: "HSP-164 Lab block tie-in",
    location: "South clinical wing",
    eye: [-72.0, -84.0, 188.0],
    look: [6.0, -94.0, 176.0],
    up: [0, 0, 1],
    fov: 28
  },
  {
    id: "HSP-190",
    title: "HSP-190 Whole-campus sweep",
    location: "Coordination overview",
    badge: "loads broad context",
    eye: [-96.0, -242.0, 232.0],
    look: [42.0, -82.0, 181.0],
    up: [0, 0, 1],
    fov: 44
  }
];

const INITIAL_VIEWPOINT = REVIEW_VIEWPOINTS[0];

sdkProgress.setPhase("Booting hospital static stream");

const studio = new xeokit.studio.Studio({
  maxViews: 1
});
const issueCards = createIssueCards(document.getElementById("issueCards"), REVIEW_VIEWPOINTS);

sdkProgress.setPhase("Preparing Studio");
studio.init().then(async () => {
  const {scene} = studio;

  const view = studio.viewManager.createView({
    id: "demoView",
    adaptiveQuality: true,
    backgroundColor: [0.88, 0.92, 0.94],
    effects: {
      edges: {
        enabled: true,
        useMeshColor: true,
        edgeDarken: 0.9,
        edgeAlpha: 0.74,
        edgeWidth: 1
      },
      sky: {
        enabled: true,
        skyColor: [0.74, 0.84, 0.88],
        horizonColor: [0.91, 0.95, 0.96],
        groundColor: [0.88, 0.88, 0.82],
        blend: 0.48,
        intensity: 0.92
      }
    },
    camera: {
      perspectiveProjection: {fov: INITIAL_VIEWPOINT.fov},
      eye: INITIAL_VIEWPOINT.eye,
      look: INITIAL_VIEWPOINT.look,
      up: INITIAL_VIEWPOINT.up
    }
  });
  view.linesMaterial.lineWidth = 1.5;
  view.linesMaterial.joinStyle = "round";

  const ui = {
    loadedChunks: document.getElementById("loadedChunks"),
    chunkTarget: document.getElementById("chunkTarget"),
    objectCount: document.getElementById("objectCount"),
    objectTarget: document.getElementById("objectTarget"),
    objectProgressGauge: document.getElementById("objectProgressGauge"),
    objectProgressPercent: document.getElementById("objectProgressPercent"),
    meshCount: document.getElementById("meshCount"),
    stallStreamingToggle: document.getElementById("stallStreamingToggle"),
    viewpointMotionToggle: document.getElementById("viewpointMotionToggle"),
    signalFrustumLoaded: createInitialFrustumReadyHandler(studio),
    viewpointProgress: null,
    objectTotal: 0
  };

  try {
    setStreamPreparing(ui, "Preparing stream index");
    const index = await fetchStreamingIndex(INDEX_URL);
    ui.objectTotal = countReferenceObjects(index);
    ui.objectTarget.textContent = `/ ${formatInt(ui.objectTotal)}`;
    updateObjectProgressGauge(ui, 0);
    setStreamPreparing(ui, "Scheduling first frustum");
    const sceneModel = must(scene.createModel({
      id: MODEL_ID,
      updateHint: "static",
      coordinateSystem: index.coordinateSystem
    }));
    sceneModel.building = true;
    const loader = new xeokit.formats.xgfstream.XGFStreamingLoader();
    let renderScheduled = false;
    let streamController;
    let initialPublishDone = false;
    const suspendStreamRender = () => {
      if (!sceneModel.building) {
        sceneModel.building = true;
      }
    };
    const publishStreamRender = (progress) => {
      if (!progress || progress.queued <= 0 || progress.loaded < progress.queued) {
        return;
      }
      if (sceneModel.building) {
        sceneModel.building = false;
      }
      if (!initialPublishDone) {
        initialPublishDone = true;
        demoCanvas.style.visibility = "visible";
      }
      view.needsRender();
    };
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
      progressCadenceMs: STREAM_PROGRESS_CADENCE_MS,
      frustumOnly: AUTO_LOAD_FRUSTUM_CHUNKS_ONLY,
      cameraDebounceMs: CAMERA_DEBOUNCE_MS,
      enableLRUEviction: ENABLE_LRU_CHUNK_EVICTION,
      maxResidentChunks: MAX_RESIDENT_REFERENCE_CHUNKS,
      cacheFileData: CACHE_XGF_FILE_BYTES,
      maxCachedFileBytes: MAX_CACHED_XGF_FILE_BYTES,
      onProgress: (progress) => {
        publishStreamRender(progress);
        scheduleRender();
      },
      onChunksLoading: () => {
        suspendStreamRender();
        hideStartupSpinner();
      },
      onError: (error) => {
        if (sceneModel.building) {
          sceneModel.building = false;
        }
        demoCanvas.style.visibility = "visible";
        console.error(error);
        scheduleRender();
      }
    });
    ui.viewpointProgress = createViewpointLoadProgressTracker(view, issueCards, streamController, REVIEW_VIEWPOINTS);

    streamController.prefetchInitial(AUTO_BATCH_SIZE * 2);

    hideStartupSpinner();
    streamController.schedule("Current frustum");
    render(ui, streamController);
    window[GLOBAL_EXAMPLE_NAME] = {
      studio,
      view,
      streamController
    };
    const cameraStreaming = bindCameraStreaming(studio, view, streamController, ui.stallStreamingToggle);
    const getViewpointMotion = bindViewpointMotionToggle(ui.viewpointMotionToggle);
    const cameraFlight = studio.viewManager.views?.[view.id]?.cameraFlight;
    bindIssueCards(view, issueCards, cameraStreaming, cameraFlight, getViewpointMotion);
  } catch (error) {
    demoCanvas.style.visibility = "visible";
    console.error(error);
  }
});

async function fetchStreamingIndex(url) {
  const runtimeIndex = await fetchJSON(url);
  const result = xeokit.formats.xgfstream.readXGFStreamingRuntimeIndex(runtimeIndex);
  if (!result.ok) {
    throw new Error(result.error);
  }
  return normalizeHospitalIndexAABBs(resolveIndexRelativeChunkUris(result.value, url));
}

function resolveIndexRelativeChunkUris(index, indexUrl) {
  const baseUrl = new URL(".", new URL(indexUrl, window.location.href)).href;
  const resolveChunkUri = (manifest) => {
    return {
      ...manifest,
      uri: resolveUri(manifest.uri, baseUrl),
      dependencies: {
        ...manifest.dependencies,
        chunks: (manifest.dependencies?.chunks || []).map((dependency) => ({
          ...dependency,
          uri: resolveUri(dependency.uri, baseUrl)
        }))
      }
    };
  };
  return {
    ...index,
    chunks: index.chunks.map(resolveChunkUri)
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

function normalizeHospitalIndexAABBs(index) {
  return {
    ...index,
    aabb: swapHospitalYZAABB(index.aabb),
    chunks: index.chunks.map((manifest) => ({
      ...manifest,
      aabb: swapHospitalYZAABB(manifest.aabb)
    })),
    streams: index.streams?.map((stream) => ({
      ...stream,
      aabb: swapHospitalYZAABB(stream.aabb)
    }))
  };
}

function swapHospitalYZAABB(aabb) {
  if (!Array.isArray(aabb) || aabb.length !== 6) {
    return aabb;
  }
  return [
    aabb[0],
    aabb[2],
    aabb[1],
    aabb[3],
    aabb[5],
    aabb[4]
  ];
}

function render(ui, streamController) {
  const queueProgress = streamController.queueProgress;
  ui.loadedChunks.textContent = formatInt(streamController.loadedChunkIds.size);
  ui.chunkTarget.textContent = `/ ${formatInt(streamController.chunkManifests.length)}`;
  ui.objectCount.textContent = formatInt(streamController.loadedTotals.objects);
  ui.meshCount.textContent = formatInt(streamController.loadedTotals.meshes);
  updateObjectProgressGauge(ui, streamController.loadedTotals.objects);
  ui.viewpointProgress?.update(streamController.loadedChunkIds);
  if (queueProgress && queueProgress.loaded >= queueProgress.queued) {
    ui.signalFrustumLoaded?.(queueProgress);
  }
}

function updateObjectProgressGauge(ui, loadedObjects) {
  const total = Math.max(ui.objectTotal || 0, 0);
  const loaded = Math.max(0, Math.min(loadedObjects || 0, total));
  const progress = total > 0 ? clampPercentage((loaded / total) * 100) : 0;
  if (ui.objectProgressGauge) {
    ui.objectProgressGauge.max = String(Math.max(total, 1));
    ui.objectProgressGauge.value = String(loaded);
    ui.objectProgressGauge.style.setProperty("--progress", `${progress}%`);
  }
  if (ui.objectProgressPercent) {
    ui.objectProgressPercent.textContent = `${Math.round(progress)}%`;
  }
}

function createViewpointLoadProgressTracker(view, cards, streamController, viewpoints) {
  const cardById = new Map(cards.map((card) => [card.dataset.issueId, card]));
  const cameraState = captureCameraState(view);
  const targetsById = new Map();

  for (const viewpoint of viewpoints) {
    applyIssueViewpointToCamera(view, viewpoint);
    const targetChunkIds = streamController.chunkManifests
      .filter((manifest) => isAABBVisibleFromCamera(view.camera, manifest.aabb))
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

function clampPercentage(value) {
  return Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
}

function countReferenceObjects(index) {
  return (index.chunks || []).reduce((total, manifest) => {
    return manifest.role === "referencesOnly"
      ? total + (manifest.counts?.objects || 0)
      : total;
  }, 0);
}

function setStreamPreparing(ui, label) {
  sdkProgress.setPhase(label);
}

function hideStartupSpinner() {
  const overlay = document.getElementById("xeokit-boot-loading-overlay");
  if (overlay) {
    overlay.style.display = "none";
  }
}

function bindCameraStreaming(studio, view, streamController, stallStreamingToggle) {
  let resumeTimer;
  let settledStreamLabel;
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
        settledStreamLabel = undefined;
        if (streamController.paused) {
          streamController.resume("Camera stream");
        } else {
          streamController.schedule("Camera stream");
        }
      }
    });
  }

  const scheduleCameraStream = (label = "Camera stream") => {
    updateDepthOfFieldFocus(view);
    if (!stallStreamingWhileMoving) {
      settledStreamLabel = undefined;
      streamController.schedule(label);
      return;
    }
    const resumeLabel = settledStreamLabel || label;
    streamController.pause();
    clearResumeTimer();
    resumeTimer = window.setTimeout(() => {
      resumeTimer = undefined;
      settledStreamLabel = undefined;
      streamController.resume(resumeLabel);
    }, STREAM_RESUME_AFTER_CAMERA_IDLE_MS);
  };

  const onCamera = (target) => {
    if (target === view || target === view.camera) {
      scheduleCameraStream(settledStreamLabel || "Camera settled");
    }
  };
  studio.viewer.events.onCameraViewMatrixUpdated.subscribe(onCamera);
  studio.viewer.events.onCameraProjMatrixUpdated.subscribe(onCamera);

  return {
    schedule: scheduleCameraStream,
    preferSettledLabel: (label) => {
      settledStreamLabel = label;
    }
  };
}

function bindViewpointMotionToggle(viewpointMotionToggle) {
  let viewpointMotion = readPersistentChoice(
    VIEWPOINT_MOTION_STORAGE_KEY,
    DEFAULT_VIEWPOINT_MOTION,
    ["jump", "fly"]
  );

  const updateButton = () => {
    if (!viewpointMotionToggle) {
      return;
    }
    viewpointMotionToggle.checked = viewpointMotion === "fly";
  };

  if (viewpointMotionToggle) {
    updateButton();
    viewpointMotionToggle.addEventListener("change", () => {
      viewpointMotion = viewpointMotionToggle.checked ? "fly" : "jump";
      writePersistentChoice(VIEWPOINT_MOTION_STORAGE_KEY, viewpointMotion);
      updateButton();
    });
  }

  return () => viewpointMotion;
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

function readPersistentChoice(key, fallback, choices) {
  try {
    const value = window.localStorage.getItem(key);
    if (choices.includes(value)) {
      return value;
    }
  } catch (error) {
    // Ignore blocked storage and keep the example usable.
  }
  return fallback;
}

function writePersistentChoice(key, value) {
  try {
    window.localStorage.setItem(key, value);
  } catch (error) {
    // Ignore blocked storage and keep the in-memory toggle usable.
  }
}

function bindIssueCards(view, cards, cameraStreaming, cameraFlight, getViewpointMotion) {
  const viewpoints = new Map(REVIEW_VIEWPOINTS.map((issue) => [issue.id, issue]));

  const setActive = (activeId) => {
    for (const card of cards) {
      card.setAttribute("aria-pressed", card.dataset.issueId === activeId ? "true" : "false");
    }
  };

  setActive(INITIAL_VIEWPOINT.id);

  for (const card of cards) {
    card.addEventListener("click", () => {
      const issue = viewpoints.get(card.dataset.issueId);
      if (!issue) {
        return;
      }
      setActive(issue.id);
      cameraStreaming.preferSettledLabel(issue.id);
      if (getViewpointMotion() === "fly" && cameraFlight && typeof cameraFlight.flyTo === "function") {
        applyIssueProjection(view, issue);
        cameraFlight.flyTo({
          eye: issue.eye,
          look: issue.look,
          up: issue.up,
          duration: 0.9
        });
      } else {
        applyIssueViewpointToCamera(view, issue);
      }
      cameraStreaming.schedule(issue.id);
    });
  }
}

function applyIssueViewpointToCamera(view, issue) {
  applyIssueProjection(view, issue);
  view.camera.eye = issue.eye;
  view.camera.look = issue.look;
  view.camera.up = issue.up;
}

function applyIssueProjection(view, issue) {
  view.camera.perspectiveProjection.fov = issue.fov || 34;
}

function updateDepthOfFieldFocus(view) {
  if (!view.effects.depthOfField) {
    return;
  }
  view.effects.depthOfField.focusDistance = getPointDistance(view.camera.eye, view.camera.look);
}

function getPointDistance(a, b) {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  const dz = a[2] - b[2];
  return Math.max(1, Math.hypot(dx, dy, dz));
}

function createIssueCards(container, issues) {
  if (!container) {
    return [];
  }
  container.replaceChildren();
  return issues.map((issue) => {
    const card = document.createElement("button");
    card.className = "issue-card";
    card.type = "button";
    card.dataset.issueId = issue.id;
    card.setAttribute("aria-pressed", "false");

    const title = document.createElement("strong");
    title.textContent = issue.title;

    const location = document.createElement("span");
    location.textContent = issue.location;

    card.append(title, location);
    if (issue.badge) {
      const badge = document.createElement("em");
      badge.textContent = issue.badge;
      card.append(badge);
    }
    container.append(card);
    return card;
  });
}

function createInitialFrustumReadyHandler(studio) {
  let signaled = false;
  return (progress) => {
    if (signaled || !progress || progress.queued <= 0) {
      return;
    }
    signaled = true;
    signalReady();
    studio.finished();
  };
}

async function fetchJSON(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} fetching ${url}`);
  }
  return response.json();
}

function formatInt(value) {
  return new Intl.NumberFormat().format(value || 0);
}

function must(result) {
  if (!result.ok) {
    throw new Error(result.error);
  }
  return result.value;
}

function signalReady() {
  document.body.classList.add("xeokit-loading-spinner-ready");
  const exampleMarker = document.createElement("div");
  exampleMarker.id = "ExampleLoaded";
  exampleMarker.hidden = true;
  document.body.appendChild(exampleMarker);

  const marker = document.createElement("div");
  marker.id = READY_MARKER_ID;
  marker.hidden = true;
  document.body.appendChild(marker);
}
