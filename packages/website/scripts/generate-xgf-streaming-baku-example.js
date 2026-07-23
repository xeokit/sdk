// Generates the Baku Stadium XGF Stream dataset used by the website example.
//
// Demonstrates the xeoconvert CLI path: convert a source GLB directly to an
// XGF Stream directory with grid chunking, runtime index generation, and a
// model coordinate system.

const path = require("path");
const fs = require("fs");
const {spawnSync} = require("child_process");

const rootDir = path.resolve(__dirname, "../../..");
const input = path.join(rootDir, "baku.glb");
const out = path.join(rootDir, "packages/website/models/BakuStadium/xgfstream");
const xeoconvert = path.join(rootDir, "packages/sdk/dist/xeoconvert/xeoconvert.js");

if (!fs.existsSync(xeoconvert)) {
  console.error(`xeoconvert CLI not found at ${xeoconvert}`);
  console.error("Build it first with: cd packages/sdk && node scripts/build-cli-tools.js");
  process.exit(1);
}

fs.rmSync(out, {recursive: true, force: true});

const result = spawnSync(process.execPath, [
  xeoconvert,
  "--in", input,
  "--out", out,
  "--exporter", "xgfstream",
  "--model-id", "BakuStadium",
  "--coordinate-system", path.join(rootDir, "packages/website/models/BakuStadium/coordSys.json"),
  "--xgfstream-chunk-size", "256",
  "--xgfstream-partition", "grid",
  "--xgfstream-chunk-metric", "meshes",
  "--xgfstream-chunk-budget", "512",
  "--xgfstream-min-chunk-budget", "128",
  "--xgfstream-grid-cell-size", "15",
  "--xgfstream-index", "index.json",
  "--xgfstream-runtime-index", "index.runtime.json",
  "--xgfstream-asset-id", "baku-assets",
  "--xgfstream-asset-library-chunk-size", "16"
], {
  cwd: rootDir,
  stdio: "inherit"
});

process.exit(result.status || 0);
