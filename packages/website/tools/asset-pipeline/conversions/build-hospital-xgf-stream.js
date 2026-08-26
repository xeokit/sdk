#!/usr/bin/env node

"use strict";

const path = require("path");
const {spawnSync} = require("child_process");

const rootDir = path.resolve(__dirname, "..", "..", "..", "..", "..");
const modelDir = path.join(rootDir, "packages/website/models/WestRiverSideHospital");
const input = path.join(modelDir, "xgf/model.xgf");
const out = path.join(modelDir, "xgfstream");
const coordSys = path.join(modelDir, "coordSys.json");

// Geometry-byte chunks keep the static VBO uploads reasonably even; this target
// currently produces 100 references-only chunks for the hospital model.
const args = [
    path.join(rootDir, "packages/website/tools/asset-pipeline/xgf-streaming/split-xgf-stream.js"),
    "--input", input,
    "--out", out,
    "--clean",
    "--coordinate-system", coordSys,
    "--output-coordinate-system", coordSys,
    "--partition", "grid",
    "--chunk-metric", "geometry-bytes",
    "--chunk-budget", "1258000",
    "--min-chunk-budget", "503200",
    "--grid-cell-size", "32",
    "--index", "index.json",
    "--runtime-index", "index.runtime.json",
    "--asset-id", "hospital-static-assets",
    "--asset-library-chunk-size", "8",
    "--shared-asset-mode", "sharded",
    "--shared-asset-shard-size", "768",
    "--model-id", "WestRiverSideHospital"
];

const result = spawnSync(process.execPath, args, {
    cwd: rootDir,
    stdio: "inherit"
});

process.exit(result.status || 0);
