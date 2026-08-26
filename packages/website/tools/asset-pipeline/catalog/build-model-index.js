const fs = require('fs').promises;
const path = require('path');

const REPO_DIR = path.resolve(__dirname, "..", "..", "..", "..", "..");
const MODELS_DIR = path.join(REPO_DIR, "packages", "website", "models");
const OUTPUT_FILE = path.join(MODELS_DIR, 'index.json');

/**
 * Configure dataset IDs and the format combinations they require.
 *
 * Each key is the dataset ID to emit in index.json.
 * Each value is an array of format names that must all be present on a model.
 */
const DATASET_COMBINATIONS = {
  "mtl-obj": ["mtl", "obj"],
  "datamodel-scenemodel": ["datamodel", "scenemodel"],
  "datamodel-xgf": ["datamodel", "xgf"],
  "datamodel-gltf": ["datamodel", "gltf"],
  "scenemodel": ["scenemodel"],
  "xgf": ["xgf"],
  "gltf": ["gltf"],
  "citygml": ["citygml"],
  "fbx": ["fbx"],
  "ifc": ["ifc"],
  "laz": ["laz"],
  "dotbim": ["dotbim"],
  "usdz": ["usdz"],
  "xgfstream": ["xgfstream"]
};

async function findModelFiles(dir) {
  let results = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results = results.concat(await findModelFiles(fullPath));
    } else if (entry.isFile() && entry.name.startsWith('model.')) {
      results.push(fullPath);
    }
  }

  return results;
}

async function readTopLevelJsonFiles(modelDir) {
  const result = {};
  const entries = await fs.readdir(modelDir, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (!entry.name.endsWith('.json')) continue;
    if (entry.name === 'metadata.json') continue;

    const jsonPath = path.join(modelDir, entry.name);
    const fieldName = path.basename(entry.name, '.json');

    try {
      const data = await fs.readFile(jsonPath, 'utf8');
      result[fieldName] = JSON.parse(data);
    } catch (e) {
      // Skip invalid or unreadable JSON files
    }
  }

  return result;
}

function buildDatasetArray(formatNames, datasetCombinations) {
  const formatSet = new Set(formatNames);
  const datasets = [];

  for (const requiredFormats of Object.values(datasetCombinations)) {
    const hasAllFormats = requiredFormats.every(format => formatSet.has(format));
    if (hasAllFormats) {
      datasets.push(requiredFormats.join(','));
    }
  }

  return datasets;
}

/**
 * Custom JSON stringify:
 * - Keeps pretty object formatting
 * - Forces all arrays onto a single line
 */
function stringifyWithInlineArrays(obj) {
  const json = JSON.stringify(obj, null, 2);

  return json.replace(
    /\[\s*([\s\S]*?)\s*\]/g,
    (match) => {
      const compact = match
        .replace(/\s+/g, ' ')
        .replace(/\s*,\s*/g, ', ')
        .replace(/\[\s*/, '[')
        .replace(/\s*\]/, ']');

      return compact;
    }
  );
}

async function buildIndex() {
  const index = {};
  const entries = await fs.readdir(MODELS_DIR, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const modelName = entry.name;
    const modelDir = path.join(MODELS_DIR, modelName);

    // Skip hidden/system dirs
    if (modelName.startsWith('.')) continue;

    const modelObj = {};

    // Read any top-level JSON files in the model directory
    Object.assign(modelObj, await readTopLevelJsonFiles(modelDir));

    // Find all format subdirs that contain at least one model.* file
    const formats = await fs.readdir(modelDir, { withFileTypes: true });
    const formatNames = [];

    for (const fmtEntry of formats) {
      if (!fmtEntry.isDirectory()) continue;

      const formatName = fmtEntry.name;
      const formatDir = path.join(modelDir, formatName);

      const modelFiles = await findModelFiles(formatDir);
      if (formatName === "xgfstream" && await hasXGFStreamIndex(formatDir)) {
        modelFiles.push(path.join(formatDir, "index.runtime.json"));
      }
      if (modelFiles.length > 0) {
        formatNames.push(formatName);
      }
    }

    const sortedFormats = formatNames.sort();

    if (sortedFormats.length > 0) {
      modelObj.formats = sortedFormats;
    }

    const dataset = buildDatasetArray(sortedFormats, DATASET_COMBINATIONS);
    if (dataset.length > 0) {
      modelObj.dataset = dataset;
    }

    // Only add if there is at least one JSON-derived field or at least one format or dataset
    if (Object.keys(modelObj).length > 0) {
      index[modelName] = modelObj;
    }
  }

  await fs.writeFile(OUTPUT_FILE, stringifyWithInlineArrays(index));
  console.log(`Model index written to ${OUTPUT_FILE}`);
}

async function hasXGFStreamIndex(formatDir) {
  for (const fileName of ["index.runtime.json", "index.json"]) {
    try {
      await fs.access(path.join(formatDir, fileName));
      return true;
    } catch (e) {
      // Try the next conventional stream index name.
    }
  }
  return false;
}

buildIndex().catch(err => {
  console.error('Error building model index:', err);
  process.exit(1);
});
