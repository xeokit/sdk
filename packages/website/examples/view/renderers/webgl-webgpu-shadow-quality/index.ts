import {LinearEncoding, LinearFilter, LinearMipmapLinearFilter, RepeatWrapping, TrianglesPrimitive, sRGBEncoding} from "@xeokit/sdk/base/constants";
import {buildBox, buildCylinder, buildSphere} from "@xeokit/sdk/model/generation/buildGeometry";
import {Scene, buildMat4} from "@xeokit/sdk/model/scene";
import {BVHPickStrategy, RoutingPickStrategy} from "@xeokit/sdk/spatial/picking";
import {ModelNavigationController} from "@xeokit/sdk/viewing/navigation/model";
import {WebGLRenderer} from "@xeokit/sdk/viewing/renderers/webGL";
import {WebGPURenderer} from "@xeokit/sdk/viewing/renderers/webGPU";
import {AmbientLight, DirLight, Viewer} from "@xeokit/sdk/viewing/viewer";
import {finishExample, mustOk} from "../../../utils/standaloneRuntime.js";

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
const DEG_TO_RAD = Math.PI / 180;
const SHADOW_DEBUG_OPTIONS = ["off", "factor", "rawDepth", "refDepth", "bias", "blockerDepth", "filterRadius", "visibility", "cascade"];

const SHADOW_DEFAULTS = {
  enabled: true,
  intensity: 0.58,
  bias: 0.001,
  normalOffsetBias: 0.0035,
  slopeBias: 0.00125,
  resolution: 2048,
  pcfKernelSize: 7,
  contactHardening: true,
  lightRadius: 0.08,
  debug: getInitialShadowDebugMode(),
  cascadeCount: 4,
  cascadeSplitLambda: 0.45,
  maxDistance: 14,
  padding: 1.06
};

const CONTROL_DEFS = [
  {id: "enabled", label: "Shadows", type: "toggle"},
  {id: "intensity", label: "Intensity", min: 0, max: 1, step: 0.01, digits: 2},
  {id: "bias", label: "Bias", min: 0, max: 0.01, step: 0.00025, digits: 4},
  {id: "normalOffsetBias", label: "Normal", min: 0, max: 0.04, step: 0.001, digits: 3},
  {id: "slopeBias", label: "Slope", min: 0, max: 0.01, step: 0.00025, digits: 4},
  {id: "pcfKernelSize", label: "PCF", type: "select", options: [1, 3, 5, 7]},
  {id: "contactHardening", label: "Contact", type: "toggle"},
  {id: "lightRadius", label: "Radius", min: 0, max: 0.24, step: 0.005, digits: 3},
  {id: "debug", label: "Debug", type: "select", options: SHADOW_DEBUG_OPTIONS},
  {id: "cascadeCount", label: "Cascades", type: "select", options: [1, 2, 3, 4, 6]},
  {id: "cascadeSplitLambda", label: "Split", min: 0, max: 1, step: 0.01, digits: 2},
  {id: "resolution", label: "Res", type: "select", options: [512, 1024, 2048, 4096]}
];

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  setStatus(webglStatus, "error", message);
  setStatus(webgpuStatus, "error", message);
  console.error("[view/renderers/webgl-webgpu-shadow-quality]", error);
});

async function main() {
  const scene = new Scene({logging: false});
  const sceneModel = mustOk(scene.createModel({
    id: "shadowQuality",
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
      eye: [3.2, -4.9, 2.15],
      look: [0.28, -0.83, 0.34],
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
        contactHardening: SHADOW_DEFAULTS.contactHardening,
        lightRadius: SHADOW_DEFAULTS.lightRadius,
        debug: toShadowDebugMode(SHADOW_DEFAULTS.debug),
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
  const webglView = mustOk(webglViewer.createView({
    id: "shadowQualityWebGL",
    htmlElement: webglCanvas,
    ...clone(viewParams)
  }));
  const webgpuView = mustOk(webgpuViewer.createView({
    id: "shadowQualityWebGPU",
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
  mustOk(webglRenderer.setInfiniteGridEnabled(true));
  const webglPicker = new RoutingPickStrategy(scene, webglRenderer);
  createInputController(ModelNavigationController, webglView, webglPicker);
  setStatus(webglStatus, "ok", `Model-free counter/stool contact, potted MASK plant, thin, and BLEND shadow stress scene. ${SHADOW_DEFAULTS.resolution}px, ${SHADOW_DEFAULTS.pcfKernelSize}x${SHADOW_DEFAULTS.pcfKernelSize} PCF.`);

  let webgpuRenderer = null;
  if (navigator.gpu) {
    const result = await WebGPURenderer.create({
      viewer: webgpuViewer,
      logging: false
    });
    if (result.ok) {
      webgpuRenderer = result.value;
      mustOk(webgpuRenderer.setInfiniteGridEnabled(true));
      webgpuRenderer.events.onError.subscribe((_renderer, error) => {
        setStatus(webgpuStatus, "error", error.error);
        console.error("[view/renderers/webgl-webgpu-shadow-quality] WebGPU", error.error);
      });
      const webgpuPicker = new BVHPickStrategy(scene);
      createInputController(ModelNavigationController, webgpuView, webgpuPicker);
      setStatus(webgpuStatus, "ok", `Model-free counter/stool contact, potted MASK plant, thin, and BLEND shadow stress scene. ${SHADOW_DEFAULTS.resolution}px, ${SHADOW_DEFAULTS.pcfKernelSize}x${SHADOW_DEFAULTS.pcfKernelSize} PCF.`);
    } else {
      setStatus(webgpuStatus, "warn", result.error);
    }
  } else {
    setStatus(webgpuStatus, "warn", "WebGPU unavailable in this browser.");
  }

  finishExample(webglRenderer, webglView);

  window.webglWebgpuShadowQualityDemo = {
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
    mustOk(sceneModel.createMesh({
      id: meshId,
      geometryId,
      materialId,
      castsShadow: options.castsShadow !== false,
      matrix: buildMat4({position, scale, rotation})
    }));
    mustOk(sceneModel.createObject({
      id: objectId,
      meshIds: [meshId],
      castsShadow: options.castsShadow !== false
    }));
  };
  const addStool = (x, y) => {
    place("cylinderZ", "stoolSeat", [x, y, 0.34], [0.24, 0.24, 0.055]);
    place("cylinderZ", "stoolLeg", [x - 0.15, y - 0.12, 0.155], [0.022, 0.022, 0.31]);
    place("cylinderZ", "stoolLeg", [x + 0.15, y - 0.12, 0.155], [0.022, 0.022, 0.31]);
    place("cylinderZ", "stoolLeg", [x - 0.15, y + 0.12, 0.155], [0.022, 0.022, 0.31]);
    place("cylinderZ", "stoolLeg", [x + 0.15, y + 0.12, 0.155], [0.022, 0.022, 0.31]);
    place("cylinderX", "stoolLeg", [x, y - 0.12, 0.17], [0.30, 0.014, 0.014]);
    place("cylinderX", "stoolLeg", [x, y + 0.12, 0.17], [0.30, 0.014, 0.014]);
    place("cylinderY", "stoolLeg", [x - 0.15, y, 0.17], [0.014, 0.24, 0.014]);
    place("cylinderY", "stoolLeg", [x + 0.15, y, 0.17], [0.014, 0.24, 0.014]);
  };
  const addPottedPlant = (x, y) => {
    place("cylinderZ", "plantSaucer", [x, y, 0.772], [0.19, 0.19, 0.026]);
    place("taperedCylinderZ", "plantPot", [x, y, 0.845], [0.16, 0.16, 0.16]);
    place("cylinderZ", "plantStem", [x, y, 1.03], [0.022, 0.022, 0.32]);
    const leaves = [
      [-0.02, -0.03, 1.23, 0.48, 0.56, -8, 4, -12],
      [0.04, 0.04, 1.22, 0.44, 0.52, 5, -6, 82],
      [-0.13, 0.03, 1.17, 0.32, 0.42, -12, 8, -44],
      [0.13, -0.03, 1.15, 0.34, 0.42, 10, -10, 36],
      [-0.08, 0.12, 1.27, 0.30, 0.40, 8, 14, 136],
      [0.10, -0.13, 1.25, 0.30, 0.39, -6, -13, -136],
      [-0.03, 0.00, 1.34, 0.26, 0.34, -18, 10, 22],
      [0.08, 0.01, 1.30, 0.24, 0.32, 18, -10, 112]
    ];
    for (const [dx, dy, z, sx, sz, rx, ry, rz] of leaves) {
      place("verticalCard", "alphaLeaves", [x + dx, y + dy, z], [sx, sx, sz], [rx * DEG_TO_RAD, ry * DEG_TO_RAD, rz * DEG_TO_RAD]);
    }
  };

  place("box", "floor", [0, 0, -0.035], [4.6, 3.0, 0.035], [0, 0, 0], {castsShadow: false});
  place("box", "floor", [1.55, 0.72, 0.11], [1.5, 0.92, 0.035], [0, 10 * DEG_TO_RAD, 0], {castsShadow: false});
  place("box", "counterTop", [0.10, -0.35, 0.70], [1.32, 0.36, 0.055]);
  place("box", "counterApron", [0.10, -0.72, 0.59], [1.32, 0.035, 0.16]);
  addStool(-0.62, -1.06);
  addStool(0.12, -1.09);
  addStool(0.86, -1.06);
  addPottedPlant(0.88, -0.36);
  place("box", "contactBar", [-1.62, -0.68, 0.075], [0.45, 0.055, 0.035]);
  place("box", "matteBlock", [-1.78, -0.52, 0.32], [0.34, 0.34, 0.32]);
  place("sphere", "smoothCaster", [-1.18, -0.52, 0.28], [0.28, 0.28, 0.28]);
  place("thinSlab", "slab", [1.42, -0.90, 0.45], [0.055, 0.56, 0.45], [0, 0, -12 * DEG_TO_RAD]);
  place("box", "normalBlock", [2.40, -0.82, 0.24], [0.32, 0.32, 0.24]);
  place("sphere", "lowRoughness", [2.92, -0.82, 0.25], [0.25, 0.25, 0.25]);
  place("verticalCard", "blendTint", [3.38, -0.88, 0.46], [0.58, 0.58, 0.58], [0, 0, 0]);
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
    widthSegments: 40,
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

  const cylinder = mustBuild(buildCylinder({
    radiusTop: 1,
    radiusBottom: 1,
    height: 1,
    radialSegments: 36,
    heightSegments: 1,
    openEnded: false
  }));
  createCylinderGeometry(sceneModel, TrianglesPrimitive, "cylinderX", cylinder, "x");
  createCylinderGeometry(sceneModel, TrianglesPrimitive, "cylinderY", cylinder, "y");
  createCylinderGeometry(sceneModel, TrianglesPrimitive, "cylinderZ", cylinder, "z");

  const taperedCylinder = mustBuild(buildCylinder({
    radiusTop: 1.15,
    radiusBottom: 0.78,
    height: 1,
    radialSegments: 36,
    heightSegments: 1,
    openEnded: false
  }));
  createCylinderGeometry(sceneModel, TrianglesPrimitive, "taperedCylinderZ", taperedCylinder, "z");

  mustOk(sceneModel.createGeometry({
    id: "thinSlab",
    primitive: TrianglesPrimitive,
    positions: box.positions,
    normals: box.normals,
    uvs: box.uv,
    indices: box.indices
  }));

  mustOk(sceneModel.createGeometry({
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

function createCylinderGeometry(sceneModel, primitive, id, cylinder, axis) {
  mustOk(sceneModel.createGeometry({
    id,
    primitive,
    positions: remapCylinderAxis(cylinder.positions, axis),
    normals: remapCylinderAxis(cylinder.normals, axis),
    uvs: cylinder.uv,
    indices: cylinder.indices
  }));
}

function remapCylinderAxis(values, axis) {
  const result = new Array(values.length);
  for (let i = 0; i < values.length; i += 3) {
    const x = values[i];
    const y = values[i + 1];
    const z = values[i + 2];
    if (axis === "x") {
      result[i] = y;
      result[i + 1] = -x;
      result[i + 2] = z;
    } else if (axis === "z") {
      result[i] = x;
      result[i + 1] = -z;
      result[i + 2] = y;
    } else {
      result[i] = x;
      result[i + 1] = y;
      result[i + 2] = z;
    }
  }
  return result;
}

function createMaterials(sceneModel) {
  mustOk(sceneModel.createMaterial({
    id: "floor",
    color: [0.56, 0.58, 0.60],
    roughness: 0.72,
    metallic: 0
  }));
  mustOk(sceneModel.createMaterial({
    id: "matteBlock",
    color: [0.68, 0.35, 0.24],
    roughness: 0.82,
    metallic: 0
  }));
  mustOk(sceneModel.createMaterial({
    id: "smoothCaster",
    color: [0.30, 0.54, 0.72],
    roughness: 0.54,
    metallic: 0
  }));
  mustOk(sceneModel.createMaterial({
    id: "slab",
    color: [0.33, 0.34, 0.38],
    roughness: 0.66,
    metallic: 0
  }));
  mustOk(sceneModel.createMaterial({
    id: "counterTop",
    color: [0.48, 0.44, 0.37],
    roughness: 0.50,
    metallic: 0
  }));
  mustOk(sceneModel.createMaterial({
    id: "counterApron",
    color: [0.35, 0.33, 0.31],
    roughness: 0.58,
    metallic: 0
  }));
  mustOk(sceneModel.createMaterial({
    id: "stoolSeat",
    color: [0.60, 0.38, 0.22],
    roughness: 0.52,
    metallic: 0
  }));
  mustOk(sceneModel.createMaterial({
    id: "stoolLeg",
    color: [0.18, 0.20, 0.22],
    roughness: 0.44,
    metallic: 0.15
  }));
  mustOk(sceneModel.createMaterial({
    id: "contactBar",
    color: [0.74, 0.42, 0.28],
    roughness: 0.72,
    metallic: 0
  }));
  mustOk(sceneModel.createMaterial({
    id: "plantPot",
    color: [0.70, 0.34, 0.18],
    roughness: 0.78,
    metallic: 0
  }));
  mustOk(sceneModel.createMaterial({
    id: "plantSaucer",
    color: [0.62, 0.30, 0.17],
    roughness: 0.82,
    metallic: 0
  }));
  mustOk(sceneModel.createMaterial({
    id: "plantStem",
    color: [0.24, 0.20, 0.11],
    roughness: 0.68,
    metallic: 0
  }));
  mustOk(sceneModel.createMaterial({
    id: "stepBlock",
    color: [0.58, 0.48, 0.28],
    roughness: 0.76,
    metallic: 0
  }));
  mustOk(sceneModel.createMaterial({
    id: "alphaLeaves",
    color: [1, 1, 1],
    colorTextureId: "alphaLeaves",
    roughness: 0.70,
    metallic: 0,
    alphaMode: "MASK",
    alphaCutoff: 0.52
  }));
  mustOk(sceneModel.createMaterial({
    id: "blendTint",
    color: [0.62, 0.88, 0.96],
    opacity: 0.42,
    roughness: 0.28,
    metallic: 0,
    alphaMode: "BLEND"
  }));
  mustOk(sceneModel.createMaterial({
    id: "normalTile",
    color: [0.42, 0.45, 0.51],
    normalsTextureId: "normalRipples",
    roughness: 0.60,
    metallic: 0
  }));
  mustOk(sceneModel.createMaterial({
    id: "normalBlock",
    color: [0.50, 0.46, 0.70],
    normalsTextureId: "normalRipples",
    roughness: 0.48,
    metallic: 0
  }));
  mustOk(sceneModel.createMaterial({
    id: "lowRoughness",
    color: [0.78, 0.70, 0.40],
    roughness: 0.18,
    metallic: 0.15
  }));
}

function createTextures(sceneModel) {
  mustOk(sceneModel.createTexture({
    id: "alphaLeaves",
    image: makeAlphaLeavesCanvas(128),
    encoding: sRGBEncoding,
    minFilter: LinearFilter,
    wrapS: RepeatWrapping,
    wrapT: RepeatWrapping,
    mipmap: false
  }));
  mustOk(sceneModel.createTexture({
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
    const value = def.type === "select" ? parseSelectValue(def, state, input.value) : Number.parseFloat(input.value);
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
    shadows.contactHardening = state.contactHardening;
    shadows.lightRadius = state.lightRadius;
    shadows.debug = toShadowDebugMode(state.debug);
    shadows.cascadeCount = state.cascadeCount;
    shadows.cascadeSplitLambda = state.cascadeSplitLambda;
    shadows.maxDistance = state.maxDistance;
    shadows.padding = state.padding;
    shadows.direction = SHADOW_DIRECTION;
  }
}

function parseSelectValue(def, state, rawValue) {
  return typeof state[def.id] === "number" ? Number(rawValue) : rawValue;
}

function getInitialShadowDebugMode() {
  const value = new URLSearchParams(window.location.search).get("shadowDebug")
    || new URLSearchParams(window.location.search).get("debug")
    || "off";
  return value === "depth" ? "rawDepth" : SHADOW_DEBUG_OPTIONS.includes(value) ? value : "off";
}

function toShadowDebugMode(value) {
  return value === "off" ? false : value;
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
  const leaves = [
    [-0.46, -0.18, 0.18, 0.09, -28, 42, 128, 50],
    [-0.30, 0.18, 0.20, 0.10, 18, 50, 146, 58],
    [-0.14, -0.06, 0.22, 0.11, -6, 35, 122, 48],
    [0.02, 0.24, 0.18, 0.10, 36, 60, 156, 64],
    [0.16, -0.22, 0.21, 0.10, -35, 34, 118, 46],
    [0.34, 0.02, 0.19, 0.10, 9, 46, 138, 54],
    [0.48, -0.24, 0.15, 0.08, -18, 40, 128, 48],
    [-0.52, 0.28, 0.14, 0.08, 42, 54, 150, 56],
    [-0.04, -0.40, 0.16, 0.08, 12, 38, 132, 50],
    [0.28, 0.36, 0.15, 0.08, -44, 48, 142, 54],
    [-0.26, -0.34, 0.13, 0.07, 54, 36, 124, 48],
    [0.54, 0.22, 0.12, 0.07, 26, 58, 154, 60]
  ];
  const stems = [
    [-0.54, 0.22, 0.28, -0.34, 0.028],
    [-0.42, -0.24, 0.46, 0.18, 0.020],
    [-0.08, 0.36, 0.14, -0.48, 0.018]
  ];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const nx = (x / size) * 2 - 1;
      const ny = (y / size) * 2 - 1;
      let opaque = false;
      let red = 40;
      let green = 126;
      let blue = 48;
      for (const [x1, y1, x2, y2, width] of stems) {
        if (distanceToSegment(nx, ny, x1, y1, x2, y2) < width) {
          opaque = true;
          red = 30;
          green = 94;
          blue = 36;
          break;
        }
      }
      for (const [cx, cy, rx, ry, angle, r, g, b] of leaves) {
        const radians = angle * DEG_TO_RAD;
        const dx = nx - cx;
        const dy = ny - cy;
        const u = Math.cos(radians) * dx + Math.sin(radians) * dy;
        const v = -Math.sin(radians) * dx + Math.cos(radians) * dy;
        if ((u * u) / (rx * rx) + (v * v) / (ry * ry) < 1) {
          opaque = true;
          red = r;
          green = g;
          blue = b;
        }
      }
      image.data[i] = opaque ? red : 36;
      image.data[i + 1] = opaque ? green : 78;
      image.data[i + 2] = opaque ? blue : 38;
      image.data[i + 3] = opaque ? 255 : 0;
    }
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}

function distanceToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lengthSq = dx * dx + dy * dy;
  const t = lengthSq === 0
    ? 0
    : Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lengthSq));
  const sx = x1 + dx * t;
  const sy = y1 + dy * t;
  return Math.hypot(px - sx, py - sy);
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
  if (typeof value === "string") {
    return value;
  }
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


function mustBuild(result) {
  if (!result.ok) {
    throw new Error(result.error);
  }
  return result.value;
}
