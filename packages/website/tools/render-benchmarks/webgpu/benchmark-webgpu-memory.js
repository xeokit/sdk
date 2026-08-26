// Captures WebGPURenderer memory/debug stats from representative XGF examples.
//
// Starts a temporary website server, opens each example in Chromium, waits for a
// rendered WebGPU frame, then reads renderer.getMemoryStats() and
// getViewRenderStats() directly from the example's window demo object.

const fs = require("fs");
const http = require("http");
const path = require("path");
const {createRequire} = require("module");

const websiteRoot = path.resolve(__dirname, "..", "..", "..");
const websiteRequire = createRequire(path.join(websiteRoot, "package.json"));
const puppeteer = websiteRequire("puppeteer");

const DEFAULTS = {
  settleTimeoutMs: 180000,
  viewportWidth: 1280,
  viewportHeight: 800,
  interactionFrames: 0,
  includeExpensive: false,
  onlyExpensive: false,
  bakuTargetChunks: 16,
  exampleFilter: "",
  outputPath: "",
  chromeGpuBackend: "vulkan",
};

const DEFAULT_EXAMPLES = [
  {
    name: "xgf-procedural-city-compact",
    path: "/examples/formats_xgf_streaming_proceduralCity_webGPU/index.html?stats=1&memory=compact&depth=0&edges=0&tileSize=1000",
    demoName: "webgpuProceduralCityXGFStreamDemo",
    streaming: true,
  },
  {
    name: "xgf-procedural-city-large-static",
    path: "/examples/formats_xgf_streaming_proceduralCity_webGPU/index.html?stats=1&memory=largeStatic&depth=0&edges=0&tileSize=1000",
    demoName: "webgpuProceduralCityXGFStreamDemo",
    streaming: true,
  },
  {
    name: "xgf-map-static",
    path: "/examples/formats_xgf_map_webGPU/index.html?stats=1",
    demoName: "webgpuXGFMapDemo",
    streaming: false,
  },
];

const EXPENSIVE_EXAMPLES = [
  {
    name: "xgf-baku-200-compact",
    path: "/examples/formats_xgf_streaming_baku_webGPU/index.html?stats=1&dataset=200&memory=compact&depth=0&edges=0&tileSize=1000",
    demoName: "webgpuBakuStadiumXGFStreamDemo",
    streaming: true,
    targetChunks: "bakuTargetChunks",
  },
  {
    name: "xgf-baku-200-medium-packed",
    path: "/examples/formats_xgf_streaming_baku_webGPU/index.html?stats=1&dataset=200&memory=mediumPacked&depth=0&edges=0&tileSize=1000",
    demoName: "webgpuBakuStadiumXGFStreamDemo",
    streaming: true,
    targetChunks: "bakuTargetChunks",
  },
  {
    name: "xgf-baku-200-large-packed",
    path: "/examples/formats_xgf_streaming_baku_webGPU/index.html?stats=1&dataset=200&memory=largePacked&depth=0&edges=0&tileSize=1000",
    demoName: "webgpuBakuStadiumXGFStreamDemo",
    streaming: true,
    targetChunks: "bakuTargetChunks",
  },
];

function parseArgs(argv) {
  const args = {...DEFAULTS};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--settle-timeout-ms") {
      args.settleTimeoutMs = parsePositiveInt(argv[++i], "settle timeout");
    } else if (arg === "--viewport") {
      const value = argv[++i] || "";
      const match = /^(\d+)x(\d+)$/.exec(value);
      if (!match) {
        throw new Error("--viewport must use WIDTHxHEIGHT, for example 1280x800");
      }
      args.viewportWidth = parsePositiveInt(match[1], "viewport width");
      args.viewportHeight = parsePositiveInt(match[2], "viewport height");
    } else if (arg === "--output") {
      args.outputPath = path.resolve(argv[++i] || "");
    } else if (arg === "--interaction-frames") {
      args.interactionFrames = parseNonNegativeInt(argv[++i], "interaction frames");
    } else if (arg === "--include-expensive") {
      args.includeExpensive = true;
    } else if (arg === "--only-expensive") {
      args.onlyExpensive = true;
      args.includeExpensive = true;
    } else if (arg === "--baku-target-chunks") {
      args.bakuTargetChunks = parsePositiveInt(argv[++i], "Baku target chunks");
    } else if (arg === "--example") {
      args.exampleFilter = argv[++i] || "";
    } else if (arg === "--chrome-gpu-backend") {
      args.chromeGpuBackend = parseChromeGpuBackend(argv[++i] || "");
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return args;
}

function printHelp() {
  console.log(`Usage: node packages/website/tools/render-benchmarks/webgpu/benchmark-webgpu-memory.js [options]

Options:
  --settle-timeout-ms <n>      Max wait for each example. Default ${DEFAULTS.settleTimeoutMs}.
  --viewport <WIDTHxHEIGHT>    Browser viewport. Default ${DEFAULTS.viewportWidth}x${DEFAULTS.viewportHeight}.
  --interaction-frames <n>     Rotate camera and summarize n rendered frames. Default ${DEFAULTS.interactionFrames}.
  --include-expensive          Include slow-loading stress examples such as Baku Stadium.
  --only-expensive             Run only expensive stress examples.
  --baku-target-chunks <n>     Loaded chunk target for bounded Baku profiling. Default ${DEFAULTS.bakuTargetChunks}.
  --example <name>             Run one matching example name.
  --chrome-gpu-backend <name>  Chrome GPU flags: default, vulkan, angle-vulkan, swiftshader. Default ${DEFAULTS.chromeGpuBackend}.
  --output <path>              Optional JSON output path.
`);
}

function parseChromeGpuBackend(value) {
  if (value === "default" || value === "vulkan" || value === "angle-vulkan" || value === "swiftshader") {
    return value;
  }
  throw new Error(`Invalid Chrome GPU backend: ${value}`);
}

function parsePositiveInt(value, name) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid ${name}: ${value}`);
  }
  return parsed;
}

function parseNonNegativeInt(value, name) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`Invalid ${name}: ${value}`);
  }
  return parsed;
}

function createStaticServer(rootDir) {
  const server = http.createServer((request, response) => {
    const requestUrl = new URL(request.url || "/", "http://127.0.0.1");
    let pathname = decodeURIComponent(requestUrl.pathname);
    if (pathname === "/") {
      pathname = "/index.html";
    }
    const filePath = path.normalize(path.join(rootDir, pathname));
    if (!filePath.startsWith(rootDir + path.sep)) {
      response.writeHead(403);
      response.end("Forbidden");
      return;
    }
    fs.stat(filePath, (statError, stat) => {
      if (statError || !stat.isFile()) {
        response.writeHead(404);
        response.end("Not found");
        return;
      }
      response.writeHead(200, {"Content-Type": getContentType(filePath)});
      fs.createReadStream(filePath).pipe(response);
    });
  });
  return server;
}

function getContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".html") return "text/html; charset=utf-8";
  if (ext === ".js" || ext === ".mjs") return "text/javascript; charset=utf-8";
  if (ext === ".json") return "application/json; charset=utf-8";
  if (ext === ".wasm") return "application/wasm";
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".css") return "text/css; charset=utf-8";
  if (ext === ".xgf") return "application/octet-stream";
  return "application/octet-stream";
}

function listen(server) {
  return new Promise((resolve, reject) => {
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => resolve(server.address().port));
  });
}

function close(server) {
  return new Promise(resolve => server.close(() => resolve()));
}

function createChromeLaunchArgs(args) {
  const backend = String(args.chromeGpuBackend || "default").trim();
  const chromeArgs = [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--enable-unsafe-webgpu",
    "--ignore-gpu-blocklist",
    `--window-size=${args.viewportWidth},${args.viewportHeight}`,
  ];
  if (backend === "vulkan") {
    chromeArgs.push("--enable-features=Vulkan");
  } else if (backend === "angle-vulkan") {
    chromeArgs.push("--use-angle=vulkan");
    chromeArgs.push("--enable-features=Vulkan,VulkanFromANGLE,DefaultANGLEVulkan");
  } else if (backend === "swiftshader") {
    chromeArgs.push("--enable-unsafe-swiftshader");
    chromeArgs.push("--use-angle=swiftshader");
  }
  return chromeArgs;
}

async function collectBrowserDiagnostics(browser) {
  const diagnostics = {
    version: null,
    gpuFeatureStatus: null,
    gpuDevices: [],
    auxAttributes: null,
    error: null
  };
  let session = null;
  try {
    session = await browser.target().createCDPSession();
    diagnostics.version = await session.send("Browser.getVersion").catch(() => null);
    const systemInfo = await session.send("SystemInfo.getInfo").catch(() => null);
    if (systemInfo) {
      diagnostics.gpuFeatureStatus = systemInfo.gpu?.featureStatus || null;
      diagnostics.gpuDevices = systemInfo.gpu?.devices || [];
      diagnostics.auxAttributes = systemInfo.gpu?.auxAttributes || null;
    }
  } catch (error) {
    diagnostics.error = error instanceof Error ? error.message : String(error);
  } finally {
    await session?.detach?.().catch(() => {});
  }
  return diagnostics;
}

async function runExample(browser, baseUrl, example, args) {
  const page = await browser.newPage();
  const pageErrors = [];
  const consoleErrors = [];
  const httpErrors = [];
  const url = `${baseUrl}${example.path}`;
  try {
    await page.setViewport({
      width: args.viewportWidth,
      height: args.viewportHeight,
      deviceScaleFactor: 1,
    });
    page.on("pageerror", error => pageErrors.push(error.message));
    page.on("console", message => {
      if (message.type() === "error") {
        const location = message.location();
        if (!location.url.endsWith("/favicon.ico")) {
          consoleErrors.push({text: message.text(), url: location.url});
        }
      }
    });
    page.on("requestfailed", request => {
      const failure = request.failure();
      pageErrors.push(`request failed: ${request.url()} (${failure ? failure.errorText : "unknown"})`);
    });
    page.on("response", response => {
      if (response.status() >= 400 && !response.url().endsWith("/favicon.ico")) {
        httpErrors.push({status: response.status(), url: response.url()});
      }
    });

    await page.goto(url, {waitUntil: "domcontentloaded", timeout: 60000});
    const pageWebGPUDiagnostics = await collectPageWebGPUDiagnostics(page);
    await page.waitForFunction((demoName) => {
      return !!window[demoName] || document.getElementById("status")?.dataset.state === "error";
    }, {timeout: args.settleTimeoutMs}, example.demoName);

    const initial = await sample(page, example);
    if (!initial.ready) {
      return {
        name: example.name,
        ok: false,
        url,
        error: initial.statusText || `Example did not expose ${example.demoName}.`,
        pageErrors,
        consoleErrors,
        httpErrors,
        webgpuDiagnostics: pageWebGPUDiagnostics,
      };
    }

    if (example.streaming) {
      await waitForStreamSettled(page, example, args.settleTimeoutMs, getExampleTargetChunks(example, args));
    }
    await waitForRendererSettled(page, example, Math.min(args.settleTimeoutMs, 60000), getExampleTargetChunks(example, args));
    await renderCameraFrame(page, example);
    await waitForRendererSettled(page, example, 30000, getExampleTargetChunks(example, args));

    const interaction = args.interactionFrames > 0
      ? await runInteractionBenchmark(page, example, args.interactionFrames)
      : null;
    const finalSample = await sample(page, example);
    return {
      name: example.name,
      ok: pageErrors.length === 0 && consoleErrors.length === 0 && httpErrors.length === 0,
      url,
      ...finalSample,
      interaction,
      pageErrors,
      consoleErrors,
      httpErrors,
      webgpuDiagnostics: finalSample.webgpuDiagnostics || pageWebGPUDiagnostics,
    };
  } finally {
    await page.close();
  }
}

async function collectPageWebGPUDiagnostics(page) {
  return page.evaluate(async () => {
    const result = {
      userAgent: navigator.userAgent,
      isSecureContext: window.isSecureContext === true,
      webgpuSupported: !!navigator.gpu,
      preferredCanvasFormat: null,
      adapterInfo: null,
      adapterFeatures: [],
      adapterLimits: null,
      error: null
    };
    try {
      result.preferredCanvasFormat = navigator.gpu?.getPreferredCanvasFormat?.() || null;
      const adapter = await navigator.gpu?.requestAdapter?.();
      if (!adapter) {
        result.error = "requestAdapter returned null";
        return result;
      }
      result.adapterInfo = serializeAdapterInfo(adapter.info ?? (adapter.requestAdapterInfo ? await adapter.requestAdapterInfo() : null));
      result.adapterFeatures = Array.from(adapter.features || []).sort();
      result.adapterLimits = serializeAdapterLimits(adapter.limits);
    } catch (error) {
      result.error = error instanceof Error ? error.message : String(error);
    }
    return result;

    function serializeAdapterInfo(info) {
      if (!info) {
        return null;
      }
      const serialized = {};
      for (const key of ["vendor", "architecture", "device", "description", "subgroupMinSize", "subgroupMaxSize"]) {
        const value = info[key];
        if (value !== undefined && value !== "") {
          serialized[key] = value;
        }
      }
      return Object.keys(serialized).length > 0 ? serialized : null;
    }

    function serializeAdapterLimits(limits) {
      if (!limits) {
        return null;
      }
      const serialized = {};
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
          serialized[key] = value;
        }
      }
      return Object.keys(serialized).length > 0 ? serialized : null;
    }
  });
}

async function waitForStreamSettled(page, example, timeoutMs, targetChunks) {
  const started = Date.now();
  let lastLog = 0;
  while (Date.now() - started < timeoutMs) {
    const progress = await getExampleProgress(page, example, targetChunks);
    if (progress.ready && progress.streamSettled) {
      return;
    }
    const elapsed = Date.now() - started;
    if (elapsed - lastLog >= 5000) {
      lastLog = elapsed;
      console.log(`  ${example.name}: ${formatProgress(progress)}`);
    }
    await delay(250);
  }
  const progress = await getExampleProgress(page, example, targetChunks);
  console.log(`  ${example.name}: stream wait timed out: ${formatProgress(progress)}`);
}

async function waitForRendererSettled(page, example, timeoutMs, targetChunks) {
  await page.waitForFunction((demoName, streaming, targetChunkCount) => {
    const demo = window[demoName];
    if (!demo) {
      return false;
    }
    const viewIndex = demo.view.viewIndex ?? 0;
    const frame = demo.renderer.getRenderInspector?.()?.value?.renderStats?.views?.[viewIndex];
    if (!frame) {
      return false;
    }
    if (!streaming) {
      return true;
    }
    const streamController = demo.streamController;
    const loadedTarget = Number.isFinite(targetChunkCount) && targetChunkCount > 0
      ? Math.min(targetChunkCount, streamController.chunkManifests.length)
      : streamController.chunkManifests.length;
    return streamController.loadedChunkIds.size >= loadedTarget
      && streamController.loadingChunkIds.size === 0
      && (frame.numPendingSegments || 0) === 0;
  }, {timeout: timeoutMs}, example.demoName, example.streaming, targetChunks).catch(() => {});
}

async function getExampleProgress(page, example, targetChunks) {
  return page.evaluate((demoName, targetChunkCount) => {
    const demo = window[demoName];
    const streamController = demo?.streamController;
    const viewIndex = demo?.view?.viewIndex ?? 0;
    const frame = demo?.renderer?.getRenderInspector?.()?.value?.renderStats?.views?.[viewIndex] || null;
    if (!demo || !streamController) {
      return {
        ready: false,
        streamSettled: false,
        statusText: document.getElementById("status")?.innerText || ""
      };
    }
    const target = Number.isFinite(targetChunkCount) && targetChunkCount > 0
      ? Math.min(targetChunkCount, streamController.chunkManifests.length)
      : streamController.chunkManifests.length;
    const loaded = streamController.loadedChunkIds.size;
    const loading = streamController.loadingChunkIds.size;
    if (loaded >= target && Number.isFinite(targetChunkCount) && targetChunkCount > 0) {
      streamController.pause?.();
    }
    const streamSettled = loaded >= target && loading === 0;
    return {
      ready: true,
      streamSettled,
      paused: streamController.paused,
      loaded,
      loading,
      target,
      total: streamController.chunkManifests.length,
      objects: streamController.loadedTotals?.objects ?? 0,
      meshes: streamController.loadedTotals?.meshes ?? 0,
      pendingSegments: frame?.numPendingSegments ?? null,
      builtSegments: frame?.numBuiltSegments ?? null,
      renderReason: frame?.renderReason || "",
      frameMs: frame?.cpuTime?.frameMs ?? null,
      prepareMs: frame?.cpuTime?.prepareMs ?? null,
      binningMs: frame?.cpuTime?.binningMs ?? null,
      drawBatchMs: frame?.cpuTime?.drawBatchMs ?? null,
      uploadMs: frame?.cpuTime?.uploadMs ?? null,
      commandEncodingMs: frame?.cpuTime?.commandEncodingMs ?? null,
      statusText: document.getElementById("status")?.innerText || ""
    };
  }, example.demoName, targetChunks);
}

function formatProgress(progress) {
  if (!progress.ready) {
    return `not ready (${progress.statusText || "no status"})`;
  }
  return `${formatInt(progress.loaded)}/${formatInt(progress.total)} chunks target ${formatInt(progress.target)}, ` +
    `${formatInt(progress.loading)} loading, ${formatInt(progress.objects)} objects, ${formatInt(progress.meshes)} meshes, ` +
    `${formatInt(progress.builtSegments)} built segments, ${formatInt(progress.pendingSegments)} pending, ` +
    `reason ${progress.renderReason || "n/a"}, frame ${formatMs(progress.frameMs)} ` +
    `(prep ${formatMs(progress.prepareMs)}, bin ${formatMs(progress.binningMs)}, draw ${formatMs(progress.drawBatchMs)}, ` +
    `upload ${formatMs(progress.uploadMs)}, encode ${formatMs(progress.commandEncodingMs)}), ` +
    `paused ${progress.paused ? "yes" : "no"}`;
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function renderCameraFrame(page, example) {
  await page.evaluate((demoName) => new Promise(resolve => {
    const demo = window[demoName];
    if (!demo) {
      resolve();
      return;
    }
    const camera = demo.view.camera;
    const eye = camera.eye || [1, -1, 1];
    const look = camera.look || [0, 0, 0];
    const dx = eye[0] - look[0];
    const dy = eye[1] - look[1];
    const dz = eye[2] - look[2];
    camera.eye = [
      look[0] + dx * 0.995 - dy * 0.1,
      look[1] + dx * 0.1 + dy * 0.995,
      look[2] + dz
    ];
    demo.view.needsRender();
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  }), example.demoName);
}

async function runInteractionBenchmark(page, example, frames) {
  return page.evaluate(async (demoName, frameCount) => {
    const demo = window[demoName];
    if (!demo) {
      return null;
    }
    const view = demo.view;
    const camera = view.camera;
    const viewIndex = view.viewIndex ?? 0;
    const samples = [];
    const raf = () => new Promise(resolve => requestAnimationFrame(resolve));
    for (let i = 0; i < frameCount; i++) {
      const eye = camera.eye || [1, -1, 1];
      const look = camera.look || [0, 0, 0];
      const dx = eye[0] - look[0];
      const dy = eye[1] - look[1];
      const dz = eye[2] - look[2];
      const angle = 0.012;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      camera.eye = [
        look[0] + dx * cos - dy * sin,
        look[1] + dx * sin + dy * cos,
        look[2] + dz
      ];
      view.needsRender();
      await raf();
      await raf();
      const renderSummary = demo.renderer.getViewRenderStats?.(viewIndex) || null;
      const frame = demo.renderer.getRenderInspector?.()?.value?.renderStats?.views?.[viewIndex] || null;
      if (!frame && !renderSummary) {
        continue;
      }
      const cpu = frame?.cpuTime || renderSummary?.cpuTime || {};
      samples.push({
        frameMs: cpu.frameMs,
        commandEncodingMs: cpu.commandEncodingMs,
        submitMs: cpu.submitMs,
        prepareMs: cpu.prepareMs,
        batchingMs: cpu.batchingMs,
        binningMs: cpu.binningMs,
        drawBatchMs: cpu.drawBatchMs,
        uploadMs: cpu.uploadMs,
        numDrawCalls: frame?.numDrawCalls || renderSummary?.numDrawCalls || 0,
        numRTCTileMatrixUploads: frame?.numRTCTileMatrixUploads || renderSummary?.numRTCTileMatrixUploads || 0,
        renderReason: frame?.renderReason || ""
      });
    }
    return {
      requestedFrames: frameCount,
      frames: samples
    };
  }, example.demoName, frames);
}

async function sample(page, example) {
  return page.evaluate((demoName, streaming) => {
    const demo = window[demoName];
    if (!demo) {
      return {
        ready: false,
        statusText: document.getElementById("status")?.innerText || "",
      };
    }
    const viewIndex = demo.view.viewIndex ?? 0;
    const renderer = demo.renderer;
    const renderSummary = renderer.getViewRenderStats?.(viewIndex) || null;
    const inspector = renderer.getRenderInspector?.()?.value || null;
    const frame = inspector?.renderStats?.views?.[viewIndex] || null;
    const memoryStats = renderer.getMemoryStats?.() || null;
    const streamController = streaming ? demo.streamController : null;
    return {
      ready: true,
      loadedChunks: streamController?.loadedChunkIds?.size ?? null,
      loadingChunks: streamController?.loadingChunkIds?.size ?? null,
      chunks: streamController?.chunkManifests?.length ?? null,
      objects: streamController?.loadedTotals?.objects ?? countKeys(demo.sceneModel?.objects),
      meshes: streamController?.loadedTotals?.meshes ?? countKeys(demo.sceneModel?.meshes),
      renderSummary,
      frame: frame ? {
        renderReason: frame.renderReason || "",
        numDrawCalls: frame.numDrawCalls || renderSummary?.numDrawCalls || 0,
        numPrims: frame.numPrims || renderSummary?.numPrimitives || 0,
        numBatches: frame.numBatches || renderSummary?.numBatches || 0,
        numBuiltSegments: frame.numBuiltSegments || 0,
        numPendingSegments: frame.numPendingSegments || 0,
        numRenderedMeshes: frame.numRenderedMeshes || 0,
        numMeshesUsingRTCFallback: frame.numMeshesUsingRTCFallback || renderSummary?.numMeshesUsingRTCFallback || 0,
        cpuTime: frame.cpuTime || null,
        instanceUpload: frame.instanceUpload || null,
        commandState: frame.commandState || null,
        renderBins: (frame.renderBins || []).map(bin => ({
          name: bin.name,
          drawCalls: (bin.drawCalls || []).map(draw => ({
            renderPass: draw.renderPass,
            segmentKey: draw.segmentKey,
            bufferPageKey: draw.bufferPageKey,
            renderStateKey: draw.renderStateKey,
            indexCount: draw.indexCount,
            numPrims: draw.numPrims,
          })),
        })),
      } : null,
      memoryStats,
      memoryDerived: memoryStats ? deriveMemoryStats(memoryStats) : null,
      webgpuDiagnostics: demo.webgpuDiagnostics || null,
      backpressure: demo.backpressure ? {
        enabled: demo.backpressure.enabled === true,
        paused: demo.backpressure.paused === true,
        pauseCount: demo.backpressure.pauseCount || 0,
        lastPendingSegments: demo.backpressure.lastPendingSegments || 0
      } : null,
      opacitySummary: summarizeOpacity(demo.sceneModel?.meshes),
      statusText: document.getElementById("status")?.innerText || "",
    };

    function countKeys(value) {
      return value ? Object.keys(value).length : null;
    }

    function deriveMemoryStats(stats) {
      const packedUsedBytes =
        stats.packedTriangleUsedVertexBytes +
        stats.packedTriangleUsedVertexMetadataBytes +
        stats.packedTriangleUsedIndexBytes +
        stats.packedTriangleUsedEdgeIndexBytes +
        stats.packedTriangleUsedPositionDecodeBytes;
      return {
        packedUsedBytes,
        packedUtilization: stats.packedTriangleBytes > 0 ? packedUsedBytes / stats.packedTriangleBytes : 0,
        leastPackedPageUtilization: getLeastPackedPageUtilization(stats.packedTrianglePageDetails),
        rtcTileUtilization: stats.rtcTileCapacity > 0 ? stats.rtcTiles / stats.rtcTileCapacity : 0,
      };
    }

    function getLeastPackedPageUtilization(pages) {
      const details = pages || [];
      if (details.length === 0) {
        return null;
      }
      let least = 1;
      for (const page of details) {
        const utilization = page.bytes > 0 ? page.usedBytes / page.bytes : 0;
        least = Math.min(least, utilization);
      }
      return least;
    }

    function summarizeOpacity(meshes) {
      const result = {
        total: 0,
        opaque: 0,
        transparent: 0,
        zero: 0,
        min: 1,
        max: 0,
        sampleTransparent: []
      };
      for (const mesh of Object.values(meshes || {})) {
        const opacity = mesh.effectiveOpacity ?? mesh.opacity ?? 1;
        result.total++;
        result.min = Math.min(result.min, opacity);
        result.max = Math.max(result.max, opacity);
        if (opacity <= 0) {
          result.zero++;
        } else if (opacity >= 1) {
          result.opaque++;
        } else {
          result.transparent++;
          if (result.sampleTransparent.length < 8) {
            result.sampleTransparent.push({
              id: mesh.id,
              opacity
            });
          }
        }
      }
      return result;
    }
  }, example.demoName, example.streaming);
}

function printWebGPUDiagnostics(results) {
  const matrix = [
    ["example", "webgpu", "adapter", "format", "features", "diagnostic error"],
    ...results.map(result => {
      const diagnostics = result.webgpuDiagnostics || {};
      return [
        result.name,
        diagnostics.webgpuSupported === false ? "no" : "yes",
        formatAdapterInfo(diagnostics.adapterInfo || {}),
        diagnostics.preferredCanvasFormat || "n/a",
        Array.isArray(diagnostics.adapterFeatures) ? diagnostics.adapterFeatures.length.toLocaleString("en-US") : "n/a",
        diagnostics.error || ""
      ];
    })
  ];
  printMatrix("WebGPU diagnostics:", matrix);
}

function formatAdapterInfo(info) {
  const parts = [];
  for (const key of ["vendor", "architecture", "device", "description"]) {
    if (info?.[key]) {
      parts.push(String(info[key]));
    }
  }
  return parts.length > 0 ? parts.join(", ") : "n/a";
}

function printTable(results) {
  const headers = [
    "example",
    "ok",
    "objects",
    "meshes",
    "chunks",
    "draws",
    "pages",
    "segments",
    "reason",
    "rendered",
    "tmp idx",
    "page groups",
    "bp pauses",
    "packed alloc",
    "packed used",
    "packed %",
    "least page %",
    "cpu frame",
    "prepare",
    "bin",
    "draw batches",
    "upload",
    "commands",
    "submit",
    "instances",
    "rtc",
    "rtc uploads",
    "rtc reserved",
  ];
  const matrix = [
    headers,
    ...results.map(result => {
      const memory = result.memoryStats || {};
      const derived = result.memoryDerived || {};
      const frame = result.frame || {};
      const cpu = frame.cpuTime || {};
      return [
        result.name,
        result.ok ? "yes" : "no",
        formatInt(result.objects),
        formatInt(result.meshes),
        formatChunks(result.loadedChunks, result.chunks),
        formatInt(frame.numDrawCalls || result.renderSummary?.numDrawCalls),
        formatInt(memory.packedTrianglePages),
        formatInt(memory.packedTriangleSegments),
        frame.renderReason || "n/a",
        formatInt(frame.numRenderedMeshes),
        formatInt(frame.numTemporaryIndexBuffers),
        formatInt(frame.commandState?.numBufferPageGroups),
        formatInt(result.backpressure?.pauseCount),
        formatBytes(memory.packedTriangleBytes),
        formatBytes(derived.packedUsedBytes),
        formatPercent(derived.packedUtilization),
        formatPercent(derived.leastPackedPageUtilization),
        formatMs(cpu.frameMs),
        formatMs(cpu.prepareMs),
        formatMs(cpu.binningMs),
        formatMs(cpu.drawBatchMs),
        formatMs(cpu.uploadMs),
        formatMs(cpu.commandEncodingMs),
        formatMs(cpu.submitMs),
        `${formatBytes(memory.instanceBufferBytes)} / ${formatInt(memory.instanceBufferCapacity)}`,
        `${formatInt(memory.rtcTiles)}/${formatInt(memory.rtcTileCapacity)}`,
        formatInt(frame.numRTCTileMatrixUploads || result.renderSummary?.numRTCTileMatrixUploads),
        formatBytes(memory.rtcTileBufferBytes),
      ];
    }),
  ];
  printMatrix("", matrix);
}

function printInteractionTable(results) {
  const rows = results
    .filter(result => result.interaction?.frames?.length)
    .map(result => {
      const summary = summarizeInteractionFrames(result.interaction.frames);
      return {
        name: result.name,
        frames: result.interaction.frames.length,
        summary
      };
    });
  if (rows.length === 0) {
    return;
  }

  const headers = [
    "example",
    "frames",
    "frame med",
    "frame p95",
    "frame max",
    "cmd med",
    "cmd p95",
    "submit med",
    "bin med",
    "batch med",
    "draw batch med",
    "upload med",
    "draws med",
    "rtc uploads med",
    "top reasons"
  ];
  const matrix = [
    headers,
    ...rows.map(row => [
      row.name,
      formatInt(row.frames),
      formatMs(row.summary.frameMs.median),
      formatMs(row.summary.frameMs.p95),
      formatMs(row.summary.frameMs.max),
      formatMs(row.summary.commandEncodingMs.median),
      formatMs(row.summary.commandEncodingMs.p95),
      formatMs(row.summary.submitMs.median),
      formatMs(row.summary.binningMs.median),
      formatMs(row.summary.batchingMs.median),
      formatMs(row.summary.drawBatchMs.median),
      formatMs(row.summary.uploadMs.median),
      formatNumber(row.summary.numDrawCalls.median),
      formatNumber(row.summary.numRTCTileMatrixUploads.median),
      formatReasonCounts(row.summary.renderReasons)
    ])
  ];
  printMatrix("Interaction benchmark:", matrix);
}

function printMatrix(title, matrix) {
  if (title) {
    console.log("");
    console.log(title);
  }
  const widths = matrix[0].map((_, column) => Math.max(...matrix.map(row => String(row[column] ?? "").length)));
  for (const row of matrix) {
    console.log(row.map((cell, column) => String(cell ?? "").padEnd(widths[column])).join("  "));
  }
}

function summarizeInteractionFrames(frames) {
  return {
    frameMs: summarizeNumbers(frames.map(frame => frame.frameMs)),
    commandEncodingMs: summarizeNumbers(frames.map(frame => frame.commandEncodingMs)),
    submitMs: summarizeNumbers(frames.map(frame => frame.submitMs)),
    binningMs: summarizeNumbers(frames.map(frame => frame.binningMs)),
    batchingMs: summarizeNumbers(frames.map(frame => frame.batchingMs)),
    drawBatchMs: summarizeNumbers(frames.map(frame => frame.drawBatchMs)),
    uploadMs: summarizeNumbers(frames.map(frame => frame.uploadMs)),
    numDrawCalls: summarizeNumbers(frames.map(frame => frame.numDrawCalls)),
    numRTCTileMatrixUploads: summarizeNumbers(frames.map(frame => frame.numRTCTileMatrixUploads)),
    renderReasons: countValues(frames.map(frame => frame.renderReason || "unknown"))
  };
}

function summarizeNumbers(values) {
  const sorted = values
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
  if (sorted.length === 0) {
    return {
      median: NaN,
      p95: NaN,
      max: NaN
    };
  }
  return {
    median: percentile(sorted, 0.5),
    p95: percentile(sorted, 0.95),
    max: sorted[sorted.length - 1]
  };
}

function percentile(sortedValues, fraction) {
  if (sortedValues.length === 1) {
    return sortedValues[0];
  }
  const index = Math.min(sortedValues.length - 1, Math.max(0, Math.ceil(sortedValues.length * fraction) - 1));
  return sortedValues[index];
}

function countValues(values) {
  const counts = new Map();
  for (const value of values) {
    counts.set(value, (counts.get(value) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

function formatReasonCounts(entries) {
  return entries.slice(0, 3).map(([reason, count]) => `${reason}:${count}`).join(", ");
}

function formatInt(value) {
  return Number.isFinite(value) ? Math.round(value).toLocaleString("en-US") : "n/a";
}

function formatChunks(loaded, total) {
  if (!Number.isFinite(loaded) && !Number.isFinite(total)) {
    return "n/a";
  }
  return `${formatInt(loaded)}/${formatInt(total)}`;
}

function formatNumber(value) {
  return Number.isFinite(value) ? value.toFixed(1) : "n/a";
}

function formatPercent(value) {
  return Number.isFinite(value) ? `${(value * 100).toFixed(1)}%` : "n/a";
}

function formatMs(value) {
  return Number.isFinite(value) ? `${value.toFixed(2)} ms` : "n/a";
}

function formatBytes(value) {
  const bytes = Number(value || 0);
  if (!Number.isFinite(bytes)) {
    return "n/a";
  }
  if (bytes >= 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }
  if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${bytes.toLocaleString("en-US")} B`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const server = createStaticServer(websiteRoot);
  const port = await listen(server);
  const baseUrl = `http://127.0.0.1:${port}`;
  let browser = null;
  try {
    const chromeLaunchArgs = createChromeLaunchArgs(args);
    ensureChromeBackendFlags(chromeLaunchArgs, args.chromeGpuBackend);
    const requestedChromeLaunchArgs = chromeLaunchArgs.slice();
    browser = await puppeteer.launch({
      headless: true,
      protocolTimeout: 240000,
      args: chromeLaunchArgs,
    });
    const browserDiagnostics = await collectBrowserDiagnostics(browser);
    console.log(`Chrome GPU backend flags: ${args.chromeGpuBackend} (${requestedChromeLaunchArgs.join(" ")})`);
    if (browserDiagnostics?.version?.product) {
      console.log(`Chrome: ${browserDiagnostics.version.product}`);
    }
    if (browserDiagnostics?.gpuFeatureStatus) {
      console.log(`Chrome GPU feature status: ${JSON.stringify(browserDiagnostics.gpuFeatureStatus)}`);
    }
    const results = [];
    let examples = args.onlyExpensive
      ? EXPENSIVE_EXAMPLES
      : args.includeExpensive
        ? [...DEFAULT_EXAMPLES, ...EXPENSIVE_EXAMPLES]
        : DEFAULT_EXAMPLES;
    if (args.exampleFilter) {
      examples = examples.filter(example => example.name === args.exampleFilter);
      if (examples.length === 0) {
        throw new Error(`No example matched --example ${args.exampleFilter}`);
      }
    }
    for (const example of examples) {
      console.log(`Capturing ${example.name}...`);
      results.push(await runExample(browser, baseUrl, example, args));
    }
    printWebGPUDiagnostics(results);
    printTable(results);
    printInteractionTable(results);
    const payload = {
      generatedAt: new Date().toISOString(),
      viewport: `${args.viewportWidth}x${args.viewportHeight}`,
      interactionFrames: args.interactionFrames,
      chromeGpuBackend: args.chromeGpuBackend,
      chromeLaunchArgs: requestedChromeLaunchArgs,
      browserDiagnostics,
      results,
    };
    if (args.outputPath) {
      fs.writeFileSync(args.outputPath, JSON.stringify(payload, null, 2));
      console.log(`Wrote ${args.outputPath}`);
    }
    const failed = results.filter(result => !result.ok);
    if (failed.length > 0) {
      process.exitCode = 1;
      console.error(`Failed examples: ${failed.map(result => result.name).join(", ")}`);
    }
  } finally {
    if (browser) {
      await browser.close();
    }
    await close(server);
  }
}

function ensureChromeBackendFlags(chromeArgs, backendName) {
  const backend = String(backendName || "default").trim();
  const add = (flag) => {
    if (!chromeArgs.includes(flag)) {
      chromeArgs.push(flag);
    }
  };
  if (backend === "vulkan") {
    add("--enable-features=Vulkan");
  } else if (backend === "angle-vulkan") {
    add("--use-angle=vulkan");
    add("--enable-features=Vulkan,VulkanFromANGLE,DefaultANGLEVulkan");
  } else if (backend === "swiftshader") {
    add("--enable-unsafe-swiftshader");
    add("--use-angle=swiftshader");
  }
}

function getExampleTargetChunks(example, args) {
  if (!example.targetChunks) {
    return null;
  }
  if (typeof example.targetChunks === "number") {
    return example.targetChunks;
  }
  return args[example.targetChunks] ?? null;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
});
