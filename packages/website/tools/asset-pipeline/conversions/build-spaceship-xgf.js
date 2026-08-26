const fs = require("fs");
const path = require("path");
const {pathToFileURL} = require("url");

process.env.TS_NODE_COMPILER_OPTIONS = JSON.stringify({
  module: "commonjs",
  moduleResolution: "node",
  verbatimModuleSyntax: false
});

require("ts-node/register/transpile-only");

const {sdkRequire} = require("../../lib/sdk-require");

const {Scene} = sdkRequire("model/scene/Scene");
const {Data} = sdkRequire("model/data/Data");
const {GLTFLoader} = sdkRequire("formats/gltf/GLTFLoader");
const {XGFExporter} = sdkRequire("formats/xgf/XGFExporter");
const {getMeshWorldMatrix} = sdkRequire("model/scene/getMeshWorldMatrix");

const rootDir = path.resolve(__dirname, "..", "..", "..", "..", "..");
const defaultInput = "/home/lindsay/Downloads/space_ship.glb";
const defaultOutputDir = path.join(rootDir, "packages/website/models/SpaceShip");

const SOURCE_COORDINATE_SYSTEM = {
  basis: [1, 0, 0, 0, 1, 0, 0, 0, 1],
  origin: [0, 0, 0],
  units: "meters",
  scaleToMeters: 1
};

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const input = path.resolve(args.input || defaultInput);
  const outputDir = path.resolve(args.outputDir || defaultOutputDir);
  const modelId = args.modelId || path.basename(outputDir);
  const xgfPath = path.join(outputDir, "xgf/model.xgf");
  const coordSysPath = path.join(outputDir, "coordSys.json");
  const statsPath = path.join(outputDir, "xgf/model-info.json");

  if (!fs.existsSync(input)) {
    throw new Error(`Input GLB not found: ${input}`);
  }

  fs.mkdirSync(path.dirname(xgfPath), {recursive: true});

  const scene = new Scene();
  const data = new Data();
  const sceneModel = must(scene.createModel({
    id: modelId,
    coordinateSystem: SOURCE_COORDINATE_SYSTEM,
    updateHint: "static"
  }));
  const dataModel = must(data.createModel({id: modelId}));

  const buffer = fs.readFileSync(input);
  await new GLTFLoader().load({
    fileData: bufferToArrayBuffer(buffer),
    sceneModel,
    dataModel
  }, {
    baseUri: pathToFileURL(path.dirname(input) + path.sep).href,
    layerId: modelId,
    yieldIntervalMs: 80
  });

  const fileData = await new XGFExporter().write({sceneModel}, {
    yieldIntervalMs: 80
  });
  fs.writeFileSync(xgfPath, Buffer.from(fileData));
  fs.writeFileSync(coordSysPath, `${JSON.stringify(SOURCE_COORDINATE_SYSTEM, null, 2)}\n`);

  const stats = collectStats(sceneModel);
  stats.source = input;
  stats.output = xgfPath;
  fs.writeFileSync(statsPath, `${JSON.stringify(stats, null, 2)}\n`);

  console.log(`Wrote ${path.relative(rootDir, xgfPath)}`);
  console.log(`Meshes: ${stats.meshes}, geometries: ${stats.geometries}, triangles: ${stats.triangles}`);
  console.log(`AABB: ${stats.aabb.map((value) => value.toFixed(3)).join(", ")}`);
  console.log(`Size: ${stats.size.map((value) => value.toFixed(3)).join(" x ")}`);
}

function collectStats(sceneModel) {
  const aabb = computeSceneModelAABB(sceneModel);
  let triangles = 0;
  for (const geometry of Object.values(sceneModel.geometries)) {
    triangles += geometry.indices ? Math.floor(geometry.indices.length / 3) : 0;
  }
  return {
    meshes: Object.keys(sceneModel.meshes).length,
    geometries: Object.keys(sceneModel.geometries).length,
    materials: Object.keys(sceneModel.materials).length,
    objects: Object.keys(sceneModel.objects).length,
    triangles,
    aabb,
    center: [
      (aabb[0] + aabb[3]) * 0.5,
      (aabb[1] + aabb[4]) * 0.5,
      (aabb[2] + aabb[5]) * 0.5
    ],
    size: [
      aabb[3] - aabb[0],
      aabb[4] - aabb[1],
      aabb[5] - aabb[2]
    ]
  };
}

function computeSceneModelAABB(sceneModel) {
  let result = null;
  for (const mesh of Object.values(sceneModel.meshes)) {
    if (!mesh.geometry || !mesh.geometry.aabb) {
      continue;
    }
    const matrix = getMeshWorldMatrix(mesh, SOURCE_COORDINATE_SYSTEM);
    const transformed = transformAABB(mesh.geometry.aabb, matrix);
    result = result ? unionAABB(result, transformed) : transformed;
  }
  return result || [0, 0, 0, 0, 0, 0];
}

function transformAABB(aabb, matrix) {
  const result = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
  for (const x of [aabb[0], aabb[3]]) {
    for (const y of [aabb[1], aabb[4]]) {
      for (const z of [aabb[2], aabb[5]]) {
        expandAABB(result, transformPoint(matrix, x, y, z));
      }
    }
  }
  return result;
}

function transformPoint(matrix, x, y, z) {
  return [
    matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12],
    matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13],
    matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14]
  ];
}

function expandAABB(aabb, point) {
  aabb[0] = Math.min(aabb[0], point[0]);
  aabb[1] = Math.min(aabb[1], point[1]);
  aabb[2] = Math.min(aabb[2], point[2]);
  aabb[3] = Math.max(aabb[3], point[0]);
  aabb[4] = Math.max(aabb[4], point[1]);
  aabb[5] = Math.max(aabb[5], point[2]);
}

function unionAABB(a, b) {
  return [
    Math.min(a[0], b[0]),
    Math.min(a[1], b[1]),
    Math.min(a[2], b[2]),
    Math.max(a[3], b[3]),
    Math.max(a[4], b[4]),
    Math.max(a[5], b[5])
  ];
}

function bufferToArrayBuffer(buffer) {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}

function parseArgs(args) {
  const result = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--input") {
      result.input = args[++i];
    } else if (arg === "--outputDir") {
      result.outputDir = args[++i];
    } else if (arg === "--modelId") {
      result.modelId = args[++i];
    }
  }
  return result;
}

function must(result) {
  if (!result || result.ok === false) {
    throw new Error(result && result.error ? result.error : "Unexpected SDK failure");
  }
  return result.value;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
