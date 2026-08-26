// Generates a recursive XGF Stream root that references existing stream
// datasets without copying their chunks.
//
// Demonstrates stream composition: the root index contains child stream entries,
// optional per-stream origins, aggregate bounds, and a compact runtime index.

const fs = require("fs");
const path = require("path");

process.env.TS_NODE_COMPILER_OPTIONS = JSON.stringify({
  module: "commonjs",
  moduleResolution: "node",
  verbatimModuleSyntax: false
});

require("ts-node/register/transpile-only");

const {sdkRequire} = require("../../lib/sdk-require");

const {writeXGFStreamingRuntimeIndex} = sdkRequire("formats/xgfstream/index/writeXGFStreamingRuntimeIndex");
const {readXGFStreamingRuntimeIndex} = sdkRequire("formats/xgfstream/index/readXGFStreamingRuntimeIndex");
const {createCoordinateSystemTransform} = sdkRequire("model/scene/createCoordinateSystemTransform");
const {createMat4Float64, transformPoint3} = sdkRequire("base/math/matrix");

const rootDir = path.resolve(__dirname, "..", "..", "..", "..", "..");
const modelsDir = path.join(rootDir, "packages/website/models");
const outDir = path.join(modelsDir, "RecursiveStream/xgfstream");

const ROOT_COORDINATE_SYSTEM = {
  basis: [1, 0, 0, 0, 0, 1, 0, 1, 0],
  origin: [0, 0, 0],
  units: "meters",
  scaleToMeters: 1
};

const STREAMS = [
  {id: "map", model: "MAP", title: "MAP", origin: [0, 0, 0]},
  {id: "bakuStadium", model: "BakuStadium_xgfstream_2000", title: "Baku Stadium", origin: [0, 0, 0]},
  {id: "lyon", model: "Lyon", title: "Lyon", origin: [15000, 0, 0]},
  {id: "otcConferenceCenter", model: "OTCConferenceCenter", title: "OTC Conference Center", origin: [0, -1200, 0]},
  {id: "housePlan", model: "HousePlan", title: "HousePlan", origin: [0, 1200, 0]}
];

main();

function main() {
  fs.mkdirSync(outDir, {recursive: true});

  const streams = STREAMS.map((stream, priority) => {
    const runtimePath = path.join(modelsDir, stream.model, "xgfstream/index.runtime.json");
    const runtimeIndex = JSON.parse(fs.readFileSync(runtimePath, "utf8"));
    const readResult = readXGFStreamingRuntimeIndex(runtimeIndex);
    if (readResult.ok === false) {
      throw new Error(readResult.error);
    }
    const chunks = readResult.value.chunks || [];
    const localAABB = readResult.value.aabb;
    if (!isAABB(localAABB)) {
      throw new Error(`Missing aggregate AABB in ${runtimePath}`);
    }
    const aabb = translateAABB(
      transformAABBToRoot(localAABB, readResult.value.coordinateSystem),
      stream.origin
    );
    return {
      id: stream.id,
      uri: `../../${stream.model}/xgfstream/index.runtime.json`,
      aabb,
      origin: stream.origin,
      priority,
      metadata: {
        title: stream.title,
        model: stream.model,
        chunkCount: chunks.length
      }
    };
  });

  const index = {
    format: "XGFStreamingIndex",
    indexVersion: "1.2.0",
    chunks: [],
    streams,
    coordinateSystem: ROOT_COORDINATE_SYSTEM,
    aabb: unionAABB(streams.map((stream) => stream.aabb)),
    metadata: {
      title: "Recursive XGF Stream",
      description: "Root XGF stream index that lazily references MAP, Baku Stadium, Lyon, OTC Conference Center, and HousePlan child streams."
    }
  };

  fs.writeFileSync(path.join(outDir, "index.json"), `${JSON.stringify(index, null, 2)}\n`, "utf8");
  fs.writeFileSync(path.join(outDir, "index.runtime.json"), `${JSON.stringify(writeXGFStreamingRuntimeIndex(index))}\n`, "utf8");
  console.log(`Generated recursive XGF stream with ${streams.length} child streams in ${outDir}`);
}

function translateAABB(aabb, origin) {
  return [
    aabb[0] + origin[0],
    aabb[1] + origin[1],
    aabb[2] + origin[2],
    aabb[3] + origin[0],
    aabb[4] + origin[1],
    aabb[5] + origin[2]
  ];
}

function transformAABBToRoot(aabb, coordinateSystem) {
  const matrix = coordinateSystem
    ? createCoordinateSystemTransform(coordinateSystem, ROOT_COORDINATE_SYSTEM, createMat4Float64())
    : undefined;
  if (!matrix) {
    return aabb.slice();
  }
  const result = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
  for (const x of [aabb[0], aabb[3]]) {
    for (const y of [aabb[1], aabb[4]]) {
      for (const z of [aabb[2], aabb[5]]) {
        const point = transformPoint3(matrix, [x, y, z]);
        result[0] = Math.min(result[0], point[0]);
        result[1] = Math.min(result[1], point[1]);
        result[2] = Math.min(result[2], point[2]);
        result[3] = Math.max(result[3], point[0]);
        result[4] = Math.max(result[4], point[1]);
        result[5] = Math.max(result[5], point[2]);
      }
    }
  }
  return result;
}

function isAABB(aabb) {
  return Array.isArray(aabb) && aabb.length === 6;
}

function unionAABB(aabbs) {
  const validAABBs = aabbs.filter(isAABB);
  if (validAABBs.length === 0) {
    return undefined;
  }
  const result = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
  for (const aabb of validAABBs) {
    result[0] = Math.min(result[0], aabb[0]);
    result[1] = Math.min(result[1], aabb[1]);
    result[2] = Math.min(result[2], aabb[2]);
    result[3] = Math.max(result[3], aabb[3]);
    result[4] = Math.max(result[4], aabb[4]);
    result[5] = Math.max(result[5], aabb[5]);
  }
  return result;
}
