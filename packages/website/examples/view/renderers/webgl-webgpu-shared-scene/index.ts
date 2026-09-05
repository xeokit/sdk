import {encodeRadianceHDR, paintSunSkyHDR} from "@xeokit/sdk/model/generation/paintEnvironments";
import {TrianglesPrimitive} from "@xeokit/sdk/base/constants";
import {GLTFLoader} from "@xeokit/sdk/formats/gltf";
import {Data} from "@xeokit/sdk/model/data";
import {buildBox} from "@xeokit/sdk/model/generation/buildGeometry";
import {Scene, buildMat4} from "@xeokit/sdk/model/scene";
import {getSceneCollisionIndex} from "@xeokit/sdk/spatial/collision";
import {BVHPickStrategy, RoutingPickStrategy} from "@xeokit/sdk/spatial/picking";
import {ModelNavigationController} from "@xeokit/sdk/viewing/navigation/model";
import {WebGLRenderer} from "@xeokit/sdk/viewing/renderers/webGL";
import {WebGPURenderer} from "@xeokit/sdk/viewing/renderers/webGPU";
import {AmbientLight, DirLight, Viewer} from "@xeokit/sdk/viewing/viewer";
import {fetchArrayBuffer, finishExample, mustOk} from "../../../utils/standaloneRuntime.js";

const HOUSE_PLAN_URL = "../../../../models/HousePlan/gltf/model.glb";

const webglCanvas = document.getElementById("webglCanvas");
const webgpuCanvas = document.getElementById("webgpuCanvas");
const webglStatus = document.getElementById("webglStatus");
const webgpuStatus = document.getElementById("webgpuStatus");
const dataStatus = document.getElementById("dataStatus");
const effectControls = document.getElementById("effectControls");

const SKY_COLOR = [0.62, 0.72, 0.88];
const HORIZON_COLOR = [0.74, 0.80, 0.88];
const GROUND_COLOR = [0.28, 0.25, 0.22];
const WORLD_UP = [0, 0, 1];
const SUN_DIRECTION = normalize3([0.35, 0.55, 0.76]);

const CAMERA_PRESETS = {
  default: {
    projection: "perspective",
    far: 1000000,
    eye: [1396.192488512606, -228.91295922593062, 7.605782942380627],
    look: [1389.9821022363608, -234.97883380249922, 1.9956860109231078],
    up: [-0.3882818817391334, -0.3792467944611508, 0.8398863311210985]
  },
  tv: {
    projection: "perspective",
    far: 1000000,
    eye: [1392.986, -232.044, 4.709],
    look: [1389.9821022363608, -234.97883380249922, 1.9956860109231078],
    up: [-0.3882818817391334, -0.3792467944611508, 0.8398863311210985]
  }
};

const DEFAULT_EFFECT_CONFIG = {
  ambientLight: true,
  directionalLight: true,
  hemisphereLight: true,
  sky: true,
  grid: true,
  ibl: true,
  sao: true,
  bloom: true,
  atmosphere: true,
  depthOfField: true,
  colorGrading: true,
  shadows: true,
  tonemap: true,
  srgb: true,
  antialiasing: true,
  edges: false
};

const EFFECT_PRESETS = {
  all: DEFAULT_EFFECT_CONFIG,
  direct: {
    ...DEFAULT_EFFECT_CONFIG,
    hemisphereLight: false,
    sky: false,
    grid: false,
    ibl: false,
    sao: false,
    bloom: false,
    atmosphere: false,
    depthOfField: false,
    colorGrading: false,
    shadows: false
  },
  linearDirect: {
    ...DEFAULT_EFFECT_CONFIG,
    hemisphereLight: false,
    sky: false,
    grid: false,
    ibl: false,
    sao: false,
    bloom: false,
    atmosphere: false,
    depthOfField: false,
    colorGrading: false,
    shadows: false,
    tonemap: false,
    srgb: false
  },
  noIbl: {
    ...DEFAULT_EFFECT_CONFIG,
    ibl: false
  },
  noPost: {
    ...DEFAULT_EFFECT_CONFIG,
    sao: false,
    bloom: false,
    atmosphere: false,
    depthOfField: false,
    colorGrading: false
  }
};

const EFFECT_BUTTONS = [
  ["ambientLight", "Ambient"],
  ["directionalLight", "Dir"],
  ["hemisphereLight", "Hemisphere"],
  ["sky", "Sky"],
  ["grid", "Grid"],
  ["ibl", "IBL"],
  ["sao", "SAO"],
  ["bloom", "Bloom"],
  ["atmosphere", "Atmosphere"],
  ["depthOfField", "DOF"],
  ["colorGrading", "Color"],
  ["shadows", "Shadows"],
  ["tonemap", "Tonemap"],
  ["srgb", "sRGB"],
  ["antialiasing", "AA"],
  ["edges", "Edges"]
];

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  setStatus(webglStatus, "error", "WebGL", message);
  setStatus(webgpuStatus, "error", "WebGPU", message);
  dataStatus.textContent = message;
  console.error("[view/renderers/webgl-webgpu-shared-scene]", error);
});

async function main() {
  const scene = new Scene({logging: false});
  const data = new Data({logging: false});
  const dataModel = mustOk(data.createModel({
    id: "housePlan",
    schema: "glTF"
  }));
  const sceneModel = mustOk(scene.createModel({
    id: "housePlan",
    coordinateSystem: {
      basis: [
        1, 0, 0,
        0, 1, 0,
        0, 0, 1
      ],
      origin: [0, 0, 0],
      units: "meters",
      scaleToMeters: 1
    }
  }));
  const probeSceneModel = mustOk(scene.createModel({
    id: "materialLayerProbes",
    coordinateSystem: {
      basis: [
        1, 0, 0,
        0, 1, 0,
        0, 0, 1
      ],
      origin: [0, 0, 0],
      units: "meters",
      scaleToMeters: 1
    }
  }));

  const options = getExampleOptions();
  const camera = clone(CAMERA_PRESETS[options.camera]);

  const viewParams = {
    backgroundColor: [0.96, 0.97, 0.98],
    camera,
    effects: {
      sky: {
        enabled: true,
        skyColor: SKY_COLOR,
        horizonColor: HORIZON_COLOR,
        groundColor: GROUND_COLOR,
        horizonBlend: 0.28,
        sunEnabled: true,
        sunDirection: SUN_DIRECTION,
        sunColor: [1.0, 0.92, 0.72],
        sunAngularSize: 2.8,
        sunGlowSize: 16,
        sunGlowIntensity: 0.2,
        worldUp: WORLD_UP
      },
      tonemap: {
        sRGBEncode: true
      }
    }
  };

  const fileData = await fetchArrayBuffer(HOUSE_PLAN_URL);
  await new GLTFLoader().load({
    fileData,
    sceneModel,
    dataModel
  });
  const materialProbes = createMaterialComparisonStrip(probeSceneModel);
  if (countItems(dataModel.objects) === 0) {
    createDataObjectsForScene(dataModel, scene.objects);
  }
  createMaterialProbeDataObjects(dataModel, materialProbes);
  const collisionIndex = getSceneCollisionIndex(scene);
  collisionIndex.rebuild();

  const webglViewer = new Viewer({scene, logging: false});
  const webgpuViewer = new Viewer({scene, logging: false});

  const webglView = mustOk(webglViewer.createView({
    id: "sharedHousePlanWebGLView",
    htmlElement: webglCanvas,
    ...clone(viewParams)
  }));

  const webgpuView = mustOk(webgpuViewer.createView({
    id: "sharedHousePlanWebGPUView",
    htmlElement: webgpuCanvas,
    ...clone(viewParams)
  }));
  syncViewCameras(webglView, webgpuView);
  const effectRuntime = createEffectRuntime(AmbientLight, DirLight);

  setupEffectControls([webglView, webgpuView], effectRuntime, options.effects);

  const webglRenderer = new WebGLRenderer({
    viewer: webglViewer,
    logging: false
  });
  registerEffectRenderer(webglRenderer, effectRuntime);
  const webglPicker = new RoutingPickStrategy(scene, webglRenderer);
  const webgpuPicker = new BVHPickStrategy(scene);

  const webglController = createInputController(ModelNavigationController, webglView, webglPicker);
  wirePickStatus(webglController, webglStatus, "WebGL");
  setStatus(webglStatus, "ok", "WebGL", "Rendering House Plan from the shared Scene.");

  let webgpuRenderer = null;
  let webgpuController = null;

  if (navigator.gpu) {
    const rendererResult = await WebGPURenderer.create({
      viewer: webgpuViewer,
      logging: false,
      renderConfigs: options.webgpuRenderConfigs
    });

    if (rendererResult.ok) {
      webgpuRenderer = rendererResult.value;
      webgpuRenderer.events.onError.subscribe((_renderer, error) => {
        setStatus(webgpuStatus, "error", "WebGPU", error.error);
        console.error("[view/renderers/webgl-webgpu-shared-scene] WebGPU", error.error);
      });
      registerEffectRenderer(webgpuRenderer, effectRuntime);
      webgpuController = createInputController(ModelNavigationController, webgpuView, webgpuPicker);
      wirePickStatus(webgpuController, webgpuStatus, "WebGPU");
      setStatus(webgpuStatus, "ok", "WebGPU", "Rendering House Plan from the shared Scene.");
    } else {
      setStatus(webgpuStatus, "warn", "WebGPU", rendererResult.error);
    }
  } else {
    setStatus(webgpuStatus, "warn", "WebGPU", "Unavailable in this browser.");
  }

  dataStatus.textContent = `Shared Data: ${countItems(dataModel.objects)} objects. Shared AABB index: ${collisionIndex.size} pickable objects, including five material-layer probes.`;

  finishExample(webglRenderer, webglView);

  window.addEventListener("resize", () => {
  });

  window.webglWebgpuSharedSceneDemo = {
    scene,
    data,
    dataModel,
    sceneModel,
    probeSceneModel,
    collisionIndex,
    webglViewer,
    webglView,
    webglRenderer,
    webglPicker,
    webglController,
    webgpuViewer,
    webgpuView,
    webgpuRenderer,
    webgpuPicker,
    webgpuController
  };
}


function createInputController(InputController, view, picker) {
  return new InputController(view, {
    pick: (_view, pickParams) => adaptPickResult(_view, picker.pick({
      view: _view,
      ...pickParams
    })),
    followPointer: true,
    rotationInertia: 0,
    panInertia: 0,
    dollyInertia: 0,
    doublePickFlyTo: true,
    keyboardDollyRate: 12,
    keyboardPanRate: 5,
    mouseWheelDollyRate: 90,
    touchDollyRate: 0.18
  });
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

function wirePickStatus(controller, statusElement, title) {
  const update = (_controller, pickResult) => {
    const id = pickResult?.viewObject?.id || pickResult?.objectId;
    if (id) {
      setStatus(statusElement, "ok", title, `Rendering House Plan. Picked ${id}.`);
    }
  };
  controller.events.onPicked.subscribe(update);
  controller.events.onDoublePicked.subscribe(update);
}

function syncViewCameras(viewA, viewB) {
  let syncing = false;
  const sync = (source, target) => {
    if (syncing) {
      return;
    }
    if (sameVec3(source.camera.eye, target.camera.eye) &&
      sameVec3(source.camera.look, target.camera.look) &&
      sameVec3(source.camera.up, target.camera.up)) {
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

function sameVec3(a, b) {
  return Math.abs(a[0] - b[0]) < 1e-9 &&
    Math.abs(a[1] - b[1]) < 1e-9 &&
    Math.abs(a[2] - b[2]) < 1e-9;
}

function getExampleOptions() {
  const params = new URLSearchParams(window.location.search);
  const camera = params.get("audit") || params.get("camera") || "default";
  const effects = params.get("effects") || "all";
  const webgpuTransparentSort = params.get("webgpuTransparentSort");
  const webgpuDepthPrepass = params.get("webgpuDepthPrepass");
  const webgpuRenderConfigs = {};
  if (webgpuTransparentSort === "object" || webgpuTransparentSort === "segment") {
    webgpuRenderConfigs.transparentSortStrategy = webgpuTransparentSort;
  }
  if (webgpuDepthPrepass === "false" || webgpuDepthPrepass === "true") {
    webgpuRenderConfigs.depthPrepass = webgpuDepthPrepass === "true";
  }
  return {
    camera: Object.prototype.hasOwnProperty.call(CAMERA_PRESETS, camera) ? camera : "default",
    effects: Object.prototype.hasOwnProperty.call(EFFECT_PRESETS, effects) ? effects : "all",
    webgpuRenderConfigs
  };
}

function setupEffectControls(views, runtime, presetName) {
  const state = {...EFFECT_PRESETS[presetName]};
  runtime.state = state;
  applySharedEffectConfig(views, state, runtime);
  renderEffectControls(state);

  effectControls.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-effect]");
    if (!button) {
      return;
    }
    const field = button.dataset.effect;
    state[field] = !state[field];
    applySharedEffectConfig(views, state, runtime);
    renderEffectControls(state);
  });

  window.webglWebgpuSharedSceneEffects = {
    state,
    apply: () => {
      applySharedEffectConfig(views, state, runtime);
      renderEffectControls(state);
    }
  };
}

function renderEffectControls(state) {
  effectControls.innerHTML = EFFECT_BUTTONS.map(([field, label]) => {
    const active = state[field];
    return `<button type="button" class="${active ? "is-active" : ""}" data-effect="${field}" aria-pressed="${active ? "true" : "false"}">${escapeHTML(label)}</button>`;
  }).join("");
}

function createEffectRuntime(AmbientLight, DirLight) {
  return {
    AmbientLight,
    DirLight,
    iblReady: new WeakSet(),
    renderers: new Set(),
    state: null
  };
}

function registerEffectRenderer(renderer, runtime) {
  runtime.renderers.add(renderer);
  if (runtime.state) {
    applyRendererEffectConfig(renderer, runtime.state);
  }
}

function applySharedEffectConfig(views, state, runtime) {
  for (const view of views) {
    applyViewEffectConfig(view, state, runtime);
  }
  for (const renderer of runtime.renderers) {
    applyRendererEffectConfig(renderer, state);
  }
}

function applyRendererEffectConfig(renderer, state) {
  const result = renderer.setInfiniteGridEnabled(state.grid);
  if (!result.ok) {
    console.error("[view/renderers/webgl-webgpu-shared-scene] Grid", result.error);
  }
}

function applyViewEffectConfig(view, state, runtime) {
  view.effects.edges.enabled = state.edges;
  view.effects.tonemap.enabled = state.tonemap;
  view.effects.tonemap.mode = "aces";
  view.effects.tonemap.sRGBEncode = state.srgb;
  view.effects.sao.enabled = state.sao;
  view.effects.bloom.enabled = state.bloom;
  view.effects.sky.enabled = state.sky;
  view.effects.atmosphere.enabled = state.atmosphere;
  view.effects.depthOfField.enabled = state.depthOfField;
  view.effects.colorGrading.enabled = state.colorGrading;
  view.effects.shadows.enabled = state.shadows;
  view.effects.antiAliasing.enabled = state.antialiasing;
  view.effects.antiAliasing.mode = "smaa";

  view.lights.hemispheric.enabled = state.hemisphereLight;
  view.lights.hemispheric.intensity = state.hemisphereLight ? 0.35 : 0;
  view.lights.hemispheric.skyColor = SKY_COLOR;
  view.lights.hemispheric.groundColor = GROUND_COLOR;
  view.lights.hemispheric.worldUp = WORLD_UP;

  view.lights.ibl.enabled = state.ibl;
  view.lights.ibl.intensity = state.ibl ? 0.9 : 0;
  if (state.ibl) {
    ensureIBL(view, runtime);
  }

  view.clearLights();
  if (state.ambientLight) {
    new runtime.AmbientLight(view, {
      color: [1, 1, 1],
      intensity: 0.35
    });
  }
  if (state.directionalLight) {
    new runtime.DirLight(view, {
      dir: view.effects.shadows.direction,
      color: [1.0, 0.96, 0.86],
      intensity: 1.4,
      space: "world"
    });
  }

  view.effects.sao.intensity = 0.18;
  view.effects.sao.kernelRadius = 28;
  view.effects.sao.numSamples = 24;

  view.effects.bloom.threshold = 0.7;
  view.effects.bloom.knee = 0.35;
  view.effects.bloom.intensity = view.id.includes("WebGPU") ? 0.5 : 0.35;

  view.effects.sky.skyColor = SKY_COLOR;
  view.effects.sky.horizonColor = HORIZON_COLOR;
  view.effects.sky.groundColor = GROUND_COLOR;
  view.effects.sky.horizonBlend = 0.28;
  view.effects.sky.sunEnabled = state.sky;
  view.effects.sky.sunDirection = SUN_DIRECTION;
  view.effects.sky.sunColor = [1.0, 0.92, 0.72];
  view.effects.sky.sunAngularSize = 2.8;
  view.effects.sky.sunGlowSize = 16;
  view.effects.sky.sunGlowIntensity = 0.2;
  view.effects.sky.worldUp = WORLD_UP;

  view.effects.atmosphere.color = [0.72, 0.82, 0.92];
  view.effects.atmosphere.startDistance = 30;
  view.effects.atmosphere.endDistance = 140;
  view.effects.atmosphere.intensity = 0.35;
  view.effects.atmosphere.maxOpacity = 0.32;
  view.effects.atmosphere.affectSky = false;

  view.effects.depthOfField.focusDistance = 8;
  view.effects.depthOfField.focalRange = 12;
  view.effects.depthOfField.radius = 4;
  view.effects.depthOfField.intensity = 0.45;
  view.effects.depthOfField.nearBlur = 0.05;
  view.effects.depthOfField.farBlur = 0.8;

  view.effects.colorGrading.brightness = 0.02;
  view.effects.colorGrading.contrast = 1.12;
  view.effects.colorGrading.saturation = 1.08;
  view.effects.colorGrading.gamma = 1.0;
  view.effects.colorGrading.temperature = 0.08;
  view.effects.colorGrading.tint = -0.02;

  view.effects.shadows.intensity = 0.55;
  view.effects.shadows.direction = [-0.35, -0.55, -0.76];
  view.effects.shadows.bias = 0.00045;
  view.effects.shadows.slopeBias = 0.00065;
  view.effects.shadows.resolution = 2048;
  view.effects.shadows.cascadeCount = 4;
  view.effects.shadows.pcfKernelSize = 5;
  view.effects.shadows.contactHardening = true;
  view.effects.shadows.lightRadius = 0.045;
  view.effects.shadows.normalOffsetBias = 0.0015;
}

function ensureIBL(view, runtime) {
  if (runtime.iblReady.has(view)) {
    return;
  }
  const hdrPixels = paintSunSkyHDR(512, 256, {sunDirection: SUN_DIRECTION});
  const hdrBuffer = encodeRadianceHDR(hdrPixels, 512, 256);
  const result = view.lights.ibl.setEnvironmentHDRBuffer(hdrBuffer);
  if (result.ok) {
    runtime.iblReady.add(view);
  }
}

function createMaterialComparisonStrip(sceneModel) {
  const probeBox = mustBuild(buildBox({
    xSize: 1,
    ySize: 1,
    zSize: 1
  }));
  mustOk(sceneModel.createGeometry({
    id: "materialProbeBox",
    primitive: TrianglesPrimitive,
    positions: probeBox.positions,
    normals: probeBox.normals,
    uvs: probeBox.uv,
    indices: probeBox.indices
  }));

  const materials = [
    {
      id: "probeMatte",
      label: "Matte",
      color: [0.62, 0.58, 0.52],
      roughness: 0.82,
      metallic: 0
    },
    {
      id: "probeMetal",
      label: "Metallic",
      color: [0.82, 0.77, 0.66],
      roughness: 0.32,
      metallic: 1
    },
    {
      id: "probeClearcoat",
      label: "Clear coat",
      color: [0.12, 0.16, 0.42],
      roughness: 0.38,
      metallic: 0,
      clearcoat: 1.0,
      clearcoatRoughness: 0.06
    },
    {
      id: "probeSheen",
      label: "Sheen",
      color: [0.56, 0.12, 0.09],
      roughness: 0.72,
      metallic: 0,
      sheen: 0.85,
      sheenRoughness: 0.55
    },
    {
      id: "probeClearcoatSheen",
      label: "Clear coat + sheen",
      color: [0.18, 0.38, 0.32],
      roughness: 0.48,
      metallic: 0,
      clearcoat: 0.85,
      clearcoatRoughness: 0.12,
      sheen: 0.55,
      sheenRoughness: 0.65
    }
  ];

  const positions = [
    [1393.783, -233.503, 4.181],
    [1393.224, -232.931, 4.181],
    [1392.665, -232.358, 4.181],
    [1392.106, -231.786, 4.181],
    [1391.547, -231.214, 4.181]
  ];

  const probes = [];
  for (let i = 0; i < materials.length; i++) {
    const material = materials[i];
    const {label, ...materialParams} = material;
    mustOk(sceneModel.createMaterial(materialParams));
    const meshId = `materialProbeMesh${i}`;
    const objectId = `materialProbe_${material.id}`;
    mustOk(sceneModel.createMesh({
      id: meshId,
      geometryId: "materialProbeBox",
      materialId: material.id,
      matrix: buildMat4({
        position: positions[i],
        scale: [0.7, 0.7, 0.7]
      })
    }));
    mustOk(sceneModel.createObject({
      id: objectId,
      meshIds: [meshId]
    }));
    probes.push({id: objectId, name: label});
  }
  return probes;
}

function createMaterialProbeDataObjects(dataModel, probes) {
  const schema = dataModel.schema || "glTF";
  for (const probe of probes) {
    if (dataModel.objects[probe.id]) {
      continue;
    }
    mustOk(dataModel.createObject({
      id: probe.id,
      type: "MaterialProbe",
      schema,
      name: probe.name
    }));
  }
}

function normalize3(value) {
  const len = Math.hypot(value[0], value[1], value[2]) || 1;
  return [value[0] / len, value[1] / len, value[2] / len];
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createDataObjectsForScene(dataModel, sceneObjects) {
  const schema = dataModel.schema || "glTF";
  const rootId = "housePlanSemanticRoot";

  mustOk(dataModel.createPropertySet({
    id: "housePlanSourcePropertySet",
    name: "House Plan source",
    type: "BasicPropertySet",
    schema,
    properties: {
      source: HOUSE_PLAN_URL,
      format: "glb"
    }
  }));

  mustOk(dataModel.createObject({
    id: rootId,
    type: "Model",
    schema,
    name: "House Plan",
    propertySetIds: ["housePlanSourcePropertySet"]
  }));

  for (const sceneObjectId of Object.keys(sceneObjects)) {
    if (dataModel.objects[sceneObjectId]) {
      continue;
    }
    mustOk(dataModel.createObject({
      id: sceneObjectId,
      type: "glTFNode",
      schema,
      name: sceneObjectId
    }));
    mustOk(dataModel.createRelationship({
      type: "BasicAggregation",
      schema,
      relatingObjectId: rootId,
      relatedObjectId: sceneObjectId
    }));
  }
}

function countItems(value) {
  if (!value) {
    return 0;
  }
  return Array.isArray(value) ? value.length : Object.keys(value).length;
}


function mustBuild(result) {
  if (!result.ok) {
    throw new Error(result.error);
  }
  return result.value;
}

function setStatus(element, state, title, message) {
  element.dataset.state = state;
  element.innerHTML = `<strong>${escapeHTML(title)}</strong><span>${escapeHTML(message)}</span>`;
}

function escapeHTML(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
