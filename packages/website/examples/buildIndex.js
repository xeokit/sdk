// File: buildIndex.js
const fs = require('fs').promises;
const path = require('path');

const MODELS_DIR = path.join(__dirname, '.');
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
  "fbx": ["fbx"],
  "ifc": ["ifc"],
  "laz": ["laz"],
  "dotbim": ["dotbim"],
  "usdz": ["usdz"],
  "splat": ["splat"],
  "xkt": ["xkt"],
  "cityjson": ["cityjson"],
  "threedxml": ["threedxml"],
  "e57": ["e57"]
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

async function readExampleIndex(modelDir) {
  const indexPath = path.join(modelDir, 'index.json');
  try {
    const data = await fs.readFile(indexPath, 'utf8');
    return JSON.parse(data);
  } catch (e) {
    return {};
  }
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

    // Read the example's index.json as flat metadata.
    const exampleIndex = await readExampleIndex(modelDir);
    Object.assign(modelObj, exampleIndex);
    if (Object.prototype.hasOwnProperty.call(exampleIndex, "isVisualTest")) {
      modelObj.isVisualTest = exampleIndex.isVisualTest;
    }

    // Find all format subdirs that contain at least one model.* file,
    // and note which also carry an optimized variant beside the original
    // (`model.optimized.<ext>`, written by optimizeModels.js).
    const formats = await fs.readdir(modelDir, { withFileTypes: true });
    const formatNames = [];
    const optimizedFormats = [];

    for (const fmtEntry of formats) {
      if (!fmtEntry.isDirectory()) continue;

      const formatName = fmtEntry.name;
      const formatDir = path.join(modelDir, formatName);

      const modelFiles = await findModelFiles(formatDir);
      if (modelFiles.length > 0) {
        formatNames.push(formatName);
        // `model.optimized.<ext>` (a single trailing extension) — excludes the
        // `model.optimized.report.json` sidecar (which has an extra dot).
        const dirFiles = await fs.readdir(formatDir);
        if (dirFiles.some(name => /^model\.optimized\.[^.]+$/.test(name))) {
          optimizedFormats.push(formatName);
        }
      }
    }

    const sortedFormats = formatNames.sort();

    if (sortedFormats.length > 0) {
      modelObj.formats = sortedFormats;
    }

    // Consumers (DefaultModelLocator.preload) read this to load the optimized
    // file for these formats, falling back to the original otherwise.
    if (optimizedFormats.length > 0) {
      modelObj.optimized = optimizedFormats.sort();
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

buildIndex().catch(err => {
  console.error('Error building model index:', err);
  process.exit(1);
});
