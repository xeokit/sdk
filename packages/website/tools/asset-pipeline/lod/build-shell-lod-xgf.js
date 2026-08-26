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
const {createShellRep} = sdkRequire("model/lod/ShellRep");
const {XGFExporter} = sdkRequire("formats/xgf/XGFExporter");

const REPO_DIR = path.resolve(__dirname, "..", "..", "..", "..", "..");
const nativeFetch = globalThis.fetch;

globalThis.fetch = async function fetchWithLocalFileSupport(input, init) {
  const url = typeof input === "string" ? input : input && input.url;
  if (typeof url === "string" && url.startsWith("file://")) {
    try {
      return new Response(fs.readFileSync(fileURLToPath(url)), {
        status: 200
      });
    } catch {
      return new Response(null, {
        status: 404
      });
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
    throw new Error(`Format '${format}' does not load SceneModel geometry, so a shell cannot be generated from it.`);
  }

  const outputPath = resolvePath(options.output || defaultOutputPath(inputPath));
  const coordSysPath = options.coordSysOut ? resolvePath(options.coordSysOut) : defaultCoordSysPath(outputPath);
  const statsPath = options.statsOut ? resolvePath(options.statsOut) : path.join(path.dirname(outputPath), "lod-shell.stats.json");
  const modelId = sanitizeId(options.modelId || outputModelId(inputPath));
  const coordinateSystem = readCoordinateSystem(inputPath) || IDENTITY_COORDINATE_SYSTEM;

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

  console.log(`[build-shell-lod-xgf] Loading ${displayPath(inputPath)} as ${format}`);
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

  console.log(`[build-shell-lod-xgf] Generating shell from ${objectIds.length} SceneObject(s)`);
  const shellResult = createShellRep({
    model: sceneModel,
    id: options.repSetId,
    objectIds,
    shellMaterialId: options.shellMaterialId,
    shellColor: options.shellColor,
    shellOpacity: options.shellOpacity,
    generation: {
      shellResolution: options.shellResolution,
      extraction: options.extraction,
      smoothing: options.smoothing,
      simplification: options.targetTriangles > 0
        ? {targetTriangleCount: options.targetTriangles}
        : undefined
    },
    selection: {
      strategy: "projectedSize",
      hysteresisPixels: options.hysteresisPixels
    },
    detailedRange: {
      minPixels: options.detailedMinPixels
    },
    shellRange: {
      maxPixels: options.shellMaxPixels
    }
  });
  if (shellResult.ok === false) {
    throw new Error(shellResult.error);
  }

  console.log(`[build-shell-lod-xgf] Writing ${displayPath(outputPath)}`);
  const xgf = await new XGFExporter().write({sceneModel}, {
    yieldIntervalMs: options.yieldIntervalMs
  });
  fs.writeFileSync(outputPath, Buffer.from(xgf));
  fs.writeFileSync(coordSysPath, `${JSON.stringify(coordinateSystem, null, 2)}\n`);

  const stats = collectStats({
    inputPath,
    outputPath,
    coordSysPath,
    modelId,
    format,
    sourceObjectCount: objectIds.length,
    shellResult: shellResult.value,
    sceneModel
  });
  fs.writeFileSync(statsPath, `${JSON.stringify(stats, null, 2)}\n`);

  console.log(`[build-shell-lod-xgf] Wrote ${displayPath(outputPath)} (${formatBytes(fs.statSync(outputPath).size)})`);
  console.log(`[build-shell-lod-xgf] Representation set '${shellResult.value.repSet.id}': detailed=${objectIds.length} object(s), shell=${shellResult.value.object.id}`);
  console.log(`[build-shell-lod-xgf] Shell: ${formatNumber(shellResult.value.shell.stats.shellTriangleCount)} triangle(s), ${formatNumber(shellResult.value.shell.stats.shellVertexCount)} vertex/vertices`);
  console.log(`[build-shell-lod-xgf] Stats: ${displayPath(statsPath)}`);
}

function parseArgs(argv) {
  const options = {
    input: null,
    output: null,
    coordSysOut: null,
    statsOut: null,
    format: null,
    modelId: null,
    repSetId: "model-lod",
    shellMaterialId: "shellMaterial",
    shellColor: [0.72, 0.76, 0.78],
    shellOpacity: 1,
    shellResolution: 64,
    extraction: "surfaceNets",
    smoothing: {iterations: 3},
    targetTriangles: 8000,
    detailedMinPixels: 128,
    shellMaxPixels: 96,
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
      case "--shell-resolution":
        options.shellResolution = parsePositiveInteger(readValue(argv, ++i, arg), arg);
        break;
      case "--extraction":
        options.extraction = parseChoice(readValue(argv, ++i, arg), arg, ["voxelFaces", "surfaceNets"]);
        break;
      case "--target-triangles":
        options.targetTriangles = parseNonNegativeInteger(readValue(argv, ++i, arg), arg);
        break;
      case "--no-smoothing":
        options.smoothing = false;
        break;
      case "--smoothing-iterations":
        options.smoothing = {iterations: parseNonNegativeInteger(readValue(argv, ++i, arg), arg)};
        break;
      case "--detailed-min-pixels":
        options.detailedMinPixels = parseNonNegativeNumber(readValue(argv, ++i, arg), arg);
        break;
      case "--shell-max-pixels":
        options.shellMaxPixels = parseNonNegativeNumber(readValue(argv, ++i, arg), arg);
        break;
      case "--hysteresis-pixels":
        options.hysteresisPixels = parseNonNegativeNumber(readValue(argv, ++i, arg), arg);
        break;
      case "--yield-interval-ms":
        options.yieldIntervalMs = parsePositiveInteger(readValue(argv, ++i, arg), arg);
        break;
      case "--shell-color":
        options.shellColor = parseColor(readValue(argv, ++i, arg), arg);
        break;
      case "--shell-opacity":
        options.shellOpacity = parseRangeNumber(readValue(argv, ++i, arg), arg, 0, 1);
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
  console.log(`Creates an XGF with a generated shell representation set.

Usage:
  node packages/website/tools/asset-pipeline/lod/build-shell-lod-xgf.js --input <model-file> [options]

Options:
  --input, -i <file>              Input model file.
  --output, --out, -o <file>      Output XGF path.
                                  Default: sibling website-style <Model>_LoD/xgf/model.xgf
  --format <format>               Override input format. Useful for ambiguous .json files.
  --model-id <id>                 Output SceneModel ID.
  --rep-set-id <id>               Representation set ID. Default: model-lod
  --shell-resolution <n>          Longest voxel grid axis. Default: 64
  --extraction <mode>             voxelFaces or surfaceNets. Default: surfaceNets
  --target-triangles <n>          Simplification target; 0 disables. Default: 8000
  --no-smoothing                  Disable surface-net smoothing.
  --smoothing-iterations <n>      Surface-net smoothing iterations. Default: 3
  --detailed-min-pixels <n>       Detailed representation min projected size. Default: 128
  --shell-max-pixels <n>          Shell representation max projected size. Default: 96
  --hysteresis-pixels <n>         Selection hysteresis. Default: 16
  --shell-color <r,g,b>           Shell color, each channel 0..1. Default: 0.72,0.76,0.78
  --shell-opacity <n>             Shell opacity 0..1. Default: 1
  --coord-sys-out <file>          Coordinate-system JSON output path.
  --stats-out <file>              Stats JSON output path.
  --yield-interval-ms <n>         Loader/exporter cooperative yield interval. Default: 80
  --help, -h                      Show this help.
`);
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
  if (f === "laz") {
    return "laz";
  }
  return f;
}

function defaultOutputPath(inputPath) {
  const modelRoot = inferWebsiteModelRoot(inputPath);
  if (modelRoot) {
    return path.join(path.dirname(modelRoot), `${path.basename(modelRoot)}_LoD`, "xgf", "model.xgf");
  }
  const parsed = path.parse(inputPath);
  return path.join(parsed.dir, `${parsed.name}_LoD.xgf`);
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
    return `${path.basename(modelRoot)}_LoD`;
  }
  return `${path.parse(inputPath).name}_LoD`;
}

function collectStats({inputPath, outputPath, coordSysPath, modelId, format, sourceObjectCount, shellResult, sceneModel}) {
  const stats = shellResult.shell.stats;
  return {
    input: displayPath(inputPath),
    output: displayPath(outputPath),
    coordinateSystem: displayPath(coordSysPath),
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
      id: shellResult.repSet.id,
      defaultRepId: shellResult.repSet.defaultRepId,
      selection: shellResult.repSet.selection,
      reps: shellResult.repSet.toParams().reps
    },
    detailed: {
      objectCount: sourceObjectCount
    },
    shell: {
      objectId: shellResult.object.id,
      meshId: shellResult.mesh.id,
      geometryId: shellResult.geometry.id,
      materialId: shellResult.material.id,
      center: Array.from(shellResult.shell.center),
      stats
    }
  };
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

function parseChoice(value, arg, choices) {
  if (!choices.includes(value)) {
    throw new Error(`${arg} must be one of: ${choices.join(", ")}`);
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

function parseNonNegativeInteger(value, arg) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0) {
    throw new Error(`${arg} must be a non-negative integer`);
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

function parseColor(value, arg) {
  const parts = value.split(",").map((part) => Number(part.trim()));
  if (parts.length !== 3 || parts.some((part) => !Number.isFinite(part) || part < 0 || part > 1)) {
    throw new Error(`${arg} must be three comma-separated numbers in the range 0..1`);
  }
  return parts;
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

function formatNumber(value) {
  return Math.round(value).toLocaleString("en-US");
}

main().catch((error) => {
  console.error(`[build-shell-lod-xgf] ${error.stack || error.message || error}`);
  process.exitCode = 1;
});
