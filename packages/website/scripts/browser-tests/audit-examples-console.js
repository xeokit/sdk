#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const httpServer = require("http-server");
const puppeteer = require("puppeteer");

const websiteRoot = path.resolve(__dirname, "..", "..");
const examplesDir = path.join(websiteRoot, "examples");
const defaultReportsDir = path.join(websiteRoot, "reports");

const DEFAULT_PORT = 3010;
const DEFAULT_TIMEOUT_MS = 120000;
const DEFAULT_SETTLE_MS = 1000;
const DEFAULT_WORKERS = 4;
const VIEWPORT = {width: 1280, height: 720};
const IGNORED_BROWSER_ERROR_RULES = [
  {
    id: "system-chrome-headless-webgpu-device-lost",
    match: "[WebGPURenderer] [WebGPURenderer.deviceLost] WebGPU device was lost. A valid external Instance reference no longer exists.",
    headlessOnly: true,
    note: "Known system Chrome headless WebGPU environment failure. Do not chase this as an SDK/example regression unless it reproduces outside the audit harness."
  }
];

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
    filter: null,
    chromePath: getDefaultChromePath(),
    query: "",
    headless: true,
    includeWarnings: false,
    visualAudit: false,
    visualOutputDir: null,
    failOnErrors: true,
    waitForExampleLoaded: true,
    workers: DEFAULT_WORKERS,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    settleMs: DEFAULT_SETTLE_MS,
    port: Number(process.env.PORT || DEFAULT_PORT),
    output: path.join(defaultReportsDir, "example-console-audit.json")
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--") {
      continue;
    } else if (arg === "--filter" || arg === "-f") {
      args.filter = argv[++i] || null;
    } else if (arg === "--workers" || arg === "-w") {
      args.workers = parsePositiveInteger(argv[++i], "--workers");
    } else if (arg === "--timeout" || arg === "--timeout-ms") {
      args.timeoutMs = parsePositiveInteger(argv[++i], "--timeout");
    } else if (arg === "--settle" || arg === "--settle-ms") {
      args.settleMs = parseNonNegativeInteger(argv[++i], "--settle");
    } else if (arg === "--port" || arg === "-p") {
      args.port = parsePositiveInteger(argv[++i], "--port");
    } else if (arg === "--chrome" || arg === "--chrome-path") {
      args.chromePath = argv[++i] || null;
    } else if (arg === "--query" || arg === "--query-string") {
      args.query = normalizeQuery(argv[++i] || "");
    } else if (arg === "--headful" || arg === "--no-headless") {
      args.headless = false;
    } else if (arg === "--output" || arg === "-o") {
      args.output = path.resolve(argv[++i] || args.output);
    } else if (arg === "--include-warnings") {
      args.includeWarnings = true;
    } else if (arg === "--visual-audit") {
      args.visualAudit = true;
    } else if (arg === "--visual-output" || arg === "--visual-output-dir") {
      args.visualOutputDir = path.resolve(argv[++i] || "");
    } else if (arg === "--no-fail-on-errors") {
      args.failOnErrors = false;
    } else if (arg === "--no-wait-for-example-loaded") {
      args.waitForExampleLoaded = false;
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else if (!args.filter) {
      args.filter = arg;
    } else {
      console.error(`Unknown argument: ${arg}`);
      process.exit(2);
    }
  }

  return args;
}

function normalizeQuery(raw) {
  if (!raw) return "";
  return raw.startsWith("?") ? raw.slice(1) : raw;
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

function printHelp() {
  console.log(`Usage: node audit-examples-console.js [options] [filter]

Runs each website example in headless Chromium and writes JSON + Markdown
reports containing page errors, console errors, failed requests, and HTTP
responses with status >= 400.

Options:
  --filter <pat>              Process only example ids matching <pat>. '*' is a wildcard.
  --workers <n>               Number of parallel pages (default ${DEFAULT_WORKERS}).
  --timeout <ms>              Per-example navigation/readiness timeout (default ${DEFAULT_TIMEOUT_MS}).
  --settle <ms>               Extra time after readiness to catch async errors (default ${DEFAULT_SETTLE_MS}).
  --port <n>                  Local static server port (default ${DEFAULT_PORT}, or PORT env).
  --chrome <path>             Chrome executable path (default CHROME_BIN, PUPPETEER_EXECUTABLE_PATH, or system Chrome).
  --query <query>             Query string appended to every example URL, eg renderer=webgl.
  --headful                   Run Chrome visibly instead of headless.
  --output <path>             JSON output path (default packages/website/reports/example-console-audit.json).
  --include-warnings          Include console.warn messages in the report.
  --visual-audit              Capture configured canvases/elements and flag blank or nearly flat renders.
  --visual-output <dir>       Directory for visual audit PNG artifacts.
  --no-fail-on-errors         Always exit 0 after writing the report.
  --no-wait-for-example-loaded Do not wait for #ExampleLoaded.
  -h, --help                  Print this message.`);
}

function matchesFilter(id, filter) {
  if (!filter) return true;
  if (!filter.includes("*")) return id.includes(filter);
  const pattern = filter
    .split("*")
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  return new RegExp(`^${pattern}$`).test(id);
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    return null;
  }
}

function formatLocation(location) {
  if (!location || !location.url) return "";
  const line = location.lineNumber ? `:${location.lineNumber}` : "";
  const column = location.columnNumber ? `:${location.columnNumber}` : "";
  return `${location.url}${line}${column}`;
}

function pushIssue(issues, type, text, extra = {}) {
  issues.push({
    type,
    text: String(text || ""),
    ...extra
  });
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
  if (rule) {
    pushIssue(report.ignoredErrors, type, text, {
      ...extra,
      ignored: true,
      ignoreRuleId: rule.id,
      note: rule.note
    });
    return;
  }
  pushIssue(report.errors, type, text, extra);
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

function shouldIgnoreResource(url) {
  try {
    return new URL(url).pathname === "/favicon.ico";
  } catch (error) {
    return false;
  }
}

async function waitForReadiness(page, args, meta) {
  const timeoutMs = (typeof meta.auditTimeoutMs === "number" && Number.isFinite(meta.auditTimeoutMs))
    ? meta.auditTimeoutMs
    : args.timeoutMs;

  if (args.waitForExampleLoaded) {
    await page.waitForFunction(
      () => {
        if (!document.querySelector("#ExampleLoaded")) return false;

        const isVisible = (el) => {
          const style = window.getComputedStyle(el);
          if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) {
            return false;
          }
          const rect = el.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        };

        return ![
          ...document.querySelectorAll(".xeokit-loading-overlay, .xkt-lpd-dialog"),
        ].some(isVisible);
      },
      {timeout: timeoutMs},
    );
    await page.evaluate(() => new Promise((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(resolve));
    }));
  }

  if (args.settleMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, args.settleMs));
  }
}

function createExampleReport(job, url, startedAt) {
  return {
    id: job.id,
    title: job.meta.title || "",
    url,
    skipped: false,
    skipReason: "",
    startedAt,
    completedAt: null,
    durationMs: 0,
    ok: false,
    errors: [],
    ignoredErrors: [],
    auditErrors: [],
    warnings: [],
    requests: [],
    visualAudits: [],
    visualComparisons: []
  };
}

function createSkippedExampleReport(job, baseUrl, args) {
  const url = `${baseUrl}/examples/${job.id}/index.html${args.query ? `?${args.query}` : ""}`;
  const now = new Date().toISOString();
  return {
    ...createExampleReport(job, url, now),
    skipped: true,
    skipReason: job.meta.auditSkipReason,
    completedAt: now,
    ok: true
  };
}

async function auditExample(page, job, baseUrl, args) {
  const started = Date.now();
  const url = `${baseUrl}/examples/${job.id}/index.html${args.query ? `?${args.query}` : ""}`;
  const report = createExampleReport(job, url, new Date(started).toISOString());
  const timeoutMs = (typeof job.meta.auditTimeoutMs === "number" && Number.isFinite(job.meta.auditTimeoutMs))
    ? job.meta.auditTimeoutMs
    : args.timeoutMs;
  const pendingConsoleMessages = [];

  const onConsole = (msg) => {
    pendingConsoleMessages.push((async () => {
      const type = msg.type();
      const location = formatLocation(msg.location());
      if (location && shouldIgnoreResource(location)) return;
      const text = await serializeConsoleMessage(msg);
      if (type === "error") {
        pushBrowserIssue(report, "console.error", text, {
          location
        }, {headless: args.headless});
      } else if (args.includeWarnings && type === "warning") {
        pushIssue(report.warnings, "console.warn", text, {
          location
        });
      }
    })());
  };
  const onPageError = (error) => {
    pushBrowserIssue(report, "pageerror", error.stack || error.message || String(error), {}, {headless: args.headless});
  };
  const onRequestFailed = (request) => {
    if (shouldIgnoreResource(request.url())) return;
    const failure = request.failure();
    const item = {
      type: "requestfailed",
      method: request.method(),
      url: request.url(),
      errorText: failure ? failure.errorText : "unknown"
    };
    report.requests.push(item);
    pushBrowserIssue(report, "requestfailed", `${item.method} ${item.url}: ${item.errorText}`, {
      url: item.url,
      method: item.method
    }, {headless: args.headless});
  };
  const onResponse = (response) => {
    const status = response.status();
    if (status < 400) return;
    if (shouldIgnoreResource(response.url())) return;
    const request = response.request();
    const item = {
      type: "http",
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
    }, {headless: args.headless});
  };

  page.on("console", onConsole);
  page.on("pageerror", onPageError);
  page.on("requestfailed", onRequestFailed);
  page.on("response", onResponse);

  try {
    await page.goto(url, {waitUntil: "domcontentloaded", timeout: timeoutMs});
    await waitForReadiness(page, args, job.meta);
    if (args.visualAudit) {
      await captureVisualAudits(page, job, args, report);
    }
  } catch (error) {
    pushIssue(report.auditErrors, "audit", error.stack || error.message || String(error));
  } finally {
    page.off("console", onConsole);
    page.off("pageerror", onPageError);
    page.off("requestfailed", onRequestFailed);
    page.off("response", onResponse);
    await Promise.allSettled(pendingConsoleMessages);
  }

  report.completedAt = new Date().toISOString();
  report.durationMs = Date.now() - started;
  report.ok = report.errors.length === 0 && report.auditErrors.length === 0;
  return report;
}

async function captureVisualAudits(page, job, args, report) {
  const config = normalizeVisualAuditConfig(job.meta.visualAudit);
  if (!config.enabled) return;
  if (args.visualOutputDir) {
    fs.mkdirSync(args.visualOutputDir, {recursive: true});
  }
  const screenshotsBySelector = new Map();

  for (const selector of config.selectors) {
    const element = await page.$(selector);
    if (!element) {
      pushIssue(report.auditErrors, "visual", `Visual audit target not found: ${selector}`);
      continue;
    }
    const box = await element.boundingBox();
    if (!box || box.width < 1 || box.height < 1) {
      pushIssue(report.auditErrors, "visual", `Visual audit target has no measurable area: ${selector}`);
      continue;
    }

    const clip = {
      x: Math.max(0, Math.floor(box.x)),
      y: Math.max(0, Math.floor(box.y)),
      width: Math.max(1, Math.floor(box.width)),
      height: Math.max(1, Math.floor(box.height))
    };
    const capture = await captureVisualTarget(page, selector, clip, config);
    const base64 = capture.base64;
    screenshotsBySelector.set(selector, base64);
    const artifactPath = args.visualOutputDir
      ? path.join(args.visualOutputDir, `${sanitizeArtifactName(job.id)}-${sanitizeArtifactName(selector)}.png`)
      : "";
    if (artifactPath) {
      fs.writeFileSync(artifactPath, Buffer.from(base64, "base64"));
    }
    const stats = await analyzeScreenshotInPage(page, base64, config.sampleWidth, config.sampleHeight);
    const item = {selector, rect: clip, artifactPath, captureSource: capture.source, ...stats};
    const ignoreVisualFailure = shouldIgnoreVisualFailure(report, selector);
    if (ignoreVisualFailure) {
      item.ignored = true;
      item.note = ignoreVisualFailure;
    }
    report.visualAudits.push(item);

    if (item.uniqueBuckets < config.minUniqueBuckets) {
      if (!ignoreVisualFailure) {
        pushIssue(report.auditErrors, "visual", `${selector} appears visually flat: ${item.uniqueBuckets} color buckets`, item);
      }
    }
    if (item.nonDominantRatio < config.minNonBackgroundRatio) {
      if (!ignoreVisualFailure) {
        pushIssue(report.auditErrors, "visual", `${selector} appears blank or nearly blank: ${(item.nonDominantRatio * 100).toFixed(1)}% non-dominant pixels`, item);
      }
    }
  }

  for (const pair of config.comparePairs) {
    const a = report.visualAudits.find((item) => item.selector === pair.a);
    const b = report.visualAudits.find((item) => item.selector === pair.b);
    const aBase64 = screenshotsBySelector.get(pair.a);
    const bBase64 = screenshotsBySelector.get(pair.b);
    if (!a || !b || !aBase64 || !bBase64) {
      pushIssue(report.auditErrors, "visual", `Visual comparison target missing: ${pair.a} vs ${pair.b}`);
      continue;
    }
    const comparison = {
      a: pair.a,
      b: pair.b,
      ignored: !!(a.ignored || b.ignored),
      ...await compareScreenshotsInPage(page, aBase64, bBase64, config.sampleWidth, config.sampleHeight)
    };
    if (args.visualOutputDir) {
      const artifactBaseName = `${sanitizeArtifactName(job.id)}-${sanitizeArtifactName(pair.a)}-vs-${sanitizeArtifactName(pair.b)}`;
      const artifactBase64 = await createComparisonArtifactsInPage(page, aBase64, bBase64, config.diffAmplification);
      const sideBySideArtifactPath = path.join(args.visualOutputDir, `${artifactBaseName}-side-by-side.png`);
      const deltaArtifactPath = path.join(args.visualOutputDir, `${artifactBaseName}-delta.png`);
      fs.writeFileSync(sideBySideArtifactPath, Buffer.from(artifactBase64.sideBySide, "base64"));
      fs.writeFileSync(deltaArtifactPath, Buffer.from(artifactBase64.delta, "base64"));
      comparison.sideBySideArtifactPath = sideBySideArtifactPath;
      comparison.deltaArtifactPath = deltaArtifactPath;
      comparison.artifactWidth = artifactBase64.width;
      comparison.artifactHeight = artifactBase64.height;
      comparison.diffAmplification = artifactBase64.diffAmplification;
    }
    if (comparison.ignored) {
      comparison.note = "One or both visual comparison targets are ignored.";
    }
    report.visualComparisons.push(comparison);
    if (!comparison.ignored) {
      if (typeof pair.maxMeanLumaDelta === "number" && comparison.meanLumaDelta > pair.maxMeanLumaDelta) {
        pushIssue(report.auditErrors, "visual", `${pair.a} vs ${pair.b} mean luma delta ${comparison.meanLumaDelta.toFixed(1)} exceeds ${pair.maxMeanLumaDelta}`, comparison);
      }
      if (typeof pair.maxMeanRGBDelta === "number" && comparison.meanRGBDelta > pair.maxMeanRGBDelta) {
        pushIssue(report.auditErrors, "visual", `${pair.a} vs ${pair.b} mean RGB delta ${comparison.meanRGBDelta.toFixed(1)} exceeds ${pair.maxMeanRGBDelta}`, comparison);
      }
      if (typeof pair.maxRmsLumaDelta === "number" && comparison.rmsLumaDelta > pair.maxRmsLumaDelta) {
        pushIssue(report.auditErrors, "visual", `${pair.a} vs ${pair.b} RMS luma delta ${comparison.rmsLumaDelta.toFixed(1)} exceeds ${pair.maxRmsLumaDelta}`, comparison);
      }
    }
  }
}

function shouldIgnoreVisualFailure(report, selector) {
  const selectorText = String(selector || "").toLowerCase();
  if (!selectorText.includes("webgpu") && !selectorText.includes("canvas")) {
    return "";
  }
  const hasKnownHeadlessDeviceLoss = report.ignoredErrors.some((error) => {
    return error.ignoreRuleId === "system-chrome-headless-webgpu-device-lost";
  });
  return hasKnownHeadlessDeviceLoss
    ? "Known system Chrome headless WebGPU device loss also invalidates the captured WebGPU canvas. Do not chase this visual result unless it reproduces outside the audit harness."
    : "";
}

function normalizeVisualAuditConfig(raw) {
  const cfg = raw && typeof raw === "object" ? raw : {};
  return {
    enabled: cfg.enabled !== false,
    selectors: Array.isArray(cfg.selectors) && cfg.selectors.length > 0 ? cfg.selectors : ["canvas"],
    minUniqueBuckets: numberOr(cfg.minUniqueBuckets, 8),
    minNonBackgroundRatio: numberOr(cfg.minNonBackgroundRatio, 0.02),
    sampleWidth: numberOr(cfg.sampleWidth, 160),
    sampleHeight: numberOr(cfg.sampleHeight, 90),
    diffAmplification: numberOr(cfg.diffAmplification, 4),
    preferCanvasCapture: cfg.preferCanvasCapture === true,
    maskSelectors: Array.isArray(cfg.maskSelectors) ? cfg.maskSelectors.filter((selector) => typeof selector === "string" && selector) : [],
    comparePairs: Array.isArray(cfg.comparePairs) ? cfg.comparePairs.filter((pair) => pair && pair.a && pair.b) : []
  };
}

function numberOr(value, fallback) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function sanitizeArtifactName(value) {
  return String(value || "item")
    .replace(/^[#.]+/, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120) || "item";
}

async function captureVisualTarget(page, selector, clip, config) {
  if (config.preferCanvasCapture) {
    const canvasCapture = await captureCanvasVisualTarget(page, selector);
    if (canvasCapture) {
      return canvasCapture;
    }
  }
  return {
    base64: await screenshotWithHiddenSelectors(page, clip, config.maskSelectors),
    source: config.maskSelectors.length > 0 ? "screenshot-masked" : "screenshot"
  };
}

async function screenshotWithHiddenSelectors(page, clip, maskSelectors) {
  if (!maskSelectors.length) {
    return page.screenshot({encoding: "base64", clip});
  }
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

async function captureCanvasVisualTarget(page, selector) {
  const canvasBase64 = await page.evaluate((selector) => {
    const element = document.querySelector(selector);
    if (!(element instanceof HTMLCanvasElement)) {
      return "";
    }
    if (element.width < 1 || element.height < 1) {
      return "";
    }
    try {
      return element.toDataURL("image/png").replace(/^data:image\/png;base64,/, "");
    } catch (_e) {
      return "";
    }
  }, selector);
  if (canvasBase64) {
    return {
      base64: canvasBase64,
      source: "canvas"
    };
  }
  return null;
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
      const scale = Math.max(1, Number(diffAmplification) || 4);
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

function buildMarkdownReport(report) {
  const lines = [];
  lines.push("# Example Console Audit");
  lines.push("");
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push(`Base URL: ${report.baseUrl}`);
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push(`- Total: ${report.summary.total}`);
  lines.push(`- Passed: ${report.summary.passed}`);
  lines.push(`- Failed: ${report.summary.failed}`);
  lines.push(`- Skipped: ${report.summary.skipped}`);
  lines.push(`- Browser errors: ${report.summary.browserErrors}`);
  lines.push(`- Ignored browser errors: ${report.summary.ignoredBrowserErrors}`);
  lines.push(`- Audit errors: ${report.summary.auditErrors}`);
  lines.push(`- Visual audit errors: ${report.summary.visualAuditErrors}`);
  lines.push(`- Visual comparisons: ${report.summary.visualComparisons}`);
  lines.push(`- Warnings: ${report.summary.warnings}`);
  lines.push(`- Duration: ${Math.round(report.summary.durationMs / 1000)}s`);
  lines.push("");

  const failed = report.examples.filter((example) => !example.ok);
  const ignored = report.examples.filter((example) => example.ok && example.ignoredErrors && example.ignoredErrors.length > 0);
  if (failed.length === 0) {
    lines.push("No example errors captured.");
    lines.push("");
  } else {
    lines.push("## Failures");
    lines.push("");
    for (const example of failed) {
      lines.push(`### ${example.id}`);
      if (example.title) lines.push(`Title: ${example.title}`);
      lines.push(`URL: ${example.url}`);
      lines.push(`Duration: ${example.durationMs}ms`);
      lines.push("");
      if (example.errors.length > 0) {
        lines.push("Browser errors:");
        for (const error of example.errors) {
          const location = error.location ? ` (${error.location})` : "";
          lines.push(`- ${error.type}${location}: ${error.text}`);
        }
      }
      if (example.auditErrors && example.auditErrors.length > 0) {
        if (example.errors.length > 0) lines.push("");
        lines.push("Audit errors:");
        for (const error of example.auditErrors) {
          lines.push(`- ${error.type}: ${error.text}`);
        }
      }
      if (example.ignoredErrors && example.ignoredErrors.length > 0) {
        if (example.errors.length > 0 || (example.auditErrors && example.auditErrors.length > 0)) lines.push("");
        lines.push("Ignored browser errors:");
        for (const error of example.ignoredErrors) {
          const location = error.location ? ` (${error.location})` : "";
          lines.push(`- ${error.type}${location}: ${error.text}`);
          if (error.note) {
            lines.push(`  Note: ${error.note}`);
          }
        }
      }
      if (example.visualAudits && example.visualAudits.length > 0) {
        lines.push("");
        lines.push("Visual audits:");
        for (const visual of example.visualAudits) {
          const artifact = visual.artifactPath ? `, artifact=${visual.artifactPath}` : "";
          lines.push(`- ${visual.selector}: unique=${visual.uniqueBuckets}, nonDominant=${(visual.nonDominantRatio * 100).toFixed(1)}%, lumaRange=${visual.lumaRange.toFixed(1)}${artifact}`);
        }
      }
      if (example.visualComparisons && example.visualComparisons.length > 0) {
        lines.push("");
        lines.push("Visual comparisons:");
        for (const comparison of example.visualComparisons) {
          const ignoredNote = comparison.ignored ? " ignored" : "";
          const artifacts = formatComparisonArtifacts(comparison);
          lines.push(`- ${comparison.a} vs ${comparison.b}${ignoredNote}: meanRGBDelta=${comparison.meanRGBDelta.toFixed(1)}, meanLumaDelta=${comparison.meanLumaDelta.toFixed(1)}, rmsLumaDelta=${comparison.rmsLumaDelta.toFixed(1)}, maxLumaDelta=${comparison.maxLumaDelta.toFixed(1)}${artifacts}`);
        }
      }
      if (example.warnings.length > 0) {
        lines.push("");
        lines.push("Warnings:");
        for (const warning of example.warnings) {
          const location = warning.location ? ` (${warning.location})` : "";
          lines.push(`- ${warning.type}${location}: ${warning.text}`);
        }
      }
      lines.push("");
    }
  }

  if (ignored.length > 0) {
    lines.push("## Ignored Browser Errors");
    lines.push("");
    for (const example of ignored) {
      lines.push(`### ${example.id}`);
      if (example.title) lines.push(`Title: ${example.title}`);
      lines.push(`URL: ${example.url}`);
      lines.push("");
      for (const error of example.ignoredErrors) {
        const location = error.location ? ` (${error.location})` : "";
        lines.push(`- ${error.type}${location}: ${error.text}`);
        if (error.note) {
          lines.push(`  Note: ${error.note}`);
        }
      }
      lines.push("");
    }
  }

  const visualExamples = report.examples.filter((example) => example.visualAudits && example.visualAudits.length > 0);
  if (visualExamples.length > 0) {
    lines.push("## Visual Audits");
    lines.push("");
    for (const example of visualExamples) {
      lines.push(`### ${example.id}`);
      for (const visual of example.visualAudits) {
        const ignoredNote = visual.ignored ? " ignored" : "";
        const artifact = visual.artifactPath ? `, artifact=${visual.artifactPath}` : "";
        lines.push(`- ${visual.selector}${ignoredNote}: unique=${visual.uniqueBuckets}, nonDominant=${(visual.nonDominantRatio * 100).toFixed(1)}%, lumaRange=${visual.lumaRange.toFixed(1)}${artifact}`);
        if (visual.note) {
          lines.push(`  Note: ${visual.note}`);
        }
      }
      if (example.visualComparisons && example.visualComparisons.length > 0) {
        for (const comparison of example.visualComparisons) {
          const ignoredNote = comparison.ignored ? " ignored" : "";
          const artifacts = formatComparisonArtifacts(comparison);
          lines.push(`- ${comparison.a} vs ${comparison.b}${ignoredNote}: meanRGBDelta=${comparison.meanRGBDelta.toFixed(1)}, meanLumaDelta=${comparison.meanLumaDelta.toFixed(1)}, rmsLumaDelta=${comparison.rmsLumaDelta.toFixed(1)}, maxLumaDelta=${comparison.maxLumaDelta.toFixed(1)}${artifacts}`);
          if (comparison.note) {
            lines.push(`  Note: ${comparison.note}`);
          }
        }
      }
      lines.push("");
    }
  }

  const skipped = report.examples.filter((example) => example.skipped);
  if (skipped.length > 0) {
    lines.push("## Skipped");
    lines.push("");
    for (const example of skipped) {
      lines.push(`### ${example.id}`);
      if (example.title) lines.push(`Title: ${example.title}`);
      lines.push(`URL: ${example.url}`);
      lines.push(`Reason: ${example.skipReason}`);
      lines.push("");
    }
  }

  return `${lines.join("\n")}\n`;
}

function formatComparisonArtifacts(comparison) {
  const parts = [];
  if (comparison.sideBySideArtifactPath) {
    parts.push(`sideBySide=${comparison.sideBySideArtifactPath}`);
  }
  if (comparison.deltaArtifactPath) {
    const scale = comparison.diffAmplification ? `@${comparison.diffAmplification}x` : "";
    parts.push(`delta${scale}=${comparison.deltaArtifactPath}`);
  }
  return parts.length > 0 ? `, ${parts.join(", ")}` : "";
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

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.visualAudit && !args.visualOutputDir) {
    const extension = path.extname(args.output);
    const baseName = extension ? path.basename(args.output, extension) : path.basename(args.output);
    args.visualOutputDir = path.join(path.dirname(args.output), `${baseName}-artifacts`);
  }
  const examplesIndex = readJson(path.join(examplesDir, "index.json"));
  if (!examplesIndex) {
    console.error(`Could not read ${path.join(examplesDir, "index.json")}`);
    process.exit(1);
  }

  const jobs = Object.keys(examplesIndex)
    .filter((id) => matchesFilter(id, args.filter))
    .sort()
    .map((id) => ({id, meta: examplesIndex[id]}));

  if (jobs.length === 0) {
    console.log("No examples matched.");
    return;
  }

  const started = Date.now();
  const {server, baseUrl} = await startServer(args.port);
  console.log(`Auditing ${jobs.length} example(s) at ${baseUrl} with ${Math.min(args.workers, jobs.length)} worker(s).`);
  console.log(`Using Chrome: ${args.chromePath || "Puppeteer default"}`);

  let browser = null;
  const examples = [];

  try {
    browser = await puppeteer.launch({
      headless: args.headless,
      executablePath: args.chromePath || undefined,
      protocolTimeout: args.timeoutMs + 30000,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--enable-unsafe-swiftshader",
        "--enable-features=Vulkan,UseSkiaRenderer",
        "--enable-unsafe-webgpu",
        "--ignore-gpu-blocklist",
      ],
    });

    const queue = jobs.slice();
    const workers = Array.from({length: Math.min(args.workers, jobs.length)}, async () => {
      const page = await browser.newPage();
      await page.setViewport(VIEWPORT);
      try {
        while (queue.length > 0) {
          const job = queue.shift();
          if (!job) break;
          const result = job.meta.auditSkipReason
            ? createSkippedExampleReport(job, baseUrl, args)
            : await auditExample(page, job, baseUrl, args);
          examples.push(result);
          const issueCount = result.errors.length + result.auditErrors.length;
          const status = result.skipped ? "skip" : result.ok ? "ok" : "ERR";
          console.log(`  ${status} ${job.id} (${result.errors.length} browser, ${result.auditErrors.length} audit, ${result.ignoredErrors.length} ignored error${issueCount === 1 ? "" : "s"})`);
        }
      } finally {
        await page.close();
      }
    });

    await Promise.all(workers);
  } finally {
    if (browser) await browser.close();
    server.close();
  }

  examples.sort((a, b) => a.id.localeCompare(b.id));
  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl,
    options: {
      filter: args.filter,
      chromePath: args.chromePath,
      headless: args.headless,
      query: args.query,
      includeWarnings: args.includeWarnings,
      visualAudit: args.visualAudit,
      visualOutputDir: args.visualOutputDir,
      waitForExampleLoaded: args.waitForExampleLoaded,
      timeoutMs: args.timeoutMs,
      settleMs: args.settleMs,
      workers: args.workers
    },
    summary: {
      total: examples.length,
      passed: examples.filter((example) => example.ok && !example.skipped).length,
      failed: examples.filter((example) => !example.ok).length,
      skipped: examples.filter((example) => example.skipped).length,
      browserErrors: examples.reduce((sum, example) => sum + example.errors.length, 0),
      ignoredBrowserErrors: examples.reduce((sum, example) => sum + example.ignoredErrors.length, 0),
      auditErrors: examples.reduce((sum, example) => sum + example.auditErrors.length, 0),
      visualAuditErrors: examples.reduce((sum, example) => sum + example.auditErrors.filter((error) => error.type === "visual").length, 0),
      visualComparisons: examples.reduce((sum, example) => sum + example.visualComparisons.length, 0),
      warnings: examples.reduce((sum, example) => sum + example.warnings.length, 0),
      durationMs: Date.now() - started
    },
    examples
  };

  const outputs = writeReports(report, args.output);
  console.log("");
  console.log(`Wrote ${outputs.jsonPath}`);
  console.log(`Wrote ${outputs.markdownPath}`);
  console.log(`Summary: ${report.summary.passed}/${report.summary.total} passed, ${report.summary.failed} failed, ${report.summary.skipped} skipped, ${report.summary.browserErrors} browser errors, ${report.summary.ignoredBrowserErrors} ignored browser errors, ${report.summary.auditErrors} audit errors, ${report.summary.visualAuditErrors} visual audit errors.`);

  if (args.failOnErrors && report.summary.failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : String(error));
  process.exitCode = 1;
});
