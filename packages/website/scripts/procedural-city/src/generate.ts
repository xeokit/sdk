import fs from "node:fs/promises";
import path from "node:path";
import {generateCity, createManifest} from "./generator/CityGenerator";
import {exportXGF, exportXGFStream} from "./export/XGFExporter";
import {createComparisonReport, formatComparisonReport} from "./report/ComparisonReport";
import {validateCity} from "./validation/CityValidator";

const rootDir = resolveRepoRoot(process.cwd());

export async function main(argv = process.argv.slice(2)): Promise<void> {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  const stream = args.stream === true || (typeof args.output === "string" && path.basename(args.output) === "xgfstream");
  const defaultOutput = stream
    ? path.join(rootDir, "packages/website/models/ProceduralCityLarge/xgfstream")
    : path.join(rootDir, "packages/website/models/ProceduralCity/xgf/model.xgf");
  const outputPath = path.resolve(args.output || defaultOutput);
  const defaultSize = stream ? 2400 : 1000;
  const defaultBuildings = stream ? 3600 : 560;
  const city = await generateCity({
    seed: args.seed ?? 42,
    size: numberArg(args.size, defaultSize),
    style: "european",
    density: (args.density === "medium" ? "medium" : "high"),
    buildingCount: args.buildings || stream ? numberArg(args.buildings, defaultBuildings) : undefined,
    profile: typeof args.profile === "string" ? args.profile : undefined,
    outputPath: stream ? path.join(outputPath, "index.runtime.json") : outputPath
  });
  const streamResult = stream ? await exportXGFStream(city, {
    outputDir: outputPath,
    chunkBudget: numberArg(args["chunk-budget"], 420),
    minChunkBudget: numberArg(args["min-chunk-budget"], 120),
    gridCellSize: numberArg(args["grid-cell-size"], 260)
  }) : undefined;
  if (!stream) {
    await exportXGF(city, {outputPath});
  }
  const sidecarDir = sidecarDirectory(outputPath, stream);
  const manifestPath = path.join(sidecarDir, "metadata.json");
  await fs.writeFile(manifestPath, `${JSON.stringify(createManifest(city), null, 2)}\n`, "utf8");
  const comparison = createComparisonReport(city);
  const validation = validateCity(city);
  const report = {
    ...comparison,
    validation,
    warnings: [...comparison.warnings, ...validation.warnings]
  };
  const defaultReportPath = path.join(rootDir, "packages/website/reports", `${reportSlug(city.config.profileData?.name || "city", city.config.seed, stream ? "large-stream" : undefined)}.json`);
  const reportPath = path.resolve(typeof args.report === "string" ? args.report : defaultReportPath);
  const sidecarReportPath = path.join(sidecarDir, "report.json");
  await fs.mkdir(path.dirname(reportPath), {recursive: true});
  await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  if (path.resolve(reportPath) !== path.resolve(sidecarReportPath)) {
    await fs.writeFile(sidecarReportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  }

  console.log(`Generated procedural city seed=${city.config.seed}`);
  console.log(`Buildings: ${city.stats.buildings}`);
  console.log(`Roads: ${city.stats.roads}`);
  console.log(`Parks/plazas: ${city.stats.parks}`);
  console.log(`Landmarks: ${city.stats.landmarks}`);
  console.log(`Trees: ${city.stats.trees}`);
  console.log(`Triangles: ${city.stats.triangles.toLocaleString()}`);
  if (streamResult) {
    console.log(`Stream chunks: ${streamResult.chunkCount}`);
    console.log(`Stream files: ${streamResult.fileCount}`);
    console.log(`Wrote ${path.relative(rootDir, path.join(outputPath, "index.runtime.json"))}`);
  } else {
    console.log(`Wrote ${path.relative(rootDir, outputPath)}`);
  }
  console.log(`Wrote ${path.relative(rootDir, manifestPath)}`);
  console.log(`Wrote ${path.relative(rootDir, reportPath)}`);
  console.log("");
  console.log(formatComparisonReport(report));
  if (validation.warnings.length) {
    console.log("");
    console.log("Validation warnings:");
    for (const warning of validation.warnings) {
      console.log(`- ${warning}`);
    }
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

function printHelp(): void {
  console.log(`Usage:
  node packages/website/scripts/procedural-city/build-and-generate.mjs [options]

Options:
  --seed <value>       Deterministic seed, default 42
  --size <meters>      District width/depth, default 1000
  --density <value>    high or medium, default high
  --buildings <count>  Target building count, default 560
  --profile <name|path> Built-in profile name or JSON profile path, default central-european
  --output <path>      XGF output path
  --report <path>      Comparison report JSON path
  --stream             Export an XGF stream instead of one XGF file
  --chunk-budget <n>   Stream chunk mesh budget, default 420
  --min-chunk-budget <n> Minimum merged stream chunk budget, default 120
  --grid-cell-size <m> Stream grid cell size, default 260
`);
}

function sidecarDirectory(outputPath: string, stream = false): string {
  if (stream) {
    return path.basename(outputPath) === "xgfstream" ? path.dirname(outputPath) : outputPath;
  }
  const parent = path.dirname(outputPath);
  return path.basename(parent) === "xgf" ? path.dirname(parent) : parent;
}

function reportSlug(profileName: string, seed: string | number, suffix?: string): string {
  const base = profileName === "berlin-inner-city" ? "berlin-style" : profileName;
  const slug = base.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return suffix ? `${slug}-${suffix}-${seed}` : `${slug}-${seed}`;
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
