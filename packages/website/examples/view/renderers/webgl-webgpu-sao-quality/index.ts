import {TrianglesPrimitive} from "@xeokit/sdk/base/constants";
import {buildBox, buildCylinder, buildSphere} from "@xeokit/sdk/model/generation/buildGeometry";
import {Scene, buildMat4} from "@xeokit/sdk/model/scene";
import {BVHPickStrategy, RoutingPickStrategy} from "@xeokit/sdk/spatial/picking";
import {ModelNavigationController} from "@xeokit/sdk/viewing/navigation/model";
import {WebGLRenderer} from "@xeokit/sdk/viewing/renderers/webGL";
import {WebGPURenderer} from "@xeokit/sdk/viewing/renderers/webGPU";
import {AmbientLight, DirLight, Viewer} from "@xeokit/sdk/viewing/viewer";
import {finishExample, mustOk, signalExampleLoaded} from "../../../utils/standaloneRuntime.js";

const webglCanvas = document.getElementById("webglCanvas");
const webgpuCanvas = document.getElementById("webgpuCanvas");
const webglStatus = document.getElementById("webglStatus");
const webgpuStatus = document.getElementById("webgpuStatus");
const saoControls = document.getElementById("saoControls");

const WORLD_UP = [0, 0, 1];
const SKY_COLOR = [0.46, 0.56, 0.70];
const HORIZON_COLOR = [0.62, 0.66, 0.72];
const GROUND_COLOR = [0.22, 0.22, 0.20];
const LIGHT_DIRECTION = normalize3([-0.52, -0.42, -0.74]);
const DEG_TO_RAD = Math.PI / 180;
const SAO_DEBUG_OPTIONS = ["off", "linearDepth", "normal", "rawOcclusion", "blurredOcclusion", "finalFactor"];

const SAO_DEFAULTS = {
  enabled: true,
  debug: getInitialSAODebugMode(),
  blur: true,
  intensity: 0.14,
  kernelRadius: 44,
  scale: 1.25,
  bias: 0.42,
  minResolution: 0.0,
  numSamples: 16,
  blendCutoff: 0.24,
  blendFactor: 1.18
};

const CONTROL_DEFS = [
  {id: "enabled", label: "SAO", type: "toggle"},
  {id: "debug", label: "Debug", type: "select", options: SAO_DEBUG_OPTIONS},
  {id: "blur", label: "Blur", type: "toggle"},
  {id: "intensity", label: "Intensity", min: 0, max: 0.25, step: 0.005, digits: 3},
  {id: "kernelRadius", label: "Radius", min: 2, max: 90, step: 1, digits: 0},
  {id: "numSamples", label: "Samples", type: "select", options: [4, 8, 12, 16, 24]},
  {id: "scale", label: "Scale", min: 0.1, max: 3, step: 0.05, digits: 2},
  {id: "bias", label: "Bias", min: 0, max: 1.2, step: 0.02, digits: 2},
  {id: "blendCutoff", label: "Cutoff", min: 0, max: 0.95, step: 0.01, digits: 2},
  {id: "blendFactor", label: "Blend", min: 0, max: 2, step: 0.02, digits: 2}
];

const runtime = {
  scene: null,
  sceneModel: null,
  webglViewer: null,
  webgpuViewer: null,
  webglView: null,
  webgpuView: null,
  webglRenderer: null,
  webgpuRenderer: null,
  saoState: {...SAO_DEFAULTS}
};

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  setStatus(webglStatus, "error", message);
  setStatus(webgpuStatus, "error", message);
  console.error("[view/renderers/webgl-webgpu-sao-quality]", error);
});

async function main() {
  const scene = new Scene({logging: false});
  const sceneModel = mustOk(scene.createModel({
    id: "saoQuality",
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
  runtime.scene = scene;
  runtime.sceneModel = sceneModel;

  const viewParams = {
    backgroundColor: [0.82, 0.86, 0.90],
    camera: {
      projection: "perspective",
      eye: [3.05, -4.65, 2.65],
      look: [0.08, -0.18, 0.52],
      up: WORLD_UP,
      far: 1000
    },
    effects: {
      sky: {
        enabled: true,
        skyColor: SKY_COLOR,
        horizonColor: HORIZON_COLOR,
        groundColor: GROUND_COLOR,
        horizonBlend: 0.24,
        sunEnabled: true,
        sunDirection: normalize3([0.46, 0.52, 0.72]),
        sunColor: [1.0, 0.92, 0.74],
        sunAngularSize: 1.5,
        sunGlowSize: 8,
        sunGlowIntensity: 0.05,
        worldUp: WORLD_UP
      },
      tonemap: {
        enabled: true,
        mode: "aces",
        sRGBEncode: true
      },
      sao: toSAOParams(runtime.saoState),
      shadows: {
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
  runtime.webglViewer = webglViewer;
  runtime.webgpuViewer = webgpuViewer;

  const webglView = mustOk(webglViewer.createView({
    id: "saoQualityWebGL",
    htmlElement: webglCanvas,
    ...clone(viewParams)
  }));
  const webgpuView = mustOk(webgpuViewer.createView({
    id: "saoQualityWebGPU",
    htmlElement: webgpuCanvas,
    ...clone(viewParams)
  }));
  runtime.webglView = webglView;
  runtime.webgpuView = webgpuView;

  configureLights(webglView, AmbientLight, DirLight);
  configureLights(webgpuView, AmbientLight, DirLight);
  setupSAOControls([webglView, webgpuView]);
  syncViewCameras(webglView, webgpuView);

  const webglRenderer = new WebGLRenderer({
    viewer: webglViewer,
    logging: false
  });
  mustOk(webglRenderer.setInfiniteGridEnabled(true));
  runtime.webglRenderer = webglRenderer;
  const webglPicker = new RoutingPickStrategy(scene, webglRenderer);
  createInputController(ModelNavigationController, webglView, webglPicker);
  updateStatusText();

  let webgpuRenderer = null;
  if (navigator.gpu) {
    const result = await WebGPURenderer.create({
      viewer: webgpuViewer,
      logging: false
    });
    if (result.ok) {
      webgpuRenderer = result.value;
      mustOk(webgpuRenderer.setInfiniteGridEnabled(true));
      runtime.webgpuRenderer = webgpuRenderer;
      webgpuRenderer.events.onError.subscribe((_renderer, error) => {
        setStatus(webgpuStatus, "error", error.error);
        console.error("[view/renderers/webgl-webgpu-sao-quality] WebGPU", error.error);
      });
      const webgpuPicker = new BVHPickStrategy(scene);
      createInputController(ModelNavigationController, webgpuView, webgpuPicker);
      updateStatusText();
    } else {
      setStatus(webgpuStatus, "warn", result.error);
    }
  } else {
    setStatus(webgpuStatus, "warn", "WebGPU unavailable in this browser.");
  }

  finishExample(webglRenderer, webglView);
  setTimeout(signalExampleLoaded, 1500);
  updateDemoState();
}

function buildScene(sceneModel) {
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
      castsShadow: false,
      matrix: buildMat4({position, scale, rotation})
    }));
    mustOk(sceneModel.createObject({
      id: objectId,
      meshIds: [meshId],
      castsShadow: false,
      pickable: options.pickable !== false
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

  const addShelf = (x, z, width) => {
    place("box", "shelf", [x, 1.36, z], [width, 0.08, 0.045]);
    place("box", "shelfBracket", [x - width * 0.35, 1.30, z - 0.16], [0.035, 0.045, 0.24]);
    place("box", "shelfBracket", [x + width * 0.35, 1.30, z - 0.16], [0.035, 0.045, 0.24]);
    place("sphere", "smallObject", [x - width * 0.18, 1.25, z + 0.12], [0.10, 0.10, 0.10]);
    place("cylinderZ", "smallObject", [x + width * 0.20, 1.25, z + 0.13], [0.08, 0.08, 0.20]);
  };

  place("box", "floor", [0, 0, -0.035], [4.8, 3.6, 0.035], [0, 0, 0], {pickable: false});
  place("box", "rearWall", [0, 1.68, 1.04], [4.8, 0.055, 1.04], [0, 0, 0], {pickable: false});
  place("box", "sideWall", [-2.36, 0, 1.04], [0.055, 3.4, 1.04], [0, 0, 0], {pickable: false});
  place("box", "baseboard", [0, 1.60, 0.11], [4.46, 0.055, 0.055]);
  place("box", "baseboard", [-2.29, 0.0, 0.11], [0.055, 3.16, 0.055]);

  place("box", "counterTop", [0.0, -0.42, 0.72], [1.45, 0.42, 0.055]);
  place("box", "counterApron", [0.0, -0.80, 0.56], [1.45, 0.04, 0.15]);
  place("box", "cabinetFace", [-0.78, -0.42, 0.36], [0.05, 0.34, 0.34]);
  place("box", "cabinetFace", [0.78, -0.42, 0.36], [0.05, 0.34, 0.34]);
  place("box", "cabinetFace", [0.0, -0.10, 0.36], [0.72, 0.05, 0.34]);
  place("cylinderZ", "smallObject", [-0.44, -0.44, 0.88], [0.09, 0.09, 0.22]);
  place("sphere", "smallObject", [0.24, -0.46, 0.90], [0.14, 0.14, 0.14]);
  place("box", "contactBar", [0.58, -0.47, 0.78], [0.26, 0.035, 0.035]);

  addStool(-0.52, -1.10);
  addStool(0.22, -1.12);
  addStool(0.96, -1.08);

  place("box", "matteBlock", [-1.58, -0.78, 0.28], [0.30, 0.30, 0.28]);
  place("box", "matteBlock", [-1.28, -0.78, 0.54], [0.30, 0.30, 0.11]);
  place("sphere", "smoothObject", [-1.28, -0.38, 0.28], [0.26, 0.26, 0.26]);
  place("cylinderY", "darkObject", [-1.88, -0.38, 0.30], [0.13, 0.42, 0.13], [0, 0, 0]);

  for (let i = 0; i < 5; i++) {
    place("box", i % 2 ? "stepWarm" : "stepCool", [1.70, 0.16 + i * 0.24, 0.05 + i * 0.075], [0.62, 0.19, 0.05 + i * 0.075]);
  }
  place("box", "contactBar", [1.38, 1.17, 0.48], [0.035, 0.38, 0.035]);
  place("box", "contactBar", [2.02, 1.17, 0.48], [0.035, 0.38, 0.035]);

  addShelf(-1.10, 1.16, 0.92);
  addShelf(0.86, 1.34, 1.06);

  place("box", "slab", [2.12, -0.70, 0.48], [0.055, 0.68, 0.48], [0, 0, -10 * DEG_TO_RAD]);
  place("box", "matteBlock", [2.42, -0.88, 0.24], [0.24, 0.24, 0.24]);
  place("sphere", "smoothObject", [2.80, -0.88, 0.24], [0.24, 0.24, 0.24]);

  place("box", "recessDark", [-1.68, 1.43, 0.72], [0.38, 0.08, 0.34]);
  place("box", "recessLight", [-1.68, 1.31, 0.72], [0.28, 0.06, 0.24]);
  place("box", "recessDark", [-1.68, 1.20, 0.72], [0.16, 0.05, 0.15]);
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
    heightSegments: 20
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
    radialSegments: 32,
    heightSegments: 1,
    openEnded: false
  }));
  createCylinderGeometry(sceneModel, TrianglesPrimitive, "cylinderX", cylinder, "x");
  createCylinderGeometry(sceneModel, TrianglesPrimitive, "cylinderY", cylinder, "y");
  createCylinderGeometry(sceneModel, TrianglesPrimitive, "cylinderZ", cylinder, "z");
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
  createMaterial(sceneModel, "floor", [0.43, 0.45, 0.45], 0.78, 0);
  createMaterial(sceneModel, "rearWall", [0.56, 0.58, 0.56], 0.82, 0);
  createMaterial(sceneModel, "sideWall", [0.50, 0.54, 0.59], 0.86, 0);
  createMaterial(sceneModel, "baseboard", [0.35, 0.35, 0.32], 0.70, 0);
  createMaterial(sceneModel, "counterTop", [0.38, 0.32, 0.24], 0.48, 0);
  createMaterial(sceneModel, "counterApron", [0.26, 0.24, 0.22], 0.58, 0);
  createMaterial(sceneModel, "cabinetFace", [0.42, 0.36, 0.28], 0.64, 0);
  createMaterial(sceneModel, "stoolSeat", [0.48, 0.28, 0.14], 0.54, 0);
  createMaterial(sceneModel, "stoolLeg", [0.18, 0.20, 0.22], 0.44, 0.16);
  createMaterial(sceneModel, "matteBlock", [0.62, 0.28, 0.16], 0.82, 0);
  createMaterial(sceneModel, "smoothObject", [0.20, 0.46, 0.66], 0.42, 0);
  createMaterial(sceneModel, "darkObject", [0.12, 0.15, 0.18], 0.58, 0.08);
  createMaterial(sceneModel, "smallObject", [0.70, 0.58, 0.22], 0.46, 0.06);
  createMaterial(sceneModel, "contactBar", [0.64, 0.30, 0.16], 0.72, 0);
  createMaterial(sceneModel, "stepWarm", [0.46, 0.36, 0.20], 0.76, 0);
  createMaterial(sceneModel, "stepCool", [0.26, 0.34, 0.42], 0.74, 0);
  createMaterial(sceneModel, "shelf", [0.30, 0.32, 0.34], 0.62, 0);
  createMaterial(sceneModel, "shelfBracket", [0.14, 0.16, 0.18], 0.55, 0.10);
  createMaterial(sceneModel, "slab", [0.20, 0.21, 0.25], 0.66, 0);
  createMaterial(sceneModel, "recessDark", [0.11, 0.13, 0.15], 0.80, 0);
  createMaterial(sceneModel, "recessLight", [0.46, 0.48, 0.42], 0.78, 0);
}

function createMaterial(sceneModel, id, color, roughness, metallic) {
  mustOk(sceneModel.createMaterial({
    id,
    color,
    roughness,
    metallic
  }));
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
  view.effects.shadows.enabled = false;
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
  view.lights.hemispheric.intensity = 0.07;
  view.lights.hemispheric.skyColor = SKY_COLOR;
  view.lights.hemispheric.groundColor = GROUND_COLOR;
  view.lights.hemispheric.worldUp = WORLD_UP;
  view.lights.ibl.enabled = false;
  view.clearLights();
  new AmbientLight(view, {
    color: [1, 1, 1],
    intensity: 0.18
  });
  new DirLight(view, {
    dir: LIGHT_DIRECTION,
    color: [1.0, 0.92, 0.78],
    intensity: 0.95,
    space: "world"
  });
}

function setupSAOControls(views) {
  if (!saoControls) {
    return;
  }
  const state = runtime.saoState;
  const render = () => {
    saoControls.replaceChildren(...CONTROL_DEFS.map((def) => createControl(def, state, (id, value) => {
      state[id] = value;
      applySAOState(views, state);
      syncUrlFromState(state);
      render();
      updateStatusText();
      updateDemoState();
    })));
  };
  render();
  applySAOState(views, state);
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

function parseSelectValue(def, state, rawValue) {
  return typeof state[def.id] === "number" ? Number(rawValue) : rawValue;
}

function applySAOState(views, state) {
  for (const view of views) {
    const sao = view.effects.sao;
    sao.enabled = state.enabled;
    sao.debug = toSAODebugMode(state.debug);
    sao.blur = state.blur;
    sao.intensity = state.intensity;
    sao.kernelRadius = state.kernelRadius;
    sao.scale = state.scale;
    sao.bias = state.bias;
    sao.minResolution = state.minResolution;
    sao.numSamples = state.numSamples;
    sao.blendCutoff = state.blendCutoff;
    sao.blendFactor = state.blendFactor;
  }
}

function toSAOParams(state) {
  return {
    enabled: state.enabled,
    debug: toSAODebugMode(state.debug),
    blur: state.blur,
    intensity: state.intensity,
    kernelRadius: state.kernelRadius,
    scale: state.scale,
    bias: state.bias,
    minResolution: state.minResolution,
    numSamples: state.numSamples,
    blendCutoff: state.blendCutoff,
    blendFactor: state.blendFactor
  };
}

function getInitialSAODebugMode() {
  const params = new URLSearchParams(window.location.search);
  const value = params.get("saoDebug") || params.get("debug") || "off";
  return SAO_DEBUG_OPTIONS.includes(value) ? value : "off";
}

function toSAODebugMode(value) {
  return value === "off" ? false : value;
}

function syncUrlFromState(state) {
  const url = new URL(window.location.href);
  if (state.debug === "off") {
    url.searchParams.delete("saoDebug");
  } else {
    url.searchParams.set("saoDebug", state.debug);
  }
  history.replaceState(null, "", url.toString());
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
    if (
      vectorEquals(source.camera.eye, target.camera.eye) &&
      vectorEquals(source.camera.look, target.camera.look) &&
      vectorEquals(source.camera.up, target.camera.up)
    ) {
      return;
    }
    syncing = true;
    target.camera.eye = copyVector(source.camera.eye);
    target.camera.look = copyVector(source.camera.look);
    target.camera.up = copyVector(source.camera.up);
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

function vectorEquals(a, b, epsilon = 1e-9) {
  if (!a || !b || a.length !== b.length) {
    return false;
  }
  for (let i = 0; i < a.length; i++) {
    if (Math.abs(Number(a[i]) - Number(b[i])) > epsilon) {
      return false;
    }
  }
  return true;
}

function copyVector(value) {
  return Array.from(value, Number);
}

function updateStatusText() {
  const state = runtime.saoState;
  const message = `${countItems(runtime.scene?.objects)} objects, debug ${state.debug}, ${state.numSamples} samples, radius ${state.kernelRadius}.`;
  if (runtime.webglRenderer) {
    setStatus(webglStatus, "ok", message);
  }
  if (runtime.webgpuRenderer) {
    setStatus(webgpuStatus, "ok", message);
  }
}

function updateDemoState() {
  window.webglWebgpuSAOQualityDemo = {
    scene: runtime.scene,
    sceneModel: runtime.sceneModel,
    webglViewer: runtime.webglViewer,
    webgpuViewer: runtime.webgpuViewer,
    webglView: runtime.webglView,
    webgpuView: runtime.webgpuView,
    webglRenderer: runtime.webglRenderer,
    webgpuRenderer: runtime.webgpuRenderer,
    saoState: runtime.saoState,
    applySAOState: (state) => {
      Object.assign(runtime.saoState, state);
      applySAOState([runtime.webglView, runtime.webgpuView].filter(Boolean), runtime.saoState);
      updateStatusText();
      updateDemoState();
    }
  };
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
