import * as xeokit from "../../../../js/xeokit-studio-bundle.js";
import {signalExampleLoadedOnNextRender} from "../../../utils/snapshotReady.js";

const webglCanvas = document.getElementById("webglCanvas");
const webgpuCanvas = document.getElementById("webgpuCanvas");
const webglStatus = document.getElementById("webglStatus");
const webgpuStatus = document.getElementById("webgpuStatus");
const modeControls = document.getElementById("modeControls");

const SKY_COLOR = [0.60, 0.70, 0.84];
const HORIZON_COLOR = [0.76, 0.80, 0.86];
const GROUND_COLOR = [0.31, 0.29, 0.25];
const WORLD_UP = [0, 0, 1];
const DEFAULT_SHADOW_DIRECTION = [-0.42, -0.34, -0.84];

const TRANSPARENCY_MODES = {
  opaqueReference: {
    label: "Opaque Ref",
    sky: false,
    tonemap: false,
    ibl: 0,
    hemisphere: 0,
    ambient: 0.40,
    directional: 0.85,
    sao: false,
    shadows: false,
    bloom: false
  },
  transparentOnly: {
    label: "Transparent",
    sky: true,
    tonemap: true,
    ibl: 0.16,
    hemisphere: 0.12,
    ambient: 0.28,
    directional: 0.85,
    sao: false,
    shadows: true,
    shadowIntensity: 0.50,
    bloom: false
  },
  alphaMask: {
    label: "Alpha Mask",
    sky: true,
    tonemap: true,
    ibl: 0,
    hemisphere: 0.18,
    ambient: 0.28,
    directional: 0.95,
    sao: false,
    shadows: true,
    bloom: false
  },
  saoBehindGlass: {
    label: "SAO + Glass",
    sky: true,
    tonemap: true,
    ibl: 0,
    hemisphere: 0.20,
    ambient: 0.30,
    directional: 0.80,
    sao: true,
    shadows: true,
    bloom: false
  },
  overlap: {
    label: "Overlap",
    sky: false,
    tonemap: true,
    ibl: 0,
    hemisphere: 0,
    ambient: 0.42,
    directional: 0.72,
    sao: false,
    shadows: true,
    shadowIntensity: 0.50,
    bloom: false
  },
  all: {
    label: "All Effects",
    sky: true,
    tonemap: true,
    ibl: 0.18,
    hemisphere: 0.12,
    ambient: 0.22,
    directional: 0.95,
    sao: true,
    shadows: true,
    shadowIntensity: 0.82,
    bloom: true
  }
};

main().catch((error) => {
  setStatus(webglStatus, "error", error instanceof Error ? error.message : String(error));
  setStatus(webgpuStatus, "error", error instanceof Error ? error.message : String(error));
  console.error("[view/renderers/webgl-webgpu-transparency-quality]", error);
});

async function main() {
  const {Scene} = xeokit.model.scene;
  const {AmbientLight, DirLight, Viewer} = xeokit.viewing.viewer;
  const {WebGLRenderer} = xeokit.viewing.renderers.webGL;
  const {WebGPURenderer} = xeokit.viewing.renderers.webGPU;
  const selectedMode = getSelectedMode();
  setupModeControls(selectedMode);

  const scene = new Scene({logging: false});
  const sceneModel = mustCreate(scene.createModel({
    id: "transparencyQuality",
    coordinateSystem: {
      basis: [
        1, 0, 0,
        0, 0, 1,
        0, 1, 0
      ],
      origin: [0, 0, 0],
      units: "meters",
      scaleToMeters: 1
    }
  }));

  buildScene(sceneModel);

  const viewParams = {
    backgroundColor: [0.96, 0.97, 0.98],
    camera: {
      projection: "perspective",
      eye: [4.1, -6.0, 3.0],
      look: [0.08, -0.58, 0.56],
      up: [0, 0, 1],
      far: 1000
    },
    effects: {
      sky: {
        enabled: true,
        skyColor: SKY_COLOR,
        horizonColor: HORIZON_COLOR,
        groundColor: GROUND_COLOR,
        horizonBlend: 0.28,
        sunEnabled: true,
        sunDirection: normalize3([0.3, 0.55, 0.78]),
        sunColor: [1.0, 0.94, 0.78],
        sunAngularSize: 2.4,
        sunGlowSize: 14,
        sunGlowIntensity: 0.16,
        worldUp: WORLD_UP
      },
      tonemap: {
        enabled: true,
        mode: "aces",
        sRGBEncode: true
      },
      sao: {
        enabled: true,
        intensity: 0.06,
        kernelRadius: 28
      },
      shadows: {
        enabled: false,
        intensity: 0.38,
        direction: DEFAULT_SHADOW_DIRECTION,
        pcfKernelSize: 3,
        resolution: 2048
      },
      edges: {
        enabled: false
      },
      bloom: {
        enabled: false,
        intensity: 0.12
      }
    }
  };

  const webglViewer = new Viewer({scene, logging: false});
  const webgpuViewer = new Viewer({scene, logging: false});

  const webglView = mustCreate(webglViewer.createView({
    id: "transparencyQualityWebGL",
    htmlElement: webglCanvas,
    ...clone(viewParams)
  }));
  const webgpuView = mustCreate(webgpuViewer.createView({
    id: "transparencyQualityWebGPU",
    htmlElement: webgpuCanvas,
    ...clone(viewParams)
  }));
  applyParityMode(webglView, selectedMode, AmbientLight, DirLight);
  applyParityMode(webgpuView, selectedMode, AmbientLight, DirLight);
  syncViewCameras(webglView, webgpuView);

  const webglRenderer = new WebGLRenderer({
    viewer: webglViewer,
    logging: false
  });
  setStatus(webglStatus, "ok", `${countItems(scene.objects)} transparent stress objects, ${TRANSPARENCY_MODES[selectedMode].label} mode.`);

  let webgpuRenderer = null;
  if (navigator.gpu) {
    const result = await WebGPURenderer.create({
      viewer: webgpuViewer,
      logging: false
    });
    if (result.ok) {
      webgpuRenderer = result.value;
      webgpuRenderer.events.onError.subscribe((_renderer, error) => {
        setStatus(webgpuStatus, "error", error.error);
        console.error("[view/renderers/webgl-webgpu-transparency-quality] WebGPU", error.error);
      });
      setStatus(webgpuStatus, "ok", `${countItems(scene.objects)} transparent stress objects, ${TRANSPARENCY_MODES[selectedMode].label} mode.`);
    } else {
      setStatus(webgpuStatus, "warn", result.error);
    }
  } else {
    setStatus(webgpuStatus, "warn", "Unavailable in this browser.");
  }

  webglView.needsRender();
  webgpuView.needsRender();
  signalExampleLoadedOnNextRender(webglRenderer, webglView);

  window.webglWebgpuTransparencyQualityDemo = {
    scene,
    sceneModel,
    webglViewer,
    webgpuViewer,
    webglView,
    webgpuView,
    webglRenderer,
    webgpuRenderer,
    mode: selectedMode
  };
}

function getSelectedMode() {
  const params = new URLSearchParams(window.location.search);
  const mode = params.get("mode") || window.location.hash.replace(/^#/, "");
  return Object.prototype.hasOwnProperty.call(TRANSPARENCY_MODES, mode) ? mode : "transparentOnly";
}

function setupModeControls(selectedMode) {
  if (!modeControls) {
    return;
  }
  modeControls.replaceChildren(...Object.entries(TRANSPARENCY_MODES).map(([mode, config]) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = config.label;
    button.dataset.mode = mode;
    button.setAttribute("aria-pressed", mode === selectedMode ? "true" : "false");
    button.addEventListener("click", () => {
      const url = new URL(window.location.href);
      url.searchParams.set("mode", mode);
      url.hash = "";
      window.location.href = url.toString();
    });
    return button;
  }));
}

function applyParityMode(view, modeKey, AmbientLight, DirLight) {
  const mode = TRANSPARENCY_MODES[modeKey] || TRANSPARENCY_MODES.transparentOnly;
  view.effects.sky.enabled = mode.sky;
  view.effects.sky.skyColor = SKY_COLOR;
  view.effects.sky.horizonColor = HORIZON_COLOR;
  view.effects.sky.groundColor = GROUND_COLOR;
  view.effects.sky.worldUp = WORLD_UP;
  view.effects.tonemap.enabled = mode.tonemap;
  view.effects.tonemap.mode = "aces";
  view.effects.tonemap.sRGBEncode = true;
  view.effects.sao.enabled = mode.sao;
  view.effects.sao.intensity = 0.06;
  view.effects.sao.kernelRadius = 28;
  view.effects.shadows.enabled = mode.shadows;
  view.effects.shadows.direction = DEFAULT_SHADOW_DIRECTION;
  view.effects.shadows.intensity = mode.shadowIntensity ?? 0.38;
  view.effects.shadows.pcfKernelSize = 3;
  view.effects.shadows.resolution = 2048;
  view.effects.edges.enabled = false;
  view.effects.bloom.enabled = mode.bloom;
  view.effects.bloom.intensity = 0.12;
  if (view.effects.atmosphere) {
    view.effects.atmosphere.enabled = false;
  }
  if (view.effects.depthOfField) {
    view.effects.depthOfField.enabled = false;
  }
  if (view.effects.colorGrading) {
    view.effects.colorGrading.enabled = false;
  }
  if (view.effects.antiAliasing) {
    view.effects.antiAliasing.enabled = true;
  }

  view.lights.hemispheric.enabled = mode.hemisphere > 0;
  view.lights.hemispheric.intensity = mode.hemisphere;
  view.lights.hemispheric.skyColor = SKY_COLOR;
  view.lights.hemispheric.groundColor = GROUND_COLOR;
  view.lights.hemispheric.worldUp = WORLD_UP;
  view.lights.ibl.enabled = mode.ibl > 0;
  view.lights.ibl.intensity = mode.ibl;
  view.clearLights();
  if (mode.ambient > 0) {
    new AmbientLight(view, {
      color: [1, 1, 1],
      intensity: mode.ambient
    });
  }
  if (mode.directional > 0) {
    new DirLight(view, {
      dir: DEFAULT_SHADOW_DIRECTION,
      color: [1, 0.96, 0.88],
      intensity: mode.directional,
      space: "world"
    });
  }
}

function buildScene(sceneModel) {
  createTextures(sceneModel);
  createGeometries(sceneModel);
  createMaterials(sceneModel);

  let next = 0;
  const place = (geometryId, materialId, position, scale, rotation = [0, 0, 0]) => {
    const meshId = `mesh_${next}`;
    const objectId = `object_${next}`;
    next++;
    mustCreate(sceneModel.createMesh({
      id: meshId,
      geometryId,
      materialId,
      matrix: xeokit.model.scene.buildMat4({position, scale, rotation})
    }));
    mustCreate(sceneModel.createObject({
      id: objectId,
      meshIds: [meshId]
    }));
  };

  place("box", "floor", [0, 0, -0.035], [4.8, 3.2, 0.035]);
  place("box", "matteBlock", [-1.85, -0.56, 0.42], [0.36, 0.36, 0.42]);
  place("sphere", "matteBall", [-1.20, -0.58, 0.34], [0.34, 0.34, 0.34]);
  place("box", "stripedBacker", [-0.08, -0.32, 0.56], [1.25, 0.055, 0.56]);
  place("box", "brightBacker", [1.42, -0.34, 0.46], [0.72, 0.055, 0.46]);

  place("plane", "maskFoliage", [-0.62, -0.88, 0.62], [0.70, 1, 0.70], [0, 0, -8]);
  place("plane", "blueGlass", [0.16, -0.96, 0.72], [0.82, 1, 0.82], [0, 0, 0]);
  place("plane", "amberGlass", [0.44, -1.08, 0.76], [0.82, 1, 0.82], [0, 0, 18]);
  place("plane", "greenGlass", [0.74, -1.20, 0.70], [0.78, 1, 0.78], [0, 0, -18]);
  place("sphere", "glossyGlass", [1.64, -0.92, 0.38], [0.38, 0.38, 0.38]);
  place("box", "blueGlass", [2.28, -0.92, 0.34], [0.30, 0.30, 0.34], [0, 0, 12]);

  place("plane", "maskFoliage", [-1.84, 0.34, 0.58], [0.74, 1, 0.74], [0, 0, 22]);
  place("plane", "frostedGlass", [-0.86, 0.24, 0.62], [0.86, 1, 0.70], [0, 0, -24]);
  place("plane", "lowAlphaGlass", [0.10, 0.18, 0.70], [0.80, 1, 0.80], [0, 0, 10]);
  place("sphere", "metalBehindGlass", [0.94, 0.22, 0.36], [0.36, 0.36, 0.36]);
}

function createGeometries(sceneModel) {
  const {TrianglesPrimitive} = xeokit.base.constants;
  const box = mustBuild(xeokit.model.generation.buildGeometry.buildBox({
    xSize: 1,
    ySize: 1,
    zSize: 1
  }));
  mustCreate(sceneModel.createGeometry({
    id: "box",
    primitive: TrianglesPrimitive,
    positions: box.positions,
    normals: box.normals,
    uvs: box.uv,
    indices: box.indices
  }));

  const sphere = mustBuild(xeokit.model.generation.buildGeometry.buildSphere({
    radius: 1,
    widthSegments: 36,
    heightSegments: 24
  }));
  mustCreate(sceneModel.createGeometry({
    id: "sphere",
    primitive: TrianglesPrimitive,
    positions: sphere.positions,
    normals: sphere.normals,
    uvs: sphere.uv,
    indices: sphere.indices
  }));

  mustCreate(sceneModel.createGeometry({
    id: "plane",
    primitive: TrianglesPrimitive,
    positions: [
      -0.5, 0, -0.5,
       0.5, 0, -0.5,
       0.5, 0,  0.5,
      -0.5, 0,  0.5
    ],
    normals: [
      0, -1, 0,
      0, -1, 0,
      0, -1, 0,
      0, -1, 0
    ],
    uvs: [
      0, 0,
      1, 0,
      1, 1,
      0, 1
    ],
    indices: [0, 1, 2, 0, 2, 3]
  }));
}

function createTextures(sceneModel) {
  const {LinearEncoding, LinearMipmapLinearFilter, RepeatWrapping, sRGBEncoding} = xeokit.base.constants;
  mustCreate(sceneModel.createTexture({
    id: "alphaPattern",
    image: makeAlphaPatternCanvas(96),
    encoding: sRGBEncoding,
    minFilter: LinearMipmapLinearFilter,
    wrapS: RepeatWrapping,
    wrapT: RepeatWrapping,
    mipmap: true
  }));
  mustCreate(sceneModel.createTexture({
    id: "mrBands",
    image: makeMetallicRoughnessCanvas(64),
    encoding: LinearEncoding,
    minFilter: LinearMipmapLinearFilter,
    wrapS: RepeatWrapping,
    wrapT: RepeatWrapping,
    mipmap: true
  }));
  mustCreate(sceneModel.createTexture({
    id: "normalRipples",
    image: makeNormalCanvas(96),
    encoding: LinearEncoding,
    minFilter: LinearMipmapLinearFilter,
    wrapS: RepeatWrapping,
    wrapT: RepeatWrapping,
    mipmap: true
  }));
  mustCreate(sceneModel.createTexture({
    id: "occlusionCorners",
    image: makeOcclusionCanvas(96),
    encoding: LinearEncoding,
    minFilter: LinearMipmapLinearFilter,
    wrapS: RepeatWrapping,
    wrapT: RepeatWrapping,
    mipmap: true
  }));
  mustCreate(sceneModel.createTexture({
    id: "emissiveBars",
    image: makeEmissiveCanvas(64),
    encoding: sRGBEncoding,
    minFilter: LinearMipmapLinearFilter,
    wrapS: RepeatWrapping,
    wrapT: RepeatWrapping,
    mipmap: true
  }));
}

function createMaterials(sceneModel) {
  mustCreate(sceneModel.createMaterial({
    id: "floor",
    color: [0.54, 0.57, 0.58],
    roughness: 0.82,
    metallic: 0
  }));
  mustCreate(sceneModel.createMaterial({
    id: "matteBlock",
    color: [0.76, 0.46, 0.26],
    roughness: 0.78,
    metallic: 0
  }));
  mustCreate(sceneModel.createMaterial({
    id: "matteBall",
    color: [0.20, 0.58, 0.72],
    roughness: 0.58,
    metallic: 0
  }));
  mustCreate(sceneModel.createMaterial({
    id: "maskFoliage",
    color: [1, 1, 1],
    roughness: 0.64,
    metallic: 0,
    colorTextureId: "alphaPattern",
    alphaMode: "MASK",
    alphaCutoff: 0.52
  }));
  mustCreate(sceneModel.createMaterial({
    id: "blueGlass",
    color: [0.32, 0.66, 1.0],
    opacity: 0.34,
    roughness: 0.04,
    metallic: 0,
    clearcoat: 1,
    clearcoatRoughness: 0.03,
    alphaMode: "BLEND"
  }));
  mustCreate(sceneModel.createMaterial({
    id: "amberGlass",
    color: [1.0, 0.72, 0.30],
    opacity: 0.30,
    roughness: 0.09,
    metallic: 0,
    alphaMode: "BLEND"
  }));
  mustCreate(sceneModel.createMaterial({
    id: "greenGlass",
    color: [0.28, 0.90, 0.58],
    opacity: 0.26,
    roughness: 0.10,
    metallic: 0,
    alphaMode: "BLEND"
  }));
  mustCreate(sceneModel.createMaterial({
    id: "frostedGlass",
    color: [0.78, 0.90, 1.0],
    opacity: 0.42,
    roughness: 0.58,
    metallic: 0,
    normalsTextureId: "normalRipples",
    alphaMode: "BLEND"
  }));
  mustCreate(sceneModel.createMaterial({
    id: "lowAlphaGlass",
    color: [0.95, 0.72, 1.0],
    opacity: 0.16,
    roughness: 0.18,
    metallic: 0,
    alphaMode: "BLEND"
  }));
  mustCreate(sceneModel.createMaterial({
    id: "glossyGlass",
    color: [0.82, 0.92, 1.0],
    opacity: 0.30,
    roughness: 0.03,
    metallic: 0,
    clearcoat: 1.0,
    clearcoatRoughness: 0.02,
    alphaMode: "BLEND"
  }));
  mustCreate(sceneModel.createMaterial({
    id: "stripedBacker",
    color: [1, 1, 1],
    roughness: 0.48,
    metallic: 0,
    colorTextureId: "emissiveBars",
    emissiveTextureId: "emissiveBars",
    emissiveColor: [0.20, 0.14, 0.06]
  }));
  mustCreate(sceneModel.createMaterial({
    id: "brightBacker",
    color: [0.86, 0.82, 0.60],
    roughness: 0.35,
    metallic: 0
  }));
  mustCreate(sceneModel.createMaterial({
    id: "metalBehindGlass",
    color: [0.74, 0.66, 0.46],
    roughness: 0.18,
    metallic: 1,
    metallicRoughnessTextureId: "mrBands"
  }));
}

function makeAlphaPatternCanvas(size) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  const image = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const band = (Math.floor(x / 12) + Math.floor(y / 12)) % 2;
      const circle = Math.hypot(x - size * 0.5, y - size * 0.5) < size * 0.24;
      image.data[i] = band ? 30 : 230;
      image.data[i + 1] = circle ? 120 : band ? 68 : 230;
      image.data[i + 2] = band ? 160 : 74;
      image.data[i + 3] = circle ? 64 : band ? 210 : 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}

function makeMetallicRoughnessCanvas(size) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  const image = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const roughness = Math.round(45 + 185 * (x / (size - 1)));
      image.data[i] = 255;
      image.data[i + 1] = roughness;
      image.data[i + 2] = 255;
      image.data[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}

function makeNormalCanvas(size) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  const image = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const sx = Math.sin((x / size) * Math.PI * 8);
      const sy = Math.cos((y / size) * Math.PI * 8);
      image.data[i] = Math.round(128 + sx * 36);
      image.data[i + 1] = Math.round(128 + sy * 36);
      image.data[i + 2] = 242;
      image.data[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}

function makeOcclusionCanvas(size) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  const image = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const edge = Math.min(x, y, size - 1 - x, size - 1 - y) / (size * 0.24);
      const value = Math.round(130 + 125 * Math.min(1, edge));
      image.data[i] = value;
      image.data[i + 1] = value;
      image.data[i + 2] = value;
      image.data[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}

function makeEmissiveCanvas(size) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  const image = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const stripe = Math.floor(x / 8) % 2 === 0;
      image.data[i] = stripe ? 255 : 28;
      image.data[i + 1] = stripe ? 190 : 34;
      image.data[i + 2] = stripe ? 82 : 42;
      image.data[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}

function syncViewCameras(viewA, viewB) {
  let syncing = false;
  const sync = (source, target) => {
    if (syncing) return;
    syncing = true;
    target.camera.eye = Array.from(source.camera.eye);
    target.camera.look = Array.from(source.camera.look);
    target.camera.up = Array.from(source.camera.up);
    syncing = false;
  };
  viewA.viewer.events.onCameraViewMatrixUpdated.subscribe((changedView) => {
    if (changedView === viewA) sync(viewA, viewB);
  });
  viewB.viewer.events.onCameraViewMatrixUpdated.subscribe((changedView) => {
    if (changedView === viewB) sync(viewB, viewA);
  });
}

function normalize3(v) {
  const len = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / len, v[1] / len, v[2] / len];
}

function countItems(map) {
  return map ? Object.keys(map).length : 0;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function setStatus(element, state, message) {
  element.dataset.state = state;
  element.textContent = message;
}

function mustCreate(result) {
  if (!result.ok) {
    throw new Error(result.error);
  }
  return result.value;
}

function mustBuild(result) {
  if (!result.ok) {
    throw new Error(result.error);
  }
  return result.value;
}
