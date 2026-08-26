// Generates a high-chunk-count Baku Stadium XGF Stream dataset.
//
// This dataset keeps the original source model, but targets roughly 4000
// runtime chunks for stressing fine-grained XGF streaming behavior.

const path = require("path");
const {spawnSync} = require("child_process");

const rootDir = path.resolve(__dirname, "..", "..", "..", "..", "..");
const input = path.join(rootDir, "baku.glb");
const out = path.join(rootDir, "packages/website/models/BakuStadium_xgfstream_4000/xgfstream");

const result = spawnSync(process.execPath, [
  path.join(rootDir, "packages/website/tools/asset-pipeline/xgf-streaming/split-xgf-stream.js"),
  "--input", input,
  "--out", out,
  "--clean",
  "--coordinate-system", path.join(rootDir, "packages/website/models/BakuStadium_xgfstream_4000/coordSys.json"),
  "--output-coordinate-system", "sdk-default",
  "--chunk-size", "256",
  "--partition", "grid",
  "--chunk-metric", "meshes",
  "--chunk-budget", "265",
  "--min-chunk-budget", "66",
  "--grid-cell-size", "15",
  "--index", "index.json",
  "--runtime-index", "index.runtime.json",
  "--asset-id", "baku-4k-assets",
  "--asset-library-chunk-size", "16",
  "--shared-asset-mode", "sharded",
  "--shared-asset-shard-size", "1024",
  "--model-id", "BakuStadium_xgfstream_4000"
], {
  cwd: rootDir,
  stdio: "inherit"
});

process.exit(result.status || 0);
