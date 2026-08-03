#!/usr/bin/env node

import {build} from "esbuild";
import {pathToFileURL} from "node:url";
import path from "node:path";
import os from "node:os";

const scriptDir = path.dirname(new URL(import.meta.url).pathname);
const entry = path.join(scriptDir, "src/calibration/CalibrationRunner.ts");
const outfile = path.join(os.tmpdir(), "xeokit-procedural-city-calibration.mjs");

await build({
  entryPoints: [entry],
  outfile,
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node18",
  sourcemap: false,
  logLevel: "warning"
});

const mod = await import(`${pathToFileURL(outfile).href}?v=${Date.now()}`);
await mod.main(process.argv.slice(2));
