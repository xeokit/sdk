// packages/website/scripts/create-example-snapshots.js
//
// Walks every eligible example (`isTutorial || isVisualTest` in its
// `index.json`), opens it in headless Puppeteer, screenshots the
// rendered page, and writes the optional visual-test JSON payload
// the example may post via `xeokit.visualTestJson`.
//
// Usage:
//   node create-example-snapshots.js [options] [filter]
//
// Options:
//   --filter <pat>     Process only example ids matching <pat>. `*` is a
//                      wildcard; substring is also accepted. Equivalent to
//                      passing the pattern as a positional argument.
//   --only-stale       Process only examples whose `index.png` is missing
//                      or older than `index.js` / `index.html` / `index.json`.
//   --workers <n>      Number of parallel pages (default 4). Each worker
//                      processes a slice of the queue with its own page +
//                      error bin; the headless browser is shared.
//   -h, --help         Print this message.
//
// Per-example tuning:
//   Set `snapshotTimeoutMs` (number) in any example's `index.json` to
//   override the default 15s page-load + #ExampleLoaded wait timeout.
//   Heavy IFC loaders (Karhumaki) typically need 30000.

const fs = require("fs");
const path = require("path");
const httpServer = require("http-server");
const puppeteer = require("puppeteer");

const PORT = 3000;
const VIEWPORT = { width: 1110, height: 600 };
const DEFAULT_TIMEOUT_MS = 30000;
// The visual-test JSON is optional — many examples never post one.
// Bound the wait so screenshot-only examples don't burn 15 s each.
const VISUAL_TEST_JSON_TIMEOUT_MS = 5000;
const DEFAULT_WORKERS = 4;

const examplesDir = path.join(__dirname, "../examples");


// ─── CLI parsing ─────────────────────────────────────────────

function parseArgs(argv) {
  const args = { filter: null, onlyStale: false, workers: DEFAULT_WORKERS };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--filter" || a === "-f") {
      args.filter = argv[++i] || null;
    } else if (a === "--only-stale" || a === "--incremental") {
      args.onlyStale = true;
    } else if (a === "--workers" || a === "-w") {
      const n = parseInt(argv[++i], 10);
      if (!Number.isFinite(n) || n < 1) {
        console.error(`Invalid --workers value; must be a positive integer.`);
        process.exit(2);
      }
      args.workers = n;
    } else if (a === "--help" || a === "-h") {
      printHelp();
      process.exit(0);
    } else if (!args.filter) {
      // Positional treated as filter.
      args.filter = a;
    }
  }
  return args;
}

function printHelp() {
  console.log(`Usage: node create-example-snapshots.js [options] [filter]

Options:
  --filter <pat>    Process only example ids matching <pat>. \`*\` is a wildcard.
  --only-stale      Process only examples whose index.png is missing or older
                    than index.js / index.html / index.json.
  --workers <n>     Number of parallel pages (default ${DEFAULT_WORKERS}).
  -h, --help        Print this message.

Per-example tuning: set "snapshotTimeoutMs" in index.json to override the
default ${DEFAULT_TIMEOUT_MS} ms page-load timeout for heavy examples.`);
}

function matchesFilter(id, filter) {
  if (!filter) return true;
  if (filter.includes("*")) {
    const re = new RegExp(
      "^" +
      filter
        .split("*")
        .map(s => s.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
        .join(".*") +
      "$",
    );
    return re.test(id);
  }
  return id.includes(filter);
}


// ─── Filesystem helpers ──────────────────────────────────────

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (e) {
    return null;
  }
}

/**
 * True when `index.png` is missing or older than any of the
 * example's source files. Used by `--only-stale` to skip examples
 * whose snapshot is already fresh — drops a no-op rerun from
 * minutes to seconds.
 */
function isStale(dir) {
  const pngPath = path.join(dir, "index.png");
  if (!fs.existsSync(pngPath)) return true;
  const pngMtime = fs.statSync(pngPath).mtimeMs;
  for (const name of ["index.js", "index.html", "index.json"]) {
    const srcPath = path.join(dir, name);
    if (fs.existsSync(srcPath) && fs.statSync(srcPath).mtimeMs > pngMtime) {
      return true;
    }
  }
  return false;
}


// ─── Capture pipeline ────────────────────────────────────────

/**
 * Race a promise against a timeout. On timeout the returned
 * promise resolves with `fallback` and the original promise is
 * abandoned. Lets us wait for the optional `xeokit.visualTestJson`
 * postMessage without blocking the whole script when the example
 * never posts one.
 */
function raceWithTimeout(promise, ms, fallback) {
  let timer;
  return Promise.race([
    promise.finally(() => clearTimeout(timer)),
    new Promise(resolve => {
      timer = setTimeout(() => resolve(fallback), ms);
    }),
  ]);
}

/**
 * Capture screenshot first, then race for the optional
 * visual-test JSON. Screenshot-first ordering guarantees we always
 * record the post-`#ExampleLoaded` render even when no JSON is
 * forthcoming.
 */
async function captureExample(page, dir, timeoutMs) {
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
    { timeout: timeoutMs },
  );

  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));

  await page.screenshot({
    path: path.join(dir, "index.png"),
    fullPage: true,
  });

  const visualTestJson = await raceWithTimeout(
    page.evaluate(() => new Promise(resolve => {
      function handler(event) {
        if (event.data && event.data.type === "xeokit.visualTestJson") {
          window.removeEventListener("message", handler);
          resolve(event.data.payload);
        }
      }
      window.addEventListener("message", handler);
    })),
    VISUAL_TEST_JSON_TIMEOUT_MS,
    null,
  );

  if (visualTestJson !== null) {
    fs.writeFileSync(
      path.join(dir, "index.visualtest.json"),
      JSON.stringify(visualTestJson, null, 2),
      "utf8",
    );
  }

  return { jsonCaptured: visualTestJson !== null };
}


// ─── Orchestration ───────────────────────────────────────────

async function captureSnapshots(args) {
  const examplesIndex = readJson(path.join(examplesDir, "index.json"));
  if (!examplesIndex) {
    console.error("Could not read examples index.");
    process.exitCode = 1;
    return;
  }

  // Pre-filter eligible examples so the summary numbers are honest.
  const eligible = [];
  let filteredOut = 0;
  let skippedFresh = 0;
  let skippedNotEligible = 0;
  let missingMeta = 0;

  for (const exampleId of Object.keys(examplesIndex)) {
    if (!matchesFilter(exampleId, args.filter)) { filteredOut++; continue; }
    const dir = path.join(examplesDir, exampleId);
    const meta = readJson(path.join(dir, "index.json"));
    if (!meta) { missingMeta++; continue; }
    if (!(meta.isTutorial || meta.isVisualTest)) { skippedNotEligible++; continue; }
    if (args.onlyStale && !isStale(dir)) { skippedFresh++; continue; }
    eligible.push({ id: exampleId, dir, meta });
  }

  const effectiveWorkers = Math.min(args.workers, Math.max(1, eligible.length));
  console.log(
    `${eligible.length} example(s) to capture, ${effectiveWorkers} worker(s)` +
    (args.filter   ? ` [filter: ${args.filter}]`     : "") +
    (args.onlyStale ? " [stale-only]"                : ""),
  );
  if (skippedNotEligible > 0) console.log(`  ${skippedNotEligible} skipped (not flagged isTutorial/isVisualTest)`);
  if (skippedFresh       > 0) console.log(`  ${skippedFresh} skipped (PNG up-to-date)`);
  if (filteredOut        > 0) console.log(`  ${filteredOut} filtered out`);
  if (missingMeta        > 0) console.log(`  ${missingMeta} skipped (missing or invalid index.json)`);
  if (eligible.length === 0) return;

  // Serve the website root, not cwd. Lets the script run from any cwd.
  const server = httpServer.createServer({
    root: path.join(__dirname, ".."),
  });
  await new Promise(resolve => server.listen(PORT, resolve));
  console.log(`Server running at http://localhost:${PORT}`);

  let browser;
  const captured = [];
  const failed = [];

  try {
    browser = await puppeteer.launch({
      headless: true,
      // `--enable-unsafe-swiftshader` lets headless Chromium fall
      // back to software WebGL when no GPU is available — without
      // it current Chrome refuses to provide a WebGL context in
      // headless CI environments. The fallback is slower but
      // deterministic, which is what snapshot capture wants.
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--enable-unsafe-swiftshader",
      ],
    });

    // Worker pool. Each worker owns one page with its own listener
    // bin; they all draw from the same FIFO queue until it's
    // empty. The browser, server, and stdout are shared. We don't
    // try to lock log output — interleaved per-example lines from
    // different workers are fine in a terminal and the final
    // summary keeps order.
    const numWorkers = Math.min(args.workers, eligible.length);
    const queue = eligible.slice();   // mutable FIFO
    const workers = [];

    for (let w = 0; w < numWorkers; w++) {
      workers.push((async () => {
        const page = await browser.newPage();
        await page.setViewport(VIEWPORT);
        let pageErrors = [];
        page.on("pageerror", e => pageErrors.push(`pageerror: ${e.message}`));
        page.on("console", msg => {
          if (msg.type() === "error") pageErrors.push(`console.error: ${msg.text()}`);
        });
        page.on("requestfailed", r => {
          const failure = r.failure();
          pageErrors.push(`request failed: ${r.url()} (${failure ? failure.errorText : "unknown"})`);
        });

        while (queue.length > 0) {
          const job = queue.shift();
          if (!job) break;
          const { id, dir, meta } = job;
          const url = `http://localhost:${PORT}/examples/${id}/index.html`;
          const timeoutMs = (typeof meta.snapshotTimeoutMs === "number" && Number.isFinite(meta.snapshotTimeoutMs))
              ? meta.snapshotTimeoutMs
              : DEFAULT_TIMEOUT_MS;
          pageErrors = [];
          try {
            await page.goto(url, { waitUntil: "domcontentloaded", timeout: timeoutMs });
            const result = await captureExample(page, dir, timeoutMs);
            captured.push({ id, jsonCaptured: result.jsonCaptured });
            console.log(`  ✓ ${id}${result.jsonCaptured ? " (+json)" : ""}`);
          } catch (e) {
            const msg = (e && e.message) ? e.message : String(e);
            const detail = pageErrors.length > 0 ? `${msg}; ${pageErrors.join("; ")}` : msg;
            failed.push({ id, error: detail });
            console.log(`  ✗ ${id} — ${detail}`);
          }
        }

        await page.close();
      })());
    }

    await Promise.all(workers);
  } catch (error) {
    console.error("Fatal error during capture:", error);
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
    server.close();
  }

  // Summary + non-zero exit on any failure so CI catches breakage.
  console.log("");
  console.log(`Summary: captured ${captured.length}, failed ${failed.length}.`);
  if (failed.length > 0) {
    console.log("Failed examples:");
    for (const { id, error } of failed) {
      console.log(`  - ${id}: ${error}`);
    }
    process.exitCode = 1;
  }
}


captureSnapshots(parseArgs(process.argv.slice(2))).catch(err => {
  console.error("Unhandled error:", err);
  process.exitCode = 1;
});
