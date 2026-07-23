import * as xeokit from "../../js/xeokit-studio-bundle.js";

const {getAABB3Center} = xeokit.base.math.boundaries;
const {sdkProgress} = xeokit.base.core;
const INDEX_URL = "../../models/BakuStadium/xgfstream/index.runtime.json";
const AUTO_BATCH_SIZE = 8;
const FETCH_CONCURRENCY = 8;
const CHUNK_COMMIT_FRAME_BUDGET_MS = 0;
const AUTO_LOAD_FRUSTUM_CHUNKS_ONLY = true;
const CAMERA_DEBOUNCE_MS = 140;
const SHOW_CHUNK_AABB_PLACEHOLDERS = false;
const ENABLE_LRU_CHUNK_EVICTION = false;
const MAX_RESIDENT_REFERENCE_CHUNKS = 600;
const CACHE_XGF_FILE_BYTES = true;
const MAX_CACHED_XGF_FILE_BYTES = 256 * 1024 * 1024;

const ISSUE_VIEWPOINTS = [
  {
    id: "BCF-104",
    title: "BCF-104 Roof fascia alignment",
    location: "North-west upper bowl",
    thumbnail: "bcf_thumbnails/bcf1.png",
    eye: [-67.758029954453, 116.28819447116898, 46.988969794820974],
    look: [-75.49979296614576, 118.42809562305348, 44.850213625916695],
    up: [-0.2480113366021941, 0.06855282911155025, 0.9663285603445629],
    fov: 30
  },
  {
    id: "BCF-117",
    title: "BCF-117 Vomitory clearance",
    location: "East concourse entry",
    thumbnail: "bcf_thumbnails/bcf2.png",
    eye: [29.61664392850329, 146.72176151703428, 34.50117094096517],
    look: [33.44290902516772, 134.440902523504, 35.63148850974416],
    up: [-0.026038308211035463, 0.08357308676959636, 0.9961614054325275],
    fov: 28
  },
  {
    id: "BCF-132",
    title: "BCF-132 Seating rail clash",
    location: "South lower stands",
    thumbnail: "bcf_thumbnails/bcf3.png",
    eye: [82.4, -116.8, 37.5],
    look: [58.6, -83.2, 28.0],
    up: [-0.12, 0.04, 0.99],
    fov: 26
  },
  {
    id: "BCF-148",
    title: "BCF-148 Lighting gantry review",
    location: "Pitch-side roof span",
    thumbnail: "bcf_thumbnails/bcf4.png",
    eye: [-118.0, -52.0, 57.0],
    look: [-61.0, -18.0, 35.0],
    up: [0.17, 0.06, 0.98],
    fov: 34
  },
  {
    id: "BCF-163",
    title: "BCF-163 Stair nosing clearance",
    location: "Upper vomitory landing",
    thumbnail: "bcf_thumbnails/bcf5.png",
    eye: [-21.5, 93.0, 15.0],
    look: [-14.008854703985323, 82.06585734480107, 8.465009958148896],
    up: [0.05, -0.04, 0.998],
    fov: 18
  },
  {
    id: "BCF-171",
    title: "BCF-171 Roof truss node review",
    location: "South-east canopy bay",
    thumbnail: "bcf_thumbnails/bcf6.png",
    eye: [78.0, -93.0, 61.5],
    look: [88.0133586418172, -79.91252417174502, 55.29589473829266],
    up: [-0.09, 0.03, 0.996],
    fov: 18
  },
  {
    id: "BCF-184",
    title: "BCF-184 Drain cover setout",
    location: "Lower service trench",
    thumbnail: "bcf_thumbnails/bcf7.png",
    eye: [-31.5, -87.0, 14.5],
    look: [-21.345202328392634, -76.98205966388278, 8.012541779710428],
    up: [0.04, 0.02, 0.999],
    fov: 18
  },
  {
    id: "BCF-196",
    title: "BCF-196 Coordination context review",
    location: "North-west roof cluster",
    thumbnail: "bcf_thumbnails/bcf8.png",
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

sdkProgress.setPhase("Booting Baku stream");

const studio = new xeokit.studio.Studio({});
const issueCards = createIssueCards(document.getElementById("issueCards"), ISSUE_VIEWPOINTS);

sdkProgress.setPhase("Preparing Studio");
studio.init().then(async () => {
  const {scene} = studio;

  // One View owns the camera and adaptive-quality policy. Chunk selection below
  // sorts manifests by distance from this camera.
  const view = studio.viewManager.createView({
    id: "demoView",
    adaptiveQuality: true,
    backgroundColor: [0.62, 0.79, 0.94],
    effects: {
      sky: {
        enabled: true,
        skyColor: [0.38, 0.64, 0.91],
        horizonColor: [0.78, 0.89, 0.97],
        groundColor: [0.86, 0.89, 0.86],
        blend: 0.55,
        intensity: 1.0
      }
    },
    camera: {
      perspectiveProjection: {fov: INITIAL_VIEWPOINT.fov},
      eye: INITIAL_VIEWPOINT.eye,
      look: INITIAL_VIEWPOINT.look,
      up: INITIAL_VIEWPOINT.up
    }
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
    signalFrustumLoaded: createInitialFrustumReadyHandler(studio)
  };

  try {
    setStreamPreparing(ui, "Preparing stream index");
    // The compact runtime index contains scheduling and dependency metadata.
    // The full chunks/index.json remains available for debugging/tooling.
    const index = await fetchStreamingIndex(INDEX_URL);
    ui.objectTarget.textContent = `/ ${formatInt(countReferenceObjects(index))}`;
    setStreamPreparing(ui, "Scheduling first frustum");
    const sceneModel = must(scene.createModel({
      id: "BakuStadium",
      coordinateSystem: {
        basis: [1, 0, 0, 0, 1, 0, 0, 0, 1],
        origin: [0, 0, 0],
        units: "meters",
        scaleToMeters: 1
      }
    }));
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

    // The streaming loader automatically loads missing dependency chunks
    // declared in the manifest. Here that means the shared Baku asset library
    // is fetched once before the first references-only chunk is applied.
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
      enableLRUEviction: ENABLE_LRU_CHUNK_EVICTION,
      maxResidentChunks: MAX_RESIDENT_REFERENCE_CHUNKS,
      cacheFileData: CACHE_XGF_FILE_BYTES,
      maxCachedFileBytes: MAX_CACHED_XGF_FILE_BYTES,
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
    render(ui, streamController);
    bindCameraStreaming(studio, view, streamController);
    bindIssueCards(studio, view, streamController, issueCards);
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

function bindCameraStreaming(studio, view, streamController) {
  const onCamera = (changedView) => {
    if (changedView === view) {
      streamController.schedule("Camera stream");
    }
  };
  studio.viewer.events.onCameraViewMatrixUpdated.subscribe(onCamera);
  studio.viewer.events.onCameraProjMatrixUpdated.subscribe(onCamera);
}

function bindIssueCards(studio, view, streamController, cards) {
  const viewpoints = new Map(ISSUE_VIEWPOINTS.map((issue) => [issue.id, issue]));
  const cameraFlight = studio.viewManager.views?.[view.id]?.cameraFlight;

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
  const overlayModel = must(scene.createModel({id: "BakuChunkAABBPlaceholders"}));
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
  marker.id = "XGFStreamingBakuReady";
  marker.hidden = true;
  document.body.appendChild(marker);
}
