// Generates the Baku Stadium XGF Stream dataset used by the website example.
//
// Demonstrates the xeoconvert CLI path: convert a source GLB directly to an
// XGF Stream directory with grid chunking, runtime index generation, and a
// model coordinate system.

const path = require("path");
const {spawnSync} = require("child_process");

const rootDir = path.resolve(__dirname, "../../..");
const input = path.join(rootDir, "baku.glb");
const out = path.join(rootDir, "packages/website/models/BakuStadium/xgfstream");

const result = spawnSync(process.execPath, [
  path.join(rootDir, "scripts/split-xgf-streaming.js"),
  "--input", input,
  "--out", out,
  "--clean",
  "--coordinate-system", path.join(rootDir, "packages/website/models/BakuStadium/coordSys.json"),
  "--output-coordinate-system", "sdk-default",
  "--chunk-size", "256",
  "--partition", "grid",
  "--chunk-metric", "meshes",
  "--chunk-budget", "512",
  "--min-chunk-budget", "128",
  "--grid-cell-size", "15",
  "--index", "index.json",
  "--runtime-index", "index.runtime.json",
  "--asset-id", "baku-assets",
  "--asset-library-chunk-size", "16",
  "--model-id", "BakuStadium"
], {
  cwd: rootDir,
  stdio: "inherit"
});

process.exit(result.status || 0);
