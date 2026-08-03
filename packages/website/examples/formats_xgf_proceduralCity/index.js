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
const RENDER_MODE_NAMES = {
  navigation: xeokit.base.constants.NavigationRender,
  detailed: xeokit.base.constants.DetailedRender,
  realistic: xeokit.base.constants.RealisticRender
};
const DEFAULT_RENDER_MODE = RENDER_MODE_NAMES.detailed;

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
    renderMode: DEFAULT_RENDER_MODE,
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
  const renderModeSelect = ensureRenderModeControl();
  renderModeSelect.value = nameForRenderMode(view.renderMode);
  renderModeSelect.addEventListener("change", (event) => {
    view.renderMode = renderModeFor(event.target.value);
    view.needsRender?.();
  });

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

function ensureRenderModeControl() {
  let select = document.getElementById("renderMode");
  if (select) {
    return select;
  }
  const section = document.createElement("div");
  section.className = "section";
  section.innerHTML = `
    <label>Render mode
      <select id="renderMode">
        <option value="navigation">Navigation</option>
        <option value="detailed" selected>Detailed</option>
        <option value="realistic">Realistic</option>
      </select>
    </label>`;
  const colorSection = document.getElementById("colorMode")?.closest(".section");
  if (colorSection?.parentElement) {
    colorSection.parentElement.insertBefore(section, colorSection);
  } else {
    document.getElementById("panel")?.appendChild(section);
  }
  select = document.getElementById("renderMode");
  if (!select) {
    throw new Error("Failed to create render mode selector");
  }
  return select;
}

function renderModeFor(name) {
  return RENDER_MODE_NAMES[name] ?? RENDER_MODE_NAMES.detailed;
}

function nameForRenderMode(mode) {
  for (const [name, value] of Object.entries(RENDER_MODE_NAMES)) {
    if (mode === value) {
      return name;
    }
  }
  return "detailed";
}

async function setupVehicleChase({studio, scene, view, config}) {
  const modelUrl = config.modelUrl;
  if (!modelUrl) {
    return null;
  }

  const modelId = config.modelId || `${MODEL_ID}Vehicle`;
  const vehicleCoordinateSystem = config.coordinateSystem || {
    basis: [1, 0, 0, 0, 0, 1, 0, 1, 0],
    origin: [0, 0, 0],
    units: "meters",
    scaleToMeters: 1
  };
  const rootTransformId = "vehicleRoot";
  const contentTransformId = "vehicleContent";
  const sceneModel = must(scene.createModel({
    id: modelId,
    updateHint: "dynamic",
    coordinateSystem: vehicleCoordinateSystem
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
  sceneModel.updateHint = "dynamic";

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

  const exhaust = setupVehicleExhaust({
    scene,
    modelId,
    coordinateSystem: vehicleCoordinateSystem,
    config
  });

  const objectIds = Object.keys(sceneModel.objects);
  if (objectIds.length) {
    view.setObjectsPickable(objectIds, false);
  }
  if (exhaust?.trailObjectIds?.length) {
    view.setObjectsPickable(exhaust.trailObjectIds, false);
  }

  const shipController = createVehicleNavigationShipController({studio, view, rootTransform, exhaust, config});
  shipController.update();

  window.__proceduralCityVehicle = {
    ready: true,
    modelId,
    view,
    sceneModel,
    vehicleSceneModel: sceneModel,
    vehicleUpdateHint: sceneModel.updateHint,
    exhaustSceneModel: exhaust?.sceneModel || null,
    exhaustUpdateHint: exhaust?.sceneModel?.updateHint || null,
    rootTransform,
    exhaust,
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

function setupVehicleExhaust({scene, modelId, coordinateSystem, config}) {
  const exhaustConfig = typeof config.exhaustPlume === "object" && config.exhaustPlume
    ? config.exhaustPlume
    : (config.exhaust || null);
  if (!exhaustConfig && config.exhaustPlume !== true) {
    return null;
  }

  const exhaustModelId = exhaustConfig?.modelId || `${modelId}Exhaust`;
  const sceneModel = must(scene.createModel({
    id: exhaustModelId,
    updateHint: "dynamic",
    coordinateSystem
  }));
  const forwardAxis = config.forwardAxis || "-Z";
  const offset = Array.isArray(exhaustConfig?.offset)
    ? toVec3(exhaustConfig.offset)
    : [0, 0, 0];
  const radialSegments = Math.max(5, Math.floor(Number(exhaustConfig?.radialSegments ?? 8)));
  const baseRadius = Number(exhaustConfig?.radius ?? 1.2);
  const wander = Number(exhaustConfig?.wander ?? 1.4);
  const trailSegments = Math.max(10, Math.floor(Number(exhaustConfig?.trailSegments ?? 22)));
  const trailLength = Number(exhaustConfig?.trailLength ?? 36);
  const trailOpacity = Number(exhaustConfig?.trailOpacity ?? 0.16);
  const trailExpansion = Number(exhaustConfig?.trailExpansion ?? 1.35);
  const trailAdvection = clamp(Number(exhaustConfig?.trailAdvection ?? 0.68), 0, 0.98);
  const trailTether = Math.max(0, Number(exhaustConfig?.trailTether ?? 1.35));

  const trailGeometry = xeokit.model.scene.compressGeometryParams({
    id: "vehicleExhaustTrailGeometry",
    primitive: xeokit.base.constants.TrianglesPrimitive,
    ...createTrailSegmentGeometry(radialSegments)
  });
  trailGeometry.edgeIndices = undefined;
  must(sceneModel.createGeometryCompressed(trailGeometry));

  const trailTransforms = [];
  const trailObjectIds = [];
  for (let i = 0; i < trailSegments; i++) {
    const t = trailSegments <= 1 ? 0 : i / (trailSegments - 1);
    const materialId = `vehicleExhaustTrailMaterial_${i}`;
    const transformId = `vehicleExhaustTrailTransform_${i}`;
    const meshId = `vehicleExhaustTrailMesh_${i}`;
    const objectId = `vehicleExhaustTrail_${i}`;
    const warm = Math.max(0, 1 - t * 1.35);
    const cool = 1 - warm;
    must(sceneModel.createMaterial({
      id: materialId,
      color: [
        1.0 * warm + 0.50 * cool,
        0.34 * warm + 0.72 * cool,
        0.08 * warm + 0.96 * cool
      ],
      emissiveColor: [
        0.64 * warm + 0.04 * cool,
        0.18 * warm + 0.08 * cool,
        0.02 * warm + 0.16 * cool
      ],
      opacity: Math.max(0.015, trailOpacity * Math.pow(1 - t, 1.25)),
      alphaMode: "BLEND",
      roughness: 0.32,
      metallic: 0
    }));
    const transform = must(sceneModel.createTransform({
      id: transformId,
      matrix: hiddenExhaustMatrix()
    }));
    must(sceneModel.createMesh({
      id: meshId,
      geometryId: "vehicleExhaustTrailGeometry",
      materialId,
      parentTransformId: transformId
    }));
    must(sceneModel.createObject({
      id: objectId,
      meshIds: [meshId],
      clippable: false
    }));
    trailTransforms.push(transform);
    trailObjectIds.push(objectId);
  }

  return {
    sceneModel,
    trailTransforms,
    trailObjectIds,
    history: [],
    distanceSinceEmit: 0,
    lastEmitter: null,
    lastEmissionPosition: null,
    offset,
    axis: forwardAxis,
    trailSegments,
    segmentSpacing: trailLength / trailSegments,
    trailAdvection,
    trailTether,
    radius: baseRadius,
    trailExpansion,
    wander,
    maxForwardSpeed: Number(config.maxForwardSpeed ?? 135),
    pulsePhase: 0,
    sampleSerial: 0
  };
}

function createTrailSegmentGeometry(radialSegments) {
  const positions = [];
  const normals = [];
  const indices = [];
  const rings = [
    {y: 0, radius: 0.88},
    {y: 1.0, radius: 1.0}
  ];
  for (const ring of rings) {
    for (let j = 0; j < radialSegments; j++) {
      const angle = (j / radialSegments) * Math.PI * 2;
      const x = Math.cos(angle);
      const z = Math.sin(angle);
      positions.push(x * ring.radius, ring.y, z * ring.radius);
      normals.push(x, 0, z);
    }
  }
  for (let i = 0; i < rings.length - 1; i++) {
    const ring = i * radialSegments;
    const nextRing = (i + 1) * radialSegments;
    for (let j = 0; j < radialSegments; j++) {
      const nextJ = (j + 1) % radialSegments;
      const a = ring + j;
      const b = ring + nextJ;
      const c = nextRing + j;
      const d = nextRing + nextJ;
      indices.push(a, c, b, b, c, d);
    }
  }
  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    indices: new Uint32Array(indices)
  };
}

function hiddenExhaustMatrix() {
  return [
    0.0001, 0, 0, 0,
    0, 0.0001, 0, 0,
    0, 0, 0.0001, 0,
    0, 0, -100000, 1
  ];
}

function updateVehicleExhaust(exhaust, config, sdkController, state, dt) {
  if (!exhaust) {
    return;
  }
  const maxForwardSpeed = Math.max(1, Number(config.maxForwardSpeed ?? exhaust.maxForwardSpeed ?? 135));
  const speed = Math.max(0, Number(sdkController?.speed ?? config.startSpeed ?? 0));
  const speedRatio = clamp(speed / maxForwardSpeed, 0, 1);
  exhaust.pulsePhase += dt * (0.75 + speedRatio * 1.35);
  updateVehicleExhaustTrail(exhaust, state, speedRatio, dt);
}

function updateVehicleExhaustTrail(exhaust, state, speedRatio, dt) {
  if (!exhaust.trailTransforms?.length || !state) {
    return;
  }

  const emitter = vehicleLocalPointToWorld(exhaust.offset, state, exhaust.axis);
  const emitterDelta = exhaust.lastEmitter ? sub3(emitter, exhaust.lastEmitter) : [0, 0, 0];
  const frameTravel = exhaust.lastEmitter ? length3(emitterDelta) : exhaust.segmentSpacing;
  exhaust.distanceSinceEmit += frameTravel;

  if (exhaust.history.length === 0) {
    seedExhaustTrail(exhaust, state, emitter);
  } else {
    const carried = mul3(emitterDelta, exhaust.trailAdvection);
    const tetherT = 1 - Math.exp(-exhaust.trailTether * dt);
    for (let i = 0; i < exhaust.history.length; i++) {
      const sample = exhaust.history[i];
      sample.position = add3(sample.position, carried);
      const target = add3(emitter, mul3(state.forward, -exhaust.segmentSpacing * (i + 1)));
      sample.position = lerp3(sample.position, target, tetherT);
    }
    let emissionCursor = exhaust.lastEmissionPosition || exhaust.lastEmitter || emitter;
    let pending = sub3(emitter, emissionCursor);
    let pendingDistance = length3(pending);
    let emitted = 0;
    while (pendingDistance >= exhaust.segmentSpacing && emitted < exhaust.trailSegments) {
      const direction = mul3(pending, 1 / pendingDistance);
      emissionCursor = add3(emissionCursor, mul3(direction, exhaust.segmentSpacing));
      exhaust.history.unshift(createExhaustSample(emissionCursor, state, exhaust.sampleSerial++, direction));
      pending = sub3(emitter, emissionCursor);
      pendingDistance = length3(pending);
      emitted++;
    }
    if (emitted > 0) {
      exhaust.history.length = Math.min(exhaust.history.length, exhaust.trailSegments);
      exhaust.lastEmissionPosition = emissionCursor;
      exhaust.distanceSinceEmit = pendingDistance;
    }
  }
  exhaust.lastEmitter = emitter;

  for (const sample of exhaust.history) {
    sample.age += dt;
  }

  const samples = [createExhaustSample(emitter, state, exhaust.sampleSerial), ...exhaust.history];
  while (samples.length <= exhaust.trailSegments) {
    const lastSample = samples[samples.length - 1] || samples[0];
    const nextForward = lastSample.forward || state.forward;
    const nextPosition = add3(lastSample.position, mul3(nextForward, -exhaust.segmentSpacing));
    samples.push({
      position: nextPosition,
      side: lastSample.side,
      lift: lastSample.lift,
      forward: nextForward,
      phase: lastSample.phase + 0.83,
      age: lastSample.age + 0.08
    });
  }

  const displayPoints = samples.map((sample, index) => exhaustSampleDisplayPosition(exhaust, sample, index, speedRatio));
  const radiusBoost = 0.84 + speedRatio * 0.55;
  for (let i = 0; i < exhaust.trailTransforms.length; i++) {
    const start = displayPoints[i];
    const end = displayPoints[i + 1];
    const t = exhaust.trailTransforms.length <= 1 ? 0 : i / (exhaust.trailTransforms.length - 1);
    const radius = exhaust.radius * radiusBoost * (0.34 + Math.pow(t, 0.82) * exhaust.trailExpansion);
    exhaust.trailTransforms[i].matrix = segmentMatrixBetween(start, end, radius, samples[i]?.lift || state.up, samples[i]?.side || state.right);
  }
}

function seedExhaustTrail(exhaust, state, emitter) {
  exhaust.history.length = 0;
  for (let i = 1; i <= exhaust.trailSegments; i++) {
    const position = add3(emitter, mul3(state.forward, -exhaust.segmentSpacing * i));
    const sample = createExhaustSample(position, state, exhaust.sampleSerial++);
    sample.age = i * 0.045;
    exhaust.history.push(sample);
  }
  exhaust.distanceSinceEmit = 0;
  exhaust.lastEmissionPosition = emitter;
}

function createExhaustSample(position, state, serial, forwardOverride = null) {
  const basis = forwardOverride
    ? basisFromForward(forwardOverride, state.up, state.right)
    : state;
  return {
    position,
    side: basis.right,
    lift: basis.up,
    forward: basis.forward,
    phase: serial * 0.73,
    age: 0
  };
}

function exhaustSampleDisplayPosition(exhaust, sample, index, speedRatio) {
  const t = exhaust.trailSegments <= 0 ? 0 : index / exhaust.trailSegments;
  const curl = exhaust.wander * Math.pow(t, 1.15) * (0.035 + speedRatio * 0.13);
  const phase = sample.phase + sample.age * 0.62 + exhaust.pulsePhase * 0.16;
  return add3(
    add3(sample.position, mul3(sample.side, Math.sin(phase + t * 3.8) * curl)),
    mul3(sample.lift, Math.sin(phase * 1.22 + t * 4.2) * curl * 0.08)
  );
}

function vehicleLocalPointToWorld(localPoint, state, forwardAxis) {
  const axes = vehicleLocalAxes(state.right, state.up, state.forward, forwardAxis);
  return add3(
    add3(
      add3(state.position, mul3(axes.localX, localPoint[0])),
      mul3(axes.localY, localPoint[1])
    ),
    mul3(axes.localZ, localPoint[2])
  );
}

function segmentMatrixBetween(start, end, radius, fallbackUp, fallbackRight) {
  const axis = sub3(end, start);
  const length = Math.max(0.001, length3(axis));
  const yAxis = safeNormalize(axis, [0, 1, 0]);
  let xAxis = cross3(yAxis, fallbackUp);
  if (length3(xAxis) < 0.0001) {
    xAxis = cross3(yAxis, fallbackRight);
  }
  xAxis = safeNormalize(xAxis, [1, 0, 0]);
  const zAxis = safeNormalize(cross3(xAxis, yAxis), [0, 0, 1]);
  return [
    xAxis[0] * radius, xAxis[1] * radius, xAxis[2] * radius, 0,
    yAxis[0] * length, yAxis[1] * length, yAxis[2] * length, 0,
    zAxis[0] * radius, zAxis[1] * radius, zAxis[2] * radius, 0,
    start[0], start[1], start[2], 1
  ];
}

function createVehicleNavigationShipController({studio, view, rootTransform, exhaust, config}) {
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
    cameraEye: initialEye,
    cameraLook: initialLook,
    lastTime: performance.now()
  };
  const vehicleCamera = {
    eye: initialPosition,
    look: add3(initialPosition, state.forward),
    up: worldUp,
    perspectiveProjection: view.camera.perspectiveProjection
  };
  const vehicleView = {
    id: `${view.id}:vehicle-proxy`,
    htmlElement: view.htmlElement,
    camera: vehicleCamera,
    objects: view.objects,
    viewer: view.viewer,
    needsRender: () => view.needsRender?.()
  };
  const record = studio.viewManager.views?.[view.id];
  if (record?.vehicleNavigationController?.destroy) {
    record.vehicleNavigationController.destroy();
  }
  const VehicleNavigationController = xeokit.viewing?.vehicleNavigation?.VehicleNavigationController;
  if (!VehicleNavigationController) {
    throw new Error("VehicleNavigationController is unavailable in the xeokit bundle");
  }

  const maxForwardSpeed = Number(config.maxForwardSpeed ?? 135);
  const collisionObjectFilter = (objectId) => !isVehicleObjectId(objectId, config.modelId);
  const sdkController = new VehicleNavigationController(vehicleView, {
    active: true,
    keyboardEnabledOnlyOnMouseover: false,
    suspendViewController: record?.viewController,
    collision: config.collision ?? true,
    gravity: config.gravity ?? false,
    cameraHeight: 0.01,
    bodyRadius: Number(config.bodyRadius ?? 0.45),
    maxForwardSpeed,
    maxReverseSpeed: Number(config.maxReverseSpeed ?? 10),
    acceleration: Number(config.acceleration ?? 46),
    brakeDeceleration: Number(config.brakeDeceleration ?? 42),
    coastDeceleration: Number(config.coastDeceleration ?? 2.8),
    turnRateDegreesPerSecond: Number(config.shipYawRateDegreesPerSecond ?? config.turnRateDegreesPerSecond ?? 82),
    keySteerInitialScale: Number(config.shipKeyYawInitialScale ?? config.keySteerInitialScale ?? 0.28),
    keySteerRampSeconds: Number(config.shipKeyYawRampSeconds ?? config.keySteerRampSeconds ?? 1.45),
    leanDegrees: Number(config.maxVisualRollDegrees ?? config.leanDegrees ?? 58),
    leanSmoothing: Number(config.rollSmoothing ?? config.leanSmoothing ?? 10),
    maxPitchDegrees: maxAbsolutePitchDegrees(config),
    maxFlightPitchDegrees: maxAbsolutePitchDegrees(config),
    flightTakeoffHeight: Number(config.flightTakeoffHeight ?? 0),
    flightTakeoffSpeed: Number(config.flightTakeoffSpeed ?? 12),
    flightLandingFallSpeed: Number(config.flightLandingFallSpeed ?? 12),
    flightAcceleration: Number(config.flightAcceleration ?? config.acceleration ?? 46),
    flightBrakeDeceleration: Number(config.flightBrakeDeceleration ?? config.brakeDeceleration ?? 42),
    flightMinGlideSpeed: Number(config.flightMinGlideSpeed ?? config.minForwardSpeed ?? 18),
    flightAirDrag: Number(config.flightAirDrag ?? (Number(config.coastDeceleration ?? 2.8) / Math.max(maxForwardSpeed, 1))),
    flightGravity: Number(config.flightGravity ?? 0),
    flightSoftLandingRange: Number(config.flightSoftLandingRange ?? 0.75),
    flightPitchRateDegreesPerSecond: Number(config.shipPitchRateDegreesPerSecond ?? config.flightPitchRateDegreesPerSecond ?? 54),
    flightSteeringResponse: Number(config.flightSteeringResponse ?? 4.6),
    mouseDragYawSensitivity: Number(config.shipMouseDragYawSensitivity ?? config.mouseDragYawSensitivity ?? config.shipMouseDragSensitivity ?? 0.0028),
    mouseDragPitchSensitivity: Number(config.shipMouseDragPitchSensitivity ?? config.mouseDragPitchSensitivity ?? config.shipMouseDragSensitivity ?? 0.0028),
    mouseDragResponse: Number(config.shipMouseDragResponse ?? config.mouseDragResponse ?? 7.5),
    maxMouseDragInputPerFrame: Number(config.maxShipMouseDragInputPerFrame ?? config.maxMouseDragInputPerFrame ?? 0.65),
    obstacleFilter: collisionObjectFilter,
    driveSurfaceFilter: collisionObjectFilter
  });
  sdkController.speed = clamp(Number(config.startSpeed ?? 34), 0, maxForwardSpeed);
  if (config.startFlying !== false) {
    sdkController.flying = true;
  }

  let animationFrame = 0;
  let task = null;
  let destroyed = false;
  const update = () => {
    if (!destroyed) {
      const dt = updateShipFromVehicleNavigation(view, rootTransform, config, state, vehicleCamera);
      updateVehicleExhaust(exhaust, config, sdkController, state, dt);
    }
  };
  const SDKTask = xeokit.base?.core?.SDKTask;
  if (SDKTask) {
    task = new SDKTask({
      name: "ProceduralCityVehicleChase",
      stage: SDKTask.AnimateStage,
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

  const controller = {
    type: "vehicle-navigation-ship",
    state,
    sdkController,
    vehicleView,
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
      sdkController.destroy();
      if (record?.vehicleNavigationController === sdkController) {
        record.vehicleNavigationController = undefined;
      }
    }
  };
  if (record) {
    record.vehicleNavigationController = sdkController;
  }
  return controller;
}

function isVehicleObjectId(objectId, modelId) {
  if (!objectId || !modelId) {
    return false;
  }
  const id = String(objectId);
  const model = String(modelId);
  return id === model ||
    id.startsWith(`${model}__`) ||
    id.startsWith(`${model}/`) ||
    id.startsWith("vehicleExhaust") ||
    id.includes("__vehicleExhaust") ||
    id.includes(".vehicleExhaust");
}

function updateShipFromVehicleNavigation(view, rootTransform, config, state, vehicleCamera) {
  const now = performance.now();
  const dt = Math.max(0.001, Math.min(0.1, (now - state.lastTime) / 1000));
  state.lastTime = now;
  const worldUp = getWorldUp(view);

  let position = toVec3(vehicleCamera.eye);
  let forward = safeNormalize(sub3(toVec3(vehicleCamera.look), position), state.forward);
  const minAltitude = Number(config.minAltitude ?? 0);
  if (Number.isFinite(minAltitude)) {
    const altitude = dot3(position, worldUp);
    if (altitude < minAltitude) {
      position = add3(position, mul3(worldUp, minAltitude - altitude));
      if (dot3(forward, worldUp) < 0) {
        forward = flatDirection3(forward, worldUp);
      }
      vehicleCamera.eye = position;
      vehicleCamera.look = add3(position, forward);
    }
  }

  const cameraUp = safeNormalize(toVec3(vehicleCamera.up), worldUp);
  const right = safeNormalize(cross3(forward, cameraUp), state.right);
  const shipUp = safeNormalize(cross3(right, forward), cameraUp);
  state.position = position;
  state.forward = forward;
  state.right = right;
  state.up = shipUp;

  rootTransform.matrix = buildVehicleMatrix({
    position: state.position,
    right,
    up: shipUp,
    forward: state.forward,
    forwardAxis: config.forwardAxis || "-Z"
  });

  updateTrailingCamera(view, config, state, worldUp, dt);
  view.needsRender?.();
  return dt;
}

function maxAbsolutePitchDegrees(config) {
  return Math.max(
    Math.abs(Number(config.minShipPitchDegrees ?? -42)),
    Math.abs(Number(config.maxShipPitchDegrees ?? 54))
  );
}

function updateTrailingCamera(view, config, state, worldUp, dt) {
  const distance = Number(config.cameraDistance ?? 64);
  const height = Number(config.cameraHeight ?? 18);
  const lateralOffset = Number(config.cameraLateralOffset ?? 0);
  const lookAhead = Number(config.cameraLookAhead ?? 28);
  const lookHeight = Number(config.cameraLookHeight ?? 4);
  let desiredEye = add3(
    add3(
      add3(state.position, mul3(state.forward, -distance)),
      mul3(worldUp, height)
    ),
    mul3(state.right, lateralOffset)
  );
  const cameraTrailFollow = clamp(Number(config.cameraTrailFollow ?? 0), 0, 1);
  if (cameraTrailFollow > 0) {
    const exhaustConfig = typeof config.exhaustPlume === "object" && config.exhaustPlume
      ? config.exhaustPlume
      : (config.exhaust || null);
    const exhaustOffset = Array.isArray(exhaustConfig?.offset)
      ? toVec3(exhaustConfig.offset)
      : [0, 0, 0];
    const trailHeight = Number(config.cameraTrailHeight ?? Math.max(0, height * 0.25));
    const exhaustPoint = vehicleLocalPointToWorld(exhaustOffset, state, config.forwardAxis || "-Z");
    const trailEye = add3(
      add3(
        add3(exhaustPoint, mul3(state.forward, -distance)),
        mul3(state.up, trailHeight)
      ),
      mul3(state.right, lateralOffset)
    );
    desiredEye = lerp3(desiredEye, trailEye, cameraTrailFollow);
  }
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

function buildVehicleMatrix({position, right, up, forward, forwardAxis}) {
  const {localX, localY, localZ} = vehicleLocalAxes(right, up, forward, forwardAxis);
  return [
    localX[0], localX[1], localX[2], 0,
    localY[0], localY[1], localY[2], 0,
    localZ[0], localZ[1], localZ[2], 0,
    position[0], position[1], position[2], 1
  ];
}

function vehicleLocalAxes(right, up, forward, forwardAxis) {
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
  return {localX, localY, localZ};
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
  let turbineOsc = null;
  let compressorOsc = null;
  let turbineGain = null;
  let compressorGain = null;
  let turbineFilter = null;
  let compressorFilter = null;
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
    turbineOsc = context.createOscillator();
    compressorOsc = context.createOscillator();
    turbineGain = context.createGain();
    compressorGain = context.createGain();
    turbineFilter = context.createBiquadFilter();
    compressorFilter = context.createBiquadFilter();

    masterGain.gain.value = 0;
    lowWindGain.gain.value = 0.0001;
    highWindGain.gain.value = 0.0001;
    gustGain.gain.value = 0.0001;
    turbineGain.gain.value = 0.0001;
    compressorGain.gain.value = 0.0001;
    compressor.threshold.value = -18;
    compressor.knee.value = 20;
    compressor.ratio.value = 5;
    compressor.attack.value = 0.012;
    compressor.release.value = 0.22;
    lowWindFilter.type = "lowpass";
    lowWindFilter.frequency.value = 240;
    lowWindFilter.Q.value = 0.9;
    highWindFilter.type = "bandpass";
    highWindFilter.frequency.value = 2100;
    highWindFilter.Q.value = 1.4;
    gustFilter.type = "bandpass";
    gustFilter.frequency.value = 95;
    gustFilter.Q.value = 1.15;
    turbineOsc.type = "triangle";
    turbineOsc.frequency.value = 32;
    turbineFilter.type = "lowpass";
    turbineFilter.frequency.value = 135;
    turbineFilter.Q.value = 1.1;
    compressorOsc.type = "sine";
    compressorOsc.frequency.value = 520;
    compressorFilter.type = "bandpass";
    compressorFilter.frequency.value = 980;
    compressorFilter.Q.value = 5.5;

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
    turbineOsc.connect(turbineFilter);
    turbineFilter.connect(turbineGain);
    turbineGain.connect(masterGain);
    compressorOsc.connect(compressorFilter);
    compressorFilter.connect(compressorGain);
    compressorGain.connect(masterGain);
    masterGain.connect(compressor);
    compressor.connect(context.destination);

    noiseSource.start();
    turbineOsc.start();
    compressorOsc.start();
  }

  function updateSound(now) {
    if (!running || !context) {
      return;
    }
    const eye = getCameraEye(view);
    const dt = Math.max(0.016, Math.min(0.25, (now - lastTime) / 1000));
    const cameraSpeed = distance3(eye, lastEye) / dt;
    const vehicleSpeed = Number(window.__proceduralCityVehicle?.controller?.sdkController?.speed || 0);
    const throttle = activeKeys.has("KeyW") ? 1 : 0;
    smoothedSpeed += (Math.max(cameraSpeed, vehicleSpeed) - smoothedSpeed) * 0.18;
    const speedNorm = clamp(smoothedSpeed / 150, 0, 1);
    const keyWind = [...activeKeys].some((code) => movementKeys.has(code)) ? 0.1 : 0;
    const targetIntensity = clamp(0.2 + speedNorm * 0.62 + throttle * 0.25 + keyWind, 0, 1);
    windIntensity += (targetIntensity - windIntensity) * 0.075;
    const idle = isEnabled() ? 1 : 0;
    const nowSeconds = context.currentTime;
    const turbinePulse = clamp(
      0.9 +
      Math.sin(nowSeconds * 17.5) * 0.035 +
      Math.sin(nowSeconds * 29.0 + 1.3) * 0.018,
      0.82,
      1.06
    );
    const spool = windIntensity * turbinePulse;
    const compressorPitch = 360 + spool * 760 + throttle * 90;
    lowWindFilter.frequency.setTargetAtTime(130 + spool * 430, nowSeconds, 0.09);
    highWindFilter.frequency.setTargetAtTime(1150 + spool * 2100, nowSeconds, 0.08);
    gustFilter.frequency.setTargetAtTime(48 + spool * 150, nowSeconds, 0.12);
    turbineOsc.frequency.setTargetAtTime(28 + spool * 42 + throttle * 6, nowSeconds, 0.08);
    turbineFilter.frequency.setTargetAtTime(95 + spool * 280, nowSeconds, 0.1);
    compressorOsc.frequency.setTargetAtTime(compressorPitch, nowSeconds, 0.06);
    compressorFilter.frequency.setTargetAtTime(compressorPitch * 1.85, nowSeconds, 0.07);
    lowWindGain.gain.setTargetAtTime((0.038 + Math.pow(spool, 1.04) * 0.16) * idle + 0.0001, nowSeconds, 0.08);
    highWindGain.gain.setTargetAtTime((0.0015 + Math.pow(spool, 1.9) * 0.027) * idle + 0.0001, nowSeconds, 0.07);
    gustGain.gain.setTargetAtTime((0.02 + spool * 0.095) * idle + 0.0001, nowSeconds, 0.12);
    turbineGain.gain.setTargetAtTime((0.018 + spool * 0.085) * idle + 0.0001, nowSeconds, 0.08);
    compressorGain.gain.setTargetAtTime((0.0006 + Math.pow(spool, 2.25) * 0.007) * idle + 0.0001, nowSeconds, 0.06);
    masterGain.gain.setTargetAtTime((0.3 + spool * 0.28) * idle, nowSeconds, 0.08);

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

function flatDirection3(direction, worldUp) {
  const flat = sub3(direction, mul3(worldUp, dot3(direction, worldUp)));
  return safeNormalize(flat, [1, 0, 0]);
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
