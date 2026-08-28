// Generates the Lyon XGF Stream dataset from several source XKT files.
//
// Demonstrates the in-process SDK path: load multiple XKT files into one
// SceneModel/DataModel, apply a coordinate system, then export one merged
// grid-partitioned XGF Stream directory.

const fs = require("fs");
const path = require("path");

process.env.TS_NODE_COMPILER_OPTIONS = JSON.stringify({
  module: "commonjs",
  moduleResolution: "node",
  verbatimModuleSyntax: false
});

require("ts-node/register/transpile-only");

const {sdkRequire} = require("../../lib/sdk-require");

const {Scene} = sdkRequire("model/scene/Scene");
const {Data} = sdkRequire("model/data/Data");
const {XKTLoader} = sdkRequire("formats/legacy/xkt/XKTLoader");
const {XGFStreamExporter} = sdkRequire("formats/xgfstream/XGFStreamExporter");

const rootDir = path.resolve(__dirname, "..", "..", "..", "..", "..");
const inputDir = path.join(rootDir, "Lyon");
const coordSysPath = path.join(rootDir, "packages/website/models/Lyon/coordSys.json");
const outDir = path.join(rootDir, "packages/website/models/Lyon/xgfstream");
const SDK_DEFAULT_COORDINATE_SYSTEM = {
  basis: [1, 0, 0, 0, 0, 1, 0, 1, 0],
  origin: [0, 0, 0],
  units: "meters",
  scaleToMeters: 1
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function main() {
  const inputFiles = fs.readdirSync(inputDir)
    .filter((file) => /^Lyon\d+\.xkt$/i.test(file))
    .sort((a, b) => Number(a.match(/\d+/)?.[0] || 0) - Number(b.match(/\d+/)?.[0] || 0));

  if (inputFiles.length === 0) {
    throw new Error(`No Lyon*.xkt files found in ${inputDir}`);
  }

  fs.rmSync(outDir, {recursive: true, force: true});
  fs.mkdirSync(outDir, {recursive: true});

  const coordinateSystem = JSON.parse(fs.readFileSync(coordSysPath, "utf8"));
  const scene = new Scene();
  const data = new Data();
  const sceneModel = must(scene.createModel({
    id: "Lyon",
    coordinateSystem
  }));
  const dataModel = must(data.createModel({id: "Lyon"}));
  const loader = new XKTLoader();

  for (const file of inputFiles) {
    const stem = path.basename(file, ".xkt");
    const filePath = path.join(inputDir, file);
    const buffer = fs.readFileSync(filePath);
    console.log(`Loading ${file}`);
    await loader.load({
      fileData: buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
      sceneModel,
      dataModel
    }, {
      idPrefix: stem,
      layerId: stem,
      yieldIntervalMs: 80
    });
  }

  console.log(`Loaded ${sceneModel.stats.numObjects.toLocaleString()} objects from ${inputFiles.length} XKT files`);
  applyLyonBuildingColors(sceneModel);
  console.log("Exporting XGF stream");

  const stream = await new XGFStreamExporter().write({
    sceneModel,
    dataModel
  }, {
    partition: "grid",
    chunkMetric: "meshes",
    chunkBudget: 2160,
    minChunkBudget: 720,
    gridCellSize: 340,
    index: "index.json",
    runtimeIndex: "index.runtime.json",
    collapseChunkObjects: true,
    assetId: "lyon-assets",
    assetLibraryChunkSize: 1,
    sharedAssetMinLibraryUses: 1000000,
    coordinateSystem: SDK_DEFAULT_COORDINATE_SYSTEM,
    yieldIntervalMs: 80
  });

  for (const [uri, data] of Object.entries(stream.files)) {
    const filePath = path.join(outDir, uri);
    fs.mkdirSync(path.dirname(filePath), {recursive: true});
    if (data instanceof ArrayBuffer) {
      fs.writeFileSync(filePath, Buffer.from(data));
    } else {
      fs.writeFileSync(filePath, `${JSON.stringify(data)}\n`, "utf8");
    }
  }

  console.log(`Generated ${Object.keys(stream.files).length} XGF streaming files in ${outDir}`);
}

function must(result) {
  if (!result || result.ok === false) {
    throw new Error(result?.error || "Operation failed");
  }
  return result.value;
}

const LYON_FACADE_COLORS = [
  [0.82, 0.72, 0.56],
  [0.88, 0.80, 0.64],
  [0.76, 0.67, 0.56],
  [0.90, 0.72, 0.55],
  [0.70, 0.61, 0.51],
  [0.80, 0.65, 0.50]
];

const LYON_ROOF_COLORS = [
  [0.62, 0.27, 0.17],
  [0.72, 0.34, 0.20],
  [0.52, 0.32, 0.25],
  [0.58, 0.39, 0.29],
  [0.44, 0.42, 0.38],
  [0.36, 0.40, 0.41]
];

const LYON_MASONRY_COLORS = [
  [0.58, 0.56, 0.50],
  [0.66, 0.62, 0.54],
  [0.52, 0.52, 0.47],
  [0.62, 0.58, 0.49],
  [0.48, 0.50, 0.46]
];

const LYON_GROUND_COLORS = [
  [0.50, 0.50, 0.45],
  [0.58, 0.55, 0.47],
  [0.65, 0.60, 0.50],
  [0.44, 0.47, 0.46],
  [0.70, 0.65, 0.54]
];

const LYON_PARK_COLORS = [
  [0.36, 0.55, 0.31],
  [0.44, 0.63, 0.36],
  [0.30, 0.48, 0.29],
  [0.54, 0.65, 0.36]
];

const LYON_WATER_COLORS = [
  [0.22, 0.48, 0.62],
  [0.28, 0.56, 0.70],
  [0.20, 0.42, 0.56]
];

function applyLyonBuildingColors(sceneModel) {
  const counts = {
    facade: 0,
    roof: 0,
    masonry: 0,
    ground: 0,
    park: 0,
    water: 0,
    enhanced: 0
  };

  for (const mesh of Object.values(sceneModel.meshes)) {
    const sourceColor = Array.from(mesh.color);
    const seed = hashString(mesh.object?.id || mesh.id);
    const targetColor = classifyLyonColor(sourceColor, seed, counts);
    if (targetColor) {
      mesh.color = targetColor;
    }
  }

  console.log(
    `Applied Lyon color palette: ` +
    `${counts.facade.toLocaleString()} facade, ` +
    `${counts.roof.toLocaleString()} roof, ` +
    `${counts.masonry.toLocaleString()} masonry, ` +
    `${counts.ground.toLocaleString()} ground, ` +
    `${counts.park.toLocaleString()} park, ` +
    `${counts.water.toLocaleString()} water, ` +
    `${counts.enhanced.toLocaleString()} enhanced`
  );
}

function classifyLyonColor(color, seed, counts) {
  const [r, g, b] = color;
  if (r > 0.64 && r < 0.76 && Math.abs(r - g) < 0.04 && Math.abs(g - b) < 0.04) {
    counts.ground++;
    return varyColor(pickPaletteColor(LYON_GROUND_COLORS, seed), seed);
  }
  if (g > r && g > b && r > 0.6 && b > 0.5) {
    counts.park++;
    return varyColor(pickPaletteColor(LYON_PARK_COLORS, seed), seed);
  }
  if (b > r && b > g && r > 0.55 && g > 0.55) {
    counts.water++;
    return varyColor(pickPaletteColor(LYON_WATER_COLORS, seed), seed);
  }
  if (r > 0.9 && g > 0.85 && b > 0.9) {
    counts.facade++;
    return varyColor(pickPaletteColor(LYON_FACADE_COLORS, seed), seed);
  }
  if (r > 0.55 && g < 0.5 && b < 0.5) {
    counts.roof++;
    return varyColor(pickPaletteColor(LYON_ROOF_COLORS, seed), seed);
  }
  if (Math.abs(r - g) < 0.08 && Math.abs(g - b) < 0.08 && r < 0.75) {
    counts.masonry++;
    return varyColor(pickPaletteColor(LYON_MASONRY_COLORS, seed), seed);
  }
  counts.enhanced++;
  return enhanceColor(color);
}

function pickPaletteColor(palette, seed) {
  return palette[seed % palette.length];
}

function varyColor(color, seed) {
  const factor = 0.96 + ((seed >>> 8) % 15) / 100;
  return color.map((component) => clamp(component * factor, 0.10, 0.96));
}

function enhanceColor(color) {
  const average = (color[0] + color[1] + color[2]) / 3;
  return color.map((component) => clamp(average + (component - average) * 1.2 + 0.08, 0.10, 0.94));
}

function hashString(value) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
