import {sdkProgress} from "@xeokit/sdk/base/core";
import {LinesPrimitive} from "@xeokit/sdk/base/constants";
import {getAABB3Center} from "@xeokit/sdk/base/math/boundaries";
import {XGFStreamingLoader, XGFViewStreamController, readXGFStreamingRuntimeIndex} from "@xeokit/sdk/formats/xgfstream";
import {Scene} from "@xeokit/sdk/model/scene";
import {ModelNavigationController} from "@xeokit/sdk/viewing/navigation/model";
import {WebGPURenderer} from "@xeokit/sdk/viewing/renderers/webGPU";
import {CameraFlightAnimation} from "@xeokit/sdk/viewing/cameraFlight";
import {AmbientLight, DirLight, Viewer} from "@xeokit/sdk/viewing/viewer";
const INDEX_URL = "../../../../models/BakuStadium_xgfstream_2000/xgfstream/index.runtime.json";
const MODEL_ID = "BakuStadium_xgfstream_2000";
const THUMBNAIL_BASE_URL = "bcf_thumbnails/";
const GLOBAL_EXAMPLE_NAME = "bakuStreamingDynamicExample";
const READY_MARKER_ID = "XGFStreamingBakuDynamicReady";
const AUTO_BATCH_SIZE = 4;
const FETCH_CONCURRENCY = 2;
const CHUNK_COMMIT_FRAME_BUDGET_MS = 0;
const AUTO_LOAD_FRUSTUM_CHUNKS_ONLY = true;
const MIN_PROJECTED_CHUNK_SIZE_PIXELS = 3;
const CAMERA_DEBOUNCE_MS = 140;
const STREAM_RESUME_AFTER_CAMERA_IDLE_MS = 500;
const STREAM_STALL_STORAGE_KEY = "xeokit.benchmarks.streaming.xgfBaku2000Dynamic.stallStreamingWhileMoving";
const DEFAULT_STALL_STREAMING_WHILE_MOVING = true;
const VIEWPOINT_MOTION_STORAGE_KEY = "xeokit.benchmarks.streaming.xgfBaku2000Dynamic.viewpointMotion";
const DEFAULT_VIEWPOINT_MOTION = "jump";
const SHOW_CHUNK_AABB_PLACEHOLDERS = false;
const ENABLE_LRU_CHUNK_EVICTION = false;
const MAX_RESIDENT_REFERENCE_CHUNKS = 160;
const CACHE_XGF_FILE_BYTES = false;
const MAX_CACHED_XGF_FILE_BYTES = 64 * 1024 * 1024;
const WEBGPU_LOW_MEMORY_CONFIG = {
  deviceDescriptor: {
    requiredLimits: {
      maxStorageBufferBindingSize: 256 * 1024 * 1024
    }
  },
  memoryConfigs: {
    maxBatches: 48,
    maxBatchVertices: 45000,
    maxBatchIndices: 135000,
    maxBatchPrims: 45000,
    maxBatchGeometries: 1536,
    maxBatchMeshes: 1536,
    maxTiles: 512,
    compactStreamPages: true,
    compactSealedStreamPages: true
  },
  renderConfigs: {
    triangleColorMode: "flat",
    edges: false,
    depthPrepass: false
  }
};
const URL_PARAMS = new URLSearchParams(window.location.search);
const BACKPRESSURE_ENABLED = URL_PARAMS.get("backpressure") !== "0";
const BACKPRESSURE_PAUSE_PENDING_SEGMENTS = getPositiveNumberParam("pausePendingSegments", 48);
const BACKPRESSURE_RESUME_PENDING_SEGMENTS = getPositiveNumberParam("resumePendingSegments", 16);
const BACKPRESSURE_CHECK_INTERVAL_MS = getPositiveNumberParam("backpressureIntervalMs", 250);

const ISSUE_VIEWPOINTS = [
  {
    id: "BCF-104",
    title: "BCF-104 Roof fascia alignment",
    location: "North-west upper bowl",
    thumbnail: thumbnailPath("bcf1.png"),
    eye: [-67.758029954453, 116.28819447116898, 46.988969794820974],
    look: [-75.49979296614576, 118.42809562305348, 44.850213625916695],
    up: [-0.2480113366021941, 0.06855282911155025, 0.9663285603445629],
    fov: 30
  },
  {
    id: "BCF-117",
    title: "BCF-117 Vomitory clearance",
    location: "East concourse entry",
    thumbnail: thumbnailPath("bcf2.png"),
    eye: [29.61664392850329, 146.72176151703428, 34.50117094096517],
    look: [33.44290902516772, 134.440902523504, 35.63148850974416],
    up: [-0.026038308211035463, 0.08357308676959636, 0.9961614054325275],
    fov: 28
  },
  {
    id: "BCF-132",
    title: "BCF-132 Seating rail clash",
    location: "South lower stands",
    thumbnail: thumbnailPath("bcf3.png"),
    eye: [82.4, -116.8, 37.5],
    look: [58.6, -83.2, 28.0],
    up: [-0.12, 0.04, 0.99],
    fov: 26
  },
  {
    id: "BCF-148",
    title: "BCF-148 Lighting gantry review",
    location: "Pitch-side roof span",
    thumbnail: thumbnailPath("bcf4.png"),
    eye: [-118.0, -52.0, 57.0],
    look: [-61.0, -18.0, 35.0],
    up: [0.17, 0.06, 0.98],
    fov: 34
  },
  {
    id: "BCF-163",
    title: "BCF-163 Stair nosing clearance",
    location: "Upper vomitory landing",
    thumbnail: thumbnailPath("bcf5.png"),
    eye: [-21.5, 93.0, 15.0],
    look: [-14.008854703985323, 82.06585734480107, 8.465009958148896],
    up: [0.05, -0.04, 0.998],
    fov: 18
  },
  {
    id: "BCF-171",
    title: "BCF-171 Roof truss node review",
    location: "South-east canopy bay",
    thumbnail: thumbnailPath("bcf6.png"),
    eye: [78.0, -93.0, 61.5],
    look: [88.0133586418172, -79.91252417174502, 55.29589473829266],
    up: [-0.09, 0.03, 0.996],
    fov: 18
  },
  {
    id: "BCF-184",
    title: "BCF-184 Drain cover setout",
    location: "Lower service trench",
    thumbnail: thumbnailPath("bcf7.png"),
    eye: [-31.5, -87.0, 14.5],
    look: [-21.345202328392634, -76.98205966388278, 8.012541779710428],
    up: [0.04, 0.02, 0.999],
    fov: 18
  },
  {
    id: "BCF-196",
    title: "BCF-196 Coordination context review",
    location: "North-west roof cluster",
    thumbnail: thumbnailPath("bcf8.png"),
    badge: "loads broad context",
    eye: [-158.0, -42.0, 74.0],
    look: [-128.05097674666933, -12.118816326439152, 52.119495073629665],
    up: [0.28, 0.16, 0.95],
    fov: 48
  }
];

const INITIAL_VIEWPOINT = ISSUE_VIEWPOINTS[0];

const UNIT_BOX_POSITIONS = [
  -0.5, -0.5,  0.5,
   0.5, -0.5,  0.5,
   0.5,  0.5,  0.5,
  -0.5,  0.5,  0.5,
  -0.5, -0.5, -0.5,
   0.5, -0.5, -0.5,
   0.5,  0.5, -0.5,
  -0.5,  0.5, -0.5
];

const UNIT_BOX_LINE_INDICES = [
  0, 1,
  1, 2,
  2, 3,
  3, 0,
  4, 5,
  5, 6,
  6, 7,
  7, 4,
  0, 4,
  1, 5,
  2, 6,
  3, 7
];

sdkProgress.setPhase("Booting Baku dynamic stream");

const issueCards = createIssueCards(document.getElementById("issueCards"), ISSUE_VIEWPOINTS);

main().catch((error) => {
  console.error(error);
});

async function main() {
  if (!navigator.gpu) {
    throw new Error("This browser does not expose navigator.gpu. Use a WebGPU-enabled browser to run this example.");
  }

  sdkProgress.setPhase("Preparing viewer");
  const canvas = document.getElementById("demoCanvas");
  const scene = new Scene({logging: false});
  const viewer = new Viewer({scene, logging: false});

  // One View owns the camera and stream chunk selection below.
  const view = must(viewer.createView({
    id: "demoView",
    htmlElement: canvas,
    adaptiveQuality: false,
    backgroundColor: [0.24, 0.34, 0.5],
    resolutionScale: {
      enabled: false,
      resolutionScale: 1
    },
    effects: {
      sao: {
        enabled: false
      },
      ibl: {
        enabled: false
      },
      edges: {
        enabled: false,
        useMeshColor: true,
        edgeDarken: 0.45,
        edgeAlpha: 0.85,
        edgeWidth: 1
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
      antiAliasing: {
        enabled: false
      },
      sky: {
        enabled: true,
        skyColor: [0.28, 0.45, 0.66],
        horizonColor: [0.58, 0.68, 0.76],
        groundColor: [0.56, 0.58, 0.55],
        horizonBlend: 0.42,
        sunGlowIntensity: 0.12
      }
    },
    camera: {
      perspectiveProjection: {fov: INITIAL_VIEWPOINT.fov},
      eye: INITIAL_VIEWPOINT.eye,
      look: INITIAL_VIEWPOINT.look,
      up: INITIAL_VIEWPOINT.up
    }
  }));

  configureFastBakuLighting(view);
  enforceFastBakuRendering(view);
  const inputController = new ModelNavigationController(view, {
    followPointer: false,
    rotationInertia: 0,
    panInertia: 0,
    dollyInertia: 0,
    doublePickFlyTo: false,
    keyboardDollyRate: 80,
    keyboardPanRate: 50,
    mouseWheelDollyRate: 420,
    touchDollyRate: 0.22
  });
  const cameraFlight = new CameraFlightAnimation(view, {duration: 0.9});

  sdkProgress.setPhase("Preparing WebGPU");
  const rendererResult = await WebGPURenderer.create({
    viewer,
    logging: false,
    deviceDescriptor: WEBGPU_LOW_MEMORY_CONFIG.deviceDescriptor,
    memoryConfigs: WEBGPU_LOW_MEMORY_CONFIG.memoryConfigs,
    renderConfigs: WEBGPU_LOW_MEMORY_CONFIG.renderConfigs
  });
  if (!rendererResult.ok) {
    throw new Error(rendererResult.error);
  }
  const renderer = rendererResult.value;
  must(renderer.setInfiniteGridEnabled(true));
  renderer.events.onError.subscribe((_renderer, error) => {
    console.error(error.error);
  });

  view.linesMaterial.lineWidth = 1.75;
  view.linesMaterial.joinStyle = "round";

  const ui = {
    loadedChunks: document.getElementById("loadedChunks"),
    chunkTarget: document.getElementById("chunkTarget"),
    objectCount: document.getElementById("objectCount"),
    objectTarget: document.getElementById("objectTarget"),
    meshCount: document.getElementById("meshCount"),
    frustumQueue: document.querySelector(".queue-progress"),
    frustumQueueLabel: document.getElementById("frustumQueueLabel"),
    frustumQueueProgress: document.getElementById("frustumQueueProgress"),
    stallStreamingToggle: document.getElementById("stallStreamingToggle"),
    viewpointMotionToggle: document.getElementById("viewpointMotionToggle"),
    signalFrustumLoaded: createInitialFrustumReadyHandler()
  };

  try {
    setStreamPreparing(ui, "Preparing stream index");
    // The compact runtime index contains scheduling and dependency metadata.
    // The full chunks/index.json remains available for debugging/tooling.
    const index = await fetchStreamingIndex(INDEX_URL);
    ui.objectTarget.textContent = `/ ${formatInt(countReferenceObjects(index))}`;
    setStreamPreparing(ui, "Scheduling first frustum");
    const sceneModel = must(scene.createModel({
      id: MODEL_ID,
      updateHint: "dynamic",
      // Use the runtime index coordinate system so the benchmark loads the
      // streamed Baku chunks in their authored frame.
      coordinateSystem: index.coordinateSystem
    }));
    const loader = new XGFStreamingLoader();
    let renderScheduled = false;
    let streamController;
    const renderInspector = getOptionalRenderInspector(renderer);
    if (renderInspector) {
      renderInspector.enabled = true;
    }
    const backpressureState = {
      enabled: BACKPRESSURE_ENABLED,
      paused: false,
      pauseCount: 0,
      lastPendingSegments: 0,
      pausePendingSegments: BACKPRESSURE_PAUSE_PENDING_SEGMENTS,
      resumePendingSegments: BACKPRESSURE_RESUME_PENDING_SEGMENTS
    };
    let chunkPlaceholderObjectIds = new Map();
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
    const hideChunkPlaceholders = (chunkManifests) => {
      const objectIds = chunkManifests
        .map((manifest) => chunkPlaceholderObjectIds.get(manifest.id))
        .filter((objectId) => objectId !== undefined);
      if (objectIds.length > 0) {
        view.setObjectsVisible(objectIds, false);
      }
    };
    const getCurrentFrameStats = () => {
      const viewIndex = view.viewIndex ?? 0;
      return renderInspector?.renderStats?.views?.[viewIndex] || null;
    };
    const getPendingSegments = () => {
      const pendingSegments = getCurrentFrameStats()?.numPendingSegments ?? 0;
      backpressureState.lastPendingSegments = pendingSegments;
      return pendingSegments;
    };
    const updateStreamingBackpressure = () => {
      if (!BACKPRESSURE_ENABLED || !streamController) {
        return;
      }
      streamController.updateBackpressure("Renderer backpressure");
    };

    // The streaming loader automatically loads missing dependency chunks
    // declared in the manifest. Here that means the shared Baku asset library
    // is fetched once before the first references-only chunk is applied.
    streamController = new XGFViewStreamController({
      index,
      loader,
      sceneModel,
      view,
      batchSize: AUTO_BATCH_SIZE,
      fetchConcurrency: FETCH_CONCURRENCY,
      commitFrameBudgetMs: CHUNK_COMMIT_FRAME_BUDGET_MS,
      frustumOnly: AUTO_LOAD_FRUSTUM_CHUNKS_ONLY,
      minProjectedChunkSizePixels: MIN_PROJECTED_CHUNK_SIZE_PIXELS,
      cameraDebounceMs: CAMERA_DEBOUNCE_MS,
      enableLRUEviction: ENABLE_LRU_CHUNK_EVICTION,
      maxResidentChunks: MAX_RESIDENT_REFERENCE_CHUNKS,
      cacheFileData: CACHE_XGF_FILE_BYTES,
      maxCachedFileBytes: MAX_CACHED_XGF_FILE_BYTES,
      backpressure: BACKPRESSURE_ENABLED ? {
        shouldPause: () => getPendingSegments() >= BACKPRESSURE_PAUSE_PENDING_SEGMENTS,
        shouldResume: () => getPendingSegments() <= BACKPRESSURE_RESUME_PENDING_SEGMENTS,
        onPause: () => {
          backpressureState.paused = true;
          backpressureState.pauseCount++;
          scheduleRender();
        },
        onResume: () => {
          backpressureState.paused = false;
          scheduleRender();
        }
      } : undefined,
      onProgress: (progress) => {
        scheduleRender();
      },
      onChunksLoading: (chunkManifests) => {
        hideStartupSpinner();
        hideChunkPlaceholders(chunkManifests);
      },
      onError: (error) => {
        console.error(error);
        scheduleRender();
      }
    });

    chunkPlaceholderObjectIds = SHOW_CHUNK_AABB_PLACEHOLDERS
      ? createChunkAABBPlaceholders(scene, streamController.chunkManifests)
      : new Map();

    streamController.prefetchInitial(AUTO_BATCH_SIZE * 2);

    hideStartupSpinner();
    streamController.schedule("Current frustum");
    const rendererEvents = renderer.events;
    rendererEvents?.onViewRendered?.subscribe?.(updateStreamingBackpressure);
    if (BACKPRESSURE_ENABLED) {
      window.setInterval(updateStreamingBackpressure, BACKPRESSURE_CHECK_INTERVAL_MS);
    }
    render(ui, streamController);
    window[GLOBAL_EXAMPLE_NAME] = {
      scene,
      viewer,
      renderer,
      picker,
      inputController,
      view,
      streamController,
      renderInspector,
      issueViewpoints: ISSUE_VIEWPOINTS,
      applyIssueViewpoint: (issueId, scheduleStream = false) => {
        const issue = ISSUE_VIEWPOINTS.find((candidate) => candidate.id === issueId);
        if (!issue) {
          return false;
        }
        applyIssueViewpointToCamera(view, issue);
        updateDepthOfFieldFocus(view);
        if (scheduleStream) {
          streamController.schedule(issue.id);
        }
        return true;
      },
      backpressure: backpressureState
    };
    const cameraStreaming = bindCameraStreaming(viewer, view, streamController, ui.stallStreamingToggle);
    const getViewpointMotion = bindViewpointMotionToggle(ui.viewpointMotionToggle);
    bindIssueCards(view, issueCards, cameraStreaming, cameraFlight, getViewpointMotion);
  } catch (error) {
    console.error(error);
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

function getOptionalRenderInspector(renderer) {
  if (!renderer?.getRenderInspector) {
    return null;
  }
  const previousLogging = renderer.logging;
  renderer.logging = false;
  try {
    const result = renderer.getRenderInspector();
    return result?.ok ? result.value : null;
  } finally {
    renderer.logging = previousLogging;
  }
}

function render(ui, streamController) {
  const queueProgress = streamController.queueProgress;
  ui.loadedChunks.textContent = formatInt(streamController.loadedChunkIds.size);
  ui.chunkTarget.textContent = `/ ${formatInt(streamController.chunkManifests.length)}`;
  ui.objectCount.textContent = formatInt(streamController.loadedTotals.objects);
  ui.meshCount.textContent = formatInt(streamController.loadedTotals.meshes);
  if (ui.frustumQueueProgress && queueProgress) {
    ui.frustumQueue?.removeAttribute("data-mode");
    ui.frustumQueueProgress.max = String(Math.max(queueProgress.queued, 1));
    ui.frustumQueueProgress.value = String(queueProgress.loaded);
    const progress = queueProgress.queued > 0 ? (queueProgress.loaded / queueProgress.queued) * 100 : 0;
    ui.frustumQueueProgress.style.setProperty("--progress", `${Math.max(0, Math.min(100, progress))}%`);
    if (queueProgress.queued === 0 || queueProgress.loaded >= queueProgress.queued) {
      ui.frustumQueueLabel.textContent = "Frustum loaded";
      ui.signalFrustumLoaded?.(queueProgress);
    } else {
      ui.frustumQueueLabel.textContent = `${formatInt(queueProgress.loaded)}/${formatInt(queueProgress.queued)} loaded`;
    }
  }
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
  ui.frustumQueue?.setAttribute("data-mode", "pending");
  if (ui.frustumQueueLabel) {
    ui.frustumQueueLabel.textContent = label;
  }
  if (ui.frustumQueueProgress) {
    ui.frustumQueueProgress.max = "1";
    ui.frustumQueueProgress.value = "0";
  }
}

function hideStartupSpinner() {
  const overlay = document.getElementById("xeokit-boot-loading-overlay");
  if (overlay) {
    overlay.style.display = "none";
  }
}

function bindCameraStreaming(viewer, view, streamController, stallStreamingToggle) {
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
  viewer.events.onCameraViewMatrixUpdated.subscribe(onCamera);
  viewer.events.onCameraProjMatrixUpdated.subscribe(onCamera);

  return {
    schedule: scheduleCameraStream,
    preferSettledLabel: (label) => {
      settledStreamLabel = label;
    }
  };
}

function thumbnailPath(fileName) {
  return `${THUMBNAIL_BASE_URL}${fileName}`;
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

function getPositiveNumberParam(name, fallback) {
  const value = Number(URL_PARAMS.get(name));
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function bindIssueCards(view, cards, cameraStreaming, cameraFlight, getViewpointMotion) {
  const viewpoints = new Map(ISSUE_VIEWPOINTS.map((issue) => [issue.id, issue]));

  const setActive = (activeId) => {
    for (const card of cards) {
      card.setAttribute("aria-pressed", card.dataset.issueId === activeId ? "true" : "false");
    }
  };

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
  if (!view.effects.depthOfField || !view.effects.depthOfField.enabled) {
    return;
  }
  view.effects.depthOfField.focusDistance = getPointDistance(view.camera.eye, view.camera.look);
}

function enforceFastBakuRendering(view) {
  const effects = view.effects || {};
  for (const effectId of [
    "sao",
    "shadows",
    "atmosphere",
    "bloom",
    "depthOfField",
    "colorGrading",
    "antiAliasing"
  ]) {
    if (effects[effectId]) {
      effects[effectId].enabled = false;
    }
  }
  if (effects.ibl) {
    effects.ibl.enabled = false;
    effects.ibl.intensity = 0;
  }
}

function configureFastBakuLighting(view) {
  for (const light of view.lightsList || []) {
    if (light._type === "ambient") {
      light.color = [1, 1, 1];
      light.intensity = 0.28;
    } else if (light.dir && light.space) {
      light.dir = [-0.8, -1.0, -0.5];
      light.color = [1, 1, 1];
      light.intensity = 0.82;
    }
  }
  if (view.lights?.hemispheric) {
    view.lights.hemispheric.enabled = false;
    view.lights.hemispheric.intensity = 0;
  }
}

function getViewpointFocusDistance(viewpoint) {
  return getPointDistance(viewpoint.eye, viewpoint.look);
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
    card.className = "issue-card has-thumbnail";
    card.type = "button";
    card.dataset.issueId = issue.id;
    card.setAttribute("aria-pressed", "false");

    const image = document.createElement("img");
    image.className = "issue-thumbnail";
    image.src = issue.thumbnail;
    image.width = 160;
    image.height = 106;
    image.alt = "";

    const title = document.createElement("strong");
    title.textContent = issue.title;

    const location = document.createElement("span");
    location.textContent = issue.location;

    card.append(image, title, location);
    if (issue.badge) {
      const badge = document.createElement("em");
      badge.textContent = issue.badge;
      card.append(badge);
    }
    container.append(card);
    return card;
  });
}

function createInitialFrustumReadyHandler() {
  let signaled = false;
  return (progress) => {
    if (signaled || !progress || progress.queued <= 0) {
      return;
    }
    signaled = true;
    signalReady();
  };
}

function createChunkAABBPlaceholders(scene, chunkManifests) {
  const placeholderObjectIds = new Map();
  const overlayModel = must(scene.createModel({id: `${MODEL_ID}ChunkAABBPlaceholders`}));
  must(overlayModel.createGeometry({
    id: "chunkAABBGeometry",
    primitive: LinesPrimitive,
    positions: UNIT_BOX_POSITIONS,
    indices: UNIT_BOX_LINE_INDICES
  }));
  for (const manifest of chunkManifests) {
    const aabb = manifest.worldAABB || manifest.aabb;
    if (!aabb) {
      continue;
    }
    const id = sanitizeChunkId(manifest.id);
    const meshId = `chunkAABBMesh_${id}`;
    const objectId = `chunkAABB_${id}`;
    const scale = [
      Math.max(aabb[3] - aabb[0], 0.001),
      Math.max(aabb[4] - aabb[1], 0.001),
      Math.max(aabb[5] - aabb[2], 0.001)
    ];
    must(overlayModel.createMesh({
      id: meshId,
      geometryId: "chunkAABBGeometry",
      color: [0.44, 0.58, 0.66],
      opacity: 0.72,
      position: getAABB3Center(aabb),
      scale
    }));
    must(overlayModel.createObject({
      id: objectId,
      meshIds: [meshId],
      clippable: false
    }));
    placeholderObjectIds.set(manifest.id, objectId);
  }
  return placeholderObjectIds;
}

function sanitizeChunkId(id) {
  return String(id).replace(/[^a-zA-Z0-9_]/g, "_");
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
