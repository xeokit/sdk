#!/usr/bin/env node

import {spawnSync} from "node:child_process";
import path from "node:path";
import {fileURLToPath} from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));

const commands = new Map([
  ["generate", {
    script: "build-city.mjs",
    args: [],
    description: "Generate a procedural city XGF or XGF stream"
  }],
  ["analyze-osm", {
    script: "analyze-osm.mjs",
    args: [],
    description: "Analyze an OSM extract and write a city profile"
  }],
  ["analyse-osm", {
    alias: "analyze-osm"
  }],
  ["osm", {
    alias: "analyze-osm"
  }],
  ["calibrate", {
    script: "calibrate-city.mjs",
    args: [],
    description: "Run the full procedural city calibration workflow"
  }],
  ["regression", {
    script: "calibrate-city.mjs",
    args: [
      "--regression",
      "--no-visual",
      "--no-weight-search",
      "--no-ablation",
      "--output",
      "artifacts/calibration/regression"
    ],
    description: "Run the compact procedural city regression gate"
  }]
]);

const args = process.argv.slice(2);
while (args[0] === "--") {
  args.shift();
}
const command = args[0];

if (!command || command === "-h" || command === "--help" || command === "help") {
  printUsage();
  process.exit(0);
}

const resolved = resolveCommand(command);
if (!resolved) {
  console.error(`Unknown procedural city command: ${command}`);
  console.error("");
  printUsage();
  process.exit(1);
}

const result = spawnSync(process.execPath, [
  path.join(scriptDir, resolved.script),
  ...resolved.args,
  ...args.slice(1)
], {
  stdio: "inherit"
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}
process.exit(result.status ?? 0);

function resolveCommand(command) {
  let current = commands.get(command);
  while (current?.alias) {
    current = commands.get(current.alias);
  }
  return current;
}

function printUsage() {
  console.log(`Usage:
  pnpm --filter @xeokit/website city -- <command> [options]
  pnpm city -- <command> [options]

Commands:`);
  for (const [name, command] of commands) {
    if (command.alias) {
      continue;
    }
    console.log(`  ${name.padEnd(12)} ${command.description}`);
  }
}
