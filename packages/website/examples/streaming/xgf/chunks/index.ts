import {createXGFStreamingIndexLookup, XGFStreamingLoader, readXGFStreamingRuntimeIndex} from "@xeokit/sdk/formats/xgfstream";
import {Scene} from "@xeokit/sdk/model/scene";
import {Viewer} from "@xeokit/sdk/viewing/viewer";
import {
  configureFastStreamingLighting,
  createFastStreamingInputController,
  createFastStreamingRenderer,
  createFastStreamingViewParams
} from "../../../utils/fastStreamingViewer.js";

const INDEX_URL = "./chunks/index.runtime.json";
const INITIAL_CHUNK_COUNT = 2;
const FETCH_CONCURRENCY = 8;
const STREAM_YIELD_INTERVAL_MS = 100;
const loadedChunkIds = new Set();

main().catch((error) => {
  const status = document.getElementById("status");
  if (status) {
    status.textContent = `Failed to initialize XGF streaming example: ${error.message || error}`;
  }
  console.error(error);
});

async function main() {
  // The example intentionally creates the SDK primitives here, while the shared
  // helper only supplies the repeated streaming view and WebGPU defaults.
  const scene = new Scene({logging: false});
  const viewer = new Viewer({scene, logging: false});
  const view = must(viewer.createView(createFastStreamingViewParams({
    canvas: document.getElementById("demoCanvas"),
    viewId: "demoView",
    camera: {
      eye: [14, -18, 12],
      look: [0, 0, 3],
      up: [0, 0, 1]
    }
  })));
  configureFastStreamingLighting(view);
  const renderer = await createFastStreamingRenderer(viewer);
  createFastStreamingInputController(scene, view, renderer);

  // This small example keeps the whole streaming flow visible: load the
  // aggregate index, create a lookup, then load/unload references-only chunks.
  const status = document.getElementById("status");
  const chunkList = document.getElementById("chunkList");
  const loadNearest = document.getElementById("loadNearest");
  const unloadAll = document.getElementById("unloadAll");

  try {
    // The compact runtime index embeds scheduling and dependency metadata.
    // The full chunks/index.json remains available for debugging/tooling.
    const index = await fetchStreamingIndex(INDEX_URL);
    const lookup = createXGFStreamingIndexLookup(index);
    const sceneModel = must(scene.createModel({
      id: "streamed-city",
      updateHint: "dynamic",
      // This stream was exported in the coordinate system stored in the index.
      coordinateSystem: index.coordinateSystem
    }));
    const loader = new XGFStreamingLoader();
    const referenceChunks = index.chunks.filter((manifest) => manifest.role === "referencesOnly");

    // `loadChunk()` will fetch any missing asset-library dependencies declared
    // by the references-only chunk manifest before applying that chunk.
    const loadOptions = {
      manifests: lookup,
      getFileData: async (manifest) => {
        const response = await fetch(manifest.uri);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status} fetching ${manifest.uri}`);
        }
        return response.arrayBuffer();
      },
      onChunkLoaded: (manifest) => {
        if (manifest.role === "referencesOnly") {
          loadedChunkIds.add(manifest.id);
        }
      },
      yieldIntervalMs: STREAM_YIELD_INTERVAL_MS
    };

    chunkList.addEventListener("click", async (event) => {
      const button = event.target.closest("button[data-action]");
      if (!button) {
        return;
      }
      const manifest = lookup.byId[button.dataset.chunkId];
      if (!manifest) {
        return;
      }
      button.disabled = true;
      if (button.dataset.action === "load") {
        await loadChunk(loader, manifest, sceneModel, loadOptions, status);
      } else {
        unloadChunk(loader, manifest.id, sceneModel, status);
      }
      renderChunks(referenceChunks, view, chunkList);
    });

    loadNearest.addEventListener("click", async () => {
      const nearest = prioritizeChunks(referenceChunks, view)
        .find((manifest) => !loadedChunkIds.has(manifest.id));
      if (nearest) {
        await loadChunk(loader, nearest, sceneModel, loadOptions, status);
        renderChunks(referenceChunks, view, chunkList);
      }
    });

    unloadAll.addEventListener("click", () => {
      for (const manifest of referenceChunks.slice().reverse()) {
        if (loadedChunkIds.has(manifest.id)) {
          unloadChunk(loader, manifest.id, sceneModel, status);
        }
      }
      renderChunks(referenceChunks, view, chunkList);
    });

    renderChunks(referenceChunks, view, chunkList);
    await loadInitialChunks(loader, referenceChunks, sceneModel, loadOptions, view, status);
    renderChunks(referenceChunks, view, chunkList);

    status.textContent = "Loaded two nearest chunks. Use the panel to stream the remaining tile or unload loaded tiles.";
    signalReady();
  } catch (error) {
    status.textContent = `Failed to initialize XGF streaming example: ${error.message || error}`;
    console.error(error);
  }
}

async function fetchStreamingIndex(url) {
  const runtimeIndex = await fetchJSON(url);
  const result = readXGFStreamingRuntimeIndex(runtimeIndex);
  if (!result.ok) {
    throw new Error(result.error);
  }
  return result.value;
}

async function loadChunk(loader, manifest, sceneModel, options, status) {
  status.textContent = `Loading ${manifest.id}...`;
  await loader.loadChunk({manifest, sceneModel}, options);
  loadedChunkIds.add(manifest.id);
  status.textContent = `Loaded ${manifest.id}`;
}

async function loadInitialChunks(loader, chunkManifests, sceneModel, options, view, status) {
  const chunks = prioritizeChunks(chunkManifests, view).slice(0, INITIAL_CHUNK_COUNT);
  status.textContent = `Loading ${chunks.length} nearest chunks...`;
  await loader.loadChunks({manifests: chunks, sceneModel}, {
    ...options,
    fetchConcurrency: FETCH_CONCURRENCY
  });
}

function unloadChunk(loader, chunkId, sceneModel, status) {
  const result = loader.unloadChunk({sceneModel, chunkId});
  if (result.ok) {
    loadedChunkIds.delete(chunkId);
    status.textContent = `Unloaded ${chunkId}`;
  } else {
    status.textContent = result.error;
  }
}

function renderChunks(chunkManifests, view, container) {
  container.replaceChildren(...prioritizeChunks(chunkManifests, view).map((manifest) => {
    const loaded = loadedChunkIds.has(manifest.id);
    const inView = intersectsCameraFrustum(manifest, view);
    const item = document.createElement("article");
    item.className = "chunk";
    item.innerHTML = `
      <div class="chunk-row">
        <div class="chunk-title">${manifest.id}</div>
        <span class="state ${loaded ? "loaded" : ""}">${loaded ? "loaded" : "idle"}</span>
      </div>
      <div class="chunk-meta">
        priority ${inView ? "in view" : "prefetch"}, distance ${distanceToCamera(manifest, view).toFixed(1)}m<br>
        deps ${manifest.dependencies.chunks.map((dependency) => dependency.id || dependency.uri).join(", ")}
      </div>
      <div class="chunk-actions">
        <button data-action="load" data-chunk-id="${manifest.id}" ${loaded ? "disabled" : ""}>Load</button>
        <button data-action="unload" data-chunk-id="${manifest.id}" ${loaded ? "" : "disabled"}>Unload</button>
      </div>
    `;
    return item;
  }));
}

function prioritizeChunks(chunkManifests, view) {
  return chunkManifests
    .slice()
    .sort((a, b) => {
      const aInView = intersectsCameraFrustum(a, view);
      const bInView = intersectsCameraFrustum(b, view);
      if (aInView !== bInView) {
        return aInView ? -1 : 1;
      }
      return distanceToCamera(a, view) - distanceToCamera(b, view);
    });
}

function intersectsCameraFrustum(manifest, view) {
  const frustum = view.camera.frustum;
  const aabb = manifest.aabb;
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

function distanceToCamera(manifest, view) {
  const eye = view.camera.eye;
  const aabb = manifest.aabb || [0, 0, 0, 0, 0, 0];
  const dx = Math.max(aabb[0] - eye[0], 0, eye[0] - aabb[3]);
  const dy = Math.max(aabb[1] - eye[1], 0, eye[1] - aabb[4]);
  const dz = Math.max(aabb[2] - eye[2], 0, eye[2] - aabb[5]);
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

async function fetchJSON(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} fetching ${url}`);
  }
  return response.json();
}

function must(result) {
  if (!result.ok) {
    throw new Error(result.error);
  }
  return result.value;
}

function signalReady() {
  document.body.classList.add("xeokit-loading-spinner-ready");
  const marker = document.createElement("div");
  marker.id = "ExampleLoaded";
  marker.hidden = true;
  document.body.appendChild(marker);
}
