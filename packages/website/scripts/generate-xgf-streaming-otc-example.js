// Generates the OTC Conference Center XGF streaming example from an existing
// XGF model.
//
// Demonstrates the split-xgf-streaming tooling path for turning one XGF file
// into a stream with grid chunking, optimization, and a runtime index.

const path = require("path");
const {spawnSync} = require("child_process");

const rootDir = path.resolve(__dirname, "../../..");
const input = path.join(rootDir, "packages/website/models/OTCConferenceCenter/xgf/model.xgf");
const out = path.join(rootDir, "packages/website/examples/formats_xgf_streaming_otc");

const result = spawnSync(process.execPath, [
  path.join(rootDir, "scripts/split-xgf-streaming.js"),
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
