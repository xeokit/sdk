import {encodeRadianceHDR, paintStudioHDR} from "@xeokit/sdk/model/generation/paintEnvironments";
import {LinearEncoding, LinearMipmapLinearFilter, RepeatWrapping, TrianglesPrimitive, sRGBEncoding} from "@xeokit/sdk/base/constants";
import {buildBox, buildSphere} from "@xeokit/sdk/model/generation/buildGeometry";
import {Scene, buildMat4} from "@xeokit/sdk/model/scene";
import {WebGLRenderer} from "@xeokit/sdk/viewing/renderers/webGL";
import {WebGPURenderer} from "@xeokit/sdk/viewing/renderers/webGPU";
import {AmbientLight, DirLight, Viewer} from "@xeokit/sdk/viewing/viewer";
import {finishExample, mustOk} from "../../../utils/standaloneRuntime.js";

const webglCanvas = document.getElementById("webglCanvas");
const webgpuCanvas = document.getElementById("webgpuCanvas");
const webglStatus = document.getElementById("webglStatus");
const webgpuStatus = document.getElementById("webgpuStatus");
const modeControls = document.getElementById("modeControls");
const featureControls = document.getElementById("featureControls");
const probeLegend = document.getElementById("probeLegend");

const SKY_COLOR = [0.60, 0.70, 0.84];
const HORIZON_COLOR = [0.76, 0.80, 0.86];
const GROUND_COLOR = [0.31, 0.29, 0.25];
const WORLD_UP = [0, 0, 1];
const DEFAULT_SHADOW_DIRECTION = [-0.42, -0.34, -0.84];
const PROBE_ROUGHNESS = [0.04, 0.16, 0.34, 0.62, 0.92];
const IBL_ENVIRONMENT_KEY = "studioHDR";

const MATERIAL_FEATURES = [
  {id: "colorTexture", label: "Color"},
  {id: "normalTexture", label: "Normal"},
  {id: "occlusionTexture", label: "AO"},
  {id: "metallicRoughnessTexture", label: "Metal/Rough"},
  {id: "alphaMask", label: "Mask"},
  {id: "alphaBlend", label: "Blend"},
  {id: "emissiveTexture", label: "Emissive"},
  {id: "clearcoat", label: "Clearcoat"},
  {id: "sheen", label: "Sheen"}
];

const DEFAULT_FEATURES = Object.fromEntries(MATERIAL_FEATURES.map((feature) => [feature.id, true]));
let cachedHDRBuffer = null;
const appliedIBLEnvironments = new WeakMap();

const PROBE_LABELS = [
  "Dielectric roughness",
  "Metal roughness",
  "Mirror chrome",
  "Rough white",
  "Dark gloss",
  "Dark clearcoat",
  "Clearcoat",
  "Metal/rough map",
  "Normal + AO",
  "Alpha mask",
  "Alpha blend",
  "Emissive",
  "Sheen"
];

const PARITY_MODES = {
  ibl: {
    label: "IBL Probe",
    sky: true,
    tonemap: true,
    ibl: 0.72,
    hemisphere: 0,
    ambient: 0.04,
    directional: 0.22,
    sao: false,
    shadows: false,
    bloom: false,
    hdrEnvironment: true
  },
  baseline: {
    label: "Baseline",
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
  pbr: {
    label: "PBR",
    sky: true,
    tonemap: true,
    ibl: 0.55,
    hemisphere: 0.05,
    ambient: 0.18,
    directional: 0.75,
    sao: false,
    shadows: false,
    bloom: false,
    hdrEnvironment: true
  },
  shadows: {
    label: "Shadows",
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
  sao: {
    label: "SAO",
    sky: true,
    tonemap: true,
    ibl: 0,
    hemisphere: 0.20,
    ambient: 0.30,
    directional: 0.80,
    sao: true,
    shadows: false,
    bloom: false
  },
  transparent: {
    label: "Transparent",
    sky: false,
    tonemap: true,
    ibl: 0,
    hemisphere: 0,
    ambient: 0.42,
    directional: 0.72,
    sao: false,
    shadows: false,
    bloom: false
  },
  all: {
    label: "All Effects",
    sky: true,
    tonemap: true,
    ibl: 0.24,
    hemisphere: 0.04,
    ambient: 0.22,
    directional: 0.95,
    sao: true,
    shadows: true,
    shadowIntensity: 0.82,
    bloom: true,
    hdrEnvironment: true
  }
};

const runtime = {
  AmbientLight: null,
  DirLight: null,
  scene: null,
  sceneModel: null,
  webglViewer: null,
  webgpuViewer: null,
  webglView: null,
  webgpuView: null,
  webglRenderer: null,
  webgpuRenderer: null,
  mode: null,
  features: null,
  pendingConfig: null,
  applyingConfig: null
};

main().catch((error) => {
  setStatus(webglStatus, "error", error instanceof Error ? error.message : String(error));
  setStatus(webgpuStatus, "error", error instanceof Error ? error.message : String(error));
  console.error("[view/renderers/webgl-webgpu-material-parity]", error);
});

async function main() {
  const selectedMode = getSelectedMode();
  const selectedFeatures = getSelectedFeatures();
  runtime.AmbientLight = AmbientLight;
  runtime.DirLight = DirLight;
  runtime.mode = selectedMode;
  runtime.features = selectedFeatures;
  setupModeControls(selectedMode);
  setupFeatureControls(selectedFeatures);
  setupProbeLegend();

  const scene = new Scene({logging: false});
  runtime.scene = scene;
  runtime.sceneModel = createMaterialSceneModel(scene, selectedFeatures);

  const viewParams = {
    backgroundColor: [0.96, 0.97, 0.98],
    camera: {
      projection: "perspective",
      eye: [3.9, -6.8, 6.1],
      look: [0.0, -0.05, 0.42],
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
  runtime.webglViewer = webglViewer;
  runtime.webgpuViewer = webgpuViewer;

  const webglView = mustOk(webglViewer.createView({
    id: "materialParityWebGL",
    htmlElement: webglCanvas,
    ...clone(viewParams)
  }));
  const webgpuView = mustOk(webgpuViewer.createView({
    id: "materialParityWebGPU",
    htmlElement: webgpuCanvas,
    ...clone(viewParams)
  }));
  runtime.webglView = webglView;
  runtime.webgpuView = webgpuView;
  applyParityMode(webglView, selectedMode, AmbientLight, DirLight);
  applyParityMode(webgpuView, selectedMode, AmbientLight, DirLight);
  applyMaterialFeatureViewState(webglView, selectedFeatures);
  applyMaterialFeatureViewState(webgpuView, selectedFeatures);
  applyParityEnvironment([webglView, webgpuView], selectedMode);
  syncViewCameras(webglView, webgpuView);

  const webglRenderer = new WebGLRenderer({
    viewer: webglViewer,
    logging: false
  });
  runtime.webglRenderer = webglRenderer;
  updateStatusText();

  let webgpuRenderer = null;
  if (navigator.gpu) {
    const result = await WebGPURenderer.create({
      viewer: webgpuViewer,
      logging: false
    });
    if (result.ok) {
      webgpuRenderer = result.value;
      runtime.webgpuRenderer = webgpuRenderer;
      webgpuRenderer.events.onError.subscribe((_renderer, error) => {
        setStatus(webgpuStatus, "error", error.error);
        console.error("[view/renderers/webgl-webgpu-material-parity] WebGPU", error.error);
      });
      updateStatusText();
    } else {
      setStatus(webgpuStatus, "warn", result.error);
    }
  } else {
    setStatus(webgpuStatus, "warn", "Unavailable in this browser.");
  }

  finishExample(webglRenderer, webglView);
  updateDemoState();
}

function getSelectedMode() {
  const params = new URLSearchParams(window.location.search);
  const mode = params.get("mode") || window.location.hash.replace(/^#/, "");
  return Object.prototype.hasOwnProperty.call(PARITY_MODES, mode) ? mode : "ibl";
}

function getSelectedFeatures() {
  const params = new URLSearchParams(window.location.search);
  const features = {...DEFAULT_FEATURES};
  for (const feature of MATERIAL_FEATURES) {
    features[feature.id] = readBoolean(params, feature.id, features[feature.id]);
  }
  const compact = params.get("features");
  if (compact) {
    if (compact === "all") {
      return {...DEFAULT_FEATURES};
    }
    if (compact === "none") {
      return Object.fromEntries(MATERIAL_FEATURES.map((feature) => [feature.id, false]));
    }
    const enabled = new Set(compact.split(",").map((token) => token.trim()).filter(Boolean));
    for (const feature of MATERIAL_FEATURES) {
      features[feature.id] = enabled.has(feature.id);
    }
  }
  return features;
}

function setupModeControls(selectedMode) {
  if (!modeControls) {
    return;
  }
  modeControls.replaceChildren(...Object.entries(PARITY_MODES).map(([mode, config]) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = config.label;
    button.dataset.mode = mode;
    button.setAttribute("aria-pressed", mode === selectedMode ? "true" : "false");
    button.addEventListener("click", () => {
      scheduleReconfigure({mode});
    });
    return button;
  }));
}

function setupFeatureControls(features) {
  if (!featureControls) {
    return;
  }
  const buttons = [
    createFeaturePresetButton("All", () => scheduleReconfigure({features: {...DEFAULT_FEATURES}})),
    createFeaturePresetButton("None", () => scheduleReconfigure({features: createDisabledFeatures()})),
    ...MATERIAL_FEATURES.map((feature) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = feature.label;
      button.dataset.feature = feature.id;
      button.setAttribute("aria-pressed", features[feature.id] ? "true" : "false");
      button.addEventListener("click", () => {
        const currentFeatures = runtime.features || features;
        scheduleReconfigure({
          features: {
            ...currentFeatures,
            [feature.id]: !currentFeatures[feature.id]
          }
        });
      });
      return button;
    })
  ];
  featureControls.replaceChildren(...buttons);
}

function createFeaturePresetButton(label, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.dataset.preset = label.toLowerCase();
  button.addEventListener("click", onClick);
  return button;
}

function setupProbeLegend() {
  if (!probeLegend) {
    return;
  }
  probeLegend.replaceChildren(...PROBE_LABELS.map((label) => {
    const item = document.createElement("span");
    item.className = "probe-chip";
    item.textContent = label;
    return item;
  }));
}

function scheduleReconfigure(update) {
  const currentFeatures = runtime.features || getSelectedFeatures();
  runtime.pendingConfig = {
    mode: update.mode || runtime.mode || getSelectedMode(),
    features: normalizeFeatureSet(update.features ? {...currentFeatures, ...update.features} : currentFeatures)
  };
  if (!runtime.applyingConfig) {
    runtime.applyingConfig = drainReconfigureQueue().finally(() => {
      runtime.applyingConfig = null;
    });
  }
  return runtime.applyingConfig;
}

async function drainReconfigureQueue() {
  document.body.classList.add("is-reconfiguring");
  try {
    while (runtime.pendingConfig) {
      const config = runtime.pendingConfig;
      runtime.pendingConfig = null;
      applyRuntimeConfig(config);
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
  } finally {
    document.body.classList.remove("is-reconfiguring");
  }
}

function applyRuntimeConfig(config) {
  const mode = Object.prototype.hasOwnProperty.call(PARITY_MODES, config.mode) ? config.mode : "ibl";
  const features = normalizeFeatureSet(config.features);
  const modeChanged = runtime.mode !== mode;
  const materialChanged = !featuresEqual(runtime.features, features);
  if (materialChanged && runtime.scene) {
    if (runtime.sceneModel) {
      runtime.sceneModel.destroy();
    }
    runtime.sceneModel = createMaterialSceneModel(runtime.scene, features);
  }

  runtime.mode = mode;
  runtime.features = features;
  setupModeControls(mode);
  setupFeatureControls(features);

  if (runtime.webglView && runtime.webgpuView && runtime.AmbientLight && runtime.DirLight) {
    const views = [runtime.webglView, runtime.webgpuView];
    if (modeChanged) {
      for (const view of views) {
        applyParityMode(view, mode, runtime.AmbientLight, runtime.DirLight);
      }
      applyParityEnvironment(views, mode);
    }
    for (const view of views) {
      applyMaterialFeatureViewState(view, features);
    }
  }

  syncUrlFromConfig(mode, features);
  updateStatusText();
  updateDemoState();
}

function normalizeFeatureSet(features) {
  const normalized = {};
  for (const feature of MATERIAL_FEATURES) {
    normalized[feature.id] = features?.[feature.id] === true;
  }
  return normalized;
}

function createDisabledFeatures() {
  return Object.fromEntries(MATERIAL_FEATURES.map((feature) => [feature.id, false]));
}

function featuresEqual(a, b) {
  if (!a || !b) {
    return false;
  }
  return MATERIAL_FEATURES.every((feature) => a[feature.id] === b[feature.id]);
}

function syncUrlFromConfig(mode, features) {
  const url = new URL(window.location.href);
  url.searchParams.set("mode", mode);
  url.searchParams.delete("features");
  for (const feature of MATERIAL_FEATURES) {
    if (features[feature.id] === DEFAULT_FEATURES[feature.id]) {
      url.searchParams.delete(feature.id);
    } else {
      url.searchParams.set(feature.id, features[feature.id] ? "1" : "0");
    }
  }
  url.hash = "";
  history.replaceState(null, "", url.toString());
}

function updateStatusText() {
  if (!runtime.scene || !runtime.mode || !runtime.features) {
    return;
  }
  const message = `${countItems(runtime.scene.objects)} objects, ${PARITY_MODES[runtime.mode].label} mode. ${formatFeatureSummary(runtime.features)}`;
  if (runtime.webglRenderer) {
    setStatus(webglStatus, "ok", message);
  }
  if (runtime.webgpuRenderer) {
    setStatus(webgpuStatus, "ok", message);
  }
}

function updateDemoState() {
  window.webglWebgpuMaterialParityDemo = {
    scene: runtime.scene,
    sceneModel: runtime.sceneModel,
    webglViewer: runtime.webglViewer,
    webgpuViewer: runtime.webgpuViewer,
    webglView: runtime.webglView,
    webgpuView: runtime.webgpuView,
    webglRenderer: runtime.webglRenderer,
    webgpuRenderer: runtime.webgpuRenderer,
    mode: runtime.mode,
    features: runtime.features,
    reconfigure: scheduleReconfigure
  };
}

function applyParityMode(view, modeKey, AmbientLight, DirLight) {
  const mode = PARITY_MODES[modeKey] || PARITY_MODES.baseline;
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

function applyMaterialFeatureViewState(view, features) {
  const anyTextureFeature =
    features.colorTexture ||
    features.normalTexture ||
    features.occlusionTexture ||
    features.metallicRoughnessTexture ||
    features.alphaMask ||
    features.alphaBlend ||
    features.emissiveTexture;
  if (view.texturing) {
    view.texturing.enabled = anyTextureFeature;
  }
}

function applyParityEnvironment(views, modeKey) {
  const mode = PARITY_MODES[modeKey] || PARITY_MODES.ibl;
  if (!mode.hdrEnvironment || mode.ibl <= 0) {
    for (const view of views) {
      view.lights.ibl.clearEnvironment();
      appliedIBLEnvironments.set(view, "none");
    }
    return;
  }
  const hdrBuffer = getHDRBuffer();
  for (const view of views) {
    if (appliedIBLEnvironments.get(view) === IBL_ENVIRONMENT_KEY) {
      continue;
    }
    const result = view.lights.ibl.setEnvironmentHDRBuffer(hdrBuffer);
    if (!result.ok) {
      console.warn("[view/renderers/webgl-webgpu-material-parity] IBL environment", result.error);
    } else {
      appliedIBLEnvironments.set(view, IBL_ENVIRONMENT_KEY);
    }
  }
}

function getHDRBuffer() {
  if (!cachedHDRBuffer) {
    const hdrPixels = paintStudioHDR(512, 256);
    cachedHDRBuffer = encodeRadianceHDR(hdrPixels, 512, 256);
  }
  return cachedHDRBuffer;
}

function createMaterialSceneModel(scene, features) {
  const sceneModel = mustOk(scene.createModel({
    id: "materialParity",
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
  buildScene(sceneModel, features);
  return sceneModel;
}

function buildScene(sceneModel, features) {
  createTextures(sceneModel);
  createGeometries(sceneModel);
  createMaterials(sceneModel, features);

  let next = 0;
  const place = (geometryId, materialId, position, scale, rotation = [0, 0, 0]) => {
    const meshId = `mesh_${next}`;
    const objectId = `object_${next}`;
    next++;
    mustOk(sceneModel.createMesh({
      id: meshId,
      geometryId,
      materialId,
      matrix: buildMat4({position, scale, rotation})
    }));
    mustOk(sceneModel.createObject({
      id: objectId,
      meshIds: [meshId]
    }));
  };

  place("box", "floor", [0, 0.55, -0.05], [6.6, 6.2, 0.05]);

  for (let i = 0; i < PROBE_ROUGHNESS.length; i++) {
    const x = -2.4 + i * 1.2;
    place("sphere", `dielectricR${i}`, [x, -1.35, 0.50], [0.44, 0.44, 0.44]);
    place("sphere", `metalR${i}`, [x, -0.15, 0.50], [0.44, 0.44, 0.44]);
  }

  place("sphere", "darkGloss", [-2.4, 1.15, 0.50], [0.44, 0.44, 0.44]);
  place("sphere", "clearcoatPaint", [-1.2, 1.15, 0.50], [0.44, 0.44, 0.44]);
  place("sphere", "brushedMetal", [0, 1.15, 0.50], [0.44, 0.44, 0.44]);
  place("box", "normalMappedTile", [1.2, 1.15, 0.18], [0.50, 0.50, 0.18]);
  place("box", "emissivePanel", [2.4, 1.15, 0.48], [0.42, 0.10, 0.38]);

  place("box", "opaqueAlphaTexture", [-2.4, 2.15, 0.42], [0.42, 0.42, 0.42]);
  place("plane", "maskAlphaTexture", [-1.2, 2.12, 0.88], [0.56, 1, 0.56]);
  place("plane", "blendBlueGlass", [0, 2.10, 0.88], [0.58, 1, 0.58]);
  place("plane", "blendWarmGlass", [1.2, 2.05, 0.84], [0.54, 1, 0.54], [0, 0, 12]);
  place("sphere", "sheenFabric", [2.4, 2.10, 0.42], [0.40, 0.40, 0.40]);

  place("sphere", "mirrorChrome", [-1.8, 3.05, 0.50], [0.46, 0.46, 0.46]);
  place("sphere", "roughWhite", [0, 3.05, 0.50], [0.46, 0.46, 0.46]);
  place("sphere", "darkClearcoat", [1.8, 3.05, 0.50], [0.46, 0.46, 0.46]);
}

function createGeometries(sceneModel) {
  const box = mustBuild(buildBox({
    xSize: 1,
    ySize: 1,
    zSize: 1
  }));
  mustOk(sceneModel.createGeometry({
    id: "box",
    primitive: TrianglesPrimitive,
    positions: box.positions,
    normals: box.normals,
    uvs: box.uv,
    indices: box.indices
  }));

  const sphere = mustBuild(buildSphere({
    radius: 1,
    widthSegments: 36,
    heightSegments: 24
  }));
  mustOk(sceneModel.createGeometry({
    id: "sphere",
    primitive: TrianglesPrimitive,
    positions: sphere.positions,
    normals: sphere.normals,
    uvs: sphere.uv,
    indices: sphere.indices
  }));

  mustOk(sceneModel.createGeometry({
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
  mustOk(sceneModel.createTexture({
    id: "alphaPattern",
    image: makeAlphaPatternCanvas(96),
    encoding: sRGBEncoding,
    minFilter: LinearMipmapLinearFilter,
    wrapS: RepeatWrapping,
    wrapT: RepeatWrapping,
    mipmap: true
  }));
  mustOk(sceneModel.createTexture({
    id: "mrBands",
    image: makeMetallicRoughnessCanvas(64),
    encoding: LinearEncoding,
    minFilter: LinearMipmapLinearFilter,
    wrapS: RepeatWrapping,
    wrapT: RepeatWrapping,
    mipmap: true
  }));
  mustOk(sceneModel.createTexture({
    id: "normalRipples",
    image: makeNormalCanvas(96),
    encoding: LinearEncoding,
    minFilter: LinearMipmapLinearFilter,
    wrapS: RepeatWrapping,
    wrapT: RepeatWrapping,
    mipmap: true
  }));
  mustOk(sceneModel.createTexture({
    id: "occlusionCorners",
    image: makeOcclusionCanvas(96),
    encoding: LinearEncoding,
    minFilter: LinearMipmapLinearFilter,
    wrapS: RepeatWrapping,
    wrapT: RepeatWrapping,
    mipmap: true
  }));
  mustOk(sceneModel.createTexture({
    id: "emissiveBars",
    image: makeEmissiveCanvas(64),
    encoding: sRGBEncoding,
    minFilter: LinearMipmapLinearFilter,
    wrapS: RepeatWrapping,
    wrapT: RepeatWrapping,
    mipmap: true
  }));
}

function createMaterials(sceneModel, features) {
  mustOk(sceneModel.createMaterial({
    id: "floor",
    color: [0.14, 0.15, 0.16],
    roughness: 0.82,
    metallic: 0
  }));
  for (let i = 0; i < PROBE_ROUGHNESS.length; i++) {
    const roughness = PROBE_ROUGHNESS[i];
    mustOk(sceneModel.createMaterial({
      id: `dielectricR${i}`,
      color: i === 0 ? [0.015, 0.016, 0.018] : [0.62, 0.56, 0.48],
      roughness,
      metallic: 0
    }));
    mustOk(sceneModel.createMaterial({
      id: `metalR${i}`,
      color: [0.86, 0.78, 0.62],
      roughness,
      metallic: 1
    }));
  }
  mustOk(sceneModel.createMaterial({
    id: "darkGloss",
    color: [0.006, 0.007, 0.009],
    roughness: 0.05,
    metallic: 0,
    clearcoat: features.clearcoat ? 0.75 : 0,
    clearcoatRoughness: 0.04
  }));
  mustOk(sceneModel.createMaterial({
    id: "mirrorChrome",
    color: [0.92, 0.94, 1.0],
    roughness: 0.015,
    metallic: 1
  }));
  mustOk(sceneModel.createMaterial({
    id: "roughWhite",
    color: [0.82, 0.80, 0.74],
    roughness: 0.92,
    metallic: 0
  }));
  mustOk(sceneModel.createMaterial({
    id: "darkClearcoat",
    color: [0.004, 0.005, 0.008],
    roughness: 0.18,
    metallic: 0,
    clearcoat: features.clearcoat ? 1.0 : 0,
    clearcoatRoughness: 0.02
  }));
  mustOk(sceneModel.createMaterial({
    id: "opaqueAlphaTexture",
    color: features.colorTexture ? [1, 1, 1] : [0.86, 0.78, 0.58],
    roughness: 0.62,
    metallic: 0,
    colorTextureId: features.colorTexture ? "alphaPattern" : undefined,
    alphaMode: "OPAQUE"
  }));
  mustOk(sceneModel.createMaterial({
    id: "maskAlphaTexture",
    color: features.colorTexture || features.alphaMask ? [1, 1, 1] : [0.35, 0.56, 0.38],
    roughness: 0.58,
    metallic: 0,
    colorTextureId: features.colorTexture || features.alphaMask ? "alphaPattern" : undefined,
    alphaMode: features.alphaMask ? "MASK" : "OPAQUE",
    alphaCutoff: features.alphaMask ? 0.52 : undefined
  }));
  mustOk(sceneModel.createMaterial({
    id: "blendBlueGlass",
    color: [0.32, 0.66, 1.0],
    opacity: features.alphaBlend ? 0.38 : 1,
    roughness: 0.08,
    metallic: 0,
    colorTextureId: features.alphaBlend || features.colorTexture ? "alphaPattern" : undefined,
    alphaMode: features.alphaBlend ? "BLEND" : "OPAQUE"
  }));
  mustOk(sceneModel.createMaterial({
    id: "blendWarmGlass",
    color: [1.0, 0.72, 0.30],
    opacity: features.alphaBlend ? 0.28 : 1,
    roughness: 0.12,
    metallic: 0,
    alphaMode: features.alphaBlend ? "BLEND" : "OPAQUE"
  }));
  mustOk(sceneModel.createMaterial({
    id: "brushedMetal",
    color: [0.78, 0.62, 0.44],
    roughness: features.metallicRoughnessTexture ? 0.22 : 0.36,
    metallic: 1,
    metallicRoughnessTextureId: features.metallicRoughnessTexture ? "mrBands" : undefined
  }));
  mustOk(sceneModel.createMaterial({
    id: "normalMappedTile",
    color: [0.38, 0.48, 0.72],
    roughness: 0.46,
    metallic: 0,
    normalsTextureId: features.normalTexture ? "normalRipples" : undefined,
    occlusionTextureId: features.occlusionTexture ? "occlusionCorners" : undefined
  }));
  mustOk(sceneModel.createMaterial({
    id: "clearcoatPaint",
    color: [0.18, 0.22, 0.56],
    roughness: 0.42,
    metallic: 0,
    clearcoat: features.clearcoat ? 1.0 : 0,
    clearcoatRoughness: 0.08
  }));
  mustOk(sceneModel.createMaterial({
    id: "emissivePanel",
    color: [0.02, 0.025, 0.03],
    roughness: 0.45,
    metallic: 0,
    emissiveTextureId: features.emissiveTexture ? "emissiveBars" : undefined,
    emissiveColor: features.emissiveTexture ? [1.0, 0.86, 0.55] : [0, 0, 0]
  }));
  mustOk(sceneModel.createMaterial({
    id: "sheenFabric",
    color: [0.55, 0.14, 0.30],
    roughness: 0.78,
    metallic: 0,
    sheen: features.sheen ? 0.82 : 0,
    sheenRoughness: 0.46
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

function readBoolean(params, name, fallback) {
  const value = params.get(name);
  if (value === null) {
    return fallback;
  }
  if (/^(1|true|yes|on)$/i.test(value)) {
    return true;
  }
  if (/^(0|false|no|off)$/i.test(value)) {
    return false;
  }
  return fallback;
}

function formatFeatureSummary(features) {
  const disabled = MATERIAL_FEATURES
    .filter((feature) => !features[feature.id])
    .map((feature) => feature.label);
  return disabled.length === 0 ? "All material channels enabled." : `Disabled: ${disabled.join(", ")}.`;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function setStatus(element, state, message) {
  element.dataset.state = state;
  element.textContent = message;
}


function mustBuild(result) {
  if (!result.ok) {
    throw new Error(result.error);
  }
  return result.value;
}
