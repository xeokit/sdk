// Benchmarks the WebGPU XGF procedural-city example across depth/edge pass
// modes. The script starts a temporary website server, drives the camera, then
// reads WebGPURenderer inspector stats and optional GPU timestamp results.

const fs = require("fs");
const http = require("http");
const path = require("path");
const {createRequire} = require("module");

const websiteRoot = path.resolve(__dirname, "..", "..", "..");
const websiteRequire = createRequire(path.join(websiteRoot, "package.json"));
const puppeteer = websiteRequire("puppeteer");

const DEFAULTS = {
  frames: 36,
  settleTimeoutMs: 180000,
  viewportWidth: 1280,
  viewportHeight: 800,
  outputPath: "",
};

const MODES = [
  {name: "color", depth: false, edges: false},
  {name: "depth+color", depth: true, edges: false},
  {name: "color+edges", depth: false, edges: true},
  {name: "depth+color+edges", depth: true, edges: true},
];

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
  console.log(`Usage: node packages/website/tools/render-benchmarks/webgpu/benchmark-webgpu-xgf-city.js [options]

Options:
  --frames <n>                 Camera frames sampled per mode. Default ${DEFAULTS.frames}.
  --settle-timeout-ms <n>      Max wait for stream loading per mode. Default ${DEFAULTS.settleTimeoutMs}.
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
  if (ext === ".html") {
    return "text/html; charset=utf-8";
  }
  if (ext === ".js" || ext === ".mjs") {
    return "text/javascript; charset=utf-8";
  }
  if (ext === ".json") {
    return "application/json; charset=utf-8";
  }
  if (ext === ".wasm") {
    return "application/wasm";
  }
  if (ext === ".png") {
    return "image/png";
  }
  if (ext === ".jpg" || ext === ".jpeg") {
    return "image/jpeg";
  }
  if (ext === ".css") {
    return "text/css; charset=utf-8";
  }
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

async function runMode(browser, baseUrl, mode, args) {
  const page = await browser.newPage();
  const pageErrors = [];
  const consoleErrors = [];
  const httpErrors = [];
  const query = new URLSearchParams({
    timestamps: "1",
    depth: mode.depth ? "1" : "0",
    edges: mode.edges ? "1" : "0",
  });
  const url = `${baseUrl}/examples/import/xgf/procedural-city/index.html?renderer=webgpu&${query}`;

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
          consoleErrors.push({
            text: message.text(),
            url: location.url,
          });
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
    await page.waitForFunction(
      () => !!window.webgpuProceduralCityXGFStreamDemo || document.getElementById("status")?.dataset.state === "error",
      {timeout: 120000},
    );
    const initial = await sample(page);
    if (!initial.ready) {
      return {
        mode: mode.name,
        ok: false,
        url,
        error: initial.statusText || "Example did not expose webgpuProceduralCityXGFStreamDemo.",
        pageErrors,
        consoleErrors,
        httpErrors,
      };
    }

    await waitForStreamSettled(page, args.settleTimeoutMs);
    await renderCameraFrames(page, Math.max(6, Math.floor(args.frames / 3)));
    await waitForRendererSettled(page, 30000);
    await waitForSettledGPUTimestamps(page, 5000);

    const samples = [];
    for (let i = 0; i < args.frames; i++) {
      await renderCameraFrame(page, i);
      await waitForSettledGPUTimestamps(page, 5000);
      samples.push(await sample(page));
    }

    const aggregate = aggregateSamples(samples);
    return {
      mode: mode.name,
      depth: mode.depth,
      edges: mode.edges,
      ok: pageErrors.length === 0 && consoleErrors.length === 0 && httpErrors.length === 0,
      url,
      streamed: await sample(page),
      aggregate,
      pageErrors,
      consoleErrors,
      httpErrors,
    };
  } finally {
    await page.close();
  }
}

async function waitForStreamSettled(page, timeoutMs) {
  await page.waitForFunction(() => {
    const demo = window.webgpuProceduralCityXGFStreamDemo;
    return !!demo
      && demo.streamController.loadedChunkIds.size >= demo.streamController.chunkManifests.length
      && demo.streamController.loadingChunkIds.size === 0;
  }, {timeout: timeoutMs}).catch(() => {});
}

async function waitForRendererSettled(page, timeoutMs) {
  await page.waitForFunction(() => {
    const demo = window.webgpuProceduralCityXGFStreamDemo;
    if (!demo) {
      return false;
    }
    const viewIndex = demo.view.viewIndex ?? 0;
    const frame = demo.renderer.getRenderInspector?.()?.value?.renderStats?.views?.[viewIndex];
    return !!frame
      && demo.streamController.loadedChunkIds.size >= demo.streamController.chunkManifests.length
      && demo.streamController.loadingChunkIds.size === 0
      && (frame.numPendingSegments || 0) === 0;
  }, {timeout: timeoutMs}).catch(() => {});
}

async function renderCameraFrames(page, count) {
  for (let i = 0; i < count; i++) {
    await renderCameraFrame(page, i);
  }
}

async function renderCameraFrame(page, frame) {
  await page.evaluate((frameIndex) => new Promise(resolve => {
    const demo = window.webgpuProceduralCityXGFStreamDemo;
    if (!demo) {
      resolve();
      return;
    }
    const camera = demo.view.camera;
    const angle = frameIndex * 0.045;
    const radius = 1250;
    camera.eye = [
      Math.cos(angle) * radius,
      Math.sin(angle) * radius,
      560 + Math.sin(angle * 0.5) * 60
    ];
    camera.look = [0, 0, 32];
    demo.view.needsRender();
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  }), frame);
}

async function waitForSettledGPUTimestamps(page, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const settled = await page.evaluate(() => {
      const demo = window.webgpuProceduralCityXGFStreamDemo;
      if (!demo) {
        return false;
      }
      const viewIndex = demo.view.viewIndex ?? 0;
      const frame = demo.renderer.getRenderInspector?.()?.value?.renderStats?.views?.[viewIndex];
      return !!frame?.gpuTime?.available && !frame.gpuTime.pending;
    });
    if (settled) {
      return true;
    }
    await sleep(25);
  }
  return false;
}

async function sample(page) {
  return page.evaluate(() => {
    const demo = window.webgpuProceduralCityXGFStreamDemo;
    if (!demo) {
      return {
        ready: false,
        statusText: document.getElementById("status")?.innerText || "",
      };
    }
    const viewIndex = demo.view.viewIndex ?? 0;
    const inspector = demo.renderer.getRenderInspector?.()?.value;
    const frame = inspector?.renderStats?.views?.[viewIndex] || null;
    return {
      ready: true,
      loadedChunks: demo.streamController.loadedChunkIds.size,
      loadingChunks: demo.streamController.loadingChunkIds.size,
      chunks: demo.streamController.chunkManifests.length,
      objects: demo.streamController.loadedTotals.objects,
      meshes: demo.streamController.loadedTotals.meshes,
      frame: frame ? {
        renderReason: frame.renderReason,
        numDrawCalls: frame.numDrawCalls,
        numPrims: frame.numPrims,
        numBatches: frame.numBatches,
        numSegments: frame.numSegments,
        numBuiltSegments: frame.numBuiltSegments,
        numPendingSegments: frame.numPendingSegments,
        commandState: frame.commandState,
        cpuTime: frame.cpuTime,
        gpuTime: frame.gpuTime,
        renderBins: frame.renderBins.map(bin => ({
          name: bin.name,
          drawCalls: bin.drawCalls.length,
          indexCount: bin.drawCalls.reduce((sum, draw) => sum + draw.indexCount, 0),
          commandState: bin.commandState
        }))
      } : null,
      statusText: document.getElementById("status")?.innerText || "",
    };
  });
}

function aggregateSamples(samples) {
  const valid = samples.filter(sample => sample.frame);
  const divisor = valid.length || 1;
  const passTotals = {};
  const binTotals = {};
  let drawCalls = 0;
  let batches = 0;
  let primitives = 0;
  let cpuFrameMs = 0;
  let cpuBinningMs = 0;
  let cpuBatchingMs = 0;
  let cpuUploadMs = 0;
  let cpuCommandEncodingMs = 0;
  const commandTotals = createCommandTotals();

  for (const sample of valid) {
    const frame = sample.frame;
    drawCalls += frame.numDrawCalls || 0;
    batches += frame.numBatches || 0;
    primitives += frame.numPrims || 0;
    cpuFrameMs += frame.cpuTime?.frameMs || 0;
    cpuBinningMs += frame.cpuTime?.binningMs || 0;
    cpuBatchingMs += frame.cpuTime?.batchingMs || 0;
    cpuUploadMs += frame.cpuTime?.uploadMs || 0;
    cpuCommandEncodingMs += frame.cpuTime?.commandEncodingMs || 0;
    addCommandTotals(commandTotals, frame.commandState);
    for (const [name, value] of Object.entries(frame.gpuTime?.passes || {})) {
      passTotals[name] = (passTotals[name] || 0) + value;
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
    cpuFrameMs_avg: round(cpuFrameMs / divisor),
    cpuBinningMs_avg: round(cpuBinningMs / divisor),
    cpuBatchingMs_avg: round(cpuBatchingMs / divisor),
    cpuUploadMs_avg: round(cpuUploadMs / divisor),
    cpuCommandEncodingMs_avg: round(cpuCommandEncodingMs / divisor),
    commandState_avg: divideCommandTotals(commandTotals, divisor),
    gpuPassMs_avg: divideObject(passTotals, divisor),
    bins_avg: divideNestedObject(binTotals, divisor),
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
  for (const [key, value] of Object.entries(values)) {
    result[key] = round(value / divisor);
  }
  return result;
}

function divideNestedObject(values, divisor) {
  const result = {};
  for (const [key, row] of Object.entries(values)) {
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

function printTable(results) {
  const rows = results.map(result => {
    const streamed = result.streamed || {};
    const aggregate = result.aggregate || {};
    return {
      mode: result.mode,
      ok: result.ok ? "yes" : "no",
      chunks: `${streamed.loadedChunks || 0}/${streamed.chunks || 0}`,
      meshes: formatInt(streamed.meshes || 0),
      draws: formatNumber(aggregate.drawCalls_avg),
      batches: formatNumber(aggregate.batches_avg),
      commands: formatCommands(aggregate.commandState_avg),
      bindGroupSlots: formatBindGroupSlots(aggregate.commandState_avg),
      groups: formatSubmissionGroups(aggregate.commandState_avg),
      cpu: formatNumber(aggregate.cpuFrameMs_avg),
      gpu: formatPasses(aggregate.gpuPassMs_avg),
      bins: formatBins(aggregate.bins_avg),
    };
  });
  const headers = ["mode", "ok", "chunks", "meshes", "draws", "batches", "cmd p/v/i/bg", "bg slots", "groups p/s/g", "cpu ms", "gpu pass ms", "bins"];
  const matrix = [
    headers,
    ...rows.map(row => [row.mode, row.ok, row.chunks, row.meshes, row.draws, row.batches, row.commands, row.bindGroupSlots, row.groups, row.cpu, row.gpu, row.bins]),
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

function formatPasses(passes) {
  const entries = Object.entries(passes || {});
  if (entries.length === 0) {
    return "n/a";
  }
  return entries.map(([name, value]) => `${name}:${formatNumber(value)}`).join(",");
}

function formatCommands(commandState) {
  if (!commandState) {
    return "n/a";
  }
  return [
    formatNumber(commandState.numPipelineBinds),
    formatNumber(commandState.numVertexBufferBinds),
    formatNumber(commandState.numIndexBufferBinds),
    formatNumber(commandState.numBindGroupBinds),
  ].join("/");
}

function formatBindGroupSlots(commandState) {
  const entries = Object.entries(commandState?.bindGroupBindsBySlot || {});
  if (entries.length === 0) {
    return "n/a";
  }
  return entries
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([slot, count]) => `${slot}:${formatNumber(count)}`)
    .join(",");
}

function formatSubmissionGroups(commandState) {
  if (!commandState) {
    return "n/a";
  }
  return [
    formatNumber(commandState.numBufferPageGroups),
    formatNumber(commandState.numRenderStateGroups),
    formatNumber(commandState.numSubmissionGroups),
  ].join("/");
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
    for (const mode of MODES) {
      console.log(`Running ${mode.name}...`);
      results.push(await runMode(browser, baseUrl, mode, args));
    }
    printTable(results);
    const payload = {
      generatedAt: new Date().toISOString(),
      example: "import/xgf/procedural-city?renderer=webgpu",
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
      console.error(`Failed modes: ${failed.map(result => result.mode).join(", ")}`);
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
