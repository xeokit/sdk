import * as xeokit from "../../js/xeokit-studio-bundle.js";

const {getAABB3Center} = xeokit.base.math.boundaries;
const MODEL_BASE = "../../models/OTCConferenceCenter";
const INDEX_URL = "./chunks/index.runtime.json";
const CHUNK_URI_BASE_URL = "./";
const AUTO_BATCH_SIZE = 8;
const FETCH_CONCURRENCY = 8;
const CHUNK_COMMIT_FRAME_BUDGET_MS = 0;
const AUTO_LOAD_FRUSTUM_CHUNKS_ONLY = true;
const CAMERA_DEBOUNCE_MS = 140;
const SHOW_CHUNK_AABB_PLACEHOLDERS = true;

const ISSUE_VIEWPOINTS = [
  {
    id: "BCF-OTC-021",
    "eye": [
      25.98144315599818,
      -62.721354276284536,
      6.596920890870261
    ],
    "look": [
      25.98163677621521,
      -62.6833928044587,
      0.24073831564443093
    ],
    "up": [
      0.005100283247012565,
      0.9999691586543038,
      0.005972340496297357
    ],
    fov: 60
  },
  {
    id: "BCF-OTC-034",
    eye: [2, -66, 34],
    look: [24, -43, 5],
    up: [0, 0, 1],
    fov: 38
  },
  {
    id: "BCF-OTC-047",
    eye: [18, -42, 38],
    look: [54, -29, 8],
    up: [0, 0, 1],
    fov: 40
  },
  {
    id: "BCF-OTC-058",
    eye: [112, -46, 32],
    look: [76, -30, 7],
    up: [0, 0, 1],
    fov: 36
  },
  {
    id: "BCF-OTC-063",
    eye: [91, 18, 42],
    look: [43, -8, 3],
    up: [0, 0, 1],
    fov: 42
  },
  {
    id: "BCF-OTC-079",
    eye: [139, -96, 72],
    look: [43, -31, 5],
    up: [0, 0, 1],
    fov: 52
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

const studio = new xeokit.studio.Studio({});

studio.init().then(async () => {
  const {scene, data} = studio;

  const view = studio.viewManager.createView({
    id: "demoView",
    adaptiveQuality: true,
    backgroundColor: [0.93, 0.95, 0.96],
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
    objectCount: document.getElementById("objectCount"),
    meshCount: document.getElementById("meshCount"),
    frustumQueueLabel: document.getElementById("frustumQueueLabel"),
    frustumQueueProgress: document.getElementById("frustumQueueProgress"),
    signalFrustumLoaded: createInitialFrustumReadyHandler(studio)
  };

  try {
    const index = await fetchStreamingIndex(INDEX_URL);
    const sceneModel = must(scene.createModel({
      id: "OTCConferenceCenter",
      updateHint: "dynamic",
      coordinateSystem: {
        basis: [1, 0, 0, 0, 1, 0, 0, 0, 1],
        origin: [0, 0, 0],
        units: "meters",
        scaleToMeters: 1
      }
    }));
    const dataModel = must(data.createModel({id: "OTCConferenceCenter"}));
    const loader = new xeokit.formats.xgfstream.XGFStreamingLoader();
    let renderScheduled = false;
    let streamController;
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

    await studio.loadModel({
      id: "OTCConferenceCenter",
      src: `${MODEL_BASE}/datamodel/model.json`,
      format: "datamodel",
      dataModel
    });

    streamController = new xeokit.formats.xgfstream.XGFViewStreamController({
      index,
      loader,
      sceneModel,
      view,
      batchSize: AUTO_BATCH_SIZE,
      fetchConcurrency: FETCH_CONCURRENCY,
      commitFrameBudgetMs: CHUNK_COMMIT_FRAME_BUDGET_MS,
      frustumOnly: AUTO_LOAD_FRUSTUM_CHUNKS_ONLY,
      cameraDebounceMs: CAMERA_DEBOUNCE_MS,
      onProgress: (progress) => {
        scheduleRender();
      },
      onChunksLoading: hideChunkPlaceholders,
      onError: (error) => {
        console.error(error);
        scheduleRender();
      }
    });
    window.otcStreamController = streamController;
    window.otcView = view;
    window.otcSceneModel = sceneModel;

    chunkPlaceholderObjectIds = SHOW_CHUNK_AABB_PLACEHOLDERS
      ? createChunkAABBPlaceholders(scene, streamController.chunkManifests)
      : new Map();

    render(ui, streamController);
    streamController.prefetchInitial(AUTO_BATCH_SIZE * 2);
    streamController.schedule("Current frustum");
    bindCameraStreaming(studio, view, streamController);
    bindIssueCards(studio, view, streamController);
  } catch (error) {
    console.error(error);
  }
});

async function fetchStreamingIndex(url) {
  const runtimeIndex = await fetchJSON(url);
  const result = xeokit.formats.xgfstream.readXGFStreamingRuntimeIndex(runtimeIndex);
  if (!result.ok) {
    throw new Error(result.error);
  }
  return resolveIndexRelativeChunkUris(result.value, CHUNK_URI_BASE_URL);
}

function resolveIndexRelativeChunkUris(index, chunkUriBaseUrl) {
  const baseUrl = new URL(chunkUriBaseUrl, window.location.href).href;
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

function render(ui, streamController) {
  const queueProgress = streamController.queueProgress;
  ui.loadedChunks.textContent = `${streamController.loadedChunkIds.size}/${streamController.chunkManifests.length}`;
  ui.objectCount.textContent = formatInt(streamController.loadedTotals.objects);
  ui.meshCount.textContent = formatInt(streamController.loadedTotals.meshes);
  if (ui.frustumQueueProgress && queueProgress) {
    ui.frustumQueueProgress.max = String(queueProgress.queued);
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

function bindCameraStreaming(studio, view, streamController) {
  const onCamera = (changedView) => {
    if (changedView === view) {
      streamController.schedule("Camera stream");
    }
  };
  studio.viewer.events.onCameraViewMatrixUpdated.subscribe(onCamera);
  studio.viewer.events.onCameraProjMatrixUpdated.subscribe(onCamera);
}

function bindIssueCards(studio, view, streamController) {
  const viewpoints = new Map(ISSUE_VIEWPOINTS.map((issue) => [issue.id, issue]));
  const cards = Array.from(document.querySelectorAll(".issue-card"));
  const cameraFlight = studio.viewManager.views?.[view.id]?.cameraFlight;

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
      view.camera.perspectiveProjection.fov = issue.fov || 34;
      if (cameraFlight && typeof cameraFlight.flyTo === "function") {
        cameraFlight.flyTo({
          eye: issue.eye,
          look: issue.look,
          up: issue.up,
          duration: 0.9
        });
      } else {
        view.camera.eye = issue.eye;
        view.camera.look = issue.look;
        view.camera.up = issue.up;
      }
      streamController.schedule(issue.id);
      window.setTimeout(() => streamController.schedule(`${issue.id} settled`), 950);
    });
  }
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

function createChunkAABBPlaceholders(scene, chunkManifests) {
  const placeholderObjectIds = new Map();
  const overlayModel = must(scene.createModel({id: "OTCChunkAABBPlaceholders"}));
  must(overlayModel.createGeometry({
    id: "chunkAABBGeometry",
    primitive: xeokit.base.constants.LinesPrimitive,
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
  const exampleMarker = document.createElement("div");
  exampleMarker.id = "ExampleLoaded";
  exampleMarker.hidden = true;
  document.body.appendChild(exampleMarker);

  const marker = document.createElement("div");
  marker.id = "XGFStreamingOTCReady";
  marker.hidden = true;
  document.body.appendChild(marker);
}
