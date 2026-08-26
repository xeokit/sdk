// Generates the OTC Conference Center XGF stream dataset under models.

const path = require("path");
const {spawnSync} = require("child_process");

const rootDir = path.resolve(__dirname, "..", "..", "..", "..", "..");
const input = path.join(rootDir, "packages/website/models/OTCConferenceCenter/xgf/model.xgf");
const out = path.join(rootDir, "packages/website/models/OTCConferenceCenter/xgfstream");

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
  "--output-coordinate-system", "sdk-default",
  "--index", "index.json",
  "--runtime-index", "index.runtime.json",
  "--asset-id", "otc-assets",
  "--model-id", "OTCConferenceCenter"
], {
  cwd: rootDir,
  stdio: "inherit"
});

process.exit(result.status || 0);
