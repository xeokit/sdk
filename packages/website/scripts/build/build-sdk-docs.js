const fs = require("fs");
const path = require("path");
const {execFileSync} = require("child_process");

const websiteRoot = path.resolve(__dirname, "..", "..");
const repoRoot = path.resolve(websiteRoot, "..", "..");
const sdkRoot = path.join(repoRoot, "packages", "sdk");
const docsRoot = path.join(websiteRoot, "docs");
const docsJsonRoot = path.join(docsRoot, "json");

function run(command, args, options = {}) {
  execFileSync(command, args, {
    cwd: options.cwd ?? repoRoot,
    stdio: "inherit",
  });
}

fs.rmSync(docsRoot, {recursive: true, force: true});
fs.mkdirSync(docsJsonRoot, {recursive: true});

run("typedoc", [
  "--json",
  "../website/docs/json/sdk.json",
  "--options",
  "typedoc.json",
  "--validation.invalidLink",
  "false",
], {cwd: sdkRoot});

fs.cpSync(path.join(sdkRoot, "assets"), path.join(docsRoot, "assets"), {
  recursive: true,
});

run("typedoc", [
  "--entryPointStrategy",
  "merge",
  "../website/docs/json/*.json",
  "--tsconfig",
  "../../tsconfig.typedoc.json",
  "--out",
  "../website/docs/api",
], {cwd: sdkRoot});
