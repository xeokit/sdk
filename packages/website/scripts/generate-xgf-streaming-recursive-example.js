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

const {writeXGFStreamingRuntimeIndex} = require("../../sdk/src/formats/xgfstream/index/writeXGFStreamingRuntimeIndex");

const rootDir = path.resolve(__dirname, "../../..");
const modelsDir = path.join(rootDir, "packages/website/models");
const outDir = path.join(modelsDir, "RecursiveStream/xgfstream");

const STREAMS = [
  {id: "archipelago", model: "Archipelago", title: "Archipelago", origin: [0, 0, 0]},
  {id: "bakuStadium", model: "BakuStadium", title: "Baku Stadium", origin: [0, 0, 0]},
  {id: "lyon", model: "Lyon", title: "Lyon", origin: [15000, 0, 0]}
];

main();

function main() {
  fs.mkdirSync(outDir, {recursive: true});

  const streams = STREAMS.map((stream, priority) => {
    const runtimePath = path.join(modelsDir, stream.model, "xgfstream/index.runtime.json");
    const runtimeIndex = JSON.parse(fs.readFileSync(runtimePath, "utf8"));
    if (!Array.isArray(runtimeIndex.aabb) || runtimeIndex.aabb.length !== 6) {
      throw new Error(`Missing aggregate AABB in ${runtimePath}`);
    }
    return {
      id: stream.id,
      uri: `../../${stream.model}/xgfstream/index.runtime.json`,
      aabb: runtimeIndex.aabb,
      origin: stream.origin,
      priority,
      metadata: {
        title: stream.title,
        model: stream.model,
        chunkCount: Array.isArray(runtimeIndex.chunks) ? runtimeIndex.chunks.length : 0
      }
    };
  });

  const index = {
    format: "XGFStreamingIndex",
    indexVersion: "1.1.0",
    chunks: [],
    streams,
    aabb: unionAABB(streams.map((stream) => translateAABB(stream.aabb, stream.origin))),
    metadata: {
      title: "Recursive XGF Stream",
      description: "Root XGF stream index that lazily references all website model xgfstream datasets."
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

function unionAABB(aabbs) {
  const result = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
  for (const aabb of aabbs) {
    result[0] = Math.min(result[0], aabb[0]);
    result[1] = Math.min(result[1], aabb[1]);
    result[2] = Math.min(result[2], aabb[2]);
    result[3] = Math.max(result[3], aabb[3]);
    result[4] = Math.max(result[4], aabb[4]);
    result[5] = Math.max(result[5], aabb[5]);
  }
  return result;
}
