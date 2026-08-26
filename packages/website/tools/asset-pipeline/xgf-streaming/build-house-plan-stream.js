// Generates the HousePlan XGF stream dataset under models.

const path = require("path");
const {spawnSync} = require("child_process");

const rootDir = path.resolve(__dirname, "..", "..", "..", "..", "..");
const input = path.join(rootDir, "packages/website/models/HousePlan/xgf/model.xgf");
const out = path.join(rootDir, "packages/website/models/HousePlan/xgfstream");

const result = spawnSync(process.execPath, [
  path.join(rootDir, "packages/website/tools/asset-pipeline/xgf-streaming/split-xgf-stream.js"),
  "--input", input,
  "--out", out,
  "--clean",
  "--optimize",
  "--optimize-similar-geometries",
  "--chunk-size", "128",
  "--partition", "grid",
  "--coordinate-system", path.join(rootDir, "packages/website/models/HousePlan/coordSys.json"),
  "--output-coordinate-system", "sdk-default",
  "--index", "index.json",
  "--runtime-index", "index.runtime.json",
  "--asset-id", "house-plan-assets",
  "--model-id", "HousePlan"
], {
  cwd: rootDir,
  stdio: "inherit"
});

process.exit(result.status || 0);
