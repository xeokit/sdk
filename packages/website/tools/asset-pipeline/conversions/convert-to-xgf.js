#!/usr/bin/env node
//
// Walks packages/website/models and, for every model that has a convertible
// source format, (re)generates its native XGF at <Model>/xgf/model.xgf,
// overwriting any pre-existing XGF. The conversion is run with optimization
// (xeoconvert --inspect-fix), and two reports are written alongside the XGF:
//   - model.report.json      what the optimizer fixed / skipped
//   - model.conversion.json  conversion fidelity (what the XGF export dropped)
// A top-level models/convert-to-xgf-report.json summarises every model.
//
// model.xgf IS the optimized artifact (the conversion runs --inspect-fix), so
// any separate model.optimized.xgf is dropped. After conversion, the model
// index generator regenerates index.json,
// regenerates index.json, wiring the "xgf" dataset to model.xgf in the Import
// Sample Model dialog.
//
// For each model the source is picked from the priority list below — the first
// format that exists AND converts to a non-empty SceneModel headlessly wins
// (we fall through on load failure, e.g. browser-only texture decode). A model
// with no convertible source, or whose only geometry is already XGF, is
// skipped and left untouched.
//
// Run from anywhere:
//   node packages/website/tools/asset-pipeline/conversions/convert-to-xgf.js
//
// Requires the xeoconvert CLI to be built (in packages/sdk):
//   node scripts/build-cli-tools.js
//

const fs = require("fs");
const path = require("path");
const {execFileSync} = require("child_process");

const REPO_DIR = path.resolve(__dirname, "..", "..", "..", "..", "..");
const MODELS_DIR = path.join(REPO_DIR, "packages", "website", "models");
const XEOCONVERT = path.join(REPO_DIR, "packages", "sdk", "dist", "xeoconvert", "xeoconvert.js");
const BUILD_INDEX = path.join(REPO_DIR, "packages", "website", "tools", "asset-pipeline", "catalog", "build-model-index.js");
const SUMMARY_FILE = path.join(MODELS_DIR, "convert-to-xgf-report.json");
const POLYFILLS = path.join(__dirname, "convert-polyfills.cjs");

// Node flags for each spawned xeoconvert: a roomy heap for large IFC/glTF
// models, and a DOMParser polyfill so the XML-based loaders (3DXML, E57) work
// headlessly.
const NODE_FLAGS = ["--max-old-space-size=16384", "--require", POLYFILLS];

// Source formats that can be loaded into a SceneModel and re-exported as XGF,
// in descending order of preference. Each entry maps to <Model>/<dir>/<file>.
// `loader` is forced only where the extension is ambiguous (.json). XGF itself
// is intentionally absent: a model whose only geometry is already XGF has
// nothing to convert from. Data-only formats (datamodel / metamodel) carry no
// geometry and are not sources.
const SOURCES = [
  {dir: "ifc",        file: "model.ifc"},
  {dir: "gltf",       file: "model.glb"},
  {dir: "gltf",       file: "model.gltf"},
  {dir: "dotbim",     file: "model.bim"},
  {dir: "fbx",        file: "model.fbx"},
  {dir: "obj",        file: "model.obj"},
  {dir: "usdz",       file: "model.usdz"},
  {dir: "threedxml",  file: "model.3dxml"},
  {dir: "cityjson",   file: "model.json", loader: "cityjson"},
  {dir: "splat",      file: "model.splat"},
  {dir: "scenemodel", file: "model.json", loader: "scenemodel"},
  {dir: "xkt",        file: "model.xkt"},
  {dir: "e57",        file: "model.e57"},
  {dir: "las",        file: "model.las"},
  {dir: "laz",        file: "model.laz"},
];

function rel(p) {
  return path.relative(MODELS_DIR, p);
}

/**
 * The most informative line from a child process's stderr: skips Node's
 * deprecation/experimental warning noise, and prefers a recognisable fatal
 * line (out-of-memory crashes, thrown Errors) over a bare stack frame.
 */
function meaningfulStderr(stderr) {
  const lines = String(stderr || "").split("\n").map((l) => l.trim()).filter(Boolean);
  const isNoise = (l) => /DeprecationWarning|^\(node:\d+\)|--trace-deprecation|ExperimentalWarning/.test(l);
  const fatal = lines.find((l) => /FATAL ERROR|out of memory|heap limit|Error:/.test(l) && !isNoise(l));
  if (fatal) return fatal;
  const meaningful = lines.filter((l) => !isNoise(l));
  return meaningful.length ? meaningful[meaningful.length - 1] : "";
}

/**
 * Convert one source file to XGF at `out`, with optimization. Writes the two
 * sidecar reports and a temp stats report. Returns a result describing whether
 * the conversion produced a non-empty model, parsed from the stats report (the
 * CLI exits non-zero even on success, so output content — not exit code — is
 * the signal).
 */
function convertOne(source, out, optimizationReport, conversionReport) {
  const stats = out + ".stats.json";
  for (const stale of [out, optimizationReport, conversionReport, stats]) {
    if (fs.existsSync(stale)) fs.rmSync(stale);
  }

  let stderr = "";
  try {
    execFileSync("node", [
      ...NODE_FLAGS,
      XEOCONVERT,
      "--in", source.path,
      "--out", out,
      "--exporter", "xgf",
      ...(source.loader ? ["--loader", source.loader] : []),
      "--inspect-fix",
      "--inspect-checks", "all",
      "--no-fail-on-inspect-errors",
      "--optimization-report", optimizationReport,
      "--conversion-report", conversionReport,
      "--stats-report", stats,
    ], {stdio: "pipe", maxBuffer: 256 * 1024 * 1024, timeout: 10 * 60 * 1000});
  } catch (err) {
    stderr = String((err && (err.stderr || err.stdout)) || err);
  }

  let loadError = "";
  let loadedGeometries = 0;
  if (fs.existsSync(stats)) {
    try {
      const s = JSON.parse(fs.readFileSync(stats, "utf-8"));
      for (const k of Object.keys(s.inputs || {})) {
        const errs = s.inputs[k].errors || [];
        if (errs.length && !loadError) loadError = String(errs[0]);
      }
      for (const k of Object.keys(s.sceneModels || {})) {
        loadedGeometries += s.sceneModels[k].numGeometries || 0;
      }
    } catch { /* ignore parse issues */ }
    fs.rmSync(stats);
  }

  const outExisted = fs.existsSync(out);
  const ok = outExisted && !loadError && loadedGeometries > 0;
  let reason = "";
  if (!ok) {
    if (loadError) reason = loadError.replace(/^\[.*?\]\s*/, "");
    else if (!outExisted) reason = meaningfulStderr(stderr) || "no output produced (process may have crashed)";
    else reason = "loaded an empty model (0 geometries) — likely an unsupported file/version";
    for (const f of [out, optimizationReport, conversionReport]) {
      if (fs.existsSync(f)) fs.rmSync(f);
    }
  }
  return {ok, reason, loadedGeometries};
}

function readReportCounts(file) {
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf-8")).counts || null;
  } catch {
    return null;
  }
}

function readFidelityWarnings(file) {
  if (!fs.existsSync(file)) return [];
  try {
    const c = JSON.parse(fs.readFileSync(file, "utf-8"));
    return (c.warnings || []).map((w) => w.message);
  } catch {
    return [];
  }
}

function main() {
  if (!fs.existsSync(XEOCONVERT)) {
    console.error(`[convertToXGF] xeoconvert CLI not found at:\n  ${XEOCONVERT}\n` +
      `Build it first (in packages/sdk):  node scripts/build-cli-tools.js`);
    process.exit(1);
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    tool: rel(XEOCONVERT),
    totals: {models: 0, converted: 0, skipped: 0, failed: 0, bytesAfter: 0},
    converted: [],
    skipped: [],
    failed: [],
  };

  const modelDirs = fs.readdirSync(MODELS_DIR, {withFileTypes: true})
    .filter((e) => e.isDirectory() && !e.name.startsWith("."))
    .map((e) => e.name)
    .sort();

  // This script optimizes during conversion, so model.xgf IS the optimized
  // artifact — drop any separate model.optimized.xgf (and its sidecars) left by
  // optimizeModels.js. They are redundant and, if stale, load via the Import
  // dialog ahead of model.xgf. Removing them makes buildIndex wire xgf to
  // model.xgf (no "optimized" marker).
  for (const modelName of modelDirs) {
    const xgfDir = path.join(MODELS_DIR, modelName, "xgf");
    for (const name of ["model.optimized.xgf", "model.optimized.conversion.json", "model.optimized.report.json"]) {
      const p = path.join(xgfDir, name);
      if (fs.existsSync(p)) { fs.rmSync(p); console.log(`[convertToXGF] dropped ${rel(p)}`); }
    }
  }

  for (const modelName of modelDirs) {
    const modelDir = path.join(MODELS_DIR, modelName);

    // Candidate sources present on disk, in priority order.
    const candidates = SOURCES
      .map((s) => ({...s, path: path.join(modelDir, s.dir, s.file)}))
      .filter((s) => fs.existsSync(s.path));

    if (candidates.length === 0) {
      summary.totals.skipped++;
      summary.skipped.push({model: modelName, reason: "no convertible source format"});
      continue;
    }

    summary.totals.models++;

    const xgfDir = path.join(modelDir, "xgf");
    const finalOut = path.join(xgfDir, "model.xgf");
    // Convert to temp paths first so a pre-existing good XGF is only replaced on
    // success — a failed run leaves the old file untouched.
    const tmpOut = path.join(xgfDir, "model.new.xgf");
    const tmpOptReport = path.join(xgfDir, "model.new.report.json");
    const tmpConvReport = path.join(xgfDir, "model.new.conversion.json");

    fs.mkdirSync(xgfDir, {recursive: true});

    let done = null;
    const attempts = [];
    for (const source of candidates) {
      console.log(`[convertToXGF] ${modelName}: ${rel(source.path)} -> xgf ...`);
      const result = convertOne(source, tmpOut, tmpOptReport, tmpConvReport);
      if (result.ok) {
        done = {source, result};
        break;
      }
      attempts.push({source: rel(source.path), reason: result.reason});
      console.log(`  -> failed (${result.reason}); trying next source`);
    }

    if (!done) {
      summary.totals.failed++;
      summary.failed.push({model: modelName, attempts});
      console.log(`  -> FAILED: no source converted`);
      continue;
    }

    // Promote the temp outputs over any pre-existing XGF + reports.
    const finalOptReport = path.join(xgfDir, "model.report.json");
    const finalConvReport = path.join(xgfDir, "model.conversion.json");
    for (const [from, to] of [[tmpOut, finalOut], [tmpOptReport, finalOptReport], [tmpConvReport, finalConvReport]]) {
      if (fs.existsSync(to)) fs.rmSync(to);
      if (fs.existsSync(from)) fs.renameSync(from, to);
    }

    const bytesAfter = fs.statSync(finalOut).size;
    const counts = readReportCounts(finalOptReport);
    const fidelityWarnings = readFidelityWarnings(finalConvReport);

    summary.totals.converted++;
    summary.totals.bytesAfter += bytesAfter;
    summary.converted.push({
      model: modelName,
      source: rel(done.source.path),
      output: rel(finalOut),
      report: rel(finalOptReport),
      conversionReport: rel(finalConvReport),
      bytesAfter,
      geometries: done.result.loadedGeometries,
      fixed: counts ? counts.fixed : 0,
      skipped: counts ? counts.skipped : 0,
      fixErrors: counts ? counts.errors : 0,
      fidelityWarnings: fidelityWarnings.length ? fidelityWarnings : undefined,
      fellThrough: attempts.length ? attempts : undefined,
    });
    console.log(`  -> ${rel(finalOut)}  (${bytesAfter} bytes, ${done.result.loadedGeometries} geometries, fixes: ${counts ? counts.fixed : 0})`);
  }

  fs.writeFileSync(SUMMARY_FILE, JSON.stringify(summary, null, 2));

  const t = summary.totals;
  console.log(`\n[convertToXGF] done: ${t.converted} converted, ${t.failed} failed, ${t.skipped} skipped (no source).`);
  console.log(`[convertToXGF] summary: ${rel(SUMMARY_FILE)}`);

  // Regenerate index.json so the new XGFs surface in the Import Sample Model
  // dialog (buildIndex maps an xgf/ dir to formats:[…xgf…] + dataset:["xgf"]).
  console.log(`[convertToXGF] rebuilding model index ...`);
  execFileSync("node", [BUILD_INDEX], {stdio: "inherit"});
}

main();
