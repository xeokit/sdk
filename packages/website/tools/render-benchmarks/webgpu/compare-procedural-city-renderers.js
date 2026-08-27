// Compares the WebGL and WebGPU procedural-city XGF examples with the same
// camera path and the same generated Amsterdam XGF stream.

const fs = require("fs");
const http = require("http");
const path = require("path");
const {createRequire} = require("module");

const websiteRoot = path.resolve(__dirname, "..", "..", "..");
const websiteRequire = createRequire(path.join(websiteRoot, "package.json"));
const puppeteer = websiteRequire("puppeteer");

const DEFAULTS = {
  frames: 24,
  settleTimeoutMs: 180000,
  viewportWidth: 1280,
  viewportHeight: 800,
  outputPath: "",
};

function parseArgs(argv) {
  const args = {...DEFAULTS};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--frames") {
      args.frames = parsePositiveInt(argv[++i], "frames");
    } else if (arg === "--settle-timeout-ms") {
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
  console.log(`Usage: node packages/website/tools/render-benchmarks/webgpu/compare-procedural-city-renderers.js [options]

Options:
  --frames <n>                 Camera frames sampled per renderer. Default ${DEFAULTS.frames}.
  --settle-timeout-ms <n>      Max wait for stream loading. Default ${DEFAULTS.settleTimeoutMs}.
  --viewport <WIDTHxHEIGHT>    Browser viewport. Default ${DEFAULTS.viewportWidth}x${DEFAULTS.viewportHeight}.
  --output <path>              Optional JSON output path.
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

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runRenderer(browser, baseUrl, rendererName, args) {
  const page = await browser.newPage();
  const pageErrors = [];
  const consoleErrors = [];
  const httpErrors = [];
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

    const url = await openRendererPage(page, baseUrl, rendererName);
    await waitForRendererReady(page, rendererName);
    await installSampler(page);
    await installInteractionProfiler(page);
    await enableInspector(page, rendererName);
    await waitForStreamSettled(page, rendererName, args.settleTimeoutMs);
    await renderCameraFrames(page, rendererName, Math.max(6, Math.floor(args.frames / 3)));
    await waitForRendererSettled(page, rendererName, 30000);

    const samples = [];
    for (let i = 0; i < args.frames; i++) {
      const latency = await profileCameraFrame(page, rendererName, i + 100);
      const sample = await sampleRenderer(page, rendererName);
      sample.wallMs = latency.wallMs;
      sample.latencyMs = latency.latencyMs;
      sample.latencyTimedOut = latency.timedOut;
      samples.push(sample);
    }

    return {
      renderer: rendererName,
      ok: pageErrors.length === 0 && consoleErrors.length === 0 && httpErrors.length === 0,
      url,
      loaded: await sampleRenderer(page, rendererName),
      aggregate: aggregateSamples(samples),
      pageErrors,
      consoleErrors,
      httpErrors,
    };
  } finally {
    await page.close();
  }
}

async function openRendererPage(page, baseUrl, rendererName) {
  if (rendererName === "webgl") {
    await page.evaluateOnNewDocument(() => {
      window.PROCEDURAL_CITY_STREAM_CONFIG = {
        indexUrl: "../../models/ProceduralCityAmsterdam/xgfstream/index.runtime.json",
        metadataUrl: "../../models/ProceduralCityAmsterdam/metadata.json",
        reportUrl: "../../models/ProceduralCityAmsterdam/report.json",
        modelId: "ProceduralCityAmsterdamWebGLProfile",
        viewId: "proceduralCityWebGLProfileView",
        streamLabel: "procedural city benchmark",
        frustumOnly: false,
        renderMode: "detailed",
        adaptiveQuality: false,
        effects: {
          sao: {renderModes: []},
          bloom: {renderModes: []},
          atmosphere: {renderModes: []},
          depthOfField: {renderModes: []},
          tonemap: {renderModes: []},
          antiAliasing: {renderModes: []},
          shadows: {renderModes: []},
          edges: {renderModes: []},
          sectionPlaneCaps: {renderModes: []},
          bodyHatch: {renderModes: []}
        },
        lights: {
          ibl: {renderModes: []},
          hemispheric: {renderModes: ["detailed"]}
        }
      };
    });
    const url = `${baseUrl}/examples/import/xgf/procedural-city/index.html?profile=1`;
    await page.goto(url, {waitUntil: "domcontentloaded", timeout: 60000});
    return url;
  }

  const query = new URLSearchParams({
    timestamps: "1",
    depth: "0",
    edges: "0",
    memory: "stream",
  });
  const url = `${baseUrl}/examples/import/xgf/procedural-city/index.html?renderer=webgpu&${query}`;
  await page.goto(url, {waitUntil: "domcontentloaded", timeout: 60000});
  return url;
}

async function waitForRendererReady(page, rendererName) {
  await page.waitForFunction((name) => {
    if (name === "webgl") {
      return !!window.proceduralCityXGFStreamDemo || document.getElementById("status")?.dataset.state === "error";
    }
    return !!window.webgpuProceduralCityXGFStreamDemo || document.getElementById("status")?.dataset.state === "error";
  }, {timeout: 120000}, rendererName);
}

async function enableInspector(page, rendererName) {
  await page.evaluate((name) => {
      const demo = name === "webgl" ? window.proceduralCityXGFStreamDemo : window.webgpuProceduralCityXGFStreamDemo;
      const renderer = demo?.renderer || demo?.studio?.renderer;
    const inspectorResult = renderer?.getRenderInspector?.();
    if (inspectorResult?.ok) {
      inspectorResult.value.enabled = true;
    }
  }, rendererName);
}

async function waitForStreamSettled(page, rendererName, timeoutMs) {
  await page.waitForFunction((name) => {
    const demo = name === "webgl" ? window.proceduralCityXGFStreamDemo : window.webgpuProceduralCityXGFStreamDemo;
    const streamController = demo?.streamController;
    return !!streamController
      && streamController.loadedChunkIds.size >= streamController.chunkManifests.length
      && streamController.loadingChunkIds.size === 0;
  }, {timeout: timeoutMs}, rendererName).catch(() => {});
}

async function waitForRendererSettled(page, rendererName, timeoutMs) {
  await page.waitForFunction((name) => {
    const sample = window.__sampleProceduralCityRenderer?.(name);
    if (!sample?.ready || sample.loadingChunks !== 0 || sample.loadedChunks < sample.chunks) {
      return false;
    }
    if (name === "webgpu") {
      return (sample.frame?.numPendingSegments || 0) === 0;
    }
    return !!sample.frame;
  }, {timeout: timeoutMs}, rendererName).catch(() => {});
}

async function renderCameraFrames(page, rendererName, count) {
  for (let i = 0; i < count; i++) {
    await profileCameraFrame(page, rendererName, i);
  }
}

async function profileCameraFrame(page, rendererName, frame) {
  return page.evaluate((name, frameIndex) => window.__profileProceduralCityInteractionFrame(name, frameIndex), rendererName, frame);
}

async function sampleRenderer(page, rendererName) {
  await installSampler(page);
  return page.evaluate((name) => window.__sampleProceduralCityRenderer(name), rendererName);
}

async function installSampler(page) {
  await page.evaluate(() => {
    if (window.__sampleProceduralCityRenderer) {
      return;
    }
    window.__sampleProceduralCityRenderer = (name) => {
      const demo = name === "webgl" ? window.proceduralCityXGFStreamDemo : window.webgpuProceduralCityXGFStreamDemo;
      if (!demo) {
        return {
          ready: false,
          statusText: document.getElementById("status")?.innerText || "",
        };
      }
      const streamController = demo.streamController;
      const renderer = demo.renderer || demo.studio.renderer;
      const viewIndex = demo.view.viewIndex ?? 0;
      const inspector = renderer.getRenderInspector?.()?.value;
      const frame = inspector?.renderStats?.views?.[viewIndex] || null;
      const renderSummary = renderer.getViewRenderStats?.(viewIndex);
      return {
        ready: true,
        loadedChunks: streamController.loadedChunkIds.size,
        loadingChunks: streamController.loadingChunkIds.size,
        chunks: streamController.chunkManifests.length,
        objects: streamController.loadedTotals.objects,
        meshes: streamController.loadedTotals.meshes,
        frame: frame ? {
          renderReason: frame.renderReason || "",
          numDrawCalls: frame.numDrawCalls || renderSummary?.numDrawCalls || 0,
          numPrims: frame.numPrims || renderSummary?.numPrimitives || 0,
          numBatches: frame.numBatches || 0,
          numSegments: frame.numSegments || 0,
          numBuiltSegments: frame.numBuiltSegments || 0,
          numPendingSegments: frame.numPendingSegments || 0,
          commandState: frame.commandState || null,
          cpuTime: frame.cpuTime || null,
          frameTimeMs: frame.timeMs?.duration ?? 0,
          gpuTimeMs: frame.gpuTimeMs,
          gpuTime: frame.gpuTime || null,
          drawPaths: frame.drawPaths || null,
          renderBins: (frame.renderBins || []).map(bin => ({
            name: bin.name,
            drawCalls: bin.drawCalls?.length || 0,
            indexCount: (bin.drawCalls || []).reduce((sum, draw) => sum + (draw.indexCount || draw.primRange?.numPrims || 0), 0),
            commandState: bin.commandState || null
          }))
        } : null,
        statusText: document.getElementById("status")?.innerText || "",
      };
    };
  });
}

async function installInteractionProfiler(page) {
  await page.evaluate(() => {
    if (window.__profileProceduralCityInteractionFrame) {
      return;
    }
    window.__profileProceduralCityInteractionFrame = (name, frameIndex) => new Promise(resolve => {
      const demo = name === "webgl" ? window.proceduralCityXGFStreamDemo : window.webgpuProceduralCityXGFStreamDemo;
      if (!demo) {
        resolve({latencyMs: 0, wallMs: 0, timedOut: true});
        return;
      }
      const renderer = demo.renderer || demo.studio.renderer;
      const view = demo.view;
      const camera = view.camera;
      const angle = frameIndex * 0.045;
      const radius = 1250;
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
          resolve({
            latencyMs: renderedAt - start,
            wallMs: performance.now() - start,
            timedOut
          });
        }));
      };
      if (renderer?.events?.onViewRendered?.subscribe) {
        unsub = renderer.events.onViewRendered.subscribe((_renderer, renderedView) => {
          if (!renderedView || renderedView === view || renderedView.id === view.id) {
            finish(false);
          }
        });
      }
      window.setTimeout(() => finish(true), 1000);
      camera.eye = [
        Math.cos(angle) * radius,
        Math.sin(angle) * radius,
        560 + Math.sin(angle * 0.5) * 60
      ];
      camera.look = [0, 0, 32];
      view.needsRender?.();
    });
  });
}

function aggregateSamples(samples) {
  const valid = samples.filter(sample => sample.frame);
  const divisor = valid.length || 1;
  const commandTotals = createCommandTotals();
  const binTotals = {};
  const drawPathTotals = {
    dtxDrawCalls: 0,
    vboDrawCalls: 0,
    dtxPrims: 0,
    vboPrims: 0,
  };
  let drawCalls = 0;
  let batches = 0;
  let primitives = 0;
  let frameTimeMs = 0;
  let wallMs = 0;
  let latencyMs = 0;
  let latencyTimeouts = 0;
  let gpuTimeMs = 0;
  let cpuBinningMs = 0;
  let cpuBatchingMs = 0;
  let cpuUploadMs = 0;
  let cpuCommandEncodingMs = 0;

  for (const sample of valid) {
    const frame = sample.frame;
    drawCalls += frame.numDrawCalls || 0;
    batches += frame.numBatches || 0;
    primitives += frame.numPrims || 0;
    frameTimeMs += frame.frameTimeMs || frame.cpuTime?.frameMs || 0;
    wallMs += sample.wallMs || 0;
    latencyMs += sample.latencyMs || 0;
    latencyTimeouts += sample.latencyTimedOut ? 1 : 0;
    gpuTimeMs += frame.gpuTimeMs || 0;
    cpuBinningMs += frame.cpuTime?.binningMs || 0;
    cpuBatchingMs += frame.cpuTime?.batchingMs || 0;
    cpuUploadMs += frame.cpuTime?.uploadMs || 0;
    cpuCommandEncodingMs += frame.cpuTime?.commandEncodingMs || 0;
    addCommandTotals(commandTotals, frame.commandState);
    if (frame.drawPaths) {
      drawPathTotals.dtxDrawCalls += frame.drawPaths.drawCalls?.dtx || 0;
      drawPathTotals.vboDrawCalls += frame.drawPaths.drawCalls?.vbo || 0;
      drawPathTotals.dtxPrims += frame.drawPaths.primitives?.dtx || 0;
      drawPathTotals.vboPrims += frame.drawPaths.primitives?.vbo || 0;
    }
    for (const bin of frame.renderBins || []) {
      const row = binTotals[bin.name] ??= {drawCalls: 0, indexCount: 0, commandState: createCommandTotals()};
      row.drawCalls += bin.drawCalls;
      row.indexCount += bin.indexCount;
      addCommandTotals(row.commandState, bin.commandState);
    }
  }

  return {
    samples: valid.length,
    drawCalls_avg: round(drawCalls / divisor),
    batches_avg: round(batches / divisor),
    primitives_avg: round(primitives / divisor),
    frameTimeMs_avg: round(frameTimeMs / divisor),
    wallMs_avg: round(wallMs / divisor),
    latencyMs_avg: round(latencyMs / divisor),
    latencyMs_p95: percentile(valid.map(sample => sample.latencyMs || 0), 0.95),
    latencyMs_max: round(Math.max(0, ...valid.map(sample => sample.latencyMs || 0))),
    latencyTimeouts,
    gpuTimeMs_avg: round(gpuTimeMs / divisor),
    cpuBinningMs_avg: round(cpuBinningMs / divisor),
    cpuBatchingMs_avg: round(cpuBatchingMs / divisor),
    cpuUploadMs_avg: round(cpuUploadMs / divisor),
    cpuCommandEncodingMs_avg: round(cpuCommandEncodingMs / divisor),
    commandState_avg: divideCommandTotals(commandTotals, divisor),
    bins_avg: divideNestedObject(binTotals, divisor),
    drawPaths_avg: divideObject(drawPathTotals, divisor),
  };
}

function createCommandTotals() {
  return {
    numPipelineBinds: 0,
    numVertexBufferBinds: 0,
    numIndexBufferBinds: 0,
    numBindGroupBinds: 0,
    numSubmissionGroups: 0,
    numBufferPageGroups: 0,
    numRenderStateGroups: 0,
    bindGroupBindsBySlot: {},
  };
}

function addCommandTotals(target, source) {
  if (!source) {
    return;
  }
  target.numPipelineBinds += source.numPipelineBinds || 0;
  target.numVertexBufferBinds += source.numVertexBufferBinds || 0;
  target.numIndexBufferBinds += source.numIndexBufferBinds || 0;
  target.numBindGroupBinds += source.numBindGroupBinds || 0;
  target.numSubmissionGroups += source.numSubmissionGroups || 0;
  target.numBufferPageGroups += source.numBufferPageGroups || 0;
  target.numRenderStateGroups += source.numRenderStateGroups || 0;
  for (const [slot, count] of Object.entries(source.bindGroupBindsBySlot || {})) {
    target.bindGroupBindsBySlot[slot] = (target.bindGroupBindsBySlot[slot] || 0) + count;
  }
}

function divideCommandTotals(total, divisor) {
  return {
    numPipelineBinds: round(total.numPipelineBinds / divisor),
    numVertexBufferBinds: round(total.numVertexBufferBinds / divisor),
    numIndexBufferBinds: round(total.numIndexBufferBinds / divisor),
    numBindGroupBinds: round(total.numBindGroupBinds / divisor),
    numSubmissionGroups: round(total.numSubmissionGroups / divisor),
    numBufferPageGroups: round(total.numBufferPageGroups / divisor),
    numRenderStateGroups: round(total.numRenderStateGroups / divisor),
    bindGroupBindsBySlot: divideObject(total.bindGroupBindsBySlot, divisor),
  };
}

function divideObject(values, divisor) {
  const result = {};
  for (const [key, value] of Object.entries(values || {})) {
    result[key] = round(value / divisor);
  }
  return result;
}

function divideNestedObject(values, divisor) {
  const result = {};
  for (const [key, row] of Object.entries(values || {})) {
    result[key] = {
      ...divideObject({
        drawCalls: row.drawCalls,
        indexCount: row.indexCount,
      }, divisor),
      commandState: divideCommandTotals(row.commandState || createCommandTotals(), divisor),
    };
  }
  return result;
}

function round(value) {
  return Math.round(value * 1000) / 1000;
}

function percentile(values, ratio) {
  if (values.length === 0) {
    return 0;
  }
  const sorted = values.slice().sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * ratio) - 1));
  return round(sorted[index]);
}

function printTable(results) {
  const rows = results.map(result => {
    const loaded = result.loaded || {};
    const aggregate = result.aggregate || {};
    return {
      renderer: result.renderer,
      ok: result.ok ? "yes" : "no",
      chunks: `${loaded.loadedChunks || 0}/${loaded.chunks || 0}`,
      meshes: formatInt(loaded.meshes || 0),
      draws: formatNumber(aggregate.drawCalls_avg),
      prims: formatInt(aggregate.primitives_avg || 0),
      frameCpu: formatNumber(aggregate.frameTimeMs_avg),
      latency: `${formatNumber(aggregate.latencyMs_avg)}/${formatNumber(aggregate.latencyMs_p95)}/${formatNumber(aggregate.latencyMs_max)}`,
      wall: formatNumber(aggregate.wallMs_avg),
      gpu: formatNumber(aggregate.gpuTimeMs_avg),
      phases: formatPhases(aggregate),
      commands: formatCommands(aggregate.commandState_avg),
      groups: formatSubmissionGroups(aggregate.commandState_avg),
      paths: formatDrawPaths(aggregate.drawPaths_avg),
      bins: formatBins(aggregate.bins_avg),
    };
  });
  const headers = ["renderer", "ok", "chunks", "meshes", "draws", "prims", "frame cpu", "lat avg/p95/max", "wall", "gpu", "phases b/b/u/c", "cmd p/v/i/bg", "groups p/s/g", "paths", "bins"];
  const matrix = [
    headers,
    ...rows.map(row => [row.renderer, row.ok, row.chunks, row.meshes, row.draws, row.prims, row.frameCpu, row.latency, row.wall, row.gpu, row.phases, row.commands, row.groups, row.paths, row.bins]),
  ];
  const widths = headers.map((_, column) => Math.max(...matrix.map(row => String(row[column]).length)));
  for (const row of matrix) {
    console.log(row.map((cell, column) => String(cell).padEnd(widths[column])).join("  "));
  }
}

function formatInt(value) {
  return Math.round(value).toLocaleString("en-US");
}

function formatNumber(value) {
  return Number.isFinite(value) ? value.toFixed(3) : "n/a";
}

function formatCommands(commandState) {
  if (!commandState || !Object.values(commandState).some(value => typeof value === "number" && value !== 0)) {
    return "n/a";
  }
  return [
    formatNumber(commandState.numPipelineBinds),
    formatNumber(commandState.numVertexBufferBinds),
    formatNumber(commandState.numIndexBufferBinds),
    formatNumber(commandState.numBindGroupBinds),
  ].join("/");
}

function formatSubmissionGroups(commandState) {
  if (!commandState || !commandState.numSubmissionGroups) {
    return "n/a";
  }
  return [
    formatNumber(commandState.numBufferPageGroups),
    formatNumber(commandState.numRenderStateGroups),
    formatNumber(commandState.numSubmissionGroups),
  ].join("/");
}

function formatPhases(aggregate) {
  if (!aggregate || !aggregate.cpuBinningMs_avg && !aggregate.cpuBatchingMs_avg && !aggregate.cpuUploadMs_avg && !aggregate.cpuCommandEncodingMs_avg) {
    return "n/a";
  }
  return [
    formatNumber(aggregate.cpuBinningMs_avg),
    formatNumber(aggregate.cpuBatchingMs_avg),
    formatNumber(aggregate.cpuUploadMs_avg),
    formatNumber(aggregate.cpuCommandEncodingMs_avg),
  ].join("/");
}

function formatDrawPaths(paths) {
  if (!paths || (!paths.dtxDrawCalls && !paths.vboDrawCalls)) {
    return "n/a";
  }
  return `dtx:${formatNumber(paths.dtxDrawCalls)},vbo:${formatNumber(paths.vboDrawCalls)}`;
}

function formatBins(bins) {
  const entries = Object.entries(bins || {});
  if (entries.length === 0) {
    return "n/a";
  }
  return entries.map(([name, row]) => `${name}:${formatNumber(row.drawCalls)}`).join(",");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const server = createStaticServer(websiteRoot);
  const port = await listen(server);
  const baseUrl = `http://127.0.0.1:${port}`;
  let browser = null;
  try {
    browser = await puppeteer.launch({
      headless: true,
      protocolTimeout: 240000,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--enable-unsafe-swiftshader",
        "--enable-unsafe-webgpu",
        "--ignore-gpu-blocklist",
        "--enable-features=Vulkan",
        `--window-size=${args.viewportWidth},${args.viewportHeight}`,
      ],
    });
    const results = [];
    for (const rendererName of ["webgl", "webgpu"]) {
      console.log(`Running ${rendererName}...`);
      results.push(await runRenderer(browser, baseUrl, rendererName, args));
    }
    printTable(results);
    const payload = {
      generatedAt: new Date().toISOString(),
      example: "procedural city XGF renderer comparison",
      dataset: "ProceduralCityAmsterdam/xgfstream",
      viewport: `${args.viewportWidth}x${args.viewportHeight}`,
      frames: args.frames,
      results,
    };
    if (args.outputPath) {
      fs.writeFileSync(args.outputPath, JSON.stringify(payload, null, 2));
      console.log(`Wrote ${args.outputPath}`);
    }
    const failed = results.filter(result => !result.ok);
    if (failed.length > 0) {
      process.exitCode = 1;
      console.error(`Failed renderers: ${failed.map(result => result.renderer).join(", ")}`);
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
