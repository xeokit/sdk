#!/usr/bin/env node

// Benchmarks XGF streaming flight examples with projected-size representation
// LOD off and on. The benchmark intentionally drives the public example
// through URL params so it measures the same path users run in the browser.

const fs = require("fs");
const http = require("http");
const path = require("path");
const {createRequire} = require("module");

const websiteRoot = path.resolve(__dirname, "..", "..", "..");
const websiteRequire = createRequire(path.join(websiteRoot, "package.json"));
const puppeteer = websiteRequire("puppeteer");

const DEFAULTS = {
  city: "amsterdam",
  renderer: "webgpu",
  frames: 600,
  warmupMs: 0,
  settleTimeoutMs: 180000,
  postSettleMs: 2000,
  viewportWidth: 1280,
  viewportHeight: 800,
  outputPath: "",
  executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || "/usr/bin/google-chrome",
  headful: false
};

function parseArgs(argv) {
  const args = {...DEFAULTS};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--city") {
      args.city = String(argv[++i] || "");
    } else if (arg === "--renderer") {
      args.renderer = String(argv[++i] || "");
    } else if (arg === "--frames") {
      args.frames = parsePositiveInt(argv[++i], "frames");
    } else if (arg === "--warmup-ms") {
      args.warmupMs = parsePositiveInt(argv[++i], "warmup");
    } else if (arg === "--settle-timeout-ms") {
      args.settleTimeoutMs = parsePositiveInt(argv[++i], "settle timeout");
    } else if (arg === "--post-settle-ms") {
      args.postSettleMs = parsePositiveInt(argv[++i], "post-settle delay");
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
    } else if (arg === "--executable-path") {
      args.executablePath = String(argv[++i] || "");
    } else if (arg === "--headful") {
      args.headful = true;
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (!["webgl", "webgpu"].includes(args.renderer)) {
    throw new Error("--renderer must be webgl or webgpu");
  }
  if (!args.city) {
    throw new Error("--city is required");
  }
  return args;
}

function printHelp() {
  console.log(`Usage: node packages/website/tools/render-benchmarks/xgf-streaming/benchmark-procedural-city-lod.js [options]

Options:
  --city <name>                Example suffix. Use lodBenchmarkLandscape for the LOD benchmark fixture. Default ${DEFAULTS.city}.
  --renderer <webgl|webgpu>    Renderer URL param. Default ${DEFAULTS.renderer}.
  --frames <n>                 RAF samples per LOD mode. Default ${DEFAULTS.frames}.
  --warmup-ms <n>              Fixed warmup before sampling. Default ${DEFAULTS.warmupMs}.
  --settle-timeout-ms <n>      Max wait for stream queue to settle when warmup is 0. Default ${DEFAULTS.settleTimeoutMs}.
  --post-settle-ms <n>         Extra delay after settling. Default ${DEFAULTS.postSettleMs}.
  --viewport <WIDTHxHEIGHT>    Browser viewport. Default ${DEFAULTS.viewportWidth}x${DEFAULTS.viewportHeight}.
  --output <path>              Optional JSON output path.
  --executable-path <path>     Chrome executable. Default ${DEFAULTS.executablePath}.
  --headful                    Run Chrome headful for local WebGPU validation.
`);
}

function parsePositiveInt(value, name) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
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
  if (ext === ".svg") return "image/svg+xml";
  return "application/octet-stream";
}

function listen(server) {
  return new Promise((resolve, reject) => {
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => resolve(server.address().port));
  });
}

function close(server) {
  return new Promise((resolve) => server.close(() => resolve()));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function examplePathFor(city) {
  if (city === "lodBenchmarkLandscape" || city === "lod-benchmark-landscape") {
    return "formats_xgf_lodBenchmarkLandscape";
  }
  return `formats_xgf_proceduralCity_${city}`;
}

async function runCase(browser, baseUrl, args, lodEnabled) {
  const page = await browser.newPage();
  const consoleMessages = [];
  const pageErrors = [];
  const httpErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error" || msg.type() === "warning") {
      consoleMessages.push(`${msg.type()}: ${msg.text()}`);
    }
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("response", (response) => {
    if (response.status() >= 400 && !response.url().endsWith("/favicon.ico")) {
      httpErrors.push(`${response.status()} ${response.url()}`);
    }
  });

  try {
    await page.setViewport({
      width: args.viewportWidth,
      height: args.viewportHeight,
      deviceScaleFactor: 1
    });
    const url = `${baseUrl}/examples/${examplePathFor(args.city)}/index.html?renderer=${args.renderer}&lod=${lodEnabled ? "1" : "0"}&frustumOnly=0&benchmarkStartPaused=1`;
    await page.goto(url, {waitUntil: "domcontentloaded", timeout: 120000});
    await page.waitForFunction(() => !!window.proceduralCityXGFStreamDemo, {timeout: 120000});
    await stopVehicle(page);
    const settle = await waitForSettledStream(page, args.settleTimeoutMs);
    if (!settle.settled) {
      throw new Error(`Stream did not fully load before benchmark sampling: ${JSON.stringify(settle.state)}`);
    }
    if (args.warmupMs > 0) {
      await waitFixedWarmup(page, args.warmupMs);
    }
    await sleep(args.postSettleMs);
    await startVehicle(page);
    const samples = await page.evaluate(async ({frames}) => {
      const demo = window.proceduralCityXGFStreamDemo;
      const {view, studio, streamController, representationLODSelector} = demo;
      view.htmlElement?.focus?.({preventScroll: true});
      const inspectorResult = studio.renderer.getRenderInspector?.();
      const inspector = inspectorResult?.ok ? inspectorResult.value : null;
      if (inspector) {
        inspector.enabled = true;
      }
      const viewIndex = view.viewIndex ?? 0;
      const result = [];
      const getActiveRepCounts = () => {
        const counts = {};
        const states = representationLODSelector?._states;
        if (!states?.values) {
          return counts;
        }
        for (const state of states.values()) {
          const repId = state.activeByViewId?.get?.(view.id) || state.repSet?.defaultRepId || "unknown";
          counts[repId] = (counts[repId] || 0) + 1;
        }
        return counts;
      };
      let last = performance.now();
      for (let i = 0; i < frames; i++) {
        await new Promise((resolve) => requestAnimationFrame(resolve));
        const now = performance.now();
        const frame = inspector?.renderStats?.views?.[viewIndex] || null;
        const cpu = frame?.cpuTime || {};
        const queueProgress = streamController?.queueProgress || null;
        result.push({
          i,
          rafIntervalMs: now - last,
          frameMs: Number(cpu.frameMs || 0),
          prepareMs: Number(cpu.prepareMs || 0),
          binningMs: Number(cpu.binningMs || 0),
          batchingMs: Number(cpu.batchingMs || 0),
          drawBatchMs: Number(cpu.drawBatchMs || 0),
          uploadMs: Number(cpu.uploadMs || 0),
          commandEncodingMs: Number(cpu.commandEncodingMs || 0),
          numDrawCalls: Number(frame?.numDrawCalls || 0),
          numRenderedMeshes: Number(frame?.numRenderedMeshes || 0),
          numInstances: Number(frame?.numInstances || 0),
          numSegments: Number(frame?.numSegments || 0),
          numBuiltSegments: Number(frame?.numBuiltSegments || 0),
          numPendingSegments: Number(frame?.numPendingSegments || 0),
          numTemporaryIndexBuffers: Number(frame?.numTemporaryIndexBuffers || 0),
          renderReason: frame?.renderReason || "",
          repSignatureLength: studio.viewer.lodVisibility.getRepSelectionSignature(view.id).length,
          activeRepCounts: getActiveRepCounts(),
          selectorEnabled: !!representationLODSelector?.enabled,
          loadedChunks: streamController?.loadedChunkIds?.size ?? 0,
          loadingChunks: streamController?.loadingChunkIds?.size ?? 0,
          queuedChunks: queueProgress?.queued ?? 0,
          queueLoaded: queueProgress?.loaded ?? 0,
          eye: Array.from(view.camera.eye || [])
        });
        last = now;
      }
      return result;
    }, {frames: args.frames});
    const streamState = await getStreamState(page);
    const fatalConsoleMessages = consoleMessages.filter((message) => (
      message.includes("deviceLost") ||
      message.includes("Device was lost") ||
      message.includes("WebGPU device was lost")
    ));
    return {
      ok: pageErrors.length === 0 && httpErrors.length === 0 && fatalConsoleMessages.length === 0,
      lodEnabled,
      renderer: args.renderer,
      url,
      settle,
      streamState,
      summary: summarize(samples),
      samples,
      consoleMessages,
      fatalConsoleMessages,
      pageErrors,
      httpErrors
    };
  } finally {
    await page.close();
  }
}

async function waitForSettledStream(page, timeoutMs) {
  const startedAt = Date.now();
  let last = null;
  while (Date.now() - startedAt < timeoutMs) {
    last = await getStreamState(page);
    if (
      last.demoReady &&
      last.totalChunks > 0 &&
      last.loadedChunks === last.totalChunks &&
      last.loadingChunks === 0 &&
      last.queuedChunks === last.queueLoaded
    ) {
      return {
        settled: true,
        elapsedMs: Date.now() - startedAt,
        state: last
      };
    }
    await sleep(250);
  }
  return {
    settled: false,
    elapsedMs: Date.now() - startedAt,
    state: last
  };
}

async function waitFixedWarmup(page, warmupMs) {
  const startedAt = Date.now();
  let last = null;
  while (Date.now() - startedAt < warmupMs) {
    last = await getStreamState(page);
    await sleep(250);
  }
  return {
    settled: false,
    fixedWarmup: true,
    elapsedMs: Date.now() - startedAt,
    state: last
  };
}

async function stopVehicle(page) {
  await page.evaluate(() => {
    const controller = window.proceduralCityXGFStreamDemo?.vehicleController?.sdkController;
    if (!controller) {
      return;
    }
    controller.speed = 0;
    controller.flying = false;
    controller.active = false;
  });
}

async function startVehicle(page) {
  await page.evaluate(() => {
    const demo = window.proceduralCityXGFStreamDemo;
    const aircraft = demo?.vehicleController;
    const controller = aircraft?.sdkController;
    if (!controller) {
      return;
    }
    const config = window.PROCEDURAL_CITY_STREAM_CONFIG?.vehicle || {};
    const startSpeed = Number(config.startSpeed ?? 34);
    controller.active = true;
    controller.flying = config.startFlying !== false;
    controller.speed = Number.isFinite(startSpeed) ? startSpeed : 34;
    aircraft.update?.();
  });
}

async function getStreamState(page) {
  return page.evaluate(() => {
    const demo = window.proceduralCityXGFStreamDemo;
    const controller = demo?.streamController;
    const queue = controller?.queueProgress || {};
    return {
      demoReady: !!demo,
      loadedChunks: controller?.loadedChunkIds?.size ?? 0,
      totalChunks: controller?.chunkManifests?.length ?? 0,
      loadingChunks: controller?.loadingChunkIds?.size ?? 0,
      loadedAssetLibraries: controller?.loadedAssetLibraryIds?.size ?? 0,
      loadedTotals: controller?.loadedTotals || null,
      queuedChunks: queue.queued ?? 0,
      queueLoaded: queue.loaded ?? 0,
      objectCount: demo?.scene?.objects ? Object.keys(demo.scene.objects).length : 0
    };
  });
}

function summarize(samples) {
  const frameIntervals = samples.map((sample) => sample.rafIntervalMs);
  const over50 = frameIntervals.filter((value) => value > 50).length;
  const over100 = frameIntervals.filter((value) => value > 100).length;
  return {
    frames: samples.length,
    fpsFromRAF: 1000 / average(frameIntervals),
    rafIntervalMs: stats(frameIntervals),
    frameMs: stats(samples.map((sample) => sample.frameMs)),
    prepareMs: stats(samples.map((sample) => sample.prepareMs)),
    binningMs: stats(samples.map((sample) => sample.binningMs)),
    batchingMs: stats(samples.map((sample) => sample.batchingMs)),
    drawBatchMs: stats(samples.map((sample) => sample.drawBatchMs)),
    uploadMs: stats(samples.map((sample) => sample.uploadMs)),
    commandEncodingMs: stats(samples.map((sample) => sample.commandEncodingMs)),
    numDrawCalls: stats(samples.map((sample) => sample.numDrawCalls)),
    numRenderedMeshes: stats(samples.map((sample) => sample.numRenderedMeshes)),
    numInstances: stats(samples.map((sample) => sample.numInstances)),
    numSegments: stats(samples.map((sample) => sample.numSegments)),
    numBuiltSegments: stats(samples.map((sample) => sample.numBuiltSegments)),
    numPendingSegments: stats(samples.map((sample) => sample.numPendingSegments)),
    numTemporaryIndexBuffers: stats(samples.map((sample) => sample.numTemporaryIndexBuffers)),
    hitchFramesOver50Ms: over50,
    hitchFramesOver100Ms: over100,
    renderReasons: countValues(samples.map((sample) => sample.renderReason || "unknown")),
    repSignatureLength: stats(samples.map((sample) => sample.repSignatureLength)),
    activeRepCounts: samples.length ? samples[samples.length - 1].activeRepCounts || {} : {}
  };
}

function stats(values) {
  const finite = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (finite.length === 0) {
    return {avg: 0, p50: 0, p95: 0, max: 0};
  }
  return {
    avg: average(finite),
    p50: percentile(finite, 0.5),
    p95: percentile(finite, 0.95),
    max: finite[finite.length - 1]
  };
}

function average(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function percentile(sortedValues, p) {
  if (sortedValues.length === 0) {
    return 0;
  }
  return sortedValues[Math.min(sortedValues.length - 1, Math.floor(sortedValues.length * p))];
}

function countValues(values) {
  const counts = {};
  for (const value of values) {
    counts[value] = (counts[value] || 0) + 1;
  }
  return counts;
}

function printTable(results) {
  console.log("");
  console.log("LOD flight benchmark");
  console.log("mode     fps    raf p95  raf max  >50ms  >100ms  draw p95  meshes p95  active reps  reasons");
  console.log("------------------------------------------------------------------------------------------------");
  for (const result of results) {
    const summary = result.summary;
    const mode = result.lodEnabled ? "lod=1" : "lod=0";
    console.log([
      mode.padEnd(8),
      format(summary.fpsFromRAF).padStart(6),
      format(summary.rafIntervalMs.p95).padStart(8),
      format(summary.rafIntervalMs.max).padStart(8),
      String(summary.hitchFramesOver50Ms).padStart(6),
      String(summary.hitchFramesOver100Ms).padStart(7),
      format(summary.numDrawCalls.p95).padStart(9),
      format(summary.numRenderedMeshes.p95).padStart(11),
      formatCounts(summary.activeRepCounts).padEnd(12),
      Object.entries(summary.renderReasons).map(([key, value]) => `${key}:${value}`).join(",")
    ].join("  "));
  }
  console.log("");
}

function formatCounts(counts) {
  const entries = Object.entries(counts || {});
  if (!entries.length) {
    return "-";
  }
  return entries.map(([key, value]) => `${key}:${value}`).join(",");
}

function format(value) {
  return Number.isFinite(value) ? value.toFixed(value >= 100 ? 0 : 1) : "n/a";
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const server = createStaticServer(websiteRoot);
  const port = await listen(server);
  const baseUrl = `http://127.0.0.1:${port}`;
  let browser = null;
  try {
    browser = await puppeteer.launch({
      headless: args.headful ? false : "new",
      executablePath: args.executablePath || undefined,
      protocolTimeout: Math.max(240000, args.settleTimeoutMs + 120000),
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--ignore-gpu-blocklist",
        "--enable-unsafe-webgpu",
        "--enable-unsafe-swiftshader",
        "--enable-features=Vulkan",
        `--window-size=${args.viewportWidth},${args.viewportHeight}`
      ]
    });
    const results = [];
    for (const lodEnabled of [false, true]) {
      console.log(`Running ${args.city} ${args.renderer} lod=${lodEnabled ? "1" : "0"}...`);
      results.push(await runCase(browser, baseUrl, args, lodEnabled));
    }
    printTable(results);
    const payload = {
      generatedAt: new Date().toISOString(),
      example: `formats_xgf_proceduralCity_${args.city}`,
      renderer: args.renderer,
      viewport: `${args.viewportWidth}x${args.viewportHeight}`,
      frames: args.frames,
      results
    };
    if (args.outputPath) {
      fs.writeFileSync(args.outputPath, `${JSON.stringify(payload, null, 2)}\n`);
      console.log(`Wrote ${args.outputPath}`);
    }
    const failed = results.filter((result) => !result.ok);
    if (failed.length > 0) {
      process.exitCode = 1;
      console.error(`Benchmark completed with page errors in: ${failed.map((result) => result.lodEnabled ? "lod=1" : "lod=0").join(", ")}`);
    }
  } finally {
    if (browser) {
      await browser.close();
    }
    await close(server);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
});
