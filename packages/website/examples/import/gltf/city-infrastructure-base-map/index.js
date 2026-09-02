import * as xeokit from "../../../../js/xeokit-studio-bundle.js";

const MODEL_ID = "CityInfrastructureBaseMap";
const GLB_URL = "../../../../models/CityInfrastructureBaseMap/gltf/model.glb";
const URL_PARAMS = new URLSearchParams(window.location.search);
const REQUESTED_RENDERER = normalizeRenderer(URL_PARAMS.get("renderer") || URL_PARAMS.get("backend") || "webgl");
const REQUESTED_NAVIGATION = normalizeNavigation(URL_PARAMS.get("nav") || URL_PARAMS.get("navigation") || "vehicle");
const VEHICLE_CAMERA_HEIGHT = 1.62;
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
  const {GLTFLoader} = xeokit.formats.gltf;

  rendererBadge.textContent = REQUESTED_RENDERER.label;
  rendererBadge.dataset.renderer = REQUESTED_RENDERER.id;
  updateStatus(`Initializing ${REQUESTED_RENDERER.label} renderer...`);
  resizeCanvasToDisplaySize(canvas);

  const scene = new Scene({logging: false});
  const viewer = new Viewer({scene, logging: false});
  const view = mustOk(viewer.createView({
    id: "cityInfrastructureBaseMapView",
    htmlElement: canvas,
    backgroundColor: [0.985, 0.99, 1.0],
    camera: {
      projection: "perspective",
      far: 1000000,
      eye: [80, -120, 70],
      look: [0, 0, 0],
      up: [0, 0, 1]
    },
    effects: {
      sao: {enabled: true, intensity: 0.08, scale: 0.7},
      edges: {enabled: false},
      bloom: {
        enabled: true,
        threshold: 2.8,
        knee: 0.45,
        intensity: 0.18
      },
      atmosphere: {
        enabled: true,
        color: [0.78, 0.86, 0.96],
        intensity: 0.22,
        maxOpacity: 0.36
      },
      depthOfField: {
        enabled: true,
        focusDistance: 55,
        focalRange: 28,
        radius: 4.5,
        intensity: 0.62,
        nearBlur: 0.08,
        farBlur: 0.82
      },
      tonemap: {enabled: false},
      antiAliasing: {enabled: true},
      shadows: {
        enabled: true,
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
  window.addEventListener("resize", () => {
    resizeCanvasToDisplaySize(canvas);
    view.needsRender?.();
  });

  showProgress("Fetching GLB", 0, 0);
  const sceneModel = mustOk(scene.createModel({
    id: MODEL_ID,
    coordinateSystem: COORDINATE_SYSTEM,
    updateHint: "static",
    memoryPolicy: "compact"
  }));

  try {
    updateStatus(`Fetching ${MODEL_ID}...`);
    const response = await fetch(GLB_URL);
    if (!response.ok) {
      throw new Error(`Failed to fetch ${GLB_URL}: HTTP ${response.status}`);
    }
    const fileData = await response.arrayBuffer();
    updateStatus(`Loading ${MODEL_ID}...`);
    showProgress("Loading GLB", 0, 0);
    await paintProgress();
    const result = await new GLTFLoader().load({
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
      maxForwardSpeed: 18,
      maxReverseSpeed: 4,
      acceleration: 9,
      brakeDeceleration: 18,
      coastDeceleration: 0,
      turnRateDegreesPerSecond: 86,
      leanDegrees: 18,
      stepHeight: 0.65,
      maxFall: 2.0,
      maxSlopeDegrees: 62,
      collision: true,
      gravity: true,
      keyboardEnabledOnlyOnMouseover: false,
      driveSurfaceFilter: isDriveSurfaceObjectId,
      obstacleFilter: (objectId) => !isDriveSurfaceObjectId(objectId)
    });
  }
  const skateboardSound = setupSkateboardSound(
    view,
    REQUESTED_NAVIGATION.id === "vehicle",
    () => vehicleController?.speed || 0
  );
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

  window.cityInfrastructureBaseMapExample = {
    scene,
    viewer,
    view,
    renderer,
    raycaster,
    picker,
    inputController,
    vehicleController,
    sceneModel,
    fpsMeter,
    skateboardSound
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

function getDriveSurfaceAABB(collisionIndex, sceneModel) {
  const ids = Object.keys(sceneModel.objects || {}).filter(isRoadSurfaceObjectId);
  return ids.length > 0 ? collisionIndex.getCombinedObjectAABB(ids) : null;
}

function isDriveSurfaceObjectId(objectId) {
  return isRoadSurfaceObjectId(objectId) || isGrassSurfaceObjectId(objectId);
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

function setupSkateboardSound(view, enabled, getVehicleSpeed = () => 0) {
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
  let lowWindGain = null;
  let highWindGain = null;
  let gustGain = null;
  let lowWindFilter = null;
  let highWindFilter = null;
  let gustFilter = null;
  let running = false;
  let animationFrame = 0;
  let lastTime = performance.now();
  let lastEye = getCameraEye(view);
  let smoothedSpeed = 0;
  let windIntensity = 0;

  const isEnabled = () => !skateboardSoundToggle || skateboardSoundToggle.checked;

  const start = async () => {
    if (!isEnabled()) {
      return;
    }
    ensureAudioGraph();
    if (context.state === "suspended") {
      await context.resume();
    }
    masterGain.gain.setTargetAtTime(0.36, context.currentTime, 0.08);
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
    }
  };

  const onPointerDown = () => start();
  const onKeyDown = (event) => {
    if (["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.code)) {
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
    });
  }

  function ensureAudioGraph() {
    if (context) {
      return;
    }
    context = new AudioContextCtor();
    const compressor = context.createDynamicsCompressor();
    const lowWindSource = context.createBufferSource();
    const highWindSource = context.createBufferSource();
    const gustSource = context.createBufferSource();
    masterGain = context.createGain();
    lowWindGain = context.createGain();
    highWindGain = context.createGain();
    gustGain = context.createGain();
    lowWindFilter = context.createBiquadFilter();
    highWindFilter = context.createBiquadFilter();
    gustFilter = context.createBiquadFilter();

    masterGain.gain.value = 0;
    lowWindGain.gain.value = 0.0001;
    highWindGain.gain.value = 0.0001;
    gustGain.gain.value = 0.0001;
    compressor.threshold.value = -20;
    compressor.knee.value = 24;
    compressor.ratio.value = 3;
    compressor.attack.value = 0.025;
    compressor.release.value = 0.32;

    lowWindFilter.type = "lowpass";
    lowWindFilter.frequency.value = 260;
    lowWindFilter.Q.value = 0.65;
    highWindFilter.type = "bandpass";
    highWindFilter.frequency.value = 1350;
    highWindFilter.Q.value = 0.75;
    gustFilter.type = "bandpass";
    gustFilter.frequency.value = 85;
    gustFilter.Q.value = 0.55;

    lowWindSource.buffer = createWindNoiseBuffer(context, 0.48);
    highWindSource.buffer = createWindNoiseBuffer(context, 0.9);
    gustSource.buffer = createWindNoiseBuffer(context, 0.18);
    lowWindSource.loop = true;
    highWindSource.loop = true;
    gustSource.loop = true;

    lowWindSource.connect(lowWindFilter);
    lowWindFilter.connect(lowWindGain);
    lowWindGain.connect(masterGain);
    highWindSource.connect(highWindFilter);
    highWindFilter.connect(highWindGain);
    highWindGain.connect(masterGain);
    gustSource.connect(gustFilter);
    gustFilter.connect(gustGain);
    gustGain.connect(masterGain);
    masterGain.connect(compressor);
    compressor.connect(context.destination);

    lowWindSource.start();
    highWindSource.start();
    gustSource.start();
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
    const speedNorm = clamp(smoothedSpeed / 18, 0, 1);
    const moving = speedNorm > 0.015;
    const idle = isEnabled() ? 1 : 0;
    const nowSeconds = context.currentTime;
    const gustPulse = clamp(
      0.92 +
      Math.sin(nowSeconds * 0.73) * 0.12 +
      Math.sin(nowSeconds * 1.91 + 1.4) * 0.055,
      0.68,
      1.12
    );
    const targetIntensity = moving ? speedNorm * gustPulse : 0;
    windIntensity += (targetIntensity - windIntensity) * 0.055;
    const rush = clamp(windIntensity, 0, 1);

    lowWindFilter.frequency.setTargetAtTime(120 + rush * 520, nowSeconds, 0.18);
    highWindFilter.frequency.setTargetAtTime(780 + Math.pow(rush, 0.75) * 3300, nowSeconds, 0.14);
    gustFilter.frequency.setTargetAtTime(45 + rush * 185, nowSeconds, 0.22);
    lowWindGain.gain.setTargetAtTime((0.018 + Math.pow(rush, 0.9) * 0.22) * idle, nowSeconds, 0.16);
    highWindGain.gain.setTargetAtTime((0.004 + Math.pow(rush, 1.45) * 0.12) * idle, nowSeconds, 0.12);
    gustGain.gain.setTargetAtTime((0.012 + rush * 0.1) * idle, nowSeconds, 0.2);
    masterGain.gain.setTargetAtTime((moving ? 0.2 + rush * 0.28 : 0.015) * idle, nowSeconds, 0.14);

    lastTime = now;
    lastEye = eye;
    animationFrame = window.requestAnimationFrame(updateSound);
  }

  return {
    start,
    mute,
    stop
  };
}

function createWindNoiseBuffer(context, roughness) {
  const duration = 2.4;
  const buffer = context.createBuffer(1, Math.floor(context.sampleRate * duration), context.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < data.length; i++) {
    const white = Math.random() * 2 - 1;
    last += (white - last) * roughness;
    const slow = Math.sin(i * 0.0021) * 0.08 + Math.sin(i * 0.0047 + 1.1) * 0.045;
    data[i] = clamp(last * 0.88 + slow, -1, 1);
  }
  return buffer;
}

function getCameraEye(view) {
  return Array.from(view.camera.eye || [0, 0, 0]);
}

function distance3(a, b) {
  return Math.hypot((a[0] || 0) - (b[0] || 0), (a[1] || 0) - (b[1] || 0), (a[2] || 0) - (b[2] || 0));
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
  setProgress("Loading GLB", loaded, total);
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
