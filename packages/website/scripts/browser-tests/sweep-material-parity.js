#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const httpServer = require("http-server");
const puppeteer = require("puppeteer");

const websiteRoot = path.resolve(__dirname, "..", "..");
const defaultReportsDir = path.join(websiteRoot, "reports");

const EXAMPLE_ID = "view/renderers/webgl-webgpu-material-parity";
const DEFAULT_PORT = 3012;
const DEFAULT_TIMEOUT_MS = 120000;
const DEFAULT_SETTLE_MS = 500;
const DEFAULT_VIEWPORT = {width: 1280, height: 720};
const DEFAULT_CAMERA = {
  eye: [3.9, -6.8, 6.1],
  look: [0.0, -0.05, 0.42],
  up: [0, 0, 1]
};
const DEFAULT_SAMPLE_WIDTH = 160;
const DEFAULT_SAMPLE_HEIGHT = 90;
const DEFAULT_DIFF_AMPLIFICATION = 4;
const MASK_SELECTORS = ["#modeBar", "#rendererLabels", ".label", ".status"];

const MATERIAL_FEATURES = [
  "colorTexture",
  "normalTexture",
  "occlusionTexture",
  "metallicRoughnessTexture",
  "alphaMask",
  "alphaBlend",
  "emissiveTexture",
  "clearcoat",
  "sheen"
];

const IGNORED_BROWSER_ERROR_RULES = [
  {
    id: "system-chrome-headless-webgpu-device-lost",
    match: "[WebGPURenderer] [WebGPURenderer.deviceLost] WebGPU device was lost. A valid external Instance reference no longer exists.",
    headlessOnly: true,
    note: "Known system Chrome headless WebGPU environment failure. Do not chase this as an SDK/example regression unless it reproduces outside the audit harness."
  }
];

function allFeatures() {
  return Object.fromEntries(MATERIAL_FEATURES.map((feature) => [feature, true]));
}

function noFeatures() {
  return Object.fromEntries(MATERIAL_FEATURES.map((feature) => [feature, false]));
}

function onlyFeatures(...enabledFeatures) {
  const enabled = new Set(enabledFeatures);
  return Object.fromEntries(MATERIAL_FEATURES.map((feature) => [feature, enabled.has(feature)]));
}

function makeSweepCases() {
  return [
    {id: "mode-baseline-all", label: "Baseline, all material features", mode: "baseline", features: allFeatures()},
    {id: "mode-pbr-all", label: "PBR, all material features", mode: "pbr", features: allFeatures()},
    {id: "mode-ibl-all", label: "IBL, all material features", mode: "ibl", features: allFeatures()},
    {id: "mode-transparent-all", label: "Transparent, all material features", mode: "transparent", features: allFeatures()},
    {id: "mode-all-effects-all", label: "All effects, all material features", mode: "all", features: allFeatures()},
    {id: "control-all-off", label: "PBR, all material features disabled", mode: "pbr", features: noFeatures()},
    {id: "feature-normal", label: "PBR, normal texture only", mode: "pbr", features: onlyFeatures("normalTexture")},
    {id: "feature-occlusion", label: "PBR, occlusion texture only", mode: "pbr", features: onlyFeatures("occlusionTexture")},
    {id: "feature-metallic-roughness", label: "IBL, metallic-roughness texture only", mode: "ibl", features: onlyFeatures("metallicRoughnessTexture")},
    {id: "feature-alpha-mask", label: "Transparent, alpha mask only", mode: "transparent", features: onlyFeatures("alphaMask")},
    {id: "feature-alpha-blend", label: "Transparent, alpha blend only", mode: "transparent", features: onlyFeatures("alphaBlend")},
    {id: "feature-emissive", label: "PBR, emissive texture only", mode: "pbr", features: onlyFeatures("emissiveTexture")},
    {id: "feature-clearcoat", label: "IBL, clearcoat only", mode: "ibl", features: onlyFeatures("clearcoat")},
    {id: "feature-sheen", label: "IBL, sheen only", mode: "ibl", features: onlyFeatures("sheen")},
    {
      id: "ibl-focus-mirror-chrome",
      label: "IBL focus, mirror chrome",
      mode: "ibl",
      features: allFeatures(),
      camera: {eye: [-0.7, -2.5, 2.35], look: [-1.8, 3.05, 0.55], up: [0, 0, 1]}
    },
    {
      id: "ibl-focus-rough-white",
      label: "IBL focus, rough white dielectric",
      mode: "ibl",
      features: allFeatures(),
      camera: {eye: [0.0, -2.6, 2.35], look: [0.0, 3.05, 0.55], up: [0, 0, 1]}
    },
    {
      id: "ibl-focus-dark-clearcoat",
      label: "IBL focus, dark clearcoat",
      mode: "ibl",
      features: allFeatures(),
      camera: {eye: [0.7, -2.5, 2.35], look: [1.8, 3.05, 0.55], up: [0, 0, 1]}
    }
  ];
}

function getDefaultChromePath() {
  const candidates = [
    process.env.CHROME_BIN,
    process.env.PUPPETEER_EXECUTABLE_PATH,
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser"
  ];
  return candidates.find((candidate) => candidate && fs.existsSync(candidate)) || null;
}

function parseArgs(argv) {
  const args = {
    chromePath: getDefaultChromePath(),
    headless: false,
    includeWarnings: false,
    failOnErrors: true,
    caseFilters: [],
    timeoutMs: DEFAULT_TIMEOUT_MS,
    settleMs: DEFAULT_SETTLE_MS,
    port: Number(process.env.PORT || DEFAULT_PORT),
    viewportWidth: DEFAULT_VIEWPORT.width,
    viewportHeight: DEFAULT_VIEWPORT.height,
    sampleWidth: DEFAULT_SAMPLE_WIDTH,
    sampleHeight: DEFAULT_SAMPLE_HEIGHT,
    diffAmplification: DEFAULT_DIFF_AMPLIFICATION,
    maxMeanRGBDelta: null,
    output: path.join(defaultReportsDir, "material-parity-sweep.json"),
    visualOutputDir: null
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--") {
      continue;
    } else if (arg === "--chrome" || arg === "--chrome-path") {
      args.chromePath = argv[++i] || null;
    } else if (arg === "--headless") {
      args.headless = true;
    } else if (arg === "--headful" || arg === "--no-headless") {
      args.headless = false;
    } else if (arg === "--include-warnings") {
      args.includeWarnings = true;
    } else if (arg === "--no-fail-on-errors") {
      args.failOnErrors = false;
    } else if (arg === "--case" || arg === "--cases") {
      args.caseFilters.push(...splitList(argv[++i] || ""));
    } else if (arg === "--timeout" || arg === "--timeout-ms") {
      args.timeoutMs = parsePositiveInteger(argv[++i], "--timeout");
    } else if (arg === "--settle" || arg === "--settle-ms") {
      args.settleMs = parseNonNegativeInteger(argv[++i], "--settle");
    } else if (arg === "--port" || arg === "-p") {
      args.port = parsePositiveInteger(argv[++i], "--port");
    } else if (arg === "--viewport") {
      const [width, height] = splitViewport(argv[++i] || "");
      args.viewportWidth = width;
      args.viewportHeight = height;
    } else if (arg === "--sample-width") {
      args.sampleWidth = parsePositiveInteger(argv[++i], "--sample-width");
    } else if (arg === "--sample-height") {
      args.sampleHeight = parsePositiveInteger(argv[++i], "--sample-height");
    } else if (arg === "--diff-amplification") {
      args.diffAmplification = parsePositiveNumber(argv[++i], "--diff-amplification");
    } else if (arg === "--max-mean-rgb-delta") {
      args.maxMeanRGBDelta = parsePositiveNumber(argv[++i], "--max-mean-rgb-delta");
    } else if (arg === "--output" || arg === "-o") {
      args.output = path.resolve(argv[++i] || args.output);
    } else if (arg === "--visual-output" || arg === "--visual-output-dir") {
      args.visualOutputDir = path.resolve(argv[++i] || "");
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      args.caseFilters.push(...splitList(arg));
    }
  }

  if (!args.visualOutputDir) {
    const extension = path.extname(args.output);
    const baseName = extension ? path.basename(args.output, extension) : path.basename(args.output);
    args.visualOutputDir = path.join(path.dirname(args.output), `${baseName}-artifacts`);
  }

  return args;
}

function splitList(raw) {
  return String(raw || "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

function splitViewport(raw) {
  const match = /^(\d+)x(\d+)$/i.exec(String(raw || "").trim());
  if (!match) {
    console.error("--viewport must use WIDTHxHEIGHT, for example 1280x720.");
    process.exit(2);
  }
  return [parsePositiveInteger(match[1], "--viewport width"), parsePositiveInteger(match[2], "--viewport height")];
}

function parsePositiveInteger(raw, flag) {
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1) {
    console.error(`${flag} must be a positive integer.`);
    process.exit(2);
  }
  return value;
}

function parseNonNegativeInteger(raw, flag) {
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0) {
    console.error(`${flag} must be a non-negative integer.`);
    process.exit(2);
  }
  return value;
}

function parsePositiveNumber(raw, flag) {
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) {
    console.error(`${flag} must be a non-negative number.`);
    process.exit(2);
  }
  return value;
}

function printHelp() {
  console.log(`Usage: node sweep-material-parity.js [options] [case-id[,case-id...]]

Loads the WebGL/WebGPU material parity example once, hot-reconfigures the
page through window.webglWebgpuMaterialParityDemo.reconfigure(), captures
both renderer viewports after each state, and writes a visual-delta report.

Options:
  --case <ids>                Run only matching case ids. Comma-separated.
  --chrome <path>             Chrome executable path. Defaults to system Chrome.
  --headless                  Run Chrome headless. Default is headful.
  --headful                   Run Chrome visibly.
  --timeout <ms>              Page/readiness timeout. Default ${DEFAULT_TIMEOUT_MS}.
  --settle <ms>               Extra settle time after each state. Default ${DEFAULT_SETTLE_MS}.
  --port <n>                  Local static server port. Default ${DEFAULT_PORT}.
  --viewport <WxH>            Browser viewport. Default ${DEFAULT_VIEWPORT.width}x${DEFAULT_VIEWPORT.height}.
  --sample-width <n>          Downsample width for metrics. Default ${DEFAULT_SAMPLE_WIDTH}.
  --sample-height <n>         Downsample height for metrics. Default ${DEFAULT_SAMPLE_HEIGHT}.
  --diff-amplification <n>    Delta artifact amplification. Default ${DEFAULT_DIFF_AMPLIFICATION}.
  --max-mean-rgb-delta <n>    Mark cases above this mean RGB delta as failed.
  --output <path>             JSON output path. Default packages/website/reports/material-parity-sweep.json.
  --visual-output <dir>       Directory for PNG artifacts.
  --include-warnings          Include console.warn messages in the report.
  --no-fail-on-errors         Always exit 0 after writing the report.
  -h, --help                  Print this message.`);
}

function createReport(args, baseUrl, cases) {
  return {
    generatedAt: new Date().toISOString(),
    baseUrl,
    pageUrl: `${baseUrl}/examples/${EXAMPLE_ID}/index.html`,
    options: {
      chromePath: args.chromePath,
      headless: args.headless,
      timeoutMs: args.timeoutMs,
      settleMs: args.settleMs,
      viewport: {width: args.viewportWidth, height: args.viewportHeight},
      sampleWidth: args.sampleWidth,
      sampleHeight: args.sampleHeight,
      diffAmplification: args.diffAmplification,
      maxMeanRGBDelta: args.maxMeanRGBDelta,
      visualOutputDir: args.visualOutputDir,
      caseFilters: args.caseFilters
    },
    summary: null,
    plannedCases: cases.map((item) => item.id),
    errors: [],
    ignoredErrors: [],
    warnings: [],
    requests: [],
    cases: [],
    rankedCases: []
  };
}

function formatLocation(location) {
  if (!location || !location.url) return "";
  const line = location.lineNumber ? `:${location.lineNumber}` : "";
  const column = location.columnNumber ? `:${location.columnNumber}` : "";
  return `${location.url}${line}${column}`;
}

function shouldIgnoreResource(url) {
  try {
    return new URL(url).pathname === "/favicon.ico";
  } catch (error) {
    return false;
  }
}

function getIgnoredBrowserErrorRule(text, context = {}) {
  const value = String(text || "");
  return IGNORED_BROWSER_ERROR_RULES.find((rule) => {
    if (!value.includes(rule.match)) {
      return false;
    }
    if (rule.headlessOnly && context.headless === false) {
      return false;
    }
    return true;
  }) || null;
}

function pushBrowserIssue(report, type, text, extra = {}, context = {}) {
  const rule = getIgnoredBrowserErrorRule(text, context);
  const item = {
    type,
    text: String(text || ""),
    caseId: context.caseId || "",
    ...extra
  };
  if (rule) {
    report.ignoredErrors.push({
      ...item,
      ignored: true,
      ignoreRuleId: rule.id,
      note: rule.note
    });
    return;
  }
  report.errors.push(item);
}

function attachBrowserCollectors(page, report, args, getCaseId) {
  const pending = [];

  const onConsole = (msg) => {
    pending.push((async () => {
      const type = msg.type();
      const location = formatLocation(msg.location());
      if (location && shouldIgnoreResource(location)) return;
      const text = await serializeConsoleMessage(msg);
      const caseId = getCaseId();
      if (type === "error") {
        pushBrowserIssue(report, "console.error", text, {location}, {headless: args.headless, caseId});
      } else if (args.includeWarnings && (type === "warning" || type === "warn")) {
        report.warnings.push({type: "console.warn", text, location, caseId});
      }
    })());
  };
  const onPageError = (error) => {
    pushBrowserIssue(report, "pageerror", error.stack || error.message || String(error), {}, {headless: args.headless, caseId: getCaseId()});
  };
  const onRequestFailed = (request) => {
    if (shouldIgnoreResource(request.url())) return;
    const failure = request.failure();
    const item = {
      type: "requestfailed",
      caseId: getCaseId(),
      method: request.method(),
      url: request.url(),
      errorText: failure ? failure.errorText : "unknown"
    };
    report.requests.push(item);
    pushBrowserIssue(report, "requestfailed", `${item.method} ${item.url}: ${item.errorText}`, {
      url: item.url,
      method: item.method
    }, {headless: args.headless, caseId: item.caseId});
  };
  const onResponse = (response) => {
    const status = response.status();
    if (status < 400) return;
    if (shouldIgnoreResource(response.url())) return;
    const request = response.request();
    const item = {
      type: "http",
      caseId: getCaseId(),
      method: request.method(),
      url: response.url(),
      status,
      statusText: response.statusText()
    };
    report.requests.push(item);
    pushBrowserIssue(report, "http", `${item.method} ${item.url}: ${status} ${item.statusText}`, {
      url: item.url,
      method: item.method,
      status
    }, {headless: args.headless, caseId: item.caseId});
  };

  page.on("console", onConsole);
  page.on("pageerror", onPageError);
  page.on("requestfailed", onRequestFailed);
  page.on("response", onResponse);

  return {
    async flush() {
      const items = pending.splice(0);
      await Promise.allSettled(items);
    },
    detach() {
      page.off("console", onConsole);
      page.off("pageerror", onPageError);
      page.off("requestfailed", onRequestFailed);
      page.off("response", onResponse);
    }
  };
}

async function serializeConsoleMessage(msg) {
  const args = msg.args();
  if (args.length === 0) {
    return msg.text();
  }
  const parts = [];
  for (const arg of args) {
    try {
      parts.push(await arg.evaluate((value) => {
        if (value instanceof Error) {
          return value.stack || value.message || String(value);
        }
        if (typeof value === "string") {
          return value;
        }
        if (value === null || value === undefined) {
          return String(value);
        }
        if (typeof value === "object") {
          try {
            return JSON.stringify(value);
          } catch (error) {
            return Object.prototype.toString.call(value);
          }
        }
        return String(value);
      }));
    } catch (error) {
      parts.push(arg.toString());
    }
  }
  return parts.join(" ");
}

async function runSweepCase(page, sweepCase, args, report, initialNavigationCount) {
  const started = Date.now();
  const caseReport = {
    id: sweepCase.id,
    label: sweepCase.label,
    mode: sweepCase.mode,
    features: sweepCase.features,
    startedAt: new Date(started).toISOString(),
    completedAt: null,
    durationMs: 0,
    ok: false,
    errors: [],
    ignoredErrors: [],
    warnings: [],
    auditErrors: [],
    visualAudits: [],
    comparison: null
  };

  try {
    await page.evaluate((config) => {
      window.__materialParitySweepMarker = "hot";
      return window.webglWebgpuMaterialParityDemo.reconfigure(config);
    }, {
      mode: sweepCase.mode,
      features: sweepCase.features
    });
    await waitForHotReconfigure(page, sweepCase, args.timeoutMs);
    await applyCameraForCase(page, sweepCase.camera || DEFAULT_CAMERA);
    await waitForFrames(page, 3);
    if (args.settleMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, args.settleMs));
    }
    const state = await page.evaluate((expected) => {
      const demo = window.webglWebgpuMaterialParityDemo;
      const featuresMatch = Object.keys(expected.features).every((key) => demo.features[key] === expected.features[key]);
      return {
        marker: window.__materialParitySweepMarker,
        url: window.location.href,
        mode: demo.mode,
        features: demo.features,
        featuresMatch,
        objectCount: Object.keys(demo.scene.objects).length,
        camera: {
          eye: Array.from(demo.webglView.camera.eye),
          look: Array.from(demo.webglView.camera.look),
          up: Array.from(demo.webglView.camera.up)
        },
        navigationCount: performance.getEntriesByType("navigation").length
      };
    }, sweepCase);
    caseReport.state = state;
    if (state.marker !== "hot") {
      caseReport.auditErrors.push({type: "hot-reconfigure", text: "Page marker was lost; this state probably navigated instead of hot-reconfiguring."});
    }
    if (state.navigationCount !== initialNavigationCount) {
      caseReport.auditErrors.push({type: "hot-reconfigure", text: `Navigation count changed from ${initialNavigationCount} to ${state.navigationCount}.`});
    }
    if (state.mode !== sweepCase.mode) {
      caseReport.auditErrors.push({type: "hot-reconfigure", text: `Expected mode '${sweepCase.mode}', got '${state.mode}'.`});
    }
    if (!state.featuresMatch) {
      caseReport.auditErrors.push({type: "hot-reconfigure", text: "Runtime features did not match the requested feature mask."});
    }

    const capture = await captureComparison(page, sweepCase, args);
    caseReport.visualAudits = capture.visualAudits;
    caseReport.comparison = capture.comparison;
    if (args.maxMeanRGBDelta !== null && capture.comparison.meanRGBDelta > args.maxMeanRGBDelta) {
      caseReport.auditErrors.push({
        type: "visual",
        text: `Mean RGB delta ${capture.comparison.meanRGBDelta.toFixed(1)} exceeds ${args.maxMeanRGBDelta}.`
      });
    }
  } catch (error) {
    caseReport.auditErrors.push({type: "audit", text: error.stack || error.message || String(error)});
  }

  caseReport.completedAt = new Date().toISOString();
  caseReport.durationMs = Date.now() - started;
  caseReport.errors = report.errors.filter((error) => error.caseId === sweepCase.id);
  caseReport.ignoredErrors = report.ignoredErrors.filter((error) => error.caseId === sweepCase.id);
  caseReport.warnings = report.warnings.filter((warning) => warning.caseId === sweepCase.id);
  caseReport.ok = caseReport.errors.length === 0 && caseReport.auditErrors.length === 0;
  return caseReport;
}

async function applyCameraForCase(page, camera) {
  await page.evaluate((camera) => {
    const demo = window.webglWebgpuMaterialParityDemo;
    for (const view of [demo?.webglView, demo?.webgpuView]) {
      if (!view?.camera) {
        continue;
      }
      view.camera.eye = camera.eye;
      view.camera.look = camera.look;
      view.camera.up = camera.up;
      view.needsRender();
    }
  }, camera);
}

async function waitForHotReconfigure(page, sweepCase, timeoutMs) {
  await page.waitForFunction((expected) => {
    const demo = window.webglWebgpuMaterialParityDemo;
    if (!demo || !demo.features || demo.mode !== expected.mode) {
      return false;
    }
    if (document.body.classList.contains("is-reconfiguring")) {
      return false;
    }
    return Object.keys(expected.features).every((key) => demo.features[key] === expected.features[key]);
  }, {timeout: timeoutMs}, sweepCase);
}

async function waitForFrames(page, count) {
  await page.evaluate((count) => new Promise((resolve) => {
    let remaining = Math.max(1, count | 0);
    const next = () => {
      remaining--;
      if (remaining <= 0) {
        resolve();
      } else {
        requestAnimationFrame(next);
      }
    };
    requestAnimationFrame(next);
  }), count);
}

async function captureComparison(page, sweepCase, args) {
  fs.mkdirSync(args.visualOutputDir, {recursive: true});
  const webgl = await captureViewport(page, "#webglViewport", `${sweepCase.id}-webgl.png`, args);
  const webgpu = await captureViewport(page, "#webgpuViewport", `${sweepCase.id}-webgpu.png`, args);
  const comparison = {
    a: "#webglViewport",
    b: "#webgpuViewport",
    ...await compareScreenshotsInPage(page, webgl.base64, webgpu.base64, args.sampleWidth, args.sampleHeight)
  };
  const artifactBase64 = await createComparisonArtifactsInPage(page, webgl.base64, webgpu.base64, args.diffAmplification);
  const sideBySideArtifactPath = path.join(args.visualOutputDir, `${sweepCase.id}-side-by-side.png`);
  const deltaArtifactPath = path.join(args.visualOutputDir, `${sweepCase.id}-delta.png`);
  fs.writeFileSync(sideBySideArtifactPath, Buffer.from(artifactBase64.sideBySide, "base64"));
  fs.writeFileSync(deltaArtifactPath, Buffer.from(artifactBase64.delta, "base64"));
  comparison.sideBySideArtifactPath = sideBySideArtifactPath;
  comparison.deltaArtifactPath = deltaArtifactPath;
  comparison.artifactWidth = artifactBase64.width;
  comparison.artifactHeight = artifactBase64.height;
  comparison.diffAmplification = artifactBase64.diffAmplification;
  delete webgl.base64;
  delete webgpu.base64;
  return {
    visualAudits: [webgl, webgpu],
    comparison
  };
}

async function captureViewport(page, selector, fileName, args) {
  const element = await page.$(selector);
  if (!element) {
    throw new Error(`Visual target not found: ${selector}`);
  }
  const box = await element.boundingBox();
  if (!box || box.width < 1 || box.height < 1) {
    throw new Error(`Visual target has no measurable area: ${selector}`);
  }
  const clip = {
    x: Math.max(0, Math.floor(box.x)),
    y: Math.max(0, Math.floor(box.y)),
    width: Math.max(1, Math.floor(box.width)),
    height: Math.max(1, Math.floor(box.height))
  };
  const base64 = await screenshotWithHiddenSelectors(page, clip, MASK_SELECTORS);
  const artifactPath = path.join(args.visualOutputDir, fileName);
  fs.writeFileSync(artifactPath, Buffer.from(base64, "base64"));
  const stats = await analyzeScreenshotInPage(page, base64, args.sampleWidth, args.sampleHeight);
  return {
    selector,
    rect: clip,
    artifactPath,
    captureSource: "screenshot-masked",
    ...stats,
    base64
  };
}

async function screenshotWithHiddenSelectors(page, clip, maskSelectors) {
  await page.evaluate((selectors) => {
    const now = `${Date.now()}-${Math.round(Math.random() * 1000000)}`;
    let next = 0;
    for (const selector of selectors) {
      for (const element of document.querySelectorAll(selector)) {
        const token = `visual-audit-mask-${now}-${next++}`;
        element.setAttribute("data-visual-audit-mask-token", token);
        element.setAttribute("data-visual-audit-mask-visibility", element.style.visibility || "");
        element.style.visibility = "hidden";
      }
    }
  }, maskSelectors);
  try {
    return await page.screenshot({encoding: "base64", clip});
  } finally {
    await page.evaluate(() => {
      for (const element of document.querySelectorAll("[data-visual-audit-mask-token]")) {
        const visibility = element.getAttribute("data-visual-audit-mask-visibility") || "";
        element.style.visibility = visibility;
        element.removeAttribute("data-visual-audit-mask-token");
        element.removeAttribute("data-visual-audit-mask-visibility");
      }
    });
  }
}

async function analyzeScreenshotInPage(page, base64, sampleWidth, sampleHeight) {
  return page.evaluate(({base64, sampleWidth, sampleHeight}) => new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = sampleWidth;
      canvas.height = sampleHeight;
      const ctx = canvas.getContext("2d", {willReadFrequently: true});
      ctx.drawImage(image, 0, 0, sampleWidth, sampleHeight);
      const data = ctx.getImageData(0, 0, sampleWidth, sampleHeight).data;
      const buckets = new Map();
      let sumLuma = 0;
      let minLuma = 255;
      let maxLuma = 0;
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        const bucket = `${r >> 4},${g >> 4},${b >> 4}`;
        buckets.set(bucket, (buckets.get(bucket) || 0) + 1);
        sumLuma += luma;
        minLuma = Math.min(minLuma, luma);
        maxLuma = Math.max(maxLuma, luma);
      }
      const total = data.length / 4;
      let dominantCount = 0;
      for (const count of buckets.values()) {
        dominantCount = Math.max(dominantCount, count);
      }
      resolve({
        meanLuma: sumLuma / total,
        minLuma,
        maxLuma,
        lumaRange: maxLuma - minLuma,
        uniqueBuckets: buckets.size,
        dominantRatio: dominantCount / total,
        nonDominantRatio: 1 - dominantCount / total
      });
    };
    image.onerror = () => reject(new Error("Unable to decode visual audit screenshot"));
    image.src = `data:image/png;base64,${base64}`;
  }), {base64, sampleWidth, sampleHeight});
}

async function compareScreenshotsInPage(page, aBase64, bBase64, sampleWidth, sampleHeight) {
  return page.evaluate(({aBase64, bBase64, sampleWidth, sampleHeight}) => new Promise((resolve, reject) => {
    const loadImage = (base64) => new Promise((imageResolve, imageReject) => {
      const image = new Image();
      image.onload = () => imageResolve(image);
      image.onerror = () => imageReject(new Error("Unable to decode visual comparison screenshot"));
      image.src = `data:image/png;base64,${base64}`;
    });
    Promise.all([loadImage(aBase64), loadImage(bBase64)]).then(([aImage, bImage]) => {
      const canvas = document.createElement("canvas");
      canvas.width = sampleWidth;
      canvas.height = sampleHeight;
      const ctx = canvas.getContext("2d", {willReadFrequently: true});
      ctx.drawImage(aImage, 0, 0, sampleWidth, sampleHeight);
      const a = ctx.getImageData(0, 0, sampleWidth, sampleHeight).data;
      ctx.clearRect(0, 0, sampleWidth, sampleHeight);
      ctx.drawImage(bImage, 0, 0, sampleWidth, sampleHeight);
      const b = ctx.getImageData(0, 0, sampleWidth, sampleHeight).data;
      let rgbDelta = 0;
      let lumaDelta = 0;
      let lumaDeltaSq = 0;
      let maxLumaDelta = 0;
      const total = a.length / 4;
      for (let i = 0; i < a.length; i += 4) {
        const dr = Math.abs(a[i] - b[i]);
        const dg = Math.abs(a[i + 1] - b[i + 1]);
        const db = Math.abs(a[i + 2] - b[i + 2]);
        const lumaA = 0.2126 * a[i] + 0.7152 * a[i + 1] + 0.0722 * a[i + 2];
        const lumaB = 0.2126 * b[i] + 0.7152 * b[i + 1] + 0.0722 * b[i + 2];
        const dl = Math.abs(lumaA - lumaB);
        rgbDelta += (dr + dg + db) / 3;
        lumaDelta += dl;
        lumaDeltaSq += dl * dl;
        maxLumaDelta = Math.max(maxLumaDelta, dl);
      }
      resolve({
        meanRGBDelta: rgbDelta / total,
        meanLumaDelta: lumaDelta / total,
        rmsLumaDelta: Math.sqrt(lumaDeltaSq / total),
        maxLumaDelta
      });
    }).catch(reject);
  }), {aBase64, bBase64, sampleWidth, sampleHeight});
}

async function createComparisonArtifactsInPage(page, aBase64, bBase64, diffAmplification) {
  return page.evaluate(({aBase64, bBase64, diffAmplification}) => new Promise((resolve, reject) => {
    const loadImage = (base64) => new Promise((imageResolve, imageReject) => {
      const image = new Image();
      image.onload = () => imageResolve(image);
      image.onerror = () => imageReject(new Error("Unable to decode visual comparison artifact screenshot"));
      image.src = `data:image/png;base64,${base64}`;
    });
    Promise.all([loadImage(aBase64), loadImage(bBase64)]).then(([aImage, bImage]) => {
      const width = Math.max(1, Math.min(aImage.naturalWidth || aImage.width, bImage.naturalWidth || bImage.width));
      const height = Math.max(1, Math.min(aImage.naturalHeight || aImage.height, bImage.naturalHeight || bImage.height));
      const gap = 8;
      const sideBySide = document.createElement("canvas");
      sideBySide.width = width * 2 + gap;
      sideBySide.height = height;
      const sideCtx = sideBySide.getContext("2d", {willReadFrequently: false});
      sideCtx.fillStyle = "#111827";
      sideCtx.fillRect(0, 0, sideBySide.width, sideBySide.height);
      sideCtx.drawImage(aImage, 0, 0, width, height);
      sideCtx.drawImage(bImage, width + gap, 0, width, height);

      const sample = document.createElement("canvas");
      sample.width = width;
      sample.height = height;
      const sampleCtx = sample.getContext("2d", {willReadFrequently: true});
      sampleCtx.drawImage(aImage, 0, 0, width, height);
      const a = sampleCtx.getImageData(0, 0, width, height);
      sampleCtx.clearRect(0, 0, width, height);
      sampleCtx.drawImage(bImage, 0, 0, width, height);
      const b = sampleCtx.getImageData(0, 0, width, height);
      const delta = sampleCtx.createImageData(width, height);
      const scale = Math.max(1, Number(diffAmplification) || DEFAULT_DIFF_AMPLIFICATION);
      for (let i = 0; i < a.data.length; i += 4) {
        const dr = Math.abs(a.data[i] - b.data[i]);
        const dg = Math.abs(a.data[i + 1] - b.data[i + 1]);
        const db = Math.abs(a.data[i + 2] - b.data[i + 2]);
        const lumaA = 0.2126 * a.data[i] + 0.7152 * a.data[i + 1] + 0.0722 * a.data[i + 2];
        const lumaB = 0.2126 * b.data[i] + 0.7152 * b.data[i + 1] + 0.0722 * b.data[i + 2];
        const magnitude = Math.min(255, ((dr + dg + db) / 3) * scale);
        if (lumaB >= lumaA) {
          delta.data[i] = magnitude;
          delta.data[i + 1] = magnitude * 0.28;
          delta.data[i + 2] = 0;
        } else {
          delta.data[i] = 0;
          delta.data[i + 1] = magnitude * 0.38;
          delta.data[i + 2] = magnitude;
        }
        delta.data[i + 3] = 255;
      }
      sampleCtx.putImageData(delta, 0, 0);
      resolve({
        sideBySide: sideBySide.toDataURL("image/png").replace(/^data:image\/png;base64,/, ""),
        delta: sample.toDataURL("image/png").replace(/^data:image\/png;base64,/, ""),
        width,
        height,
        diffAmplification: scale
      });
    }).catch(reject);
  }), {aBase64, bBase64, diffAmplification});
}

function enabledFeatures(features) {
  return MATERIAL_FEATURES.filter((feature) => features[feature]);
}

function formatFeatureMask(features) {
  const enabled = enabledFeatures(features);
  if (enabled.length === MATERIAL_FEATURES.length) return "all";
  if (enabled.length === 0) return "none";
  return enabled.join(", ");
}

function buildRankedCases(cases) {
  return cases
    .map((item) => ({
      id: item.id,
      label: item.label,
      mode: item.mode,
      features: item.features,
      ok: item.ok,
      meanRGBDelta: item.comparison ? item.comparison.meanRGBDelta : null,
      meanLumaDelta: item.comparison ? item.comparison.meanLumaDelta : null,
      rmsLumaDelta: item.comparison ? item.comparison.rmsLumaDelta : null,
      maxLumaDelta: item.comparison ? item.comparison.maxLumaDelta : null,
      sideBySideArtifactPath: item.comparison ? item.comparison.sideBySideArtifactPath : "",
      deltaArtifactPath: item.comparison ? item.comparison.deltaArtifactPath : ""
    }))
    .sort((a, b) => (b.meanRGBDelta ?? -1) - (a.meanRGBDelta ?? -1));
}

function summarizeReport(report, startedAt) {
  report.rankedCases = buildRankedCases(report.cases);
  const worst = report.rankedCases[0] || null;
  report.summary = {
    totalCases: report.cases.length,
    passedCases: report.cases.filter((item) => item.ok).length,
    failedCases: report.cases.filter((item) => !item.ok).length,
    browserErrors: report.errors.length,
    ignoredBrowserErrors: report.ignoredErrors.length,
    warnings: report.warnings.length,
    requests: report.requests.length,
    worstCaseId: worst ? worst.id : "",
    maxMeanRGBDelta: worst ? worst.meanRGBDelta : null,
    durationMs: Date.now() - startedAt
  };
}

function buildMarkdownReport(report) {
  const lines = [];
  lines.push("# Material Parity Sweep");
  lines.push("");
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push(`Page: ${report.pageUrl}`);
  lines.push(`Chrome: ${report.options.chromePath || "Puppeteer default"}`);
  lines.push(`Mode: ${report.options.headless ? "headless" : "headful"}`);
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push(`- Cases: ${report.summary.passedCases}/${report.summary.totalCases} passed`);
  lines.push(`- Browser errors: ${report.summary.browserErrors}`);
  lines.push(`- Ignored browser errors: ${report.summary.ignoredBrowserErrors}`);
  lines.push(`- Warnings: ${report.summary.warnings}`);
  lines.push(`- Worst visual delta: ${report.summary.worstCaseId || "n/a"} (${formatNumber(report.summary.maxMeanRGBDelta)})`);
  lines.push(`- Duration: ${Math.round(report.summary.durationMs / 1000)}s`);
  lines.push("");

  if (report.errors.length > 0) {
    lines.push("## Browser Errors");
    lines.push("");
    for (const error of report.errors) {
      const caseId = error.caseId ? ` [${error.caseId}]` : "";
      const location = error.location ? ` (${error.location})` : "";
      lines.push(`- ${error.type}${caseId}${location}: ${error.text}`);
    }
    lines.push("");
  }

  if (report.ignoredErrors.length > 0) {
    lines.push("## Ignored Browser Errors");
    lines.push("");
    for (const error of report.ignoredErrors) {
      const caseId = error.caseId ? ` [${error.caseId}]` : "";
      const location = error.location ? ` (${error.location})` : "";
      lines.push(`- ${error.type}${caseId}${location}: ${error.text}`);
      if (error.note) {
        lines.push(`  Note: ${error.note}`);
      }
    }
    lines.push("");
  }

  const failedCases = report.cases.filter((item) => !item.ok);
  if (failedCases.length > 0) {
    lines.push("## Failed Cases");
    lines.push("");
    for (const item of failedCases) {
      lines.push(`### ${item.id}`);
      lines.push(`Mode: ${item.mode}`);
      lines.push(`Features: ${formatFeatureMask(item.features)}`);
      for (const error of item.errors) {
        const location = error.location ? ` (${error.location})` : "";
        lines.push(`- ${error.type}${location}: ${error.text}`);
      }
      for (const error of item.auditErrors) {
        lines.push(`- ${error.type}: ${error.text}`);
      }
      lines.push("");
    }
  }

  lines.push("## Ranked Visual Deltas");
  lines.push("");
  for (const item of report.rankedCases) {
    const status = item.ok ? "ok" : "failed";
    const artifacts = item.sideBySideArtifactPath
      ? `, sideBySide=${item.sideBySideArtifactPath}, delta=${item.deltaArtifactPath}`
      : "";
    lines.push(`- ${item.id} (${status}): mode=${item.mode}, features=${formatFeatureMask(item.features)}, meanRGB=${formatNumber(item.meanRGBDelta)}, meanLuma=${formatNumber(item.meanLumaDelta)}, rmsLuma=${formatNumber(item.rmsLumaDelta)}, maxLuma=${formatNumber(item.maxLumaDelta)}${artifacts}`);
  }
  lines.push("");

  lines.push("## Case Details");
  lines.push("");
  for (const item of report.cases) {
    lines.push(`### ${item.id}`);
    lines.push(`Label: ${item.label}`);
    lines.push(`Mode: ${item.mode}`);
    lines.push(`Features: ${formatFeatureMask(item.features)}`);
    lines.push(`Duration: ${item.durationMs}ms`);
    if (item.state) {
      lines.push(`Objects: ${item.state.objectCount}`);
      if (item.state.camera) {
        lines.push(`Camera: eye=${formatVec(item.state.camera.eye)}, look=${formatVec(item.state.camera.look)}, up=${formatVec(item.state.camera.up)}`);
      }
      lines.push(`URL: ${item.state.url}`);
    }
    if (item.visualAudits.length > 0) {
      for (const visual of item.visualAudits) {
        lines.push(`- ${visual.selector}: unique=${visual.uniqueBuckets}, nonDominant=${(visual.nonDominantRatio * 100).toFixed(1)}%, lumaRange=${formatNumber(visual.lumaRange)}, artifact=${visual.artifactPath}`);
      }
    }
    if (item.comparison) {
      lines.push(`- comparison: meanRGB=${formatNumber(item.comparison.meanRGBDelta)}, meanLuma=${formatNumber(item.comparison.meanLumaDelta)}, rmsLuma=${formatNumber(item.comparison.rmsLumaDelta)}, maxLuma=${formatNumber(item.comparison.maxLumaDelta)}`);
    }
    lines.push("");
  }

  return `${lines.join("\n")}\n`;
}

function formatNumber(value) {
  return typeof value === "number" && Number.isFinite(value) ? value.toFixed(2) : "n/a";
}

function formatVec(value) {
  return Array.isArray(value) ? value.map(formatNumber).join(",") : "n/a";
}

function writeReports(report, outputPath) {
  fs.mkdirSync(path.dirname(outputPath), {recursive: true});
  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2), "utf8");
  const markdownPath = outputPath.replace(/\.json$/i, ".md");
  fs.writeFileSync(markdownPath, buildMarkdownReport(report), "utf8");
  return {jsonPath: outputPath, markdownPath};
}

async function startServer(port) {
  const server = httpServer.createServer({root: websiteRoot});
  await new Promise((resolve, reject) => {
    server.server.once("error", reject);
    server.listen(port, "127.0.0.1", () => {
      server.server.off("error", reject);
      resolve();
    });
  });
  return {
    server,
    baseUrl: `http://127.0.0.1:${port}`
  };
}

function filterCases(cases, filters) {
  if (filters.length === 0) {
    return cases;
  }
  return cases.filter((item) => filters.some((filter) => matchesCaseFilter(item.id, filter)));
}

function matchesCaseFilter(id, filter) {
  if (!filter.includes("*")) {
    return id === filter || id.includes(filter);
  }
  const pattern = filter
    .split("*")
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  return new RegExp(`^${pattern}$`).test(id);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const cases = filterCases(makeSweepCases(), args.caseFilters);
  if (cases.length === 0) {
    console.log("No material parity sweep cases matched.");
    return;
  }

  fs.mkdirSync(args.visualOutputDir, {recursive: true});
  const started = Date.now();
  const {server, baseUrl} = await startServer(args.port);
  const report = createReport(args, baseUrl, cases);
  let browser = null;
  let activeCaseId = "initial-load";

  console.log(`Sweeping ${cases.length} material parity case(s) at ${report.pageUrl}.`);
  console.log(`Using Chrome: ${args.chromePath || "Puppeteer default"} (${args.headless ? "headless" : "headful"})`);

  try {
    browser = await puppeteer.launch({
      headless: args.headless ? "new" : false,
      executablePath: args.chromePath || undefined,
      protocolTimeout: args.timeoutMs + 30000,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--enable-unsafe-swiftshader",
        "--enable-features=Vulkan,UseSkiaRenderer",
        "--enable-unsafe-webgpu",
        "--ignore-gpu-blocklist"
      ]
    });
    const page = await browser.newPage();
    const collectors = attachBrowserCollectors(page, report, args, () => activeCaseId);
    await page.setViewport({width: args.viewportWidth, height: args.viewportHeight});
    await page.goto(report.pageUrl, {waitUntil: "domcontentloaded", timeout: args.timeoutMs});
    await page.waitForFunction(() => {
      const demo = window.webglWebgpuMaterialParityDemo;
      return !!(demo && demo.reconfigure && demo.webglRenderer && demo.webgpuRenderer);
    }, {timeout: args.timeoutMs});
    await waitForFrames(page, 4);
    await collectors.flush();
    const initialNavigationCount = await page.evaluate(() => performance.getEntriesByType("navigation").length);

    for (const sweepCase of cases) {
      activeCaseId = sweepCase.id;
      const caseReport = await runSweepCase(page, sweepCase, args, report, initialNavigationCount);
      await collectors.flush();
      caseReport.errors = report.errors.filter((error) => error.caseId === sweepCase.id);
      caseReport.ignoredErrors = report.ignoredErrors.filter((error) => error.caseId === sweepCase.id);
      caseReport.warnings = report.warnings.filter((warning) => warning.caseId === sweepCase.id);
      caseReport.ok = caseReport.errors.length === 0 && caseReport.auditErrors.length === 0;
      report.cases.push(caseReport);
      const comparison = caseReport.comparison;
      const metric = comparison ? `meanRGB=${comparison.meanRGBDelta.toFixed(2)}` : "no comparison";
      console.log(`  ${caseReport.ok ? "ok" : "ERR"} ${sweepCase.id} (${metric})`);
    }

    activeCaseId = "shutdown";
    collectors.detach();
    await page.close();
  } catch (error) {
    report.errors.push({
      type: "sweep",
      text: error.stack || error.message || String(error),
      caseId: activeCaseId
    });
  } finally {
    if (browser) await browser.close();
    server.close();
  }

  summarizeReport(report, started);
  const paths = writeReports(report, args.output);
  console.log(`Wrote ${paths.jsonPath}`);
  console.log(`Wrote ${paths.markdownPath}`);
  console.log(`Summary: ${report.summary.passedCases}/${report.summary.totalCases} passed, ${report.summary.browserErrors} browser errors, ${report.summary.ignoredBrowserErrors} ignored browser errors, worst=${report.summary.worstCaseId || "n/a"} meanRGB=${formatNumber(report.summary.maxMeanRGBDelta)}.`);

  if (args.failOnErrors && (report.summary.browserErrors > 0 || report.summary.failedCases > 0)) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error.stack || error.message || String(error));
  process.exit(1);
});
