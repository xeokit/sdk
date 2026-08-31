// Streams the Baku Stadium XGF stream through the experimental WebGPU renderer.
//
// Unlike the 3D Tiles WebGPU example, XGFViewStreamController loads stream
// chunks into one SceneModel. This exercises WebGPU's dynamic mesh registration
// and persistent packed triangle storage as the stream incrementally adds
// chunks to a large BIM-oriented model.
import * as xeokit from "../../../../js/xeokit-studio-bundle.js";
import {signalExampleLoaded} from "../../../utils/snapshotReady.js";
import {
  collectWebGPUAdapterDiagnostics,
  installVisibleBrowserBenchmark,
  installRendererInteractionProfiler,
  runRendererInteractionLatencyProfile
} from "../../../utils/rendererInteractionProfiler.js";
const DATASET = getBakuDataset();
const INDEX_URL = getBakuIndexURL(DATASET);
const AUTO_BATCH_SIZE = 8;
const FETCH_CONCURRENCY = 8;
const PREFETCH_CHUNKS = 24;
const MAX_CACHED_XGF_FILE_BYTES = 256 * 1024 * 1024;
const MEMORY_PROFILE = getMemoryProfile();
const EDGE_PASS = new URLSearchParams(window.location.search).get("edges") === "1";
const DEPTH_PREPASS = new URLSearchParams(window.location.search).get("depth") === "1";
const GPU_TIMESTAMPS = new URLSearchParams(window.location.search).get("timestamps") === "1";
const PROFILE_PANEL = new URLSearchParams(window.location.search).get("profile") === "1";
const BENCHMARK_PANEL = new URLSearchParams(window.location.search).get("benchmark") === "1";
const RTC_TILE_SIZE = getPositiveNumberParam("tileSize", 1000);
const FRUSTUM_CULLING = new URLSearchParams(window.location.search).get("cull") === "1";
const MIN_PROJECTED_CANVAS_SIZE = getNonNegativeNumberParam("minProjectedCanvasSize", 5);
const BACKPRESSURE_ENABLED = new URLSearchParams(window.location.search).get("backpressure") === "1";
const BACKPRESSURE_DEFAULTS = getBackpressureDefaults(MEMORY_PROFILE);
const BACKPRESSURE_PAUSE_PENDING_SEGMENTS = getPositiveNumberParam("pausePendingSegments", BACKPRESSURE_DEFAULTS.pausePendingSegments);
const BACKPRESSURE_RESUME_PENDING_SEGMENTS = getPositiveNumberParam("resumePendingSegments", BACKPRESSURE_DEFAULTS.resumePendingSegments);
const BACKPRESSURE_CHECK_INTERVAL_MS = getPositiveNumberParam("backpressureIntervalMs", 250);
const MEMORY_CONFIGS = getMemoryConfigs(MEMORY_PROFILE, DATASET);

const status = document.getElementById("status");
const canvas = document.getElementById("demoCanvas");

main().catch((error) => {
  reportError(error instanceof Error ? error.message : String(error));
});

async function main() {
  if (!navigator.gpu) {
    reportError("This browser does not expose navigator.gpu. Use a WebGPU-enabled browser to run this example.");
    return;
  }

  const {Scene} = xeokit.model.scene;
  const {Viewer} = xeokit.viewing.viewer;
  const {ModelNavigationController: InputController} = xeokit.viewing.navigation.model;
  const {WebGPURenderer} = xeokit.viewing.renderers.webGPU;
  const {XGFStreamingLoader, XGFViewStreamController, readXGFStreamingRuntimeIndex} = xeokit.formats.xgfstream;

  updateStatus("Requesting WebGPU adapter...");

  const scene = new Scene({logging: true});
  const viewer = new Viewer({scene, logging: true});
  const view = mustOk(viewer.createView({
    id: "webgpuBakuStadiumXGFStreamView",
    htmlElement: canvas,
    backgroundColor: [0.094, 0.129, 0.149],
    camera: {
      projection: "perspective",
      far: 10000,
      eye: [-210, -165, 115],
      look: [-42, 8, 38],
      up: [0, 0, 1]
    }
  }));

  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) {
    reportError("This browser could not create a WebGPU adapter.");
    return;
  }
  const webgpuDiagnostics = await collectWebGPUAdapterDiagnostics(adapter);

  updateStatus("Creating WebGPU renderer...");
  const rendererResult = await WebGPURenderer.create({
    adapter,
    viewer,
    logging: true,
    memoryConfigs: MEMORY_CONFIGS,
    renderConfigs: {
      depthPrepass: DEPTH_PREPASS,
      edges: EDGE_PASS,
      triangleColorMode: "flat",
      gpuTimestamps: GPU_TIMESTAMPS
    }
  });
  if (!rendererResult.ok) {
    reportError(rendererResult.error);
    return;
  }

  const renderer = rendererResult.value;
  renderer.events.onError.subscribe((_renderer, error) => {
    reportError(error.error);
  });
  const renderInspectorResult = renderer.getRenderInspector?.();
  const renderInspector = renderInspectorResult?.ok ? renderInspectorResult.value : null;
  if (renderInspector) {
    renderInspector.enabled = true;
  }

  const inputController = new InputController(view, {
    pick: noPick,
    followPointer: false,
    rotationInertia: 0,
    panInertia: 0,
    dollyInertia: 0,
    doublePickFlyTo: false,
    keyboardDollyRate: 80,
    keyboardPanRate: 50,
    mouseWheelDollyRate: 420,
    touchDollyRate: 0.22
  });
  const interactionProfiler = installRendererInteractionProfiler({
    label: "WebGPU",
    renderer,
    viewer,
    view,
    renderInspector,
    enabled: PROFILE_PANEL
  });
  let visibleBenchmark = null;

  try {
    updateStatus("Loading Baku Stadium XGF stream index...");

    const indexUrl = new URL(INDEX_URL, window.location.href).href;
    const runtimeIndex = await fetchJSON(indexUrl);
    const indexResult = readXGFStreamingRuntimeIndex(runtimeIndex);
    if (!indexResult.ok) {
      throw new Error(indexResult.error);
    }
    const index = resolveIndexRelativeChunkUris(indexResult.value, indexUrl);

    const sceneModel = mustOk(scene.createModel({
      id: "WebGPUBakuStadiumXGFStream",
      updateHint: "dynamic",
      lifecycle: "streaming",
      memoryPolicy: "stream"
    }));

    const loader = new XGFStreamingLoader();
    let renderScheduled = false;
    let lastProgressAt = performance.now();
    let lastQueuedLabel = "Initial stream";
    let lastStatusMessage = "Initial stream";
    let modelSealed = false;
    let streamController = null;
    const backpressure = {
      enabled: BACKPRESSURE_ENABLED,
      paused: false,
      pauseCount: 0,
      lastPendingSegments: 0
    };

    const refreshStatus = (message) => {
      lastStatusMessage = message;
      if (!streamController) {
        updateStatus(message);
        return;
      }
      updateStatusHTML(renderStatus({streamController, index, renderer, renderInspector, view, message, lastProgressAt, lastQueuedLabel, backpressure, webgpuDiagnostics}));
    };
    const timestampStatusRefresh = GPU_TIMESTAMPS
      ? window.setInterval(() => refreshStatus(lastStatusMessage), 250)
      : null;

    streamController = new XGFViewStreamController({
      index,
      streamIndexBaseURI: indexUrl,
      loader,
      sceneModel,
      view,
      batchSize: AUTO_BATCH_SIZE,
      fetchConcurrency: FETCH_CONCURRENCY,
      commitFrameBudgetMs: 0,
      cameraDebounceMs: 0,
      frustumOnly: false,
      chunkPriorityTarget: "eye",
      cacheFileData: true,
      maxCachedFileBytes: MAX_CACHED_XGF_FILE_BYTES,
      onStatus: (message) => refreshStatus(message),
      onProgress: () => {
        lastProgressAt = performance.now();
        sealModelWhenComplete();
        scheduleRender();
        refreshStatus("Streaming visible XGF chunks");
      },
      onChunksLoading: () => {
        refreshStatus("Fetching XGF chunks");
      },
      onError: (error) => {
        console.error(error);
        reportError(error?.message || String(error));
      }
    });

    function scheduleRender() {
      if (renderScheduled) {
        return;
      }
      renderScheduled = true;
      requestAnimationFrame(() => {
        renderScheduled = false;
        view.needsRender();
      });
    }

    function sealModelWhenComplete() {
      if (
        modelSealed ||
        backpressure.paused ||
        streamController.loadedChunkIds.size < streamController.chunkManifests.length ||
        streamController.loadingChunkIds.size > 0 ||
        !isRendererSegmentQueueDrained()
      ) {
        return;
      }
      const sealResult = sceneModel.seal();
      if (!sealResult.ok) {
        reportError(sealResult.error);
        return;
      }
      modelSealed = true;
      scheduleRender();
    }

    function streamLoaded() {
      return streamController.loadedChunkIds.size >= streamController.chunkManifests.length &&
        streamController.loadingChunkIds.size === 0;
    }

    const scheduleStream = (label) => {
      lastQueuedLabel = label;
      streamController.schedule(label);
      refreshStatus("Scheduling XGF chunks");
    };

    function getCurrentFrameStats() {
      const viewIndex = view.viewIndex ?? 0;
      return renderInspector?.renderStats?.views?.[viewIndex] || null;
    }

    function isRendererSegmentQueueDrained() {
      const frameStats = getCurrentFrameStats();
      return frameStats ? (frameStats.numPendingSegments ?? 0) === 0 : false;
    }

    function updateStreamingBackpressure() {
      if (!backpressure.enabled || !streamController) {
        return;
      }
      const frameStats = getCurrentFrameStats();
      const pendingSegments = frameStats?.numPendingSegments ?? 0;
      backpressure.lastPendingSegments = pendingSegments;
      if (!backpressure.paused && pendingSegments > BACKPRESSURE_PAUSE_PENDING_SEGMENTS) {
        backpressure.paused = true;
        backpressure.pauseCount++;
        streamController.pause();
        refreshStatus(`WebGPU segment build backpressure paused streaming at ${pendingSegments} pending segment(s)`);
        scheduleRender();
        return;
      }
      if (backpressure.paused) {
        if (pendingSegments <= BACKPRESSURE_RESUME_PENDING_SEGMENTS) {
          backpressure.paused = false;
          lastQueuedLabel = "Backpressure resume";
          streamController.resume(lastQueuedLabel);
          refreshStatus(`WebGPU segment build backpressure resumed streaming at ${pendingSegments} pending segment(s)`);
          scheduleRender();
          return;
        }
        scheduleRender();
      }
    }

    renderer.events.onViewRendered.subscribe(() => {
      updateStreamingBackpressure();
      sealModelWhenComplete();
      refreshStatus("Rendering resident WebGPU batches");
      signalExampleLoaded();
    });
    const backpressureRefresh = BACKPRESSURE_ENABLED
      ? window.setInterval(updateStreamingBackpressure, BACKPRESSURE_CHECK_INTERVAL_MS)
      : null;
    const completionRefresh = window.setInterval(() => {
      if (modelSealed) {
        window.clearInterval(completionRefresh);
        return;
      }
      if (!streamLoaded()) {
        return;
      }
      scheduleRender();
      sealModelWhenComplete();
    }, 250);

    visibleBenchmark = installVisibleBrowserBenchmark({
      label: "Baku WebGPU",
      renderer,
      view,
      enabled: BENCHMARK_PANEL,
      frames: getPositiveNumberParam("benchmarkFrames", 120),
      radius: getPositiveNumberParam("benchmarkRadius", 260),
      angleStep: Number(new URLSearchParams(window.location.search).get("benchmarkAngleStep")) || 0.018,
      settleTimeoutMs: getPositiveNumberParam("benchmarkSettleTimeoutMs", 120000),
      getDiagnostics: () => webgpuDiagnostics,
      getSettledState: () => {
        const frameStats = getCurrentFrameStats();
        return {
          loadedChunks: streamController.loadedChunkIds.size,
          loadingChunks: streamController.loadingChunkIds.size,
          totalChunks: streamController.chunkManifests.length,
          pendingSegments: frameStats?.numPendingSegments ?? 0,
          builtSegments: frameStats?.numBuiltSegments ?? 0,
          settled:
            streamController.loadedChunkIds.size >= streamController.chunkManifests.length &&
            streamController.loadingChunkIds.size === 0 &&
            (frameStats?.numPendingSegments ?? 0) === 0
        };
      },
      getExtraStats: () => ({
        label: "Baku WebGPU XGF stream",
        dataset: DATASET,
        memoryProfile: MEMORY_PROFILE,
        minProjectedCanvasSize: MEMORY_CONFIGS.minProjectedCanvasSize,
        memoryConfigs: MEMORY_CONFIGS,
        loadedChunks: streamController.loadedChunkIds.size,
        loadingChunks: streamController.loadingChunkIds.size,
        totalChunks: streamController.chunkManifests.length,
        loadedObjects: streamController.loadedTotals.objects,
        loadedMeshes: streamController.loadedTotals.meshes,
        backpressure: {...backpressure}
      })
    });

    streamController.prefetchInitial(Math.min(PREFETCH_CHUNKS, streamController.chunkManifests.length));
    scheduleStream("Initial stream");
    scheduleRender();

    window.webgpuBakuStadiumXGFStreamDemo = {
      scene,
      viewer,
      view,
      renderer,
      renderInspector,
      streamController,
      inputController,
      index,
      edgePass: EDGE_PASS,
      depthPrepass: DEPTH_PREPASS,
      gpuTimestamps: GPU_TIMESTAMPS,
      memoryProfile: MEMORY_PROFILE,
      memoryConfigs: MEMORY_CONFIGS,
      backpressure,
      webgpuDiagnostics,
      visibleBenchmark
    };
    window.webgpuBakuStadiumXGFStreamDemo.runInteractionLatencyProfile = (options = {}) => runRendererInteractionLatencyProfile({
      renderer,
      view,
      frames: Number(options.frames || 24),
      radius: Number(options.radius || 240),
      angleStep: Number(options.angleStep || 0.045),
      timeoutMs: Number(options.timeoutMs || 1000)
    });

    window.webgpuBakuStadiumXGFStreamDemo.destroy = () => {
      if (timestampStatusRefresh !== null) {
        window.clearInterval(timestampStatusRefresh);
      }
      if (backpressureRefresh !== null) {
        window.clearInterval(backpressureRefresh);
      }
      window.clearInterval(completionRefresh);
      interactionProfiler?.destroy();
      visibleBenchmark?.destroy();
      inputController.destroy();
      renderer.destroy();
    };
  } catch (error) {
    interactionProfiler?.destroy();
    visibleBenchmark?.destroy();
    inputController.destroy();
    renderer.destroy();
    reportError(error instanceof Error ? error.message : String(error));
  }
}

function renderStatus({streamController, index, renderer, renderInspector, view, message, lastProgressAt, lastQueuedLabel, backpressure, webgpuDiagnostics}) {
  const chunkCount = streamController.chunkManifests.length;
  const objectCount = streamController.loadedTotals.objects;
  const meshCount = streamController.loadedTotals.meshes;
  const secondsSinceProgress = Math.max(0, (performance.now() - lastProgressAt) / 1000);
  const viewIndex = view.viewIndex ?? 0;
  const renderSummary = renderer.getViewRenderStats?.(viewIndex);
  const frameStats = renderInspector?.renderStats?.views?.[viewIndex];
  const renderStatsHTML = renderSummary
    ? `<span>Last WebGPU frame: ${renderSummary.numDrawCalls.toLocaleString()} draw calls, ${renderSummary.numBatches.toLocaleString()} packed batches, ${renderSummary.numPrimitives.toLocaleString()} triangles, ${renderSummary.frameTimeMs.toFixed(2)} ms CPU frame bookkeeping.</span>`
    : "";
  const segmentQueueHTML = frameStats
    ? `<span>Packed triangle segments: ${frameStats.numBuiltSegments.toLocaleString()} resident, ${frameStats.numPendingSegments.toLocaleString()} pending build.</span>`
    : "";
  const segmentBuildHTML = frameStats?.segmentBuildTelemetry
    ? renderSegmentBuildTelemetryHTML(frameStats.segmentBuildTelemetry)
    : "";
  const renderReasonHTML = frameStats
    ? `<span>Render reason: ${escapeHTML(frameStats.renderReason || "unknown")}.</span>`
    : "";
  const cullingHTML = frameStats
    ? `<span>Renderer submission: ${formatCount(frameStats.numRenderedMeshes)} meshes submitted after view/object state filtering.</span>` +
      `<span>Segment batching: ${formatCount(frameStats.numCullSegmentCandidates)} candidates, ${formatCount(frameStats.numFrustumCulledSegments)} frustum culled, ${formatCount(frameStats.numProjectedSizeCulledMeshes)} projected-size culled, ${formatCount(frameStats.numFullyDrawnSegments)} fully drawn, ${formatCount(frameStats.numPartiallyRefinedSegments)} refined to meshes, ${formatCount(frameStats.numTemporaryIndexBuffers)} temporary index buffers created.</span>`
    : "";
  const timingHTML = frameStats
    ? `<span>CPU phases: binning ${frameStats.cpuTime.binningMs.toFixed(2)} ms, batching ${frameStats.cpuTime.batchingMs.toFixed(2)} ms, upload ${frameStats.cpuTime.uploadMs.toFixed(2)} ms, commands ${frameStats.cpuTime.commandEncodingMs.toFixed(2)} ms.</span>`
    : "";
  const commandStateHTML = frameStats
    ? `<span>Command encoding: ${formatCommandState(frameStats.commandState)}.</span>`
    : "";
  const gpuTimingHTML = frameStats?.gpuTime?.available
    ? `<span>GPU pass timings: ${frameStats.gpuTime.pending ? "pending" : formatGPUTimings(frameStats.gpuTime.passes)}.</span>`
    : "";
  const backpressureHTML = backpressure?.enabled
    ? `<span>Stream backpressure: ${backpressure.paused ? "paused" : "open"}; pause above ${formatCount(BACKPRESSURE_PAUSE_PENDING_SEGMENTS)} pending segments, resume at ${formatCount(BACKPRESSURE_RESUME_PENDING_SEGMENTS)}; ${formatCount(backpressure.pauseCount)} pause(s).</span>`
    : "<span>Stream backpressure: disabled.</span>";
  const adapterHTML = webgpuDiagnostics
    ? `<span>WebGPU adapter: ${escapeHTML(formatWebGPUAdapter(webgpuDiagnostics))}.</span>`
    : "";

  return (
    "Streaming Baku Stadium XGF with WebGPU." +
    `<span>Dataset: ${escapeHTML(DATASET)}.</span>` +
    adapterHTML +
    `<span>Memory profile: ${MEMORY_PROFILE}.</span>` +
    `<span>RTC tile size: ${formatCount(MEMORY_CONFIGS.tileSize)} world units.</span>` +
    `<span>Projected-size culling: ${MEMORY_CONFIGS.minProjectedCanvasSize > 0 ? `enabled at ${formatCount(MEMORY_CONFIGS.minProjectedCanvasSize)} px` : "disabled"}.</span>` +
    `<span>Depth prepass: ${DEPTH_PREPASS ? "enabled" : "disabled"}.</span>` +
    `<span>Edge pass: ${EDGE_PASS ? "enabled" : "disabled"}.</span>` +
    `<span>GPU timestamps: ${GPU_TIMESTAMPS ? "enabled" : "disabled"}.</span>` +
    `<span>${escapeHTML(message)}. ${streamController.loadedChunkIds.size}/${chunkCount} chunks loaded from ${index.rootChunkIds.length} root chunks.</span>` +
    `<span>${objectCount.toLocaleString()} objects and ${meshCount.toLocaleString()} meshes currently resident. Last queue: ${escapeHTML(lastQueuedLabel)}. Last progress: ${secondsSinceProgress.toFixed(1)}s ago.</span>` +
    renderStatsHTML +
    segmentQueueHTML +
    segmentBuildHTML +
    renderReasonHTML +
    cullingHTML +
    timingHTML +
    commandStateHTML +
    gpuTimingHTML +
    backpressureHTML +
    "<span>XGF chunks are loaded into one dynamic SceneModel. This example does not frustum-cull or evict chunks; camera movement reuses resident WebGPU draw batches.</span>"
  );
}

function renderSegmentBuildTelemetryHTML(telemetry) {
  const slowest = telemetry.slowestSamples?.[0] || null;
  const recent = telemetry.recentSamples?.[telemetry.recentSamples.length - 1] || null;
  const avgBuildMs = telemetry.totalSegmentsBuilt > 0
    ? telemetry.totalBuildMs / telemetry.totalSegmentsBuilt
    : 0;
  return (
    `<span>Segment build pass: ${formatCount(telemetry.lastBuildSegments)} segment(s), ${formatMs(telemetry.lastBuildMs)} total, ${formatMs(telemetry.lastBuildPackMs)} pack, ${formatMs(telemetry.lastBuildUploadMs)} upload; pending ${formatCount(telemetry.lastBuildPendingBefore)} -> ${formatCount(telemetry.lastBuildPendingAfter)}.</span>` +
    `<span>Segment build totals: ${formatCount(telemetry.totalSegmentsBuilt)} segment(s), avg ${formatMs(avgBuildMs)}, ${formatCount(telemetry.totalMeshCount)} meshes, ${formatCount(telemetry.totalVertexCount)} vertices, ${formatCount(telemetry.totalIndexCount)} indices.</span>` +
    (slowest ? `<span>Slowest segment: ${formatSegmentBuildSample(slowest)}.</span>` : "") +
    (recent ? `<span>Latest segment: ${formatSegmentBuildSample(recent)}.</span>` : "")
  );
}

function formatSegmentBuildSample(sample) {
  return `${escapeHTML(sample.key)} ${formatMs(sample.totalMs)} total, ${formatMs(sample.packMs)} pack, ${formatMs(sample.uploadMs)} upload, ${formatCount(sample.meshCount)} meshes, ${formatCount(sample.vertexCount)} vertices, ${formatCount(sample.indexCount)} indices`;
}

function formatCommandState(commandState) {
  const state = commandState || {};
  const slots = Object.entries(state.bindGroupBindsBySlot || {})
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([slot, count]) => `slot ${escapeHTML(slot)} ${formatCount(count)}`)
    .join(", ");
  return `${formatCount(state.numPipelineBinds)} pipeline binds, ${formatCount(state.numBindGroupBinds)} bind-group binds${slots ? ` (${slots})` : ""}, ${formatCount(state.numVertexBufferBinds)} vertex-buffer binds, ${formatCount(state.numIndexBufferBinds)} index-buffer binds, ${formatCount(state.numBufferPageGroups)} page groups, ${formatCount(state.numRenderStateGroups)} state groups`;
}

function formatMs(value) {
  return Number.isFinite(value) ? `${value.toFixed(2)} ms` : "0.00 ms";
}

function formatGPUTimings(passes) {
  const entries = Object.entries(passes || {});
  if (entries.length === 0) {
    return "unavailable";
  }
  return entries
    .map(([name, value]) => `${escapeHTML(name)} ${Number(value).toFixed(3)} ms`)
    .join(", ");
}

function formatWebGPUAdapter(diagnostics) {
  const info = diagnostics.adapterInfo || {};
  const parts = [];
  for (const key of ["vendor", "architecture", "device", "description"]) {
    if (info[key]) {
      parts.push(String(info[key]));
    }
  }
  if (diagnostics.preferredCanvasFormat) {
    parts.push(`format ${diagnostics.preferredCanvasFormat}`);
  }
  return parts.length > 0 ? parts.join(", ") : "adapter details unavailable";
}

function getMemoryConfigs(profile, dataset) {
  if (profile === "mediumPacked") {
    return {
      maxBatchVertices: 150000,
      maxBatchIndices: 450000,
      maxBatchMeshes: 16384,
      maxBatchGeometries: 16384,
      maxBatchPrims: 150000,
      maxBatchBuildTimeMs: 12,
      maxBatchBuildSegments: dataset === "200" ? -1 : 1,
      tileSize: RTC_TILE_SIZE,
      frustumCulling: FRUSTUM_CULLING,
      minProjectedCanvasSize: MIN_PROJECTED_CANVAS_SIZE,
      compactStreamPages: true,
      compactSealedStreamPages: false
    };
  }
  if (profile === "largePacked") {
    return {
      maxBatchVertices: 900000,
      maxBatchIndices: 2700000,
      maxBatchMeshes: 32768,
      maxBatchGeometries: 32768,
      maxBatchPrims: 900000,
      maxBatchBuildTimeMs: 16,
      tileSize: RTC_TILE_SIZE,
      frustumCulling: FRUSTUM_CULLING,
      minProjectedCanvasSize: MIN_PROJECTED_CANVAS_SIZE,
      compactStreamPages: true
    };
  }
  if (profile === "compact") {
    return {
      maxBatchVertices: 300000,
      maxBatchIndices: 900000,
      maxBatchMeshes: 8192,
      maxBatchGeometries: 8192,
      maxBatchPrims: 300000,
      maxBatchBuildTimeMs: 10,
      tileSize: RTC_TILE_SIZE,
      frustumCulling: FRUSTUM_CULLING,
      minProjectedCanvasSize: MIN_PROJECTED_CANVAS_SIZE,
      compactStreamPages: true
    };
  }
  return {
    maxBatchVertices: 75000,
    maxBatchIndices: 225000,
    maxBatchMeshes: 2048,
    maxBatchGeometries: 2048,
    maxBatchPrims: 75000,
    maxBatchBuildTimeMs: 4,
    tileSize: RTC_TILE_SIZE,
    frustumCulling: FRUSTUM_CULLING,
    minProjectedCanvasSize: MIN_PROJECTED_CANVAS_SIZE,
    compactStreamPages: true
  };
}

function getMemoryProfile() {
  const value = new URLSearchParams(window.location.search).get("memory");
  if (value === "compact" || value === "mediumPacked" || value === "largePacked") {
    return value;
  }
  return "stream";
}

function getBackpressureDefaults(profile) {
  if (profile === "mediumPacked") {
    return {
      pausePendingSegments: 384,
      resumePendingSegments: 192
    };
  }
  if (profile === "largePacked") {
    return {
      pausePendingSegments: 96,
      resumePendingSegments: 32
    };
  }
  return {
    pausePendingSegments: 48,
    resumePendingSegments: 16
  };
}

function getBakuDataset() {
  const value = new URLSearchParams(window.location.search).get("dataset");
  if (value === "200" || value === "2000" || value === "4000") {
    return value;
  }
  return "2000";
}

function getBakuIndexURL(dataset) {
  if (dataset === "200") {
    return "../../../../models/BakuStadium_xgfstream_200/xgfstream/index.runtime.json";
  }
  if (dataset === "4000") {
    return "../../../../models/BakuStadium_xgfstream_4000/xgfstream/index.runtime.json";
  }
  return "../../../../models/BakuStadium_xgfstream_2000/xgfstream/index.runtime.json";
}

function getPositiveNumberParam(name, fallback) {
  const value = Number(new URLSearchParams(window.location.search).get(name));
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function getNonNegativeNumberParam(name, fallback) {
  const value = Number(new URLSearchParams(window.location.search).get(name));
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

function resolveIndexRelativeChunkUris(index, indexUrl) {
  const baseUrl = new URL(".", new URL(indexUrl, window.location.href)).href;
  return {
    ...index,
    chunks: index.chunks.map((manifest) => ({
      ...manifest,
      uri: resolveUri(manifest.uri, baseUrl),
      dependencies: {
        ...manifest.dependencies,
        chunks: (manifest.dependencies?.chunks || []).map((dependency) => ({
          ...dependency,
          uri: resolveUri(dependency.uri, baseUrl)
        }))
      }
    }))
  };
}

function resolveUri(uri, baseUrl) {
  if (!uri || /^[a-z][a-z0-9+.-]*:/i.test(uri)) {
    return uri;
  }
  return new URL(uri, baseUrl).href;
}

async function fetchJSON(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} fetching ${url}`);
  }
  return response.json();
}

function noPick() {
  return {
    ok: true,
    value: null
  };
}

function mustOk(result) {
  if (!result.ok) {
    throw new Error(result.error);
  }
  return result.value;
}

function updateStatus(message) {
  status.dataset.state = "";
  status.innerHTML = `<strong>WebGPU Renderer</strong><span>${escapeHTML(message)}</span>`;
}

function updateStatusHTML(html) {
  status.dataset.state = "";
  status.innerHTML = `<strong>WebGPU Renderer</strong>${html}`;
}

function reportError(message) {
  status.dataset.state = "error";
  status.innerHTML = `<strong>WebGPU Renderer</strong><span>${escapeHTML(message)}</span>`;
  signalExampleLoaded();
  console.error("[benchmarks/streaming/xgf-baku-webgpu]", message);
}

function formatCount(value) {
  return Number.isFinite(value) ? value.toLocaleString() : "0";
}

function escapeHTML(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
