// Generates a lower-chunk-count Baku Stadium XGF Stream dataset.
//
// This v2 dataset keeps the original source model, but targets roughly 100
// spatial chunks for lower streaming/index overhead than the default Baku
// stream used by the website example.

const path = require("path");
const {spawnSync} = require("child_process");

const rootDir = path.resolve(__dirname, "..", "..", "..", "..", "..");
const input = path.join(rootDir, "baku.glb");
const out = path.join(rootDir, "packages/website/models/BakuStadium_xgfstream_200/xgfstream");

const result = spawnSync(process.execPath, [
  path.join(rootDir, "packages/website/tools/asset-pipeline/xgf-streaming/split-xgf-stream.js"),
  "--input", input,
  "--out", out,
  "--clean",
  "--coordinate-system", path.join(rootDir, "packages/website/models/BakuStadium_xgfstream_200/coordSys.json"),
  "--output-coordinate-system", "sdk-default",
  "--chunk-size", "256",
  "--partition", "grid",
  "--chunk-metric", "meshes",
  "--chunk-budget", "10120",
  "--min-chunk-budget", "2530",
  "--grid-cell-size", "60",
  "--index", "index.json",
  "--runtime-index", "index.runtime.json",
  "--asset-id", "baku-v2-assets",
  "--asset-library-chunk-size", "16",
  "--model-id", "BakuStadium_xgfstream_200"
], {
  cwd: rootDir,
  stdio: "inherit"
});

process.exit(result.status || 0);
