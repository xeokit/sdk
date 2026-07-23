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

const {Scene} = require("../../sdk/src/model/scene/Scene");
const {Data} = require("../../sdk/src/model/data/Data");
const {XKTLoader} = require("../../sdk/src/formats/legacy/xkt/XKTLoader");
const {XGFStreamExporter} = require("../../sdk/src/formats/xgfstream/XGFStreamExporter");

const rootDir = path.resolve(__dirname, "../../..");
const inputDir = path.join(rootDir, "Lyon");
const outDir = path.join(rootDir, "packages/website/models/Lyon/xgfstream");

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

  const scene = new Scene();
  const data = new Data();
  const sceneModel = must(scene.createModel({
    id: "Lyon",
    coordinateSystem: {
      basis: [1, 0, 0, 0, 1, 0, 0, 0, 1],
      origin: [-1842828.125, -227.6079330444336, 5174732.125],
      units: "meters",
      scaleToMeters: 1
    }
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
  console.log("Exporting XGF stream");

  const stream = await new XGFStreamExporter().write({
    sceneModel,
    dataModel
  }, {
    coordinateSystem: scene.coordinateSystem,
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
