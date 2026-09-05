import * as xeokit from "../../../js/xeokit-studio-bundle.js";

const MODEL_ID = "CityInfrastructureBaseMap";
const XGF_URL = "../../../models/CityInfrastructureBaseMap/xgf/model.xgf";
const HIGH_RISE_MODEL_ID = "ResidentialBuilding";
const HIGH_RISE_XGF_URL = "../../../models/ResidentialBuilding/xgf/model.xgf";
const HIGH_RISE_PLACEMENTS = [
  {
    id: HIGH_RISE_MODEL_ID,
    origin: [-3972.88, 48.39, 20430.4]
  },
  {
    id: `${HIGH_RISE_MODEL_ID}West`,
    origin: [-14255.74, 48.39, 21430.42]
  },
  {
    id: `${HIGH_RISE_MODEL_ID}Southeast`,
    origin: [-541.45, 48.39, 8573.28]
  }
];
const HIGH_RISE_SCALE_TO_METERS = 0.035;
const MINIMAP_BOUNDS = [
  -683.9942626953125,
  -4.119262096396028,
  -4.146648487351458,
  2.0001220703125,
  1158.3104254361765,
  15.65667762025502
];
const MINIMAP_CONTENT_RECT = {
  x: 78 / 1236,
  y: 23 / 768,
  width: (1011 - 78) / 1236,
  height: (745 - 23) / 768
};
const OLLIE_SOUND_URL = "./sounds/skateboard-ollie.wav";
const ROLLING_SOUND_URL = "./sounds/skateboard-rolling.mp3";
const STREET_LAMP_MATERIAL_IDS = new Set([
  "material-2c196e6f-4191-43ea-a786-00b14b5f21fd-14"
]);
const URL_PARAMS = new URLSearchParams(window.location.search);
const REQUESTED_RENDERER = normalizeRenderer(URL_PARAMS.get("renderer") || URL_PARAMS.get("backend") || "webgl");
const REQUESTED_NAVIGATION = normalizeNavigation(URL_PARAMS.get("nav") || URL_PARAMS.get("navigation") || "vehicle");
const VEHICLE_CAMERA_HEIGHT = 1.62;
const SKATEBOARD_PHYSICS = {
  pushImpulse: 2.15,
  pushCooldownMs: 360,
  pushDeliverySeconds: 0.34,
  pushLaunchImpulse: 1.55,
  pushLaunchSeconds: 0.18,
  maxSpeed: 32,
  brakeDeceleration: 18,
  gravityAcceleration: 14.5,
  downhillAccelerationScale: 1.85,
  downhillRollingDecelerationScale: 0.18,
  downhillAirDragScale: 0.24,
  rollingDeceleration: 0.32,
  airDrag: 0.0065,
  stopSpeed: 0.025,
  restartResetSpeed: 1.25,
  slopeGravityMinSpeed: 0.35,
  rollbackStartSpeed: 0.42,
  rollbackMinSlope: 0.035,
  rollbackDelayMs: 420,
  rollbackAccelerationScale: 1.15,
  rollbackTurnRate: 2.1,
  crestJumpMinSpeed: 8.5,
  crestJumpUphillSlope: 0.08,
  crestJumpFlatSlope: 0.025,
  crestJumpSlopeDrop: 0.07,
  dropInJumpFlatSlope: 0.03,
  dropInJumpDeclineSlope: -0.07,
  dropInJumpSlopeDrop: 0.075,
  crestJumpCooldownMs: 1500,
  crestJumpSpeedBoost: 1.5,
  crestJumpTakeoffHeight: 1.15,
  crestJumpTakeoffSpeed: 5.2,
  ollieCooldownMs: 680,
  ollieSpeedBoost: 3.5,
  ollieTakeoffHeight: 44,
  ollieTakeoffSpeed: 22,
  flexSpring: 38,
  flexDamping: 12,
  flexMaxOffset: 0.16,
  flexSpeedCompression: 0.055,
  flexAccelerationCompression: 0.055,
  flexDownhillCompression: 0.045,
  flexPushCompression: 0.075,
  flexPushDurationMs: 320,
  flexBobAmplitude: 0.018,
  flexBobFrequency: 1.55,
  flexCarveCompression: 0.14,
  flexCarveResponse: 11,
  flexCarveReleaseKick: 0.24,
  flexCarveLowSpeedBias: 0.34,
  slideMinSpeed: 2.5,
  slideBreakTurnRate: 0.62,
  slideDetachResponse: 2.4,
  slideRegripRate: 1.15,
  slideMomentumAlignRate: 0.48,
  slideMomentumDump: 0.2,
  slideMinNoseDrive: 0.72,
  slideDriftScale: 0.48,
  slideMaxSideStep: 0.42,
  kerbProbeDistance: 0.85,
  kerbImpactMinHeight: 0.08,
  kerbImpactMaxHeight: 0.42,
  kerbImpactMinSpeed: 1.8,
  kerbImpactCooldownMs: 280,
  kerbImpactRampSlopeLimit: 0.1,
  kerbImpactSpeedLoss: 0.18,
  kerbImpactFlexImpulse: 1.25,
  kerbJumpTakeoffHeight: 1.25,
  kerbJumpTakeoffSpeed: 3.6,
  surfaceProbeHeight: 7,
  surfaceProbeDepth: 14
};
const COORDINATE_SYSTEM = {
  basis: [1, 0, 0, 0, 1, 0, 0, 0, 1],
  origin: [0, 0, 0],
  units: "meters",
  scaleToMeters: 1
};

const canvas = document.getElementById("demoCanvas");
const status = document.getElementById("status");
const progressPanel = document.getElementById("progressPanel");
const progressLabel = document.getElementById("progressLabel");
const progressBar = document.getElementById("progressBar");
const fpsValue = document.getElementById("fpsValue");
const frameMsValue = document.getElementById("frameMsValue");
const rafValue = document.getElementById("rafValue");
const rendererBadge = document.getElementById("rendererBadge");
const minimapCanvas = document.getElementById("minimap");
const buildingsToggle = document.getElementById("buildingsToggle");
const shadowsToggle = document.getElementById("shadowsToggle");
const saoToggle = document.getElementById("saoToggle");
const streetLampsToggle = document.getElementById("streetLamps");
const skateboardSoundToggle = document.getElementById("skateboardSound");

main().catch((error) => {
  reportError(error instanceof Error ? error.message : String(error));
});

async function main() {
  const {Scene} = xeokit.model.scene;
  const {AmbientLight, DirLight, Viewer} = xeokit.viewing.viewer;
  const WebGLRenderer = xeokit.viewing.renderers.webGL?.WebGLRenderer;
  const WebGPURenderer = xeokit.viewing.renderers.webGPU?.WebGPURenderer;
  const {ModelNavigationController} = xeokit.viewing.navigation.model;
  const {VehicleNavigationController} = xeokit.viewing.navigation.vehicle;
  const {BVHPickStrategy} = xeokit.spatial.picking;
  const {SceneRaycaster} = xeokit.spatial.collision;
  const {XGFLoader} = xeokit.formats.xgf;

  rendererBadge.textContent = REQUESTED_RENDERER.label;
  rendererBadge.dataset.renderer = REQUESTED_RENDERER.id;
  updateStatus(`Initializing ${REQUESTED_RENDERER.label} renderer...`);
  resizeCanvasToDisplaySize(canvas);

  const scene = new Scene({logging: false});
  const viewer = new Viewer({scene, logging: false});
  const view = mustOk(viewer.createView({
    id: "citySkateSimView",
    htmlElement: canvas,
    backgroundColor: [0.985, 0.99, 1.0],
    camera: {
      projection: "perspective",
      far: 1000000,
      eye: [80, -120, 70],
      look: [0, 0, 0],
      up: [0, 0, 1]
    },
    resolutionScale: {
      enabled: true,
      resolutionScale: 0.75
    },
    effects: {
      sao: {enabled: false, intensity: 0.08, scale: 0.7},
      edges: {enabled: false},
      bloom: {
        enabled: false,
        threshold: 2.8,
        knee: 0.45,
        intensity: 0.18
      },
      atmosphere: {
        enabled: true,
        color: [0.78, 0.86, 0.96],
        intensity: 0.46,
        maxOpacity: 0.52
      },
      depthOfField: {
        enabled: false,
        focusDistance: 55,
        focalRange: 28,
        radius: 4.5,
        intensity: 0.62,
        nearBlur: 0,
        farBlur: 0.92
      },
      tonemap: {enabled: false},
      antiAliasing: {enabled: true},
      shadows: {
        enabled: false,
        intensity: 0.72,
        bias: 0.001,
        normalOffsetBias: 0.01,
        slopeBias: 0.0008,
        resolution: 2048,
        direction: [-0.58, -0.38, -0.34],
        autoFit: true,
        projectionSize: 180,
        lightDistance: 420,
        maxDistance: 320,
        padding: 1.25,
        pcfKernelSize: 1,
        cascadeCount: 4,
        cascadeSplitLambda: 0.55
      },
      sky: {
        enabled: true,
        skyColor: [0.62, 0.76, 0.96],
        horizonColor: [0.84, 0.89, 0.94],
        groundColor: [0.7, 0.74, 0.68],
        sunGlowIntensity: 0.42
      },
      sectionPlaneCaps: {enabled: false},
      bodyHatch: {enabled: false}
    },
    lights: {
      ibl: {enabled: false},
      hemispheric: {
        enabled: true,
        intensity: 0.18
      }
    },
    texturing: {
      enabled: true
    }
  }));
  configureSunAndShadows(view, AmbientLight, DirLight);
  const renderer = await createRenderer({
    viewer,
    WebGLRenderer,
    WebGPURenderer,
    requestedRenderer: REQUESTED_RENDERER
  });
  const fpsMeter = startFpsMeter(view, renderer);
  const raycaster = new SceneRaycaster(scene);
  const picker = new BVHPickStrategy(scene, raycaster);
  const inputController = new ModelNavigationController(view, {
    active: REQUESTED_NAVIGATION.id !== "vehicle",
    pick: createModelNavigationPickAdapter(picker),
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
  let vehicleController = null;
  let skateboardMomentum = null;
  let highRiseSceneModels = [];
  window.addEventListener("resize", () => {
    resizeCanvasToDisplaySize(canvas);
    view.needsRender?.();
  });

  showProgress("Fetching XGF", 0, 0);
  const sceneModel = mustOk(scene.createModel({
    id: MODEL_ID,
    coordinateSystem: COORDINATE_SYSTEM,
    updateHint: "static",
    memoryPolicy: "compact"
  }));

  try {
    updateStatus(`Fetching ${MODEL_ID}...`);
    const response = await fetch(XGF_URL);
    if (!response.ok) {
      throw new Error(`Failed to fetch ${XGF_URL}: HTTP ${response.status}`);
    }
    const fileData = await response.arrayBuffer();
    updateStatus(`Loading ${MODEL_ID}...`);
    showProgress("Loading XGF", 0, 0);
    await paintProgress();
    const result = await new xeokit.formats.xgf.XGFLoader().load({
      fileData,
      sceneModel
    }, {
      ignoreNormals: false,
      onProgress: (progress) => updateLoadProgress(progress),
      yieldIntervalMs: 32
    });
    if (result && result.ok === false) {
      throw new Error(result.error);
    }
    configureDriveSurfaceShadowCasting(sceneModel, view);
    mustOk(sceneModel.seal());
    highRiseSceneModels = await loadHighRiseModels(scene, view);
  } catch (error) {
    sceneModel.destroy();
    throw error;
  }

  showProgress("Fitting camera", 0, 0);
  await paintProgress();
  await fitLoadedModelToView(view, raycaster.collisionIndex);
  if (REQUESTED_NAVIGATION.id === "vehicle") {
    startOnRoad(view, raycaster, sceneModel);
    vehicleController = new VehicleNavigationController(view, {
      active: true,
      raycaster,
      suspendModelNavigationController: inputController,
      cameraHeight: VEHICLE_CAMERA_HEIGHT,
      bodyRadius: 0.45,
      maxForwardSpeed: SKATEBOARD_PHYSICS.maxSpeed,
      maxReverseSpeed: 4,
      acceleration: 0,
      brakeDeceleration: 18,
      coastDeceleration: 0,
      turnRateDegreesPerSecond: 86,
      keySteerInitialScale: 0.12,
      keySteerRampSeconds: 0.72,
      mouseDragYawSensitivity: 0.0017,
      mouseDragPitchSensitivity: 0.0010,
      leanDegrees: 36,
      leanSmoothing: 13,
      slopePitchFactor: 0.82,
      slopePitchSmoothing: 4.2,
      maxSlopePitchDegrees: 18,
      stepHeight: 0.65,
      maxFall: 2.0,
      maxSlopeDegrees: 62,
      flightTakeoffHeight: SKATEBOARD_PHYSICS.crestJumpTakeoffHeight,
      flightTakeoffSpeed: SKATEBOARD_PHYSICS.crestJumpTakeoffSpeed,
      flightGravity: 8.6,
      flightAirDrag: 0.18,
      flightMinGlideSpeed: 0,
      flightSoftLandingRange: 0.35,
      keyboardPitchInFlight: false,
      collision: true,
      gravity: true,
      keyboardEnabledOnlyOnMouseover: false,
      driveSurfaceFilter: isSkateboardDriveSurfaceObjectId,
      obstacleFilter: (objectId) => !isSkateboardDriveSurfaceObjectId(objectId)
    });
    skateboardMomentum = setupSkateboardMomentum({
      view,
      raycaster,
      vehicleController,
      driveSurfaceFilter: isSkateboardDriveSurfaceObjectId
    });
  }
  const skateboardSound = setupSkateboardSound(
    view,
    REQUESTED_NAVIGATION.id === "vehicle",
    () => vehicleController?.speed || 0,
    () => skateboardMomentum?.state || null
  );
  const streetLamps = setupStreetLampsToggle(sceneModel, view);
  const buildings = setupBuildingsToggle(highRiseSceneModels, view);
  const renderEffects = setupRenderEffectToggles(view);
  const minimap = setupMinimap(view, raycaster.collisionIndex, sceneModel);
  skateboardMomentum?.setSound(skateboardSound);
  const counts = {
    objects: Object.keys(sceneModel.objects).length,
    meshes: Object.keys(sceneModel.meshes).length,
    geometries: Object.keys(sceneModel.geometries).length
  };
  hideProgress();
  status.dataset.state = "ok";
  status.textContent = `${MODEL_ID} loaded with ${REQUESTED_RENDERER.label}: ${counts.objects} objects, ${counts.meshes} meshes, ${counts.geometries} geometries. ${REQUESTED_NAVIGATION.label} uses BVH picking.`;
  view.needsRender?.();
  markLoaded();

  window.citySkateSimExample = {
    scene,
    viewer,
    view,
    renderer,
    raycaster,
    picker,
    inputController,
    vehicleController,
    skateboardMomentum,
    sceneModel,
    fpsMeter,
    skateboardSound,
    buildings,
    renderEffects,
    streetLamps,
    minimap
  };
}

async function createRenderer({viewer, WebGLRenderer, WebGPURenderer, requestedRenderer}) {
  if (requestedRenderer.id === "webgpu") {
    if (!WebGPURenderer?.create) {
      throw new Error("WebGPU renderer is not available in this bundle.");
    }
    const result = await WebGPURenderer.create({
      viewer,
      logging: false
    });
    if (!result.ok) {
      throw new Error(result.error);
    }
    return result.value;
  }
  return new WebGLRenderer({
    viewer,
    logging: false
  });
}

function createModelNavigationPickAdapter(picker) {
  return (_view, pickParams) => adaptPickResult(_view, picker.pick({
    view: _view,
    ...pickParams
  }));
}

function configureSunAndShadows(view, AmbientLight, DirLight) {
  view.lights.hemispheric.enabled = true;
  view.lights.hemispheric.intensity = 0.16;
  view.lights.ibl.enabled = false;
  view.clearLights();
  new AmbientLight(view, {
    color: [1, 1, 1],
    intensity: 0.11
  });
  new DirLight(view, {
    dir: view.effects.shadows.direction,
    color: [1.0, 0.96, 0.88],
    intensity: 2.35,
    space: "world"
  });
  view.needsRender?.();
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

async function fitLoadedModelToView(view, collisionIndex) {
  const aabb = collisionIndex.getSceneAABB();
  if (aabb) {
    fitViewToAABB(view, aabb);
  }
  await waitForAnimationFrame();
}

function fitViewToAABB(view, aabb) {
  const center = [
    (aabb[0] + aabb[3]) * 0.5,
    (aabb[1] + aabb[4]) * 0.5,
    (aabb[2] + aabb[5]) * 0.5
  ];
  const size = [
    Math.max(0.001, aabb[3] - aabb[0]),
    Math.max(0.001, aabb[4] - aabb[1]),
    Math.max(0.001, aabb[5] - aabb[2])
  ];
  const radius = Math.max(size[0], size[1], size[2]) * 0.55;
  const distance = Math.max(radius * 2.4, 8);
  view.camera.look = center;
  view.camera.eye = [
    center[0] + distance * 0.8,
    center[1] - distance * 1.15,
    center[2] + distance * 0.72
  ];
  view.camera.up = [0, 0, 1];
  view.needsRender?.();
}

function startOnRoad(view, raycaster, sceneModel) {
  const roadAABB = getDriveSurfaceAABB(raycaster.collisionIndex, sceneModel);
  const sceneAABB = raycaster.collisionIndex.getSceneAABB();
  const baseAABB = roadAABB || sceneAABB;
  if (!baseAABB) {
    return;
  }
  const center = [
    (baseAABB[0] + baseAABB[3]) * 0.5,
    (baseAABB[1] + baseAABB[4]) * 0.5,
    (baseAABB[2] + baseAABB[5]) * 0.5
  ];
  const probeHeight = Math.max((sceneAABB?.[5] ?? baseAABB[5]) + 30, baseAABB[5] + 8);
  const hits = [];
  const candidates = createRoadStartCandidates(baseAABB);
  for (const candidate of candidates) {
    const hit = raycaster.pick({
      ray: {
        origin: [candidate[0], candidate[1], probeHeight],
        dir: [0, 0, -1]
      },
      filter: isDriveSurfaceObjectId,
      pickSurfaceNormal: true,
      visiblePickableOnly: false
    });
    if (hit.ok && hit.value?.hit && hit.value.worldPos) {
      hits.push(hit.value.worldPos);
    }
  }
  hits.sort((a, b) => b[2] - a[2]);
  let ground = hits[0] || null;
  if (!ground) {
    ground = [center[0], center[1], baseAABB[5]];
  }

  const heading = chooseRoadHeading(baseAABB, hits);
  const eye = [
    ground[0],
    ground[1],
    ground[2] + VEHICLE_CAMERA_HEIGHT
  ];
  view.camera.eye = eye;
  view.camera.look = [
    eye[0] + heading[0] * 8,
    eye[1] + heading[1] * 8,
    eye[2] + 0.2
  ];
  view.camera.up = [0, 0, 1];
  view.needsRender?.();
}

function createRoadStartCandidates(aabb) {
  const candidates = [];
  const gridSize = 13;
  for (let ix = 0; ix < gridSize; ix++) {
    for (let iy = 0; iy < gridSize; iy++) {
      candidates.push([
        aabb[0] + (aabb[3] - aabb[0]) * (ix + 0.5) / gridSize,
        aabb[1] + (aabb[4] - aabb[1]) * (iy + 0.5) / gridSize,
        (aabb[2] + aabb[5]) * 0.5
      ]);
    }
  }
  return candidates;
}

async function loadHighRiseModels(scene, view) {
  const response = await fetch(HIGH_RISE_XGF_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${HIGH_RISE_XGF_URL}: HTTP ${response.status}`);
  }
  const fileData = await response.arrayBuffer();
  const sceneModels = [];
  try {
    for (const placement of HIGH_RISE_PLACEMENTS) {
      sceneModels.push(await loadHighRiseModel(scene, view, placement, fileData));
    }
    return sceneModels;
  } catch (error) {
    for (const sceneModel of sceneModels) {
      sceneModel.destroy();
    }
    throw error;
  }
}

async function loadHighRiseModel(scene, view, placement, fileData) {
  const sceneModel = mustOk(scene.createModel({
    id: placement.id,
    coordinateSystem: {
      basis: [1, 0, 0, 0, 1, 0, 0, 0, 1],
      origin: placement.origin,
      units: "meters",
      scaleToMeters: HIGH_RISE_SCALE_TO_METERS
    },
    globalizedIds: true,
    updateHint: "static",
    memoryPolicy: "compact"
  }));
  try {
    const result = await new xeokit.formats.xgf.XGFLoader().load({
      fileData: fileData.slice(0),
      sceneModel
    }, {
      ignoreNormals: false,
      yieldIntervalMs: 32
    });
    if (result && result.ok === false) {
      throw new Error(result.error);
    }
    mustOk(sceneModel.seal());
    configureHighRiseRenderCost(sceneModel, view);
    return sceneModel;
  } catch (error) {
    sceneModel.destroy();
    throw error;
  }
}

function configureHighRiseRenderCost(sceneModel, view) {
  const objectIds = Object.keys(sceneModel.objects || {});
  view.setObjectsPickable?.(objectIds, true);
  view.setObjectsCollidable?.(objectIds, true);
  for (const objectId of objectIds) {
    const sceneObject = sceneModel.objects[objectId];
    sceneObject.castsShadow = false;
    sceneObject.collidable = true;
    const viewObject = view.objects?.[objectId];
    if (viewObject) {
      viewObject.castsShadow = false;
      viewObject.pickable = true;
      viewObject.collidable = true;
    }
  }
}

function setupBuildingsToggle(sceneModels, view) {
  if (!buildingsToggle || !sceneModels.length) {
    return null;
  }
  const objectIds = sceneModels.flatMap((sceneModel) => Object.keys(sceneModel.objects || {}));
  const setVisible = (nextVisible) => {
    buildingsToggle.checked = nextVisible;
    view.setObjectsVisible?.(objectIds, nextVisible);
    view.setObjectsCollidable?.(objectIds, nextVisible);
    view.needsRender?.();
  };
  buildingsToggle.disabled = false;
  buildingsToggle.addEventListener("change", () => {
    setVisible(buildingsToggle.checked);
  });
  setVisible(true);
  return {
    objectIds,
    setVisible
  };
}

function setupRenderEffectToggles(view) {
  const shadows = setupEffectToggle(shadowsToggle, view, view.effects?.shadows, false);
  const sao = setupEffectToggle(saoToggle, view, view.effects?.sao, false);
  return {
    shadows,
    sao
  };
}

function setupEffectToggle(toggle, view, effect, fallbackEnabled) {
  if (!toggle || !effect) {
    if (toggle) {
      toggle.disabled = true;
    }
    return null;
  }
  const setEnabled = (enabled) => {
    toggle.checked = enabled;
    effect.enabled = enabled;
    view.needsRender?.();
  };
  toggle.disabled = false;
  toggle.addEventListener("change", () => {
    setEnabled(toggle.checked);
    toggle.blur();
  });
  setEnabled(Boolean(effect.enabled ?? fallbackEnabled));
  return {
    setEnabled
  };
}

function getDriveSurfaceAABB(collisionIndex, sceneModel) {
  const ids = Object.keys(sceneModel.objects || {}).filter(isRoadSurfaceObjectId);
  return ids.length > 0 ? collisionIndex.getCombinedObjectAABB(ids) : null;
}

function isDriveSurfaceObjectId(objectId) {
  return isRoadSurfaceObjectId(objectId) || isGrassSurfaceObjectId(objectId);
}

function isSkateboardDriveSurfaceObjectId(objectId) {
  return isDriveSurfaceObjectId(objectId) || isHighRiseObjectId(objectId);
}

function isHighRiseObjectId(objectId) {
  const id = String(objectId || "");
  return HIGH_RISE_PLACEMENTS.some((placement) => id.startsWith(`${placement.id}.`) || id.startsWith(`${placement.id}#`));
}

function configureDriveSurfaceShadowCasting(sceneModel, view) {
  const sceneObjects = sceneModel.objects || {};
  for (const objectId of Object.keys(sceneObjects)) {
    if (!isDriveSurfaceObjectId(objectId)) {
      continue;
    }
    const sceneObject = sceneObjects[objectId];
    sceneObject.castsShadow = false;
    const viewObject = view.objects?.[objectId];
    if (viewObject) {
      viewObject.castsShadow = false;
    }
    for (const mesh of Object.values(sceneObject.meshes || {})) {
      if (mesh) {
        mesh.castsShadow = false;
      }
    }
  }
}

function setupStreetLampsToggle(sceneModel, view) {
  const materials = findStreetLampMaterials(sceneModel);
  const viewObjects = findStreetLampViewObjects(sceneModel, view);
  const originals = new Map(materials.map((material) => [
    material,
    Array.from(material.emissiveColor || [1, 1, 1])
  ]));

  if (!streetLampsToggle || (materials.length === 0 && viewObjects.length === 0)) {
    if (streetLampsToggle) {
      streetLampsToggle.disabled = true;
    }
    return {
      count: 0,
      setEnabled() {}
    };
  }

  const setEnabled = (enabled) => {
    for (const material of materials) {
      material.emissiveColor = enabled ? originals.get(material) : [0, 0, 0];
    }
    for (const viewObject of viewObjects) {
      viewObject.visible = enabled;
    }
    view.needsRender?.();
  };

  streetLampsToggle.checked = false;
  streetLampsToggle.addEventListener("change", () => {
    setEnabled(streetLampsToggle.checked);
    streetLampsToggle.blur();
  });
  setEnabled(false);

  return {
    count: viewObjects.length || materials.length,
    setEnabled
  };
}

function setupMinimap(view, collisionIndex, sceneModel) {
  if (!minimapCanvas) {
    return null;
  }
  const context = minimapCanvas.getContext("2d");
  const sceneAABB = collisionIndex.getSceneAABB();
  if (!context || !sceneAABB) {
    minimapCanvas.hidden = true;
    return null;
  }
  const bounds = MINIMAP_BOUNDS;
  const roadGeometry = buildMinimapRoadGeometry(sceneModel);
  const roadLayer = {
    canvas: null,
    width: 0,
    height: 0
  };
  minimapCanvas.hidden = false;
  let running = true;
  let rafHandle = 0;

  const draw = () => {
    if (!running) {
      return;
    }
    resizeMinimapCanvas(minimapCanvas);
    drawMinimap(context, minimapCanvas, view, bounds, roadGeometry, roadLayer);
    rafHandle = requestAnimationFrame(draw);
  };
  rafHandle = requestAnimationFrame(draw);

  return {
    destroy() {
      running = false;
      cancelAnimationFrame(rafHandle);
    }
  };
}

function drawMinimap(context, canvas, view, bounds, roadGeometry, roadLayer) {
  const width = canvas.width;
  const height = canvas.height;
  const pixelRatio = window.devicePixelRatio || 1;
  const cssWidth = width / pixelRatio;
  const cssHeight = height / pixelRatio;
  const pad = 8 * pixelRatio;
  const mapWidth = width - pad * 2;
  const mapHeight = height - pad * 2;
  const camera = view.camera;
  const skater = worldToMinimap(camera.eye, bounds, pad, mapWidth, mapHeight);
  const heading = horizontalDirection([
    camera.look[0] - camera.eye[0],
    camera.look[1] - camera.eye[1],
    0
  ]) || [1, 0, 0];

  context.clearRect(0, 0, width, height);
  context.save();
  context.scale(pixelRatio, pixelRatio);
  context.fillStyle = "rgba(248, 250, 252, 0.94)";
  context.fillRect(0, 0, cssWidth, cssHeight);
  context.restore();

  context.fillStyle = "#dfe6dc";
  context.fillRect(pad, pad, mapWidth, mapHeight);
  drawMinimapRoadGeometry(context, bounds, pad, mapWidth, mapHeight, roadGeometry, roadLayer);
  context.strokeStyle = "rgba(15, 23, 42, 0.22)";
  context.lineWidth = pixelRatio;
  context.strokeRect(pad + 0.5 * pixelRatio, pad + 0.5 * pixelRatio, mapWidth - pixelRatio, mapHeight - pixelRatio);

  drawMinimapOrientation(context, pad, mapWidth, mapHeight, pixelRatio);
  drawSkaterMarker(context, skater, heading, pixelRatio);
}

function drawMinimapOrientation(context, pad, mapWidth, mapHeight, pixelRatio) {
  context.save();
  context.fillStyle = "rgba(15, 23, 42, 0.72)";
  context.font = `${10 * pixelRatio}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText("N", pad + 10 * pixelRatio, pad + mapHeight * 0.5);
  context.fillText("E", pad + mapWidth * 0.5, pad + 10 * pixelRatio);
  context.restore();
}

function drawSkaterMarker(context, skater, heading, pixelRatio) {
  const x = skater[0];
  const y = skater[1];
  const size = 9 * pixelRatio;
  const dir = [-heading[1], -heading[0]];
  const side = [-dir[1], dir[0]];
  const tip = [x + dir[0] * size * 1.3, y + dir[1] * size * 1.3];
  const left = [x - dir[0] * size * 0.75 + side[0] * size * 0.68, y - dir[1] * size * 0.75 + side[1] * size * 0.68];
  const right = [x - dir[0] * size * 0.75 - side[0] * size * 0.68, y - dir[1] * size * 0.75 - side[1] * size * 0.68];

  context.save();
  context.shadowColor = "rgba(15, 23, 42, 0.45)";
  context.shadowBlur = 6 * pixelRatio;
  context.fillStyle = "#ef4444";
  context.strokeStyle = "#7f1d1d";
  context.lineWidth = 1.4 * pixelRatio;
  context.beginPath();
  context.moveTo(tip[0], tip[1]);
  context.lineTo(left[0], left[1]);
  context.lineTo(right[0], right[1]);
  context.closePath();
  context.fill();
  context.stroke();
  context.restore();

  context.fillStyle = "#ffffff";
  context.beginPath();
  context.arc(x, y, 2.2 * pixelRatio, 0, Math.PI * 2);
  context.fill();
}

function buildMinimapRoadGeometry(sceneModel) {
  const roadGeometry = [];
  const sceneObjects = sceneModel.objects || {};
  for (const objectId of Object.keys(sceneObjects)) {
    if (!isMinimapRoadObjectId(objectId)) {
      continue;
    }
    const sceneObject = sceneObjects[objectId];
    for (const mesh of Object.values(sceneObject.meshes || {})) {
      const geometry = mesh?.geometry;
      if (!geometry?.positionsCompressed || !geometry?.indices || !geometry?.aabb) {
        continue;
      }
      roadGeometry.push({
        positionsCompressed: geometry.positionsCompressed,
        indices: geometry.indices,
        aabb: geometry.aabb,
        worldMatrix: mesh.worldMatrix || null
      });
    }
  }
  return roadGeometry;
}

function isMinimapRoadObjectId(objectId) {
  const id = String(objectId || "").toLowerCase();
  if (id.includes("trafficlights") || id.includes("traffic_lights") || id.includes("railing") || id.includes("support")) {
    return false;
  }
  return id.includes("asphalt") ||
    id.includes("pavement") ||
    id.includes("crossing") ||
    /(^|[_\W])lane([_\W]|$)/.test(id) ||
    id.includes("two_lane") ||
    id.includes("concrete");
}

function drawMinimapRoadGeometry(context, bounds, pad, mapWidth, mapHeight, roadGeometry, roadLayer) {
  if (!roadGeometry.length) {
    return;
  }
  if (!roadLayer.canvas || roadLayer.width !== context.canvas.width || roadLayer.height !== context.canvas.height) {
    roadLayer.canvas = document.createElement("canvas");
    roadLayer.canvas.width = context.canvas.width;
    roadLayer.canvas.height = context.canvas.height;
    roadLayer.width = context.canvas.width;
    roadLayer.height = context.canvas.height;
    const roadContext = roadLayer.canvas.getContext("2d");
    if (roadContext) {
      drawMinimapRoadGeometryLayer(roadContext, bounds, pad, mapWidth, mapHeight, roadGeometry);
    }
  }
  context.drawImage(roadLayer.canvas, 0, 0);
}

function drawMinimapRoadGeometryLayer(context, bounds, pad, mapWidth, mapHeight, roadGeometry) {
  context.clearRect(0, 0, context.canvas.width, context.canvas.height);
  context.fillStyle = "rgba(39, 45, 50, 0.52)";
  context.strokeStyle = "rgba(248, 250, 252, 0.28)";
  context.lineWidth = Math.max(1, Math.round((window.devicePixelRatio || 1) * 0.7));
  for (const geometry of roadGeometry) {
    drawMinimapGeometryTriangles(context, bounds, pad, mapWidth, mapHeight, geometry);
  }
}

function drawMinimapGeometryTriangles(context, bounds, pad, mapWidth, mapHeight, geometry) {
  const positions = geometry.positionsCompressed;
  const indices = geometry.indices;
  const aabb = geometry.aabb;
  const matrix = geometry.worldMatrix;
  const localScale = [
    (aabb[3] - aabb[0]) / 65535,
    (aabb[4] - aabb[1]) / 65535,
    (aabb[5] - aabb[2]) / 65535
  ];
  const p0 = [0, 0];
  const p1 = [0, 0];
  const p2 = [0, 0];
  for (let i = 0, len = indices.length; i < len; i += 3) {
    readMinimapVertex(positions, indices[i], aabb, localScale, matrix, bounds, pad, mapWidth, mapHeight, p0);
    readMinimapVertex(positions, indices[i + 1], aabb, localScale, matrix, bounds, pad, mapWidth, mapHeight, p1);
    readMinimapVertex(positions, indices[i + 2], aabb, localScale, matrix, bounds, pad, mapWidth, mapHeight, p2);
    context.beginPath();
    context.moveTo(p0[0], p0[1]);
    context.lineTo(p1[0], p1[1]);
    context.lineTo(p2[0], p2[1]);
    context.closePath();
    context.fill();
  }
}

function readMinimapVertex(positions, vertexIndex, aabb, localScale, matrix, bounds, pad, mapWidth, mapHeight, out) {
  const index = vertexIndex * 3;
  const localX = aabb[0] + positions[index] * localScale[0];
  const localY = aabb[1] + positions[index + 1] * localScale[1];
  const localZ = aabb[2] + positions[index + 2] * localScale[2];
  const worldX = matrix ? matrix[0] * localX + matrix[4] * localY + matrix[8] * localZ + matrix[12] : localX;
  const worldY = matrix ? matrix[1] * localX + matrix[5] * localY + matrix[9] * localZ + matrix[13] : localY;
  const point = worldToMinimap([worldX, worldY, 0], bounds, pad, mapWidth, mapHeight);
  out[0] = point[0];
  out[1] = point[1];
}

function worldToMinimap(position, bounds, pad, mapWidth, mapHeight) {
  const xT = clamp(((position[0] || 0) - bounds[0]) / Math.max(0.001, bounds[3] - bounds[0]), 0, 1);
  const yT = clamp(((position[1] || 0) - bounds[1]) / Math.max(0.001, bounds[4] - bounds[1]), 0, 1);
  const contentX = MINIMAP_CONTENT_RECT.x * mapWidth;
  const contentY = MINIMAP_CONTENT_RECT.y * mapHeight;
  const contentWidth = MINIMAP_CONTENT_RECT.width * mapWidth;
  const contentHeight = MINIMAP_CONTENT_RECT.height * mapHeight;
  return [
    pad + contentX + (1 - yT) * contentWidth,
    pad + contentY + (1 - xT) * contentHeight
  ];
}

function resizeMinimapCanvas(canvas) {
  const pixelRatio = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(1, Math.round(rect.width * pixelRatio));
  const height = Math.max(1, Math.round(rect.height * pixelRatio));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
}

function findStreetLampMaterials(sceneModel) {
  const materials = new Set();
  for (const mesh of Object.values(sceneModel.meshes || {})) {
    if ((isStreetLampId(mesh?.id) || isStreetLampMaterial(mesh?.material)) && mesh.material) {
      materials.add(mesh.material);
    }
  }
  for (const object of Object.values(sceneModel.objects || {})) {
    for (const mesh of Object.values(object.meshes || {})) {
      if ((isStreetLampId(object?.id) || isStreetLampId(mesh?.id) || isStreetLampMaterial(mesh?.material)) && mesh?.material) {
        materials.add(mesh.material);
      }
    }
  }
  return Array.from(materials);
}

function findStreetLampViewObjects(sceneModel, view) {
  const viewObjects = new Set();
  for (const object of Object.values(sceneModel.objects || {})) {
    if (isStreetLampId(object?.id)) {
      const viewObject = view.objects?.[object.id];
      if (viewObject) {
        viewObjects.add(viewObject);
      }
      continue;
    }
    for (const mesh of Object.values(object.meshes || {})) {
      if (isStreetLampId(mesh?.id) || isStreetLampMaterial(mesh?.material)) {
        const viewObject = view.objects?.[object.id];
        if (viewObject) {
          viewObjects.add(viewObject);
        }
        break;
      }
    }
  }
  return Array.from(viewObjects);
}

function isStreetLampId(id) {
  const value = String(id || "").toLowerCase();
  return value.includes("trafficlights_white") ||
    value.includes("material.001") ||
    value.includes("streetlight") ||
    value.includes("street_light");
}

function isStreetLampMaterial(material) {
  const id = String(material?.id || "").toLowerCase();
  return STREET_LAMP_MATERIAL_IDS.has(id) || isStreetLampId(id);
}

function isRoadSurfaceObjectId(objectId) {
  const id = String(objectId || "").toLowerCase();
  return id.includes("road") ||
    id.includes("asphalt") ||
    id.includes("pavement") ||
    id.includes("crossing") ||
    /(^|[_\W])lane([_\W]|$)/.test(id);
}

function isGrassSurfaceObjectId(objectId) {
  const id = String(objectId || "").toLowerCase();
  return id === "plane" ||
    id.includes("_plane") ||
    id.includes("plane_") ||
    id.includes("grass") ||
    id.includes("ground") ||
    id.includes("terrain") ||
    id.includes("field") ||
    id.includes("landscape") ||
    id.includes("lawn");
}

function chooseRoadHeading(aabb, hits = []) {
  if (hits.length > 1) {
    const topZ = hits[0][2];
    const topHits = hits.filter((hit) => Math.abs(hit[2] - topZ) < 2.5);
    if (topHits.length > 1) {
      const xs = topHits.map((hit) => hit[0]);
      const ys = topHits.map((hit) => hit[1]);
      const xSize = Math.max(...xs) - Math.min(...xs);
      const ySize = Math.max(...ys) - Math.min(...ys);
      if (xSize > ySize * 1.2) {
        return [1, 0, 0];
      }
      if (ySize > xSize * 1.2) {
        return [0, 1, 0];
      }
    }
  }
  const xSize = Math.max(0.001, aabb[3] - aabb[0]);
  const ySize = Math.max(0.001, aabb[4] - aabb[1]);
  return xSize >= ySize ? [1, 0, 0] : [0, 1, 0];
}

function setupSkateboardMomentum({view, raycaster, vehicleController, driveSurfaceFilter}) {
  let running = true;
  let rafHandle = 0;
  let lastTime = performance.now();
  let queuedImpulse = 0;
  let launchSurgeRemaining = 0;
  let restLaunchPending = false;
  let lastPushTime = -Infinity;
  let lastJumpTime = -Infinity;
  let previousSlope = 0;
  let smoothedSlope = 0;
  let previousSpeed = Number(vehicleController.speed || 0);
  let flexOffset = 0;
  let flexVelocity = 0;
  let flexPhase = 0;
  let previousForward = null;
  let carveLoad = 0;
  let previousCarveLoad = 0;
  let momentumSpeed = Number(vehicleController.speed || 0);
  let momentumDirection = null;
  let detachment = 0;
  let lastSlideSideDistance = 0;
  const pushKeysDown = new Set();
  const brakeKeysDown = new Set();
  let rollbackActive = false;
  let rollbackStartTime = 0;
  let lastKerbImpactTime = -Infinity;
  let lastKerbImpactHeight = 0;
  let lastKerbImpactStrength = 0;
  let skateboardSound = null;

  const queuePush = (now = performance.now()) => {
    if (!vehicleController?.active || vehicleController.flying) {
      return;
    }
    if (now - lastPushTime < SKATEBOARD_PHYSICS.pushCooldownMs) {
      return;
    }
    lastPushTime = now;
    flexVelocity -= 0.35;
    const speed = Math.max(Math.abs(momentumSpeed), Math.abs(Number(vehicleController.speed || 0)));
    if (speed < SKATEBOARD_PHYSICS.restartResetSpeed && launchSurgeRemaining <= 0) {
      launchSurgeRemaining = SKATEBOARD_PHYSICS.pushLaunchImpulse;
      restLaunchPending = true;
    }
    queuedImpulse += SKATEBOARD_PHYSICS.pushImpulse;
    view.needsRender?.();
  };

  const onKeyDown = (event) => {
    if (event.code === "Space") {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (!event.repeat) {
        triggerOllie();
      }
    } else if (event.code === "ArrowUp" || event.code === "KeyW") {
      event.preventDefault();
      event.stopImmediatePropagation();
      skateboardSound?.start?.();
      brakeKeysDown.clear();
      const wasPushing = isPushHeld();
      pushKeysDown.add(event.code);
      if (!wasPushing) {
        queuePush();
      }
    } else if (event.code === "ArrowDown" || event.code === "KeyS") {
      event.preventDefault();
      event.stopImmediatePropagation();
      vehicleController.clearInput?.();
      brakeKeysDown.add(event.code);
      queuedImpulse = 0;
      launchSurgeRemaining = 0;
    }
  };

  const onKeyUp = (event) => {
    if (event.code === "ArrowDown" || event.code === "KeyS") {
      event.preventDefault();
      event.stopImmediatePropagation();
      vehicleController.clearInput?.();
      brakeKeysDown.delete(event.code);
      lastPushTime = -Infinity;
    } else if (event.code === "ArrowUp" || event.code === "KeyW") {
      event.preventDefault();
      event.stopImmediatePropagation();
      pushKeysDown.delete(event.code);
    } else if (event.code === "Space") {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  };

  document.addEventListener("keydown", onKeyDown, {capture: true});
  document.addEventListener("keyup", onKeyUp, {capture: true});
  window.addEventListener("blur", onWindowBlur);

  const tick = (now) => {
    if (!running) {
      return;
    }
    const dt = Math.max(0.001, Math.min(0.1, (now - lastTime) / 1000));
    lastTime = now;

    if (vehicleController?.active && !vehicleController.flying) {
      updateSkateboardSpeed(dt);
    }
    rafHandle = requestAnimationFrame(tick);
  };

  function updateSkateboardSpeed(dt) {
    const pushHeld = isPushHeld();
    const brakeHeld = isBrakeHeld();
    if (pushHeld && !brakeHeld) {
      queuePush();
    }
    const camera = view.camera;
    const forward = horizontalDirection([
      camera.look[0] - camera.eye[0],
      camera.look[1] - camera.eye[1],
      camera.look[2] - camera.eye[2]
    ]);
    if (!forward) {
      return;
    }

    let speed = Math.max(Math.abs(momentumSpeed), Math.abs(Number(vehicleController.speed || 0)));
    const speedBeforeUpdate = speed;
    if (queuedImpulse > 0) {
      if (restLaunchPending) {
        const pendingQueuedImpulse = queuedImpulse;
        const pendingLaunchSurge = launchSurgeRemaining;
        resetSkateboardTraction(forward);
        queuedImpulse = pendingQueuedImpulse;
        launchSurgeRemaining = pendingLaunchSurge;
        restLaunchPending = false;
        speed = 0;
      }
      if (launchSurgeRemaining > 0) {
        const deliveredSurge = Math.min(
          launchSurgeRemaining,
          (SKATEBOARD_PHYSICS.pushLaunchImpulse / SKATEBOARD_PHYSICS.pushLaunchSeconds) * dt
        );
        speed += deliveredSurge;
        launchSurgeRemaining -= deliveredSurge;
      }
      const turnRate = previousForward
        ? headingDeltaRadians(previousForward, forward) / Math.max(0.001, dt)
        : 0;
      const carveSurge = pushHeld
        ? 1 + 0.32 * clamp((turnRate - 0.18) / 1.35, 0, 1)
        : 1;
      const deliveredImpulse = Math.min(
        queuedImpulse,
        (SKATEBOARD_PHYSICS.pushImpulse / SKATEBOARD_PHYSICS.pushDeliverySeconds) *
          dt *
          (1.35 - 0.35 * clamp(speed / 8, 0, 1)) *
          carveSurge
      );
      speed += deliveredImpulse;
      queuedImpulse -= deliveredImpulse;
    }
    if (brakeHeld) {
      speed = moveTowardsNumber(speed, 0, SKATEBOARD_PHYSICS.brakeDeceleration * dt);
      detachment = moveTowardsNumber(detachment, 0, SKATEBOARD_PHYSICS.slideRegripRate * dt);
    }

    const surfaceHit = sampleDriveSurfaceHitAt(view, raycaster, driveSurfaceFilter, getGroundPoint(view.camera));
    const normal = surfaceHit?.normal || null;
    const downhillSurfaceDirection = normal ? downhillSurfaceDirectionFromNormal(normal) : null;
    const downhillDirection = downhillSurfaceDirection ? horizontalDirection(downhillSurfaceDirection) : null;
    const slopeMagnitude = normal ? slopeMagnitudeFromNormal(normal) : 0;
    const travelSign = Math.abs(speed) > 0.08 ? Math.sign(speed) : 1;
    const tractionDirection = detachment > 0.02 && momentumDirection ? momentumDirection : forward;
    const travelDirection = mul3(tractionDirection, travelSign);
    const slope = normal ? slopeAlongDirection(normal, travelDirection) : 0;
    const jumpType = surfaceBreakJumpType({slope, previousSlope, speed, travelSign});
    if (jumpType) {
      triggerSurfaceBreakJump(speed, jumpType);
      previousSlope = slope;
      queuedImpulse = 0;
      return;
    }
    previousSlope = slope;
    smoothedSlope += (slope - smoothedSlope) * Math.min(1, dt * 5.5);
    speed = applyKerbFeedback(speed, travelDirection, surfaceHit, smoothedSlope);

    const allowSlopeGravity = Math.abs(speed) >= SKATEBOARD_PHYSICS.slopeGravityMinSpeed;
    const rawGravityAccel = allowSlopeGravity ? -smoothedSlope * SKATEBOARD_PHYSICS.gravityAcceleration : 0;
    const gravityAccel = clamp(
      rawGravityAccel > 0 ? rawGravityAccel * SKATEBOARD_PHYSICS.downhillAccelerationScale : rawGravityAccel,
      -SKATEBOARD_PHYSICS.gravityAcceleration,
      SKATEBOARD_PHYSICS.gravityAcceleration * SKATEBOARD_PHYSICS.downhillAccelerationScale
    );
    speed += gravityAccel * dt * travelSign;

    const speedAbs = Math.abs(speed);
    if (speedAbs > 0) {
      const downhill = gravityAccel > 0.04;
      const rollingScale = downhill ? SKATEBOARD_PHYSICS.downhillRollingDecelerationScale : 1;
      const dragScale = downhill ? SKATEBOARD_PHYSICS.downhillAirDragScale : 1;
      const decel = SKATEBOARD_PHYSICS.rollingDeceleration * rollingScale +
        speedAbs * speedAbs * SKATEBOARD_PHYSICS.airDrag * dragScale;
      speed = moveTowardsNumber(speed, 0, decel * dt);
    }
    if (brakeHeld && Math.abs(speed) < SKATEBOARD_PHYSICS.restartResetSpeed) {
      stopSkateboard(forward);
      updateSkateboardFlex(dt, 0, speedBeforeUpdate, smoothedSlope, gravityAccel, forward);
      return;
    }
    if (
      Math.abs(speed) < SKATEBOARD_PHYSICS.stopSpeed &&
        slopeMagnitude < SKATEBOARD_PHYSICS.rollbackMinSlope
    ) {
      speed = 0;
      resetSkateboardTraction(forward);
    }
    speed = clamp(speed, -vehicleController.maxReverseSpeed, vehicleController.maxForwardSpeed);
    momentumSpeed = speed;
    if (applySlopeRollback(dt, forward, downhillDirection, downhillSurfaceDirection, slopeMagnitude)) {
      updateSkateboardFlex(dt, momentumSpeed, speedBeforeUpdate, smoothedSlope, gravityAccel, forward);
      return;
    }
    applySkateboardTraction(dt, forward);
    updateSkateboardFlex(dt, speed, speedBeforeUpdate, smoothedSlope, gravityAccel, forward);
  }

  function applySlopeRollback(dt, forward, downhillDirection, downhillSurfaceDirection, slopeMagnitude) {
    const shouldRollback =
      downhillDirection &&
      downhillSurfaceDirection &&
      !isBrakeHeld() &&
      Math.abs(momentumSpeed) <= SKATEBOARD_PHYSICS.rollbackStartSpeed &&
      slopeMagnitude >= SKATEBOARD_PHYSICS.rollbackMinSlope;
    if (!shouldRollback && !rollbackActive) {
      return false;
    }
    if (!shouldRollback && rollbackActive) {
      rollbackActive = false;
      return false;
    }
    if (!rollbackActive) {
      rollbackActive = true;
      rollbackStartTime = performance.now();
      momentumDirection = downhillDirection;
      detachment = 0;
      lastSlideSideDistance = 0;
    }

    const downhillAcceleration = SKATEBOARD_PHYSICS.gravityAcceleration *
      Math.min(1, slopeMagnitude) *
      SKATEBOARD_PHYSICS.rollbackAccelerationScale;
    momentumSpeed = clamp(
      momentumSpeed + downhillAcceleration * dt,
      0,
      vehicleController.maxForwardSpeed
    );

    const delta = mul3(downhillSurfaceDirection, momentumSpeed * dt);
    const camera = view.camera;
    camera.eye = add3(camera.eye, delta);
    camera.look = add3(camera.look, delta);

    const rollbackAge = performance.now() - rollbackStartTime;
    if (rollbackAge >= SKATEBOARD_PHYSICS.rollbackDelayMs) {
      yawCameraTowardDirection(view, downhillDirection, SKATEBOARD_PHYSICS.rollbackTurnRate * dt);
    }

    momentumDirection = downhillDirection;
    const noseComponent = clamp(dot3(downhillDirection, forward), 0, 1);
    vehicleController.speed = momentumSpeed * noseComponent;
    view.needsRender?.();
    if (noseComponent > 0.94 && rollbackAge >= SKATEBOARD_PHYSICS.rollbackDelayMs) {
      rollbackActive = false;
    }
    return true;
  }

  function applySkateboardTraction(dt, forward) {
    if (!momentumDirection) {
      momentumDirection = forward;
    }
    const speedAbs = Math.abs(momentumSpeed);
    const speedT = clamp(
      (speedAbs - SKATEBOARD_PHYSICS.slideMinSpeed) /
        Math.max(0.001, SKATEBOARD_PHYSICS.maxSpeed - SKATEBOARD_PHYSICS.slideMinSpeed),
      0,
      1
    );
    if (previousForward && speedT > 0) {
      const signedTurnRate = headingSignedDeltaRadians(previousForward, forward) / Math.max(0.001, dt);
      const breakawayBase = clamp(
        (Math.abs(signedTurnRate) - SKATEBOARD_PHYSICS.slideBreakTurnRate) /
          SKATEBOARD_PHYSICS.slideBreakTurnRate,
        0,
        1
      );
      const breakaway = breakawayBase * breakawayBase;
      if (breakaway > 0) {
        if (detachment < 0.08) {
          momentumDirection = previousForward;
        }
        detachment += breakaway * Math.sqrt(speedT) * SKATEBOARD_PHYSICS.slideDetachResponse * dt;
      }
    }

    detachment = clamp(detachment, 0, 1);
    if (detachment <= 0.001) {
      momentumDirection = forward;
      vehicleController.speed = momentumSpeed;
      return;
    }

    const noseComponent = clamp(dot3(momentumDirection, forward), 0, 1);
    const noseSpeed = momentumSpeed * noseComponent;
    const lateralDirection = normalize3([
      momentumDirection[0] - forward[0] * noseComponent,
      momentumDirection[1] - forward[1] * noseComponent,
      0
    ]);
    const sideDistance = Math.min(
      momentumSpeed *
        Math.sqrt(Math.max(0, 1 - noseComponent * noseComponent)) *
        detachment *
        SKATEBOARD_PHYSICS.slideDriftScale *
        dt,
      SKATEBOARD_PHYSICS.slideMaxSideStep
    );
    lastSlideSideDistance = sideDistance;

    const forwardDistance = Math.abs(noseSpeed) * dt;
    const driftShare = sideDistance / Math.max(0.0001, forwardDistance + sideDistance);
    if (driftShare > 0) {
      const dumpShare = driftShare * driftShare;
      momentumSpeed = Math.max(
        0,
        momentumSpeed * (1 - dumpShare * detachment * SKATEBOARD_PHYSICS.slideMomentumDump)
      );
    }

    const camera = view.camera;
    if (sideDistance > 0.0001) {
      const delta = mul3(lateralDirection, sideDistance);
      camera.eye = add3(camera.eye, delta);
      camera.look = add3(camera.look, delta);
      view.needsRender?.();
    }

    const forwardAuthority = clamp(forwardDistance / Math.max(0.0001, sideDistance + forwardDistance), 0, 1);
    const alignRate = SKATEBOARD_PHYSICS.slideMomentumAlignRate * forwardAuthority * (1 - detachment * 0.65);
    momentumDirection = normalize3(lerp3(momentumDirection, forward, clamp(dt * alignRate, 0, 1)));
    const currentNoseComponent = clamp(dot3(momentumDirection, forward), 0, 1);
    const noseDrive = SKATEBOARD_PHYSICS.slideMinNoseDrive +
      (1 - SKATEBOARD_PHYSICS.slideMinNoseDrive) * currentNoseComponent;
    vehicleController.speed = momentumSpeed * noseDrive;
    detachment = moveTowardsNumber(
      detachment,
      0,
      SKATEBOARD_PHYSICS.slideRegripRate * dt * (0.2 + speedT) * forwardAuthority
    );
  }

  function applyKerbFeedback(speed, travelDirection, surfaceHit, slope) {
    const speedAbs = Math.abs(speed);
    if (
      !surfaceHit ||
      vehicleController.flying ||
      speedAbs < SKATEBOARD_PHYSICS.kerbImpactMinSpeed ||
      Math.abs(slope) > SKATEBOARD_PHYSICS.kerbImpactRampSlopeLimit
    ) {
      return speed;
    }
    const now = performance.now();
    if (now - lastKerbImpactTime < SKATEBOARD_PHYSICS.kerbImpactCooldownMs) {
      return speed;
    }
    const travel = horizontalDirection(travelDirection);
    if (!travel) {
      return speed;
    }
    const aheadHit = sampleDriveSurfaceHitAt(
      view,
      raycaster,
      driveSurfaceFilter,
      add3(surfaceHit.worldPos, mul3(travel, SKATEBOARD_PHYSICS.kerbProbeDistance))
    );
    if (!aheadHit) {
      return speed;
    }
    const stepHeight = aheadHit.worldPos[2] - surfaceHit.worldPos[2];
    if (
      stepHeight < SKATEBOARD_PHYSICS.kerbImpactMinHeight ||
      stepHeight > SKATEBOARD_PHYSICS.kerbImpactMaxHeight
    ) {
      return speed;
    }

    const heightT = clamp(
      (stepHeight - SKATEBOARD_PHYSICS.kerbImpactMinHeight) /
        Math.max(0.001, SKATEBOARD_PHYSICS.kerbImpactMaxHeight - SKATEBOARD_PHYSICS.kerbImpactMinHeight),
      0,
      1
    );
    const speedT = clamp((speedAbs - SKATEBOARD_PHYSICS.kerbImpactMinSpeed) / 9, 0, 1);
    const strength = clamp(0.35 + heightT * 0.45 + speedT * 0.35, 0, 1);

    lastKerbImpactTime = now;
    lastKerbImpactHeight = stepHeight;
    lastKerbImpactStrength = strength;
    flexVelocity -= SKATEBOARD_PHYSICS.kerbImpactFlexImpulse * strength;
    detachment = Math.min(1, detachment + 0.08 * strength);
    triggerKerbJump(speed, strength);
    view.needsRender?.();
    return speed * (1 - SKATEBOARD_PHYSICS.kerbImpactSpeedLoss * strength);
  }

  function triggerKerbJump(speed, strength) {
    const restoreTakeoffHeight = vehicleController.flightTakeoffHeight;
    const restoreTakeoffSpeed = vehicleController.flightTakeoffSpeed;
    vehicleController.flightTakeoffHeight = SKATEBOARD_PHYSICS.kerbJumpTakeoffHeight * (0.72 + strength * 0.42);
    vehicleController.flightTakeoffSpeed = SKATEBOARD_PHYSICS.kerbJumpTakeoffSpeed * (0.72 + strength * 0.38);
    vehicleController.speed = Math.min(
      vehicleController.maxForwardSpeed,
      Math.max(speed, speed + strength * 0.45)
    );
    vehicleController.flying = true;
    vehicleController.flightTakeoffHeight = restoreTakeoffHeight;
    vehicleController.flightTakeoffSpeed = restoreTakeoffSpeed;
  }

  function resetSkateboardTraction(forward) {
    momentumDirection = forward;
    momentumSpeed = 0;
    queuedImpulse = 0;
    launchSurgeRemaining = 0;
    restLaunchPending = false;
    detachment = 0;
    lastSlideSideDistance = 0;
    rollbackActive = false;
    vehicleController.speed = 0;
  }

  function stopSkateboard(forward) {
    lastPushTime = -Infinity;
    vehicleController.clearInput?.();
    resetSkateboardTraction(forward);
  }

  function onWindowBlur() {
    pushKeysDown.clear();
    brakeKeysDown.clear();
    queuedImpulse = 0;
    launchSurgeRemaining = 0;
    restLaunchPending = false;
  }

  function isPushHeld() {
    return pushKeysDown.size > 0;
  }

  function isBrakeHeld() {
    return brakeKeysDown.size > 0;
  }

  function updateSkateboardFlex(dt, speed, speedBeforeUpdate, slope, gravityAccel, forward) {
    const speedAbs = Math.abs(speed);
    const moving = speedAbs > SKATEBOARD_PHYSICS.stopSpeed || Math.abs(gravityAccel) > 0.04;
    const speedT = clamp(speedAbs / Math.max(1, SKATEBOARD_PHYSICS.maxSpeed), 0, 1);
    let target = 0;

    if (moving) {
      const acceleration = (speed - previousSpeed) / Math.max(0.001, dt);
      const frameAcceleration = (speed - speedBeforeUpdate) / Math.max(0.001, dt);
      const compressionAcceleration = Math.max(acceleration, frameAcceleration, 0);
      const downhillLoad = Math.max(0, -slope);
      const pushAge = performance.now() - lastPushTime;
      const pushFlex = pushAge < SKATEBOARD_PHYSICS.flexPushDurationMs
        ? Math.sin((pushAge / SKATEBOARD_PHYSICS.flexPushDurationMs) * Math.PI)
        : 0;
      const carveSpeedT = clamp(SKATEBOARD_PHYSICS.flexCarveLowSpeedBias + Math.sqrt(speedT) * 0.78, 0, 1);
      const rawCarveLoad = previousForward
        ? headingDeltaRadians(previousForward, forward) / Math.max(0.001, dt) * carveSpeedT
        : 0;
      carveLoad += (rawCarveLoad - carveLoad) * clamp(dt * SKATEBOARD_PHYSICS.flexCarveResponse, 0, 1);
      if (carveLoad < previousCarveLoad) {
        flexVelocity += (previousCarveLoad - carveLoad) * SKATEBOARD_PHYSICS.flexCarveReleaseKick;
      }
      previousCarveLoad = carveLoad;

      flexPhase += speedAbs * dt * SKATEBOARD_PHYSICS.flexBobFrequency;
      target =
        Math.sin(flexPhase) * SKATEBOARD_PHYSICS.flexBobAmplitude * speedT -
        SKATEBOARD_PHYSICS.flexSpeedCompression * speedT -
        SKATEBOARD_PHYSICS.flexAccelerationCompression * clamp(compressionAcceleration / 18, 0, 1) -
        SKATEBOARD_PHYSICS.flexDownhillCompression * clamp(downhillLoad / 0.18, 0, 1) -
        SKATEBOARD_PHYSICS.flexPushCompression * pushFlex -
        SKATEBOARD_PHYSICS.flexCarveCompression * clamp(carveLoad / 0.7, 0, 1);
    } else {
      flexPhase = 0;
      carveLoad = 0;
      previousCarveLoad = 0;
    }

    const springForce = (target - flexOffset) * SKATEBOARD_PHYSICS.flexSpring;
    const dampingForce = -flexVelocity * SKATEBOARD_PHYSICS.flexDamping;
    flexVelocity += (springForce + dampingForce) * dt;
    flexOffset += flexVelocity * dt;
    flexOffset = clamp(flexOffset, -SKATEBOARD_PHYSICS.flexMaxOffset, SKATEBOARD_PHYSICS.flexMaxOffset);

    if (!moving && Math.abs(flexOffset) < 0.0005 && Math.abs(flexVelocity) < 0.0005) {
      flexOffset = 0;
      flexVelocity = 0;
    }

    vehicleController.cameraHeight = VEHICLE_CAMERA_HEIGHT + flexOffset;
    previousSpeed = speed;
    previousForward = moving ? forward : null;
  }

  function surfaceBreakJumpType({slope, previousSlope, speed, travelSign}) {
    const now = performance.now();
    if (
      travelSign <= 0 ||
      now - lastJumpTime < SKATEBOARD_PHYSICS.crestJumpCooldownMs ||
      Math.abs(speed) < SKATEBOARD_PHYSICS.crestJumpMinSpeed
    ) {
      return null;
    }

    const uphillCrest =
      previousSlope >= SKATEBOARD_PHYSICS.crestJumpUphillSlope &&
      Math.abs(slope) <= SKATEBOARD_PHYSICS.crestJumpFlatSlope &&
      previousSlope - slope >= SKATEBOARD_PHYSICS.crestJumpSlopeDrop;
    const dropIn =
      Math.abs(previousSlope) <= SKATEBOARD_PHYSICS.dropInJumpFlatSlope &&
      slope <= SKATEBOARD_PHYSICS.dropInJumpDeclineSlope &&
      previousSlope - slope >= SKATEBOARD_PHYSICS.dropInJumpSlopeDrop;

    if (uphillCrest) {
      return "crest";
    }
    return dropIn ? "dropIn" : null;
  }

  function triggerSurfaceBreakJump(speed, jumpType) {
    const now = performance.now();
    lastJumpTime = now;
    const restoreTakeoffHeight = vehicleController.flightTakeoffHeight;
    const restoreTakeoffSpeed = vehicleController.flightTakeoffSpeed;
    if (jumpType === "dropIn") {
      vehicleController.flightTakeoffHeight = 0;
      vehicleController.flightTakeoffSpeed = 0;
    } else {
      vehicleController.flightTakeoffHeight = SKATEBOARD_PHYSICS.crestJumpTakeoffHeight;
      vehicleController.flightTakeoffSpeed = SKATEBOARD_PHYSICS.crestJumpTakeoffSpeed;
    }
    vehicleController.speed = Math.min(
      vehicleController.maxForwardSpeed,
      Math.max(speed, speed + SKATEBOARD_PHYSICS.crestJumpSpeedBoost)
    );
    vehicleController.flying = true;
    vehicleController.flightTakeoffHeight = restoreTakeoffHeight;
    vehicleController.flightTakeoffSpeed = restoreTakeoffSpeed;
  }

  function triggerOllie() {
    const now = performance.now();
    if (
      !vehicleController?.active ||
      vehicleController.flying ||
      now - lastJumpTime < SKATEBOARD_PHYSICS.ollieCooldownMs
    ) {
      return;
    }
    lastJumpTime = now;
    rollbackActive = false;
    detachment = Math.min(detachment, 0.18);
    const currentSpeed = Math.max(Math.abs(momentumSpeed), Math.abs(Number(vehicleController.speed || 0)));
    momentumSpeed = Math.min(
      vehicleController.maxForwardSpeed,
      currentSpeed + SKATEBOARD_PHYSICS.ollieSpeedBoost
    );
    flexVelocity -= 1.15;
    const restoreTakeoffHeight = vehicleController.flightTakeoffHeight;
    const restoreTakeoffSpeed = vehicleController.flightTakeoffSpeed;
    vehicleController.flightTakeoffHeight = SKATEBOARD_PHYSICS.ollieTakeoffHeight;
    vehicleController.flightTakeoffSpeed = SKATEBOARD_PHYSICS.ollieTakeoffSpeed;
    vehicleController.speed = momentumSpeed;
    vehicleController.flying = true;
    vehicleController.flightTakeoffHeight = restoreTakeoffHeight;
    vehicleController.flightTakeoffSpeed = restoreTakeoffSpeed;
    skateboardSound?.playOllie?.();
    view.needsRender?.();
  }

  rafHandle = requestAnimationFrame(tick);

  return {
    push: queuePush,
    setSound(sound) {
      skateboardSound = sound;
    },
    get state() {
      return {
        momentumSpeed,
        controllerSpeed: vehicleController.speed,
        queuedImpulse,
        launchSurgeRemaining,
        restLaunchPending,
        pushHeld: isPushHeld(),
        brakeHeld: isBrakeHeld(),
        detachment,
        lastSlideSideDistance,
        lastKerbImpactHeight,
        lastKerbImpactStrength,
        momentumDirection
      };
    },
    destroy() {
      running = false;
      cancelAnimationFrame(rafHandle);
      document.removeEventListener("keydown", onKeyDown, {capture: true});
      document.removeEventListener("keyup", onKeyUp, {capture: true});
      window.removeEventListener("blur", onWindowBlur);
    }
  };
}

function getGroundPoint(camera) {
  return [
    camera.eye[0],
    camera.eye[1],
    camera.eye[2] - VEHICLE_CAMERA_HEIGHT
  ];
}

function sampleDriveSurfaceHitAt(view, raycaster, driveSurfaceFilter, ground) {
  const up = [0, 0, 1];
  const result = raycaster.pick({
    view,
    ray: {
      origin: add3(ground, mul3(up, SKATEBOARD_PHYSICS.surfaceProbeHeight)),
      dir: [0, 0, -1]
    },
    tMin: 0,
    tMax: SKATEBOARD_PHYSICS.surfaceProbeHeight + SKATEBOARD_PHYSICS.surfaceProbeDepth,
    pickSurfaceNormal: true,
    visiblePickableOnly: false,
    filter: driveSurfaceFilter
  });
  if (!result.ok || !result.value?.hit || !result.value.worldPos || !result.value.worldNormal) {
    return null;
  }
  return {
    worldPos: result.value.worldPos,
    normal: normalize3(result.value.worldNormal),
    objectId: result.value.objectId || null
  };
}

function slopeAlongDirection(normal, direction) {
  const n = normalize3(normal);
  const horizontal = horizontalDirection(direction);
  if (!horizontal || Math.abs(n[2]) < 0.08) {
    return 0;
  }
  return -(n[0] * horizontal[0] + n[1] * horizontal[1]) / n[2];
}

function slopeMagnitudeFromNormal(normal) {
  const n = normalize3(normal);
  if (Math.abs(n[2]) < 0.08) {
    return 0;
  }
  return Math.hypot(n[0], n[1]) / Math.abs(n[2]);
}

function downhillSurfaceDirectionFromNormal(normal) {
  const n = normalize3(normal);
  if (Math.abs(n[2]) < 0.08) {
    return null;
  }
  return normalize3([
    n[0] * n[2],
    n[1] * n[2],
    n[2] * n[2] - 1
  ]);
}

function horizontalDirection(direction) {
  const x = Number(direction?.[0] || 0);
  const y = Number(direction?.[1] || 0);
  const length = Math.hypot(x, y);
  if (length < 0.0001) {
    return null;
  }
  return [x / length, y / length, 0];
}

function headingDeltaRadians(a, b) {
  return Math.abs(headingSignedDeltaRadians(a, b));
}

function headingSignedDeltaRadians(a, b) {
  const crossZ = a[0] * b[1] - a[1] * b[0];
  const dot = clamp(a[0] * b[0] + a[1] * b[1], -1, 1);
  return Math.atan2(crossZ, dot);
}

function yawCameraTowardDirection(view, targetDirection, maxRadians) {
  const camera = view.camera;
  const eye = camera.eye;
  const look = camera.look;
  const lookVector = [
    (look[0] || 0) - (eye[0] || 0),
    (look[1] || 0) - (eye[1] || 0),
    (look[2] || 0) - (eye[2] || 0)
  ];
  const currentDirection = horizontalDirection(lookVector);
  if (!currentDirection) {
    return;
  }
  const yaw = clamp(
    headingSignedDeltaRadians(currentDirection, targetDirection),
    -Math.abs(maxRadians),
    Math.abs(maxRadians)
  );
  if (Math.abs(yaw) < 0.0001) {
    return;
  }
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  const nextDirection = [
    currentDirection[0] * c - currentDirection[1] * s,
    currentDirection[0] * s + currentDirection[1] * c,
    0
  ];
  const horizontalDistance = Math.max(0.001, Math.hypot(lookVector[0], lookVector[1]));
  camera.look = [
    eye[0] + nextDirection[0] * horizontalDistance,
    eye[1] + nextDirection[1] * horizontalDistance,
    eye[2] + lookVector[2]
  ];
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
    resizeCanvasToDisplaySize(view.htmlElement);
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

function setupSkateboardSound(view, enabled, getVehicleSpeed = () => 0, getSkateboardState = () => null) {
  if (!enabled) {
    skateboardSoundToggle?.closest("label")?.remove();
    return null;
  }

  const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextCtor) {
    if (skateboardSoundToggle) {
      skateboardSoundToggle.disabled = true;
    }
    return null;
  }

  let context = null;
  let masterGain = null;
  let rumbleGain = null;
  let wheelGain = null;
  let gritGain = null;
  let rumbleFilter = null;
  let wheelFilter = null;
  let gritFilter = null;
  let wheelOscillator = null;
  let running = false;
  let audioGraphPromise = null;
  let animationFrame = 0;
  let lastTime = performance.now();
  let lastEye = getCameraEye(view);
  let smoothedSpeed = 0;
  let rollIntensity = 0;
  let ollieBuffer = null;
  let ollieBufferPromise = null;
  let rollingBuffer = null;
  let rollingBufferPromise = null;

  const isEnabled = () => !skateboardSoundToggle || skateboardSoundToggle.checked;

  const start = async () => {
    if (!isEnabled()) {
      return;
    }
    await ensureAudioGraph();
    if (!context || !masterGain) {
      return;
    }
    if (context.state === "suspended") {
      await context.resume();
    }
    masterGain.gain.setTargetAtTime(0.84, context.currentTime, 0.08);
    if (!running) {
      running = true;
      lastTime = performance.now();
      lastEye = getCameraEye(view);
      animationFrame = window.requestAnimationFrame(updateSound);
    }
  };

  const mute = () => {
    if (masterGain && context) {
      masterGain.gain.setTargetAtTime(0, context.currentTime, 0.06);
    }
  };

  const stop = () => {
    running = false;
    if (animationFrame) {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = 0;
    }
    if (context) {
      context.close();
      context = null;
      audioGraphPromise = null;
      ollieBuffer = null;
      ollieBufferPromise = null;
      rollingBuffer = null;
      rollingBufferPromise = null;
    }
  };

  const onPointerDown = () => start();
  const onKeyDown = (event) => {
    if (["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(event.code)) {
      start();
    }
  };

  document.addEventListener("pointerdown", onPointerDown, {capture: true, passive: true});
  document.addEventListener("keydown", onKeyDown, {capture: true});
  window.addEventListener("pagehide", stop);

  if (skateboardSoundToggle) {
    skateboardSoundToggle.addEventListener("change", () => {
      if (skateboardSoundToggle.checked) {
        start();
      } else {
        mute();
      }
      skateboardSoundToggle.blur();
    });
  }

  async function ensureAudioGraph() {
    if (context && masterGain) {
      return;
    }
    if (audioGraphPromise) {
      return audioGraphPromise;
    }
    audioGraphPromise = createAudioGraph();
    return audioGraphPromise;
  }

  async function createAudioGraph() {
    context = new AudioContextCtor();
    const audioContext = context;
    const decodedRollingBuffer = await loadRollingBuffer(audioContext);
    if (context !== audioContext) {
      return;
    }
    const compressor = context.createDynamicsCompressor();
    const rumbleSource = context.createBufferSource();
    const gritSource = context.createBufferSource();
    wheelOscillator = context.createOscillator();
    masterGain = context.createGain();
    rumbleGain = context.createGain();
    wheelGain = context.createGain();
    gritGain = context.createGain();
    rumbleFilter = context.createBiquadFilter();
    wheelFilter = context.createBiquadFilter();
    gritFilter = context.createBiquadFilter();

    masterGain.gain.value = 0;
    rumbleGain.gain.value = 0.0001;
    wheelGain.gain.value = 0.0001;
    gritGain.gain.value = 0.0001;
    compressor.threshold.value = -18;
    compressor.knee.value = 24;
    compressor.ratio.value = 3;
    compressor.attack.value = 0.025;
    compressor.release.value = 0.32;

    rumbleFilter.type = "lowpass";
    rumbleFilter.frequency.value = 950;
    rumbleFilter.Q.value = 0.45;
    wheelOscillator.type = "triangle";
    wheelOscillator.frequency.value = 90;
    wheelFilter.type = "bandpass";
    wheelFilter.frequency.value = 520;
    wheelFilter.Q.value = 5.5;
    gritFilter.type = "bandpass";
    gritFilter.frequency.value = 1900;
    gritFilter.Q.value = 1.25;

    rumbleSource.buffer = decodedRollingBuffer;
    gritSource.buffer = createConcreteGritBuffer(context);
    rumbleSource.loop = true;
    gritSource.loop = true;

    rumbleSource.connect(rumbleFilter);
    rumbleFilter.connect(rumbleGain);
    rumbleGain.connect(masterGain);
    wheelOscillator.connect(wheelFilter);
    wheelFilter.connect(wheelGain);
    wheelGain.connect(masterGain);
    gritSource.connect(gritFilter);
    gritFilter.connect(gritGain);
    gritGain.connect(masterGain);
    masterGain.connect(compressor);
    compressor.connect(context.destination);

    rumbleSource.start();
    gritSource.start();
    wheelOscillator.start();
  }

  function loadRollingBuffer(audioContext) {
    if (rollingBuffer) {
      return Promise.resolve(rollingBuffer);
    }
    if (!rollingBufferPromise) {
      rollingBufferPromise = fetch(ROLLING_SOUND_URL)
        .then((response) => {
          if (!response.ok) {
            throw new Error(`Failed to load rolling sound: ${response.status}`);
          }
          return response.arrayBuffer();
        })
        .then((arrayBuffer) => audioContext.decodeAudioData(arrayBuffer))
        .then((buffer) => {
          rollingBuffer = buffer;
          return rollingBuffer;
        });
    }
    return rollingBufferPromise;
  }

  function updateSound(now) {
    if (!running || !context) {
      return;
    }
    const eye = getCameraEye(view);
    const dt = Math.max(0.016, Math.min(0.25, (now - lastTime) / 1000));
    const cameraSpeed = distance3(eye, lastEye) / dt;
    const vehicleSpeed = Math.abs(Number(getVehicleSpeed() || 0));
    smoothedSpeed += (Math.max(cameraSpeed, vehicleSpeed) - smoothedSpeed) * 0.18;
    const speedNorm = clamp(smoothedSpeed / 22, 0, 1);
    const moving = speedNorm > 0.015;
    const idle = isEnabled() ? 1 : 0;
    const nowSeconds = context.currentTime;
    const targetRoll = moving ? speedNorm : 0;
    rollIntensity += (targetRoll - rollIntensity) * 0.08;
    const roll = clamp(rollIntensity, 0, 1);

    rumbleFilter.frequency.setTargetAtTime(320 + roll * 1500, nowSeconds, 0.08);
    wheelOscillator.frequency.setTargetAtTime(55 + Math.pow(roll, 0.85) * 260, nowSeconds, 0.05);
    wheelFilter.frequency.setTargetAtTime(240 + roll * 950, nowSeconds, 0.05);
    gritFilter.frequency.setTargetAtTime(1200 + roll * 2600, nowSeconds, 0.04);
    rumbleGain.gain.setTargetAtTime((0.16 + roll * 0.5) * idle, nowSeconds, 0.16);
    wheelGain.gain.setTargetAtTime((Math.pow(roll, 1.05) * 0.022) * idle, nowSeconds, 0.12);
    gritGain.gain.setTargetAtTime((Math.pow(roll, 1.2) * 0.035) * idle, nowSeconds, 0.12);
    masterGain.gain.setTargetAtTime((moving ? 0.58 + roll * 0.28 : 0.018) * idle, nowSeconds, 0.14);

    lastTime = now;
    lastEye = eye;
    animationFrame = window.requestAnimationFrame(updateSound);
  }

  function playOllie() {
    void start().then(() => {
      if (!context || !isEnabled()) {
        return;
      }
      const playFallback = () => playGeneratedOllie(context, masterGain);
      void loadOllieBuffer().then((buffer) => {
        if (!context || !isEnabled() || !buffer) {
          return;
        }
        const nowSeconds = context.currentTime;
        const source = context.createBufferSource();
        const gain = context.createGain();

        source.buffer = buffer;
        gain.gain.setValueAtTime(0.0001, nowSeconds);
        gain.gain.linearRampToValueAtTime(0.95, nowSeconds + 0.012);
        gain.gain.setTargetAtTime(0.0001, nowSeconds + 0.18, 0.09);
        source.connect(gain);
        gain.connect(masterGain);
        source.start(nowSeconds);
      }).catch(playFallback);
    });
  }

  function loadOllieBuffer() {
    if (ollieBuffer) {
      return Promise.resolve(ollieBuffer);
    }
    if (!context) {
      return Promise.resolve(null);
    }
    if (!ollieBufferPromise) {
      const audioContext = context;
      ollieBufferPromise = fetch(OLLIE_SOUND_URL)
        .then((response) => {
          if (!response.ok) {
            throw new Error(`Failed to load ollie sound: ${response.status}`);
          }
          return response.arrayBuffer();
        })
        .then((arrayBuffer) => audioContext.decodeAudioData(arrayBuffer))
        .then((buffer) => {
          ollieBuffer = buffer;
          return buffer;
        });
    }
    return ollieBufferPromise;
  }

  function playGeneratedOllie(audioContext, destination) {
    if (!audioContext || !destination) {
      return;
    }
    const nowSeconds = audioContext.currentTime;
    const popSource = audioContext.createBufferSource();
    const scrapeSource = audioContext.createBufferSource();
    const popFilter = audioContext.createBiquadFilter();
    const scrapeFilter = audioContext.createBiquadFilter();
    const popGain = audioContext.createGain();
    const scrapeGainNode = audioContext.createGain();

    popSource.buffer = createOlliePopBuffer(audioContext);
    scrapeSource.buffer = createConcreteScrapeBuffer(audioContext);
    popFilter.type = "bandpass";
    popFilter.frequency.value = 118;
    popFilter.Q.value = 1.25;
    scrapeFilter.type = "highpass";
    scrapeFilter.frequency.value = 1200;
    scrapeFilter.Q.value = 0.8;

    popGain.gain.setValueAtTime(0.0001, nowSeconds);
    popGain.gain.linearRampToValueAtTime(0.34, nowSeconds + 0.026);
    popGain.gain.exponentialRampToValueAtTime(0.0001, nowSeconds + 0.24);
    scrapeGainNode.gain.setValueAtTime(0.0001, nowSeconds);
    scrapeGainNode.gain.linearRampToValueAtTime(0.34, nowSeconds + 0.045);
    scrapeGainNode.gain.exponentialRampToValueAtTime(0.0001, nowSeconds + 0.38);

    popSource.connect(popFilter);
    popFilter.connect(popGain);
    popGain.connect(destination);
    scrapeSource.connect(scrapeFilter);
    scrapeFilter.connect(scrapeGainNode);
    scrapeGainNode.connect(destination);
    popSource.start(nowSeconds);
    scrapeSource.start(nowSeconds + 0.018);
    popSource.stop(nowSeconds + 0.22);
    scrapeSource.stop(nowSeconds + 0.28);
  }

  return {
    start,
    playOllie,
    mute,
    stop
  };
}

function createConcreteGritBuffer(context) {
  const duration = 0.8;
  const buffer = context.createBuffer(1, Math.floor(context.sampleRate * duration), context.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < data.length; i++) {
    const white = Math.random() * 2 - 1;
    last += (white - last) * 0.82;
    const tick = Math.random() > 0.985 ? (Math.random() * 2 - 1) * 0.9 : 0;
    data[i] = clamp(last * 0.42 + tick, -1, 1);
  }
  return buffer;
}

function createConcreteScrapeBuffer(context) {
  const duration = 1.1;
  const buffer = context.createBuffer(1, Math.floor(context.sampleRate * duration), context.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < data.length; i++) {
    const white = Math.random() * 2 - 1;
    last += (white - last) * 0.93;
    const chatter = Math.sin(i * 0.31) * 0.2 + Math.sin(i * 0.123 + 2.0) * 0.11;
    const rasp = Math.sign(last) * Math.pow(Math.abs(last), 0.42);
    data[i] = clamp(rasp * 0.92 + chatter, -1, 1);
  }
  return buffer;
}

function createOlliePopBuffer(context) {
  const duration = 0.28;
  const buffer = context.createBuffer(1, Math.floor(context.sampleRate * duration), context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    const t = i / context.sampleRate;
    const attack = Math.min(1, t / 0.018);
    const env = attack * Math.exp(-t * 18);
    const woodPop = Math.sin(t * Math.PI * 2 * 92) * 0.78 + Math.sin(t * Math.PI * 2 * 54) * 0.42;
    const grit = (Math.random() * 2 - 1) * Math.exp(-t * 42);
    data[i] = clamp((woodPop + grit * 0.28) * env, -1, 1);
  }
  return buffer;
}

function getCameraEye(view) {
  return Array.from(view.camera.eye || [0, 0, 0]);
}

function distance3(a, b) {
  return Math.hypot((a[0] || 0) - (b[0] || 0), (a[1] || 0) - (b[1] || 0), (a[2] || 0) - (b[2] || 0));
}

function add3(a, b) {
  return [
    (a[0] || 0) + (b[0] || 0),
    (a[1] || 0) + (b[1] || 0),
    (a[2] || 0) + (b[2] || 0)
  ];
}

function mul3(a, scalar) {
  return [
    (a[0] || 0) * scalar,
    (a[1] || 0) * scalar,
    (a[2] || 0) * scalar
  ];
}

function dot3(a, b) {
  return (a[0] || 0) * (b[0] || 0) +
    (a[1] || 0) * (b[1] || 0) +
    (a[2] || 0) * (b[2] || 0);
}

function lerp3(a, b, t) {
  return [
    (a[0] || 0) + ((b[0] || 0) - (a[0] || 0)) * t,
    (a[1] || 0) + ((b[1] || 0) - (a[1] || 0)) * t,
    (a[2] || 0) + ((b[2] || 0) - (a[2] || 0)) * t
  ];
}

function normalize3(a) {
  const length = Math.hypot(a[0] || 0, a[1] || 0, a[2] || 0);
  if (length < 0.0001) {
    return [0, 0, 1];
  }
  return [
    (a[0] || 0) / length,
    (a[1] || 0) / length,
    (a[2] || 0) / length
  ];
}

function moveTowardsNumber(value, target, maxDelta) {
  if (Math.abs(target - value) <= maxDelta) {
    return target;
  }
  return value + Math.sign(target - value) * maxDelta;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function resizeCanvasToDisplaySize(canvas) {
  if (!canvas) {
    return false;
  }
  const rect = canvas.getBoundingClientRect();
  const pixelRatio = window.devicePixelRatio || 1;
  const width = Math.max(1, Math.round(rect.width * pixelRatio));
  const height = Math.max(1, Math.round(rect.height * pixelRatio));
  if (canvas.width === width && canvas.height === height) {
    return false;
  }
  canvas.width = width;
  canvas.height = height;
  return true;
}

function updateLoadProgress(progress) {
  if (!progress) {
    return;
  }
  const loaded = progress.loaded ?? progress.bytesLoaded ?? progress.itemsLoaded ?? 0;
  const total = progress.total ?? progress.bytesTotal ?? progress.itemsTotal ?? 0;
  setProgress("Loading XGF", loaded, total);
}

function showProgress(label, loaded, total) {
  progressPanel.dataset.visible = "true";
  setProgress(label, loaded, total);
}

function setProgress(label, loaded, total) {
  progressLabel.textContent = total > 0
    ? `${label}: ${formatCount(loaded)} / ${formatCount(total)}`
    : `${label}...`;
  progressPanel.dataset.indeterminate = total > 0 ? "false" : "true";
  progressBar.style.width = total > 0
    ? `${Math.max(0, Math.min(100, (loaded / total) * 100))}%`
    : "34%";
}

function hideProgress() {
  progressPanel.dataset.visible = "false";
  progressPanel.dataset.indeterminate = "false";
}

function updateStatus(message) {
  status.dataset.state = "";
  status.textContent = message;
}

function reportError(message) {
  hideProgress();
  status.dataset.state = "error";
  status.textContent = message;
  console.error(message);
}

function markLoaded() {
  const marker = document.createElement("div");
  marker.id = "ExampleLoaded";
  marker.style.display = "none";
  document.body.appendChild(marker);
}

function normalizeRenderer(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "webgpu" || normalized === "gpu") {
    return {
      id: "webgpu",
      label: "WebGPU"
    };
  }
  return {
    id: "webgl",
    label: "WebGL"
  };
}

function normalizeNavigation(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "model" || normalized === "orbit") {
    return {
      id: "model",
      label: "ModelNavigationController"
    };
  }
  return {
    id: "vehicle",
    label: "VehicleNavigationController"
  };
}

function formatCount(value) {
  return Number.isFinite(value) ? Math.round(value).toLocaleString() : "--";
}

function paintProgress() {
  return waitForAnimationFrame();
}

function waitForAnimationFrame() {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

function mustOk(result) {
  if (!result || result.ok === false) {
    throw new Error(result?.error || "xeokit operation failed.");
  }
  return result.value;
}
