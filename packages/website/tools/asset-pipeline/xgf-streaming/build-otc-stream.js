// Generates the OTC Conference Center XGF streaming example from an existing
// XGF model.
//
// Demonstrates the split-xgf-stream tooling path for turning one XGF file
// into a stream with grid chunking, optimization, and a runtime index.

const path = require("path");
const {spawnSync} = require("child_process");

const rootDir = path.resolve(__dirname, "..", "..", "..", "..", "..");
const input = path.join(rootDir, "packages/website/models/OTCConferenceCenter/xgf/model.xgf");
const out = path.join(rootDir, "packages/website/examples/streaming/xgf/otc");

const result = spawnSync(process.execPath, [
  path.join(rootDir, "packages/website/tools/asset-pipeline/xgf-streaming/split-xgf-stream.js"),
  "--input", input,
  "--out", out,
  "--clean",
  "--optimize",
  "--optimize-similar-geometries",
  "--chunk-size", "128",
  "--partition", "grid",
  "--coordinate-system", path.join(rootDir, "packages/website/models/OTCConferenceCenter/coordSys.json"),
  "--index", "chunks/index.json",
  "--runtime-index", "chunks/index.runtime.json",
  "--asset-id", "otc-assets",
  "--model-id", "OTCConferenceCenter"
], {
  cwd: rootDir,
  stdio: "inherit"
});

process.exit(result.status || 0);
