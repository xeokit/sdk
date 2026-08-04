import * as xeokit from "../../js/xeokit-studio-bundle.js";

const canvas = document.getElementById("demoCanvas");
const status = document.getElementById("status");
const dropOverlay = document.getElementById("dropOverlay");
const prompt = document.getElementById("prompt");
const progressPanel = document.getElementById("progressPanel");
const progressLabel = document.getElementById("progressLabel");
const progressBar = document.getElementById("progressBar");

const COORDINATE_SYSTEM = {
  basis: [1, 0, 0, 0, 1, 0, 0, 0, 1],
  origin: [0, 0, 0],
  units: "meters",
  scaleToMeters: 1
};

let scene;
let viewer;
let view;
let renderer;
let inputController;
let activeSceneModel = null;
let activeDataModel = null;
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
    effects: {
      sao: {renderModes: []},
      edges: {renderModes: []},
      bloom: {renderModes: []},
      atmosphere: {renderModes: []},
      depthOfField: {renderModes: []},
      tonemap: {renderModes: []},
      antiAliasing: {renderModes: []},
      shadows: {renderModes: []},
      sky: {renderModes: []},
      sectionPlaneCaps: {renderModes: []},
      bodyHatch: {renderModes: []}
    },
    lights: {
      ibl: {renderModes: []},
      hemispheric: {renderModes: []}
    },
    camera: {
      projection: "perspective",
      far: 1000000,
      eye: [8, -10, 7],
      look: [0, 0, 0],
      up: [0, 0, 1]
    }
  }));
  renderer = new WebGLRenderer({viewer});
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

  updateStatus("Drop a model file onto the canvas.");
  window.bareBonesModelFileDrop = {
    scene,
    data,
    viewer,
    view,
    renderer,
    inputController
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
    const file = event.dataTransfer?.files?.[0];
    if (!file) {
      return;
    }
    prompt.style.display = "none";
    dropOverlay.style.display = "none";
    try {
      await loadDroppedFile(file, data);
    } catch (error) {
      reportError(error instanceof Error ? error.message : String(error));
    }
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

function destroyActiveModels() {
  activeSceneModel?.destroy();
  activeDataModel?.destroy();
  activeSceneModel = null;
  activeDataModel = null;
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
