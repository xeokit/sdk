import * as xeokit from "../../../../js/xeokit-studio-bundle.js";
import {signalExampleLoadedOnNextRender} from "../../../utils/snapshotReady.js";

const webglCanvas = document.getElementById("webglCanvas");
const webgpuCanvas = document.getElementById("webgpuCanvas");
const webglStatus = document.getElementById("webglStatus");
const webgpuStatus = document.getElementById("webgpuStatus");
const shadowControls = document.getElementById("shadowControls");

const WORLD_UP = [0, 0, 1];
const SHADOW_DIRECTION = normalize3([-0.42, -0.34, -0.84]);
const SKY_COLOR = [0.62, 0.70, 0.82];
const HORIZON_COLOR = [0.78, 0.82, 0.88];
const GROUND_COLOR = [0.30, 0.30, 0.27];

const SHADOW_DEFAULTS = {
  enabled: true,
  intensity: 0.62,
  bias: 0.001,
  normalOffsetBias: 0.0035,
  slopeBias: 0.00125,
  resolution: 2048,
  pcfKernelSize: 3,
  cascadeCount: 4,
  cascadeSplitLambda: 0.50,
  maxDistance: 38,
  padding: 1.12
};

const CONTROL_DEFS = [
  {id: "enabled", label: "Shadows", type: "toggle"},
  {id: "intensity", label: "Intensity", min: 0, max: 1, step: 0.01, digits: 2},
  {id: "bias", label: "Bias", min: 0, max: 0.01, step: 0.00025, digits: 4},
  {id: "normalOffsetBias", label: "Normal", min: 0, max: 0.04, step: 0.001, digits: 3},
  {id: "slopeBias", label: "Slope", min: 0, max: 0.01, step: 0.00025, digits: 4},
  {id: "pcfKernelSize", label: "PCF", type: "select", options: [1, 3, 5, 7]},
  {id: "cascadeCount", label: "Cascades", type: "select", options: [1, 2, 3, 4, 6]},
  {id: "cascadeSplitLambda", label: "Split", min: 0, max: 1, step: 0.01, digits: 2},
  {id: "resolution", label: "Res", type: "select", options: [512, 1024, 2048, 4096]}
];

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  setStatus(webglStatus, "error", message);
  setStatus(webgpuStatus, "error", message);
  console.error("[view/renderers/webgl-webgpu-shadow-parity]", error);
});

async function main() {
  const {Scene} = xeokit.model.scene;
  const {AmbientLight, DirLight, Viewer} = xeokit.viewing.viewer;
  const {ModelNavigationController} = xeokit.viewing.navigation.model;
  const {WebGLRenderer} = xeokit.viewing.renderers.webGL;
  const {WebGPURenderer} = xeokit.viewing.renderers.webGPU;
  const {BVHPickStrategy, RoutingPickStrategy} = xeokit.spatial.picking;

  const scene = new Scene({logging: false});
  const sceneModel = mustCreate(scene.createModel({
    id: "shadowParity",
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
    backgroundColor: [0.94, 0.96, 0.98],
    camera: {
      projection: "perspective",
      eye: [6.8, -10.8, 9.2],
      look: [0.0, 0.0, 0.42],
      up: WORLD_UP,
      far: 1000
    },
    effects: {
      sky: {
        enabled: true,
        skyColor: SKY_COLOR,
        horizonColor: HORIZON_COLOR,
        groundColor: GROUND_COLOR,
        horizonBlend: 0.32,
        sunEnabled: true,
        sunDirection: normalize3([0.35, 0.52, 0.78]),
        sunColor: [1.0, 0.94, 0.80],
        sunAngularSize: 2.2,
        sunGlowSize: 12,
        sunGlowIntensity: 0.12,
        worldUp: WORLD_UP
      },
      shadows: {
        enabled: SHADOW_DEFAULTS.enabled,
        intensity: SHADOW_DEFAULTS.intensity,
        bias: SHADOW_DEFAULTS.bias,
        normalOffsetBias: SHADOW_DEFAULTS.normalOffsetBias,
        slopeBias: SHADOW_DEFAULTS.slopeBias,
        direction: SHADOW_DIRECTION,
        autoFit: true,
        maxDistance: SHADOW_DEFAULTS.maxDistance,
        padding: SHADOW_DEFAULTS.padding,
        pcfKernelSize: SHADOW_DEFAULTS.pcfKernelSize,
        cascadeCount: SHADOW_DEFAULTS.cascadeCount,
        cascadeSplitLambda: SHADOW_DEFAULTS.cascadeSplitLambda,
        resolution: SHADOW_DEFAULTS.resolution
      },
      tonemap: {
        enabled: true,
        mode: "aces",
        sRGBEncode: true
      },
      sao: {
        enabled: false
      },
      bloom: {
        enabled: false
      },
      edges: {
        enabled: false
      }
    }
  };

  const webglViewer = new Viewer({scene, logging: false});
  const webgpuViewer = new Viewer({scene, logging: false});
  const webglView = mustCreate(webglViewer.createView({
    id: "shadowParityWebGL",
    htmlElement: webglCanvas,
    ...clone(viewParams)
  }));
  const webgpuView = mustCreate(webgpuViewer.createView({
    id: "shadowParityWebGPU",
    htmlElement: webgpuCanvas,
    ...clone(viewParams)
  }));

  configureLights(webglView, AmbientLight, DirLight);
  configureLights(webgpuView, AmbientLight, DirLight);
  syncViewCameras(webglView, webgpuView);
  setupShadowControls([webglView, webgpuView]);

  const webglRenderer = new WebGLRenderer({
    viewer: webglViewer,
    logging: false
  });
  const webglPicker = new RoutingPickStrategy(scene, webglRenderer);
  createInputController(ModelNavigationController, webglView, webglPicker);
  setStatus(webglStatus, "ok", `8 opaque/cutout casters, translucent BLEND card, and receiver. ${SHADOW_DEFAULTS.resolution}px, ${SHADOW_DEFAULTS.pcfKernelSize}x${SHADOW_DEFAULTS.pcfKernelSize} PCF.`);

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
        console.error("[view/renderers/webgl-webgpu-shadow-parity] WebGPU", error.error);
      });
      const webgpuPicker = new BVHPickStrategy(scene);
      createInputController(ModelNavigationController, webgpuView, webgpuPicker);
      setStatus(webgpuStatus, "ok", `8 opaque/cutout casters, translucent BLEND card, and receiver. ${SHADOW_DEFAULTS.resolution}px, ${SHADOW_DEFAULTS.pcfKernelSize}x${SHADOW_DEFAULTS.pcfKernelSize} PCF.`);
    } else {
      setStatus(webgpuStatus, "warn", result.error);
    }
  } else {
    setStatus(webgpuStatus, "warn", "WebGPU unavailable in this browser.");
  }

  webglView.needsRender();
  webgpuView.needsRender();
  signalExampleLoadedOnNextRender(webglRenderer, webglView);

  window.webglWebgpuShadowParityDemo = {
    scene,
    sceneModel,
    webglViewer,
    webgpuViewer,
    webglView,
    webgpuView,
    webglRenderer,
    webgpuRenderer
  };
}

function buildScene(sceneModel) {
  createTextures(sceneModel);
  createGeometries(sceneModel);
  createMaterials(sceneModel);

  let next = 0;
  const place = (geometryId, materialId, position, scale, rotation = [0, 0, 0], options = {}) => {
    const meshId = `mesh_${next}`;
    const objectId = `object_${next}`;
    next++;
    mustCreate(sceneModel.createMesh({
      id: meshId,
      geometryId,
      materialId,
      castsShadow: options.castsShadow !== false,
      matrix: xeokit.model.scene.buildMat4({position, scale, rotation})
    }));
    mustCreate(sceneModel.createObject({
      id: objectId,
      meshIds: [meshId],
      castsShadow: options.castsShadow !== false
    }));
  };

  place("box", "floor", [0, 0, -0.06], [11.8, 5.4, 0.06], [0, 0, 0], {castsShadow: false});
  place("box", "matteBlock", [-4.10, -1.02, 0.58], [0.50, 0.50, 0.58]);
  place("sphere", "smoothCaster", [-2.95, -1.06, 0.48], [0.38, 0.38, 0.38]);
  place("thinSlab", "slab", [-1.80, -1.04, 0.70], [0.10, 0.68, 0.70], [0, 0, -8]);
  place("verticalCard", "alphaLeaves", [-0.62, -1.05, 0.72], [0.84, 0.84, 0.84], [0, 0, 0]);
  place("box", "stepBlock", [0.72, -1.06, 0.30], [0.42, 0.42, 0.30]);
  place("box", "normalTile", [1.78, -1.06, 0.16], [0.50, 0.50, 0.16]);
  place("box", "normalBlock", [2.82, -1.06, 0.34], [0.40, 0.40, 0.34]);
  place("sphere", "lowRoughness", [3.88, -1.06, 0.40], [0.36, 0.36, 0.36]);
  place("verticalCard", "blendTint", [5.02, -1.05, 0.72], [0.84, 0.84, 0.84], [0, 0, 0]);
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
    widthSegments: 40,
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
    id: "thinSlab",
    primitive: TrianglesPrimitive,
    positions: box.positions,
    normals: box.normals,
    uvs: box.uv,
    indices: box.indices
  }));

  mustCreate(sceneModel.createGeometry({
    id: "verticalCard",
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

function createMaterials(sceneModel) {
  mustCreate(sceneModel.createMaterial({
    id: "floor",
    color: [0.56, 0.58, 0.60],
    roughness: 0.72,
    metallic: 0
  }));
  mustCreate(sceneModel.createMaterial({
    id: "matteBlock",
    color: [0.68, 0.35, 0.24],
    roughness: 0.82,
    metallic: 0
  }));
  mustCreate(sceneModel.createMaterial({
    id: "smoothCaster",
    color: [0.30, 0.54, 0.72],
    roughness: 0.54,
    metallic: 0
  }));
  mustCreate(sceneModel.createMaterial({
    id: "slab",
    color: [0.33, 0.34, 0.38],
    roughness: 0.66,
    metallic: 0
  }));
  mustCreate(sceneModel.createMaterial({
    id: "stepBlock",
    color: [0.58, 0.48, 0.28],
    roughness: 0.76,
    metallic: 0
  }));
  mustCreate(sceneModel.createMaterial({
    id: "alphaLeaves",
    color: [1, 1, 1],
    colorTextureId: "alphaLeaves",
    roughness: 0.70,
    metallic: 0,
    alphaMode: "MASK",
    alphaCutoff: 0.52
  }));
  mustCreate(sceneModel.createMaterial({
    id: "blendTint",
    color: [0.62, 0.88, 0.96],
    opacity: 0.42,
    roughness: 0.28,
    metallic: 0,
    alphaMode: "BLEND"
  }));
  mustCreate(sceneModel.createMaterial({
    id: "normalTile",
    color: [0.42, 0.45, 0.51],
    normalsTextureId: "normalRipples",
    roughness: 0.60,
    metallic: 0
  }));
  mustCreate(sceneModel.createMaterial({
    id: "normalBlock",
    color: [0.50, 0.46, 0.70],
    normalsTextureId: "normalRipples",
    roughness: 0.48,
    metallic: 0
  }));
  mustCreate(sceneModel.createMaterial({
    id: "lowRoughness",
    color: [0.78, 0.70, 0.40],
    roughness: 0.18,
    metallic: 0.15
  }));
}

function createTextures(sceneModel) {
  const {LinearEncoding, LinearMipmapLinearFilter, RepeatWrapping, sRGBEncoding} = xeokit.base.constants;
  mustCreate(sceneModel.createTexture({
    id: "alphaLeaves",
    image: makeAlphaLeavesCanvas(128),
    encoding: sRGBEncoding,
    minFilter: LinearMipmapLinearFilter,
    wrapS: RepeatWrapping,
    wrapT: RepeatWrapping,
    mipmap: true
  }));
  mustCreate(sceneModel.createTexture({
    id: "normalRipples",
    image: makeNormalCanvas(128),
    encoding: LinearEncoding,
    minFilter: LinearMipmapLinearFilter,
    wrapS: RepeatWrapping,
    wrapT: RepeatWrapping,
    mipmap: true
  }));
}

function setupShadowControls(views) {
  if (!shadowControls) {
    return;
  }
  const state = {...SHADOW_DEFAULTS};
  const render = () => {
    shadowControls.replaceChildren(...CONTROL_DEFS.map((def) => createControl(def, state, (id, value) => {
      state[id] = value;
      applyShadowState(views, state);
      render();
    })));
  };
  render();
  applyShadowState(views, state);
}

function createControl(def, state, onChange) {
  if (def.type === "toggle") {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "toggle";
    button.textContent = def.label;
    button.setAttribute("aria-pressed", state[def.id] ? "true" : "false");
    button.addEventListener("click", () => onChange(def.id, !state[def.id]));
    return button;
  }
  const wrapper = document.createElement("label");
  wrapper.className = "control";
  const text = document.createElement("span");
  text.textContent = def.label;
  wrapper.appendChild(text);
  let input;
  if (def.type === "select") {
    input = document.createElement("select");
    for (const value of def.options) {
      const option = document.createElement("option");
      option.value = String(value);
      option.textContent = String(value);
      option.selected = value === state[def.id];
      input.appendChild(option);
    }
  } else {
    input = document.createElement("input");
    input.type = "range";
    input.min = String(def.min);
    input.max = String(def.max);
    input.step = String(def.step);
    input.value = String(state[def.id]);
  }
  const output = document.createElement("output");
  output.textContent = formatValue(state[def.id], def.digits);
  input.addEventListener("input", () => {
    const value = def.type === "select" ? Number(input.value) : Number.parseFloat(input.value);
    onChange(def.id, value);
  });
  wrapper.appendChild(input);
  wrapper.appendChild(output);
  return wrapper;
}

function applyShadowState(views, state) {
  for (const view of views) {
    const shadows = view.effects.shadows;
    shadows.enabled = state.enabled;
    shadows.intensity = state.intensity;
    shadows.bias = state.bias;
    shadows.normalOffsetBias = state.normalOffsetBias;
    shadows.slopeBias = state.slopeBias;
    shadows.resolution = state.resolution;
    shadows.pcfKernelSize = state.pcfKernelSize;
    shadows.cascadeCount = state.cascadeCount;
    shadows.cascadeSplitLambda = state.cascadeSplitLambda;
    shadows.maxDistance = state.maxDistance;
    shadows.padding = state.padding;
    shadows.direction = SHADOW_DIRECTION;
    view.needsRender();
  }
}

function configureLights(view, AmbientLight, DirLight) {
  view.effects.sky.enabled = true;
  view.effects.sky.skyColor = SKY_COLOR;
  view.effects.sky.horizonColor = HORIZON_COLOR;
  view.effects.sky.groundColor = GROUND_COLOR;
  view.effects.sky.worldUp = WORLD_UP;
  view.effects.tonemap.enabled = true;
  view.effects.tonemap.mode = "aces";
  view.effects.tonemap.sRGBEncode = true;
  view.effects.sao.enabled = false;
  view.effects.bloom.enabled = false;
  view.effects.edges.enabled = false;
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
  view.lights.hemispheric.enabled = true;
  view.lights.hemispheric.intensity = 0.16;
  view.lights.hemispheric.skyColor = SKY_COLOR;
  view.lights.hemispheric.groundColor = GROUND_COLOR;
  view.lights.hemispheric.worldUp = WORLD_UP;
  view.lights.ibl.enabled = false;
  view.clearLights();
  new AmbientLight(view, {
    color: [1, 1, 1],
    intensity: 0.26
  });
  new DirLight(view, {
    dir: SHADOW_DIRECTION,
    color: [1.0, 0.96, 0.88],
    intensity: 0.95,
    space: "world"
  });
}

function createInputController(ModelNavigationController, view, pickStrategy) {
  try {
    return new ModelNavigationController(view, {
      pick: (_view, pickParams) => adaptPickResult(_view, pickStrategy.pick({
        view: _view,
        ...pickParams
      })),
      keyboardEnabled: true
    });
  } catch {
    return new ModelNavigationController(view, {
      pick: (_view, pickParams) => adaptPickResult(_view, pickStrategy.pick({
        view: _view,
        ...pickParams
      }))
    });
  }
}

function adaptPickResult(view, pickResult) {
  if (!pickResult || !pickResult.hit) {
    return {
      ok: true,
      value: null
    };
  }
  return {
    ok: true,
    value: {
      ...pickResult,
      viewObject: pickResult.objectId ? view.objects[pickResult.objectId] || null : null,
      snappedToVertex: pickResult.snap?.type === "vertex",
      snappedToEdge: pickResult.snap?.type === "edge",
      snappedCanvasPos: pickResult.snap?.canvasPos || null
    }
  };
}

function syncViewCameras(viewA, viewB) {
  let syncing = false;
  const sync = (source, target) => {
    if (syncing) {
      return;
    }
    syncing = true;
    target.camera.eye = Array.from(source.camera.eye);
    target.camera.look = Array.from(source.camera.look);
    target.camera.up = Array.from(source.camera.up);
    syncing = false;
  };
  viewA.viewer.events.onCameraViewMatrixUpdated.subscribe((changedView) => {
    if (changedView === viewA) {
      sync(viewA, viewB);
    }
  });
  viewB.viewer.events.onCameraViewMatrixUpdated.subscribe((changedView) => {
    if (changedView === viewB) {
      sync(viewB, viewA);
    }
  });
}

function makeAlphaLeavesCanvas(size) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  const image = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const nx = (x / size) * 2 - 1;
      const ny = (y / size) * 2 - 1;
      const leafA = Math.pow((nx + 0.34) / 0.52, 2) + Math.pow((ny - 0.08) / 0.24, 2) < 1;
      const leafB = Math.pow((nx - 0.24) / 0.38, 2) + Math.pow((ny + 0.26) / 0.28, 2) < 1;
      const stem = Math.abs(nx + ny * 0.18) < 0.035 && ny > -0.72 && ny < 0.55;
      const opaque = leafA || leafB || stem;
      image.data[i] = opaque ? 48 : 36;
      image.data[i + 1] = opaque ? 132 : 78;
      image.data[i + 2] = opaque ? 54 : 38;
      image.data[i + 3] = opaque ? 255 : 0;
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
      const sx = Math.sin((x / size) * Math.PI * 10);
      const sy = Math.cos((y / size) * Math.PI * 10);
      image.data[i] = Math.round(128 + sx * 34);
      image.data[i + 1] = Math.round(128 + sy * 34);
      image.data[i + 2] = 244;
      image.data[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}

function normalize3(v) {
  const len = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / len, v[1] / len, v[2] / len];
}

function formatValue(value, digits = 0) {
  return Number(value).toFixed(digits);
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
