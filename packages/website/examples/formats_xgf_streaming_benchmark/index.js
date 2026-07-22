import * as xeokit from "../../js/xeokit-studio-bundle.js";

const INDEX_URL = "./chunks/index.runtime.json";
const loadedChunkIds = new Set();

const studio = new xeokit.studio.Studio({});

studio.init().then(async () => {
  const {scene} = studio;

  // One View owns the camera and adaptive-quality policy. Chunk selection below
  // sorts manifests by distance from this camera.
  const view = studio.viewManager.createView({
    id: "demoView",
    adaptiveQuality: true,
    camera: {
      eye: [115, -135, 92],
      look: [0, 0, 8],
      up: [0, 0, 1]
    }
  });

  const ui = {
    status: document.getElementById("status"),
    chunkList: document.getElementById("chunkList"),
    loadedChunks: document.getElementById("loadedChunks"),
    objectCount: document.getElementById("objectCount"),
    meshCount: document.getElementById("meshCount"),
    load25: document.getElementById("load25"),
    loadAll: document.getElementById("loadAll"),
    unload25: document.getElementById("unload25"),
    unloadAll: document.getElementById("unloadAll")
  };

  try {
    // The compact runtime index contains scheduling and dependency metadata.
    // The full chunks/index.json remains available for debugging/tooling.
    const index = await fetchStreamingIndex(INDEX_URL);
    const lookup = xeokit.formats.xgfstream.createXGFStreamingIndexLookup(index);
    const sceneModel = must(scene.createModel({id: "streaming-benchmark-city"}));
    const loader = new xeokit.formats.xgfstream.XGFStreamingLoader();
    const referenceChunks = index.chunks
      .filter((manifest) => manifest.role === "referencesOnly");

    // The streaming loader automatically loads missing dependency chunks
    // declared in each references-only chunk manifest.
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
      }
    };

    ui.load25.addEventListener("click", () => runOperation(ui, async () => {
      await loadNearestChunks(referenceChunks, loader, sceneModel, loadOptions, view, 25);
    }, referenceChunks, sceneModel, view));
    ui.loadAll.addEventListener("click", () => runOperation(ui, async () => {
      await loadNearestChunks(referenceChunks, loader, sceneModel, loadOptions, view, referenceChunks.length);
    }, referenceChunks, sceneModel, view));
    ui.unload25.addEventListener("click", () => runOperation(ui, async () => {
      unloadFarthestChunks(referenceChunks, loader, sceneModel, view, 25);
    }, referenceChunks, sceneModel, view));
    ui.unloadAll.addEventListener("click", () => runOperation(ui, async () => {
      unloadFarthestChunks(referenceChunks, loader, sceneModel, view, referenceChunks.length);
    }, referenceChunks, sceneModel, view));

    render(ui, referenceChunks, sceneModel, view);
    await runOperation(ui, async () => {
      await loadNearestChunks(referenceChunks, loader, sceneModel, loadOptions, view, 25);
    }, referenceChunks, sceneModel, view, "Initial batch");
    signalBenchmarkReady();

    studio.finished();
  } catch (error) {
    ui.status.textContent = `Failed to initialize XGF streaming benchmark: ${error.message || error}`;
    console.error(error);
  }
});

async function runOperation(ui, operation, chunkManifests, sceneModel, view, label = "Operation") {
  setButtonsDisabled(ui, true);
  const start = performance.now();
  try {
    ui.status.textContent = `${label} running...`;
    await operation();
    const elapsed = performance.now() - start;
    ui.status.textContent = `${label} finished in ${elapsed.toFixed(1)} ms`;
  } finally {
    render(ui, chunkManifests, sceneModel, view);
    setButtonsDisabled(ui, false);
  }
}

async function fetchStreamingIndex(url) {
  const runtimeIndex = await fetchJSON(url);
  const result = xeokit.formats.xgfstream.readXGFStreamingRuntimeIndex(runtimeIndex);
  if (!result.ok) {
    throw new Error(result.error);
  }
  return result.value;
}

async function loadNearestChunks(chunkManifests, loader, sceneModel, loadOptions, view, count) {
  const candidates = prioritizeChunks(chunkManifests, view)
    .filter((manifest) => !loadedChunkIds.has(manifest.id))
    .slice(0, count);
  await loader.loadChunks({manifests: candidates, sceneModel}, {
    ...loadOptions,
    fetchConcurrency: 8
  });
}

function unloadFarthestChunks(chunkManifests, loader, sceneModel, view, count) {
  const candidates = prioritizeChunks(chunkManifests, view)
    .filter((manifest) => loadedChunkIds.has(manifest.id))
    .reverse()
    .slice(0, count);
  for (const manifest of candidates) {
    const result = loader.unloadChunk({sceneModel, chunkId: manifest.id});
    if (result.ok) {
      loadedChunkIds.delete(manifest.id);
    }
  }
}

function render(ui, chunkManifests, sceneModel, view) {
  ui.loadedChunks.textContent = `${loadedChunkIds.size}/${chunkManifests.length}`;
  ui.objectCount.textContent = formatInt(Object.keys(sceneModel.objects).length);
  ui.meshCount.textContent = formatInt(Object.keys(sceneModel.meshes).length);
  ui.chunkList.replaceChildren(...prioritizeChunks(chunkManifests, view).slice(0, 40).map((manifest) => {
    const loaded = loadedChunkIds.has(manifest.id);
    const inView = intersectsCameraFrustum(manifest, view);
    const item = document.createElement("article");
    item.className = "chunk";
    item.innerHTML = `
      <div>
        <strong>${manifest.id}</strong>
        <small>${inView ? "in view" : "prefetch"} · ${manifest.counts.objects} objects, ${manifest.counts.meshes} meshes</small>
      </div>
      <span class="state ${loaded ? "loaded" : ""}">${loaded ? "loaded" : "idle"}</span>
    `;
    return item;
  }));
}

function setButtonsDisabled(ui, disabled) {
  ui.load25.disabled = disabled;
  ui.loadAll.disabled = disabled;
  ui.unload25.disabled = disabled;
  ui.unloadAll.disabled = disabled;
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

function formatInt(value) {
  return new Intl.NumberFormat().format(value);
}

function must(result) {
  if (!result.ok) {
    throw new Error(result.error);
  }
  return result.value;
}

function signalBenchmarkReady() {
  const exampleMarker = document.createElement("div");
  exampleMarker.id = "ExampleLoaded";
  exampleMarker.hidden = true;
  document.body.appendChild(exampleMarker);

  const marker = document.createElement("div");
  marker.id = "XGFStreamingBenchmarkReady";
  marker.hidden = true;
  document.body.appendChild(marker);
}
