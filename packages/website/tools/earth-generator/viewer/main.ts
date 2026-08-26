import * as xeokit from "../../../js/xeokit-studio-bundle.js";

const statusEl = document.getElementById("status")!;
const INDEX_URL = "../../dist/earth/index.runtime.json";

const studio = new xeokit.studio.Studio({});
studio.init().then(async () => {
  const view = studio.viewManager.createView({
    id: "earthView",
    adaptiveQuality: false,
    backgroundColor: [0.01, 0.015, 0.025],
    camera: {
      perspectiveProjection: {fov: 45},
      eye: [0, 0, 17_000_000],
      look: [0, 0, 0],
      up: [0, 1, 0]
    }
  });

  const runtimeIndex = await fetchJSON(INDEX_URL);
  const read = xeokit.formats.xgfstream.readXGFStreamingRuntimeIndex(runtimeIndex);
  if (!read.ok) throw new Error(read.error);
  const index = resolveIndexUris(read.value, INDEX_URL);
  const sceneModel = must(studio.scene.createModel({
    id: "earth",
    updateHint: "dynamic",
    coordinateSystem: index.coordinateSystem
  }));
  const controller = new xeokit.formats.xgfstream.XGFViewStreamController({
    index,
    loader: new xeokit.formats.xgfstream.XGFStreamingLoader(),
    sceneModel,
    view,
    frustumOnly: true,
    batchSize: 8,
    fetchConcurrency: 8,
    commitFrameBudgetMs: 4,
    onStatus: setStatus,
    onProgress: () => render(controller),
    onError: (error: unknown) => setStatus(String((error as Error)?.message || error))
  });
  controller.schedule("Load Earth stream");
  bindCameraStreaming(studio, controller);
  render(controller);
  studio.finished();
});

async function fetchJSON(url: string): Promise<any> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.status}`);
  return response.json();
}

function resolveIndexUris(index: any, indexURL: string): any {
  const baseURL = new URL(indexURL, window.location.href).href;
  return {
    ...index,
    chunks: (index.chunks || []).map((manifest: any) => ({
      ...manifest,
      uri: manifest.uri ? new URL(manifest.uri, baseURL).href : manifest.uri,
      dependencies: {
        ...manifest.dependencies,
        chunks: (manifest.dependencies?.chunks || []).map((dep: any) => ({
          ...dep,
          uri: dep.uri ? new URL(dep.uri, baseURL).href : dep.uri
        }))
      }
    }))
  };
}

function bindCameraStreaming(studioRef: any, controller: any): void {
  const camera = studioRef.viewManager.views.earthView.camera;
  const schedule = () => controller.schedule("Camera changed");
  camera.onViewMatrix.subscribe(schedule);
  camera.onProjMatrix.subscribe(schedule);
}

function render(controller: any): void {
  setStatus(`${controller.loadedChunkIds.size}/${controller.chunkManifests.length} chunks`);
}

function setStatus(text: string): void {
  statusEl.textContent = text;
}

function must<T>(result: {ok: boolean; value?: T; error?: string}): T {
  if (!result.ok) throw new Error(result.error || "xeokit operation failed");
  return result.value as T;
}
