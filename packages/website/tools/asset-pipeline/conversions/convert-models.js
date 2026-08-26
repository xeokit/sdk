#!/usr/bin/env node

// Converts website models immediately from models/models.json and
// models/pipelines.json.
//
// This is the direct-run version of build-conversion-script.js: it uses the same
// model/pipeline metadata and command-template expansion, but executes each
// conversion as it goes instead of generating scripts/convert-models.sh.

const fs = require("fs");
const path = require("path");
const {spawnSync} = require("child_process");

const rootDir = path.resolve(__dirname, "..", "..", "..", "..", "..");
const websiteDir = path.join(rootDir, "packages/website");
const modelsDir = path.join(websiteDir, "models");
const modelsPath = path.join(modelsDir, "models.json");
const pipelinesPath = path.join(modelsDir, "pipelines.json");
const configsPath = path.join(websiteDir, "configs.json");

main();

function main() {
  const models = readJSON(modelsPath);
  const pipelines = readJSON(pipelinesPath);
  const configs = readJSON(configsPath);
  const conversions = collectConversions(models, pipelines, configs);

  console.log(`[convert-models.js] Converting ${conversions.length} files...`);

  let completed = 0;
  let failed = 0;
  for (const conversion of conversions) {
    console.log("");
    console.log(`# --------------------------------------`);
    console.log(`# ${conversion.modelId}`);
    console.log(`# ${conversion.pipelineId}`);
    console.log(`# --------------------------------------`);
    console.log(`[convert-models.js] Converting ${conversion.modelId} via pipeline ${conversion.pipelineId}`);
    console.log(conversion.command);

    const result = spawnSync(conversion.command, {
      cwd: websiteDir,
      shell: true,
      stdio: "inherit"
    });

    completed++;
    if (result.status !== 0) {
      failed++;
      console.error(`[convert-models.js] Conversion failed for ${conversion.modelId}/${conversion.pipelineId} with exit code ${result.status}`);
    }
    console.log(`[convert-models.js] ${completed} out of ${conversions.length} conversions done`);
  }

  if (failed > 0) {
    console.error(`[convert-models.js] ${failed} conversion(s) failed`);
    process.exit(1);
  }
}

function collectConversions(models, pipelines, configs) {
  const pipelineLookup = {};
  for (const pipeline of pipelines.pipelines || []) {
    pipelineLookup[pipeline.id] = pipeline;
  }

  const conversions = [];
  for (const model of models.models || []) {
    const modelId = model.id;
    for (const pipelineId of model.pipelines || []) {
      const pipeline = pipelineLookup[pipelineId];
      if (!pipeline) {
        console.error(`Model ${modelId} refers to unresolved pipeline ${pipelineId}`);
        continue;
      }
      if (!pipeline.cmd) {
        continue;
      }

      const outputDir = path.join(modelsDir, modelId, pipelineId);
      fs.mkdirSync(outputDir, {recursive: true});
      conversions.push({
        modelId,
        pipelineId,
        command: parseStringTemplate(pipeline.cmd, {modelId, ...configs})
      });
    }
  }
  return conversions;
}

function readJSON(filePath) {
  if (!fs.existsSync(filePath)) {
    console.error(`[convert-models.js] Required file not found: ${filePath}`);
    process.exit(1);
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    console.error(`[convert-models.js] Failed to read ${filePath}: ${error.message || error}`);
    process.exit(1);
  }
}

function parseStringTemplate(str, obj) {
  const parts = str.split(/\$\{(?!\d)[\wæøåÆØÅ]*\}/);
  const args = str.match(/[^{\}]+(?=})/g) || [];
  const parameters = args.map((argument) => obj[argument] || (obj[argument] === undefined ? "" : obj[argument]));
  return String.raw({raw: parts}, ...parameters);
}
