import {sdkProgress} from "@xeokit/sdk/base/core";
import {XGFStreamingLoader, XGFViewStreamController, readXGFStreamingRuntimeIndex} from "@xeokit/sdk/formats/xgfstream";
import {Scene} from "@xeokit/sdk/model/scene";
import {CameraFlightAnimation} from "@xeokit/sdk/viewing/cameraFlight";
import {Viewer} from "@xeokit/sdk/viewing/viewer";
import {
  configureFastStreamingLighting,
  createFastStreamingInputController,
  createFastStreamingRenderer,
  createFastStreamingViewParams
} from "../../../utils/fastStreamingViewer.js";

const INDEX_URL = "../../../../models/Archipelago/xgfstream/index.runtime.json";
const AUTO_BATCH_SIZE = 2;
const FETCH_CONCURRENCY = 4;
const CAMERA_DEBOUNCE_MS = 140;
const CACHE_XGF_FILE_BYTES = true;
const MAX_CACHED_XGF_FILE_BYTES = 128 * 1024 * 1024;
const FAR_CLIP = 200000;

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

const viewpointCards = createViewpointCards(document.getElementById("viewpointCards"), VIEWPOINTS);

main().catch((error) => {
  console.error(error);
});

async function main() {
  const ui = {
    loadedChunks: document.getElementById("loadedChunks"),
    objectCount: document.getElementById("objectCount"),
    meshCount: document.getElementById("meshCount"),
    frustumQueueLabel: document.getElementById("frustumQueueLabel"),
    frustumQueueProgress: document.getElementById("frustumQueueProgress"),
    streamStatus: document.getElementById("streamStatus"),
    signalFrustumLoaded: createInitialFrustumReadyHandler()
  };

  // Build the SDK pieces explicitly so the example shows the same ownership
  // boundaries as the import examples: Scene -> Viewer -> View -> renderer.
  const scene = new Scene({logging: false});
  const viewer = new Viewer({scene, logging: false});
  const view = must(viewer.createView(createFastStreamingViewParams({
    canvas: document.getElementById("viewerCanvas"),
    viewId: "demoView",
    camera: {
      perspectiveProjection: {fov: INITIAL_VIEWPOINT.fov, near: 0.1, far: FAR_CLIP},
      eye: INITIAL_VIEWPOINT.eye,
      look: INITIAL_VIEWPOINT.look,
      up: INITIAL_VIEWPOINT.up
    }
  })));
  configureFastStreamingLighting(view);
  view.linesMaterial.lineWidth = 1.75;
  view.linesMaterial.joinStyle = "round";
  const renderer = await createFastStreamingRenderer(viewer);
  createFastStreamingInputController(scene, view, renderer);
  const cameraFlight = new CameraFlightAnimation(view, {duration: 0.9});

  try {
    setStatus(ui, "Preparing stream index");
    const index = await fetchStreamingIndex(INDEX_URL);
    setStatus(ui, "Scheduling first frustum");

    const sceneModel = must(scene.createModel({
      id: "Archipelago",
      updateHint: "dynamic",
      // The runtime index records the exported model coordinate system; use it
      // directly so streamed chunks land in the same Z-up world as the camera.
      coordinateSystem: index.coordinateSystem
    }));

    const loader = new XGFStreamingLoader();
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

    streamController = new XGFViewStreamController({
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
    bindCameraStreaming(viewer, view, streamController);
    bindViewpointCards(view, streamController, viewpointCards, cameraFlight);
    setActiveViewpoint(viewpointCards, INITIAL_VIEWPOINT.id);
  } catch (error) {
    console.error(error);
    setStatus(ui, String(error?.message || error));
  }
}

async function fetchStreamingIndex(url) {
  const runtimeIndex = await fetchJSON(url);
  const result = readXGFStreamingRuntimeIndex(runtimeIndex);
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

function bindCameraStreaming(viewer, view, streamController) {
  const onCamera = (camera) => {
    if (camera !== view.camera) {
      return;
    }
    streamController.schedule("Current frustum");
  };
  viewer.events.onCameraViewMatrixUpdated.subscribe(onCamera);
  viewer.events.onCameraProjMatrixUpdated.subscribe(onCamera);
}

function bindViewpointCards(view, streamController, cards, cameraFlight) {
  const viewpoints = new Map(VIEWPOINTS.map((viewpoint) => [viewpoint.id, viewpoint]));
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

function createInitialFrustumReadyHandler() {
  let signaled = false;
  return (progress) => {
    if (signaled || !progress || progress.queued <= 0 || progress.loaded < progress.queued) {
      return;
    }
    signaled = true;
    signalReady();
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
