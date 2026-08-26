// Compares the default texture-pulled opaque triangle path with the
// internal VBO opaque triangle prototype using the focused profile example.

const fs = require("fs");
const path = require("path");
const {createRequire} = require("module");

const repoRoot = path.resolve(__dirname, "..", "..", "..", "..", "..");
const websiteRoot = path.resolve(__dirname, "..", "..", "..");
const repoRequire = createRequire(path.join(repoRoot, "package.json"));
const websiteRequire = createRequire(path.join(websiteRoot, "package.json"));

const sharp = repoRequire("sharp");
const puppeteer = websiteRequire("puppeteer");
const httpServer = websiteRequire("http-server");

const DEFAULTS = {
  cells: 300,
  frames: 30,
  viewportWidth: 1280,
  viewportHeight: 720,
  perChannelTolerance: 12,
  maxMismatchRatio: 0.015,
  maxMeanChannelDelta: 1.0,
  outputDir: "/tmp/xeokit-vbo-opaque-triangles-visual",
  normals: false,
  vboMode: "hybrid",
};

function parseArgs(argv) {
  const args = {...DEFAULTS};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--cells") {
      args.cells = parsePositiveInt(argv[++i], "cells");
    } else if (arg === "--frames") {
      args.frames = parsePositiveInt(argv[++i], "frames");
    } else if (arg === "--viewport") {
      const value = argv[++i] || "";
      const match = /^(\d+)x(\d+)$/.exec(value);
      if (!match) {
        throw new Error("--viewport must use WIDTHxHEIGHT, for example 1280x720");
      }
      args.viewportWidth = parsePositiveInt(match[1], "viewport width");
      args.viewportHeight = parsePositiveInt(match[2], "viewport height");
    } else if (arg === "--per-channel-tolerance") {
      args.perChannelTolerance = parsePositiveInt(argv[++i], "per-channel tolerance");
    } else if (arg === "--max-mismatch-ratio") {
      args.maxMismatchRatio = parseNonNegativeNumber(argv[++i], "max mismatch ratio");
    } else if (arg === "--max-mean-channel-delta") {
      args.maxMeanChannelDelta = parseNonNegativeNumber(argv[++i], "max mean channel delta");
    } else if (arg === "--output-dir") {
      args.outputDir = path.resolve(argv[++i] || "");
    } else if (arg === "--normals") {
      args.normals = true;
    } else if (arg === "--vbo-mode") {
      const value = argv[++i];
      if (value !== "hybrid" && value !== "vbo-only" && value !== "baked") {
        throw new Error("--vbo-mode must be hybrid, vbo-only or baked");
      }
      args.vboMode = value === "baked" ? "vbo-only" : value;
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
  console.log(`Usage: node packages/website/tools/render-benchmarks/webgpu/compare-vbo-opaque-triangles.js [options]

Options:
  --cells <n>                  Grid cells per side. Default ${DEFAULTS.cells}.
  --frames <n>                 Warm-up frames before capture. Default ${DEFAULTS.frames}.
  --viewport <WIDTHxHEIGHT>    Browser viewport. Default ${DEFAULTS.viewportWidth}x${DEFAULTS.viewportHeight}.
  --per-channel-tolerance <n>  Pixel channel tolerance, 0-255. Default ${DEFAULTS.perChannelTolerance}.
  --max-mismatch-ratio <n>     Fail above this mismatched-pixel ratio. Default ${DEFAULTS.maxMismatchRatio}.
  --max-mean-channel-delta <n> Fail above this average RGBA channel delta. Default ${DEFAULTS.maxMeanChannelDelta}.
  --output-dir <path>          Output directory. Default ${DEFAULTS.outputDir}.
  --normals                    Generate a smooth-normal workload; VBO preview ignores smooth normals.
  --vbo-mode <hybrid|vbo-only> VBO prototype mode. Default ${DEFAULTS.vboMode}. "baked" is accepted as an alias.
`);
}

function parsePositiveInt(value, name) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid ${name}: ${value}`);
  }
  return parsed;
}

function parseNonNegativeNumber(value, name) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`Invalid ${name}: ${value}`);
  }
  return parsed;
}

function listen(server) {
  return new Promise((resolve, reject) => {
    server.server.on("error", reject);
    server.server.listen(0, "127.0.0.1", () => resolve(server.server.address().port));
  });
}

function close(server) {
  return new Promise(resolve => server.close(() => resolve()));
}

async function capturePath(browser, port, args, vboEnabled, outputPath) {
  const page = await browser.newPage();
  const pageErrors = [];
  const consoleErrors = [];
  const httpErrors = [];
  const mode = vboEnabled ? "vbo" : "texture";
  const url = `http://127.0.0.1:${port}/examples/profile_renderer_vbo_opaqueTriangles/index.html` +
    `?cells=${args.cells}&frames=${args.frames}&vbo=${vboEnabled ? 1 : 0}&vboMode=${args.vboMode}&orbit=0&normals=${args.normals ? 1 : 0}`;

  try {
    await page.setViewport({
      width: args.viewportWidth,
      height: args.viewportHeight,
      deviceScaleFactor: 1,
    });
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
    await page.waitForSelector("#ExampleLoaded", {timeout: 60000});
    await page.waitForFunction(() => !!window.vboExample?.view, {timeout: 60000});
    await page.addStyleTag({content: `
      #toolbar,
      .xkt-toolbar,
      .xkt-issues-panel,
      .xkt-issues-pill,
      .xkt-info-panel,
      .xkt-info-pill,
      .xkt-pill-rail,
      .xkt-vp-header {
        display: none !important;
      }
      body {
        background: #000 !important;
      }
    `});
    await page.evaluate((enabled, warmupFrames) => new Promise(resolve => {
      window.vboExample.setVBOMode(enabled);
      const orbit = document.getElementById("orbit");
      if (orbit) {
        orbit.checked = false;
      }
      window.vboExample.view.renderMode = window.xeokit?.base?.constants?.NavigationRender
        ?? window.vboExample.view.renderMode;
      let left = warmupFrames;
      function tick() {
        window.vboExample.view.needsRender();
        if (--left <= 0) {
          requestAnimationFrame(resolve);
          return;
        }
        requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    }), vboEnabled, args.frames);

    const stats = await page.evaluate(() => ({
      triangles: window.vboExample.workload.triangles,
      currentPath: document.getElementById("currentPath")?.textContent || "",
    }));
    await page.screenshot({path: outputPath, fullPage: false});

    return {
      mode,
      url,
      outputPath,
      stats,
      pageErrors,
      consoleErrors: consoleErrors.filter(entry => !entry.url.endsWith("/favicon.ico")),
      httpErrors: httpErrors.filter(entry => !entry.url.endsWith("/favicon.ico")),
    };
  } finally {
    await page.close();
  }
}

async function compareImages(texturePath, vboPath, diffPath, args) {
  const texture = await readImage(texturePath);
  const vbo = await readImage(vboPath);
  if (texture.width !== vbo.width || texture.height !== vbo.height) {
    throw new Error(
      `Image dimensions differ: texture=${texture.width}x${texture.height}, ` +
      `vbo=${vbo.width}x${vbo.height}`,
    );
  }

  const pixelCount = texture.width * texture.height;
  const diff = Buffer.alloc(pixelCount * 4);
  let mismatchCount = 0;
  let maxChannelDelta = 0;
  let totalChannelDelta = 0;

  for (let pixel = 0; pixel < pixelCount; pixel++) {
    const offset = pixel * 4;
    const dr = Math.abs(texture.data[offset] - vbo.data[offset]);
    const dg = Math.abs(texture.data[offset + 1] - vbo.data[offset + 1]);
    const db = Math.abs(texture.data[offset + 2] - vbo.data[offset + 2]);
    const da = Math.abs(texture.data[offset + 3] - vbo.data[offset + 3]);
    const maxDelta = Math.max(dr, dg, db, da);
    maxChannelDelta = Math.max(maxChannelDelta, maxDelta);
    totalChannelDelta += dr + dg + db + da;

    if (maxDelta > args.perChannelTolerance) {
      mismatchCount++;
      diff[offset] = 255;
      diff[offset + 1] = 0;
      diff[offset + 2] = 80;
      diff[offset + 3] = 255;
    } else {
      const gray = Math.round((texture.data[offset] + texture.data[offset + 1] + texture.data[offset + 2]) / 12);
      diff[offset] = gray;
      diff[offset + 1] = gray;
      diff[offset + 2] = gray;
      diff[offset + 3] = 255;
    }
  }

  await sharp(diff, {
    raw: {
      width: texture.width,
      height: texture.height,
      channels: 4,
    },
  }).png().toFile(diffPath);

  return {
    width: texture.width,
    height: texture.height,
    pixels: pixelCount,
    mismatchCount,
    mismatchRatio: mismatchCount / pixelCount,
    maxChannelDelta,
    meanChannelDelta: totalChannelDelta / (pixelCount * 4),
    passed: mismatchCount / pixelCount <= args.maxMismatchRatio
      && totalChannelDelta / (pixelCount * 4) <= args.maxMeanChannelDelta,
  };
}

async function readImage(filePath) {
  const {data, info} = await sharp(filePath)
    .ensureAlpha()
    .raw()
    .toBuffer({resolveWithObject: true});
  return {
    data,
    width: info.width,
    height: info.height,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  fs.mkdirSync(args.outputDir, {recursive: true});

  const server = httpServer.createServer({root: websiteRoot});
  const texturePath = path.join(args.outputDir, "texture.png");
  const vboPath = path.join(args.outputDir, "vbo.png");
  const diffPath = path.join(args.outputDir, "diff.png");
  const resultPath = path.join(args.outputDir, "result.json");
  let browser;

  try {
    const port = await listen(server);
    browser = await puppeteer.launch({
      headless: true,
      protocolTimeout: 180000,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--enable-unsafe-swiftshader",
        "--enable-webgl",
        "--ignore-gpu-blocklist",
        `--window-size=${args.viewportWidth},${args.viewportHeight}`,
      ],
    });

    const texture = await capturePath(browser, port, args, false, texturePath);
    const vbo = await capturePath(browser, port, args, true, vboPath);
    const comparison = await compareImages(texturePath, vboPath, diffPath, args);
    const result = {
      args,
      texture,
      vbo,
      comparison,
      files: {
        texture: texturePath,
        vbo: vboPath,
        diff: diffPath,
      },
    };
    fs.writeFileSync(resultPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");

    console.log(`Texture screenshot: ${texturePath}`);
    console.log(`VBO screenshot:     ${vboPath}`);
    console.log(`Diff screenshot:    ${diffPath}`);
    console.log(`Result JSON:        ${resultPath}`);
    console.log(
      `Mismatch ratio: ${(comparison.mismatchRatio * 100).toFixed(3)}% ` +
      `(${comparison.mismatchCount}/${comparison.pixels}), ` +
      `max channel delta ${comparison.maxChannelDelta}`,
    );

    const errors = [
      ...texture.pageErrors,
      ...vbo.pageErrors,
      ...texture.consoleErrors.map(entry => entry.text),
      ...vbo.consoleErrors.map(entry => entry.text),
      ...texture.httpErrors.map(entry => `${entry.status} ${entry.url}`),
      ...vbo.httpErrors.map(entry => `${entry.status} ${entry.url}`),
    ];
    if (errors.length > 0) {
      console.error("Browser errors:");
      for (const error of errors) {
        console.error(`  - ${error}`);
      }
      process.exitCode = 1;
    }
    if (!comparison.passed) {
      console.error(
        `Visual comparison failed: mismatch ratio ${(comparison.mismatchRatio * 100).toFixed(3)}% ` +
        `or mean channel delta ${comparison.meanChannelDelta.toFixed(3)} exceeds configured limits`,
      );
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
