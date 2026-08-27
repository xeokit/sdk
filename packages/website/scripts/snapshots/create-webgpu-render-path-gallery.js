// Captures the WebGPU render-path matrix example across useful geometry,
// material, and view-effect permutations, then writes a browsable gallery.
//
// Usage:
//   node packages/website/scripts/snapshots/create-webgpu-render-path-gallery.js
//   node packages/website/scripts/snapshots/create-webgpu-render-path-gallery.js --quick
//   node packages/website/scripts/snapshots/create-webgpu-render-path-gallery.js --renderers both --limit 40

const fs = require("fs");
const path = require("path");
const {createRequire} = require("module");

const repoRoot = path.resolve(__dirname, "..", "..", "..", "..");
const websiteRoot = path.resolve(__dirname, "..", "..");
const websiteRequire = createRequire(path.join(websiteRoot, "package.json"));

const puppeteer = websiteRequire("puppeteer");
const httpServer = websiteRequire("http-server");
const sharp = require("sharp");

const EXAMPLE_ID = "view/webgpu/render-path-matrix";
const EXAMPLE_DIR = path.join(websiteRoot, "examples", EXAMPLE_ID);
const GALLERY_EXAMPLE_ID = "view/webgpu/render-path-matrix-gallery";
const DEFAULT_OUTPUT_DIR = path.join(websiteRoot, "examples", GALLERY_EXAMPLE_ID);
const DEFAULT_VIEWPORT = {width: 1280, height: 900};
const DEFAULT_TIMEOUT_MS = 90000;
const SYSTEM_CHROME_CANDIDATES = [
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser"
];

const GEOMETRY_MODES = [
  {id: "tri-flat", primitive: "triangles", normals: false, uvs: false, triplanar: false, label: "Triangles, generated normals"},
  {id: "tri-normals", primitive: "triangles", normals: true, uvs: false, triplanar: false, label: "Triangles, authored normals"},
  {id: "tri-uv", primitive: "triangles", normals: false, uvs: true, triplanar: false, label: "Triangles, generated normals + UVs"},
  {id: "tri-normals-uv", primitive: "triangles", normals: true, uvs: true, triplanar: false, label: "Triangles, authored normals + UVs"},
  {id: "tri-triplanar", primitive: "triangles", normals: false, uvs: false, triplanar: true, label: "Triangles, generated normals + triplanar"},
  {id: "tri-normals-triplanar", primitive: "triangles", normals: true, uvs: false, triplanar: true, label: "Triangles, authored normals + triplanar"},
  {id: "lines", primitive: "lines", normals: false, uvs: false, triplanar: false, label: "Lines"},
  {id: "points", primitive: "points", normals: false, uvs: false, triplanar: false, label: "Points"}
];

const VIEW_PRESETS = [
  {
    id: "ambient",
    label: "Ambient baseline",
    toggles: {ambientLight: true}
  },
  {
    id: "directional",
    label: "Directional light",
    toggles: {directionalLight: true}
  },
  {
    id: "directional-shadows",
    label: "Directional + shadows",
    toggles: {directionalLight: true, shadows: true}
  },
  {
    id: "hemisphere",
    label: "Hemisphere light",
    toggles: {hemisphereLight: true}
  },
  {
    id: "ibl",
    label: "IBL",
    toggles: {ibl: true}
  },
  {
    id: "directional-ibl",
    label: "Directional + IBL",
    toggles: {directionalLight: true, ibl: true}
  },
  {
    id: "sao",
    label: "Ambient + SAO",
    toggles: {ambientLight: true, sao: true}
  },
  {
    id: "bloom",
    label: "Ambient + bloom",
    toggles: {ambientLight: true, directionalLight: true, tonemap: true, srgb: true, bloom: true}
  },
  {
    id: "atmosphere",
    label: "Ambient + atmosphere",
    toggles: {ambientLight: true, tonemap: true, srgb: true, atmosphere: true}
  },
  {
    id: "dof",
    label: "Ambient + depth of field",
    toggles: {ambientLight: true, tonemap: true, srgb: true, depthOfField: true}
  },
  {
    id: "colorGrading",
    label: "Ambient + color grading",
    toggles: {ambientLight: true, directionalLight: true, tonemap: true, srgb: true, colorGrading: true}
  },
  {
    id: "post",
    label: "Post-process",
    toggles: {ambientLight: true, tonemap: true, srgb: true, bloom: true, atmosphere: true, depthOfField: true, antialiasing: true}
  },
  {
    id: "quality",
    label: "Quality stack",
    toggles: {
      directionalLight: true,
      hemisphereLight: true,
      ibl: true,
      sao: true,
      bloom: true,
      atmosphere: true,
      depthOfField: true,
      shadows: true,
      tonemap: true,
      srgb: true,
      antialiasing: true,
      edges: true
    }
  }
];

const QUICK_VIEW_IDS = new Set(["ambient", "directional", "directional-shadows", "ibl", "quality"]);
const QUICK_MATERIAL_IDS = new Set(["plain", "color", "color-normal", "full"]);

const BOOLEAN_FIELDS = [
  "normals",
  "uvs",
  "triplanar",
  "colorTexture",
  "normalTexture",
  "occlusionTexture",
  "metallicRoughnessTexture",
  "clearcoat",
  "sheen",
  "ambientLight",
  "directionalLight",
  "hemisphereLight",
  "ibl",
  "sao",
  "bloom",
  "atmosphere",
  "depthOfField",
  "colorGrading",
  "shadows",
  "tonemap",
  "srgb",
  "antialiasing",
  "edges"
];

const BASE_TOGGLES = Object.fromEntries(BOOLEAN_FIELDS.map((field) => [field, false]));

const RENDERER_FILTER_TAGS = [
  {id: "renderer:webgpu", label: "webgpu", matches: (item) => item.renderer === "webgpu"},
  {id: "renderer:webgl", label: "webgl", matches: (item) => item.renderer === "webgl"},
  {id: "renderer:auto", label: "auto", matches: (item) => item.renderer === "auto"}
];

const GEOMETRY_FILTER_TAGS = [
  {id: "geometry:triangles", label: "Triangles", matches: (item) => item.cfg.primitive === "triangles"},
  {id: "geometry:lines", label: "Lines", matches: (item) => item.cfg.primitive === "lines"},
  {id: "geometry:points", label: "Points", matches: (item) => item.cfg.primitive === "points"},
  {id: "geometry:generated-normals", label: "Generated normals", matches: (item) => item.cfg.primitive === "triangles" && !item.cfg.normals},
  {id: "geometry:authored-normals", label: "Authored normals", matches: (item) => item.cfg.primitive === "triangles" && item.cfg.normals},
  {id: "geometry:uvs", label: "UVs", matches: (item) => item.cfg.uvs},
  {id: "geometry:triplanar", label: "Triplanar", matches: (item) => item.cfg.triplanar}
];

const MATERIAL_FILTER_TAGS = [
  {
    id: "material:none",
    label: "No textures",
    matches: (item) => item.cfg.primitive === "triangles" &&
      !item.cfg.colorTexture &&
      !item.cfg.normalTexture &&
      !item.cfg.occlusionTexture &&
      !item.cfg.metallicRoughnessTexture &&
      !item.cfg.clearcoat &&
      !item.cfg.sheen
  },
  {id: "material:color", label: "Color", matches: (item) => item.cfg.colorTexture},
  {id: "material:normal", label: "Normal", matches: (item) => item.cfg.normalTexture},
  {id: "material:ao", label: "AO", matches: (item) => item.cfg.occlusionTexture},
  {id: "material:metal-rough", label: "Metal/Rough", matches: (item) => item.cfg.metallicRoughnessTexture},
  {id: "material:clearcoat", label: "Clear coat", matches: (item) => item.cfg.clearcoat},
  {id: "material:sheen", label: "Sheen", matches: (item) => item.cfg.sheen},
  {id: "material:vertex-color", label: "Vertex color", matches: (item) => item.cfg.primitive !== "triangles"}
];

const VIEW_FILTER_TAGS = [
  {id: "view:ambient", label: "Ambient", matches: (item) => item.cfg.ambientLight},
  {id: "view:directional", label: "Directional", matches: (item) => item.cfg.directionalLight},
  {id: "view:hemisphere", label: "Hemisphere", matches: (item) => item.cfg.hemisphereLight},
  {id: "view:ibl", label: "IBL", matches: (item) => item.cfg.ibl},
  {id: "view:sao", label: "SAO", matches: (item) => item.cfg.sao},
  {id: "view:bloom", label: "Bloom", matches: (item) => item.cfg.bloom},
  {id: "view:atmosphere", label: "Atmosphere", matches: (item) => item.cfg.atmosphere},
  {id: "view:dof", label: "Depth of field", matches: (item) => item.cfg.depthOfField},
  {id: "view:color-grading", label: "Color grading", matches: (item) => item.cfg.colorGrading},
  {id: "view:shadows", label: "Shadows", matches: (item) => item.cfg.shadows},
  {id: "view:tonemap", label: "Tonemap", matches: (item) => item.cfg.tonemap},
  {id: "view:srgb", label: "sRGB", matches: (item) => item.cfg.srgb},
  {id: "view:antialiasing", label: "Antialiasing", matches: (item) => item.cfg.antialiasing},
  {id: "view:edges", label: "Edges", matches: (item) => item.cfg.edges}
];

function parseArgs(argv) {
  const args = {
    outputDir: DEFAULT_OUTPUT_DIR,
    renderers: ["webgpu"],
    viewport: {...DEFAULT_VIEWPORT},
    timeoutMs: DEFAULT_TIMEOUT_MS,
    quick: false,
    dryRun: false,
    limit: 0,
    match: "",
    ids: [],
    showPanel: false,
    headful: process.env.WEBGPU_GALLERY_HEADFUL === "1"
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--output-dir") {
      args.outputDir = path.resolve(argv[++i]);
    } else if (arg === "--renderers") {
      const value = String(argv[++i] || "webgpu");
      args.renderers = value === "both" ? ["webgpu", "webgl"] : value.split(",").map((v) => v.trim()).filter(Boolean);
    } else if (arg === "--viewport") {
      args.viewport = parseViewport(argv[++i]);
    } else if (arg === "--timeout") {
      args.timeoutMs = parsePositiveInt(argv[++i], "timeout");
    } else if (arg === "--limit") {
      args.limit = parsePositiveInt(argv[++i], "limit");
    } else if (arg === "--match") {
      args.match = String(argv[++i] || "");
    } else if (arg === "--ids") {
      args.ids = String(argv[++i] || "").split(",").map((id) => id.trim()).filter(Boolean);
    } else if (arg === "--quick") {
      args.quick = true;
    } else if (arg === "--dry-run") {
      args.dryRun = true;
    } else if (arg === "--show-panel") {
      args.showPanel = true;
    } else if (arg === "--headful") {
      args.headful = true;
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  for (const renderer of args.renderers) {
    if (!["webgpu", "webgl", "auto"].includes(renderer)) {
      throw new Error(`Unsupported renderer '${renderer}'. Use webgpu, webgl, auto, or both.`);
    }
  }

  return args;
}

function parseViewport(value) {
  const match = /^(\d+)x(\d+)$/.exec(String(value || ""));
  if (!match) {
    throw new Error(`Invalid --viewport '${value}'. Expected WIDTHxHEIGHT.`);
  }
  return {
    width: parsePositiveInt(match[1], "viewport width"),
    height: parsePositiveInt(match[2], "viewport height")
  };
}

function parsePositiveInt(value, name) {
  const num = Number.parseInt(value, 10);
  if (!Number.isFinite(num) || num < 1) {
    throw new Error(`Invalid ${name}: ${value}`);
  }
  return num;
}

function printHelp() {
  console.log(`Usage: node packages/website/scripts/snapshots/create-webgpu-render-path-gallery.js [options]

Options:
  --renderers <list>   webgpu, webgl, auto, comma-list, or both. Default webgpu.
  --viewport <WxH>     Browser viewport. Default ${DEFAULT_VIEWPORT.width}x${DEFAULT_VIEWPORT.height}.
  --output-dir <path>  Gallery directory. Default examples/${GALLERY_EXAMPLE_ID}.
  --timeout <ms>       Per-page timeout. Default ${DEFAULT_TIMEOUT_MS}.
  --quick              Smaller smoke matrix.
  --limit <n>          Capture first n permutations.
  --match <text>       Capture permutations whose id contains this text.
  --ids <ids>          Capture exact comma-separated permutation ids.
  --dry-run            Write gallery HTML/metadata without screenshots.
  --show-panel         Keep the example control panel visible in screenshots.
  --headful            Use a visible Chrome window. Needed for WebGPU capture on some platforms.`);
}

function buildPermutations(args) {
  const permutations = buildAllPermutations(args.renderers, args.quick);
  return selectPermutations(permutations, args);
}

function buildAllPermutations(renderers, quick) {
  const materialModes = buildMaterialModes();
  const viewPresets = quick ? VIEW_PRESETS.filter((preset) => QUICK_VIEW_IDS.has(preset.id)) : VIEW_PRESETS;
  const permutations = [];

  for (const renderer of renderers) {
    for (const geometry of GEOMETRY_MODES) {
      const geometryMaterials = selectMaterialsForGeometry(geometry, materialModes, quick);
      const geometryViews = geometry.primitive === "triangles"
        ? viewPresets
        : viewPresets.filter((preset) => ["ambient", "post"].includes(preset.id));

      for (const material of geometryMaterials) {
        for (const view of geometryViews) {
          const cfg = {
            ...BASE_TOGGLES,
            renderer,
            primitive: geometry.primitive,
            material: "gripPlate",
            normals: geometry.normals,
            uvs: geometry.uvs,
            triplanar: geometry.triplanar,
            ...material.toggles,
            ...view.toggles
          };
          const id = [
            renderer,
            geometry.id,
            material.id,
            view.id
          ].join("__");
          const hash = configToHash(cfg);
          permutations.push({
            id,
            renderer,
            geometryId: geometry.id,
            materialId: material.id,
            viewId: view.id,
            title: `${geometry.label} / ${material.label} / ${view.label}`,
            labels: {
              geometry: geometry.label,
              material: material.label,
              view: view.label
            },
            cfg,
            hash,
            exampleUrl: `../${EXAMPLE_ID}/index.html#${hash}`,
            screenshot: `screenshots/${id}.png`,
            status: "planned",
            errors: []
          });
        }
      }
    }
    permutations.push(...buildClearcoatPermutations(renderer));
    permutations.push(...buildSheenPermutations(renderer));
  }
  return permutations;
}

function selectPermutations(permutations, args) {
  const matched = args.match
    ? permutations.filter((permutation) => permutation.id.toLowerCase().includes(args.match.toLowerCase()))
    : permutations;
  const selected = args.ids.length > 0
    ? matched.filter((permutation) => args.ids.includes(permutation.id))
    : matched;
  return args.limit > 0 ? selected.slice(0, args.limit) : selected;
}

function buildClearcoatPermutations(renderer) {
  const geometry = GEOMETRY_MODES.find((mode) => mode.id === "tri-normals-uv");
  const view = VIEW_PRESETS.find((preset) => preset.id === "directional-ibl");
  const materialCases = [
    {id: "shiny-clearcoat-off", material: "gripPlate", label: "Shiny Tiles, no clear coat", clearcoat: false},
    {id: "shiny-clearcoat", material: "gripPlate", label: "Shiny Tiles + Clear coat", clearcoat: true},
    {id: "bricks-clearcoat", material: "bricks", label: "Bricks + Clear coat", clearcoat: true},
    {id: "rust-clearcoat", material: "rust", label: "Rust + Clear coat", clearcoat: true}
  ];
  return materialCases.map((materialCase) => {
    const cfg = {
      ...BASE_TOGGLES,
      renderer,
      primitive: geometry.primitive,
      material: materialCase.material,
      normals: geometry.normals,
      uvs: geometry.uvs,
      triplanar: geometry.triplanar,
      colorTexture: true,
      normalTexture: true,
      occlusionTexture: true,
      metallicRoughnessTexture: true,
      clearcoat: materialCase.clearcoat,
      ...view.toggles
    };
    const id = [
      renderer,
      geometry.id,
      materialCase.id,
      view.id
    ].join("__");
    const hash = configToHash(cfg);
    return {
      id,
      renderer,
      geometryId: geometry.id,
      materialId: materialCase.id,
      viewId: view.id,
      title: `${geometry.label} / ${materialCase.label} / ${view.label}`,
      labels: {
        geometry: geometry.label,
        material: materialCase.label,
        view: view.label
      },
      cfg,
      hash,
      exampleUrl: `../${EXAMPLE_ID}/index.html#${hash}`,
      screenshot: `screenshots/${id}.png`,
      status: "planned",
      errors: []
    };
  });
}

function buildSheenPermutations(renderer) {
  const geometry = GEOMETRY_MODES.find((mode) => mode.id === "tri-normals-uv");
  const view = VIEW_PRESETS.find((preset) => preset.id === "directional-ibl");
  const materialCases = [
    {id: "bricks-sheen-off", material: "bricks", label: "Bricks, no sheen", sheen: false},
    {id: "bricks-sheen", material: "bricks", label: "Bricks + Sheen", sheen: true},
    {id: "rust-sheen", material: "rust", label: "Rust + Sheen", sheen: true},
    {id: "shiny-clearcoat-sheen", material: "gripPlate", label: "Shiny Tiles + Clear coat + Sheen", clearcoat: true, sheen: true}
  ];
  return materialCases.map((materialCase) => {
    const cfg = {
      ...BASE_TOGGLES,
      renderer,
      primitive: geometry.primitive,
      material: materialCase.material,
      normals: geometry.normals,
      uvs: geometry.uvs,
      triplanar: geometry.triplanar,
      colorTexture: true,
      normalTexture: true,
      occlusionTexture: true,
      metallicRoughnessTexture: true,
      clearcoat: !!materialCase.clearcoat,
      sheen: materialCase.sheen,
      ...view.toggles
    };
    const id = [
      renderer,
      geometry.id,
      materialCase.id,
      view.id
    ].join("__");
    const hash = configToHash(cfg);
    return {
      id,
      renderer,
      geometryId: geometry.id,
      materialId: materialCase.id,
      viewId: view.id,
      title: `${geometry.label} / ${materialCase.label} / ${view.label}`,
      labels: {
        geometry: geometry.label,
        material: materialCase.label,
        view: view.label
      },
      cfg,
      hash,
      exampleUrl: `../${EXAMPLE_ID}/index.html#${hash}`,
      screenshot: `screenshots/${id}.png`,
      status: "planned",
      errors: []
    };
  });
}

function buildMaterialModes() {
  const fields = ["colorTexture", "normalTexture", "occlusionTexture", "metallicRoughnessTexture"];
  const modes = [];
  for (let mask = 0; mask < (1 << fields.length); mask++) {
    const toggles = {};
    const active = [];
    for (let i = 0; i < fields.length; i++) {
      const enabled = (mask & (1 << i)) !== 0;
      toggles[fields[i]] = enabled;
      if (enabled) active.push(fields[i]);
    }
    const id = active.length === 0 ? "plain" : active.map(shortTextureName).join("-");
    modes.push({
      id,
      label: active.length === 0 ? "No textures" : active.map(readableTextureName).join(" + "),
      toggles
    });
  }
  return modes;
}

function selectMaterialsForGeometry(geometry, materialModes, quick) {
  if (geometry.primitive !== "triangles") {
    return [{id: "vertex-color", label: "Vertex color", toggles: {}}];
  }

  const textured = geometry.uvs || geometry.triplanar;
  let result = textured
    ? materialModes
    : materialModes.filter((mode) => mode.id === "plain");

  if (quick) {
    result = result.filter((mode) => QUICK_MATERIAL_IDS.has(mode.id));
  }
  return result;
}

function shortTextureName(name) {
  if (name === "colorTexture") return "color";
  if (name === "normalTexture") return "normal";
  if (name === "occlusionTexture") return "ao";
  if (name === "metallicRoughnessTexture") return "mr";
  return name;
}

function readableTextureName(name) {
  if (name === "colorTexture") return "Color";
  if (name === "normalTexture") return "Normal";
  if (name === "occlusionTexture") return "AO";
  if (name === "metallicRoughnessTexture") return "Metal/Rough";
  return name;
}

function configToHash(cfg) {
  const params = new URLSearchParams();
  params.set("renderer", cfg.renderer);
  params.set("primitive", cfg.primitive);
  params.set("material", cfg.material || "gripPlate");
  for (const field of BOOLEAN_FIELDS) {
    params.set(field, cfg[field] ? "1" : "0");
  }
  return params.toString();
}

async function capturePermutations(args, permutations) {
  if (args.dryRun || permutations.length === 0) {
    return permutations;
  }

  const server = httpServer.createServer({root: websiteRoot});
  const port = await listen(server);
  const chromeExecutable = resolveChromeExecutable(args);
  if (chromeExecutable) {
    console.log(`Chrome executable: ${chromeExecutable}`);
  }
  const browser = await puppeteer.launch({
    headless: !args.headful,
    executablePath: chromeExecutable || undefined,
    protocolTimeout: args.timeoutMs + 30000,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--enable-unsafe-swiftshader",
      "--enable-features=Vulkan,UseSkiaRenderer",
      "--enable-unsafe-webgpu",
      "--ignore-gpu-blocklist",
      `--window-size=${args.viewport.width},${args.viewport.height}`
    ]
  });

  try {
    const page = await browser.newPage();
    await page.setViewport(args.viewport);
    for (let i = 0; i < permutations.length; i++) {
      const permutation = permutations[i];
      const pageErrors = [];
      const onConsole = (msg) => {
        if (["error", "warning"].includes(msg.type())) {
          pageErrors.push(`${msg.type()}: ${msg.text()}`);
        }
      };
      const onPageError = (error) => pageErrors.push(`pageerror: ${error.message}`);
      const onRequestFailed = (request) => {
        const failure = request.failure();
        pageErrors.push(`request failed: ${request.url()} (${failure ? failure.errorText : "unknown"})`);
      };
      page.on("console", onConsole);
      page.on("pageerror", onPageError);
      page.on("requestfailed", onRequestFailed);

      try {
        const url = `http://127.0.0.1:${port}/examples/${EXAMPLE_ID}/index.html?capture=${encodeURIComponent(permutation.id)}#${permutation.hash}`;
        await page.goto(url, {waitUntil: "domcontentloaded", timeout: args.timeoutMs});
        await waitForExample(page, permutation.hash, args.timeoutMs, args.showPanel);
        throwOnFatalBrowserMessages(pageErrors);
        const screenshotPath = path.join(args.outputDir, permutation.screenshot);
        await page.screenshot({
          path: screenshotPath,
          fullPage: false
        });
        await assertScreenshotNotBlank(screenshotPath);
        permutation.status = pageErrors.some(isFatalBrowserMessage) ? "warning" : "captured";
        permutation.errors = compactErrors(pageErrors);
        console.log(`${String(i + 1).padStart(4, " ")}/${permutations.length} ${permutation.status === "captured" ? "ok" : "warn"} ${permutation.id}`);
      } catch (error) {
        permutation.status = "failed";
        permutation.errors = compactErrors([(error && error.message) ? error.message : String(error), ...pageErrors]);
        console.log(`${String(i + 1).padStart(4, " ")} fail ${permutation.id}`);
      } finally {
        page.off("console", onConsole);
        page.off("pageerror", onPageError);
        page.off("requestfailed", onRequestFailed);
      }
    }
    await page.close();
  } finally {
    await browser.close();
    close(server);
  }

  return permutations;
}

function listen(server) {
  return new Promise((resolve, reject) => {
    server.server.on("error", reject);
    server.listen(0, "127.0.0.1", () => resolve(server.server.address().port));
  });
}

function close(server) {
  server.close();
}

function resolveChromeExecutable(args) {
  const explicit = process.env.WEBGPU_GALLERY_CHROME || process.env.CHROME_BIN;
  if (explicit) {
    return explicit;
  }
  const needsWebGPU = args.renderers.some((renderer) => renderer === "webgpu" || renderer === "auto");
  if (!needsWebGPU) {
    return undefined;
  }
  return SYSTEM_CHROME_CANDIDATES.find((candidate) => {
    try {
      return fs.existsSync(candidate);
    } catch {
      return false;
    }
  });
}

async function waitForExample(page, expectedHash, timeoutMs, showPanel) {
  if (!showPanel) {
    await page.addStyleTag({
      content: "#diagnosticPanel{display:none!important}body{background:#eef3f8!important}"
    });
  }
  await page.waitForFunction((hash) => {
    const state = window.renderPathMatrix;
    return !!state &&
      state.ready === true &&
      state.expectedHash === hash &&
      state.captureArmed === true &&
      state.renderedFramesAfterSetup >= 1 &&
      !!document.querySelector("#ExampleLoaded");
  }, {timeout: timeoutMs}, expectedHash);
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

async function assertScreenshotNotBlank(screenshotPath) {
  const stats = await sharp(screenshotPath).stats();
  const allZero = stats.channels.every((channel) => channel.min === 0 && channel.max === 0);
  if (allZero) {
    throw new Error(`Captured blank screenshot: ${screenshotPath}`);
  }
}

function isFatalBrowserMessage(message) {
  return /Error while parsing WGSL|Invalid ShaderModule|Invalid RenderPipeline|WebGPU device was lost|deviceLost|Uncaught|pageerror/i.test(message);
}

function throwOnFatalBrowserMessages(messages) {
  const fatal = messages.filter(isFatalBrowserMessage);
  if (fatal.length > 0) {
    throw new Error(`Fatal browser message before capture: ${compactErrors(fatal).join("; ")}`);
  }
}

function compactErrors(errors) {
  const seen = new Set();
  const compacted = [];
  for (const error of errors) {
    const value = String(error || "").replace(/\s+/g, " ").trim();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    compacted.push(value.length > 500 ? `${value.slice(0, 497)}...` : value);
    if (compacted.length >= 5) break;
  }
  return compacted;
}

function prepareOutput(outputDir) {
  fs.mkdirSync(path.join(outputDir, "screenshots"), {recursive: true});
}

function writeGallery(args, permutations) {
  const generatedAt = new Date().toISOString();
  const payload = {
    generatedAt,
    exampleId: EXAMPLE_ID,
    viewport: args.viewport,
    count: permutations.length,
    permutations
  };
  fs.writeFileSync(path.join(args.outputDir, "permutations.json"), `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  fs.writeFileSync(path.join(args.outputDir, "index.html"), renderGalleryHtml(payload), "utf8");
}

function mergeSelectedIntoFullPermutations(args, selectedPermutations) {
  if (!args.match && args.ids.length === 0 && args.limit === 0) {
    return selectedPermutations;
  }
  const fullPermutations = buildAllPermutations(args.renderers, args.quick);
  mergeExistingCaptureState(args.outputDir, fullPermutations);
  const selectedById = new Map(selectedPermutations.map((item) => [item.id, item]));
  for (const permutation of fullPermutations) {
    const selected = selectedById.get(permutation.id);
    if (!selected) {
      continue;
    }
    permutation.status = selected.status;
    permutation.errors = Array.isArray(selected.errors) ? selected.errors : [];
  }
  return fullPermutations;
}

function renderGalleryHtml(payload) {
  const capturedCount = payload.permutations.filter((item) => item.status === "captured").length;
  const warningCount = payload.permutations.filter((item) => item.status === "warning").length;
  const failedCount = payload.permutations.filter((item) => item.status === "failed").length;
  const cards = payload.permutations.map(renderCard).join("\n");
  const rendererTags = filterTagButtons(payload.permutations, RENDERER_FILTER_TAGS);
  const geometryTags = filterTagButtons(payload.permutations, GEOMETRY_FILTER_TAGS);
  const materialTags = filterTagButtons(payload.permutations, MATERIAL_FILTER_TAGS);
  const viewTags = filterTagButtons(payload.permutations, VIEW_FILTER_TAGS);

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Render Path Tests</title>
  <style>
    :root {
      color-scheme: light;
      --ink: #18212b;
      --muted: #5a6775;
      --line: #ccd6e0;
      --panel: #ffffff;
      --wash: #edf3f7;
      --blue: #1d5d9f;
      --green: #16805c;
      --red: #bd3a3a;
      --amber: #9b6a16;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      color: var(--ink);
      background: var(--wash);
    }
    header {
      position: sticky;
      top: 0;
      z-index: 10;
      background: rgba(237, 243, 247, 0.94);
      backdrop-filter: blur(16px);
      border-bottom: 1px solid var(--line);
    }
    .bar {
      max-width: 1680px;
      margin: 0 auto;
      padding: 18px 20px 14px;
    }
    h1 {
      margin: 0 0 10px;
      font-size: 22px;
      line-height: 1.2;
      letter-spacing: 0;
    }
    .description {
      max-width: 760px;
      margin: -2px 0 10px;
      color: var(--muted);
      font-size: 13px;
      line-height: 1.45;
    }
    .meta {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      color: var(--muted);
      font-size: 13px;
    }
    .pill {
      display: inline-flex;
      align-items: center;
      min-height: 24px;
      padding: 2px 8px;
      border: 1px solid var(--line);
      border-radius: 6px;
      background: var(--panel);
    }
    .controls {
      display: grid;
      gap: 12px;
      margin-top: 14px;
    }
    input {
      width: 100%;
      height: 34px;
      border: 1px solid var(--line);
      border-radius: 6px;
      padding: 0 10px;
      color: var(--ink);
      background: #fff;
      font: inherit;
      font-size: 13px;
    }
    .filter-clouds {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 10px;
    }
    .filter-cloud {
      min-width: 0;
      padding: 9px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.72);
    }
    .filter-cloud-title {
      margin: 0 0 7px;
      color: var(--muted);
      font-size: 11px;
      font-weight: 700;
      line-height: 1.2;
      text-transform: uppercase;
    }
    .filter-tags {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .filter-tag {
      min-height: 26px;
      padding: 3px 8px;
      border: 1px solid #bdd0df;
      border-radius: 6px;
      color: #27445f;
      background: #f8fbfd;
      font: inherit;
      font-size: 12px;
      line-height: 1.2;
      cursor: pointer;
    }
    .filter-tag:hover {
      border-color: #8eb4d5;
      background: #edf5fb;
    }
    .filter-tag.active {
      border-color: var(--blue);
      color: #fff;
      background: var(--blue);
    }
    main {
      max-width: 1680px;
      margin: 0 auto;
      padding: 18px 20px 40px;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 14px;
      align-items: start;
    }
    .card {
      display: block;
      min-width: 0;
      overflow: hidden;
      color: inherit;
      text-decoration: none;
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 8px;
      box-shadow: 0 2px 10px rgba(20, 32, 44, 0.07);
      transition: transform 120ms ease, border-color 120ms ease, box-shadow 120ms ease;
    }
    .card:hover {
      transform: translateY(-2px);
      border-color: #8eb4d5;
      box-shadow: 0 8px 24px rgba(20, 32, 44, 0.13);
    }
    .thumb {
      display: block;
      width: 100%;
      aspect-ratio: 16 / 10;
      object-fit: cover;
      background: #dfe8ef;
      border-bottom: 1px solid var(--line);
    }
    .missing {
      display: grid;
      place-items: center;
      width: 100%;
      aspect-ratio: 16 / 10;
      color: var(--muted);
      background: repeating-linear-gradient(135deg, #dfe8ef, #dfe8ef 10px, #eef3f7 10px, #eef3f7 20px);
      border-bottom: 1px solid var(--line);
      font-size: 13px;
    }
    .body {
      padding: 10px 11px 12px;
    }
    .title {
      margin: 0 0 8px;
      font-size: 13px;
      line-height: 1.35;
      font-weight: 700;
    }
    .tags {
      display: flex;
      flex-wrap: wrap;
      gap: 5px;
      margin-bottom: 8px;
    }
    .tag {
      padding: 2px 6px;
      border-radius: 5px;
      color: #27445f;
      background: #e6eff7;
      font-size: 11px;
      line-height: 1.45;
    }
    .status {
      font-size: 12px;
      color: var(--muted);
    }
    .status.captured { color: var(--green); }
    .status.warning { color: var(--amber); }
    .status.failed { color: var(--red); }
    .filter-count {
      margin-top: 10px;
      color: var(--muted);
      font-size: 12px;
    }
    .errors {
      margin: 7px 0 0;
      padding-left: 16px;
      color: var(--red);
      font-size: 11px;
      line-height: 1.35;
    }
    .hidden { display: none !important; }
    @media (max-width: 860px) {
      .filter-clouds { grid-template-columns: 1fr 1fr; }
    }
    @media (max-width: 560px) {
      .filter-clouds { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <div id="ExampleLoaded" hidden></div>
  <header>
    <div class="bar">
      <h1>Render Path Tests</h1>
      <p class="description">A catalog of visual tests covering geometry and effect permutations across the WebGL and WebGPU rendering backends.</p>
      <div class="meta">
        <span class="pill">${payload.count} permutations</span>
        <span class="pill">${capturedCount} captured</span>
        <span class="pill">${warningCount} warnings</span>
        <span class="pill">${failedCount} failed</span>
        <span class="pill">${escapeHtml(payload.viewport.width)}x${escapeHtml(payload.viewport.height)}</span>
        <span class="pill">${escapeHtml(payload.generatedAt)}</span>
      </div>
      <div class="controls">
        <input id="q" type="search" placeholder="Filter by geometry, material, effect, hash, status">
        <div id="filterClouds" class="filter-clouds" aria-label="Filter render path tests by tag">
          <section class="filter-cloud" aria-labelledby="rendererFilterTitle">
            <h2 id="rendererFilterTitle" class="filter-cloud-title">Renderer</h2>
            <div class="filter-tags">${rendererTags}</div>
          </section>
          <section class="filter-cloud" aria-labelledby="geometryFilterTitle">
            <h2 id="geometryFilterTitle" class="filter-cloud-title">Geometry</h2>
            <div class="filter-tags">${geometryTags}</div>
          </section>
          <section class="filter-cloud" aria-labelledby="materialFilterTitle">
            <h2 id="materialFilterTitle" class="filter-cloud-title">Material</h2>
            <div class="filter-tags">${materialTags}</div>
          </section>
          <section class="filter-cloud" aria-labelledby="viewFilterTitle">
            <h2 id="viewFilterTitle" class="filter-cloud-title">View</h2>
            <div class="filter-tags">${viewTags}</div>
          </section>
        </div>
      </div>
      <div id="filterCount" class="filter-count">${payload.permutations.length} shown</div>
    </div>
  </header>
  <main>
    <div id="grid" class="grid">
      ${cards}
    </div>
  </main>
  <script>
    const queryInput = document.getElementById("q");
    const selectedTags = new Set();
    const cards = Array.from(document.querySelectorAll(".card"));
    const filterButtons = Array.from(document.querySelectorAll(".filter-tag"));
    function applyFilters() {
      const query = queryInput.value.trim().toLowerCase();
      let visibleCount = 0;
      for (const card of cards) {
        const haystack = card.dataset.search;
        const tags = (card.dataset.tags || "").split(" ");
        const tagMatch = selectedTags.size === 0 || [...selectedTags].every((tag) => tags.includes(tag));
        const visible =
          (!query || haystack.includes(query)) &&
          tagMatch;
        card.classList.toggle("hidden", !visible);
        if (visible) visibleCount++;
      }
      document.getElementById("filterCount").textContent = visibleCount + " shown";
    }
    queryInput.addEventListener("input", applyFilters);
    for (const button of filterButtons) {
      button.addEventListener("click", () => {
        const tag = button.dataset.tag;
        if (selectedTags.has(tag)) {
          selectedTags.delete(tag);
        } else {
          selectedTags.add(tag);
        }
        button.classList.toggle("active", selectedTags.has(tag));
        button.setAttribute("aria-pressed", selectedTags.has(tag) ? "true" : "false");
        applyFilters();
      });
    }
    applyFilters();
  </script>
</body>
</html>
`.replace(/[ \t]+$/gm, "");
}

function renderCard(item) {
  const filterDefinitions = [
    ...RENDERER_FILTER_TAGS,
    ...GEOMETRY_FILTER_TAGS,
    ...MATERIAL_FILTER_TAGS,
    ...VIEW_FILTER_TAGS
  ];
  const tags = [...matchingFilterTagLabels(item, filterDefinitions), item.status];
  const searchTags = [
    item.title,
    ...tags,
    item.hash
  ];
  const img = item.status === "planned"
    ? `<div class="missing">not captured yet</div>`
    : `<img class="thumb" loading="lazy" src="${escapeHtml(item.screenshot)}" alt="${escapeHtml(item.title)}">`;
  const errors = item.errors.length > 0
    ? `<ul class="errors">${item.errors.map((error) => `<li>${escapeHtml(error)}</li>`).join("")}</ul>`
    : "";
  const filterTags = [
    ...matchingFilterTagIds(item, RENDERER_FILTER_TAGS),
    ...matchingFilterTagIds(item, GEOMETRY_FILTER_TAGS),
    ...matchingFilterTagIds(item, MATERIAL_FILTER_TAGS),
    ...matchingFilterTagIds(item, VIEW_FILTER_TAGS)
  ];
  return `<a class="card" href="${escapeHtml(item.exampleUrl)}" data-renderer="${escapeHtml(item.renderer)}" data-geometry="${escapeHtml(item.geometryId)}" data-material="${escapeHtml(item.materialId)}" data-view="${escapeHtml(item.viewId)}" data-tags="${escapeHtml(filterTags.join(" "))}" data-search="${escapeHtml(searchTags.join(" ").toLowerCase())}">
  ${img}
  <div class="body">
    <p class="title">${escapeHtml(item.title)}</p>
    <div class="tags">${tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}</div>
    <div class="status ${escapeHtml(item.status)}">${escapeHtml(item.status)}</div>
    ${errors}
  </div>
</a>`;
}

function filterTagButtons(items, definitions) {
  return definitions
    .filter((definition) => items.some((item) => definition.matches(item)))
    .map((definition) => `<button type="button" class="filter-tag" data-tag="${escapeHtml(definition.id)}" aria-pressed="false">${escapeHtml(definition.label)}</button>`)
    .join("");
}

function matchingFilterTagIds(item, definitions) {
  return definitions
    .filter((definition) => definition.matches(item))
    .map((definition) => definition.id);
}

function matchingFilterTagLabels(item, definitions) {
  return definitions
    .filter((definition) => definition.matches(item))
    .map((definition) => definition.label);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  prepareOutput(args.outputDir);
  const permutations = buildPermutations(args);
  if (args.dryRun) {
    mergeExistingCaptureState(args.outputDir, permutations);
  }
  console.log(`${permutations.length} render-path permutations`);
  if (args.dryRun) {
    console.log("Dry run: writing gallery without screenshots.");
  }
  await capturePermutations(args, permutations);
  writeGallery(args, mergeSelectedIntoFullPermutations(args, permutations));
  console.log(`Gallery: ${path.join(args.outputDir, "index.html")}`);
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exitCode = 1;
});

function mergeExistingCaptureState(outputDir, permutations) {
  const existing = readExistingGalleryPayload(outputDir);
  const existingById = new Map(existing.permutations.map((item) => [item.id, item]));
  for (const permutation of permutations) {
    const prior = existingById.get(permutation.id);
    const screenshotPath = path.join(outputDir, permutation.screenshot);
    if (prior) {
      permutation.status = prior.status;
      permutation.errors = Array.isArray(prior.errors) ? prior.errors : [];
    }
    if (fs.existsSync(screenshotPath) && permutation.status === "planned") {
      permutation.status = "captured";
      permutation.errors = [];
    }
  }
}

function readExistingGalleryPayload(outputDir) {
  const filePath = path.join(outputDir, "permutations.json");
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return {permutations: []};
  }
}
