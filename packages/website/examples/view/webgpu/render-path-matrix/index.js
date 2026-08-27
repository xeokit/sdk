import * as xeokit from "../../../../js/xeokit-studio-bundle.js";

const {
  LinesPrimitive,
  PointsPrimitive,
  TrianglesPrimitive
} = xeokit.base.constants;

const MATRIX_RENDER_MODE = 10001;
const DIAGNOSTIC_TEXTURE_SIZE = 512;
const UV_TILE_REPEAT = 3.0;
const TRIPLANAR_TILE_SCALE = 1.0;
const DIAGNOSTIC_RADIUS = 1.08;
const GROUND_TOP_Z = -0.03;
const GROUND_SCALE_Z = 1.3;
const GROUND_POSITION_Z = GROUND_TOP_Z - GROUND_SCALE_Z * 0.5;
const GROUND_SCALE_X = 2.4;
const GROUND_SCALE_Y = 1.75;
const DIAGNOSTIC_CONTACT_LIFT = 0.62;
const DIAGNOSTIC_FORWARD_OFFSET = [0.22, -0.3];
const DIAGNOSTIC_ALBEDO = [0.72, 0.72, 0.70];
const GENERATED_TEXTURE_CACHE = new Map();
const MATERIALS = {
  bricks: "Bricks",
  rust: "Rust",
  gripPlate: "Shiny Tiles"
};

const PRIMITIVES = {
  triangles: {label: "Triangles", value: TrianglesPrimitive},
  lines: {label: "Lines", value: LinesPrimitive},
  points: {label: "Points", value: PointsPrimitive}
};

const DEFAULT_CONFIG = {
  renderer: "webgpu",
  primitive: "triangles",
  material: "bricks",
  normals: true,
  uvs: true,
  triplanar: false,
  colorTexture: true,
  normalTexture: false,
  occlusionTexture: true,
  metallicRoughnessTexture: true,
  clearcoat: false,
  sheen: false,
  ambientLight: true,
  directionalLight: false,
  hemisphereLight: false,
  ibl: true,
  sao: true,
  bloom: false,
  atmosphere: false,
  depthOfField: false,
  colorGrading: false,
  shadows: false,
  shadowDebug: "off",
  tonemap: true,
  srgb: true,
  antialiasing: true,
  edges: false
};

const BOOLEAN_FIELDS = [
  "normals",
  "uvs",
  "triplanar",
  "colorTexture",
  "normalTexture",
  "occlusionTexture",
  "metallicRoughnessTexture",
  "clearcoat",
  "sheen",
  "ambientLight",
  "directionalLight",
  "hemisphereLight",
  "ibl",
  "sao",
  "bloom",
  "atmosphere",
  "depthOfField",
  "colorGrading",
  "shadows",
  "tonemap",
  "srgb",
  "antialiasing",
  "edges"
];

const LEGACY_GEOMETRIES = {
  tris: {primitive: "triangles", normals: false, uvs: false, triplanar: false, colorTexture: false},
  "tris-normals": {primitive: "triangles", normals: true, uvs: false, triplanar: false, colorTexture: false},
  "tris-uvs": {primitive: "triangles", normals: false, uvs: true, triplanar: false, colorTexture: true},
  "tris-normals-uvs": {primitive: "triangles", normals: true, uvs: true, triplanar: false, colorTexture: true},
  "tris-triplanar": {primitive: "triangles", normals: false, uvs: false, triplanar: true, colorTexture: true},
  "tris-normals-triplanar": {primitive: "triangles", normals: true, uvs: false, triplanar: true, colorTexture: true}
};

const MODEL_CONFIG_FIELDS = [
  "primitive",
  "material",
  "normals",
  "uvs",
  "triplanar",
  "colorTexture",
  "normalTexture",
  "occlusionTexture",
  "metallicRoughnessTexture",
  "clearcoat",
  "sheen"
];

let config = parseConfig();

const runtime = {
  SceneModel: null,
  AmbientLight: null,
  DirLight: null,
  InputController: null,
  WebGLRenderer: null,
  WebGPURenderer: null,
  scene: null,
  viewer: null,
  view: null,
  renderer: null,
  sceneModel: null,
  rendererKind: null,
  iblEnvironmentReady: false,
  applying: null,
  pendingConfig: null,
  renderGeneration: 0,
  renderUnsubscribe: null
};

main().catch((err) => {
  console.error(err);
  document.getElementById("summary").textContent = String(err?.message ?? err);
});

async function main() {
  const {Scene} = xeokit.model.scene;
  const {Viewer, AmbientLight, DirLight} = xeokit.viewing.viewer;
  const {ModelNavigationController: InputController} = xeokit.viewing.navigation.model;
  const {WebGLRenderer} = xeokit.viewing.renderers.webGL;
  const {WebGPURenderer} = xeokit.viewing.renderers.webGPU;
  runtime.AmbientLight = AmbientLight;
  runtime.DirLight = DirLight;
  runtime.InputController = InputController;
  runtime.WebGLRenderer = WebGLRenderer;
  runtime.WebGPURenderer = WebGPURenderer;

  const scene = new Scene({logging: true});
  const viewer = new Viewer({scene, logging: true});
  const view = mustCreate(viewer.createView({
    id: "renderPathMatrixView",
    camera: {
      projection: "perspective",
      eye: [-3.7481038423150204, -3.0514074222714562, 4.024710687493708],
      look: [-0.3811563865442683, 0.11241528453856023, -0.07260130698827741],
      up: [0.30259233492325666, 0.28433722614115103, 0.9097198583498378],
      near: 0.1,
      far: 10000,
      fov: 60,
      fovAxis: "min"
    },
    htmlElement: document.getElementById("demoCanvas"),
    backgroundColor: [0.94, 0.96, 0.98],
    effects: {
      edges: {
        enabled: false
      },
      tonemap: {
        enabled: false,
        mode: "aces",
        sRGBEncode: true
      },
      sao: {
        enabled: false
      },
      bloom: {
        enabled: false
      },
      atmosphere: {
        enabled: false
      },
      depthOfField: {
        enabled: false
      },
      colorGrading: {
        enabled: false
      },
      shadows: {
        enabled: false
      },
      antiAliasing: {
        enabled: false
      }
    }
  }));

  new runtime.InputController(view, {
    pick: () => ({ok: true, value: null}),
    followPointer: false,
    rotationInertia: 0,
    panInertia: 0,
    dollyInertia: 0,
    doublePickFlyTo: false,
    keyboardDollyRate: 4,
    keyboardPanRate: 2,
    mouseWheelDollyRate: 30,
    touchDollyRate: 0.1
  });

  runtime.scene = scene;
  runtime.viewer = viewer;
  runtime.view = view;
  window.renderPathMatrix = {
    scene,
    viewer,
    renderer: null,
    sceneModel: null,
    view,
    config,
    expectedHash: configToHash(config),
    lastError: null,
    renderedFramesAfterSetup: 0,
    captureArmed: false,
    renderGeneration: 0,
    ready: false,
    applyConfig: queueApplyConfig
  };
  await applyConfig(config, {initial: true});
  window.addEventListener("hashchange", () => queueApplyConfig(parseConfig()));
  window.addEventListener("popstate", () => queueApplyConfig(parseConfig()));
  window.addEventListener("resize", () => view.needsRender());
}

function queueApplyConfig(nextConfig) {
  runtime.pendingConfig = nextConfig;
  if (!runtime.applying) {
    runtime.applying = (async () => {
      while (runtime.pendingConfig) {
        const cfg = runtime.pendingConfig;
        runtime.pendingConfig = null;
        await applyConfig(cfg);
      }
    })().finally(() => {
      runtime.applying = null;
    });
  }
  return runtime.applying;
}

async function applyConfig(nextConfig, {initial = false} = {}) {
  const previousConfig = config;
  const rendererChanged = initial || nextConfig.renderer !== runtime.rendererKind;
  const modelChanged = rendererChanged || MODEL_CONFIG_FIELDS.some((field) => previousConfig[field] !== nextConfig[field]);

  resetLoadedSignal();
  document.body.classList.add("is-reconfiguring");
  await new Promise((resolve) => requestAnimationFrame(resolve));
  try {
    if (rendererChanged) {
      await rebuildRenderer(nextConfig);
    }
    applyViewConfig(runtime.view, nextConfig);
    if (modelChanged) {
      rebuildSceneModel(nextConfig);
    }

    config = nextConfig;
    window.renderPathMatrix.lastError = null;
    syncUrlFromConfig(config);
    updateRuntimeState();
    writePanel(config);
    signalLoadedAfterConfiguredRender();
  } catch (error) {
    const message = String(error?.message ?? error);
    config = previousConfig;
    syncUrlFromConfig(config);
    updateRuntimeState();
    window.renderPathMatrix.lastError = message;
    writePanel(config);
    if (runtime.renderer) {
      signalLoadedAfterConfiguredRender();
    }
    if (initial) {
      throw error;
    }
  } finally {
    document.body.classList.remove("is-reconfiguring");
  }
}

async function rebuildRenderer(cfg) {
  let nextRenderer;
  if (cfg.renderer === "webgpu") {
    if (!navigator.gpu) {
      throw new Error("This browser does not expose navigator.gpu. Use renderer=webgl.");
    }
    nextRenderer = mustCreate(await runtime.WebGPURenderer.create({
      viewer: runtime.viewer,
      logging: true
    }));
  } else {
    nextRenderer = new runtime.WebGLRenderer({
      viewer: runtime.viewer,
      logging: true
    });
  }

  if (runtime.renderer) {
    runtime.renderer.destroy();
  }
  runtime.renderer = nextRenderer;
  runtime.rendererKind = cfg.renderer;
  runtime.renderer.events?.onError?.subscribe((_renderer, error) => {
    console.error("[view/webgpu/render-path-matrix]", error.error || error);
  });
}

function rebuildSceneModel(cfg) {
  if (runtime.sceneModel) {
    runtime.sceneModel.destroy();
    runtime.sceneModel = null;
  }

  const sceneModel = mustCreate(runtime.scene.createModel({
    id: "renderPathMatrixModel",
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

  mustCreate(sceneModel.beginBatch({id: "renderPathMatrixBatch"}));
  try {
    createDiagnosticTextures(sceneModel, cfg);
    createDiagnosticMaterials(sceneModel, cfg);
    createDiagnosticGeometry(sceneModel, cfg);
    createGround(sceneModel, cfg);
    mustCreate(sceneModel.commitBatch());
  } catch (error) {
    sceneModel.rollbackBatch();
    throw error;
  }
  runtime.sceneModel = sceneModel;
}

function applyViewConfig(view, cfg) {
  configureView(view, cfg);
  view.effects.edges.enabled = cfg.edges;
  view.effects.tonemap.enabled = cfg.tonemap;
  view.effects.tonemap.mode = "aces";
  view.effects.tonemap.sRGBEncode = cfg.srgb;
  view.effects.sao.enabled = cfg.sao;
  view.effects.bloom.enabled = cfg.bloom;
  view.effects.atmosphere.enabled = cfg.atmosphere;
  view.effects.depthOfField.enabled = cfg.depthOfField;
  view.effects.colorGrading.enabled = cfg.colorGrading;
  view.effects.shadows.enabled = cfg.shadows;
  view.effects.antiAliasing.enabled = cfg.antialiasing;

  view.clearLights();
  if (cfg.ambientLight) {
    new runtime.AmbientLight(view, {
      color: [1, 1, 1],
      intensity: 0.8
    });
  }
  if (cfg.directionalLight) {
    new runtime.DirLight(view, {
      dir: view.effects.shadows.direction,
      color: [1.0, 0.96, 0.86],
      intensity: 1.8,
      space: "world"
    });
  }
  view.needsRender();
}

function updateRuntimeState() {
  const state = window.renderPathMatrix;
  state.renderer = runtime.renderer;
  state.sceneModel = runtime.sceneModel;
  state.config = config;
  state.expectedHash = configToHash(config);
  state.ready = false;
  state.captureArmed = false;
  state.renderedFramesAfterSetup = 0;
  state.renderGeneration = runtime.renderGeneration;
}

function syncUrlFromConfig(cfg) {
  const expectedHash = configToHash(cfg);
  if (location.hash.replace(/^#/, "") !== expectedHash) {
    history.replaceState(null, "", `#${expectedHash}`);
  }
}

function parseConfig() {
  const params = readParams();
  const cfg = {...DEFAULT_CONFIG};

  applyLegacyConfig(cfg, params);

  cfg.renderer = normalizeChoice(params.get("renderer") ?? params.get("backend"), ["webgpu", "webgl", "auto"], cfg.renderer);
  if (cfg.renderer === "auto") {
    cfg.renderer = navigator.gpu ? "webgpu" : "webgl";
  }
  cfg.primitive = normalizeChoice(params.get("primitive"), Object.keys(PRIMITIVES), cfg.primitive);
  cfg.material = normalizeChoice(params.get("material"), Object.keys(MATERIALS), cfg.material);

  for (const field of BOOLEAN_FIELDS) {
    cfg[field] = readBoolean(params, field, cfg[field]);
  }
  cfg.shadowDebug = normalizeChoice(params.get("shadowDebug"), ["off", "factor", "depth"], cfg.shadowDebug);

  if (cfg.primitive !== "triangles") {
    cfg.normals = false;
    cfg.uvs = false;
    cfg.triplanar = false;
    cfg.colorTexture = false;
    cfg.normalTexture = false;
    cfg.occlusionTexture = false;
    cfg.metallicRoughnessTexture = false;
    cfg.clearcoat = false;
    cfg.sheen = false;
  }

  return cfg;
}

function readParams() {
  const params = new URLSearchParams(location.search);
  const hash = new URLSearchParams(location.hash.replace(/^#/, ""));
  hash.forEach((value, key) => params.set(key, value));
  return params;
}

function applyLegacyConfig(cfg, params) {
  const geom = params.get("geom");
  if (geom && geom !== "all" && LEGACY_GEOMETRIES[geom]) {
    Object.assign(cfg, LEGACY_GEOMETRIES[geom]);
  }
}

function normalizeChoice(value, choices, fallback) {
  return value && choices.includes(value) ? value : fallback;
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

function createDiagnosticTextures(sceneModel, cfg) {
  const cacheKey = `${cfg.material}:${DIAGNOSTIC_TEXTURE_SIZE}`;
  const textureId = (kind) => `tex_${kind}_${cfg.material}`;
  const useMipmaps = cfg.renderer === "webgpu";
  const minFilter = useMipmaps
    ? xeokit.base.constants.LinearMipMapLinearFilter
    : xeokit.base.constants.LinearFilter;
  // Keep generated roughness data at level 0 for parity. Mip-averaging the
  // diagnostic metallic-roughness map makes WebGPU look less specular than
  // WebGL, which samples the generated atlas without a mip pyramid.
  const dataMinFilter = xeokit.base.constants.LinearFilter;
  let textureSet = GENERATED_TEXTURE_CACHE.get(cacheKey);
  if (!textureSet) {
    textureSet = cfg.material === "rust"
      ? {
        albedo: makeRustAlbedoTexture(DIAGNOSTIC_TEXTURE_SIZE),
        metallicRoughness: makeRustMetallicRoughnessTexture(DIAGNOSTIC_TEXTURE_SIZE),
        normal: makeRustNormalTexture(DIAGNOSTIC_TEXTURE_SIZE),
        occlusion: makeRustOcclusionTexture(DIAGNOSTIC_TEXTURE_SIZE)
      }
      : cfg.material === "gripPlate"
          ? {
            albedo: makeGripPlateAlbedoTexture(DIAGNOSTIC_TEXTURE_SIZE),
            metallicRoughness: makeGripPlateMetallicRoughnessTexture(DIAGNOSTIC_TEXTURE_SIZE),
            normal: makeGripPlateNormalTexture(DIAGNOSTIC_TEXTURE_SIZE),
            occlusion: makeGripPlateOcclusionTexture(DIAGNOSTIC_TEXTURE_SIZE)
          }
        : {
          albedo: makeBrickTileAlbedoTexture(DIAGNOSTIC_TEXTURE_SIZE),
          metallicRoughness: makeMetallicRoughnessTexture(DIAGNOSTIC_TEXTURE_SIZE),
          normal: makeNormalTexture(DIAGNOSTIC_TEXTURE_SIZE),
          occlusion: makeOcclusionTexture(DIAGNOSTIC_TEXTURE_SIZE)
        };
    GENERATED_TEXTURE_CACHE.set(cacheKey, textureSet);
  }
  mustCreate(sceneModel.createTexture({
    id: textureId("albedo"),
    image: textureSet.albedo,
    encoding: xeokit.base.constants.sRGBEncoding,
    minFilter,
    mipmap: useMipmaps
  }));
  mustCreate(sceneModel.createTexture({
    id: textureId("mr"),
    image: textureSet.metallicRoughness,
    encoding: xeokit.base.constants.LinearEncoding,
    minFilter: dataMinFilter,
    mipmap: false
  }));
  mustCreate(sceneModel.createTexture({
    id: textureId("normal"),
    image: textureSet.normal,
    encoding: xeokit.base.constants.LinearEncoding,
    minFilter,
    mipmap: useMipmaps
  }));
  mustCreate(sceneModel.createTexture({
    id: textureId("occlusion"),
    image: textureSet.occlusion,
    encoding: xeokit.base.constants.LinearEncoding,
    minFilter,
    mipmap: useMipmaps
  }));
}

function createDiagnosticMaterials(sceneModel, cfg) {
  const textureId = (kind) => `tex_${kind}_${cfg.material}`;
  const materialParams = {
    id: "mat_diagnostic",
    color: cfg.colorTexture ? [1, 1, 1] : DIAGNOSTIC_ALBEDO,
    roughness: cfg.metallicRoughnessTexture ? 0.45 : 0.38,
    metallic: cfg.metallicRoughnessTexture ? 1.0 : 0.0
  };

  if (cfg.colorTexture) {
    materialParams.colorTextureId = textureId("albedo");
  }
  if (cfg.normalTexture) {
    materialParams.normalsTextureId = textureId("normal");
  }
  if (cfg.occlusionTexture) {
    materialParams.occlusionTextureId = textureId("occlusion");
  }
  if (cfg.metallicRoughnessTexture) {
    materialParams.metallicRoughnessTextureId = textureId("mr");
  }
  if (cfg.clearcoat) {
    materialParams.clearcoat = 1.0;
    materialParams.clearcoatRoughness = cfg.material === "gripPlate" ? 0.06 : 0.14;
  }
  if (cfg.sheen) {
    materialParams.sheen = cfg.material === "gripPlate" ? 0.35 : 0.75;
    materialParams.sheenRoughness = cfg.material === "rust" ? 0.82 : 0.5;
  }
  if (cfg.triplanar) {
    materialParams.triplanarScale = TRIPLANAR_TILE_SCALE;
  }

  mustCreate(sceneModel.createMaterial(materialParams));
}

function createDiagnosticGeometry(sceneModel, cfg) {
  if (cfg.primitive === "triangles") {
    createTriangleGeometry(sceneModel, cfg);
    createDiagnosticMesh(sceneModel, cfg, [DIAGNOSTIC_FORWARD_OFFSET[0], DIAGNOSTIC_FORWARD_OFFSET[1], GROUND_TOP_Z + DIAGNOSTIC_RADIUS + DIAGNOSTIC_CONTACT_LIFT], [DIAGNOSTIC_RADIUS, DIAGNOSTIC_RADIUS, DIAGNOSTIC_RADIUS]);
    return;
  }

  if (cfg.primitive === "lines") {
    const lines = mustBuild(xeokit.model.generation.buildGeometry.buildBoxLines({
      xSize: 1.7,
      ySize: 1.7,
      zSize: 1.7
    }));
    mustCreate(sceneModel.createGeometry({
      id: "geom_diagnostic",
      primitive: LinesPrimitive,
      positions: lines.positions,
      indices: lines.indices
    }));
    createDiagnosticMesh(sceneModel, cfg, [0, 0, 1.0], [1, 1, 1]);
    return;
  }

  const points = createPointCloud(260);
  mustCreate(sceneModel.createGeometry({
    id: "geom_diagnostic",
    primitive: PointsPrimitive,
    positions: points.positions,
    colors: points.colors
  }));
  createDiagnosticMesh(sceneModel, cfg, [0, 0, 1.0], [1, 1, 1]);
}

function createTriangleGeometry(sceneModel, cfg) {
  const sphere = mustBuild(xeokit.model.generation.buildGeometry.buildSphere({
    radius: 1,
    widthSegments: 32,
    heightSegments: 18
  }));
  const params = {
    id: "geom_diagnostic",
    primitive: TrianglesPrimitive,
    positions: sphere.positions,
    indices: sphere.indices
  };
  if (cfg.normals) {
    params.normals = sphere.normals;
  }
  if (cfg.uvs) {
    params.uvs = scaleUVs(sphere.uv, UV_TILE_REPEAT);
  }
  mustCreate(sceneModel.createGeometry(params));
}

function createPointCloud(count) {
  const positions = [];
  const colors = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < count; i++) {
    const y = 1 - (i / Math.max(1, count - 1)) * 2;
    const radius = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = golden * i;
    positions.push(Math.cos(theta) * radius, Math.sin(theta) * radius, y);
    colors.push(0.10 + 0.80 * (i / count), 0.32, 0.88 - 0.48 * (i / count), 1.0);
  }
  return {positions, colors};
}

function scaleUVs(uvs, repeat) {
  const result = new Float32Array(uvs.length);
  for (let i = 0; i < uvs.length; i++) {
    result[i] = uvs[i] * repeat;
  }
  return result;
}

function createDiagnosticMesh(sceneModel, cfg, position, scale) {
  const meshParams = {
    id: "mesh_diagnostic",
    geometryId: "geom_diagnostic",
    matrix: xeokit.model.scene.buildMat4({
      position,
      scale
    })
  };
  if (cfg.primitive === "triangles") {
    meshParams.materialId = "mat_diagnostic";
  } else {
    meshParams.color = DIAGNOSTIC_ALBEDO;
  }
  mustCreate(sceneModel.createMesh(meshParams));
  mustCreate(sceneModel.createObject({
    id: "object_diagnostic",
    meshIds: ["mesh_diagnostic"]
  }));
}

function createGround(sceneModel, cfg) {
  const box = mustBuild(xeokit.model.generation.buildGeometry.buildBox({
    xSize: 1,
    ySize: 1,
    zSize: 1
  }));
  const params = {
    id: "geom_ground",
    primitive: TrianglesPrimitive,
    positions: box.positions,
    indices: box.indices
  };
  if (cfg.normals) {
    params.normals = box.normals;
  }
  if (cfg.uvs) {
    params.uvs = scaleUVs(box.uv, UV_TILE_REPEAT);
  }
  mustCreate(sceneModel.createGeometry(params));
  mustCreate(sceneModel.createMesh({
    id: "mesh_ground",
    geometryId: "geom_ground",
    materialId: "mat_diagnostic",
    matrix: xeokit.model.scene.buildMat4({
      position: [0, 0, GROUND_POSITION_Z],
      scale: [GROUND_SCALE_X, GROUND_SCALE_Y, GROUND_SCALE_Z]
    })
  }));
  mustCreate(sceneModel.createObject({
    id: "object_ground",
    meshIds: ["mesh_ground"]
  }));
}

function configureView(view, cfg) {
  view.texturing.enabled = cfg.colorTexture || cfg.normalTexture || cfg.occlusionTexture || cfg.metallicRoughnessTexture;
  view.effects.bodyHatch.enabled = false;
  view.effects.sectionPlaneCaps.enabled = false;

  view.lights.hemispheric.enabled = cfg.hemisphereLight;
  view.lights.hemispheric.intensity = cfg.hemisphereLight ? 0.35 : 0;
  view.lights.hemispheric.skyColor = [0.62, 0.72, 0.88];
  view.lights.hemispheric.groundColor = [0.28, 0.25, 0.22];
  view.lights.hemispheric.worldUp = [0, 0, 1];

  view.lights.ibl.intensity = cfg.ibl ? 0.9 : 0.0;
  view.lights.ibl.enabled = true;
  if (cfg.ibl && !runtime.iblEnvironmentReady) {
    const sunDirection = normalize3([0.35, 0.55, 0.76]);
    const hdrPixels = xeokit.model.generation.paintEnvironments.paintSunSkyHDR(512, 256, {sunDirection});
    const hdrBuffer = xeokit.model.generation.paintEnvironments.encodeRadianceHDR(hdrPixels, 512, 256);
    const hdrResult = view.lights.ibl.setEnvironmentHDRBuffer(hdrBuffer);
    if (!hdrResult.ok) {
      console.warn("[view/webgpu/render-path-matrix] IBL HDR setup failed:", hdrResult.error);
    } else {
      runtime.iblEnvironmentReady = true;
    }
  }

  view.effects.sao.intensity = 0.35;
  view.effects.sao.kernelRadius = 36;
  view.effects.sao.numSamples = 12;

  view.effects.bloom.threshold = 0.7;
  view.effects.bloom.knee = 0.35;
  view.effects.bloom.intensity = 0.65;

  view.effects.atmosphere.color = [0.72, 0.82, 0.92];
  view.effects.atmosphere.startDistance = 3.0;
  view.effects.atmosphere.endDistance = 8.0;
  view.effects.atmosphere.intensity = 0.5;
  view.effects.atmosphere.maxOpacity = 0.38;
  view.effects.atmosphere.affectSky = false;

  view.effects.depthOfField.focusDistance = 5.4;
  view.effects.depthOfField.focalRange = 1.8;
  view.effects.depthOfField.radius = 5.0;
  view.effects.depthOfField.intensity = 0.62;
  view.effects.depthOfField.nearBlur = 0.15;
  view.effects.depthOfField.farBlur = 1.0;

  view.effects.colorGrading.brightness = 0.03;
  view.effects.colorGrading.contrast = 1.18;
  view.effects.colorGrading.saturation = 1.16;
  view.effects.colorGrading.gamma = 1.04;
  view.effects.colorGrading.temperature = 0.18;
  view.effects.colorGrading.tint = -0.04;

  view.effects.shadows.intensity = 0.55;
  view.effects.shadows.direction = [-0.35, -0.55, -0.76];
  view.effects.shadows.resolution = 1024;
  view.effects.shadows.cascadeCount = 3;
  view.effects.shadows.pcfKernelSize = 3;
  view.effects.shadows.normalOffsetBias = 0.005;
  view.effects.shadows.debug = cfg.shadowDebug === "off" ? false : cfg.shadowDebug;
}

function writePanel(cfg) {
  const lastError = window.renderPathMatrix?.lastError;
  writeCaptureSummary(cfg);
  document.getElementById("summary").innerHTML = `
    <code>#${configToHash(cfg)}</code>
    ${lastError ? `<p class="render-path-error">${escapeHTML(lastError)}</p>` : ""}
    <dl>
      ${selectRow(cfg, "Renderer", "renderer", cfg.renderer, ["webgpu", "webgl", "auto"])}
      ${selectRow(cfg, "Primitive", "primitive", cfg.primitive, Object.keys(PRIMITIVES))}
      ${materialSelectRow(cfg)}
      ${toggleRow(cfg, "Normals", "normals", cfg.normals)}
      ${toggleRow(cfg, "UVs", "uvs", cfg.uvs)}
      ${toggleRow(cfg, "Triplanar", "triplanar", cfg.triplanar)}
      ${toggleRow(cfg, "Color texture", "colorTexture", cfg.colorTexture)}
      ${toggleRow(cfg, "Normal texture", "normalTexture", cfg.normalTexture)}
      ${toggleRow(cfg, "Occlusion texture", "occlusionTexture", cfg.occlusionTexture)}
      ${toggleRow(cfg, "Metal/rough texture", "metallicRoughnessTexture", cfg.metallicRoughnessTexture)}
      ${toggleRow(cfg, "Clear coat", "clearcoat", cfg.clearcoat)}
      ${toggleRow(cfg, "Sheen", "sheen", cfg.sheen)}
      ${toggleRow(cfg, "Ambient light", "ambientLight", cfg.ambientLight)}
      ${toggleRow(cfg, "Directional light", "directionalLight", cfg.directionalLight)}
      ${toggleRow(cfg, "Hemisphere light", "hemisphereLight", cfg.hemisphereLight)}
      ${toggleRow(cfg, "IBL", "ibl", cfg.ibl)}
      ${toggleRow(cfg, "SAO", "sao", cfg.sao)}
      ${toggleRow(cfg, "Bloom", "bloom", cfg.bloom)}
      ${toggleRow(cfg, "Atmosphere", "atmosphere", cfg.atmosphere)}
      ${toggleRow(cfg, "Depth of field", "depthOfField", cfg.depthOfField)}
      ${toggleRow(cfg, "Color grading", "colorGrading", cfg.colorGrading)}
      ${toggleRow(cfg, "Shadows", "shadows", cfg.shadows)}
      ${selectRow(cfg, "Shadow debug", "shadowDebug", cfg.shadowDebug, ["off", "factor", "depth"])}
      ${toggleRow(cfg, "Tonemap", "tonemap", cfg.tonemap)}
      ${toggleRow(cfg, "sRGB encode", "srgb", cfg.srgb)}
      ${toggleRow(cfg, "Antialiasing", "antialiasing", cfg.antialiasing)}
      ${toggleRow(cfg, "Edges", "edges", cfg.edges)}
    </dl>
  `;
}

function writeCaptureSummary(cfg) {
  const summary = document.getElementById("captureSummary");
  if (!summary) {
    return;
  }
  const enabledEffects = [
    "clearcoat",
    "sheen",
    "ambientLight",
    "directionalLight",
    "hemisphereLight",
    "ibl",
    "sao",
    "bloom",
    "atmosphere",
    "depthOfField",
    "colorGrading",
    "shadows",
    "tonemap",
    "srgb",
    "antialiasing",
    "edges"
  ].filter((field) => cfg[field]);
  summary.innerHTML = `
    <div class="capture-title">${escapeHTML(cfg.renderer.toUpperCase())} · ${escapeHTML(labelFor("primitive", cfg.primitive))} · ${escapeHTML(labelFor("material", cfg.material))}</div>
    <div class="capture-effects">${escapeHTML(enabledEffects.length > 0 ? enabledEffects.join(", ") : "no view effects enabled")}</div>
  `;
}

function selectRow(cfg, label, field, value, values) {
  return `
    <dt>${label}</dt>
    <dd class="choice-row">
      ${values.map((nextValue) => `<a class="${nextValue === value ? "is-active" : ""}" href="#${configToHash({...cfg, [field]: nextValue})}" onclick="return applyConfigFromLink(this);">${labelFor(field, nextValue)}</a>`).join("")}
    </dd>
  `;
}

function materialSelectRow(cfg) {
  return `
    <dt>Material</dt>
    <dd class="choice-row">
      <select class="material-select" name="material" aria-label="Material" onchange="return applyConfigFromSelect(this);">
        ${Object.entries(MATERIALS).map(([value, label]) => `<option value="${value}"${value === cfg.material ? " selected" : ""}>${label}</option>`).join("")}
      </select>
    </dd>
  `;
}

function toggleRow(cfg, label, field, value) {
  const next = {...cfg, [field]: !value};
  return `
    <dt>${label}</dt>
    <dd><a class="${value ? "is-active" : ""}" href="#${configToHash(next)}" onclick="return applyConfigFromLink(this);">${value ? "on" : "off"}</a></dd>
  `;
}

function labelFor(field, value) {
  if (field === "primitive") {
    return PRIMITIVES[value].label;
  }
  if (field === "material") {
    return MATERIALS[value];
  }
  return value;
}

function configToHash(cfg) {
  const params = new URLSearchParams();
  params.set("renderer", cfg.renderer);
  params.set("primitive", cfg.primitive);
  params.set("material", cfg.material);
  for (const field of BOOLEAN_FIELDS) {
    params.set(field, cfg[field] ? "1" : "0");
  }
  if (cfg.shadowDebug !== "off") {
    params.set("shadowDebug", cfg.shadowDebug);
  }
  return params.toString();
}

window.applyConfigFromLink = function applyConfigFromLink(link) {
  history.pushState(null, "", link.hash);
  queueApplyConfig(parseConfig()).catch((error) => {
    console.error(error);
  });
  return false;
};

window.applyConfigFromSelect = function applyConfigFromSelect(select) {
  const nextConfig = {...config, [select.name]: select.value};
  history.pushState(null, "", `#${configToHash(nextConfig)}`);
  queueApplyConfig(parseConfig()).catch((error) => {
    console.error(error);
  });
  return false;
};

function escapeHTML(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function makeBrickTileAlbedoTexture(size) {
  return paintTexture(size, (x, y) => {
    const brick = sampleBrickTile(x, y, size);
    if (brick.mortar > 0.0) {
      const mortarVariation = (brick.edgeNoise - 0.5) * 0.035;
      return [0.48 + mortarVariation, 0.46 + mortarVariation, 0.42 + mortarVariation];
    }
    const surfaceVariation = (brick.surfaceNoise - 0.5) * 0.055;
    const bevelHighlight = brick.bevel * 0.025 - (1.0 - brick.bevel) * 0.012;
    return [
      0.53 + surfaceVariation + bevelHighlight,
      0.23 + surfaceVariation * 0.42 + bevelHighlight * 0.42,
      0.14 + surfaceVariation * 0.26 + bevelHighlight * 0.26
    ];
  });
}

function makeMetallicRoughnessTexture(size) {
  return paintTexture(size, (x, y) => {
    const brick = sampleBrickTile(x, y, size);
    const roughness = brick.mortar > 0.0
      ? 0.86 + brick.edgeNoise * 0.06
      : 0.64 + brick.surfaceNoise * 0.08 + (1.0 - brick.bevel) * 0.08;
    return [1.0, roughness, 0.0];
  });
}

function makeNormalTexture(size) {
  return paintTexture(size, (x, y) => {
    const hL = brickTileHeight(x - 1, y, size);
    const hR = brickTileHeight(x + 1, y, size);
    const hD = brickTileHeight(x, y - 1, size);
    const hU = brickTileHeight(x, y + 1, size);
    const strength = 7.0;
    const nx = (hL - hR) * strength;
    const ny = (hD - hU) * strength;
    const nz = 1.0;
    const invLen = 1 / Math.hypot(nx, ny, nz);
    return [
      0.5 + nx * invLen * 0.5,
      0.5 + ny * invLen * 0.5,
      0.5 + nz * invLen * 0.5
    ];
  });
}

function makeOcclusionTexture(size) {
  return paintTexture(size, (x, y) => {
    const brick = sampleBrickTile(x, y, size);
    const v = brick.mortar > 0.0
      ? 0.54 + brick.edgeNoise * 0.08
      : 0.90 - (1.0 - brick.bevel) * 0.12 - brick.surfaceNoise * 0.04;
    return [v, v, v];
  });
}

function makeRustAlbedoTexture(size) {
  return paintTexture(size, (x, y) => {
    const surface = sampleRustSurface(x, y);
    const chrome = [0.25 + surface.edgeNoise * 0.08, 0.29 + surface.edgeNoise * 0.09, 0.33 + surface.edgeNoise * 0.10];
    const paint = [0.34 + surface.rustNoise * 0.10, 0.055 + surface.rustNoise * 0.035, 0.018];
    const color = mixColor(chrome, paint, surface.crust);
    const highlight = (1.0 - surface.crust) * surface.edgeNoise * 0.055 - surface.chip * 0.018;
    return [color[0] + highlight, color[1] + highlight, color[2] + highlight];
  });
}

function makeRustMetallicRoughnessTexture(size) {
  return paintTexture(size, (x, y) => {
    const surface = sampleRustSurface(x, y);
    const roughness = 0.16 + surface.crust * 0.68 + surface.pitting * 0.08 + surface.chip * 0.04;
    const metallic = 0.96 - surface.crust * 0.90;
    return [1.0, roughness, metallic];
  });
}

function makeRustNormalTexture(size) {
  return paintTexture(size, (x, y) => {
    const hL = rustSurfaceHeight(x - 1, y);
    const hR = rustSurfaceHeight(x + 1, y);
    const hD = rustSurfaceHeight(x, y - 1);
    const hU = rustSurfaceHeight(x, y + 1);
    const strength = 6.0;
    const nx = (hL - hR) * strength;
    const ny = (hD - hU) * strength;
    const invLen = 1 / Math.hypot(nx, ny, 1.0);
    return [
      0.5 + nx * invLen * 0.5,
      0.5 + ny * invLen * 0.5,
      0.5 + invLen * 0.5
    ];
  });
}

function makeRustOcclusionTexture(size) {
  return paintTexture(size, (x, y) => {
    const surface = sampleRustSurface(x, y);
    const value = 0.94 - surface.crust * 0.22 - surface.pitting * 0.12;
    return [value, value, value];
  });
}

function sampleRustSurface(x, y) {
  const broadOxide = valueNoise(x * 0.026 + 41.0, y * 0.026 - 13.0);
  const patchOxide = valueNoise(x * 0.075 - 17.0, y * 0.075 + 29.0);
  const rustNoise = valueNoise(x * 0.18 + 7.0, y * 0.18 + 53.0);
  const pitting = valueNoise(x * 0.32 - 31.0, y * 0.32 + 11.0);
  const coating = smoothRange(0.44, 0.70, broadOxide * 0.68 + patchOxide * 0.32);
  const chip = smoothRange(0.58, 0.82, valueNoise(x * 0.12 + 73.0, y * 0.12 - 37.0));
  const crust = coating * (1.0 - chip * 0.92);
  const edgeNoise = valueNoise(x * 0.12 + 61.0, y * 0.12 - 47.0);
  return {coating, crust, chip, rustNoise, pitting, edgeNoise};
}

function rustSurfaceHeight(x, y) {
  const surface = sampleRustSurface(x, y);
  return surface.crust * (0.42 + surface.rustNoise * 0.18) - surface.chip * surface.coating * 0.06 + surface.pitting * surface.crust * 0.08;
}

function smoothRange(min, max, value) {
  return smooth01(clamp01((value - min) / (max - min)));
}

function makeGripPlateAlbedoTexture(size) {
  return paintTexture(size, (x, y) => {
    const plate = sampleGripPlate(x, y);
    const base = [0.30, 0.34, 0.36];
    const raised = [0.52, 0.57, 0.60];
    const color = mixColor(base, raised, plate.plateau);
    const bevelHighlight = plate.bevel * 0.045;
    return [color[0] + bevelHighlight, color[1] + bevelHighlight, color[2] + bevelHighlight];
  });
}

function makeGripPlateMetallicRoughnessTexture(size) {
  return paintTexture(size, (x, y) => {
    const plate = sampleGripPlate(x, y);
    const roughness = 0.42 - plate.plateau * 0.24 + (1.0 - plate.bevel) * 0.025;
    const metallic = 0.88 + plate.plateau * 0.11;
    return [1.0, roughness, metallic];
  });
}

function makeGripPlateNormalTexture(size) {
  return paintTexture(size, (x, y) => {
    const hL = gripPlateHeight(x - 1, y);
    const hR = gripPlateHeight(x + 1, y);
    const hD = gripPlateHeight(x, y - 1);
    const hU = gripPlateHeight(x, y + 1);
    const strength = 5.5;
    const nx = (hL - hR) * strength;
    const ny = (hD - hU) * strength;
    const invLen = 1 / Math.hypot(nx, ny, 1.0);
    return [0.5 + nx * invLen * 0.5, 0.5 + ny * invLen * 0.5, 0.5 + invLen * 0.5];
  });
}

function makeGripPlateOcclusionTexture(size) {
  return paintTexture(size, (x, y) => {
    const plate = sampleGripPlate(x, y);
    const value = 0.78 + plate.plateau * 0.16 + plate.bevel * 0.04;
    return [value, value, value];
  });
}

function sampleGripPlate(x, y) {
  const period = 64.0;
  const u = positiveMod(x / period, 1.0);
  const v = positiveMod(y / period, 1.0);
  const du = Math.abs(u - 0.5);
  const dv = Math.abs(v - 0.5);
  const diamondDistance = Math.max(du, dv);
  const plateau = 1.0 - smoothRange(0.34, 0.43, diamondDistance);
  const bevel = smoothRange(0.31, 0.38, diamondDistance) * (1.0 - smoothRange(0.35, 0.43, diamondDistance));
  return {plateau, bevel};
}

function gripPlateHeight(x, y) {
  const plate = sampleGripPlate(x, y);
  return plate.plateau * 0.20 + plate.bevel * 0.012;
}

function sampleBrickTile(x, y, size) {
  const brickWidth = Math.max(32, size / 4);
  const brickHeight = Math.max(16, size / 8);
  const mortarWidth = 2.4;
  const row = Math.floor(y / brickHeight);
  const offsetX = row % 2 === 0 ? 0 : brickWidth * 0.5;
  const bx = positiveMod(x + offsetX, brickWidth);
  const by = positiveMod(y, brickHeight);
  const cx = bx - brickWidth * 0.5;
  const cy = by - brickHeight * 0.5;
  const halfWidth = brickWidth * 0.5 - mortarWidth;
  const halfHeight = brickHeight * 0.5 - mortarWidth;
  const radius = Math.max(1.0, halfHeight * 0.55);
  const qx = Math.abs(cx) - halfWidth + radius;
  const qy = Math.abs(cy) - halfHeight + radius;
  const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0));
  const inside = Math.min(Math.max(qx, qy), 0);
  const signedDistance = outside + inside - radius;
  const edgeNoise = valueNoise(x * 0.22 + 19.0, y * 0.22 - 7.0);
  const roughSignedDistance = signedDistance + (edgeNoise - 0.5) * 1.4;
  const bevelWidth = Math.max(1.0, mortarWidth * 1.8);
  const mortar = roughSignedDistance > 0.0 ? 1.0 : 0.0;
  const bevel = clamp01(-roughSignedDistance / bevelWidth);
  const surfaceNoise = valueNoise(x * 0.11, y * 0.11) * 0.72 + valueNoise(x * 0.31, y * 0.31) * 0.28;
  return {mortar, bevel, surfaceNoise, edgeNoise};
}

function brickTileHeight(x, y, size) {
  const brick = sampleBrickTile(x, y, size);
  if (brick.mortar > 0.0) {
    return 0.16;
  }
  return 0.54 + brick.bevel * 0.12 + brick.surfaceNoise * 0.035;
}

function valueNoise(x, y) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const tx = smooth01(x - x0);
  const ty = smooth01(y - y0);
  const a = noiseHash(x0, y0);
  const b = noiseHash(x0 + 1, y0);
  const c = noiseHash(x0, y0 + 1);
  const d = noiseHash(x0 + 1, y0 + 1);
  const ab = a + (b - a) * tx;
  const cd = c + (d - c) * tx;
  return ab + (cd - ab) * ty;
}

function warpedNoise(x, y, frequency, seed) {
  const warpX = (valueNoise(x * frequency * 0.42 + seed, y * frequency * 0.42 - seed) - 0.5) * 7.0;
  const warpY = (valueNoise(x * frequency * 0.42 - seed, y * frequency * 0.42 + seed) - 0.5) * 7.0;
  const broad = valueNoise(x * frequency + warpX + seed, y * frequency + warpY - seed);
  const detail = valueNoise(x * frequency * 2.7 - warpY, y * frequency * 2.7 + warpX);
  const micro = valueNoise(x * frequency * 7.0 + seed * 0.3, y * frequency * 7.0 - seed * 0.3);
  return broad * 0.58 + detail * 0.29 + micro * 0.13;
}

function noiseHash(x, y) {
  const value = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return value - Math.floor(value);
}

function smooth01(value) {
  return value * value * (3.0 - 2.0 * value);
}

function mixColor(a, b, t) {
  const u = clamp01(t);
  return [
    a[0] + (b[0] - a[0]) * u,
    a[1] + (b[1] - a[1]) * u,
    a[2] + (b[2] - a[2]) * u
  ];
}

function positiveMod(value, divisor) {
  return ((value % divisor) + divisor) % divisor;
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function paintTexture(size, sample) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  const image = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const [r, g, b] = sample(x, y);
      const offset = (y * size + x) * 4;
      image.data[offset] = toByte(r);
      image.data[offset + 1] = toByte(g);
      image.data[offset + 2] = toByte(b);
      image.data[offset + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}

function toByte(value) {
  return Math.max(0, Math.min(255, Math.round(value * 255)));
}

function normalize3(v) {
  const len = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / len, v[1] / len, v[2] / len];
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

function signalLoaded() {
  document.body.classList.add("xeokit-loading-spinner-ready");
  if (document.getElementById("ExampleLoaded")) {
    return;
  }
  const div = document.createElement("div");
  div.id = "ExampleLoaded";
  div.hidden = true;
  document.body.appendChild(div);
}

function resetLoadedSignal() {
  runtime.renderGeneration++;
  if (runtime.renderUnsubscribe) {
    runtime.renderUnsubscribe();
    runtime.renderUnsubscribe = null;
  }
  const div = document.getElementById("ExampleLoaded");
  if (div) {
    div.remove();
  }
  document.body.classList.remove("xeokit-loading-spinner-ready");
  const state = window.renderPathMatrix;
  if (state) {
    state.ready = false;
    state.captureArmed = false;
    state.renderedFramesAfterSetup = 0;
    state.renderGeneration = runtime.renderGeneration;
  }
}

function signalLoadedAfterConfiguredRender() {
  const state = window.renderPathMatrix;
  const renderer = runtime.renderer;
  const view = runtime.view;
  const generation = runtime.renderGeneration;
  state.renderGeneration = generation;
  const events = renderer.events;
  if (!events?.onViewRendered?.subscribe) {
    requestAnimationFrame(() => {
      if (generation !== runtime.renderGeneration) {
        return;
      }
      state.captureArmed = true;
      view.needsRender();
      requestAnimationFrame(() => requestAnimationFrame(() => {
        if (generation !== runtime.renderGeneration) {
          return;
        }
        state.ready = true;
        signalLoaded();
      }));
    });
    return;
  }
  let unsubscribe = null;
  let fallbackTimer = null;
  const finish = () => {
    if (generation !== runtime.renderGeneration || state.ready) {
      state.lastReadySkip = {
        generation,
        currentGeneration: runtime.renderGeneration,
        ready: state.ready
      };
      return;
    }
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
      runtime.renderUnsubscribe = null;
    }
    if (fallbackTimer !== null) {
      clearTimeout(fallbackTimer);
      fallbackTimer = null;
    }
    state.ready = true;
    requestAnimationFrame(signalLoaded);
  };
  unsubscribe = events.onViewRendered.subscribe((_renderer, renderedView) => {
    if (generation !== runtime.renderGeneration) {
      return;
    }
    if (renderedView !== view) {
      return;
    }
    if (!state.captureArmed) {
      return;
    }
    state.renderedFramesAfterSetup++;
    finish();
  });
  runtime.renderUnsubscribe = unsubscribe;
  requestAnimationFrame(() => {
    if (generation !== runtime.renderGeneration) {
      return;
    }
    state.captureArmed = true;
    view.needsRender();
    fallbackTimer = setTimeout(finish, 750);
  });
}
