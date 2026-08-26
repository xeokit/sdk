const fs = require("fs");
const path = require("path");

const websiteRoot = path.resolve(__dirname, "..", "..");
const examplesRoot = path.join(websiteRoot, "examples");
const nonExampleDirs = new Set(["libs", "utils"]);

function main() {
  console.log("Building example index");

  const index = {};
  for (const {id, dir: exampleDir} of findExampleDirs(examplesRoot)) {
    const indexJSONPath = path.join(exampleDir, "index.json");
    const indexJSPath = path.join(exampleDir, "index.js");
    if (!fs.existsSync(indexJSONPath)) {
      console.log(`index.json not found:  ${path.relative(websiteRoot, indexJSONPath)}`);
      continue;
    }
    if (!fs.existsSync(indexJSPath)) {
      continue;
    }

    try {
      const exampleInfo = JSON.parse(fs.readFileSync(indexJSONPath, "utf8"));
      const publicInfo = toPublicExampleInfo(id, exampleInfo);
      index[publicInfo.id] = publicInfo;
    } catch (error) {
      console.error(`Error reading or parsing JSON in file: ${indexJSONPath}`, error);
    }
  }

  fs.writeFileSync(path.join(examplesRoot, "index.json"), `${JSON.stringify(index, null, 2)}\n`, "utf8");
}

function toPublicExampleInfo(id, exampleInfo) {
  const publicInfo = {
    id,
    title: exampleInfo.title,
    description: exampleInfo.description || "",
    isTutorial: !!exampleInfo.isTutorial,
    isVisualTest: !!exampleInfo.isVisualTest,
    categories: exampleInfo.categories || []
  };
  if (typeof exampleInfo.snapshotTimeoutMs === "number" && Number.isFinite(exampleInfo.snapshotTimeoutMs)) {
    publicInfo.snapshotTimeoutMs = exampleInfo.snapshotTimeoutMs;
  }
  if (typeof exampleInfo.auditTimeoutMs === "number" && Number.isFinite(exampleInfo.auditTimeoutMs)) {
    publicInfo.auditTimeoutMs = exampleInfo.auditTimeoutMs;
  }
  if (exampleInfo.auditSkipReason) {
    publicInfo.auditSkipReason = exampleInfo.auditSkipReason;
  }
  if (exampleInfo.template) {
    publicInfo.template = exampleInfo.template;
  }
  if (exampleInfo.isShowcased) {
    publicInfo.isShowcased = true;
  }
  return publicInfo;
}

function findExampleDirs(root) {
  const examples = [];

  function visit(dir) {
    const relative = path.relative(examplesRoot, dir);
    const firstSegment = relative.split(path.sep)[0];
    if (relative && nonExampleDirs.has(firstSegment)) {
      return;
    }
    if (fs.existsSync(path.join(dir, "index.json")) && fs.existsSync(path.join(dir, "index.js"))) {
      examples.push({
        id: relative.split(path.sep).join("/"),
        dir
      });
      return;
    }
    for (const file of fs.readdirSync(dir).sort()) {
      const child = path.join(dir, file);
      if (fs.statSync(child).isDirectory()) {
        visit(child);
      }
    }
  }

  visit(root);
  return examples.sort((a, b) => a.id.localeCompare(b.id));
}

main();
