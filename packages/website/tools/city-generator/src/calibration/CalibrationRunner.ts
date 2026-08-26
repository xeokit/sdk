import fs from "node:fs/promises";
import path from "node:path";
import type {Block, CityObject, CityScene, EvaluationPresetName, Vec2} from "../types";
import {generateCity} from "../generator/CityGenerator";
import {benchmarkSeeds, type BaselineComparison, type CalibrationConfig, type CalibrationReport, type CalibrationThresholds} from "./CalibrationReport";
import {compareBaselineRuns, runBenchmark, runBenchmarkSuite} from "./BenchmarkSuite";
import {detectRegressions} from "./RegressionDetector";
import {recommendedWeights, runAblations, searchWeights} from "./WeightSearch";
import {average, bounds, round} from "./metrics/MetricUtils";

const rootDir = resolveRepoRoot(process.cwd());

export async function main(argv = process.argv.slice(2)): Promise<void> {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  const config = await resolveConfig(args);
  await fs.mkdir(config.outputDir, {recursive: true});
  const suite = await runBenchmarkSuite(config);
  const comparisons = compareBaselineRuns(suite.baseline, suite.evaluated);
  const deterministicMismatch = config.regression ? await deterministicMismatchCheck(config, suite.evaluated) : false;
  const ablations = config.runAblation ? await runAblations(config, suite.evaluated) : [];
  const weightSearch = config.runWeightSearch ? await searchWeights(config) : [];
  const visuals = config.captureVisuals ? await captureVisualComparisons(config) : [];
  const regression = detectRegressions(comparisons, suite.evaluated, config.thresholds, deterministicMismatch);
  const report: CalibrationReport = {
    schema: "xeokit-procedural-city-calibration/1.0",
    generatedAt: "deterministic",
    config,
    aggregate: aggregate(comparisons),
    comparisons,
    ablations,
    weightSearch,
    recommendedWeights: recommendedWeights(weightSearch),
    regression,
    visualComparisons: visuals
  };
  const jsonPath = path.join(config.outputDir, "calibration-report.json");
  const htmlPath = path.join(config.outputDir, "calibration-report.html");
  await fs.writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await fs.writeFile(htmlPath, renderHtmlReport(report), "utf8");
  if (config.updateBaseline) {
    await fs.writeFile(path.join(config.outputDir, "regression-baseline.json"), `${JSON.stringify({
      schema: "xeokit-procedural-city-regression-baseline/1.0",
      profile: config.profile,
      seeds: config.seeds,
      fingerprints: suite.evaluated.map((run) => ({seed: run.seed, fingerprint: run.fingerprint}))
    }, null, 2)}\n`, "utf8");
  }
  printSummary(report, jsonPath, htmlPath);
  if (config.regression && !regression.ok) {
    process.exitCode = 1;
  }
}

function aggregate(comparisons: BaselineComparison[]): CalibrationReport["aggregate"] {
  const baseline = comparisons.map((comparison) => comparison.baseline);
  const evaluated = comparisons.map((comparison) => comparison.evaluated);
  return {
    baselineAverage: round(average(baseline.map((run) => run.metrics.overallScore))),
    evaluatedAverage: round(average(evaluated.map((run) => run.metrics.overallScore))),
    evaluatedWorst: round(Math.min(...evaluated.map((run) => run.metrics.overallScore))),
    profileFitAverage: round(average(evaluated.map((run) => run.metrics.profileFit))),
    patternAverage: round(average(evaluated.map((run) => run.metrics.patternScore))),
    skylineAverage: round(average(evaluated.map((run) => run.metrics.skylineScore))),
    validityAverage: round(average(evaluated.map((run) => run.metrics.validityScore))),
    performanceAverage: round(average(evaluated.map((run) => run.metrics.performanceScore))),
    generationSecondsAverage: round(average(evaluated.map((run) => run.generationSeconds))),
    hardFailureCount: evaluated.reduce((sum, run) => sum + run.metrics.hardFailures.length, 0)
  };
}

async function deterministicMismatchCheck(config: CalibrationConfig, evaluatedRuns: Array<{seed: number; fingerprint: string}>): Promise<boolean> {
  const seed = config.seeds.includes(42) ? 42 : config.seeds[0];
  const first = evaluatedRuns.find((run) => run.seed === seed);
  if (!first) {
    return false;
  }
  const repeat = await runBenchmark({
    seed,
    mode: "evaluated",
    profile: config.profile,
    size: config.size,
    buildingCount: config.buildingCount,
    density: config.density,
    evaluationPreset: config.evaluationPreset
  });
  return repeat.fingerprint !== first.fingerprint;
}

async function captureVisualComparisons(config: CalibrationConfig): Promise<CalibrationReport["visualComparisons"]> {
  const result: CalibrationReport["visualComparisons"] = [];
  for (const seed of config.visualSeeds) {
    const baseline = await generateVisualCity(config, seed, false);
    const evaluated = await generateVisualCity(config, seed, true);
    const files: Array<{view: string; baseline: string; evaluated: string}> = [];
    for (const view of visualViews()) {
      const baselinePath = path.join(config.outputDir, `seed-${seed}`, "baseline", `${view.id}.svg`);
      const evaluatedPath = path.join(config.outputDir, `seed-${seed}`, "evaluated", `${view.id}.svg`);
      await fs.mkdir(path.dirname(baselinePath), {recursive: true});
      await fs.mkdir(path.dirname(evaluatedPath), {recursive: true});
      await fs.writeFile(baselinePath, view.render(baseline), "utf8");
      await fs.writeFile(evaluatedPath, view.render(evaluated), "utf8");
      files.push({
        view: view.id,
        baseline: path.relative(config.outputDir, baselinePath),
        evaluated: path.relative(config.outputDir, evaluatedPath)
      });
    }
    result.push({seed, files});
  }
  await fs.writeFile(path.join(config.outputDir, "visual-comparison.html"), renderVisualComparison(result), "utf8");
  return result;
}

async function generateVisualCity(config: CalibrationConfig, seed: number, evaluated: boolean): Promise<CityScene> {
  return generateCity({
    seed,
    size: config.size,
    density: config.density,
    buildingCount: config.buildingCount,
    profile: config.profile,
    outputPath: "./artifacts/calibration/visual.xgf",
    evaluationPreset: config.evaluationPreset,
    evaluation: {enabled: evaluated}
  });
}

function visualViews(): Array<{id: string; render: (scene: CityScene) => string}> {
  return [
    {id: "full-city-aerial", render: (scene) => renderPlanSvg(scene, [0, 0, scene.config.size, scene.config.size])},
    {id: "downtown-aerial", render: (scene) => renderPlanSvg(scene, viewBoundsForDistrict(scene, "Downtown"))},
    {id: "historic-district", render: (scene) => renderPlanSvg(scene, viewBoundsForDistrict(scene, "Historic Core"))},
    {id: "arterial-street", render: (scene) => renderPlanSvg(scene, viewBoundsNearRoad(scene, "arterial"))},
    {id: "residential-street", render: (scene) => renderPlanSvg(scene, viewBoundsNearRoad(scene, "local"))},
    {id: "courtyard-block", render: (scene) => renderPlanSvg(scene, viewBoundsNearBlock(scene, (block) => block.pattern === "perimeter-courtyard"))},
    {id: "central-park", render: (scene) => renderPlanSvg(scene, viewBoundsNearBlock(scene, (block) => !!block.openSpace))},
    {id: "skyline-silhouette", render: renderSkylineSvg}
  ];
}

function renderPlanSvg(scene: CityScene, view: [number, number, number, number]): string {
  const [x, y, w, h] = view;
  const buildings = scene.objects.filter((object) => object.type === "Building");
  const parks = scene.blocks.filter((block) => block.openSpace);
  const water = scene.objects.filter((object) => object.layerId === "water");
  const roads = scene.roads;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="${x} ${y} ${w} ${h}">
  <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#ded8c8"/>
  ${parks.map((block) => polygonSvg(block.polygon, "#77a96b", "#58824f", 1)).join("\n  ")}
  ${water.map((object) => object.meshes.map((mesh) => meshPolygonSvg(mesh.positions, "#4c7eaa")).join("\n  ")).join("\n  ")}
  ${roads.map((road) => `<polyline points="${road.polyline.map((point) => point.join(",")).join(" ")}" fill="none" stroke="#3d3d3a" stroke-width="${Math.max(3, road.width)}" stroke-linecap="round" stroke-linejoin="round"/>`).join("\n  ")}
  ${buildings.map((object) => buildingSvg(object)).join("\n  ")}
</svg>
`;
}

function renderSkylineSvg(scene: CityScene): string {
  const buildings = scene.objects
    .filter((object) => object.type === "Building")
    .map((object) => ({
      x: Array.isArray(object.metadata.center) ? Number(object.metadata.center[0]) : 0,
      height: Number(object.metadata.height || 0),
      width: Math.max(3, Math.sqrt(Number(object.metadata.footprintArea || 60)) * 0.28),
      fill: buildingColor(object)
    }))
    .sort((a, b) => a.x - b.x);
  const maxH = Math.max(1, ...buildings.map((building) => building.height));
  const size = scene.config.size;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="420" viewBox="0 0 ${size} 220">
  <rect x="0" y="0" width="${size}" height="220" fill="#cdddf1"/>
  <rect x="0" y="188" width="${size}" height="32" fill="#6f7b73"/>
  ${buildings.map((building) => {
    const h = Math.max(2, building.height / maxH * 170);
    return `<rect x="${building.x - building.width / 2}" y="${188 - h}" width="${building.width}" height="${h}" fill="${building.fill}" opacity="0.88"/>`;
  }).join("\n  ")}
</svg>
`;
}

function buildingSvg(object: CityObject): string {
  const footprint = metadataFootprint(object.metadata.footprint);
  return footprint.length >= 3 ? polygonSvg(footprint, buildingColor(object), "#4b4b4b", 0.55) : "";
}

function buildingColor(object: CityObject): string {
  const district = String(object.metadata.district || "");
  if (district === "Downtown") {
    return "#7d8994";
  }
  if (district === "Historic Core") {
    return "#a87355";
  }
  if (district === "Civic District") {
    return "#b4a375";
  }
  return "#c5b296";
}

function polygonSvg(points: Vec2[], fill: string, stroke: string, strokeWidth: number): string {
  return `<polygon points="${points.map((point) => point.join(",")).join(" ")}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"/>`;
}

function meshPolygonSvg(positions: number[], fill: string): string {
  const points: Vec2[] = [];
  for (let i = 0; i < positions.length; i += 3) {
    points.push([positions[i], positions[i + 1]]);
  }
  return points.length >= 3 ? polygonSvg(points.slice(0, 64), fill, fill, 0.5) : "";
}

function metadataFootprint(value: unknown): Vec2[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((point) => Array.isArray(point) && Number.isFinite(point[0]) && Number.isFinite(point[1]))
    .map((point) => [Number(point[0]), Number(point[1])] as Vec2);
}

function viewBoundsForDistrict(scene: CityScene, district: string): [number, number, number, number] {
  const blocks = scene.blocks.filter((block) => block.district === district);
  return boundsAroundBlocks(blocks, scene.config.size);
}

function viewBoundsNearRoad(scene: CityScene, hierarchy: string): [number, number, number, number] {
  const road = scene.roads.find((candidate) => candidate.hierarchy === hierarchy) || scene.roads[0];
  if (!road) {
    return [0, 0, scene.config.size, scene.config.size];
  }
  const b = bounds(road.polyline);
  return paddedBounds(b, scene.config.size, 360);
}

function viewBoundsNearBlock(scene: CityScene, predicate: (block: Block) => boolean): [number, number, number, number] {
  const block = scene.blocks.find(predicate) || scene.blocks[0];
  if (!block) {
    return [0, 0, scene.config.size, scene.config.size];
  }
  return paddedBounds(bounds(block.polygon), scene.config.size, 320);
}

function boundsAroundBlocks(blocks: Block[], size: number): [number, number, number, number] {
  if (!blocks.length) {
    return [0, 0, size, size];
  }
  const all = blocks.flatMap((block) => block.polygon);
  return paddedBounds(bounds(all), size, 260);
}

function paddedBounds(b: [number, number, number, number], size: number, pad: number): [number, number, number, number] {
  const minX = Math.max(0, b[0] - pad);
  const minY = Math.max(0, b[1] - pad);
  const maxX = Math.min(size, b[2] + pad);
  const maxY = Math.min(size, b[3] + pad);
  return [minX, minY, Math.max(1, maxX - minX), Math.max(1, maxY - minY)];
}

function renderHtmlReport(report: CalibrationReport): string {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>Procedural City Calibration</title>
  <style>
    body{font-family:system-ui,sans-serif;margin:24px;color:#242424;background:#f7f6f2}
    table{border-collapse:collapse;width:100%;margin:16px 0;background:white}
    th,td{border:1px solid #ddd;padding:6px 8px;text-align:left;font-size:13px}
    th{background:#ece8de}
    .ok{color:#176f39}.fail{color:#a1261b}.warn{color:#8a5b00}
    .cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px}
    .card{background:white;border:1px solid #ddd;padding:12px}
  </style>
</head>
<body>
  <h1>Procedural City Calibration</h1>
  <p>Profile: <b>${report.config.profile}</b>, seeds: ${report.config.seeds.join(", ")}, preset: ${report.config.evaluationPreset}</p>
  <p class="${report.regression.ok ? "ok" : "fail"}">Regression: ${report.regression.ok ? "OK" : "FAILED"}</p>
  <div class="cards">
    ${Object.entries(report.aggregate).map(([key, value]) => `<div class="card"><b>${key}</b><br>${value}</div>`).join("")}
  </div>
  ${section("Baseline vs Evaluated", comparisonTable(report.comparisons))}
  ${section("Ablations", simpleTable(report.ablations))}
  ${section("Weight Search", simpleTable(report.weightSearch))}
  ${section("Regression Failures", list(report.regression.failures))}
  ${section("Visual Comparisons", visualLinks(report.visualComparisons))}
</body>
</html>
`;
}

function comparisonTable(comparisons: BaselineComparison[]): string {
  return `<table><thead><tr><th>Seed</th><th>Baseline</th><th>Evaluated</th><th>Change</th><th>Profile</th><th>Pattern</th><th>Skyline</th><th>Time</th></tr></thead><tbody>
${comparisons.map((comparison) => `<tr><td>${comparison.seed}</td><td>${comparison.baseline.metrics.overallScore}</td><td>${comparison.evaluated.metrics.overallScore}</td><td>${comparison.changes.overallScore}%</td><td>${comparison.evaluated.metrics.profileFit}</td><td>${comparison.evaluated.metrics.patternScore}</td><td>${comparison.evaluated.metrics.skylineScore}</td><td>${comparison.evaluated.generationSeconds}s</td></tr>`).join("")}
</tbody></table>`;
}

function simpleTable(rows: Array<Record<string, unknown>>): string {
  if (!rows.length) {
    return "<p>Not run.</p>";
  }
  const keys = Object.keys(rows[0]);
  return `<table><thead><tr>${keys.map((key) => `<th>${key}</th>`).join("")}</tr></thead><tbody>
${rows.map((row) => `<tr>${keys.map((key) => `<td>${formatCell(row[key])}</td>`).join("")}</tr>`).join("")}
</tbody></table>`;
}

function visualLinks(visuals: CalibrationReport["visualComparisons"]): string {
  if (!visuals.length) {
    return "<p>Not captured.</p>";
  }
  return visuals.map((entry) => `<h3>Seed ${entry.seed}</h3><ul>${entry.files.map((file) => `<li>${file.view}: <a href="${file.baseline}">baseline</a> / <a href="${file.evaluated}">evaluated</a></li>`).join("")}</ul>`).join("");
}

function renderVisualComparison(visuals: CalibrationReport["visualComparisons"]): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>City Visual Calibration</title><style>body{font-family:system-ui,sans-serif;margin:20px;background:#f7f6f2}.pair{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:12px 0 28px}iframe{width:100%;height:360px;border:1px solid #ccc;background:white}</style></head><body><h1>Visual Calibration</h1>${visuals.map((entry) => `<h2>Seed ${entry.seed}</h2>${entry.files.map((file) => `<h3>${file.view}</h3><div class="pair"><div><b>Baseline</b><iframe src="${file.baseline}"></iframe></div><div><b>Evaluated</b><iframe src="${file.evaluated}"></iframe></div></div>`).join("")}`).join("")}</body></html>`;
}

function section(title: string, content: string): string {
  return `<h2>${title}</h2>${content}`;
}

function list(items: string[]): string {
  return items.length ? `<ul>${items.map((item) => `<li>${item}</li>`).join("")}</ul>` : "<p>None.</p>";
}

function formatCell(value: unknown): string {
  if (Array.isArray(value)) {
    return value.join(", ");
  }
  if (value && typeof value === "object") {
    return `<code>${escapeHtml(JSON.stringify(value))}</code>`;
  }
  return escapeHtml(String(value ?? ""));
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({'&': "&amp;", '<': "&lt;", '>': "&gt;", '"': "&quot;", "'": "&#39;"}[char] || char));
}

function printSummary(report: CalibrationReport, jsonPath: string, htmlPath: string): void {
  console.log(`Calibration profile=${report.config.profile} seeds=${report.config.seeds.join(",")}`);
  console.log(`Baseline average: ${report.aggregate.baselineAverage}`);
  console.log(`Evaluated average: ${report.aggregate.evaluatedAverage}`);
  console.log(`Evaluated worst: ${report.aggregate.evaluatedWorst}`);
  console.log(`Profile fit: ${report.aggregate.profileFitAverage}`);
  console.log(`Pattern fit: ${report.aggregate.patternAverage}`);
  console.log(`Skyline: ${report.aggregate.skylineAverage}`);
  console.log(`Validity: ${report.aggregate.validityAverage}`);
  console.log(`Generation time avg: ${report.aggregate.generationSecondsAverage}s`);
  console.log(`Wrote ${path.relative(rootDir, jsonPath)}`);
  console.log(`Wrote ${path.relative(rootDir, htmlPath)}`);
  if (report.config.regression && !report.regression.ok) {
    console.log("Regression failures:");
    for (const failure of report.regression.failures) {
      console.log(`- ${failure}`);
    }
  }
}

async function resolveConfig(args: Record<string, string | boolean>): Promise<CalibrationConfig> {
  const outputDir = typeof args.output === "string"
    ? path.resolve(rootDir, args.output)
    : path.join(rootDir, "artifacts/calibration");
  return {
    profile: typeof args.profile === "string" ? args.profile : "central-european",
    seeds: typeof args.seeds === "string" ? args.seeds.split(",").map((seed) => Number(seed.trim())).filter(Number.isFinite) : [...benchmarkSeeds],
    size: numberArg(args.size, 1000),
    buildingCount: numberArg(args.buildings, 560),
    density: args.density === "medium" ? "medium" : "high",
    evaluationPreset: evaluationPresetArg(args["evaluation-preset"]),
    outputDir,
    runAblation: args["no-ablation"] !== true,
    runWeightSearch: args["no-weight-search"] !== true,
    captureVisuals: args["no-visual"] !== true,
    visualSeeds: typeof args["visual-seeds"] === "string" ? args["visual-seeds"].split(",").map((seed) => Number(seed.trim())).filter(Number.isFinite) : [42, 73],
    regression: args.regression === true,
    updateBaseline: args["update-baseline"] === true,
    thresholds: await loadThresholds()
  };
}

async function loadThresholds(): Promise<CalibrationThresholds> {
  const thresholdPath = path.join(rootDir, "packages/website/tools/city-generator/calibration/regression-thresholds.json");
  try {
    return JSON.parse(await fs.readFile(thresholdPath, "utf8"));
  } catch {
    return {
      minimumScores: {
        profileFit: 0.58,
        patternFit: 0.55,
        skyline: 0.52,
        validity: 0.82,
        overall: 0.58
      },
      maximumValues: {
        unusableParcelRatio: 0.08,
        buildingRoadOverlaps: 0.04,
        isolatedTowerCount: 4,
        generationTimeSeconds: 12,
        triangleCount: 2_000_000
      }
    };
  }
}

function parseArgs(argv: string[]): Record<string, string | boolean> {
  const args: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!token.startsWith("--")) {
      continue;
    }
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      args[key] = true;
    } else {
      args[key] = next;
      i++;
    }
  }
  return args;
}

function numberArg(value: string | boolean | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function evaluationPresetArg(value: string | boolean | undefined): EvaluationPresetName {
  return value === "fast" || value === "quality" || value === "balanced" ? value : "balanced";
}

function printHelp(): void {
  console.log(`Usage:
  node packages/website/tools/city-generator/calibrate-city.mjs [options]

Options:
  --profile <name|path>             Profile to benchmark, default central-european
  --seeds <list>                    Comma-separated seeds, default 7,19,42,73,101,256,512,1024
  --size <meters>                   City size, default 1000
  --buildings <count>               Building target, default 560
  --density <medium|high>           Density, default high
  --evaluation-preset <name>        fast, balanced, or quality
  --output <path>                   Artifact output directory, default artifacts/calibration
  --no-ablation                     Skip evaluator ablation runs
  --no-weight-search                Skip evaluator weight search
  --no-visual                       Skip fixed visual SVG comparisons
  --visual-seeds <list>             Visual comparison seeds, default 42,73
  --regression                      Fail on configured regression thresholds
  --update-baseline                 Write current evaluated fingerprints
`);
}

function resolveRepoRoot(cwd: string): string {
  if (path.basename(cwd) === "website" && path.basename(path.dirname(cwd)) === "packages") {
    return path.resolve(cwd, "../..");
  }
  return cwd;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
