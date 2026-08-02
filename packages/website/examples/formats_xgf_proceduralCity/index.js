import * as xeokit from "../../js/xeokit-studio-bundle.js";

const EXAMPLE_CONFIG = window.PROCEDURAL_CITY_STREAM_CONFIG || {};
const INDEX_URL = EXAMPLE_CONFIG.indexUrl || "../../models/ProceduralCityLarge/xgfstream/index.runtime.json";
const METADATA_URL = EXAMPLE_CONFIG.metadataUrl || "../../models/ProceduralCityLarge/metadata.json";
const REPORT_URL = EXAMPLE_CONFIG.reportUrl || "../../models/ProceduralCityLarge/report.json";
const MODEL_ID = EXAMPLE_CONFIG.modelId || "ProceduralCityLarge";
const VIEW_ID = EXAMPLE_CONFIG.viewId || "proceduralCityView";
const STREAM_LABEL = EXAMPLE_CONFIG.streamLabel || "procedural city";
const WIND_SOUND = !!EXAMPLE_CONFIG.windSound;
const VEHICLE_CONFIG = EXAMPLE_CONFIG.vehicle || null;
const AUTO_BATCH_SIZE = 12;
const FETCH_CONCURRENCY = 10;
const CHUNK_COMMIT_FRAME_BUDGET_MS = 4;
const CAMERA_DEBOUNCE_MS = 140;
const CACHE_XGF_FILE_BYTES = true;
const MAX_CACHED_XGF_FILE_BYTES = 256 * 1024 * 1024;

const CAMERA_PRESETS = {
  aerial: {
    eye: [1320, -1570, 1120],
    look: [35, -45, 80],
    up: [0, 0, 1],
    fov: 42
  },
  downtown: {
    eye: [530, -620, 270],
    look: [130, -120, 130],
    up: [0, 0, 1],
    fov: 35
  },
  street: {
    eye: [-330, 170, 12.5],
    look: [-250, 230, 10.8],
    up: [0, 0, 1],
    fov: 54
  }
};

const DISTRICT_COLORS = {
  "Historic Core": [0.82, 0.48, 0.32],
  "Downtown": [0.30, 0.58, 0.78],
  "Mixed Residential": [0.42, 0.66, 0.42],
  "Civic District": [0.76, 0.64, 0.38]
};

const LAND_USE_COLORS = {
  Residential: [0.45, 0.66, 0.44],
  MixedUse: [0.80, 0.58, 0.34],
  Office: [0.30, 0.55, 0.76],
  Hotel: [0.54, 0.42, 0.72],
  Civic: [0.72, 0.64, 0.42]
};

const studio = new xeokit.studio.Studio({});

studio.init().then(async () => {
  const status = document.getElementById("status");
  const panel = document.getElementById("panel");
  const {scene} = studio;
  const view = studio.viewManager.createView({
    id: VIEW_ID,
    adaptiveQuality: false,
    camera: CAMERA_PRESETS.aerial
  });
  view.camera.perspectiveProjection.far = 10000;
  setupWindSound(view, WIND_SOUND);

  try {
    status.textContent = `Loading ${STREAM_LABEL} stream index...`;
    const [index, manifest, report] = await Promise.all([
      fetchStreamingIndex(INDEX_URL),
      fetchJSON(METADATA_URL),
      fetchJSONOptional(REPORT_URL)
    ]);

    const sceneModel = must(scene.createModel({
      id: MODEL_ID,
      updateHint: "static",
      coordinateSystem: index.coordinateSystem
    }));

    const byLayer = indexObjectsByLayer(manifest);
    const loader = new xeokit.formats.xgfstream.XGFStreamingLoader();
    let renderScheduled = false;
    let streamController;
    const scheduleRender = () => {
      if (renderScheduled || !streamController) {
        return;
      }
      renderScheduled = true;
      window.requestAnimationFrame(() => {
        renderScheduled = false;
        renderStreamProgress(streamController);
        applyActiveDisplay(view, manifest, byLayer);
      });
    };

    streamController = new xeokit.formats.xgfstream.XGFViewStreamController({
      index,
      loader,
      sceneModel,
      view,
      batchSize: AUTO_BATCH_SIZE,
      fetchConcurrency: FETCH_CONCURRENCY,
      commitFrameBudgetMs: CHUNK_COMMIT_FRAME_BUDGET_MS,
      cameraDebounceMs: CAMERA_DEBOUNCE_MS,
      frustumOnly: true,
      cacheFileData: CACHE_XGF_FILE_BYTES,
      maxCachedFileBytes: MAX_CACHED_XGF_FILE_BYTES,
      onStatus: (streamStatus) => {
        status.textContent = streamStatus;
        const label = document.getElementById("streamStatus");
        if (label) {
          label.textContent = streamStatus;
        }
      },
      onProgress: (progress) => {
        scheduleRender();
        initialReady(progress, studio, status, panel);
      },
      onChunksLoading: () => {
        panel.style.display = "block";
      },
      onError: (error) => {
        status.textContent = `Failed to stream ${STREAM_LABEL}: ${error.message || error}`;
        console.error(error);
        scheduleRender();
      }
    });

    wirePanel({view, studio, manifest, report, byLayer, streamController});
    setStats(manifest, report);
    setReport(report);
    setPatterns(manifest);
    setEvaluation(report, manifest);
    if (VEHICLE_CONFIG?.initialCamera) {
      applyCameraParams(view, VEHICLE_CONFIG.initialCamera);
    } else {
      applyCamera(view, "aerial");
    }
    if (VEHICLE_CONFIG) {
      await setupVehicleChase({studio, scene, view, config: VEHICLE_CONFIG});
    }
    streamController.prefetchInitial(AUTO_BATCH_SIZE * 2);
    streamController.schedule(`Initial ${STREAM_LABEL} frustum`);
    bindCameraStreaming(studio, view, streamController);
    renderStreamProgress(streamController);
    panel.style.display = "block";
  } catch (error) {
    status.textContent = `Failed to load ${STREAM_LABEL}: ${error.message || error}`;
    console.error(error);
  }
});

function wirePanel({view, studio, manifest, report, byLayer, streamController}) {
  const meta = document.getElementById("meta");

  document.querySelectorAll("[data-camera]").forEach((button) => {
    button.addEventListener("click", () => {
      applyCamera(view, button.dataset.camera);
      streamController.schedule(`Camera preset ${button.dataset.camera}`);
    });
  });

  document.querySelectorAll("[data-layer]").forEach((input) => {
    input.addEventListener("change", () => {
      applyLayerVisibility(view, byLayer);
    });
  });

  document.getElementById("colorMode").addEventListener("change", (event) => {
    applyColorMode(view, manifest, event.target.value);
  });

  view.htmlElement.addEventListener("click", (event) => {
    const rect = view.htmlElement.getBoundingClientRect();
    const pick = studio.picking.picker.pick({
      view,
      canvasPos: [event.clientX - rect.left, event.clientY - rect.top]
    });
    if (!pick.hit || !pick.objectId) {
      meta.textContent = "Pick a building.";
      return;
    }
    const data = manifest.metadata[pick.objectId];
    if (!data || data.type !== "Building") {
      meta.textContent = JSON.stringify(data || {id: pick.objectId}, null, 2);
      return;
    }
    meta.textContent = JSON.stringify({
      id: data.id,
      district: data.district,
      usage: data.usage,
      floors: data.floors,
      height: data.height,
      facadeStyle: data.facadeStyle,
      roofType: data.roofType,
      patterns: (data.patterns || []).slice(0, 8)
    }, null, 2);
  });
}

async function setupVehicleChase({studio, scene, view, config}) {
  const modelUrl = config.modelUrl;
  if (!modelUrl) {
    return null;
  }

  const modelId = config.modelId || `${MODEL_ID}Vehicle`;
  const rootTransformId = "vehicleRoot";
  const contentTransformId = "vehicleContent";
  const sceneModel = must(scene.createModel({
    id: modelId,
    updateHint: "dynamic",
    coordinateSystem: config.coordinateSystem || {
      basis: [1, 0, 0, 0, 0, 1, 0, 1, 0],
      origin: [0, 0, 0],
      units: "meters",
      scaleToMeters: 1
    }
  }));

  const rootTransform = must(sceneModel.createTransform({
    id: rootTransformId,
    matrix: identityMat4()
  }));

  must(sceneModel.createTransform({
    id: contentTransformId,
    parentTransformId: rootTransformId,
    position: [0, 0, 0],
    scale: [1, 1, 1]
  }));

  const fileData = await fetchArrayBuffer(modelUrl);
  await new xeokit.formats.xgf.XGFLoader().load({
    fileData,
    sceneModel
  });

  parentVehicleContent(sceneModel, rootTransformId, contentTransformId);

  const scale = Number(config.scale || 1);
  const center = config.sourceCenter || [0, 0, 0];
  const contentTransform = sceneModel.transforms[contentTransformId];
  contentTransform.scale = [scale, scale, scale];
  contentTransform.position = [
    -Number(center[0] || 0) * scale,
    -Number(center[1] || 0) * scale,
    -Number(center[2] || 0) * scale
  ];
  if (Array.isArray(config.contentRotation)) {
    contentTransform.rotation = config.contentRotation;
  }

  const objectIds = Object.keys(sceneModel.objects);
  if (objectIds.length) {
    view.setObjectsPickable(objectIds, false);
  }

  const shipController = createShipFlightController({studio, view, rootTransform, config});
  shipController.update();

  window.__proceduralCityVehicle = {
    ready: true,
    modelId,
    view,
    sceneModel,
    rootTransform,
    objectIds,
    controller: shipController,
    chaseUpdateMode: shipController.updateMode
  };
  if (config.hideStudioOverlay !== false) {
    document.querySelectorAll(".xeokit-loading-overlay").forEach((element) => {
      element.style.display = "none";
    });
  }

  window.addEventListener("pagehide", () => {
    shipController.destroy();
  }, {once: true});

  return {sceneModel, rootTransform, vehicleNavigationController: shipController};
}

function parentVehicleContent(sceneModel, rootTransformId, contentTransformId) {
  const transforms = Object.values(sceneModel.transforms);
  for (const transform of transforms) {
    if (transform.id === rootTransformId || transform.id === contentTransformId || transform.parentTransform) {
      continue;
    }
    must(transform.setParentTransformId(contentTransformId));
  }
  for (const mesh of Object.values(sceneModel.meshes)) {
    if (!mesh.parentTransform) {
      must(mesh.setParentTransformId(contentTransformId));
    }
  }
}

function createShipFlightController({studio, view, rootTransform, config}) {
  const worldUp = getWorldUp(view);
  const initialEye = toVec3(view.camera.eye);
  const initialLook = toVec3(view.camera.look);
  const initialForward = safeNormalize(sub3(initialLook, initialEye), [0, 1, 0]);
  const initialBasis = basisFromForward(initialForward, worldUp);
  const cameraDistance = Number(config.cameraDistance ?? 64);
  const cameraHeight = Number(config.cameraHeight ?? 18);
  const initialPosition = Array.isArray(config.initialShipPosition)
    ? toVec3(config.initialShipPosition)
    : sub3(add3(initialEye, mul3(initialForward, cameraDistance)), mul3(worldUp, cameraHeight));
  const state = {
    position: initialPosition,
    forward: initialBasis.forward,
    right: initialBasis.right,
    up: initialBasis.up,
    speed: Number(config.startSpeed ?? 34),
    roll: 0,
    cameraEye: initialEye,
    cameraLook: initialLook,
    cursorX: 0,
    cursorActive: false,
    lastTime: performance.now()
  };
  const keysDown = new Set();
  const viewElement = view.htmlElement;
  const record = studio.viewManager.views?.[view.id];
  const suspendedViewController = record?.viewController;
  const suspendedActive = suspendedViewController ? suspendedViewController.active : null;
  if (record?.vehicleNavigationController?.destroy) {
    record.vehicleNavigationController.destroy();
  }
  if (suspendedViewController) {
    suspendedViewController.active = false;
  }

  let animationFrame = 0;
  let task = null;
  let destroyed = false;
  const update = () => {
    if (!destroyed) {
      updateShipFlight(view, rootTransform, config, state, keysDown);
    }
  };
  const SDKTask = xeokit.base?.core?.SDKTask;
  if (SDKTask) {
    task = new SDKTask({
      name: "ProceduralCityShipFlight",
      stage: SDKTask.CollectInputStage,
      repeat: true,
      task: update
    });
  } else {
    const updateWithRAF = () => {
      update();
      animationFrame = window.requestAnimationFrame(updateWithRAF);
    };
    updateWithRAF();
  }

  const onKeyDown = (event) => {
    if (!shouldHandleShipKey(event)) {
      return;
    }
    keysDown.add(event.code);
    event.preventDefault();
  };
  const onKeyUp = (event) => {
    if (!SHIP_CONTROL_KEYS.has(event.code)) {
      return;
    }
    keysDown.delete(event.code);
    event.preventDefault();
  };
  const onPointerMove = (event) => {
    if (!viewElement) {
      return;
    }
    const rect = viewElement.getBoundingClientRect();
    const width = Math.max(rect.width || 1, 1);
    state.cursorX = clamp(((event.clientX - rect.left) / width - 0.5) * 2, -1, 1);
    state.cursorActive = true;
  };
  const onMouseLeave = () => {
    state.cursorActive = false;
  };
  const onBlur = () => {
    keysDown.clear();
    state.cursorActive = false;
  };

  document.addEventListener("keydown", onKeyDown, {capture: true});
  document.addEventListener("keyup", onKeyUp, {capture: true});
  viewElement?.addEventListener("pointermove", onPointerMove);
  viewElement?.addEventListener("mouseleave", onMouseLeave);
  window.addEventListener("blur", onBlur);

  const controller = {
    type: "ship-flight",
    state,
    keysDown,
    updateMode: task ? "sdk-task" : "raf",
    update,
    destroy: () => {
      if (destroyed) {
        return;
      }
      destroyed = true;
      if (animationFrame) {
        window.cancelAnimationFrame(animationFrame);
        animationFrame = 0;
      }
      task?.destroy();
      document.removeEventListener("keydown", onKeyDown, {capture: true});
      document.removeEventListener("keyup", onKeyUp, {capture: true});
      viewElement?.removeEventListener("pointermove", onPointerMove);
      viewElement?.removeEventListener("mouseleave", onMouseLeave);
      window.removeEventListener("blur", onBlur);
      if (suspendedViewController && suspendedActive !== null) {
        suspendedViewController.active = suspendedActive;
      }
      if (record?.vehicleNavigationController === controller) {
        record.vehicleNavigationController = undefined;
      }
    }
  };
  if (record) {
    record.vehicleNavigationController = controller;
  }
  return controller;
}

const SHIP_CONTROL_KEYS = new Set([
  "KeyW",
  "KeyA",
  "KeyS",
  "KeyD",
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
  "Space"
]);

function shouldHandleShipKey(event) {
  if (!SHIP_CONTROL_KEYS.has(event.code)) {
    return false;
  }
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return true;
  }
  const tagName = target.tagName.toLowerCase();
  return tagName !== "input" && tagName !== "textarea" && tagName !== "select" && !target.isContentEditable;
}

function updateShipFlight(view, rootTransform, config, state, keysDown) {
  const now = performance.now();
  const dt = Math.max(0.001, Math.min(0.1, (now - state.lastTime) / 1000));
  state.lastTime = now;
  const worldUp = getWorldUp(view);
  const yawInput = getShipYawInput(state, keysDown, config);
  const pitchInput = (keysDown.has("ArrowUp") ? 1 : 0) - (keysDown.has("ArrowDown") ? 1 : 0);
  const yawRate = degreesToRadians(config.shipYawRateDegreesPerSecond ?? 82);
  const pitchRate = degreesToRadians(config.shipPitchRateDegreesPerSecond ?? 54);
  const maxPitch = degreesToRadians(config.maxShipPitchDegrees ?? 54);
  const minPitch = degreesToRadians(config.minShipPitchDegrees ?? -42);

  if (yawInput !== 0) {
    state.forward = rotateAroundAxis3(state.forward, worldUp, -yawInput * yawRate * dt);
  }
  state.right = basisFromForward(state.forward, worldUp, state.right).right;
  if (pitchInput !== 0) {
    state.forward = rotateAroundAxis3(state.forward, state.right, pitchInput * pitchRate * dt);
    state.forward = clampForwardPitch(state.forward, worldUp, minPitch, maxPitch);
  }
  const basis = basisFromForward(state.forward, worldUp, state.right);
  state.forward = basis.forward;
  state.right = basis.right;
  state.up = basis.up;

  const minSpeed = Number(config.minForwardSpeed ?? config.flightMinGlideSpeed ?? 18);
  const maxSpeed = Number(config.maxForwardSpeed ?? 135);
  const acceleration = Number(config.acceleration ?? 46);
  const brakeDeceleration = Number(config.brakeDeceleration ?? 42);
  const coastDeceleration = Number(config.coastDeceleration ?? 2.8);
  if (keysDown.has("KeyW")) {
    state.speed += acceleration * dt;
  } else if (keysDown.has("KeyS")) {
    state.speed -= brakeDeceleration * dt;
  } else {
    state.speed -= coastDeceleration * dt;
  }
  state.speed = clamp(state.speed, minSpeed, maxSpeed);
  state.position = add3(state.position, mul3(state.forward, state.speed * dt));
  const minAltitude = Number(config.minAltitude);
  if (Number.isFinite(minAltitude) && state.position[2] < minAltitude) {
    state.position[2] = minAltitude;
    state.forward = clampForwardPitch(state.forward, worldUp, 0, maxPitch);
  }

  const targetRoll = clamp(yawInput * degreesToRadians(config.maxVisualRollDegrees ?? 58), -degreesToRadians(config.maxVisualRollDegrees ?? 58), degreesToRadians(config.maxVisualRollDegrees ?? 58));
  const rollSmoothing = Math.max(0, Number(config.rollSmoothing ?? 10));
  const rollT = rollSmoothing === 0 ? 1 : 1 - Math.exp(-rollSmoothing * dt);
  state.roll += (targetRoll - state.roll) * rollT;
  const bankedRight = rotateAroundAxis3(state.right, state.forward, state.roll);
  const bankedUp = rotateAroundAxis3(state.up, state.forward, state.roll);
  rootTransform.matrix = buildVehicleMatrix({
    position: state.position,
    right: bankedRight,
    up: bankedUp,
    forward: state.forward,
    forwardAxis: config.forwardAxis || "-Z"
  });

  updateTrailingCamera(view, config, state, worldUp, dt);
  view.needsRender?.();
}

function getShipYawInput(state, keysDown, config) {
  const keyInput = (keysDown.has("KeyD") || keysDown.has("ArrowRight") ? 1 : 0) -
    (keysDown.has("KeyA") || keysDown.has("ArrowLeft") ? 1 : 0);
  if (!state.cursorActive) {
    return clamp(keyInput, -1, 1);
  }
  const deadZone = Number(config.cursorTurnDeadZone ?? 0.08);
  const cursor = Math.abs(state.cursorX) <= deadZone ? 0 : Math.sign(state.cursorX) * (Math.abs(state.cursorX) - deadZone) / (1 - deadZone);
  return clamp(keyInput + cursor * Number(config.cursorTurnResponse ?? 0.7), -1, 1);
}

function updateTrailingCamera(view, config, state, worldUp, dt) {
  const distance = Number(config.cameraDistance ?? 64);
  const height = Number(config.cameraHeight ?? 18);
  const lateralOffset = Number(config.cameraLateralOffset ?? 0);
  const lookAhead = Number(config.cameraLookAhead ?? 28);
  const lookHeight = Number(config.cameraLookHeight ?? 4);
  const desiredEye = add3(
    add3(
      add3(state.position, mul3(state.forward, -distance)),
      mul3(worldUp, height)
    ),
    mul3(state.right, lateralOffset)
  );
  const desiredLook = add3(
    add3(state.position, mul3(state.forward, lookAhead)),
    mul3(worldUp, lookHeight)
  );
  const eyeT = 1 - Math.exp(-Math.max(0, Number(config.cameraFollowSmoothing ?? 4.2)) * dt);
  const lookT = 1 - Math.exp(-Math.max(0, Number(config.cameraLookSmoothing ?? 7.5)) * dt);
  state.cameraEye = lerp3(state.cameraEye, desiredEye, eyeT);
  state.cameraLook = lerp3(state.cameraLook, desiredLook, lookT);
  view.camera.eye = state.cameraEye;
  view.camera.look = state.cameraLook;
  view.camera.up = worldUp;
}

function basisFromForward(forward, worldUp, fallbackRight = [1, 0, 0]) {
  const normalizedForward = safeNormalize(forward, [0, 1, 0]);
  const flatForward = flatDirection3(normalizedForward, worldUp);
  const right = safeNormalize(cross3(flatForward, worldUp), fallbackRight);
  const up = safeNormalize(cross3(right, normalizedForward), worldUp);
  return {
    forward: normalizedForward,
    right,
    up
  };
}

function clampForwardPitch(forward, worldUp, minPitch, maxPitch) {
  const pitch = Math.asin(clamp(dot3(normalize(forward), worldUp), -1, 1));
  const clampedPitch = clamp(pitch, minPitch, maxPitch);
  if (Math.abs(clampedPitch - pitch) < 0.0001) {
    return normalize(forward);
  }
  const flatForward = flatDirection3(forward, worldUp);
  return normalize(add3(mul3(flatForward, Math.cos(clampedPitch)), mul3(worldUp, Math.sin(clampedPitch))));
}

function buildVehicleMatrix({position, right, up, forward, forwardAxis}) {
  let localX = right;
  let localY = up;
  let localZ = mul3(forward, -1);
  if (forwardAxis === "Z" || forwardAxis === "+Z") {
    localZ = forward;
    localX = mul3(right, -1);
  } else if (forwardAxis === "X" || forwardAxis === "+X") {
    localX = forward;
    localZ = right;
  } else if (forwardAxis === "-X") {
    localX = mul3(forward, -1);
    localZ = mul3(right, -1);
  } else if (forwardAxis === "Y" || forwardAxis === "+Y") {
    localY = forward;
    localZ = up;
  } else if (forwardAxis === "-Y") {
    localY = mul3(forward, -1);
    localZ = mul3(up, -1);
  }
  return [
    localX[0], localX[1], localX[2], 0,
    localY[0], localY[1], localY[2], 0,
    localZ[0], localZ[1], localZ[2], 0,
    position[0], position[1], position[2], 1
  ];
}

function setupWindSound(view, enabled) {
  const toggle = document.getElementById("windSound");
  if (!enabled) {
    if (toggle) {
      toggle.closest("label")?.remove();
    }
    return;
  }

  const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextCtor) {
    if (toggle) {
      toggle.disabled = true;
    }
    return;
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
  const activeKeys = new Set();
  const movementKeys = new Set(["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Numpad8"]);

  const isEnabled = () => !toggle || toggle.checked;

  const start = async () => {
    if (!isEnabled()) {
      return;
    }
    ensureAudioGraph();
    if (context.state === "suspended") {
      await context.resume();
    }
    masterGain.gain.setTargetAtTime(0.48, context.currentTime, 0.12);
    if (!running) {
      running = true;
      lastTime = performance.now();
      lastEye = getCameraEye(view);
      animationFrame = window.requestAnimationFrame(updateSound);
    }
  };

  const mute = () => {
    if (masterGain && context) {
      masterGain.gain.setTargetAtTime(0, context.currentTime, 0.08);
    }
  };

  const onKeyDown = (event) => {
    activeKeys.add(event.code);
    start();
  };
  const onKeyUp = (event) => {
    activeKeys.delete(event.code);
  };
  const onPointerDown = () => {
    start();
  };

  document.addEventListener("keydown", onKeyDown, {capture: true});
  document.addEventListener("keyup", onKeyUp, {capture: true});
  document.addEventListener("pointerdown", onPointerDown, {capture: true, passive: true});
  window.addEventListener("blur", () => activeKeys.clear());

  if (toggle) {
    toggle.addEventListener("change", () => {
      if (toggle.checked) {
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
    masterGain = context.createGain();
    const compressor = context.createDynamicsCompressor();
    const noiseSource = context.createBufferSource();
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
    compressor.knee.value = 18;
    compressor.ratio.value = 3;
    compressor.attack.value = 0.018;
    compressor.release.value = 0.28;
    lowWindFilter.type = "lowpass";
    lowWindFilter.frequency.value = 420;
    lowWindFilter.Q.value = 0.45;
    highWindFilter.type = "bandpass";
    highWindFilter.frequency.value = 1250;
    highWindFilter.Q.value = 0.7;
    gustFilter.type = "bandpass";
    gustFilter.frequency.value = 260;
    gustFilter.Q.value = 0.8;

    noiseSource.buffer = createNoiseBuffer(context);
    noiseSource.loop = true;
    noiseSource.connect(lowWindFilter);
    noiseSource.connect(highWindFilter);
    noiseSource.connect(gustFilter);
    lowWindFilter.connect(lowWindGain);
    highWindFilter.connect(highWindGain);
    gustFilter.connect(gustGain);
    lowWindGain.connect(masterGain);
    highWindGain.connect(masterGain);
    gustGain.connect(masterGain);
    masterGain.connect(compressor);
    compressor.connect(context.destination);

    noiseSource.start();
  }

  function updateSound(now) {
    if (!running || !context) {
      return;
    }
    const eye = getCameraEye(view);
    const dt = Math.max(0.016, Math.min(0.25, (now - lastTime) / 1000));
    const cameraSpeed = distance3(eye, lastEye) / dt;
    smoothedSpeed += (cameraSpeed - smoothedSpeed) * 0.18;
    const speedNorm = clamp(smoothedSpeed / 95, 0, 1);
    const keyWind = [...activeKeys].some((code) => movementKeys.has(code)) ? 0.18 : 0;
    const targetIntensity = clamp(0.14 + speedNorm * 0.86 + keyWind, 0, 1);
    windIntensity += (targetIntensity - windIntensity) * 0.09;
    const idle = isEnabled() ? 1 : 0;
    const nowSeconds = context.currentTime;
    const gust = clamp(
      0.62 +
      Math.sin(nowSeconds * 0.38) * 0.22 +
      Math.sin(nowSeconds * 0.91 + 1.7) * 0.12 +
      Math.sin(nowSeconds * 2.14 + 0.4) * 0.045,
      0.18,
      1
    );
    const gustPressure = Math.max(0, gust - 0.46);
    lowWindFilter.frequency.setTargetAtTime(260 + windIntensity * 560 + gustPressure * 240, nowSeconds, 0.18);
    highWindFilter.frequency.setTargetAtTime(850 + windIntensity * 2500 + gustPressure * 420, nowSeconds, 0.16);
    gustFilter.frequency.setTargetAtTime(120 + gustPressure * 680 + windIntensity * 240, nowSeconds, 0.2);
    lowWindGain.gain.setTargetAtTime((0.018 + windIntensity * 0.07) * gust * idle + 0.0001, nowSeconds, 0.16);
    highWindGain.gain.setTargetAtTime((0.002 + Math.pow(windIntensity, 1.45) * 0.058) * gust * idle + 0.0001, nowSeconds, 0.12);
    gustGain.gain.setTargetAtTime((0.008 + windIntensity * 0.044) * gustPressure * idle + 0.0001, nowSeconds, 0.22);
    masterGain.gain.setTargetAtTime((0.34 + windIntensity * 0.26) * idle, nowSeconds, 0.12);

    lastTime = now;
    lastEye = eye;
    animationFrame = window.requestAnimationFrame(updateSound);
  }

  window.addEventListener("pagehide", () => {
    if (animationFrame) {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = 0;
    }
    if (context) {
      context.close();
      context = null;
    }
  });
}

function createNoiseBuffer(context) {
  const sampleCount = context.sampleRate * 2;
  const buffer = context.createBuffer(1, sampleCount, context.sampleRate);
  const data = buffer.getChannelData(0);
  let seed = 0x9e3779b9;
  for (let i = 0; i < sampleCount; i++) {
    seed = (1664525 * seed + 1013904223) >>> 0;
    data[i] = (seed / 0xffffffff) * 2 - 1;
  }
  return buffer;
}

function getCameraEye(view) {
  return Array.from(view.camera.eye || [0, 0, 0]);
}

function toVec3(value) {
  return [
    Number(value?.[0] || 0),
    Number(value?.[1] || 0),
    Number(value?.[2] || 0)
  ];
}

function identityMat4() {
  return [
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1
  ];
}

function add3(a, b) {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function sub3(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function mul3(v, scalar) {
  return [v[0] * scalar, v[1] * scalar, v[2] * scalar];
}

function cross3(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0]
  ];
}

function length3(v) {
  return Math.hypot(v[0], v[1], v[2]);
}

function dot3(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function normalize(v) {
  const len = length3(v);
  if (len === 0) {
    return [0, 0, 0];
  }
  return [v[0] / len, v[1] / len, v[2] / len];
}

function safeNormalize(v, fallback) {
  return length3(v) > 0.00001 ? normalize(v) : fallback;
}

function lerp3(a, b, t) {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t
  ];
}

function blendDirection3(a, b, t) {
  return safeNormalize(lerp3(a, b, clamp(t, 0, 1)), b);
}

function flatDirection3(direction, worldUp) {
  const flat = sub3(direction, mul3(worldUp, dot3(direction, worldUp)));
  return safeNormalize(flat, [1, 0, 0]);
}

function signedAngleAroundAxis(from, to, axis) {
  const cross = cross3(from, to);
  return Math.atan2(dot3(cross, axis), clamp(dot3(from, to), -1, 1));
}

function rotateAroundAxis3(v, axis, radians) {
  const normalizedAxis = normalize(axis);
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const axisDot = dot3(normalizedAxis, v);
  return add3(
    add3(mul3(v, cos), mul3(cross3(normalizedAxis, v), sin)),
    mul3(normalizedAxis, axisDot * (1 - cos))
  );
}

function degreesToRadians(degrees) {
  return degrees * Math.PI / 180;
}

function getWorldUp(view) {
  return normalize(Array.from(view.viewer.scene.coordinateSystem.worldUp || [0, 0, 1]));
}

function distance3(a, b) {
  return Math.hypot((a[0] || 0) - (b[0] || 0), (a[1] || 0) - (b[1] || 0), (a[2] || 0) - (b[2] || 0));
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

async function fetchStreamingIndex(url) {
  const runtimeIndex = await fetchJSON(url);
  const result = xeokit.formats.xgfstream.readXGFStreamingRuntimeIndex(runtimeIndex);
  if (!result.ok) {
    throw new Error(result.error);
  }
  return resolveIndexRelativeChunkUris(result.value, url);
}

function resolveIndexRelativeChunkUris(index, indexUrl) {
  const baseUrl = new URL(".", new URL(indexUrl, window.location.href)).href;
  const resolveChunk = (manifest) => ({
    ...manifest,
    uri: resolveUri(manifest.uri, baseUrl),
    dependencies: {
      ...manifest.dependencies,
      chunks: (manifest.dependencies?.chunks || []).map((dependency) => ({
        ...dependency,
        uri: resolveUri(dependency.uri, baseUrl)
      }))
    }
  });
  return {
    ...index,
    chunks: (index.chunks || []).map(resolveChunk)
  };
}

function resolveUri(uri, baseUrl) {
  if (!uri || /^[a-z]+:/i.test(uri)) {
    return uri;
  }
  return new URL(uri, baseUrl).href;
}

function setStats(manifest, report) {
  document.getElementById("profileName").textContent = report?.profileName || manifest.profile?.name || "profile";
  document.getElementById("profileSeed").textContent = manifest.seed ?? "-";
  document.getElementById("statBuildings").textContent = formatNumber(manifest.stats.buildings);
  document.getElementById("statBlocks").textContent = formatNumber(manifest.stats.blocks || manifest.blocks?.length || 0);
  document.getElementById("statRoads").textContent = formatNumber(manifest.stats.roads);
  document.getElementById("statTriangles").textContent = formatNumber(manifest.stats.triangles);
}

function renderStreamProgress(streamController) {
  const loaded = streamController.loadedChunkIds.size;
  const total = streamController.chunkManifests.length;
  document.getElementById("loadedChunks").textContent = `${formatNumber(loaded)}/${formatNumber(total)}`;
  document.getElementById("loadedObjects").textContent = formatNumber(streamController.loadedTotals.objects);
  const progress = document.getElementById("chunkProgress");
  progress.max = Math.max(total, 1);
  progress.value = loaded;
}

function setReport(report) {
  const rows = document.getElementById("reportRows");
  if (!report?.metrics?.length) {
    rows.innerHTML = `<tr><td colspan="3">No report loaded.</td></tr>`;
    return;
  }
  rows.innerHTML = report.metrics.map((metric) => `
    <tr class="${metric.ok ? "" : "warn"}">
      <td>${escapeHTML(metric.label)}</td>
      <td>${formatMetric(metric.source, metric.unit)}</td>
      <td>${formatMetric(metric.generated, metric.unit)}</td>
    </tr>
  `).join("");
}

function setPatterns(manifest) {
  const rows = document.getElementById("patternRows");
  if (!rows) {
    return;
  }
  const summary = manifest.metadata?.["urban-context"]?.patternSummary || {};
  const entries = Object.entries(summary)
    .map(([id, weight]) => ({id, weight: Number(weight)}))
    .filter((entry) => Number.isFinite(entry.weight) && entry.weight > 0)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 10);
  if (!entries.length) {
    rows.innerHTML = `<tr><td colspan="2">No pattern summary loaded.</td></tr>`;
    return;
  }
  rows.innerHTML = entries.map((entry) => `
    <tr>
      <td>${escapeHTML(entry.id.replace(/^[^.]+\\./, ""))}</td>
      <td>${entry.weight.toFixed(2)}</td>
    </tr>
  `).join("");
}

function setEvaluation(report, manifest) {
  const enabled = new URLSearchParams(window.location.search).get("evaluation") === "1";
  const section = document.getElementById("evaluationSection");
  const rows = document.getElementById("evaluationRows");
  if (!section || !rows || !enabled) {
    return;
  }
  section.style.display = "block";
  const summary = report?.evaluationSummary || manifest.evaluation || manifest.metadata?.["urban-evaluation"];
  const stages = summary?.byStage || {};
  const entries = Object.entries(stages)
    .map(([stage, data]) => ({stage, data}))
    .sort((a, b) => a.stage.localeCompare(b.stage));
  if (!entries.length) {
    rows.innerHTML = `<tr><td colspan="3">No evaluation loaded.</td></tr>`;
    return;
  }
  rows.innerHTML = entries.map(({stage, data}) => `
    <tr>
      <td>${escapeHTML(stage)}</td>
      <td>${formatMetric(data.averageScore)}</td>
      <td>${formatMetric(data.minimumScore)}</td>
    </tr>
  `).join("");
}

function indexObjectsByLayer(manifest) {
  const byLayer = {};
  for (const object of manifest.objects) {
    if (!byLayer[object.layerId]) {
      byLayer[object.layerId] = [];
    }
    byLayer[object.layerId].push(object.id);
  }
  return byLayer;
}

function applyCamera(view, name) {
  const preset = CAMERA_PRESETS[name] || CAMERA_PRESETS.aerial;
  applyCameraParams(view, preset);
}

function applyCameraParams(view, preset) {
  view.camera.eye = preset.eye;
  view.camera.look = preset.look;
  view.camera.up = preset.up;
  if (preset.fov) {
    view.camera.perspectiveProjection.fov = preset.fov;
  }
}

function bindCameraStreaming(studio, view, streamController) {
  const onCamera = (camera) => {
    if (camera && camera !== view.camera) {
      return;
    }
    streamController.schedule("Camera changed");
  };
  studio.viewer.events.onCameraViewMatrixUpdated.subscribe(onCamera);
  studio.viewer.events.onCameraProjMatrixUpdated.subscribe(onCamera);
}

function applyActiveDisplay(view, manifest, byLayer) {
  applyLayerVisibility(view, byLayer);
  applyColorMode(view, manifest, document.getElementById("colorMode").value);
}

function applyLayerVisibility(view, byLayer) {
  document.querySelectorAll("[data-layer]").forEach((input) => {
    view.setObjectsVisible(byLayer[input.dataset.layer] || [], input.checked);
  });
}

function applyColorMode(view, manifest, mode) {
  const buildingIds = manifest.objects
    .filter((object) => object.type === "Building")
    .map((object) => object.id);
  view.setObjectsColorized(buildingIds, null);
  if (mode === "materials") {
    return;
  }
  for (const id of buildingIds) {
    const data = manifest.metadata[id];
    if (!data) {
      continue;
    }
    if (mode === "height") {
      const t = Math.min(1, Math.max(0, Number(data.height || 0) / 150));
      view.setObjectsColorized([id], [0.28 + t * 0.72, 0.55 - t * 0.18, 0.38 + t * 0.36]);
    } else if (mode === "block") {
      view.setObjectsColorized([id], hashColor(String(data.blockId || id)));
    } else if (mode === "landUse") {
      view.setObjectsColorized([id], LAND_USE_COLORS[data.usage] || DISTRICT_COLORS[data.district] || [0.72, 0.72, 0.68]);
    } else if (mode === "centerDistance") {
      const center = Array.isArray(data.center) ? data.center : [0, 0];
      const t = Math.min(1, Math.hypot(Number(center[0] || 0), Number(center[1] || 0)) / 620);
      view.setObjectsColorized([id], [0.24 + t * 0.56, 0.64 - t * 0.36, 0.74 - t * 0.44]);
    }
  }
}

async function fetchJSON(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} fetching ${url}`);
  }
  return response.json();
}

async function fetchArrayBuffer(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} fetching ${url}`);
  }
  return response.arrayBuffer();
}

function initialReady(progress, studio, status, panel) {
  if (initialReady.done || !progress || progress.queued <= 0 || progress.loaded < progress.queued) {
    return;
  }
  initialReady.done = true;
  status.style.display = "none";
  panel.style.display = "block";
  signalReady();
  studio.finished();
}

async function fetchJSONOptional(url) {
  const response = await fetch(url);
  if (!response.ok) {
    return null;
  }
  return response.json();
}

function must(result) {
  if (!result.ok) {
    throw new Error(result.error);
  }
  return result.value;
}

function formatNumber(value) {
  return new Intl.NumberFormat().format(value);
}

function formatMetric(value, unit) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) {
    return "n/a";
  }
  const numeric = Number(value);
  if (unit) {
    return `${Math.round(numeric).toLocaleString()} ${unit}`;
  }
  return numeric < 1 ? numeric.toFixed(2) : numeric.toFixed(1).replace(/\.0$/, "");
}

function hashColor(value) {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0;
  }
  const hue = Math.abs(hash % 360);
  return hslToRgb(hue / 360, 0.42, 0.56);
}

function hslToRgb(h, s, l) {
  const hueToRgb = (p, q, t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [hueToRgb(p, q, h + 1 / 3), hueToRgb(p, q, h), hueToRgb(p, q, h - 1 / 3)];
}

function escapeHTML(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function signalReady() {
  if (document.getElementById("ExampleLoaded")) {
    return;
  }
  const marker = document.createElement("div");
  marker.id = "ExampleLoaded";
  marker.hidden = true;
  document.body.appendChild(marker);
}
