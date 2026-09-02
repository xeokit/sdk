const DEFAULT_UPDATE_MS = 250;

export function installRendererInteractionProfiler({
  label,
  renderer,
  viewer,
  view,
  renderInspector,
  enabled = false,
  updateMs = DEFAULT_UPDATE_MS
}) {
  if (!enabled || !renderer || !viewer || !view) {
    return null;
  }

  const inspector = renderInspector || renderer.getRenderInspector?.()?.value || null;
  if (inspector) {
    inspector.enabled = true;
  }

  const panel = createPanel(label);
  const state = {
    startedAt: performance.now(),
    lastPanelAt: performance.now(),
    inputEvents: 0,
    cameraEvents: 0,
    viewUpdates: 0,
    renderedFrames: 0,
    cameraEventsSinceRender: 0,
    viewUpdatesSinceRender: 0,
    mergedCameraEvents: 0,
    mergedViewUpdates: 0,
    pendingCameraStart: null,
    latencies: [],
    lastLatencyMs: 0,
    lastFrameStats: null
  };

  const disposers = [];
  const recordInput = () => {
    state.inputEvents++;
  };
  const recordCameraEvent = (camera) => {
    if (camera && camera !== view.camera) {
      return;
    }
    state.cameraEvents++;
    state.cameraEventsSinceRender++;
    if (state.pendingCameraStart === null) {
      state.pendingCameraStart = performance.now();
    }
  };
  const recordViewUpdated = (_updatedView, eventView) => {
    const targetView = eventView || _updatedView;
    if (targetView && targetView !== view && targetView.id !== view.id) {
      return;
    }
    state.viewUpdates++;
    state.viewUpdatesSinceRender++;
  };
  const recordRendered = (_renderer, renderedView) => {
    if (renderedView && renderedView !== view && renderedView.id !== view.id) {
      return;
    }
    state.renderedFrames++;
    state.mergedCameraEvents += Math.max(0, state.cameraEventsSinceRender - 1);
    state.mergedViewUpdates += Math.max(0, state.viewUpdatesSinceRender - 1);
    state.cameraEventsSinceRender = 0;
    state.viewUpdatesSinceRender = 0;
    if (state.pendingCameraStart !== null) {
      state.lastLatencyMs = performance.now() - state.pendingCameraStart;
      state.latencies.push(state.lastLatencyMs);
      if (state.latencies.length > 240) {
        state.latencies.shift();
      }
      state.pendingCameraStart = null;
    }
    state.lastFrameStats = getFrameStats({renderer, view, inspector});
  };

  addDOMListener(disposers, view.htmlElement, "pointermove", recordInput, {passive: true});
  addDOMListener(disposers, view.htmlElement, "wheel", recordInput, {passive: true});
  addDOMListener(disposers, view.htmlElement, "pointerdown", recordInput, {passive: true});
  addDOMListener(disposers, window, "keydown", recordInput);
  subscribe(disposers, viewer.events?.onCameraViewMatrixUpdated, recordCameraEvent);
  subscribe(disposers, viewer.events?.onCameraProjMatrixUpdated, recordCameraEvent);
  subscribe(disposers, viewer.events?.onViewUpdated, recordViewUpdated);
  subscribe(disposers, renderer.events?.onViewRendered, recordRendered);

  const timer = window.setInterval(() => updatePanel(panel, state), updateMs);
  disposers.push(() => window.clearInterval(timer));
  updatePanel(panel, state);

  return {
    state,
    panel,
    destroy: () => {
      for (const dispose of disposers.splice(0)) {
        try {
          dispose();
        } catch {
          // Ignore profiler cleanup failures.
        }
      }
      panel.remove();
    }
  };
}

export async function runRendererInteractionLatencyProfile({renderer, view, frames = 24, radius = 1250, angleStep = 0.045, timeoutMs = 1000}) {
  const samples = [];
  for (let i = 0; i < frames; i++) {
    samples.push(await profileInteractionFrame({renderer, view, frameIndex: i, radius, angleStep, timeoutMs}));
  }
  const latencies = samples.map((sample) => sample.latencyMs);
  return {
    frames: samples.length,
    avgLatencyMs: average(latencies),
    p95LatencyMs: percentile(latencies, 0.95),
    maxLatencyMs: Math.max(0, ...latencies),
    timedOut: samples.filter((sample) => sample.timedOut).length,
    samples
  };
}

export function installVisibleBrowserBenchmark({
  label,
  renderer,
  view,
  getDiagnostics,
  getExtraStats,
  getSettledState,
  enabled = false,
  frames = 120,
  radius = 1250,
  angleStep = 0.018,
  settleTimeoutMs = 120000
}) {
  if (!enabled || !renderer || !view) {
    return null;
  }

  const panel = createBenchmarkPanel(label);
  const state = {
    running: false,
    lastResult: null
  };

  const runStreamingButton = panel.querySelector("[data-action='run-streaming']");
  const runSettledButton = panel.querySelector("[data-action='run-settled']");
  const copyButton = panel.querySelector("[data-action='copy']");
  const downloadButton = panel.querySelector("[data-action='download']");
  const output = panel.querySelector("[data-output]");

  const setOutput = (html) => {
    output.innerHTML = html;
  };

  const setButtonsEnabled = (enabled) => {
    runStreamingButton.disabled = !enabled;
    runSettledButton.disabled = !enabled;
    copyButton.disabled = !enabled || !state.lastResult;
    downloadButton.disabled = !enabled || !state.lastResult;
  };

  const run = async (mode = "streaming") => {
    if (state.running) {
      return;
    }
    state.running = true;
    setButtonsEnabled(false);
    setOutput(`<span>${mode === "settled" ? "Waiting for settled stream..." : "Running streaming/build benchmark..."}</span>`);
    try {
      const result = await runVisibleBrowserBenchmark({
        renderer,
        view,
        frames,
        radius,
        angleStep,
        mode,
        getSettledState,
        settleTimeoutMs,
        onSettledWaitProgress: mode === "settled"
          ? (settleState) => setOutput(formatSettledWaitProgress(settleState))
          : null,
        diagnostics: typeof getDiagnostics === "function" ? getDiagnostics() : null,
        getExtraStats
      });
      state.lastResult = result;
      setOutput(formatBenchmarkResult(result));
    } catch (error) {
      setOutput(`<span>Failed: ${escapeHTML(error instanceof Error ? error.message : String(error))}</span>`);
    } finally {
      state.running = false;
      setButtonsEnabled(true);
    }
  };

  const copy = async () => {
    if (!state.lastResult) {
      return;
    }
    const json = JSON.stringify(state.lastResult, null, 2);
    await navigator.clipboard?.writeText?.(json);
    copyButton.textContent = "Copied";
    window.setTimeout(() => {
      copyButton.textContent = "Copy JSON";
    }, 900);
  };

  const download = () => {
    if (!state.lastResult) {
      return;
    }
    const blob = new Blob([JSON.stringify(state.lastResult, null, 2)], {type: "application/json"});
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${slugify(label || "webgpu")}-visible-benchmark.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(link.href), 0);
  };

  const runStreaming = () => run("streaming");
  const runSettled = () => run("settled");
  runStreamingButton.addEventListener("click", runStreaming);
  runSettledButton.addEventListener("click", runSettled);
  copyButton.addEventListener("click", copy);
  downloadButton.addEventListener("click", download);

  return {
    panel,
    get lastResult() {
      return state.lastResult;
    },
    run,
    destroy: () => {
      runStreamingButton.removeEventListener("click", runStreaming);
      runSettledButton.removeEventListener("click", runSettled);
      copyButton.removeEventListener("click", copy);
      downloadButton.removeEventListener("click", download);
      panel.remove();
    }
  };
}

export async function runVisibleBrowserBenchmark({
  renderer,
  view,
  frames = 120,
  radius = 1250,
  angleStep = 0.018,
  mode = "streaming",
  getSettledState = null,
  settleTimeoutMs = 120000,
  onSettledWaitProgress = null,
  diagnostics = null,
  getExtraStats = null
}) {
  const samples = [];
  const startedAt = performance.now();
  const camera = view.camera;
  const originalEye = camera.eye ? Array.from(camera.eye) : null;
  const originalLook = camera.look ? Array.from(camera.look) : null;
  const originalUp = camera.up ? Array.from(camera.up) : null;
  const viewIndex = view.viewIndex ?? 0;
  const benchmarkMode = mode === "settled" ? "settled" : "streaming";
  const settledWait = benchmarkMode === "settled"
    ? await waitForSettledBenchmarkState({
      renderer,
      view,
      getSettledState,
      timeoutMs: settleTimeoutMs,
      onProgress: onSettledWaitProgress
    })
    : null;
  const timedOutBeforeSamples = benchmarkMode === "settled" && settledWait?.settled !== true;
  if (timedOutBeforeSamples) {
    const extraStats = typeof getExtraStats === "function" ? getExtraStats() : null;
    const frameStats = getFrameStats({renderer, view});
    return createVisibleBenchmarkResult({
      startedAt,
      view,
      viewIndex,
      benchmarkMode,
      frames,
      samples,
      diagnostics,
      extraStats,
      settledWait,
      segmentBuildTelemetry: frameStats?.segmentBuildTelemetry ?? null,
      aborted: true,
      abortReason: "settled-timeout"
    });
  }

  let lastRafAt = performance.now();
  for (let i = 0; i < frames; i++) {
    const angle = i * angleStep;
    const frameStart = performance.now();
    camera.eye = [
      Math.cos(angle) * radius,
      Math.sin(angle) * radius,
      560 + Math.sin(angle * 0.5) * 60
    ];
    camera.look = [0, 0, 32];
    view.needsRender?.();
    const rafAt = await nextAnimationFrame();
    await nextAnimationFrame();
    const frameStats = getFrameStats({renderer, view});
    const cpu = frameStats?.cpuTime || {};
    const renderBundleStats = frameStats?.renderBundleStats || {};
    const instanceUpload = frameStats?.instanceUpload || {};
    const segmentBuildTelemetry = frameStats?.segmentBuildTelemetry || {};
    const slowestSegment = segmentBuildTelemetry.slowestSamples?.[0] || null;
    samples.push({
      frameIndex: i,
      rafIntervalMs: rafAt - lastRafAt,
      wallMs: performance.now() - frameStart,
      frameMs: cpu.frameMs ?? null,
      prepareMs: cpu.prepareMs ?? null,
      binningMs: cpu.binningMs ?? null,
      batchingMs: cpu.batchingMs ?? null,
      drawBatchMs: cpu.drawBatchMs ?? null,
      triangleFillClassificationMs: cpu.triangleFillClassificationMs ?? null,
      drawSubmissionMs: cpu.drawSubmissionMs ?? null,
      renderBundleRecordMs: cpu.renderBundleRecordMs ?? null,
      renderBundleReplayMs: cpu.renderBundleReplayMs ?? null,
      uploadMs: cpu.uploadMs ?? null,
      instanceUploadBytes: instanceUpload.byteLength ?? null,
      instanceUploadWrites: instanceUpload.writeCount ?? null,
      instanceUploadRanges: instanceUpload.rangeCount ?? null,
      instanceUploadMaxRangeSlots: instanceUpload.maxRangeSlots ?? null,
      instanceUploadFull: instanceUpload.fullUpload ?? null,
      instanceUploadCopiedBytes: instanceUpload.copiedByteLength ?? null,
      commandEncodingMs: cpu.commandEncodingMs ?? null,
      renderPassEncodingMs: cpu.renderPassEncodingMs ?? null,
      submitMs: cpu.submitMs ?? null,
      renderBundleRecords: renderBundleStats.records ?? null,
      renderBundleReplays: renderBundleStats.replays ?? null,
      renderBundleFallbacks: renderBundleStats.fallbacks ?? null,
      renderBundleSkips: renderBundleStats.skipped ?? null,
      renderBundleInvalidations: renderBundleStats.invalidations ?? null,
      numDrawCalls: frameStats?.numDrawCalls ?? null,
      numBatches: frameStats?.numBatches ?? null,
      numBuiltSegments: frameStats?.numBuiltSegments ?? null,
      numPendingSegments: frameStats?.numPendingSegments ?? null,
      numRenderedMeshes: frameStats?.numRenderedMeshes ?? null,
      numRTCTileMatrixUploads: frameStats?.numRTCTileMatrixUploads ?? null,
      segmentBuildLastSegments: segmentBuildTelemetry.lastBuildSegments ?? null,
      segmentBuildLastMs: segmentBuildTelemetry.lastBuildMs ?? null,
      segmentBuildLastPackMs: segmentBuildTelemetry.lastBuildPackMs ?? null,
      segmentBuildLastUploadMs: segmentBuildTelemetry.lastBuildUploadMs ?? null,
      segmentBuildPendingBefore: segmentBuildTelemetry.lastBuildPendingBefore ?? null,
      segmentBuildPendingAfter: segmentBuildTelemetry.lastBuildPendingAfter ?? null,
      segmentBuildTotalSegments: segmentBuildTelemetry.totalSegmentsBuilt ?? null,
      segmentBuildSlowestMs: slowestSegment?.totalMs ?? null,
      renderReason: frameStats?.renderReason || ""
    });
    lastRafAt = rafAt;
  }

  if (originalEye) camera.eye = originalEye;
  if (originalLook) camera.look = originalLook;
  if (originalUp) camera.up = originalUp;
  view.needsRender?.();

  const extraStats = typeof getExtraStats === "function" ? getExtraStats() : null;
  const frameStats = getFrameStats({renderer, view});
  return createVisibleBenchmarkResult({
    startedAt,
    view,
    viewIndex,
    benchmarkMode,
    frames,
    samples,
    diagnostics,
    extraStats,
    settledWait,
    segmentBuildTelemetry: frameStats?.segmentBuildTelemetry ?? null,
    aborted: false,
    abortReason: null
  });
}

export async function collectWebGPUAdapterDiagnostics(adapter = null) {
  let resolvedAdapter = adapter;
  const result = {
    adapterInfo: null,
    features: [],
    limits: null,
    preferredCanvasFormat: null,
    userAgent: navigator.userAgent,
    isSecureContext: window.isSecureContext === true,
    error: null
  };
  try {
    result.preferredCanvasFormat = navigator.gpu?.getPreferredCanvasFormat?.() || null;
    if (!resolvedAdapter) {
      resolvedAdapter = await navigator.gpu?.requestAdapter?.();
    }
    if (!resolvedAdapter) {
      result.error = "requestAdapter returned null";
      return result;
    }
    result.adapterInfo = serializeAdapterInfo(resolvedAdapter.info ?? (resolvedAdapter.requestAdapterInfo ? await resolvedAdapter.requestAdapterInfo() : null));
    result.features = Array.from(resolvedAdapter.features || []).sort();
    result.limits = serializeAdapterLimits(resolvedAdapter.limits);
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error);
  }
  return result;
}

function profileInteractionFrame({renderer, view, frameIndex, radius, angleStep, timeoutMs}) {
  return new Promise((resolve) => {
    const camera = view.camera;
    const angle = frameIndex * angleStep;
    const start = performance.now();
    let settled = false;
    let unsub = null;
    const finish = (timedOut) => {
      if (settled) {
        return;
      }
      settled = true;
      if (unsub) {
        try {
          unsub();
        } catch {
          // Ignore profiler cleanup failures.
        }
      }
      const renderedAt = performance.now();
      requestAnimationFrame(() => requestAnimationFrame(() => {
        const frameStats = getFrameStats({renderer, view});
        resolve({
          frameIndex,
          latencyMs: renderedAt - start,
          wallMs: performance.now() - start,
          timedOut,
          drawCalls: frameStats?.numDrawCalls || 0,
          commandEncodingMs: frameStats?.cpuTime?.commandEncodingMs || 0,
          batchingMs: frameStats?.cpuTime?.batchingMs || 0,
          uploadMs: frameStats?.cpuTime?.uploadMs || 0,
          pendingSegments: frameStats?.numPendingSegments || 0
        });
      }));
    };
    unsub = renderer.events?.onViewRendered?.subscribe?.((_renderer, renderedView) => {
      if (!renderedView || renderedView === view || renderedView.id === view.id) {
        finish(false);
      }
    }) || null;
    window.setTimeout(() => finish(true), timeoutMs);
    camera.eye = [
      Math.cos(angle) * radius,
      Math.sin(angle) * radius,
      560 + Math.sin(angle * 0.5) * 60
    ];
    camera.look = [0, 0, 32];
    view.needsRender?.();
  });
}

function createPanel(label) {
  ensureStyles();
  const panel = document.createElement("aside");
  panel.className = "xgf-interaction-profiler";
  panel.innerHTML = `<strong>${escapeHTML(label)} interaction</strong><div>Waiting for input...</div>`;
  document.body.appendChild(panel);
  return panel;
}

function createBenchmarkPanel(label) {
  ensureStyles();
  const panel = document.createElement("aside");
  panel.className = "xgf-visible-benchmark";
  panel.innerHTML = `
    <strong>${escapeHTML(label)} benchmark</strong>
    <div class="xgf-visible-benchmark-actions">
      <button type="button" data-action="run-streaming">Run streaming</button>
      <button type="button" data-action="run-settled">Run settled</button>
      <button type="button" data-action="copy" disabled>Copy JSON</button>
      <button type="button" data-action="download" disabled>Download</button>
    </div>
    <div class="xgf-visible-benchmark-output" data-output><span>Ready</span></div>
  `;
  document.body.appendChild(panel);
  return panel;
}

function ensureStyles() {
  if (document.getElementById("xgf-interaction-profiler-style")) {
    return;
  }
  const style = document.createElement("style");
  style.id = "xgf-interaction-profiler-style";
  style.textContent = `
    .xgf-interaction-profiler {
      position: absolute;
      left: 12px;
      bottom: 12px;
      z-index: 200000002;
      width: min(420px, calc(100vw - 24px));
      box-sizing: border-box;
      padding: 10px 12px;
      border-radius: 6px;
      background: rgba(11, 15, 17, 0.84);
      color: #edf4f5;
      box-shadow: 0 12px 34px rgba(0, 0, 0, 0.28);
      font: 12px/1.35 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
      pointer-events: none;
      backdrop-filter: blur(8px);
    }
    .xgf-interaction-profiler strong {
      display: block;
      margin-bottom: 6px;
      font-size: 12px;
    }
    .xgf-interaction-profiler div {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 3px 10px;
    }
    .xgf-interaction-profiler span {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      color: #c9d6d8;
    }
    .xgf-visible-benchmark {
      position: absolute;
      right: 12px;
      bottom: 12px;
      z-index: 200000003;
      width: min(430px, calc(100vw - 24px));
      box-sizing: border-box;
      padding: 10px 12px;
      border-radius: 6px;
      background: rgba(11, 15, 17, 0.88);
      color: #edf4f5;
      box-shadow: 0 12px 34px rgba(0, 0, 0, 0.3);
      font: 12px/1.35 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
      backdrop-filter: blur(8px);
    }
    .xgf-visible-benchmark strong {
      display: block;
      margin-bottom: 8px;
      font-size: 12px;
    }
    .xgf-visible-benchmark-actions {
      display: flex;
      gap: 6px;
      margin-bottom: 8px;
    }
    .xgf-visible-benchmark button {
      appearance: none;
      border: 1px solid rgba(230, 240, 242, 0.25);
      border-radius: 4px;
      background: rgba(230, 240, 242, 0.11);
      color: #f4f8f9;
      padding: 4px 8px;
      font: inherit;
      cursor: pointer;
    }
    .xgf-visible-benchmark button:disabled {
      opacity: 0.45;
      cursor: default;
    }
    .xgf-visible-benchmark-output {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 3px 10px;
    }
    .xgf-visible-benchmark-output span {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      color: #c9d6d8;
    }
  `;
  document.head.appendChild(style);
}

function updatePanel(panel, state) {
  const now = performance.now();
  const elapsedSeconds = Math.max(0.001, (now - state.startedAt) / 1000);
  const frameStats = state.lastFrameStats;
  const cpuTime = frameStats?.cpuTime || {};
  const commandState = frameStats?.commandState || {};
  const renderBundleStats = frameStats?.renderBundleStats || {};
  panel.innerHTML = `
    <strong>${escapeHTML(panel.querySelector("strong")?.textContent || "Interaction")}</strong>
    <div>
      <span>Input ${rate(state.inputEvents, elapsedSeconds)}/s</span>
      <span>Camera ${rate(state.cameraEvents, elapsedSeconds)}/s</span>
      <span>ViewUpdated ${rate(state.viewUpdates, elapsedSeconds)}/s</span>
      <span>Rendered ${rate(state.renderedFrames, elapsedSeconds)}/s</span>
      <span>Latency ${formatMs(state.lastLatencyMs)} avg ${formatMs(average(state.latencies))}</span>
      <span>P95 ${formatMs(percentile(state.latencies, 0.95))}</span>
      <span>Merged camera ${formatCount(state.mergedCameraEvents)}</span>
      <span>Merged view ${formatCount(state.mergedViewUpdates)}</span>
      <span>Draws ${formatCount(frameStats?.numDrawCalls)}</span>
      <span>Batches ${formatCount(frameStats?.numBatches)}</span>
      <span>CPU bin ${formatMs(cpuTime.binningMs)}</span>
      <span>fill ${formatMs(cpuTime.triangleFillClassificationMs)}</span>
      <span>batch ${formatMs(cpuTime.batchingMs)}</span>
      <span>draw ${formatMs(cpuTime.drawSubmissionMs)}</span>
      <span>bundle rec ${formatMs(cpuTime.renderBundleRecordMs)}</span>
      <span>bundle replay ${formatMs(cpuTime.renderBundleReplayMs)}</span>
      <span>upload ${formatMs(cpuTime.uploadMs)}</span>
      <span>pass ${formatMs(cpuTime.renderPassEncodingMs)}</span>
      <span>cmd ${formatMs(cpuTime.commandEncodingMs)}</span>
      <span>Bundles ${formatCount(renderBundleStats.records)}/${formatCount(renderBundleStats.replays)}/${formatCount(renderBundleStats.fallbacks)}/${formatCount(renderBundleStats.skipped)}</span>
      <span>Multi ${formatCount(commandState.numMultiDrawIndexedIndirectCalls)}/${formatCount(commandState.numMultiDrawIndexedIndirectDraws)}</span>
      <span>Binds ${formatCount(commandState.numPipelineBinds)}/${formatCount(commandState.numVertexBufferBinds)}/${formatCount(commandState.numIndexBufferBinds)}/${formatCount(commandState.numBindGroupBinds)}</span>
      <span>GPU ${formatGPU(frameStats)}</span>
    </div>
  `;
  state.lastPanelAt = now;
}

function getFrameStats({renderer, view, inspector}) {
  const viewIndex = view.viewIndex ?? 0;
  const renderInspector = inspector || renderer.getRenderInspector?.()?.value;
  return renderInspector?.renderStats?.views?.[viewIndex] || null;
}

function summarizeBenchmarkSamples(samples) {
  const get = (key) => summarizeNumbers(samples.map((sample) => sample[key]));
  return {
    rafIntervalMs: get("rafIntervalMs"),
    wallMs: get("wallMs"),
    frameMs: get("frameMs"),
    prepareMs: get("prepareMs"),
    binningMs: get("binningMs"),
    batchingMs: get("batchingMs"),
    drawBatchMs: get("drawBatchMs"),
    triangleFillClassificationMs: get("triangleFillClassificationMs"),
    drawSubmissionMs: get("drawSubmissionMs"),
    renderBundleRecordMs: get("renderBundleRecordMs"),
    renderBundleReplayMs: get("renderBundleReplayMs"),
    uploadMs: get("uploadMs"),
    renderPassEncodingMs: get("renderPassEncodingMs"),
    commandEncodingMs: get("commandEncodingMs"),
    submitMs: get("submitMs"),
    renderBundleRecords: get("renderBundleRecords"),
    renderBundleReplays: get("renderBundleReplays"),
    renderBundleFallbacks: get("renderBundleFallbacks"),
    renderBundleSkips: get("renderBundleSkips"),
    renderBundleInvalidations: get("renderBundleInvalidations"),
    numDrawCalls: get("numDrawCalls"),
    numBuiltSegments: get("numBuiltSegments"),
    numPendingSegments: get("numPendingSegments"),
    numRenderedMeshes: get("numRenderedMeshes"),
    segmentBuildLastSegments: get("segmentBuildLastSegments"),
    segmentBuildLastMs: get("segmentBuildLastMs"),
    segmentBuildLastPackMs: get("segmentBuildLastPackMs"),
    segmentBuildLastUploadMs: get("segmentBuildLastUploadMs"),
    segmentBuildSlowestMs: get("segmentBuildSlowestMs"),
    renderReasons: countValues(samples.map((sample) => sample.renderReason || "unknown"))
  };
}

function createVisibleBenchmarkResult({
  startedAt,
  view,
  viewIndex,
  benchmarkMode,
  frames,
  samples,
  diagnostics,
  extraStats,
  settledWait,
  segmentBuildTelemetry,
  aborted,
  abortReason
}) {
  return {
    generatedAt: new Date().toISOString(),
    label: String(extraStats?.label || "WebGPU visible benchmark"),
    benchmarkMode,
    aborted,
    abortReason,
    userAgent: navigator.userAgent,
    viewport: {
      width: view.boundary?.[2] ?? view.htmlElement?.clientWidth ?? null,
      height: view.boundary?.[3] ?? view.htmlElement?.clientHeight ?? null,
      devicePixelRatio: window.devicePixelRatio
    },
    durationMs: performance.now() - startedAt,
    requestedFrames: frames,
    capturedFrames: samples.length,
    settledWait,
    segmentBuildTelemetry,
    diagnostics,
    extraStats,
    summary: summarizeBenchmarkSamples(samples),
    samples,
    viewIndex
  };
}

async function waitForSettledBenchmarkState({renderer, view, getSettledState, timeoutMs, onProgress}) {
  const startedAt = performance.now();
  const samples = [];
  let lastProgressAt = 0;
  let finalState = null;

  while (performance.now() - startedAt <= timeoutMs) {
    view.needsRender?.();
    await nextAnimationFrame();
    await nextAnimationFrame();

    const elapsedMs = performance.now() - startedAt;
    const frameStats = getFrameStats({renderer, view});
    const suppliedState = typeof getSettledState === "function" ? getSettledState() : null;
    const state = normalizeSettledState({frameStats, suppliedState, elapsedMs});
    samples.push(state);
    finalState = state;

    if (elapsedMs - lastProgressAt >= 500) {
      onProgress?.(state);
      lastProgressAt = elapsedMs;
    }
    if (state.settled) {
      onProgress?.(state);
      return {
        settled: true,
        waitedMs: elapsedMs,
        finalState: state,
        samples
      };
    }
  }

  const elapsedMs = performance.now() - startedAt;
  return {
    settled: false,
    waitedMs: elapsedMs,
    finalState,
    samples
  };
}

function normalizeSettledState({frameStats, suppliedState, elapsedMs}) {
  const state = {
    elapsedMs,
    loadedChunks: suppliedState?.loadedChunks ?? null,
    loadingChunks: suppliedState?.loadingChunks ?? null,
    totalChunks: suppliedState?.totalChunks ?? null,
    pendingSegments: suppliedState?.pendingSegments ?? frameStats?.numPendingSegments ?? null,
    builtSegments: suppliedState?.builtSegments ?? frameStats?.numBuiltSegments ?? null,
    renderReason: frameStats?.renderReason || "",
    settled: false
  };
  const chunksSettled =
    !Number.isFinite(state.totalChunks) ||
    (Number.isFinite(state.loadedChunks) && state.loadedChunks >= state.totalChunks && (state.loadingChunks || 0) === 0);
  const segmentsSettled = !Number.isFinite(state.pendingSegments) || state.pendingSegments === 0;
  const suppliedSettled = suppliedState?.settled;
  state.settled = suppliedSettled === true || (suppliedSettled !== false && chunksSettled && segmentsSettled);
  return state;
}

function summarizeNumbers(values) {
  const sorted = values
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
  if (sorted.length === 0) {
    return {
      median: null,
      p95: null,
      max: null
    };
  }
  return {
    median: percentile(sorted, 0.5),
    p95: percentile(sorted, 0.95),
    max: sorted[sorted.length - 1]
  };
}

function countValues(values) {
  return values.reduce((result, value) => {
    result[value] = (result[value] || 0) + 1;
    return result;
  }, {});
}

function formatBenchmarkResult(result) {
  const summary = result.summary || {};
  const wait = result.settledWait;
  const waitHTML = wait
    ? `<span>Wait ${wait.settled ? "settled" : "timed out"} ${formatNullableMs(wait.waitedMs)}</span>`
    : `<span>Mode ${escapeHTML(result.benchmarkMode || "streaming")}</span>`;
  const abortHTML = result.aborted
    ? `<span>Aborted ${escapeHTML(result.abortReason || "unknown")}</span>`
    : "";
  return `
    ${waitHTML}
    ${abortHTML}
    <span>Frames ${formatCount(result.capturedFrames)}/${formatCount(result.requestedFrames)}</span>
    <span>RAF med ${formatNullableMs(summary.rafIntervalMs?.median)}</span>
    <span>RAF p95 ${formatNullableMs(summary.rafIntervalMs?.p95)}</span>
    <span>RAF max ${formatNullableMs(summary.rafIntervalMs?.max)}</span>
    <span>CPU med ${formatNullableMs(summary.frameMs?.median)}</span>
    <span>CPU p95 ${formatNullableMs(summary.frameMs?.p95)}</span>
    <span>Batch med ${formatNullableMs(summary.batchingMs?.median)}</span>
    <span>Draw med ${formatNullableMs(summary.drawSubmissionMs?.median)}</span>
    <span>Bundle rec med ${formatNullableMs(summary.renderBundleRecordMs?.median)}</span>
    <span>Bundle replay ms med ${formatNullableMs(summary.renderBundleReplayMs?.median)}</span>
    <span>Upload med ${formatNullableMs(summary.uploadMs?.median)}</span>
    <span>Pass med ${formatNullableMs(summary.renderPassEncodingMs?.median)}</span>
    <span>Cmd med ${formatNullableMs(summary.commandEncodingMs?.median)}</span>
    <span>Bundle replay med ${formatNullableCount(summary.renderBundleReplays?.median)}</span>
    <span>Draws med ${formatNullableCount(summary.numDrawCalls?.median)}</span>
    <span>Built seg med ${formatNullableCount(summary.numBuiltSegments?.median)}</span>
    <span>Pending med ${formatNullableCount(summary.numPendingSegments?.median)}</span>
    <span>Build med ${formatNullableMs(summary.segmentBuildLastMs?.median)}</span>
    <span>Build p95 ${formatNullableMs(summary.segmentBuildLastMs?.p95)}</span>
  `;
}

function formatSettledWaitProgress(state) {
  return `
    <span>Waiting ${formatNullableMs(state.elapsedMs)}</span>
    <span>Chunks ${formatNullableCount(state.loadedChunks)}/${formatNullableCount(state.totalChunks)}</span>
    <span>Loading ${formatNullableCount(state.loadingChunks)}</span>
    <span>Pending seg ${formatNullableCount(state.pendingSegments)}</span>
  `;
}

function formatNullableMs(value) {
  return Number.isFinite(value) ? `${value.toFixed(2)}ms` : "n/a";
}

function formatNullableCount(value) {
  return Number.isFinite(value) ? Math.round(value).toLocaleString() : "n/a";
}

function nextAnimationFrame() {
  return new Promise((resolve) => requestAnimationFrame(resolve));
}

function slugify(value) {
  return String(value || "webgpu")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "webgpu";
}

function serializeAdapterInfo(info) {
  if (!info) {
    return null;
  }
  const result = {};
  for (const key of ["vendor", "architecture", "device", "description", "subgroupMinSize", "subgroupMaxSize"]) {
    const value = info[key];
    if (value !== undefined && value !== "") {
      result[key] = value;
    }
  }
  return Object.keys(result).length > 0 ? result : null;
}

function serializeAdapterLimits(limits) {
  if (!limits) {
    return null;
  }
  const result = {};
  for (const key of [
    "maxTextureDimension2D",
    "maxBufferSize",
    "maxStorageBufferBindingSize",
    "maxUniformBufferBindingSize",
    "maxBindGroups",
    "maxVertexBuffers"
  ]) {
    const value = limits[key];
    if (Number.isFinite(value)) {
      result[key] = value;
    }
  }
  return Object.keys(result).length > 0 ? result : null;
}

function addDOMListener(disposers, target, type, handler, options) {
  if (!target?.addEventListener) {
    return;
  }
  target.addEventListener(type, handler, options);
  disposers.push(() => target.removeEventListener(type, handler, options));
}

function subscribe(disposers, event, handler) {
  const unsub = event?.subscribe?.(handler);
  if (typeof unsub === "function") {
    disposers.push(unsub);
  }
}

function rate(count, seconds) {
  return (count / seconds).toFixed(1);
}

function average(values) {
  if (!values?.length) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function percentile(values, ratio) {
  if (!values?.length) {
    return 0;
  }
  const sorted = values.slice().sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * ratio) - 1));
  return sorted[index];
}

function formatMs(value) {
  return Number.isFinite(value) ? `${value.toFixed(2)}ms` : "n/a";
}

function formatCount(value) {
  return Number.isFinite(value) ? Math.round(value).toLocaleString() : "0";
}

function formatGPU(frameStats) {
  if (Number.isFinite(frameStats?.gpuTimeMs)) {
    return `${frameStats.gpuTimeMs.toFixed(2)}ms`;
  }
  const passes = frameStats?.gpuTime?.passes || {};
  const total = Object.values(passes).reduce((sum, value) => sum + (Number(value) || 0), 0);
  return total > 0 ? `${total.toFixed(2)}ms` : "n/a";
}

function escapeHTML(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
