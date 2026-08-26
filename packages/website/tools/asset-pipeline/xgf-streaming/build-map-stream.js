// Generates the MAP XGF Stream dataset from the existing MAP XGF model.

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
const {XGFLoader} = sdkRequire("formats/xgf/XGFLoader");
const {XGFStreamExporter} = sdkRequire("formats/xgfstream/XGFStreamExporter");

const rootDir = path.resolve(__dirname, "..", "..", "..", "..", "..");
const modelDir = path.join(rootDir, "packages/website/models/MAP");
const sourcePath = path.join(modelDir, "xgf/model.xgf");
const coordSysPath = path.join(modelDir, "coordSys.json");
const outDir = path.join(modelDir, "xgfstream");
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
  fs.rmSync(outDir, {recursive: true, force: true});
  fs.mkdirSync(outDir, {recursive: true});

  const coordinateSystem = JSON.parse(fs.readFileSync(coordSysPath, "utf8"));
  const scene = new Scene();
  const data = new Data();
  const sceneModel = must(scene.createModel({
    id: "MAP",
    coordinateSystem
  }));
  const dataModel = must(data.createModel({id: "MAP"}));

  const source = fs.readFileSync(sourcePath);
  await new XGFLoader().load({
    fileData: source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength),
    sceneModel,
    dataModel
  }, {
    yieldIntervalMs: 80
  });

  console.log(`Loaded ${sceneModel.stats.numObjects.toLocaleString()} MAP objects`);
  console.log("Exporting MAP XGF stream");
  const stream = await new XGFStreamExporter().write({
    sceneModel,
    dataModel
  }, {
    partition: "grid",
    chunkMetric: "meshes",
    chunkBudget: 256,
    minChunkBudget: 64,
    gridCellSize: 20,
    index: "index.json",
    runtimeIndex: "index.runtime.json",
    assetId: "map-assets",
    assetLibraryChunkSize: 16,
    sharedAssetMinLibraryUses: 1000000,
    coordinateSystem: SDK_DEFAULT_COORDINATE_SYSTEM,
    yieldIntervalMs: 80
  });

  for (const [uri, fileData] of Object.entries(stream.files)) {
    const filePath = path.join(outDir, uri);
    fs.mkdirSync(path.dirname(filePath), {recursive: true});
    if (fileData instanceof ArrayBuffer) {
      fs.writeFileSync(filePath, Buffer.from(fileData));
    } else {
      fs.writeFileSync(filePath, `${JSON.stringify(fileData)}\n`, "utf8");
    }
  }

  console.log(`Generated ${Object.keys(stream.files).length} MAP XGF streaming files in ${outDir}`);
}

function must(result) {
  if (!result || result.ok === false) {
    throw new Error(result?.error || "Unexpected SDK failure");
  }
  return result.value;
}
