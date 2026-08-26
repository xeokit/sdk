#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

process.env.TS_NODE_COMPILER_OPTIONS = JSON.stringify({
  module: "commonjs",
  moduleResolution: "node",
  verbatimModuleSyntax: false
});

require("ts-node/register/transpile-only");

const {sdkRequire} = require("../../lib/sdk-require");

const {Scene} = sdkRequire("model/scene/Scene");
const {XGFLoader} = sdkRequire("formats/xgf/XGFLoader");
const {XGFStreamingExporter} = sdkRequire("formats/xgfstream/XGFStreamingExporter");
const {GLTFLoader} = sdkRequire("formats/gltf/GLTFLoader");
const {
  applyFixes,
  inspectSceneModel,
  optimizeSceneModel
} = sdkRequire("inspect/sceneModel");

const GEOMETRY_QUALITY_FIX_CODES = [
  "GEOMETRY_DEGENERATE_TRIANGLES",
  "GEOMETRY_UNUSED_VERTICES",
  "GEOMETRY_DUPLICATE_VERTICES",
  "GEOMETRY_NON_WATERTIGHT",
  "GEOMETRY_INCONSISTENT_WINDING",
  "GEOMETRY_AABB_NOT_TIGHT",
  "GEOMETRY_DUPLICATE_INDICES"
];

const SDK_DEFAULT_COORDINATE_SYSTEM = {
  basis: [1, 0, 0, 0, 0, 1, 0, 1, 0],
  origin: [0, 0, 0],
  units: "meters",
  scaleToMeters: 1
};

const ASSET_KINDS = ["geometries", "materials", "textures"];

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printUsage();
    return;
  }
  if (!args.input || !args.out) {
    printUsage();
    process.exit(1);
  }

  const inputPath = path.resolve(args.input);
  const outDir = path.resolve(args.out);
  const chunkSize = positiveInt(args.chunkSize || "500", "--chunk-size");
  const partition = args.partition || "grid";
  const chunkMetric = normalizeChunkMetric(args.chunkMetric || "objects");
  const chunkBudget = args.chunkBudget ? positiveNumber(args.chunkBudget, "--chunk-budget") : chunkSize;
  const minChunkBudget = args.minChunkBudget
    ? positiveNumber(args.minChunkBudget, "--min-chunk-budget")
    : Math.max(1, chunkBudget * 0.25);
  const gridCellSize = args.gridCellSize ? positiveNumber(args.gridCellSize, "--grid-cell-size") : undefined;
  const baseUri = trimSlashes(args.baseUri || "");
  const chunkDirName = trimSlashes(args.chunkDir || "chunks");
  const assetId = args.assetId || "assets";
  const assetLibraryChunkSize = args.assetLibraryChunkSize
    ? positiveInt(args.assetLibraryChunkSize, "--asset-library-chunk-size")
    : 0;
  const sharedAssetMinLibraryUses = args.sharedAssetMinLibraryUses
    ? positiveInt(args.sharedAssetMinLibraryUses, "--shared-asset-min-library-uses")
    : 2;
  const sharedAssetMode = normalizeSharedAssetMode(args.sharedAssetMode || "global");
  const sharedAssetShardSize = args.sharedAssetShardSize
    ? positiveInt(args.sharedAssetShardSize, "--shared-asset-shard-size")
    : 512;
  const indexName = args.index || "index.json";
  const runtimeIndexName = args.runtimeIndex;
  const modelId = args.modelId || path.basename(inputPath, path.extname(inputPath));
  const coordinateSystem = args.coordinateSystem ? readCoordinateSystem(args.coordinateSystem) : undefined;
  const outputCoordinateSystem = args.outputCoordinateSystem ? readOutputCoordinateSystem(args.outputCoordinateSystem) : coordinateSystem;
  const optimizeMaxVertices = args.optimizeMaxVertices ? positiveInt(args.optimizeMaxVertices, "--optimize-max-vertices") : 65535;
  const optimizeMaxPrimitives = args.optimizeMaxPrimitives ? positiveInt(args.optimizeMaxPrimitives, "--optimize-max-primitives") : 32768;

  const scene = new Scene({logging: false});
  const errors = [];
  scene.events.onError.subscribe((_scene, error) => errors.push(error));
  const sceneModelResult = scene.createModel({
    id: modelId,
    coordinateSystem
  });
  if (!sceneModelResult.ok) {
    throw new Error(sceneModelResult.error);
  }

  await loadSourceModel(inputPath, sceneModelResult.value);
  if (errors.length > 0) {
    throw new Error(`Failed to load source model: ${errors.map((error) => error.error || error).join("; ")}`);
  }

  const sceneModel = sceneModelResult.value;
  optimizeSourceSceneModel({
    sceneModel,
    enabled: !!(args.optimize || args.optimizeSimilarGeometries || args.optimizeGeometryQuality),
    includeSimilarGeometries: !!args.optimizeSimilarGeometries,
    includeGeometryQuality: !!args.optimizeGeometryQuality,
    maxVertices: optimizeMaxVertices,
    maxPrimitives: optimizeMaxPrimitives
  });

  const objectIds = Object.keys(sceneModel.objects).sort();
  if (objectIds.length === 0) {
    throw new Error(`Source model contains no objects: ${inputPath}`);
  }

  const chunks = createChunkSpecs({
    sceneModel,
    objectIds,
    partition,
    chunkSize,
    chunkMetric,
    chunkBudget,
    minChunkBudget,
    gridCellSize,
    baseUri,
    chunkDirName,
    assetId
  });

  const assetLibraries = createAssetLibrarySpecs({
    sceneModel,
    chunks,
    objectIds,
    assetId,
    assetLibraryChunkSize,
    sharedAssetMinLibraryUses,
    sharedAssetMode,
    sharedAssetShardSize,
    baseUri,
    chunkDirName
  });

  const exportResult = await new XGFStreamingExporter().write({
    sceneModel,
    assetLibraries,
    chunks,
    indexUri: joinUri(baseUri, indexName),
    runtimeIndexUri: runtimeIndexName ? joinUri(baseUri, runtimeIndexName) : undefined,
    coordinateSystem: outputCoordinateSystem
  });

  if (!exportResult.ok) {
    throw new Error(exportResult.error);
  }

  if (args.clean) {
    cleanOutputPaths(outDir, baseUri, chunkDirName, indexName, runtimeIndexName);
  }
  fs.mkdirSync(outDir, {recursive: true});
  let totalBytes = 0;
  for (const [uri, data] of Object.entries(exportResult.value.files)) {
    const relativePath = stripBaseUri(uri, baseUri);
    const filePath = path.join(outDir, relativePath);
    fs.mkdirSync(path.dirname(filePath), {recursive: true});
    if (data instanceof ArrayBuffer) {
      const buffer = Buffer.from(data);
      totalBytes += buffer.byteLength;
      fs.writeFileSync(filePath, buffer);
    } else {
      const json = `${JSON.stringify(data)}\n`;
      totalBytes += Buffer.byteLength(json);
      fs.writeFileSync(filePath, json, "utf8");
    }
  }

  console.log(`Input: ${inputPath}`);
  console.log(`Output: ${outDir}`);
  console.log(`Objects: ${objectIds.length}`);
  console.log(`Partition: ${partition}`);
  console.log(`Chunk metric: ${chunkMetric}`);
  console.log(`Chunks: ${chunks.length} (${chunkBudget} ${chunkMetric}/chunk max)`);
  console.log(`Asset libraries: ${assetLibraries.length}`);
  console.log(`Files: ${Object.keys(exportResult.value.files).length}`);
  console.log(`Bytes written: ${totalBytes}`);
  console.log(`Index: ${path.join(outDir, stripBaseUri(joinUri(baseUri, indexName), baseUri))}`);
  if (runtimeIndexName) {
    console.log(`Runtime index: ${path.join(outDir, stripBaseUri(joinUri(baseUri, runtimeIndexName), baseUri))}`);
  }
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      args.help = true;
      continue;
    }
    if (!arg.startsWith("--")) {
      throw new Error(`Unexpected argument: ${arg}`);
    }
    const key = arg.slice(2).replace(/-([a-z])/g, (_m, c) => c.toUpperCase());
    if (arg === "--clean") {
      args.clean = true;
      continue;
    }
    if (arg === "--optimize") {
      args.optimize = true;
      continue;
    }
    if (arg === "--optimize-similar-geometries") {
      args.optimizeSimilarGeometries = true;
      continue;
    }
    if (arg === "--optimize-geometry-quality") {
      args.optimizeGeometryQuality = true;
      continue;
    }
    const value = argv[++i];
    if (value === undefined || value.startsWith("--")) {
      throw new Error(`Missing value for ${arg}`);
    }
    args[key] = value;
  }
  return args;
}

function printUsage() {
  console.log(`Usage:
  node packages/website/tools/asset-pipeline/xgf-streaming/split-xgf-stream.js --input model.xgf --out ./streamed [options]
  node packages/website/tools/asset-pipeline/xgf-streaming/split-xgf-stream.js --input model.glb --out ./streamed [options]
  node packages/website/tools/asset-pipeline/xgf-streaming/split-xgf-stream.js --input model.gltf --out ./streamed [options]

Options:
  --chunk-size <n>   Maximum object count per references-only chunk. Default: 500
  --partition <mode> Chunk partitioning mode: grid or object-order. Default: grid
  --chunk-metric <m> Chunk budget metric for --partition grid: objects, meshes or geometry-bytes. Default: objects
  --chunk-budget <n> Maximum chunk budget in --chunk-metric units. Default: --chunk-size
  --min-chunk-budget <n>
                     Merge neighboring grid chunks below this budget when possible. Default: 25% of --chunk-budget
  --grid-cell-size <n>
                     World-space grid cell size for --partition grid. Default: auto
  --clean           Remove the output chunk directory and index before writing
  --optimize        Optimize the loaded SceneModel before chunking: validate, coalesce
                    exact duplicate geometries, split oversized geometries, and prune
                    unused resources
  --optimize-similar-geometries
                    With --optimize, also coalesce geometries with the same shape and
                    different placement. Slower than exact duplicate detection
  --optimize-geometry-quality
                    With --optimize, also run geometry-quality fixes such as unused
                    vertex compaction and duplicate-triangle removal
  --optimize-max-vertices <n>
                    Maximum vertices per optimized SceneGeometry. Default: 65535
  --optimize-max-primitives <n>
                    Maximum primitives per optimized SceneGeometry. Default: 32768
  --chunk-dir <dir>  Directory under --out for XGF chunks. Default: chunks
  --base-uri <uri>   URI prefix stored in manifests/index, eg models/building
  --asset-id <id>    Shared asset-library chunk ID. Default: assets
  --asset-library-chunk-size <n>
                     Create one asset-library chunk for each group of N
                     references-only chunks. Default: one shared asset library
  --shared-asset-min-library-uses <n>
                     With --asset-library-chunk-size, promote assets used by at
                     least N local library groups into one global shared asset
                     library. Default: 2
  --shared-asset-mode <mode>
                     How grouped asset libraries handle reused assets:
                     global, local or sharded. global creates one shared
                     dependency; local duplicates reused assets into local
                     asset libraries; sharded splits reused assets into
                     multiple shared dependencies. Default: global
  --shared-asset-shard-size <n>
                     With --shared-asset-mode sharded, maximum number of
                     reused assets per shared asset-library shard. Default: 512
  --index <name>     Aggregate index filename. Default: index.json
  --runtime-index <name>
                     Optional compact runtime index filename
  --coordinate-system <json>
                     Path to a SceneModel coordinate-system JSON file. Use this
                     when streamed chunks will be loaded into a SceneModel with
                     a non-default coordinate system.
  --output-coordinate-system <json|sdk-default>
                     Target coordinate system for emitted stream chunks and
                     index bounds. Use sdk-default for xeokit's native Z-up.
  --model-id <id>    Temporary SceneModel ID for loading. Default: input basename
`);
}

function readCoordinateSystem(filePath) {
  const coordinateSystem = JSON.parse(fs.readFileSync(path.resolve(filePath), "utf8"));
  if (!Array.isArray(coordinateSystem.basis) || coordinateSystem.basis.length !== 9) {
    throw new Error(`Invalid --coordinate-system '${filePath}': expected basis array with 9 numbers`);
  }
  if (!Array.isArray(coordinateSystem.origin) || coordinateSystem.origin.length !== 3) {
    throw new Error(`Invalid --coordinate-system '${filePath}': expected origin array with 3 numbers`);
  }
  if (!coordinateSystem.units) {
    throw new Error(`Invalid --coordinate-system '${filePath}': expected units`);
  }
  return coordinateSystem;
}

function readOutputCoordinateSystem(value) {
  if (value === "sdk-default") {
    return JSON.parse(JSON.stringify(SDK_DEFAULT_COORDINATE_SYSTEM));
  }
  return readCoordinateSystem(value);
}

async function loadSourceModel(inputPath, sceneModel) {
  const ext = path.extname(inputPath).toLowerCase();
  const fileData = readArrayBuffer(inputPath);
  if (ext === ".xgf") {
    await new XGFLoader().load({fileData, sceneModel});
    return;
  }
  if (ext === ".glb" || ext === ".gltf") {
    await new GLTFLoader().load(
      {fileData, sceneModel},
      {
        baseUri: pathToFileBaseUri(inputPath),
        retainTextureBytes: true
      }
    );
    return;
  }
  throw new Error(`Unsupported input format '${ext || "(none)"}'. Expected .xgf, .glb or .gltf`);
}

function optimizeSourceSceneModel({
  sceneModel,
  enabled,
  includeSimilarGeometries,
  includeGeometryQuality,
  maxVertices,
  maxPrimitives
}) {
  if (!enabled) {
    return;
  }

  const before = collectSceneModelStats(sceneModel);
  const report = inspectSceneModel({
    sceneModel,
    checkDuplicateGeometries: true,
    checkSimilarGeometries: includeSimilarGeometries,
    checkGeometryQuality: includeGeometryQuality
  });
  assertNoInspectionErrors(report, "pre-optimization");

  const codes = ["GEOMETRY_DUPLICATE"];
  if (includeSimilarGeometries) {
    codes.push("GEOMETRY_SIMILAR");
  }
  if (includeGeometryQuality) {
    codes.push(...GEOMETRY_QUALITY_FIX_CODES);
  }

  const fixResult = applyFixes({sceneModel, report, codes});
  if (!fixResult.ok) {
    throw new Error(fixResult.error);
  }
  if (fixResult.value.errors.length > 0) {
    throw new Error(summarizeFixErrors(fixResult.value.errors));
  }

  const optimizeResult = optimizeSceneModel({sceneModel, maxVertices, maxPrimitives});
  if (!optimizeResult.ok) {
    throw new Error(optimizeResult.error);
  }

  const after = collectSceneModelStats(sceneModel);
  console.log(
    [
      "SceneModel optimized:",
      `geometries ${before.geometries} -> ${after.geometries}`,
      `geometry bytes ${before.geometryBytes} -> ${after.geometryBytes}`,
      `meshes ${before.meshes} -> ${after.meshes}`,
      `materials ${before.materials} -> ${after.materials}`,
      `textures ${before.textures} -> ${after.textures}`,
      `fixes ${fixResult.value.fixed.length}`,
      `skipped ${fixResult.value.skipped.length}`
    ].join(" ")
  );
}

function assertNoInspectionErrors(report, phase) {
  if (report.errors.length === 0) {
    return;
  }
  const summary = report.errors
    .slice(0, 5)
    .map((issue) => `  ${issue.code}: ${issue.message}`)
    .join("\n");
  const overflow = report.errors.length > 5 ? `\n  ...and ${report.errors.length - 5} more` : "";
  throw new Error(`SceneModel ${phase} inspection failed (${report.errors.length} errors):\n${summary}${overflow}`);
}

function summarizeFixErrors(errors) {
  const summary = errors
    .slice(0, 5)
    .map((outcome) => {
      const issue = outcome.issue;
      return `  ${issue.code}: ${outcome.error || issue.message}`;
    })
    .join("\n");
  const overflow = errors.length > 5 ? `\n  ...and ${errors.length - 5} more` : "";
  return `SceneModel optimization fixes failed (${errors.length} errors):\n${summary}${overflow}`;
}

function collectSceneModelStats(sceneModel) {
  let geometryBytes = 0;
  for (const geometryId in sceneModel.geometries) {
    const geometry = sceneModel.geometries[geometryId];
    geometryBytes += arrayByteLength(geometry.positionsCompressed);
    geometryBytes += arrayByteLength(geometry.colorsCompressed);
    geometryBytes += arrayByteLength(geometry.normalsCompressed);
    geometryBytes += arrayByteLength(geometry.uvsCompressed);
    geometryBytes += arrayByteLength(geometry.indices);
    geometryBytes += arrayByteLength(geometry.edgeIndices);
    geometryBytes += arrayByteLength(geometry.scales);
    geometryBytes += arrayByteLength(geometry.rotations);
    geometryBytes += arrayByteLength(geometry.aabb);
  }
  return {
    objects: Object.keys(sceneModel.objects).length,
    meshes: Object.keys(sceneModel.meshes).length,
    geometries: Object.keys(sceneModel.geometries).length,
    materials: Object.keys(sceneModel.materials).length,
    textures: Object.keys(sceneModel.textures).length,
    transforms: Object.keys(sceneModel.transforms).length,
    geometryBytes
  };
}

function readArrayBuffer(filePath) {
  const buffer = fs.readFileSync(filePath);
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}

function positiveInt(value, name) {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return n;
}

function positiveNumber(value, name) {
  const n = Number.parseFloat(value);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error(`${name} must be a positive number`);
  }
  return n;
}

function normalizeChunkMetric(value) {
  if (value === "objects" || value === "meshes" || value === "geometry-bytes") {
    return value;
  }
  throw new Error(`Unsupported --chunk-metric '${value}'. Expected objects, meshes or geometry-bytes`);
}

function normalizeSharedAssetMode(value) {
  if (value === "global" || value === "local" || value === "sharded") {
    return value;
  }
  throw new Error(`Unsupported --shared-asset-mode '${value}'. Expected global, local or sharded`);
}

function createChunkSpecs({
  sceneModel,
  objectIds,
  partition,
  chunkSize,
  chunkMetric,
  chunkBudget,
  minChunkBudget,
  gridCellSize,
  baseUri,
  chunkDirName,
  assetId
}) {
  if (partition === "object-order") {
    return createObjectOrderChunkSpecs({objectIds, chunkSize, baseUri, chunkDirName, assetId});
  }
  if (partition === "grid") {
    return createGridChunkSpecs({
      sceneModel,
      objectIds,
      chunkMetric,
      chunkBudget,
      minChunkBudget,
      gridCellSize,
      baseUri,
      chunkDirName,
      assetId
    });
  }
  throw new Error(`Unsupported --partition '${partition}'. Expected object-order or grid`);
}

function createObjectOrderChunkSpecs({objectIds, chunkSize, baseUri, chunkDirName, assetId}) {
  const chunks = [];
  for (let offset = 0, chunkIndex = 0; offset < objectIds.length; offset += chunkSize, chunkIndex++) {
    const id = numberedChunkId(chunkIndex);
    chunks.push(createChunkSpec(id, objectIds.slice(offset, offset + chunkSize), chunkIndex, baseUri, chunkDirName, assetId));
  }
  return chunks;
}

function createGridChunkSpecs({
  sceneModel,
  objectIds,
  chunkMetric,
  chunkBudget,
  minChunkBudget,
  gridCellSize,
  baseUri,
  chunkDirName,
  assetId
}) {
  const records = [];
  const unboundedObjectIds = [];
  const modelAABB = collapseAABB3();
  for (const objectId of objectIds) {
    const sceneObject = sceneModel.objects[objectId];
    const aabb = computeObjectAABB(sceneObject);
    if (!aabb) {
      unboundedObjectIds.push(objectId);
      continue;
    }
    expandAABB3(modelAABB, aabb);
    records.push({
      id: objectId,
      aabb,
      center: aabbCenter(aabb),
      cost: estimateObjectCost(sceneObject, chunkMetric)
    });
  }
  if (records.length === 0) {
    return createObjectOrderChunkSpecs({objectIds, chunkSize: Math.max(1, Math.floor(chunkBudget)), baseUri, chunkDirName, assetId});
  }

  const totalCost = sumRecordCost(records);
  const cellSize = gridCellSize || autoGridCellSize(modelAABB, totalCost, chunkBudget);
  const buckets = new Map();
  for (const record of records) {
    const coord = gridCoord(record.center, modelAABB, cellSize);
    const key = coord.join(",");
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = {
        coord,
        records: []
      };
      buckets.set(key, bucket);
    }
    bucket.records.push(record);
  }

  let spatialGroups = [];
  const sortedBuckets = Array.from(buckets.values()).sort(compareBucket);
  for (const bucket of sortedBuckets) {
    const groups = splitOversizedGroup(bucket.records, chunkBudget);
    for (const group of groups) {
      spatialGroups.push(createSpatialGroup(bucket.coord, group));
    }
  }
  spatialGroups = mergeUndersizedGroups(spatialGroups, minChunkBudget, chunkBudget);

  const chunks = [];
  let chunkIndex = 0;
  for (const group of spatialGroups) {
    const suffix = group.coord.map((value, axis) => `${"xyz"[axis]}${signedCoord(value)}`).join("-");
    const part = countCoordOccurrence(chunks, suffix);
    const id = `chunk-${String(chunkIndex).padStart(5, "0")}-${suffix}${part > 0 ? `-${part}` : ""}`;
    chunks.push(createChunkSpec(id, group.records.map(record => record.id).sort(), chunkIndex, baseUri, chunkDirName, assetId));
    chunkIndex++;
  }

  const unboundedChunkSize = Math.max(1, Math.floor(chunkBudget));
  for (let offset = 0; offset < unboundedObjectIds.length; offset += unboundedChunkSize) {
    const id = `${numberedChunkId(chunkIndex)}-unbounded`;
    chunks.push(createChunkSpec(id, unboundedObjectIds.slice(offset, offset + unboundedChunkSize), chunkIndex, baseUri, chunkDirName, assetId));
    chunkIndex++;
  }
  return chunks;
}

function createChunkSpec(id, objectIds, priority, baseUri, chunkDirName, assetId) {
  return {
    id,
    uri: joinUri(baseUri, chunkDirName, `${id}.xgf`),
    objectIds,
    assetLibraryIds: [assetId],
    priority
  };
}

function createAssetLibrarySpecs({
  sceneModel,
  chunks,
  objectIds,
  assetId,
  assetLibraryChunkSize,
  sharedAssetMinLibraryUses,
  sharedAssetMode,
  sharedAssetShardSize,
  baseUri,
  chunkDirName
}) {
  if (!assetLibraryChunkSize || assetLibraryChunkSize >= chunks.length) {
    for (const chunk of chunks) {
      chunk.assetLibraryIds = [assetId];
    }
    return [{
      id: assetId,
      uri: joinUri(baseUri, chunkDirName, `${assetId}.xgf`),
      objectIds
    }];
  }

  const groups = [];
  for (let offset = 0, libraryIndex = 0; offset < chunks.length; offset += assetLibraryChunkSize, libraryIndex++) {
    const chunksInGroup = chunks.slice(offset, offset + assetLibraryChunkSize);
    const libraryId = `${assetId}-${String(libraryIndex).padStart(3, "0")}`;
    const libraryObjectIds = new Set();
    for (const chunk of chunksInGroup) {
      for (const objectId of chunk.objectIds) {
        libraryObjectIds.add(objectId);
      }
    }
    groups.push({
      id: libraryId,
      uri: joinUri(baseUri, chunkDirName, `${libraryId}.xgf`),
      priority: libraryIndex + 1,
      chunks: chunksInGroup,
      assets: collectAssetIds(sceneModel, Array.from(libraryObjectIds))
    });
  }

  const sharedAssets = sharedAssetMode === "local"
    ? emptyAssets()
    : collectSharedAssets(groups, sharedAssetMinLibraryUses);
  const hasSharedAssets = hasAnyAsset(sharedAssets);
  const sharedLibraryId = `${assetId}-shared`;
  const libraries = [];
  const shardedSharedAssets = sharedAssetMode === "sharded" && hasSharedAssets
    ? createSharedAssetShards({
      groups,
      sharedAssets,
      assetId,
      sharedAssetShardSize,
      baseUri,
      chunkDirName
    })
    : null;
  if (sharedAssetMode === "global" && hasSharedAssets) {
    libraries.push({
      id: sharedLibraryId,
      uri: joinUri(baseUri, chunkDirName, `${sharedLibraryId}.xgf`),
      geometryIds: Array.from(sharedAssets.geometries).sort(),
      materialIds: Array.from(sharedAssets.materials).sort(),
      textureIds: Array.from(sharedAssets.textures).sort(),
      priority: 0
    });
  }
  if (shardedSharedAssets) {
    libraries.push(...shardedSharedAssets.libraries);
  }

  for (const group of groups) {
    const localAssets = subtractAssets(group.assets, sharedAssets);
    const groupLibraryIds = [];
    if (sharedAssetMode === "global" && hasSharedAssets) {
      groupLibraryIds.push(sharedLibraryId);
    }
    if (shardedSharedAssets) {
      groupLibraryIds.push(...sharedShardIdsForAssets(group.assets, shardedSharedAssets.assetToShardIds));
    }
    if (hasAnyAsset(localAssets)) {
      libraries.push({
        id: group.id,
        uri: group.uri,
        geometryIds: Array.from(localAssets.geometries).sort(),
        materialIds: Array.from(localAssets.materials).sort(),
        textureIds: Array.from(localAssets.textures).sort(),
        priority: group.priority
      });
      groupLibraryIds.push(group.id);
    }
    for (const chunk of group.chunks) {
      chunk.assetLibraryIds = groupLibraryIds.slice();
    }
  }
  return libraries;
}

function collectAssetIds(sceneModel, objectIds) {
  const assets = {
    geometries: new Set(),
    materials: new Set(),
    textures: new Set()
  };
  for (const objectId of objectIds) {
    const object = sceneModel.objects[objectId];
    if (!object) {
      continue;
    }
    for (const mesh of object.meshes || []) {
      if (mesh.geometry) {
        assets.geometries.add(mesh.geometry.id);
      }
      if (mesh.material) {
        assets.materials.add(mesh.material.id);
        addMaterialTextureIds(mesh.material, assets.textures);
      }
    }
  }
  return assets;
}

function emptyAssets() {
  return {
    geometries: new Set(),
    materials: new Set(),
    textures: new Set()
  };
}

function createSharedAssetShards({
  groups,
  sharedAssets,
  assetId,
  sharedAssetShardSize,
  baseUri,
  chunkDirName
}) {
  const libraries = [];
  const assetToShardIds = {
    geometries: new Map(),
    materials: new Map(),
    textures: new Map()
  };
  const records = sharedAssetRecords(groups, sharedAssets);
  let shardIndex = 0;
  let shardId = "";
  let shardAssets = emptyAssets();
  let shardAssetCount = 0;

  const startShard = () => {
    shardId = `${assetId}-shared-${String(shardIndex).padStart(3, "0")}`;
    shardAssets = emptyAssets();
    shardAssetCount = 0;
    shardIndex++;
  };
  const flushShard = () => {
    if (shardAssetCount === 0) {
      return;
    }
    libraries.push({
      id: shardId,
      uri: joinUri(baseUri, chunkDirName, `${shardId}.xgf`),
      geometryIds: Array.from(shardAssets.geometries).sort(),
      materialIds: Array.from(shardAssets.materials).sort(),
      textureIds: Array.from(shardAssets.textures).sort(),
      priority: 0
    });
  };

  startShard();
  for (const record of records) {
    if (shardAssetCount >= sharedAssetShardSize) {
      flushShard();
      startShard();
    }
    shardAssets[record.kind].add(record.id);
    assetToShardIds[record.kind].set(record.id, shardId);
    shardAssetCount++;
  }
  flushShard();

  return {libraries, assetToShardIds};
}

function sharedAssetRecords(groups, sharedAssets) {
  const records = [];
  for (const kind of ASSET_KINDS) {
    for (const id of sharedAssets[kind]) {
      const usage = groupAssetUsage(groups, kind, id);
      records.push({
        kind,
        id,
        firstGroup: usage.firstGroup,
        uses: usage.uses,
        groupIds: usage.groupIds
      });
    }
  }
  // Keep assets used by the same asset-library groups adjacent before
  // fixed-size shard packing, reducing dependency fan-out per visible group.
  return records.sort((a, b) =>
    a.firstGroup - b.firstGroup
      || compareGroupIds(a.groupIds, b.groupIds)
      || b.uses - a.uses
      || ASSET_KINDS.indexOf(a.kind) - ASSET_KINDS.indexOf(b.kind)
      || a.id.localeCompare(b.id)
  );
}

function compareGroupIds(a, b) {
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const diff = a[i] - b[i];
    if (diff !== 0) {
      return diff;
    }
  }
  return a.length - b.length;
}

function groupAssetUsage(groups, kind, id) {
  let firstGroup = Number.POSITIVE_INFINITY;
  const groupIds = [];
  for (let i = 0; i < groups.length; i++) {
    if (groups[i].assets[kind].has(id)) {
      firstGroup = Math.min(firstGroup, i);
      groupIds.push(i);
    }
  }
  return {firstGroup, uses: groupIds.length, groupIds};
}

function sharedShardIdsForAssets(assets, assetToShardIds) {
  const shardIds = new Set();
  for (const kind of ASSET_KINDS) {
    for (const id of assets[kind]) {
      const shardId = assetToShardIds[kind].get(id);
      if (shardId) {
        shardIds.add(shardId);
      }
    }
  }
  return Array.from(shardIds).sort();
}

function addMaterialTextureIds(material, textures) {
  addTextureId(textures, material.colorTexture);
  addTextureId(textures, material.metallicRoughnessTexture);
  addTextureId(textures, material.normalsTexture);
  addTextureId(textures, material.occlusionTexture);
  addTextureId(textures, material.emissiveTexture);
}

function addTextureId(textures, texture) {
  if (texture) {
    textures.add(texture.id);
  }
}

function collectSharedAssets(groups, minUses) {
  const geometryUses = countGroupUses(groups, "geometries");
  const materialUses = countGroupUses(groups, "materials");
  const textureUses = countGroupUses(groups, "textures");
  return {
    geometries: idsWithMinUses(geometryUses, minUses),
    materials: idsWithMinUses(materialUses, minUses),
    textures: idsWithMinUses(textureUses, minUses)
  };
}

function countGroupUses(groups, kind) {
  const uses = new Map();
  for (const group of groups) {
    for (const id of group.assets[kind]) {
      uses.set(id, (uses.get(id) || 0) + 1);
    }
  }
  return uses;
}

function idsWithMinUses(uses, minUses) {
  const ids = new Set();
  for (const [id, count] of uses) {
    if (count >= minUses) {
      ids.add(id);
    }
  }
  return ids;
}

function subtractAssets(assets, excluded) {
  return {
    geometries: subtractSet(assets.geometries, excluded.geometries),
    materials: subtractSet(assets.materials, excluded.materials),
    textures: subtractSet(assets.textures, excluded.textures)
  };
}

function subtractSet(source, excluded) {
  const result = new Set();
  for (const id of source) {
    if (!excluded.has(id)) {
      result.add(id);
    }
  }
  return result;
}

function hasAnyAsset(assets) {
  return assets.geometries.size > 0 || assets.materials.size > 0 || assets.textures.size > 0;
}

function numberedChunkId(chunkIndex) {
  return `chunk-${String(chunkIndex).padStart(5, "0")}`;
}

function computeObjectAABB(sceneObject) {
  if (!sceneObject || !Array.isArray(sceneObject.meshes) || sceneObject.meshes.length === 0) {
    return null;
  }
  const out = collapseAABB3();
  let found = false;
  for (const mesh of sceneObject.meshes) {
    const geom = mesh.geometry;
    if (!geom || !geom.aabb) {
      continue;
    }
    expandAABB3(out, transformAABB3(geom.aabb, mesh.worldMatrix));
    found = true;
  }
  return found ? out : null;
}

function estimateObjectCost(sceneObject, metric) {
  if (metric === "objects") {
    return 1;
  }
  const meshes = sceneObject?.meshes || [];
  if (metric === "meshes") {
    return Math.max(1, meshes.length);
  }
  const geometryIds = new Set();
  let bytes = 0;
  for (const mesh of meshes) {
    const geometry = mesh.geometry;
    if (!geometry || geometryIds.has(geometry.id)) {
      continue;
    }
    geometryIds.add(geometry.id);
    bytes += arrayByteLength(geometry.positionsCompressed);
    bytes += arrayByteLength(geometry.colorsCompressed);
    bytes += arrayByteLength(geometry.normalsCompressed);
    bytes += arrayByteLength(geometry.uvsCompressed);
    bytes += arrayByteLength(geometry.indices);
    bytes += arrayByteLength(geometry.edgeIndices);
    bytes += arrayByteLength(geometry.scales);
    bytes += arrayByteLength(geometry.rotations);
    bytes += arrayByteLength(geometry.aabb);
  }
  return Math.max(1, bytes);
}

function arrayByteLength(value) {
  return value && typeof value.byteLength === "number" ? value.byteLength : 0;
}

function transformAABB3(local, matrix) {
  const minX = local[0], minY = local[1], minZ = local[2];
  const maxX = local[3], maxY = local[4], maxZ = local[5];

  const cx = (minX + maxX) * 0.5;
  const cy = (minY + maxY) * 0.5;
  const cz = (minZ + maxZ) * 0.5;
  const ex = (maxX - minX) * 0.5;
  const ey = (maxY - minY) * 0.5;
  const ez = (maxZ - minZ) * 0.5;

  const m00 = matrix[0],  m01 = matrix[4],  m02 = matrix[8],  m03 = matrix[12];
  const m10 = matrix[1],  m11 = matrix[5],  m12 = matrix[9],  m13 = matrix[13];
  const m20 = matrix[2],  m21 = matrix[6],  m22 = matrix[10], m23 = matrix[14];

  const wcx = m00 * cx + m01 * cy + m02 * cz + m03;
  const wcy = m10 * cx + m11 * cy + m12 * cz + m13;
  const wcz = m20 * cx + m21 * cy + m22 * cz + m23;
  const wex = Math.abs(m00) * ex + Math.abs(m01) * ey + Math.abs(m02) * ez;
  const wey = Math.abs(m10) * ex + Math.abs(m11) * ey + Math.abs(m12) * ez;
  const wez = Math.abs(m20) * ex + Math.abs(m21) * ey + Math.abs(m22) * ez;

  return [
    wcx - wex,
    wcy - wey,
    wcz - wez,
    wcx + wex,
    wcy + wey,
    wcz + wez
  ];
}

function collapseAABB3() {
  return [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY];
}

function expandAABB3(out, aabb) {
  out[0] = Math.min(out[0], aabb[0]);
  out[1] = Math.min(out[1], aabb[1]);
  out[2] = Math.min(out[2], aabb[2]);
  out[3] = Math.max(out[3], aabb[3]);
  out[4] = Math.max(out[4], aabb[4]);
  out[5] = Math.max(out[5], aabb[5]);
  return out;
}

function aabbCenter(aabb) {
  return [
    (aabb[0] + aabb[3]) * 0.5,
    (aabb[1] + aabb[4]) * 0.5,
    (aabb[2] + aabb[5]) * 0.5
  ];
}

function autoGridCellSize(modelAABB, totalCost, chunkBudget) {
  const x = Math.max(modelAABB[3] - modelAABB[0], 1);
  const y = Math.max(modelAABB[4] - modelAABB[1], 1);
  const z = Math.max(modelAABB[5] - modelAABB[2], 1);
  const volume = x * y * z;
  const targetChunks = Math.max(1, Math.ceil(totalCost / chunkBudget));
  return Math.max(Math.cbrt(volume / targetChunks), 1);
}

function gridCoord(center, modelAABB, cellSize) {
  return [
    Math.floor((center[0] - modelAABB[0]) / cellSize),
    Math.floor((center[1] - modelAABB[1]) / cellSize),
    Math.floor((center[2] - modelAABB[2]) / cellSize)
  ];
}

function splitOversizedGroup(records, chunkBudget) {
  if (records.length <= 1 || sumRecordCost(records) <= chunkBudget) {
    return [records];
  }
  const axis = longestCenterAxis(records);
  const sorted = records.slice().sort((a, b) => a.center[axis] - b.center[axis] || a.id.localeCompare(b.id));
  const mid = Math.ceil(sorted.length / 2);
  return [
    ...splitOversizedGroup(sorted.slice(0, mid), chunkBudget),
    ...splitOversizedGroup(sorted.slice(mid), chunkBudget)
  ];
}

function createSpatialGroup(coord, records) {
  const aabb = collapseAABB3();
  for (const record of records) {
    expandAABB3(aabb, record.aabb);
  }
  return {
    coord,
    records,
    cost: sumRecordCost(records),
    aabb,
    center: aabbCenter(aabb)
  };
}

function mergeUndersizedGroups(groups, minChunkBudget, chunkBudget) {
  if (groups.length < 2 || minChunkBudget <= 1) {
    return groups;
  }
  const merged = [];
  const used = new Set();
  const bySmallest = groups
    .map((group, index) => ({group, index}))
    .sort((a, b) => a.group.cost - b.group.cost || compareBucket(a.group, b.group));
  for (const item of bySmallest) {
    if (used.has(item.index)) {
      continue;
    }
    const group = item.group;
    if (group.cost >= minChunkBudget) {
      used.add(item.index);
      merged.push(group);
      continue;
    }
    let bestIndex = -1;
    let bestScore = Number.POSITIVE_INFINITY;
    for (let i = 0; i < groups.length; i++) {
      if (i === item.index || used.has(i)) {
        continue;
      }
      const candidate = groups[i];
      if (group.cost + candidate.cost > chunkBudget) {
        continue;
      }
      const score = centerDistanceSquared(group.center, candidate.center);
      if (score < bestScore) {
        bestScore = score;
        bestIndex = i;
      }
    }
    used.add(item.index);
    if (bestIndex !== -1) {
      used.add(bestIndex);
      merged.push(mergeSpatialGroups(group, groups[bestIndex]));
    } else {
      merged.push(group);
    }
  }
  return merged.sort(compareBucket);
}

function mergeSpatialGroups(a, b) {
  const records = a.records.concat(b.records);
  const aabb = collapseAABB3();
  expandAABB3(aabb, a.aabb);
  expandAABB3(aabb, b.aabb);
  return {
    coord: a.coord,
    records,
    cost: a.cost + b.cost,
    aabb,
    center: aabbCenter(aabb)
  };
}

function centerDistanceSquared(a, b) {
  const x = a[0] - b[0];
  const y = a[1] - b[1];
  const z = a[2] - b[2];
  return x * x + y * y + z * z;
}

function sumRecordCost(records) {
  return records.reduce((sum, record) => sum + record.cost, 0);
}

function longestCenterAxis(records) {
  const min = [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY];
  const max = [Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY];
  for (const record of records) {
    for (let i = 0; i < 3; i++) {
      min[i] = Math.min(min[i], record.center[i]);
      max[i] = Math.max(max[i], record.center[i]);
    }
  }
  const extents = [max[0] - min[0], max[1] - min[1], max[2] - min[2]];
  if (extents[1] > extents[0] && extents[1] >= extents[2]) return 1;
  if (extents[2] > extents[0] && extents[2] > extents[1]) return 2;
  return 0;
}

function compareBucket(a, b) {
  return a.coord[0] - b.coord[0] || a.coord[1] - b.coord[1] || a.coord[2] - b.coord[2];
}

function signedCoord(value) {
  return value < 0 ? `m${Math.abs(value)}` : String(value).padStart(3, "0");
}

function countCoordOccurrence(chunks, suffix) {
  return chunks.reduce((count, chunk) => chunk.id.includes(suffix) ? count + 1 : count, 0);
}

function trimSlashes(value) {
  return String(value || "").replace(/^\/+|\/+$/g, "");
}

function joinUri(...parts) {
  return parts.filter((part) => part !== undefined && part !== null && String(part).length > 0)
    .map((part) => trimSlashes(part))
    .filter((part) => part.length > 0)
    .join("/");
}

function stripBaseUri(uri, baseUri) {
  if (!baseUri) {
    return uri;
  }
  const prefix = `${trimSlashes(baseUri)}/`;
  return uri.startsWith(prefix) ? uri.slice(prefix.length) : uri;
}

function cleanOutputPaths(outDir, baseUri, chunkDirName, indexName, runtimeIndexName) {
  const chunkPath = path.join(outDir, stripBaseUri(chunkDirName, baseUri));
  const indexPath = path.join(outDir, stripBaseUri(joinUri(baseUri, indexName), baseUri));
  if (chunkDirName && chunkDirName !== "." && chunkPath !== outDir) {
    fs.rmSync(chunkPath, {recursive: true, force: true});
  }
  fs.rmSync(indexPath, {force: true});
  if (runtimeIndexName) {
    fs.rmSync(path.join(outDir, stripBaseUri(joinUri(baseUri, runtimeIndexName), baseUri)), {force: true});
  }
}

function pathToFileBaseUri(filePath) {
  const dir = path.dirname(path.resolve(filePath));
  return `file://${dir.replace(/\\/g, "/")}/`;
}
