import * as xeokit from "../../js/xeokit-studio-bundle.js";
import {
  installRendererInteractionProfiler,
  runRendererInteractionLatencyProfile
} from "../utils/rendererInteractionProfiler.js";

const HAS_STREAM_CONFIG = !!window.PROCEDURAL_CITY_STREAM_CONFIG;
const EXAMPLE_CONFIG = window.PROCEDURAL_CITY_STREAM_CONFIG || {};
const INDEX_URL = EXAMPLE_CONFIG.indexUrl || "../../models/ProceduralCityLarge/xgfstream/index.runtime.json";
const METADATA_URL = EXAMPLE_CONFIG.metadataUrl || "../../models/ProceduralCityLarge/metadata.json";
const REPORT_URL = EXAMPLE_CONFIG.reportUrl || "../../models/ProceduralCityLarge/report.json";
const MODEL_ID = EXAMPLE_CONFIG.modelId || "ProceduralCityLarge";
const VIEW_ID = EXAMPLE_CONFIG.viewId || "proceduralCityView";
const STREAM_LABEL = EXAMPLE_CONFIG.streamLabel || "procedural city";
const WIND_SOUND = !!EXAMPLE_CONFIG.windSound;
const VEHICLE_CONFIG = EXAMPLE_CONFIG.vehicle || null;
const MULTIPLAYER_CONFIG = EXAMPLE_CONFIG.multiplayer || null;
const STREAM_FRUSTUM_ONLY = EXAMPLE_CONFIG.frustumOnly !== undefined ? !!EXAMPLE_CONFIG.frustumOnly : true;
const PROFILE_PANEL = new URLSearchParams(window.location.search).get("profile") === "1";
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
const DEFAULT_PROCEDURAL_CITY_RENDER_CONFIG = {
  renderMode: "navigation",
  adaptiveQuality: false,
  effects: {
    sao: {
      renderModes: ["realistic"]
    },
    bloom: {
      renderModes: ["realistic"]
    },
    atmosphere: {
      renderModes: []
    },
    depthOfField: {
      renderModes: []
    },
    tonemap: {
      renderModes: ["realistic"]
    },
    antiAliasing: {
      renderModes: ["realistic"]
    },
    shadows: {
      renderModes: ["realistic"]
    },
    edges: {
      renderModes: ["navigation", "detailed", "realistic"],
      edgeWidth: 1
    },
    sectionPlaneCaps: {
      renderModes: []
    },
    bodyHatch: {
      renderModes: []
    }
  },
  lights: {
    ibl: {
      renderModes: ["realistic"]
    },
    hemispheric: {
      renderModes: ["navigation", "detailed", "realistic"]
    }
  }
};
const BASE_RENDER_CONFIG = HAS_STREAM_CONFIG ? {} : DEFAULT_PROCEDURAL_CITY_RENDER_CONFIG;
const VIEW_EFFECTS = normalizeRenderModeConfig(EXAMPLE_CONFIG.effects || BASE_RENDER_CONFIG.effects || {});
const VIEW_LIGHTS = normalizeRenderModeConfig(EXAMPLE_CONFIG.lights || BASE_RENDER_CONFIG.lights || {});
const VIEW_ADAPTIVE_QUALITY = normalizeAdaptiveQuality(EXAMPLE_CONFIG.adaptiveQuality ?? BASE_RENDER_CONFIG.adaptiveQuality);
const WEBGPU_CONFIG = {
  ...EXAMPLE_CONFIG.webGPU,
  renderConfigs: {
    ...EXAMPLE_CONFIG.webGPU?.renderConfigs,
    logDepth: EXAMPLE_CONFIG.webGPU?.renderConfigs?.logDepth ?? true
  }
};
const DEFAULT_RENDER_MODE = renderModeFor(EXAMPLE_CONFIG.renderMode ?? BASE_RENDER_CONFIG.renderMode, RENDER_MODE_NAMES.navigation);
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

const studio = new xeokit.studio.Studio({
  webGPU: WEBGPU_CONFIG
});

studio.init().then(async () => {
  const status = document.getElementById("status");
  const panel = document.getElementById("panel");
  const {scene} = studio;
  const view = studio.viewManager.createView({
    id: VIEW_ID,
    adaptiveQuality: VIEW_ADAPTIVE_QUALITY,
    renderMode: DEFAULT_RENDER_MODE,
    camera: CAMERA_PRESETS.aerial,
    effects: VIEW_EFFECTS,
    lights: VIEW_LIGHTS
  });
  view.camera.perspectiveProjection.far = 10000;
  const vehicleRuntime = {controller: null};
  setupWindSound(view, WIND_SOUND, () => Number(vehicleRuntime.controller?.sdkController?.speed || 0));

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
      frustumOnly: STREAM_FRUSTUM_ONLY,
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
      vehicleRuntime.controller = await setupVehicleChase({studio, scene, view, config: VEHICLE_CONFIG});
      setupAircraftMultiplayer({
        scene,
        view,
        localVehicle: vehicleRuntime.controller,
        vehicleConfig: VEHICLE_CONFIG,
        multiplayerConfig: MULTIPLAYER_CONFIG
      });
    }
    streamController.prefetchInitial(AUTO_BATCH_SIZE * 2);
    streamController.schedule(`Initial ${STREAM_LABEL} frustum`);
    bindCameraStreaming(studio, view, streamController);
    renderStreamProgress(streamController);
    panel.style.display = "block";
    const renderInspectorResult = studio.renderer.getRenderInspector?.();
    const renderInspector = renderInspectorResult?.ok ? renderInspectorResult.value : null;
    const interactionProfiler = installRendererInteractionProfiler({
      label: "WebGL",
      renderer: studio.renderer,
      viewer: studio.viewer,
      view,
      renderInspector,
      enabled: PROFILE_PANEL
    });
    window.addEventListener("pagehide", () => interactionProfiler?.destroy(), {once: true});
    window.proceduralCityXGFStreamDemo = {
      studio,
      scene,
      view,
      streamController,
      index,
      manifest,
      report,
      interactionProfiler,
      runInteractionLatencyProfile: (options = {}) => runRendererInteractionLatencyProfile({
        renderer: studio.renderer,
        view,
        frames: Number(options.frames || 24),
        radius: Number(options.radius || 1250),
        angleStep: Number(options.angleStep || 0.045),
        timeoutMs: Number(options.timeoutMs || 1000)
      })
    };
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

function renderModeFor(value, fallback = RENDER_MODE_NAMES.detailed) {
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "string") {
    return RENDER_MODE_NAMES[value] ?? fallback;
  }
  return fallback;
}

function nameForRenderMode(mode) {
  for (const [name, value] of Object.entries(RENDER_MODE_NAMES)) {
    if (mode === value) {
      return name;
    }
  }
  return "detailed";
}

function normalizeAdaptiveQuality(config) {
  if (config === true) {
    return {};
  }
  if (!config || typeof config !== "object") {
    return false;
  }
  return {
    ...config,
    fastMode: renderModeFor(config.fastMode, RENDER_MODE_NAMES.navigation),
    restMode: renderModeFor(config.restMode, RENDER_MODE_NAMES.realistic)
  };
}

function normalizeRenderModeConfig(config) {
  if (Array.isArray(config)) {
    return config.map((item) => normalizeRenderModeConfig(item));
  }
  if (!config || typeof config !== "object") {
    return config;
  }
  const normalized = {};
  for (const [key, value] of Object.entries(config)) {
    normalized[key] = key === "renderModes" && Array.isArray(value)
      ? value.map((mode) => renderModeFor(mode)).filter((mode) => mode !== undefined)
      : normalizeRenderModeConfig(value);
  }
  return normalized;
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

  const AircraftExhaustTrail = xeokit.simulation?.aircraft?.AircraftExhaustTrail;
  const AircraftController = xeokit.simulation?.aircraft?.AircraftController;
  if (!AircraftController) {
    throw new Error("AircraftController is unavailable in the xeokit bundle");
  }
  const exhaustConfig = typeof config.exhaustPlume === "object" && config.exhaustPlume
    ? config.exhaustPlume
    : (config.exhaust || null);
  const exhaust = (AircraftExhaustTrail && (exhaustConfig || config.exhaustPlume === true))
    ? new AircraftExhaustTrail({
      scene,
      modelId,
      coordinateSystem: vehicleCoordinateSystem,
      config
    })
    : null;

  const objectIds = Object.keys(sceneModel.objects);
  if (objectIds.length) {
    view.setObjectsPickable(objectIds, false);
  }
  if (exhaust?.objectIds?.length) {
    view.setObjectsPickable(exhaust.objectIds, false);
  }

  const record = studio.viewManager.views?.[view.id];
  if (record?.vehicleNavigationController?.destroy) {
    record.vehicleNavigationController.destroy();
  }
  const shipController = new AircraftController(view, {
    rootTransform,
    exhaust,
    config,
    suspendViewController: record?.viewController,
    objectFilter: (objectId) => !isVehicleObjectId(objectId, config.modelId),
    taskName: "ProceduralCityVehicleChase"
  });
  if (record) {
    record.vehicleNavigationController = shipController.sdkController;
  }
  shipController.sceneModel = sceneModel;
  shipController.rootTransform = rootTransform;
  shipController.contentTransform = contentTransform;
  shipController.objectIds = objectIds;
  shipController.update();

  if (config.hideStudioOverlay !== false) {
    document.querySelectorAll(".xeokit-loading-overlay").forEach((element) => {
      element.style.display = "none";
    });
  }

  window.addEventListener("pagehide", () => {
    if (record?.vehicleNavigationController === shipController.sdkController) {
      record.vehicleNavigationController = undefined;
    }
    shipController.destroy();
  }, {once: true});

  return shipController;
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
    id.startsWith("vehicleAfterburner") ||
    id.includes("__vehicleExhaust") ||
    id.includes(".vehicleExhaust") ||
    id.includes("__vehicleAfterburner") ||
    id.includes(".vehicleAfterburner");
}

function setupAircraftMultiplayer({scene, view, localVehicle, vehicleConfig, multiplayerConfig}) {
  if (!localVehicle || !vehicleConfig?.modelUrl || !multiplayerConfig?.enabled) {
    return null;
  }

  const urlParams = new URLSearchParams(window.location.search);
  const mpParam = urlParams.get("mp") || urlParams.get("multiplayer");
  if (mpParam === "0" || mpParam === "false" || mpParam === "off") {
    return null;
  }

  const playerId = getOrCreateMultiplayerPlayerId();
  const room = String(urlParams.get("room") || multiplayerConfig.room || "flight-sim");
  const peerTimeoutMs = Number(multiplayerConfig.peerTimeoutMs || 5000);
  const updateIntervalMs = Math.max(16, Number(multiplayerConfig.updateIntervalMs || 50));
  const interpolationDelayMs = Math.max(updateIntervalMs * 2, Number(multiplayerConfig.interpolationDelayMs || 120));
  const wsUrl = resolveMultiplayerWebSocketUrl(mpParam, multiplayerConfig);
  const channelName = String(multiplayerConfig.broadcastChannel || `xeokit-${room}`);
  const peers = new Map();
  const peerLoads = new Map();
  const connections = [];
  const objectIdPrefix = vehicleConfig.modelId || `${MODEL_ID}Vehicle`;
  let destroyed = false;
  let publishTimer = 0;
  let remoteAnimationFrame = 0;
  let poseSequence = 0;

  const status = ensureMultiplayerStatus();
  updateMultiplayerStatus(status, {
    transport: wsUrl ? "connecting" : "local tabs",
    peers: 0
  });

  const publish = (message) => {
    for (const connection of connections) {
      connection.send(message);
    }
  };
  const ensureRemotePoseAnimation = () => {
    if (remoteAnimationFrame || destroyed) {
      return;
    }
    remoteAnimationFrame = window.requestAnimationFrame(animateRemoteAircraft);
  };
  const animateRemoteAircraft = () => {
    remoteAnimationFrame = 0;
    if (destroyed) {
      return;
    }
    if (updateRemoteAircraftPoses(peers, performance.now() - interpolationDelayMs)) {
      view.needsRender?.();
    }
    if (peers.size > 0) {
      ensureRemotePoseAnimation();
    }
  };

  if (typeof BroadcastChannel !== "undefined") {
    const channel = new BroadcastChannel(channelName);
    channel.onmessage = (event) => receiveMultiplayerMessage(event.data);
    connections.push({
      send: (message) => channel.postMessage(message),
      close: () => channel.close()
    });
  }

  if (wsUrl && typeof WebSocket !== "undefined") {
    const socket = new WebSocket(wsUrl);
    socket.onopen = () => {
      updateMultiplayerStatus(status, {transport: "online", peers: peers.size});
      socket.send(JSON.stringify({type: "join", room, playerId}));
    };
    socket.onmessage = (event) => {
      try {
        receiveMultiplayerMessage(JSON.parse(event.data));
      } catch (error) {
        console.warn("Ignoring invalid multiplayer message", error);
      }
    };
    socket.onerror = () => {
      updateMultiplayerStatus(status, {transport: "offline", peers: peers.size});
    };
    socket.onclose = () => {
      updateMultiplayerStatus(status, {transport: "offline", peers: peers.size});
    };
    connections.push({
      send: (message) => {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify(message));
        }
      },
      close: () => socket.close()
    });
  }

  const publishLocalPose = () => {
    if (destroyed) {
      return;
    }
    const matrix = readMatrix(localVehicle.rootTransform?.matrix);
    if (matrix) {
      publish({
        type: "aircraftPose",
        room,
        playerId,
        name: playerId.slice(-4),
        matrix,
        speed: Number(localVehicle.sdkController?.speed || 0),
        sequence: ++poseSequence,
        time: Date.now()
      });
    }
    pruneStaleMultiplayerPeers(peers, peerTimeoutMs, status);
  };
  publishLocalPose();
  publishTimer = window.setInterval(publishLocalPose, updateIntervalMs);

  function receiveMultiplayerMessage(message) {
    if (!message || message.type !== "aircraftPose" || message.room !== room || message.playerId === playerId) {
      return;
    }
    const matrix = readMatrix(message.matrix);
    if (!matrix) {
      return;
    }
    const peer = peers.get(message.playerId);
    if (peer) {
      if (!acceptRemoteAircraftPose(peer, message)) {
        return;
      }
      peer.speed = Number(message.speed || 0);
      queueRemoteAircraftPose(peer, matrix, performance.now());
      ensureRemotePoseAnimation();
      return;
    }
    if (peerLoads.has(message.playerId)) {
      const loadState = peerLoads.get(message.playerId);
      if (acceptRemoteAircraftPose(loadState, message)) {
        loadState.matrix = matrix;
      }
      return;
    }
    const loadState = {matrix};
    acceptRemoteAircraftPose(loadState, message);
    peerLoads.set(message.playerId, loadState);
    createRemoteAircraft({
      scene,
      view,
      peerId: message.playerId,
      matrix,
      vehicleConfig,
      objectIdPrefix
    }).then((remote) => {
      peerLoads.delete(message.playerId);
      if (destroyed) {
        remote.sceneModel.destroy?.();
        return;
      }
      remote.rootTransform.matrix = loadState.matrix || matrix;
      peers.set(message.playerId, {
        ...remote,
        lastSeen: performance.now(),
        lastRemoteSequence: loadState.lastRemoteSequence,
        lastRemoteTime: loadState.lastRemoteTime,
        matrix: loadState.matrix || matrix,
        samples: [{time: performance.now(), matrix: loadState.matrix || matrix}],
        displayedMatrix: loadState.matrix || matrix,
        speed: Number(message.speed || 0)
      });
      updateMultiplayerStatus(status, {transport: wsUrl ? "online" : "local tabs", peers: peers.size});
      ensureRemotePoseAnimation();
      view.needsRender?.();
    }).catch((error) => {
      peerLoads.delete(message.playerId);
      updateMultiplayerStatus(status, {
        transport: "error",
        peers: peers.size,
        detail: error.message || error
      });
      console.error(error);
    });
  }

  window.addEventListener("pagehide", () => {
    destroyed = true;
    if (publishTimer) {
      window.clearInterval(publishTimer);
      publishTimer = 0;
    }
    if (remoteAnimationFrame) {
      window.cancelAnimationFrame(remoteAnimationFrame);
      remoteAnimationFrame = 0;
    }
    publish({type: "leave", room, playerId});
    for (const connection of connections) {
      connection.close();
    }
    for (const peer of peers.values()) {
      peer.sceneModel.destroy?.();
    }
    peers.clear();
  }, {once: true});

  return {
    room,
    peers
  };
}

async function createRemoteAircraft({scene, view, peerId, matrix, vehicleConfig, objectIdPrefix}) {
  const modelId = `Remote${sanitizeId(peerId)}`;
  const rootTransformId = `${modelId}Root`;
  const contentTransformId = `${modelId}Content`;
  const sceneModel = must(scene.createModel({
    id: modelId,
    updateHint: "dynamic",
    coordinateSystem: vehicleConfig.coordinateSystem || {
      basis: [1, 0, 0, 0, 0, 1, 0, 1, 0],
      origin: [0, 0, 0],
      units: "meters",
      scaleToMeters: 1
    }
  }));
  const rootTransform = must(sceneModel.createTransform({
    id: rootTransformId,
    matrix
  }));
  must(sceneModel.createTransform({
    id: contentTransformId,
    parentTransformId: rootTransformId,
    position: [0, 0, 0],
    scale: [1, 1, 1]
  }));

  const fileData = await getMultiplayerAircraftFileData(vehicleConfig.modelUrl);
  await new xeokit.formats.xgf.XGFLoader().load({
    fileData: fileData.slice(0),
    sceneModel
  }, {
    idPrefix: `${modelId}__`,
    yieldIntervalMs: 100
  });
  sceneModel.updateHint = "dynamic";
  parentVehicleContent(sceneModel, rootTransformId, contentTransformId);

  const scale = Number(vehicleConfig.scale || 1);
  const center = vehicleConfig.sourceCenter || [0, 0, 0];
  const contentTransform = sceneModel.transforms[contentTransformId];
  contentTransform.scale = [scale, scale, scale];
  contentTransform.position = [
    -Number(center[0] || 0) * scale,
    -Number(center[1] || 0) * scale,
    -Number(center[2] || 0) * scale
  ];
  if (Array.isArray(vehicleConfig.contentRotation)) {
    contentTransform.rotation = vehicleConfig.contentRotation;
  }

  const objectIds = Object.keys(sceneModel.objects);
  if (objectIds.length) {
    view.setObjectsPickable(objectIds, false);
  }
  rootTransform.matrix = matrix;
  return {
    sceneModel,
    rootTransform,
    objectIds,
    objectIdPrefix
  };
}

const multiplayerAircraftFileData = new Map();

async function getMultiplayerAircraftFileData(url) {
  if (!multiplayerAircraftFileData.has(url)) {
    multiplayerAircraftFileData.set(url, fetchArrayBuffer(url));
  }
  return multiplayerAircraftFileData.get(url);
}

function queueRemoteAircraftPose(peer, matrix, time) {
  peer.lastSeen = performance.now();
  peer.matrix = matrix;
  const samples = peer.samples || (peer.samples = []);
  samples.push({time, matrix});
  while (samples.length > 8) {
    samples.shift();
  }
}

function acceptRemoteAircraftPose(peer, message) {
  const sequence = Number(message.sequence);
  if (Number.isFinite(sequence)) {
    if (Number.isFinite(peer.lastRemoteSequence) && sequence <= peer.lastRemoteSequence) {
      return false;
    }
    peer.lastRemoteSequence = sequence;
    return true;
  }
  const time = Number(message.time);
  if (Number.isFinite(time)) {
    if (Number.isFinite(peer.lastRemoteTime) && time <= peer.lastRemoteTime) {
      return false;
    }
    peer.lastRemoteTime = time;
  }
  return true;
}

function updateRemoteAircraftPoses(peers, targetTime) {
  let changed = false;
  for (const peer of peers.values()) {
    const samples = peer.samples || [];
    if (!samples.length) {
      continue;
    }
    while (samples.length > 2 && samples[1].time <= targetTime) {
      samples.shift();
    }
    const matrix = remoteAircraftMatrixAt(samples, targetTime);
    if (!matrix || matricesAlmostEqual(matrix, peer.displayedMatrix)) {
      continue;
    }
    peer.displayedMatrix = matrix;
    peer.rootTransform.matrix = matrix;
    changed = true;
  }
  return changed;
}

function remoteAircraftMatrixAt(samples, targetTime) {
  if (samples.length === 1 || targetTime <= samples[0].time) {
    return samples[0].matrix;
  }
  for (let i = 1; i < samples.length; i++) {
    const previous = samples[i - 1];
    const next = samples[i];
    if (targetTime <= next.time) {
      const span = Math.max(1, next.time - previous.time);
      return interpolateAircraftMatrix(previous.matrix, next.matrix, clamp01((targetTime - previous.time) / span));
    }
  }
  return samples[samples.length - 1].matrix;
}

function interpolateAircraftMatrix(a, b, t) {
  const x = normalizeVector([
    lerpNumber(a[0], b[0], t),
    lerpNumber(a[1], b[1], t),
    lerpNumber(a[2], b[2], t)
  ], [1, 0, 0]);
  let y = normalizeVector([
    lerpNumber(a[4], b[4], t),
    lerpNumber(a[5], b[5], t),
    lerpNumber(a[6], b[6], t)
  ], [0, 1, 0]);
  let z = normalizeVector(crossVectors(x, y), [
    lerpNumber(a[8], b[8], t),
    lerpNumber(a[9], b[9], t),
    lerpNumber(a[10], b[10], t)
  ]);
  y = normalizeVector(crossVectors(z, x), y);
  z = normalizeVector(crossVectors(x, y), z);
  return [
    x[0], x[1], x[2], 0,
    y[0], y[1], y[2], 0,
    z[0], z[1], z[2], 0,
    lerpNumber(a[12], b[12], t),
    lerpNumber(a[13], b[13], t),
    lerpNumber(a[14], b[14], t),
    1
  ];
}

function matricesAlmostEqual(a, b) {
  if (!a || !b) {
    return false;
  }
  for (let i = 0; i < 16; i++) {
    if (Math.abs(a[i] - b[i]) > 0.00001) {
      return false;
    }
  }
  return true;
}

function lerpNumber(a, b, t) {
  return a + (b - a) * t;
}

function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}

function normalizeVector(value, fallback) {
  const length = Math.hypot(value[0], value[1], value[2]);
  if (!Number.isFinite(length) || length < 0.000001) {
    return fallback;
  }
  return [value[0] / length, value[1] / length, value[2] / length];
}

function crossVectors(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0]
  ];
}

function pruneStaleMultiplayerPeers(peers, peerTimeoutMs, status) {
  const now = performance.now();
  let changed = false;
  for (const [peerId, peer] of peers) {
    if (now - peer.lastSeen <= peerTimeoutMs) {
      continue;
    }
    peer.sceneModel.destroy?.();
    peers.delete(peerId);
    changed = true;
  }
  if (changed) {
    updateMultiplayerStatus(status, {peers: peers.size});
  }
}

function ensureMultiplayerStatus() {
  let element = document.getElementById("multiplayerStatus");
  if (element) {
    return element;
  }
  const section = document.createElement("div");
  section.className = "section";
  section.innerHTML = `<p class="stream-line"><span>Multiplayer</span><strong id="multiplayerStatus">-</strong></p>`;
  const panel = document.getElementById("panel");
  const streamSection = document.getElementById("chunkProgress")?.closest(".section");
  if (panel && streamSection?.nextSibling) {
    panel.insertBefore(section, streamSection.nextSibling);
  } else {
    panel?.appendChild(section);
  }
  return document.getElementById("multiplayerStatus");
}

function updateMultiplayerStatus(element, {transport, peers, detail} = {}) {
  if (!element) {
    return;
  }
  const current = element.dataset.transport || "local tabs";
  const nextTransport = transport || current;
  element.dataset.transport = nextTransport;
  const peerCount = Number.isFinite(peers) ? peers : Number(element.dataset.peers || 0);
  element.dataset.peers = String(peerCount);
  element.textContent = `${nextTransport}, ${peerCount} peer${peerCount === 1 ? "" : "s"}`;
  if (detail) {
    element.title = String(detail);
  }
}

function resolveMultiplayerWebSocketUrl(mpParam, config) {
  const explicit = mpParam && mpParam !== "1" && mpParam !== "true" && mpParam !== "on"
    ? mpParam
    : (config.wsUrl || "");
  if (!explicit && !config.wsPort && !config.wsPath) {
    return "";
  }
  const fallback = `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.hostname}:${Number(config.wsPort || window.location.port || 80)}${config.wsPath || "/flight-sim"}`;
  try {
    return new URL(explicit || fallback, window.location.href).href.replace(/^http:/, "ws:").replace(/^https:/, "wss:");
  } catch {
    return "";
  }
}

function getOrCreateMultiplayerPlayerId() {
  const storageKey = "xeokitAmsterdamFlightPlayerId";
  try {
    const existing = window.sessionStorage.getItem(storageKey);
    if (existing) {
      return existing;
    }
    const id = createRandomId();
    window.sessionStorage.setItem(storageKey, id);
    return id;
  } catch {
    return createRandomId();
  }
}

function createRandomId() {
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }
  return `player-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function sanitizeId(id) {
  return String(id).replace(/[^A-Za-z0-9_]/g, "_").slice(0, 48) || "player";
}

function readMatrix(value) {
  if (!value || value.length !== 16) {
    return null;
  }
  const matrix = Array.from(value, Number);
  return matrix.every(Number.isFinite) ? matrix : null;
}

function setupWindSound(view, enabled, getVehicleSpeed = () => 0) {
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

  const createAircraftNoiseBuffer = xeokit.simulation?.aircraft?.createAircraftNoiseBuffer;
  if (!createAircraftNoiseBuffer) {
    throw new Error("createAircraftNoiseBuffer is unavailable in the xeokit bundle");
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
  let compressorOvertoneOsc = null;
  let turbineGain = null;
  let compressorGain = null;
  let compressorOvertoneGain = null;
  let beepGain = null;
  let turbineFilter = null;
  let compressorFilter = null;
  let compressorOvertoneFilter = null;
  let nextBeepTime = 0;
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
    compressorOvertoneOsc = context.createOscillator();
    turbineGain = context.createGain();
    compressorGain = context.createGain();
    compressorOvertoneGain = context.createGain();
    beepGain = context.createGain();
    turbineFilter = context.createBiquadFilter();
    compressorFilter = context.createBiquadFilter();
    compressorOvertoneFilter = context.createBiquadFilter();

    masterGain.gain.value = 0;
    lowWindGain.gain.value = 0.0001;
    highWindGain.gain.value = 0.0001;
    gustGain.gain.value = 0.0001;
    turbineGain.gain.value = 0.0001;
    compressorGain.gain.value = 0.0001;
    compressorOvertoneGain.gain.value = 0.0001;
    beepGain.gain.value = 1;
    compressor.threshold.value = -18;
    compressor.knee.value = 20;
    compressor.ratio.value = 5;
    compressor.attack.value = 0.012;
    compressor.release.value = 0.22;
    lowWindFilter.type = "lowpass";
    lowWindFilter.frequency.value = 240;
    lowWindFilter.Q.value = 0.9;
    highWindFilter.type = "bandpass";
    highWindFilter.frequency.value = 1500;
    highWindFilter.Q.value = 0.85;
    gustFilter.type = "bandpass";
    gustFilter.frequency.value = 95;
    gustFilter.Q.value = 0.7;
    turbineOsc.type = "triangle";
    turbineOsc.frequency.value = 32;
    turbineFilter.type = "lowpass";
    turbineFilter.frequency.value = 135;
    turbineFilter.Q.value = 0.75;
    compressorOsc.type = "triangle";
    compressorOsc.frequency.value = 520;
    compressorFilter.type = "bandpass";
    compressorFilter.frequency.value = 1250;
    compressorFilter.Q.value = 2.4;
    compressorOvertoneOsc.type = "sine";
    compressorOvertoneOsc.frequency.value = 980;
    compressorOvertoneFilter.type = "bandpass";
    compressorOvertoneFilter.frequency.value = 2450;
    compressorOvertoneFilter.Q.value = 2.8;

    noiseSource.buffer = createAircraftNoiseBuffer(context);
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
    compressorOvertoneOsc.connect(compressorOvertoneFilter);
    compressorOvertoneFilter.connect(compressorOvertoneGain);
    compressorOvertoneGain.connect(masterGain);
    beepGain.connect(masterGain);
    masterGain.connect(compressor);
    compressor.connect(context.destination);

    noiseSource.start();
    turbineOsc.start();
    compressorOsc.start();
    compressorOvertoneOsc.start();
  }

  function updateSound(now) {
    if (!running || !context) {
      return;
    }
    const eye = getCameraEye(view);
    const dt = Math.max(0.016, Math.min(0.25, (now - lastTime) / 1000));
    const cameraSpeed = distance3(eye, lastEye) / dt;
    const vehicleSpeed = Number(getVehicleSpeed() || 0);
    const throttle = activeKeys.has("KeyW") ? 1 : 0;
    smoothedSpeed += (Math.max(cameraSpeed, vehicleSpeed) - smoothedSpeed) * 0.1;
    const speedNorm = clamp(smoothedSpeed / 150, 0, 1);
    const keyWind = [...activeKeys].some((code) => movementKeys.has(code)) ? 0.1 : 0;
    const targetIntensity = clamp(0.16 + speedNorm * 0.52 + throttle * 0.2 + keyWind, 0, 1);
    windIntensity += (targetIntensity - windIntensity) * 0.045;
    const idle = isEnabled() ? 1 : 0;
    const nowSeconds = context.currentTime;
    const turbinePulse = clamp(
      0.9 +
      Math.sin(nowSeconds * 11.0) * 0.018 +
      Math.sin(nowSeconds * 19.0 + 1.3) * 0.01,
      0.88,
      1.02
    );
    const spool = windIntensity * turbinePulse;
    const compressorPitch = 460 + spool * 740 + throttle * 80;
    lowWindFilter.frequency.setTargetAtTime(165 + spool * 470, nowSeconds, 0.16);
    highWindFilter.frequency.setTargetAtTime(780 + spool * 1250, nowSeconds, 0.15);
    gustFilter.frequency.setTargetAtTime(54 + spool * 170, nowSeconds, 0.2);
    turbineOsc.frequency.setTargetAtTime(28 + spool * 34 + throttle * 4, nowSeconds, 0.16);
    turbineFilter.frequency.setTargetAtTime(90 + spool * 210, nowSeconds, 0.18);
    compressorOsc.frequency.setTargetAtTime(compressorPitch, nowSeconds, 0.14);
    compressorFilter.frequency.setTargetAtTime(compressorPitch * 1.55, nowSeconds, 0.14);
    compressorOvertoneOsc.frequency.setTargetAtTime(compressorPitch * 1.48, nowSeconds, 0.12);
    compressorOvertoneFilter.frequency.setTargetAtTime(compressorPitch * 2.25, nowSeconds, 0.12);
    lowWindGain.gain.setTargetAtTime((0.046 + Math.pow(spool, 0.95) * 0.15) * idle + 0.0001, nowSeconds, 0.16);
    highWindGain.gain.setTargetAtTime((0.007 + Math.pow(spool, 1.2) * 0.044) * idle + 0.0001, nowSeconds, 0.14);
    gustGain.gain.setTargetAtTime((0.018 + spool * 0.075) * idle + 0.0001, nowSeconds, 0.2);
    turbineGain.gain.setTargetAtTime((0.02 + spool * 0.075) * idle + 0.0001, nowSeconds, 0.16);
    compressorGain.gain.setTargetAtTime((0.0014 + Math.pow(spool, 1.9) * 0.007 + throttle * 0.002) * idle + 0.0001, nowSeconds, 0.12);
    compressorOvertoneGain.gain.setTargetAtTime((0.0004 + Math.pow(spool, 2.25) * 0.002 + throttle * 0.0006) * idle + 0.0001, nowSeconds, 0.12);
    masterGain.gain.setTargetAtTime((0.26 + spool * 0.2) * idle, nowSeconds, 0.16);
    maybePlaySoftBeep(nowSeconds, spool, idle);

    lastTime = now;
    lastEye = eye;
    animationFrame = window.requestAnimationFrame(updateSound);
  }

  function maybePlaySoftBeep(nowSeconds, spool, idle) {
    if (!idle || nowSeconds < nextBeepTime) {
      return;
    }
    const interval = 2.0;
    nextBeepTime = nowSeconds + interval;
    playBeepPulse(nowSeconds + 0.018, 0.34, 430 + spool * 70, 0.034);
  }

  function playBeepPulse(startTime, duration, frequency, peakGain) {
    const osc = context.createOscillator();
    const toneFilter = context.createBiquadFilter();
    const toneGain = context.createGain();
    const stopTime = startTime + duration;
    osc.type = "triangle";
    osc.frequency.setValueAtTime(frequency, startTime);
    toneFilter.type = "lowpass";
    toneFilter.frequency.setValueAtTime(820, startTime);
    toneFilter.Q.value = 0.45;
    toneGain.gain.setValueAtTime(0.0001, startTime);
    toneGain.gain.exponentialRampToValueAtTime(peakGain, startTime + 0.08);
    toneGain.gain.exponentialRampToValueAtTime(0.0001, stopTime);
    osc.connect(toneFilter);
    toneFilter.connect(toneGain);
    toneGain.connect(beepGain);
    osc.start(startTime);
    osc.stop(stopTime + 0.02);
    osc.addEventListener("ended", () => {
      osc.disconnect();
      toneFilter.disconnect();
      toneGain.disconnect();
    }, {once: true});
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

function getCameraEye(view) {
  return Array.from(view.camera.eye || [0, 0, 0]);
}

function identityMat4() {
  return [
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1
  ];
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
