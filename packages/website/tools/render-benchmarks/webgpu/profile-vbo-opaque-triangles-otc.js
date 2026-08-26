// Profiles the experimental VBO opaque-triangle path against the default
// texture-pulled path on the OTC Conference Center XGF model.

const fs = require("fs");
const http = require("http");
const path = require("path");
const {createRequire} = require("module");

const repoRoot = path.resolve(__dirname, "..", "..", "..", "..", "..");
const websiteRoot = path.resolve(__dirname, "..", "..", "..");
const websiteRequire = createRequire(path.join(websiteRoot, "package.json"));
const puppeteer = websiteRequire("puppeteer");

const DEFAULTS = {
  frames: 60,
  warmupFrames: 20,
  viewportWidth: 1280,
  viewportHeight: 720,
  outputPath: "/tmp/xeokit-vbo-opaque-triangles-otc-profile.json",
};

const PROFILER_HTML = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>OTC VBO opaque triangle profile</title>
  <style>
    html, body { margin: 0; width: 100%; height: 100%; overflow: hidden; background: #000; }
    .xkt-toolbar, .xkt-info-panel, .xkt-info-pill, .xkt-issues-panel, .xkt-issues-pill,
    .xkt-pill-rail, .xkt-vp-header, .xeokit-loading-overlay { display: none !important; }
  </style>
</head>
<body>
<script type="module">
import * as xeokit from "/js/xeokit-studio-bundle.js";

const MODEL_ID = "OTC";
const MODEL_BASE = "/models/OTCConferenceCenter";
let activeModel = null;
let activeStorageMode = null;
let loadSerial = 0;

const initialCamera = {
  eye: [165, -150, 90],
  look: [0, 0, 20],
  up: [0, 0, 1]
};

function resetCamera(view) {
  view.camera.eye = initialCamera.eye.slice();
  view.camera.look = initialCamera.look.slice();
  view.camera.up = initialCamera.up.slice();
  view.renderMode = xeokit.base.constants.NavigationRender;
  view.needsRender();
}

async function setStorageMode(studio, view, enabled) {
  const storageMode = enabled ? "vbo" : "dtx";
  if (activeStorageMode === storageMode && activeModel && !activeModel.destroyed) {
    return;
  }
  if (activeModel && !activeModel.destroyed) {
    activeModel.destroy();
  }
  const sceneModelResult = studio.scene.createModel({
    id: MODEL_ID + "-" + storageMode + "-" + (++loadSerial),
    updateHint: enabled ? "static" : "dynamic",
    coordinateSystem: {
      basis: [1, 0, 0, 0, 1, 0, 0, 0, 1],
      origin: [0, 0, 0],
      units: "meters",
      scaleToMeters: 1
    }
  });
  if (!sceneModelResult.ok) {
    throw new Error(sceneModelResult.error);
  }
  activeModel = sceneModelResult.value;
  activeStorageMode = storageMode;
  await studio.loadModel({
    id: MODEL_ID + "-" + storageMode,
    src: MODEL_BASE + "/xgf/model.xgf",
    format: "xgf",
    sceneModel: activeModel
  });
  const aabb = studio.picking.collisionIndex.getSceneAABB();
  if (aabb) {
    studio.viewManager.fitToAabb(view, aabb);
  }
}

function waitFrames(view, n, orbit = false) {
  return new Promise(resolve => {
    let left = n;
    function tick() {
      if (orbit) {
        view.camera.orbitYaw(0.15);
      }
      view.renderMode = xeokit.base.constants.NavigationRender;
      view.needsRender();
      if (--left <= 0) {
        requestAnimationFrame(resolve);
        return;
      }
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  });
}

function aggregate(frames) {
  const perBin = {};
  const vboTotals = {
    handledBatches: 0,
    fallbackBatches: 0,
    handledPrims: 0,
    fallbackPrims: 0,
    rebuildCount: 0,
    rebuildMs: 0
  };
  let totalGpu = 0;
  let totalCpu = 0;
  let totalDraws = 0;
  let totalPrims = 0;
  const n = frames.length || 1;

  for (const frame of frames) {
    totalGpu += frame.gpuTimeMs ?? 0;
    totalCpu += frame.timeMs?.duration ?? 0;
    totalDraws += frame.numDrawCalls ?? 0;
    totalPrims += frame.numPrims ?? 0;
    if (frame.vboGeometryTriangles) {
      for (const key of Object.keys(vboTotals)) {
        vboTotals[key] += frame.vboGeometryTriangles[key] ?? 0;
      }
    }
    for (const bin of frame.renderBins) {
      const row = perBin[bin.name] ??= {
        gpuMs: 0,
        cpuMs: 0,
        draws: 0,
        prims: 0,
        count: 0
      };
      row.gpuMs += bin.gpuTimeMs ?? 0;
      row.cpuMs += bin.timeMs?.duration ?? 0;
      row.draws += bin.drawCalls.length;
      for (const drawCall of bin.drawCalls) {
        row.prims += drawCall.primRange?.numPrims ?? 0;
      }
      row.count++;
    }
  }

  const perBinAvg = {};
  for (const [name, row] of Object.entries(perBin)) {
    const count = row.count || 1;
    perBinAvg[name] = {
      gpuMs_avg: round(row.gpuMs / count),
      cpuMs_avg: round(row.cpuMs / count),
      draws_avg: Math.round(row.draws / count),
      prims_avg: Math.round(row.prims / count)
    };
  }

  const coveredPrims = vboTotals.handledPrims + vboTotals.fallbackPrims;
  return {
    frames: frames.length,
    frame: {
      gpuMs_avg: round(totalGpu / n),
      cpuMs_avg: round(totalCpu / n),
      draws_avg: Math.round(totalDraws / n),
      prims_avg: Math.round(totalPrims / n)
    },
    perBin: perBinAvg,
    vboGeometryTriangles: {
      totals: roundObject(vboTotals),
      avgPerFrame: roundObject({
        handledBatches: vboTotals.handledBatches / n,
        fallbackBatches: vboTotals.fallbackBatches / n,
        handledPrims: vboTotals.handledPrims / n,
        fallbackPrims: vboTotals.fallbackPrims / n,
        rebuildCount: vboTotals.rebuildCount / n,
        rebuildMs: vboTotals.rebuildMs / n
      }),
      handledPrimitiveRatio: coveredPrims > 0 ? round(vboTotals.handledPrims / coveredPrims) : 0
    }
  };
}

function round(value) {
  return Number(value.toFixed(3));
}

function roundObject(obj) {
  const rounded = {};
  for (const [key, value] of Object.entries(obj)) {
    rounded[key] = typeof value === "number" ? round(value) : value;
  }
  return rounded;
}

async function capturePath(label, studio, view, inspector, enabled, frames, warmupFrames) {
  await setStorageMode(studio, view, enabled);
  resetCamera(view);
  await waitFrames(view, warmupFrames, true);
  const captured = await inspector.captureFrames(frames);
  return {
    label,
    enabled,
    aggregate: aggregate(captured)
  };
}

async function captureColdVBO(studio, view, inspector) {
  await setStorageMode(studio, view, true);
  resetCamera(view);
  const captured = await inspector.captureFrames(1);
  return aggregate(captured);
}

async function boot() {
  const studio = new xeokit.studio.Studio({maxViews: 1});
  await studio.init();

  const view = studio.viewManager.createView({
    camera: {
      eye: initialCamera.eye,
      look: initialCamera.look,
      up: initialCamera.up,
      perspectiveProjection: {fov: 60}
    },
    renderMode: xeokit.base.constants.NavigationRender
  });
  xeokit.viewing.adaptiveQuality.AdaptiveQuality.getFor(view)?.destroy();
  view.renderMode = xeokit.base.constants.NavigationRender;
  view.effects.sao.renderModes = [];
  view.effects.shadows.renderModes = [];
  view.effects.edges.renderModes = [];

  await setStorageMode(studio, view, false);
  studio.finished();

  const inspectorResult = studio.renderer.getRenderInspector();
  if (inspectorResult.ok === false) {
    throw new Error(inspectorResult.error);
  }

  const canvas = document.querySelector("canvas");
  const gl = canvas && canvas.getContext("webgl2");
  const glInfo = {
    vendor: gl?.getParameter(gl.VENDOR) ?? "unknown",
    renderer: gl?.getParameter(gl.RENDERER) ?? "unknown",
    timerSupported: !!gl?.getExtension("EXT_disjoint_timer_query_webgl2")
  };

  window.__runVBOOTCProfile = async ({frames, warmupFrames}) => {
    const inspector = inspectorResult.value;
    const texture = await capturePath("texture", studio, view, inspector, false, frames, warmupFrames);
    const vboCold = await captureColdVBO(studio, view, inspector);
    const vbo = await capturePath("vbo", studio, view, inspector, true, frames, warmupFrames);
    return {
      modelId: MODEL_ID,
      renderMode: "NavigationRender",
      frames,
      warmupFrames,
      glInfo,
      texture,
      vboCold,
      vbo
    };
  };
  window.__otcReady = true;
}

boot().catch(error => {
  window.__otcError = error instanceof Error ? error.message : String(error);
  console.error(error);
});
</script>
</body>
</html>`;

function parseArgs(argv) {
  const args = {...DEFAULTS};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--frames") {
      args.frames = parsePositiveInt(argv[++i], "frames");
    } else if (arg === "--warmup-frames") {
      args.warmupFrames = parsePositiveInt(argv[++i], "warmup frames");
    } else if (arg === "--viewport") {
      const value = argv[++i] || "";
      const match = /^(\\d+)x(\\d+)$/.exec(value);
      if (!match) {
        throw new Error("--viewport must use WIDTHxHEIGHT, for example 1280x720");
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
  console.log(`Usage: node packages/website/tools/render-benchmarks/webgpu/profile-vbo-opaque-triangles-otc.js [options]

Options:
  --frames <n>          Steady-state capture frames. Default ${DEFAULTS.frames}.
  --warmup-frames <n>   Warm-up frames before each steady capture. Default ${DEFAULTS.warmupFrames}.
  --viewport <WxH>      Browser viewport. Default ${DEFAULTS.viewportWidth}x${DEFAULTS.viewportHeight}.
  --output <path>       JSON output path. Default ${DEFAULTS.outputPath}.
`);
}

function parsePositiveInt(value, name) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid ${name}: ${value}`);
  }
  return parsed;
}

function createServer() {
  return http.createServer((req, res) => {
    const requestUrl = new URL(req.url || "/", "http://127.0.0.1");
    if (requestUrl.pathname === "/__vbo_otc_profile.html") {
      res.writeHead(200, {"content-type": "text/html; charset=utf-8"});
      res.end(PROFILER_HTML);
      return;
    }

    let filePath;
    try {
      filePath = path.normalize(path.join(websiteRoot, decodeURIComponent(requestUrl.pathname)));
    } catch (_e) {
      res.writeHead(400);
      res.end("Bad request");
      return;
    }

    if (!filePath.startsWith(websiteRoot + path.sep)) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }

    if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
      filePath = path.join(filePath, "index.html");
    }
    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end("Not found");
        return;
      }
      res.writeHead(200, {"content-type": contentType(filePath)});
      res.end(data);
    });
  });
}

function contentType(filePath) {
  switch (path.extname(filePath).toLowerCase()) {
    case ".html": return "text/html; charset=utf-8";
    case ".js": return "text/javascript; charset=utf-8";
    case ".css": return "text/css; charset=utf-8";
    case ".json": return "application/json; charset=utf-8";
    case ".svg": return "image/svg+xml";
    case ".png": return "image/png";
    case ".jpg":
    case ".jpeg": return "image/jpeg";
    case ".xgf": return "application/octet-stream";
    default: return "application/octet-stream";
  }
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

function summarizeResult(result) {
  const textureOpaque = result.texture.aggregate.perBin.opaque ?? {};
  const vboOpaque = result.vbo.aggregate.perBin.opaque ?? {};
  const vboCoverage = result.vbo.aggregate.vboGeometryTriangles.avgPerFrame;
  const cold = result.vboCold.vboGeometryTriangles.totals;
  return {
    textureOpaque,
    vboOpaque,
    vboCoverage,
    vboHandledPrimitiveRatio: result.vbo.aggregate.vboGeometryTriangles.handledPrimitiveRatio,
    vboColdRebuild: {
      rebuildCount: cold.rebuildCount,
      rebuildMs: cold.rebuildMs,
      handledBatches: cold.handledBatches,
      handledPrims: cold.handledPrims,
      fallbackBatches: cold.fallbackBatches,
      fallbackPrims: cold.fallbackPrims
    }
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const server = createServer();
  let browser;
  try {
    const port = await listen(server);
    const url = `http://127.0.0.1:${port}/__vbo_otc_profile.html`;
    const pageErrors = [];
    const consoleErrors = [];
    const httpErrors = [];

    browser = await puppeteer.launch({
      headless: true,
      protocolTimeout: 360000,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--enable-unsafe-swiftshader",
        "--enable-webgl",
        "--ignore-gpu-blocklist",
        `--window-size=${args.viewportWidth},${args.viewportHeight}`,
      ],
    });

    const page = await browser.newPage();
    await page.setViewport({width: args.viewportWidth, height: args.viewportHeight, deviceScaleFactor: 1});
    page.on("pageerror", error => pageErrors.push(error.message));
    page.on("console", message => {
      if (message.type() === "error") {
        const loc = message.location();
        consoleErrors.push({text: message.text(), url: loc.url});
      }
    });
    page.on("requestfailed", request => {
      const failure = request.failure();
      pageErrors.push(`request failed: ${request.url()} (${failure ? failure.errorText : "unknown"})`);
    });
    page.on("response", response => {
      if (response.status() >= 400) {
        httpErrors.push({status: response.status(), url: response.url()});
      }
    });

    await page.goto(url, {waitUntil: "domcontentloaded", timeout: 60000});
    await page.waitForFunction(() => window.__otcReady === true || !!window.__otcError, {timeout: 180000});
    const bootError = await page.evaluate(() => window.__otcError || "");
    if (bootError) {
      throw new Error(bootError);
    }
    const result = await page.evaluate(
      profileArgs => window.__runVBOOTCProfile(profileArgs),
      {frames: args.frames, warmupFrames: args.warmupFrames}
    );
    result.url = url;
    result.args = args;
    result.pageErrors = pageErrors;
    result.consoleErrors = consoleErrors.filter(entry => !entry.url.endsWith("/favicon.ico"));
    result.httpErrors = httpErrors.filter(entry => !entry.url.endsWith("/favicon.ico"));
    result.summary = summarizeResult(result);

    fs.writeFileSync(args.outputPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
    console.log(`Wrote ${args.outputPath}`);
    console.log(JSON.stringify(result.summary, null, 2));

    const errors = [
      ...result.pageErrors,
      ...result.consoleErrors.map(entry => entry.text),
      ...result.httpErrors.map(entry => `${entry.status} ${entry.url}`),
    ];
    if (errors.length > 0) {
      console.error("Browser errors:");
      for (const error of errors) {
        console.error(`  - ${error}`);
      }
      process.exitCode = 1;
    }
  } finally {
    if (browser) {
      await browser.close();
    }
    await close(server);
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
