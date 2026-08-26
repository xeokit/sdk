#!/usr/bin/env node

"use strict";

process.env.TS_NODE_COMPILER_OPTIONS = JSON.stringify({
  module: "commonjs",
  moduleResolution: "node",
  verbatimModuleSyntax: false
});

require("ts-node/register/transpile-only");

const {sdkRequire} = require("../../lib/sdk-require");

const fs = require("fs");
const path = require("path");
const {fileURLToPath, pathToFileURL} = require("url");

const {Scene} = sdkRequire("model/scene/Scene");
const {Data} = sdkRequire("model/data/Data");
const {XGFExporter} = sdkRequire("formats/xgf/XGFExporter");

const REPO_DIR = path.resolve(__dirname, "..", "..", "..", "..", "..");
const nativeFetch = globalThis.fetch;

globalThis.fetch = async function fetchWithLocalFileSupport(input, init) {
  const url = typeof input === "string" ? input : input && input.url;
  if (typeof url === "string" && url.startsWith("file://")) {
    try {
      return new Response(fs.readFileSync(fileURLToPath(url)), {status: 200});
    } catch {
      return new Response(null, {status: 404});
    }
  }
  if (!nativeFetch) {
    throw new Error(`No fetch implementation available for '${url}'`);
  }
  return nativeFetch(input, init);
};

const FORMAT_BY_EXTENSION = {
  ".xgf": "xgf",
  ".ifc": "ifc",
  ".glb": "gltf",
  ".gltf": "gltf",
  ".fbx": "fbx",
  ".usdz": "usdz",
  ".e57": "e57",
  ".las": "las",
  ".laz": "laz",
  ".splat": "splat",
  ".obj": "obj",
  ".mtl": "mtl",
  ".ply": "ply",
  ".dotbim": "dotbim",
  ".cityjson": "cityjson",
  ".citygml": "citygml",
  ".gml": "citygml",
  ".fds": "fds",
  ".3dxml": "threedxml",
  ".xkt": "xkt"
};

const IDENTITY_COORDINATE_SYSTEM = {
  basis: [
    1, 0, 0,
    0, 1, 0,
    0, 0, 1
  ],
  origin: [0, 0, 0],
  units: "meters",
  scaleToMeters: 1
};

const SDK_DEFAULT_COORDINATE_SYSTEM = {
  basis: [
    1, 0, 0,
    0, 0, 1,
    0, 1, 0
  ],
  origin: [0, 0, 0],
  units: "meters",
  scaleToMeters: 1
};

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }
  if (!options.input) {
    throw new Error("Missing required --input <file>");
  }

  const inputPath = resolvePath(options.input);
  if (!fs.existsSync(inputPath) || !fs.statSync(inputPath).isFile()) {
    throw new Error(`Input model file not found: ${inputPath}`);
  }

  const format = normalizeFormat(options.format || inferFormat(inputPath));
  const loaders = createLoaderDescriptors();
  const descriptor = loaders.get(format);
  if (!descriptor) {
    throw new Error(`Unsupported input format '${format}'. Supported formats: ${Array.from(loaders.keys()).sort().join(", ")}`);
  }
  if (!descriptor.needsScene) {
    throw new Error(`Format '${format}' does not load SceneModel geometry, so dominant-object LOD cannot be generated from it.`);
  }

  const outputPath = resolvePath(options.output || defaultOutputPath(inputPath));
  const coordSysPath = options.coordSysOut ? resolvePath(options.coordSysOut) : defaultCoordSysPath(outputPath);
  const statsPath = options.statsOut ? resolvePath(options.statsOut) : path.join(path.dirname(outputPath), "dominant-lod.stats.json");
  const modelId = sanitizeId(options.modelId || outputModelId(inputPath));
  const coordinateSystem = options.coordinateSystem
    ? readCoordinateSystemFile(options.coordinateSystem)
    : readCoordinateSystem(inputPath) || IDENTITY_COORDINATE_SYSTEM;
  const outputCoordinateSystem = options.outputCoordinateSystem
    ? readOutputCoordinateSystem(options.outputCoordinateSystem)
    : coordinateSystem;

  fs.mkdirSync(path.dirname(outputPath), {recursive: true});
  fs.mkdirSync(path.dirname(coordSysPath), {recursive: true});
  fs.mkdirSync(path.dirname(statsPath), {recursive: true});

  const scene = new Scene({coordinateSystem, logging: false});
  const data = new Data();
  const sceneModel = must(scene.createModel({
    id: modelId,
    coordinateSystem,
    updateHint: "static"
  }), "Failed to create SceneModel");
  const dataModel = descriptor.needsData
    ? must(data.createModel({id: modelId}), "Failed to create DataModel")
    : undefined;

  console.log(`[build-dominant-lod-xgf] Loading ${displayPath(inputPath)} as ${format}`);
  const fileData = readInputFileData(inputPath, descriptor.fetch);
  const loadResult = await descriptor.load({
    fileData,
    sceneModel,
    dataModel
  }, {
    baseUri: pathToFileURL(path.dirname(inputPath) + path.sep).href,
    layerId: modelId,
    yieldIntervalMs: options.yieldIntervalMs
  });
  if (loadResult && loadResult.ok === false) {
    throw new Error(loadResult.error);
  }

  const objectIds = Object.keys(sceneModel.objects);
  if (objectIds.length === 0) {
    throw new Error("Loaded model contains no SceneObjects.");
  }

  const ranked = rankDominantObjects(sceneModel);
  const dominantObjectIds = selectDominantObjects(ranked, options);
  if (dominantObjectIds.length === 0) {
    throw new Error("No dominant SceneObjects were selected.");
  }

  console.log(`[build-dominant-lod-xgf] Selected ${dominantObjectIds.length}/${objectIds.length} dominant SceneObject(s)`);

  const repSetResult = sceneModel.createRepSet({
    id: options.repSetId,
    defaultRepId: "detailed",
    selection: {
      strategy: "projectedSize",
      hysteresisPixels: options.hysteresisPixels
    },
    reps: [
      {
        id: "detailed",
        objectIds,
        range: {
          minPixels: options.detailedMinPixels
        }
      },
      {
        id: "dominant",
        objectIds: dominantObjectIds,
        range: {
          maxPixels: options.dominantMaxPixels
        }
      }
    ]
  });
  if (repSetResult.ok === false) {
    throw new Error(repSetResult.error);
  }

  console.log(`[build-dominant-lod-xgf] Writing ${displayPath(outputPath)}`);
  const xgf = await new XGFExporter().write({sceneModel}, {
    coordinateSystem: outputCoordinateSystem,
    yieldIntervalMs: options.yieldIntervalMs
  });
  fs.writeFileSync(outputPath, Buffer.from(xgf));
  fs.writeFileSync(coordSysPath, `${JSON.stringify(outputCoordinateSystem, null, 2)}\n`);

  const stats = collectStats({
    inputPath,
    outputPath,
    coordSysPath,
    modelId,
    format,
    coordinateSystem,
    outputCoordinateSystem,
    sceneModel,
    repSet: repSetResult.value,
    ranked,
    dominantObjectIds
  });
  fs.writeFileSync(statsPath, `${JSON.stringify(stats, null, 2)}\n`);

  console.log(`[build-dominant-lod-xgf] Wrote ${displayPath(outputPath)} (${formatBytes(fs.statSync(outputPath).size)})`);
  console.log(`[build-dominant-lod-xgf] Representation set '${repSetResult.value.id}': detailed=${objectIds.length} object(s), dominant=${dominantObjectIds.length} object(s)`);
  console.log(`[build-dominant-lod-xgf] Stats: ${displayPath(statsPath)}`);
}

function rankDominantObjects(sceneModel) {
  const rows = [];
  for (const objectId in sceneModel.objects) {
    const object = sceneModel.objects[objectId];
    const aabb = collapseAABB();
    let triangleCount = 0;
    let found = false;
    for (const mesh of object.meshes || []) {
      const meshAABB = mesh.geometry && getGeometryAABB(mesh.geometry);
      if (!meshAABB) {
        continue;
      }
      expandAABB(aabb, transformAABB(meshAABB, mesh.worldMatrix));
      triangleCount += getTriangleCount(mesh.geometry);
      found = true;
    }
    if (!found) {
      continue;
    }
    const dx = Math.max(0, aabb[3] - aabb[0]);
    const dy = Math.max(0, aabb[4] - aabb[1]);
    const dz = Math.max(0, aabb[5] - aabb[2]);
    const volume = dx * dy * dz;
    const surfaceArea = 2 * (dx * dy + dy * dz + dx * dz);
    const diagonal = Math.hypot(dx, dy, dz);
    const score = surfaceArea + diagonal * diagonal + Math.log2(triangleCount + 1);
    rows.push({
      id: objectId,
      score,
      surfaceArea,
      volume,
      diagonal,
      triangleCount,
      aabb: Array.from(aabb)
    });
  }
  rows.sort((a, b) => b.score - a.score || b.triangleCount - a.triangleCount || a.id.localeCompare(b.id));
  return rows;
}

function selectDominantObjects(ranked, options) {
  const maxCount = Math.min(ranked.length, options.maxObjects ?? ranked.length);
  const minCount = Math.min(maxCount, options.minObjects);
  const targetCount = options.objectCount !== null
    ? Math.min(maxCount, Math.max(minCount, options.objectCount))
    : maxCount;
  const totalScore = ranked.reduce((sum, row) => sum + Math.max(0, row.score), 0);
  const selected = [];
  let score = 0;
  for (const row of ranked) {
    if (selected.length >= targetCount) {
      break;
    }
    selected.push(row.id);
    score += Math.max(0, row.score);
    if (options.objectCount === null && selected.length >= minCount && totalScore > 0 && score / totalScore >= options.coverageRatio) {
      break;
    }
  }
  return selected;
}

function parseArgs(argv) {
  const options = {
    input: null,
    output: null,
    coordSysOut: null,
    statsOut: null,
    coordinateSystem: null,
    outputCoordinateSystem: null,
    format: null,
    modelId: null,
    repSetId: "model-lod",
    objectCount: null,
    minObjects: 1,
    maxObjects: null,
    coverageRatio: 0.8,
    detailedMinPixels: 260,
    dominantMaxPixels: 220,
    hysteresisPixels: 16,
    yieldIntervalMs: 80,
    help: false
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case "--input":
      case "-i":
        options.input = readValue(argv, ++i, arg);
        break;
      case "--output":
      case "--out":
      case "-o":
        options.output = readValue(argv, ++i, arg);
        break;
      case "--coord-sys-out":
        options.coordSysOut = readValue(argv, ++i, arg);
        break;
      case "--coordinate-system":
        options.coordinateSystem = readValue(argv, ++i, arg);
        break;
      case "--output-coordinate-system":
        options.outputCoordinateSystem = readValue(argv, ++i, arg);
        break;
      case "--stats-out":
        options.statsOut = readValue(argv, ++i, arg);
        break;
      case "--format":
        options.format = readValue(argv, ++i, arg);
        break;
      case "--model-id":
        options.modelId = readValue(argv, ++i, arg);
        break;
      case "--rep-set-id":
        options.repSetId = readValue(argv, ++i, arg);
        break;
      case "--object-count":
        options.objectCount = parsePositiveInteger(readValue(argv, ++i, arg), arg);
        break;
      case "--min-objects":
        options.minObjects = parsePositiveInteger(readValue(argv, ++i, arg), arg);
        break;
      case "--max-objects":
        options.maxObjects = parsePositiveInteger(readValue(argv, ++i, arg), arg);
        break;
      case "--coverage-ratio":
        options.coverageRatio = parseRangeNumber(readValue(argv, ++i, arg), arg, 0, 1);
        break;
      case "--detailed-min-pixels":
        options.detailedMinPixels = parseNonNegativeNumber(readValue(argv, ++i, arg), arg);
        break;
      case "--dominant-max-pixels":
        options.dominantMaxPixels = parseNonNegativeNumber(readValue(argv, ++i, arg), arg);
        break;
      case "--hysteresis-pixels":
        options.hysteresisPixels = parseNonNegativeNumber(readValue(argv, ++i, arg), arg);
        break;
      case "--yield-interval-ms":
        options.yieldIntervalMs = parsePositiveInteger(readValue(argv, ++i, arg), arg);
        break;
      case "--help":
      case "-h":
        options.help = true;
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

function printHelp() {
  console.log(`Creates an XGF with a projected-size representation set that uses
the most visually dominant SceneObjects as the reduced representation.

Usage:
  node packages/website/tools/asset-pipeline/lod/build-dominant-lod-xgf.js --input <model-file> [options]

Options:
  --input, -i <file>              Input model file.
  --output, --out, -o <file>      Output XGF path.
                                  Default: sibling website-style <Model>_DominantLOD/xgf/model.xgf
  --format <format>               Override input format. Useful for ambiguous .json files.
  --model-id <id>                 Output SceneModel ID.
  --rep-set-id <id>               Representation set ID. Default: model-lod
  --object-count <n>              Exact reduced representation object count.
  --min-objects <n>               Minimum reduced representation object count. Default: 1
  --max-objects <n>               Maximum reduced representation object count.
  --coverage-ratio <n>            Score coverage target when --object-count is omitted. Default: 0.8
  --detailed-min-pixels <n>       Detailed representation min projected size. Default: 260
  --dominant-max-pixels <n>       Dominant representation max projected size. Default: 220
  --hysteresis-pixels <n>         Selection hysteresis. Default: 16
  --coordinate-system <json>      Source SceneModel coordinate-system JSON path.
  --output-coordinate-system <json|sdk-default>
                                  Target coordinate system for emitted XGF and coordSys.json.
  --coord-sys-out <file>          Coordinate-system JSON output path.
  --stats-out <file>              Stats JSON output path.
  --yield-interval-ms <n>         Loader/exporter cooperative yield interval. Default: 80
  --help, -h                      Show this help.
`);
}

function collectStats({inputPath, outputPath, coordSysPath, modelId, format, coordinateSystem, outputCoordinateSystem, sceneModel, repSet, ranked, dominantObjectIds}) {
  const dominantSet = new Set(dominantObjectIds);
  return {
    input: displayPath(inputPath),
    output: displayPath(outputPath),
    coordinateSystem: displayPath(coordSysPath),
    sourceCoordinateSystem: coordinateSystem,
    outputCoordinateSystem,
    format,
    modelId,
    scene: {
      objects: Object.keys(sceneModel.objects).length,
      meshes: Object.keys(sceneModel.meshes).length,
      geometries: Object.keys(sceneModel.geometries).length,
      materials: Object.keys(sceneModel.materials).length,
      repSets: Object.keys(sceneModel.repSets).length
    },
    representationSet: {
      id: repSet.id,
      defaultRepId: repSet.defaultRepId,
      selection: repSet.selection,
      reps: repSet.toParams().reps
    },
    detailed: {
      objectCount: Object.keys(sceneModel.objects).length
    },
    dominant: {
      objectCount: dominantObjectIds.length,
      objectIds: dominantObjectIds,
      scoreCoverage: scoreCoverage(ranked, dominantSet),
      topObjects: ranked.slice(0, Math.min(20, ranked.length)).map((row) => ({
        id: row.id,
        selected: dominantSet.has(row.id),
        score: row.score,
        surfaceArea: row.surfaceArea,
        volume: row.volume,
        diagonal: row.diagonal,
        triangleCount: row.triangleCount
      }))
    }
  };
}

function scoreCoverage(ranked, selected) {
  const total = ranked.reduce((sum, row) => sum + Math.max(0, row.score), 0);
  if (total <= 0) {
    return 0;
  }
  const selectedScore = ranked.reduce((sum, row) => sum + (selected.has(row.id) ? Math.max(0, row.score) : 0), 0);
  return selectedScore / total;
}

function readInputFileData(filePath, fetchKind) {
  const buffer = fs.readFileSync(filePath);
  if (fetchKind === "arrayBuffer") {
    return bufferToArrayBuffer(buffer);
  }
  if (fetchKind === "text") {
    return buffer.toString("utf8");
  }
  if (fetchKind === "json") {
    return JSON.parse(buffer.toString("utf8"));
  }
  throw new Error(`Unsupported fetch kind '${fetchKind}'`);
}

function createLoaderDescriptors() {
  const arrayBufferScene = (modulePath, exportName) => ({
    fetch: "arrayBuffer",
    needsScene: true,
    needsData: false,
    load: (input, options) => new (sdkRequire(modulePath)[exportName])().load(input, options)
  });
  const textScene = (modulePath, exportName) => ({
    fetch: "text",
    needsScene: true,
    needsData: false,
    load: (input, options) => new (sdkRequire(modulePath)[exportName])().load(input, options)
  });
  const jsonSceneData = (modulePath, exportName) => ({
    fetch: "json",
    needsScene: true,
    needsData: true,
    load: (input, options) => new (sdkRequire(modulePath)[exportName])().load(input, options)
  });
  return new Map([
    ["xgf", arrayBufferScene("formats/xgf/XGFLoader", "XGFLoader")],
    ["xgfstream", {
      fetch: "json",
      needsScene: true,
      needsData: false,
      load: (input, options) => loadXGFStream(input, options)
    }],
    ["ifc", {
      fetch: "arrayBuffer",
      needsScene: true,
      needsData: true,
      load: (input, options) => new (sdkRequire("formats/ifc/IFCLoader").IFCLoader)().load(input, options)
    }],
    ["gltf", arrayBufferScene("formats/gltf/GLTFLoader", "GLTFLoader")],
    ["fbx", arrayBufferScene("formats/fbx/FBXLoader", "FBXLoader")],
    ["usdz", arrayBufferScene("formats/usdz/USDZLoader", "USDZLoader")],
    ["e57", {
      fetch: "arrayBuffer",
      needsScene: true,
      needsData: true,
      load: (input, options) => new (sdkRequire("formats/e57/E57Loader").E57Loader)().load(input, options)
    }],
    ["las", {
      fetch: "arrayBuffer",
      needsScene: true,
      needsData: true,
      load: (input, options) => new (sdkRequire("formats/las/LASLoader").LASLoader)().load(input, options)
    }],
    ["laz", {
      fetch: "arrayBuffer",
      needsScene: true,
      needsData: true,
      load: (input, options) => new (sdkRequire("formats/las/LASLoader").LASLoader)().load(input, options)
    }],
    ["splat", arrayBufferScene("formats/gaussiansplat/GaussianSplatLoader", "GaussianSplatLoader")],
    ["mtl", textScene("formats/mtl/MTLLoader", "MTLLoader")],
    ["obj", textScene("formats/obj/OBJLoader", "OBJLoader")],
    ["ply", textScene("formats/ply/PLYLoader", "PLYLoader")],
    ["dotbim", {
      fetch: "arrayBuffer",
      needsScene: true,
      needsData: true,
      load: (input, options) => new (sdkRequire("formats/dotbim/DotBIMLoader").DotBIMLoader)().load(input, options)
    }],
    ["cityjson", jsonSceneData("formats/cityjson/CityJSONLoader", "CityJSONLoader")],
    ["citygml", {
      fetch: "text",
      needsScene: true,
      needsData: true,
      load: (input, options) => new (sdkRequire("formats/citygml/CityGMLLoader").CityGMLLoader)().load(input, options)
    }],
    ["fds", {
      fetch: "text",
      needsScene: true,
      needsData: true,
      load: (input, options) => new (sdkRequire("formats/fds/FDSLoader").FDSLoader)().load(input, options)
    }],
    ["threedxml", arrayBufferScene("formats/threedxml/ThreeDXMLLoader", "ThreeDXMLLoader")],
    ["threedtiles", jsonSceneData("formats/threedtiles/ThreeDTilesLoader", "ThreeDTilesLoader")],
    ["xkt", {
      fetch: "arrayBuffer",
      needsScene: true,
      needsData: true,
      load: (input, options) => new (sdkRequire("formats/legacy/xkt/XKTLoader").XKTLoader)().load(input, options)
    }],
    ["scenemodel", {
      fetch: "json",
      needsScene: true,
      needsData: false,
      load: (input, options) => new (sdkRequire("formats/scenemodel/SceneModelImporter").SceneModelImporter)().load(input, options)
    }],
    ["datamodel", {
      fetch: "json",
      needsScene: false,
      needsData: true,
      load: (input, options) => new (sdkRequire("formats/datamodel/DataModelImporter").DataModelImporter)().load(input, options)
    }],
    ["metamodel", {
      fetch: "json",
      needsScene: false,
      needsData: true,
      load: (input, options) => new (sdkRequire("formats/legacy/metamodel/MetaModelLoader").MetaModelLoader)().load(input, options)
    }]
  ]);
}

async function loadXGFStream(input, options) {
  if (!input.sceneModel) {
    return invalid("[xgfstream] SceneModel expected");
  }
  const indexResult = readXGFStreamIndex(input.fileData);
  if (indexResult.ok === false) {
    return indexResult;
  }
  const index = indexResult.value;
  const {createXGFStreamingIndexLookup} = sdkRequire("formats/xgfstream/index/createXGFStreamingIndexLookup");
  const {XGFStreamingLoader} = sdkRequire("formats/xgfstream/XGFStreamingLoader");
  const lookup = createXGFStreamingIndexLookup(index);
  const sceneChunkIds = index.rootChunkIds && index.rootChunkIds.length > 0
    ? index.rootChunkIds
    : index.chunks.filter(chunk => chunk.role !== "assetLibrary").map(chunk => chunk.id);
  const sceneChunks = [];
  for (const chunkId of sceneChunkIds) {
    const chunk = lookup.byId[chunkId];
    if (!chunk) {
      return invalid(`[xgfstream] Stream index references missing root chunk '${chunkId}'`);
    }
    sceneChunks.push(chunk);
  }
  await new XGFStreamingLoader().loadChunks({
    manifests: sceneChunks,
    sceneModel: input.sceneModel,
    dataModel: input.dataModel
  }, {
    ...options,
    manifests: lookup,
    getFileData: async (manifest) => {
      if (!manifest.uri) {
        return undefined;
      }
      const response = await fetch(resolveStreamUri(options && options.baseUri, manifest.uri));
      return response.ok ? response.arrayBuffer() : undefined;
    }
  });
  return {ok: true, value: undefined};
}

function readXGFStreamIndex(json) {
  const {readXGFStreamingIndex} = sdkRequire("formats/xgfstream/index/readXGFStreamingIndex");
  const {readXGFStreamingRuntimeIndex} = sdkRequire("formats/xgfstream/index/readXGFStreamingRuntimeIndex");
  return json && json.format === "XGFStreamingRuntimeIndex"
    ? readXGFStreamingRuntimeIndex(json)
    : readXGFStreamingIndex(json);
}

function resolveStreamUri(baseUri, uri) {
  if (!baseUri || /^(?:[a-z]+:)?\/\//i.test(uri) || uri.startsWith("blob:") || uri.startsWith("data:")) {
    return uri;
  }
  return `${baseUri.replace(/\/?$/, "/")}${uri.replace(/^\/+/, "")}`;
}

function invalid(error) {
  return {ok: false, error};
}

function getGeometryAABB(geometry) {
  if (geometry.aabb) {
    return Array.from(geometry.aabb);
  }
  const positions = geometry.positions;
  if (!positions || positions.length < 3) {
    return null;
  }
  const aabb = collapseAABB();
  for (let i = 0; i < positions.length; i += 3) {
    expandPoint(aabb, positions[i], positions[i + 1], positions[i + 2]);
  }
  return aabb;
}

function getTriangleCount(geometry) {
  const indices = geometry.indices;
  if (indices && indices.length) {
    return Math.floor(indices.length / 3);
  }
  const positions = geometry.positions;
  return positions ? Math.floor(positions.length / 9) : 0;
}

function transformAABB(aabb, matrix) {
  if (!matrix) {
    return Array.from(aabb);
  }
  const out = collapseAABB();
  for (let x = 0; x <= 1; x++) {
    for (let y = 0; y <= 1; y++) {
      for (let z = 0; z <= 1; z++) {
        transformPoint(
          matrix,
          x ? aabb[3] : aabb[0],
          y ? aabb[4] : aabb[1],
          z ? aabb[5] : aabb[2],
          out
        );
      }
    }
  }
  return out;
}

function transformPoint(m, x, y, z, aabb) {
  const tx = m[0] * x + m[4] * y + m[8] * z + m[12];
  const ty = m[1] * x + m[5] * y + m[9] * z + m[13];
  const tz = m[2] * x + m[6] * y + m[10] * z + m[14];
  expandPoint(aabb, tx, ty, tz);
}

function collapseAABB() {
  return [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
}

function expandAABB(aabb, other) {
  expandPoint(aabb, other[0], other[1], other[2]);
  expandPoint(aabb, other[3], other[4], other[5]);
}

function expandPoint(aabb, x, y, z) {
  if (x < aabb[0]) aabb[0] = x;
  if (y < aabb[1]) aabb[1] = y;
  if (z < aabb[2]) aabb[2] = z;
  if (x > aabb[3]) aabb[3] = x;
  if (y > aabb[4]) aabb[4] = y;
  if (z > aabb[5]) aabb[5] = z;
}

function inferFormat(filePath) {
  const lower = path.basename(filePath).toLowerCase();
  if (lower === "tileset.json") {
    return "threedtiles";
  }
  if (lower === "index.json" || lower === "index.runtime.json") {
    return "xgfstream";
  }
  const ext = path.extname(lower);
  if (ext === ".json") {
    throw new Error("Cannot infer format for .json input. Pass --format scenemodel, cityjson, xgfstream, threedtiles, datamodel or metamodel.");
  }
  const format = FORMAT_BY_EXTENSION[ext];
  if (!format) {
    throw new Error(`Cannot infer format from extension '${ext}'. Pass --format explicitly.`);
  }
  return format;
}

function normalizeFormat(format) {
  const f = String(format).trim().toLowerCase();
  if (f === "glb") {
    return "gltf";
  }
  return f;
}

function defaultOutputPath(inputPath) {
  const modelRoot = inferWebsiteModelRoot(inputPath);
  if (modelRoot) {
    return path.join(path.dirname(modelRoot), `${path.basename(modelRoot)}_DominantLOD`, "xgf", "model.xgf");
  }
  const parsed = path.parse(inputPath);
  return path.join(parsed.dir, `${parsed.name}_DominantLOD.xgf`);
}

function defaultCoordSysPath(outputPath) {
  const parent = path.dirname(outputPath);
  return path.basename(parent) === "xgf"
    ? path.join(path.dirname(parent), "coordSys.json")
    : path.join(parent, "coordSys.json");
}

function readCoordinateSystem(inputPath) {
  const modelRoot = inferWebsiteModelRoot(inputPath);
  if (!modelRoot) {
    return null;
  }
  const coordSysPath = path.join(modelRoot, "coordSys.json");
  if (!fs.existsSync(coordSysPath)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(coordSysPath, "utf8"));
}

function readCoordinateSystemFile(filePath) {
  const coordinateSystem = JSON.parse(fs.readFileSync(resolvePath(filePath), "utf8"));
  validateCoordinateSystem(coordinateSystem, filePath);
  return coordinateSystem;
}

function readOutputCoordinateSystem(value) {
  if (value === "sdk-default") {
    return SDK_DEFAULT_COORDINATE_SYSTEM;
  }
  return readCoordinateSystemFile(value);
}

function validateCoordinateSystem(coordinateSystem, label) {
  if (!coordinateSystem || !Array.isArray(coordinateSystem.basis) || coordinateSystem.basis.length !== 9) {
    throw new Error(`Invalid coordinate system '${label}': expected basis array with 9 numbers.`);
  }
  if (!Array.isArray(coordinateSystem.origin) || coordinateSystem.origin.length !== 3) {
    throw new Error(`Invalid coordinate system '${label}': expected origin array with 3 numbers.`);
  }
  if (!coordinateSystem.units) {
    throw new Error(`Invalid coordinate system '${label}': expected units.`);
  }
}

function inferWebsiteModelRoot(filePath) {
  const modelsDir = path.join(REPO_DIR, "packages", "website", "models");
  const relative = path.relative(modelsDir, filePath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    return null;
  }
  const first = relative.split(path.sep)[0];
  return first ? path.join(modelsDir, first) : null;
}

function outputModelId(inputPath) {
  const modelRoot = inferWebsiteModelRoot(inputPath);
  if (modelRoot) {
    return `${path.basename(modelRoot)}_DominantLOD`;
  }
  return `${path.parse(inputPath).name}_DominantLOD`;
}

function must(result, message) {
  if (!result || result.ok === false) {
    throw new Error(`${message}: ${result && result.error || "unknown error"}`);
  }
  return result.value;
}

function resolvePath(filePath) {
  return path.resolve(REPO_DIR, filePath);
}

function displayPath(filePath) {
  const rel = path.relative(REPO_DIR, filePath);
  return rel.startsWith("..") ? filePath : rel;
}

function sanitizeId(id) {
  return String(id).replace(/[^A-Za-z0-9_.:-]/g, "_");
}

function bufferToArrayBuffer(buffer) {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}

function readValue(argv, index, arg) {
  const value = argv[index];
  if (value === undefined || value.startsWith("--")) {
    throw new Error(`Expected value after ${arg}`);
  }
  return value;
}

function parsePositiveInteger(value, arg) {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) {
    throw new Error(`${arg} must be a positive integer`);
  }
  return n;
}

function parseNonNegativeNumber(value, arg) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) {
    throw new Error(`${arg} must be a non-negative number`);
  }
  return n;
}

function parseRangeNumber(value, arg, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < min || n > max) {
    throw new Error(`${arg} must be between ${min} and ${max}`);
  }
  return n;
}

function formatBytes(bytes) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KiB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
}

main().catch((error) => {
  console.error(`[build-dominant-lod-xgf] ${error.stack || error.message || error}`);
  process.exitCode = 1;
});
