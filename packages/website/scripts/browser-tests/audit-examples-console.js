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

function getIgnoredBrowserErrorRule(text) {
  const value = String(text || "");
  return IGNORED_BROWSER_ERROR_RULES.find((rule) => value.includes(rule.match)) || null;
}

function pushBrowserIssue(report, type, text, extra = {}) {
  const rule = getIgnoredBrowserErrorRule(text);
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
    requests: []
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
        });
      } else if (args.includeWarnings && type === "warning") {
        pushIssue(report.warnings, "console.warn", text, {
          location
        });
      }
    })());
  };
  const onPageError = (error) => {
    pushBrowserIssue(report, "pageerror", error.stack || error.message || String(error));
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
    });
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
    });
  };

  page.on("console", onConsole);
  page.on("pageerror", onPageError);
  page.on("requestfailed", onRequestFailed);
  page.on("response", onResponse);

  try {
    await page.goto(url, {waitUntil: "domcontentloaded", timeout: timeoutMs});
    await waitForReadiness(page, args, job.meta);
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
      warnings: examples.reduce((sum, example) => sum + example.warnings.length, 0),
      durationMs: Date.now() - started
    },
    examples
  };

  const outputs = writeReports(report, args.output);
  console.log("");
  console.log(`Wrote ${outputs.jsonPath}`);
  console.log(`Wrote ${outputs.markdownPath}`);
  console.log(`Summary: ${report.summary.passed}/${report.summary.total} passed, ${report.summary.failed} failed, ${report.summary.skipped} skipped, ${report.summary.browserErrors} browser errors, ${report.summary.ignoredBrowserErrors} ignored browser errors, ${report.summary.auditErrors} audit errors.`);

  if (args.failOnErrors && report.summary.failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : String(error));
  process.exitCode = 1;
});
