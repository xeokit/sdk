import * as xeokit from "../../js/xeokit-studio-bundle.js";

globalThis.XEOKIT_LOG_USED_VERTEX_SHADERS = true;

const canvas = document.getElementById("demoCanvas");
const status = document.getElementById("status");
const dropOverlay = document.getElementById("dropOverlay");
const prompt = document.getElementById("prompt");
const progressPanel = document.getElementById("progressPanel");
const progressLabel = document.getElementById("progressLabel");
const progressBar = document.getElementById("progressBar");
const fpsValue = document.getElementById("fpsValue");
const frameMsValue = document.getElementById("frameMsValue");
const rafValue = document.getElementById("rafValue");

const COORDINATE_SYSTEM = {
  basis: [1, 0, 0, 0, 1, 0, 0, 0, 1],
  origin: [0, 0, 0],
  units: "meters",
  scaleToMeters: 1
};
const DEFAULT_XGF_MODEL = {
  name: "West Riverside Hospital",
  modelId: "WestRiverSideHospital",
  modelUrl: "../../models/WestRiverSideHospital/xgf/model.xgf",
  coordinateSystemUrl: "../../models/WestRiverSideHospital/coordSys.json"
};

let scene;
let viewer;
let view;
let renderer;
let inputController;
let activeSceneModel = null;
let activeDataModel = null;
let activeCameraOrbit = null;
let cameraOrbitAnimationFrame = 0;
let activeModelSerial = 0;

main().catch((error) => {
  reportError(error instanceof Error ? error.message : String(error));
});

async function main() {
  const {Scene} = xeokit.model.scene;
  const {Data} = xeokit.model.data;
  const {Viewer} = xeokit.viewing.viewer;
  const {WebGLRenderer} = xeokit.viewing.webGLRenderer;
  const {ViewController} = xeokit.viewing.viewController;

  const data = new Data();
  scene = new Scene({logging: false});
  viewer = new Viewer({scene, logging: false});
  view = mustOk(viewer.createView({
    id: "bareBonesFileDropView",
    htmlElement: canvas,
    backgroundColor: [0.96, 0.97, 0.98],
    camera: {
      projection: "perspective",
      far: 1000000,
      eye: [8, -10, 7],
      look: [0, 0, 0],
      up: [0, 0, 1]
    },
    effects: {
      sao: {renderModes: []},
      edges: {renderModes: []},
      bloom: {renderModes: []},
      atmosphere: {renderModes: []},
      depthOfField: {renderModes: []},
      tonemap: {renderModes: []},
      antiAliasing: {renderModes: []},
      shadows: {renderModes: []},
      sky: {enabled: false, renderModes: []},
      sectionPlaneCaps: {renderModes: []},
      bodyHatch: {renderModes: []}
    },
    lights: {
      ibl: {renderModes: []},
      hemispheric: {renderModes: []}
    },
    texturing: {
      renderModes: []
    }
  }));
  renderer = new WebGLRenderer({viewer});
  const fpsMeter = startFpsMeter(view, renderer);
  inputController = new ViewController(view, {
    pick: noPick,
    followPointer: false,
    doublePickFlyTo: false,
    keyboardDollyRate: 12,
    keyboardPanRate: 5,
    mouseWheelDollyRate: 90,
    touchDollyRate: 0.18
  });

  wireDropTarget(data);
  window.addEventListener("resize", () => view.needsRender?.());

  window.bareBonesModelFileDrop = {
    scene,
    data,
    viewer,
    view,
    renderer,
    inputController,
    fpsMeter
  };
  startCameraOrbit();
  await loadDefaultXGFModel(data);
}

function startFpsMeter(view, renderer) {
  const sampleMs = 500;
  let sampleStart = performance.now();
  let renderedFrames = 0;
  let renderedFrameMsTotal = 0;
  let renderedDrawCallsTotal = 0;
  let rafHandle = 0;
  let rafSampleStart = performance.now();
  let rafFrames = 0;
  let running = true;

  const renderInspectorResult = renderer.getRenderInspector?.();
  const renderInspector = renderInspectorResult?.ok ? renderInspectorResult.value : null;
  if (renderInspector) {
    renderInspector.enabled = true;
  }

  const unsubscribe = renderer.events.onViewRendered.subscribe((_, renderedView) => {
    if (!running || renderedView !== view) {
      return;
    }
    const now = performance.now();
    const frame = renderInspector?.renderStats?.views?.[view.viewIndex];
    renderedFrames++;
    if (frame?.timeMs?.duration !== undefined) {
      renderedFrameMsTotal += frame.timeMs.duration;
      renderedDrawCallsTotal += frame.numDrawCalls || 0;
    }

    if (now - sampleStart >= sampleMs) {
      const elapsed = now - sampleStart;
      const fps = (renderedFrames * 1000) / elapsed;
      const frameMs = renderedFrames > 0 ? renderedFrameMsTotal / renderedFrames : 0;
      const drawCalls = renderedFrames > 0 ? renderedDrawCallsTotal / renderedFrames : 0;
      fpsValue.textContent = `${fps.toFixed(fps >= 100 ? 0 : 1)} FPS`;
      frameMsValue.textContent = `${frameMs.toFixed(2)} ms/frame, ${drawCalls.toFixed(0)} draws`;
      sampleStart = now;
      renderedFrames = 0;
      renderedFrameMsTotal = 0;
      renderedDrawCallsTotal = 0;
    }
  });

  const tickRaf = (now) => {
    if (!running) {
      return;
    }
    view.needsRender?.();
    rafFrames++;
    const elapsed = now - rafSampleStart;
    if (elapsed >= sampleMs) {
      const rafFps = (rafFrames * 1000) / elapsed;
      rafValue.textContent = `${rafFps.toFixed(rafFps >= 100 ? 0 : 1)} RAF`;
      rafSampleStart = now;
      rafFrames = 0;
    }
    rafHandle = requestAnimationFrame(tickRaf);
  };

  view.needsRender?.();
  rafHandle = requestAnimationFrame(tickRaf);

  return {
    stop() {
      running = false;
      cancelAnimationFrame(rafHandle);
      unsubscribe();
    }
  };
}

function wireDropTarget(data) {
  const setActive = (active) => {
    dropOverlay.dataset.active = active ? "true" : "false";
  };

  document.addEventListener("dragover", (event) => {
    event.preventDefault();
    setActive(true);
  });
  document.addEventListener("dragleave", (event) => {
    if (event.target === document || event.target === canvas || event.target === dropOverlay) {
      setActive(false);
    }
  });
  document.addEventListener("drop", async (event) => {
    event.preventDefault();
    setActive(false);
    const droppedFiles = await collectDroppedFiles(event.dataTransfer);
    if (droppedFiles.length === 0) {
      return;
    }
    prompt.style.display = "none";
    dropOverlay.style.display = "none";
    try {
      const streamIndexFile = findXGFStreamIndexFile(droppedFiles);
      if (streamIndexFile) {
        await loadDroppedXGFStream(droppedFiles, streamIndexFile, data);
      } else if (droppedFiles.length === 1) {
        await loadDroppedFile(droppedFiles[0].file, data);
      } else {
        throw new Error("Drop one model file, or an XGF stream folder containing a .runtime.json index.");
      }
    } catch (error) {
      reportError(error instanceof Error ? error.message : String(error));
    }
  });
}

async function collectDroppedFiles(dataTransfer) {
  const items = Array.from(dataTransfer?.items || []);
  const entries = items
    .map((item) => item.webkitGetAsEntry?.())
    .filter(Boolean);
  if (entries.length > 0) {
    const files = [];
    for (const entry of entries) {
      await collectEntryFiles(entry, files);
    }
    return files;
  }
  return Array.from(dataTransfer?.files || []).map((file) => ({
    file,
    path: normalizeDroppedPath(file.webkitRelativePath || file.name)
  }));
}

function collectEntryFiles(entry, files) {
  if (entry.isFile) {
    return new Promise((resolve, reject) => {
      entry.file((file) => {
        files.push({
          file,
          path: normalizeDroppedPath(entry.fullPath || file.webkitRelativePath || file.name)
        });
        resolve();
      }, reject);
    });
  }
  if (!entry.isDirectory) {
    return Promise.resolve();
  }
  return readDirectoryEntries(entry).then(async (entries) => {
    for (const child of entries) {
      await collectEntryFiles(child, files);
    }
  });
}

function readDirectoryEntries(directoryEntry) {
  const reader = directoryEntry.createReader();
  const entries = [];
  return new Promise((resolve, reject) => {
    const readBatch = () => {
      reader.readEntries((batch) => {
        if (batch.length === 0) {
          resolve(entries);
          return;
        }
        entries.push(...batch);
        readBatch();
      }, reject);
    };
    readBatch();
  });
}

async function loadDroppedFile(file, data) {
  const loaderInfo = getLoaderInfo(file.name);
  if (!loaderInfo) {
    throw new Error(`Unsupported file extension: ${file.name}`);
  }
  const Loader = loaderInfo.Loader;
  if (!Loader) {
    throw new Error(`${loaderInfo.label} loader is not available in this bundle.`);
  }

  const modelId = `droppedModel${++activeModelSerial}`;
  destroyActiveModels();
  updateStatus(`Reading ${file.name}...`);
  showProgress("Reading file", 0, 0);
  await paintProgress();

  const sceneModel = mustOk(scene.createModel({
    id: modelId,
    coordinateSystem: COORDINATE_SYSTEM,
    updateHint: "static"
  }));
  const dataModel = loaderInfo.withDataModel
    ? mustOk(data.createModel({id: modelId}))
    : null;

  try {
    const fileData = await readFileData(file, loaderInfo.fileDataType);
    updateStatus(`Loading ${file.name} as ${loaderInfo.label}...`);
    showProgress(`Loading ${loaderInfo.label}`, 0, 0);
    await paintProgress();
    const result = await new Loader().load({
      fileData,
      sceneModel,
      ...(dataModel ? {dataModel} : {})
    }, {
      onProgress: (progress) => updateLoadProgress(progress),
      yieldIntervalMs: 32
    });
    if (result && result.ok === false) {
      throw new Error(result.error);
    }
    activeSceneModel = sceneModel;
    activeDataModel = dataModel;
  } catch (error) {
    sceneModel.destroy();
    dataModel?.destroy();
    hideProgress();
    throw error;
  }

  const counts = {
    objects: Object.keys(sceneModel.objects).length,
    meshes: Object.keys(sceneModel.meshes).length,
    geometries: Object.keys(sceneModel.geometries).length
  };
  showProgress("Fitting camera", 0, 0);
  await paintProgress();
  await fitLoadedModelToView(sceneModel);
  status.dataset.state = "ok";
  status.textContent = `${file.name} loaded: ${counts.objects} objects, ${counts.meshes} meshes, ${counts.geometries} geometries.`;
  hideProgress();
  view.needsRender?.();
}

async function loadDefaultXGFModel(data) {
  const Loader = xeokit.formats.xgf?.XGFLoader;
  if (!Loader) {
    throw new Error("XGF loader is not available in this bundle.");
  }

  prompt.style.display = "none";
  dropOverlay.style.display = "none";
  destroyActiveModels();
  updateStatus(`Loading ${DEFAULT_XGF_MODEL.name} XGF...`);
  showProgress(`Loading ${DEFAULT_XGF_MODEL.name}`, 0, 0);
  await paintProgress();

  const coordinateSystem = await fetchJSON(DEFAULT_XGF_MODEL.coordinateSystemUrl);
  const sceneModel = mustOk(scene.createModel({
    id: DEFAULT_XGF_MODEL.modelId,
    coordinateSystem,
    updateHint: "static"
  }));
  const dataModel = mustOk(data.createModel({id: DEFAULT_XGF_MODEL.modelId}));

  try {
    const fileData = await fetchArrayBuffer(DEFAULT_XGF_MODEL.modelUrl);
    const result = await new Loader().load({
      fileData,
      sceneModel,
      dataModel
    }, {
      onProgress: (progress) => updateLoadProgress(progress),
      yieldIntervalMs: 32
    });
    if (result && result.ok === false) {
      throw new Error(result.error);
    }
    activeSceneModel = sceneModel;
    activeDataModel = dataModel;
  } catch (error) {
    sceneModel.destroy();
    dataModel.destroy();
    hideProgress();
    throw error;
  }

  const counts = {
    objects: Object.keys(sceneModel.objects).length,
    meshes: Object.keys(sceneModel.meshes).length,
    geometries: Object.keys(sceneModel.geometries).length
  };
  showProgress("Fitting camera", 0, 0);
  await paintProgress();
  await fitLoadedModelToView(sceneModel);
  status.dataset.state = "ok";
  status.textContent = `${DEFAULT_XGF_MODEL.name} loaded: ${counts.objects} objects, ${counts.meshes} meshes, ${counts.geometries} geometries.`;
  hideProgress();
  view.needsRender?.();
}

async function loadDroppedXGFStream(droppedFiles, indexEntry, data) {
  const xgfstream = xeokit.formats.xgfstream;
  if (!xgfstream?.XGFStreamingLoader || !xgfstream?.createXGFStreamingIndexLookup) {
    throw new Error("XGF stream loader is not available in this bundle.");
  }

  const modelId = `droppedModel${++activeModelSerial}`;
  destroyActiveModels();
  updateStatus(`Reading XGF stream ${indexEntry.path}...`);
  showProgress("Reading XGF stream index", 0, 0);
  await paintProgress();

  const fileLookup = createDroppedFileLookup(droppedFiles);
  const indexBasePath = dirnamePath(indexEntry.path);
  const index = readXGFStreamIndex(await indexEntry.file.text().then((text) => JSON.parse(text)));
  const sceneModel = mustOk(scene.createModel({
    id: modelId,
    coordinateSystem: index.coordinateSystem || COORDINATE_SYSTEM,
    updateHint: "static"
  }));
  const dataModel = mustOk(data.createModel({id: modelId}));

  try {
    const lookup = xgfstream.createXGFStreamingIndexLookup(index);
    const sceneChunks = getXGFStreamSceneChunks(index, lookup);
    const loader = new xgfstream.XGFStreamingLoader();
    let loadedChunks = 0;

    updateStatus(`Loading XGF stream ${indexEntry.path}...`);
    showProgress("Loading XGF stream chunks", 0, Math.max(index.chunks.length, sceneChunks.length));
    await paintProgress();

    await loader.loadChunks({
      manifests: sceneChunks,
      sceneModel,
      dataModel
    }, {
      manifests: lookup,
      fetchConcurrency: 8,
      yieldIntervalMs: 32,
      getFileData: async (manifest) => {
        if (!manifest.uri) {
          return undefined;
        }
        const file = findDroppedFile(fileLookup, indexBasePath, manifest.uri);
        return file ? file.arrayBuffer() : undefined;
      },
      onChunkLoaded: () => {
        loadedChunks++;
        setProgress("Loading XGF stream chunks", loadedChunks, Math.max(index.chunks.length, sceneChunks.length));
      }
    });

    activeSceneModel = sceneModel;
    activeDataModel = dataModel;
  } catch (error) {
    sceneModel.destroy();
    dataModel.destroy();
    hideProgress();
    throw error;
  }

  const counts = {
    objects: Object.keys(sceneModel.objects).length,
    meshes: Object.keys(sceneModel.meshes).length,
    geometries: Object.keys(sceneModel.geometries).length
  };
  showProgress("Fitting camera", 0, 0);
  await paintProgress();
  await fitLoadedModelToView(sceneModel);
  status.dataset.state = "ok";
  status.textContent = `${indexEntry.path} loaded: ${counts.objects} objects, ${counts.meshes} meshes, ${counts.geometries} geometries.`;
  hideProgress();
  view.needsRender?.();
}

function readXGFStreamIndex(json) {
  const xgfstream = xeokit.formats.xgfstream;
  const result = json?.format === "XGFStreamingRuntimeIndex"
    ? xgfstream.readXGFStreamingRuntimeIndex(json)
    : xgfstream.readXGFStreamingIndex(json);
  if (!result.ok) {
    throw new Error(result.error);
  }
  return result.value;
}

function getXGFStreamSceneChunks(index, lookup) {
  const rootChunkIds = index.rootChunkIds && index.rootChunkIds.length > 0
    ? index.rootChunkIds
    : index.chunks.filter((chunk) => chunk.role !== "assetLibrary").map((chunk) => chunk.id);
  return rootChunkIds.map((chunkId) => {
    const chunk = lookup.byId[chunkId];
    if (!chunk) {
      throw new Error(`XGF stream index references missing root chunk '${chunkId}'.`);
    }
    return chunk;
  });
}

function findXGFStreamIndexFile(droppedFiles) {
  const candidates = droppedFiles.filter(({path}) => {
    const normalized = path.toLowerCase();
    const filename = basenamePath(normalized);
    return filename.endsWith(".runtime.json") ||
      (droppedFiles.length > 1 && (normalized.endsWith("/index.json") || normalized === "index.json"));
  });
  return candidates.sort((a, b) => {
    const aRuntime = basenamePath(a.path).toLowerCase().endsWith(".runtime.json") ? 0 : 1;
    const bRuntime = basenamePath(b.path).toLowerCase().endsWith(".runtime.json") ? 0 : 1;
    return aRuntime - bRuntime || a.path.length - b.path.length;
  })[0] || null;
}

function createDroppedFileLookup(droppedFiles) {
  const byPath = new Map();
  const byName = new Map();
  for (const entry of droppedFiles) {
    const path = normalizeDroppedPath(entry.path || entry.file.name);
    byPath.set(path, entry.file);
    byName.set(basenamePath(path), entry.file);
  }
  return {byPath, byName};
}

function findDroppedFile(fileLookup, basePath, uri) {
  const normalizedURI = normalizeDroppedPath(uri);
  const resolvedPath = normalizeDroppedPath(basePath ? `${basePath}/${normalizedURI}` : normalizedURI);
  return fileLookup.byPath.get(resolvedPath) ||
    fileLookup.byPath.get(normalizedURI) ||
    fileLookup.byName.get(basenamePath(normalizedURI)) ||
    null;
}

function getLoaderInfo(fileName) {
  const extension = fileName.toLowerCase().split(".").pop();
  const formats = xeokit.formats;
  const registry = {
    "xgf": {label: "XGF", Loader: formats.xgf?.XGFLoader, fileDataType: "arraybuffer", withDataModel: true},
    "xkt": {label: "XKT", Loader: formats.xkt?.XKTLoader, fileDataType: "arraybuffer", withDataModel: true},
    "glb": {label: "glTF", Loader: formats.gltf?.GLTFLoader, fileDataType: "arraybuffer"},
    "gltf": {label: "glTF", Loader: formats.gltf?.GLTFLoader, fileDataType: "arraybuffer"},
    "ifc": {label: "IFC", Loader: formats.ifc?.IFCLoader, fileDataType: "arraybuffer", withDataModel: true},
    "bim": {label: "dotBIM", Loader: formats.dotbim?.DotBIMLoader, fileDataType: "json"},
    "las": {label: "LAS", Loader: formats.las?.LASLoader, fileDataType: "arraybuffer"},
    "laz": {label: "LAZ", Loader: formats.las?.LASLoader, fileDataType: "arraybuffer"},
    "ply": {label: "PLY", Loader: formats.ply?.PLYLoader, fileDataType: "text"},
    "fbx": {label: "FBX", Loader: formats.fbx?.FBXLoader, fileDataType: "arraybuffer"},
    "usdz": {label: "USDZ", Loader: formats.usdz?.USDZLoader, fileDataType: "arraybuffer"},
    "cityjson": {label: "CityJSON", Loader: formats.cityjson?.CityJSONLoader, fileDataType: "json"},
    "json": {label: "CityJSON", Loader: formats.cityjson?.CityJSONLoader, fileDataType: "json"},
    "dxf": {label: "DXF", Loader: formats.dxf?.DXFLoader, fileDataType: "text"},
    "dwg": {label: "DWG", Loader: formats.dwg?.DWGLoader, fileDataType: "arraybuffer"},
    "3dxml": {label: "3DXML", Loader: formats.threedxml?.ThreeDXMLLoader, fileDataType: "arraybuffer"},
    "splat": {label: "Gaussian splat", Loader: formats.gaussiansplat?.GaussianSplatLoader, fileDataType: "arraybuffer"}
  };
  return registry[extension];
}

function readFileData(file, fileDataType) {
  if (fileDataType === "json") {
    return file.text().then((text) => JSON.parse(text));
  }
  if (fileDataType === "text") {
    return file.text();
  }
  return file.arrayBuffer();
}

async function fetchJSON(url) {
  const response = await fetch(url, {cache: "no-cache"});
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} fetching ${url}`);
  }
  return response.json();
}

async function fetchArrayBuffer(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} fetching ${url}`);
  }
  return response.arrayBuffer();
}

function destroyActiveModels() {
  activeCameraOrbit = null;
  activeSceneModel?.destroy();
  activeDataModel?.destroy();
  activeSceneModel = null;
  activeDataModel = null;
}

function startCameraOrbit() {
  if (cameraOrbitAnimationFrame) {
    return;
  }
  const tick = (now) => {
    if (activeCameraOrbit) {
      const elapsedSeconds = (now - activeCameraOrbit.startTime) / 1000;
      const angle = activeCameraOrbit.startAngle + elapsedSeconds * activeCameraOrbit.radiansPerSecond;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const offset = activeCameraOrbit.eyeOffset;
      view.camera.look = activeCameraOrbit.center;
      view.camera.eye = [
        activeCameraOrbit.center[0] + offset[0] * cos - offset[1] * sin,
        activeCameraOrbit.center[1] + offset[0] * sin + offset[1] * cos,
        activeCameraOrbit.center[2] + offset[2]
      ];
      view.camera.up = [0, 0, 1];
      view.needsRender?.();
    }
    cameraOrbitAnimationFrame = requestAnimationFrame(tick);
  };
  cameraOrbitAnimationFrame = requestAnimationFrame(tick);
}

function getSceneModelAABB(sceneModel) {
  const aabb = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
  let valid = false;
  for (const mesh of Object.values(sceneModel.meshes)) {
    const geometryAABB = mesh.geometry?.aabb;
    if (!geometryAABB) {
      continue;
    }
    expandAABBWithTransformedAABB(aabb, geometryAABB, mesh.worldMatrix || mesh.matrix);
    valid = true;
  }
  return valid ? aabb : null;
}

async function fitLoadedModelToView(sceneModel) {
  for (let i = 0; i < 20; i++) {
    const aabb = getSceneModelAABB(sceneModel);
    if (isFiniteAABB(aabb)) {
      fitViewToAABB(view, aabb);
      configureCameraOrbit(aabb);
      view.needsRender?.();
      return;
    }
    await nextFrame();
  }
  throw new Error("Loaded model has no finite bounds to fit the camera.");
}

function expandAABBWithTransformedAABB(target, source, matrix) {
  const corners = [
    [source[0], source[1], source[2]],
    [source[3], source[1], source[2]],
    [source[0], source[4], source[2]],
    [source[3], source[4], source[2]],
    [source[0], source[1], source[5]],
    [source[3], source[1], source[5]],
    [source[0], source[4], source[5]],
    [source[3], source[4], source[5]]
  ];
  for (const corner of corners) {
    const x = corner[0];
    const y = corner[1];
    const z = corner[2];
    const tx = matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12];
    const ty = matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13];
    const tz = matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14];
    target[0] = Math.min(target[0], tx);
    target[1] = Math.min(target[1], ty);
    target[2] = Math.min(target[2], tz);
    target[3] = Math.max(target[3], tx);
    target[4] = Math.max(target[4], ty);
    target[5] = Math.max(target[5], tz);
  }
}

function fitViewToAABB(view, aabb) {
  const center = [
    (aabb[0] + aabb[3]) * 0.5,
    (aabb[1] + aabb[4]) * 0.5,
    (aabb[2] + aabb[5]) * 0.5
  ];
  const dx = aabb[3] - aabb[0];
  const dy = aabb[4] - aabb[1];
  const dz = aabb[5] - aabb[2];
  const radius = Math.max(Math.hypot(dx, dy, dz) * 0.78, 1);
  view.camera.look = center;
  view.camera.eye = [
    center[0] + radius,
    center[1] - radius * 1.35,
    center[2] + radius * 0.85
  ];
  view.camera.up = [0, 0, 1];
  if (view.camera.perspectiveProjection) {
    view.camera.perspectiveProjection.near = Math.max(radius / 10000, 0.001);
    view.camera.perspectiveProjection.far = Math.max(radius * 8, 1000);
  }
}

function configureCameraOrbit(aabb) {
  const center = [
    (aabb[0] + aabb[3]) * 0.5,
    (aabb[1] + aabb[4]) * 0.5,
    (aabb[2] + aabb[5]) * 0.5
  ];
  const eye = view.camera.eye;
  activeCameraOrbit = {
    center,
    eyeOffset: [
      eye[0] - center[0],
      eye[1] - center[1],
      eye[2] - center[2]
    ],
    startAngle: 0,
    startTime: performance.now(),
    radiansPerSecond: Math.PI / 24
  };
}

function isFiniteAABB(aabb) {
  return !!aabb &&
    aabb.length === 6 &&
    aabb.every((value) => Number.isFinite(value)) &&
    aabb[3] > aabb[0] &&
    aabb[4] > aabb[1] &&
    aabb[5] > aabb[2];
}

function nextFrame() {
  return new Promise((resolve) => requestAnimationFrame(resolve));
}

function noPick() {
  return {
    ok: true,
    value: null
  };
}

function mustOk(result) {
  if (!result.ok) {
    throw new Error(result.error);
  }
  return result.value;
}

function updateStatus(message) {
  status.dataset.state = "";
  status.textContent = message;
}

function reportError(message) {
  hideProgress();
  status.dataset.state = "error";
  status.textContent = message;
  console.error("[formats_model_filedrop_barebones]", message);
}

function showProgress(label, current = 0, total = 0) {
  progressPanel.dataset.visible = "true";
  setProgress(label, current, total);
}

function updateLoadProgress(progress) {
  const phase = progress?.phase || "Loading";
  const detail = progress?.detail ? ` - ${progress.detail}` : "";
  setProgress(`${phase}${detail}`, Number(progress?.current || 0), Number(progress?.total || 0));
}

function setProgress(label, current, total) {
  progressLabel.textContent = label;
  const determinate = Number.isFinite(current) && Number.isFinite(total) && total > 0;
  progressPanel.dataset.indeterminate = determinate ? "false" : "true";
  if (determinate) {
    const percent = Math.min(100, Math.max(0, (current / total) * 100));
    progressBar.style.width = `${percent.toFixed(1)}%`;
    progressBar.style.left = "0";
  } else {
    progressBar.style.width = "";
    progressBar.style.left = "";
  }
}

function hideProgress() {
  progressPanel.dataset.visible = "false";
  progressPanel.dataset.indeterminate = "false";
  progressBar.style.width = "0";
  progressBar.style.left = "0";
}

async function paintProgress() {
  await nextFrame();
  await nextFrame();
}

function normalizeDroppedPath(path) {
  return String(path || "")
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .replace(/\/+/g, "/");
}

function dirnamePath(path) {
  const normalized = normalizeDroppedPath(path);
  const slash = normalized.lastIndexOf("/");
  return slash >= 0 ? normalized.slice(0, slash) : "";
}

function basenamePath(path) {
  const normalized = normalizeDroppedPath(path);
  const slash = normalized.lastIndexOf("/");
  return slash >= 0 ? normalized.slice(slash + 1) : normalized;
}
