import path from "node:path";
import {buildProfileFromOSM, writeProfile} from "./analysis/ProfileBuilder";

const rootDir = resolveRepoRoot(process.cwd());

export async function main(argv = process.argv.slice(2)): Promise<void> {
  const args = parseArgs(argv);
  if (args.help || !args.input) {
    printHelp();
    return;
  }
  const input = path.resolve(String(args.input));
  const name = String(args.name || path.basename(input).replace(/\.(osm\.pbf|geojson|json|osm|xml)$/i, "").replace(/[^a-z0-9]+/gi, "-").toLowerCase());
  const output = path.resolve(String(args.output || path.join(rootDir, "packages/website/scripts/procedural-city/src/profiles", `${name}.json`)));
  const profile = await buildProfileFromOSM(input, {
    name,
    description: args.description ? String(args.description) : undefined
  });
  await writeProfile(profile, output);
  console.log(`Built OSM city profile "${profile.name}"`);
  console.log(`Road segment mean: ${profile.roads.segmentLength?.mean ?? "n/a"}m`);
  console.log(`Measured blocks: ${profile.blocks.measuredCount ?? profile.sampleCounts?.blocks ?? "n/a"}`);
  console.log(`Road density: ${profile.roads.roadDensityKmPerSquareKm ?? "n/a"} km/km2`);
  console.log(`Intersection density: ${profile.roads.intersectionDensityPerSquareKm ?? "n/a"} /km2`);
  console.log(`Building levels mean: ${profile.buildings.levels?.mean ?? "n/a"}`);
  console.log(`Street alignment: ${profile.buildings.streetAlignmentProbability ?? "n/a"}`);
  console.log(`Open-space ratio: ${profile.publicSpace.openSpaceRatio ?? "n/a"}`);
  console.log(`Wrote ${path.relative(rootDir, output)}`);
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

function printHelp(): void {
  console.log(`Usage:
  node packages/website/scripts/procedural-city/analyze-osm-profile.mjs --input <extract> [options]

Options:
  --input <path>        OSM extract: .geojson, .json, .osm, .xml, or .osm.pbf with osmium installed
  --name <name>         Profile name, defaults to input filename
  --description <text>  Profile description
  --output <path>       JSON output path
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
