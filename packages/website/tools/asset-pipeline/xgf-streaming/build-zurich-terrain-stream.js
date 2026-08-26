#!/usr/bin/env node

// Builds a tiled, textured XGF Stream terrain underlay for the Zurich buildings example.

const fs = require("fs");
const https = require("https");
const path = require("path");

process.env.TS_NODE_COMPILER_OPTIONS = JSON.stringify({
  module: "commonjs",
  moduleResolution: "node",
  verbatimModuleSyntax: false
});

require("ts-node/register/transpile-only");

const {sdkRequire} = require("../../lib/sdk-require");

const {Scene} = sdkRequire("model/scene/Scene");
const {
  ClampToEdgeWrapping,
  JPEGMediaType,
  LinearFilter,
  LinearMipmapLinearFilter,
  PNGMediaType,
  sRGBEncoding,
  TrianglesPrimitive
} = sdkRequire("base/constants");
const {XGFStreamExporter} = sdkRequire("formats/xgfstream/XGFStreamExporter");

const MODEL_ID = "Zurich_Terrain_TIN";
const ORTHOPHOTO_WMS_URL = "https://wms.zh.ch/OGDOrthoZH";
const ORTHOPHOTO_SOURCE_URL = "https://geolion.zh.ch/geodatensatz/5011";
const ORTHOPHOTO_LAYER = "ortho_s_2024";
const DEFAULT_BUILDING_STREAM_INDEX = "packages/website/models/Zurich_Building_LoD2_V10/xgfstream/index.json";
const DEFAULT_SOURCE_ORIGIN = [2678701.758, 1252228.936, 509.796];
const DEFAULT_TILE_CACHE_DIR = "/tmp/Zurich_Terrain_TIN_orthophoto_tiles";
const UNDERLAY_PADDING = 350;
const UNDERLAY_Z_OFFSET = 1;
const HEIGHT_SAMPLE_COUNT = 18;
const HEIGHT_LOCAL_RADIUS = 900;
const HEIGHT_MIN_CLAMP_QUANTILE = 0.05;
const HEIGHT_MAX_CLAMP_QUANTILE = 0.99;
const HEIGHT_LOCAL_BASE_QUANTILE = 0.8;
const HEIGHT_LOW_OUTLIER_TOLERANCE = 5;
const TILE_WORLD_SIZE = 1500;
const TILE_TEXTURE_SIZE = 1024;
const TILE_DIVISIONS = 10;

const LOCAL_COORDINATE_SYSTEM = {
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
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    process.exit(0);
  }

  const rootDir = path.resolve(__dirname, "..", "..", "..", "..", "..");
  const modelId = args.modelId || MODEL_ID;
  const modelDir = path.resolve(args.out || path.join(rootDir, "packages/website/models", modelId));
  const outDir = path.resolve(args.streamOut || path.join(modelDir, "xgfstream"));
  const buildingStreamIndexPath = path.resolve(args.buildingStreamIndex || path.join(rootDir, DEFAULT_BUILDING_STREAM_INDEX));
  const sourceOrigin = parseVector(args.sourceOrigin, DEFAULT_SOURCE_ORIGIN, "sourceOrigin");
  const tileWorldSize = parseNumber(args.tileWorldSize, TILE_WORLD_SIZE, "tileWorldSize");
  const tileTextureSize = parseInteger(args.tileTextureSize, TILE_TEXTURE_SIZE, "tileTextureSize");
  const tileDivisions = parseInteger(args.tileDivisions, TILE_DIVISIONS, "tileDivisions");
  const tileCacheDir = path.resolve(args.tileCacheDir || DEFAULT_TILE_CACHE_DIR);
  const orthophotoLayer = args.orthophotoLayer || ORTHOPHOTO_LAYER;
  const orthophotoWMSUrl = args.orthophotoWMSUrl || ORTHOPHOTO_WMS_URL;

  console.log(`[Zurich terrain stream] Reading building stream index ${buildingStreamIndexPath}`);
  const tilePlan = buildTerrainTilePlan({
    streamIndexPath: buildingStreamIndexPath,
    tileWorldSize,
    tileDivisions
  });
  console.log(`[Zurich terrain stream] Building ${tilePlan.tiles.length.toLocaleString()} terrain tiles (${tilePlan.columns} x ${tilePlan.rows})`);
  console.log(`[Zurich terrain stream] Local AABB ${tilePlan.aabb.map((value) => round(value, 3)).join(", ")}`);

  const scene = new Scene({logging: false});
  const sceneModel = must(scene.createModel({
    id: modelId,
    coordinateSystem: LOCAL_COORDINATE_SYSTEM
  }));

  for (let i = 0; i < tilePlan.tiles.length; i++) {
    const tile = tilePlan.tiles[i];
    const tileId = `${modelId}_tile_r${padNumber(tile.row)}_c${padNumber(tile.column)}`;
    const texture = await prepareTileOrthophoto({
      cacheDir: tileCacheDir,
      layer: orthophotoLayer,
      refresh: args.refresh || args.orthophotoRefresh,
      size: tileTextureSize,
      sourceOrigin,
      tile,
      tileId,
      wmsUrl: orthophotoWMSUrl
    });
    const materialId = `${tileId}_material`;
    const geometryId = `${tileId}_geometry`;
    const meshId = `${tileId}_mesh`;

    must(sceneModel.createTexture({
      id: texture.textureId,
      buffers: [texture.buffer],
      width: texture.width,
      height: texture.height,
      mediaType: texture.mediaType,
      encoding: sRGBEncoding,
      magFilter: LinearFilter,
      minFilter: LinearMipmapLinearFilter,
      wrapS: ClampToEdgeWrapping,
      wrapT: ClampToEdgeWrapping,
      flipY: false,
      mipmap: true
    }));
    must(sceneModel.createMaterial({
      id: materialId,
      color: [1, 1, 1],
      roughness: 1,
      metallic: 0,
      colorTextureId: texture.textureId
    }));
    must(sceneModel.createGeometry({
      id: geometryId,
      primitive: TrianglesPrimitive,
      positions: tile.positions,
      normals: tile.normals,
      uvs: tile.uvs,
      indices: tile.indices
    }));
    must(sceneModel.createMesh({
      id: meshId,
      geometryId,
      materialId
    }));
    must(sceneModel.createObject({
      id: tileId,
      name: `Zurich terrain tile ${tile.row},${tile.column}`,
      meshIds: [meshId],
      originalSystemId: "zurich-orthophoto-terrain-tile",
      clippable: false
    }));

    if ((i + 1) % 10 === 0 || i + 1 === tilePlan.tiles.length) {
      console.log(`[Zurich terrain stream] Prepared ${i + 1}/${tilePlan.tiles.length} tiles`);
    }
  }

  fs.rmSync(outDir, {recursive: true, force: true});
  fs.mkdirSync(outDir, {recursive: true});

  console.log(`[Zurich terrain stream] Exporting XGF Stream to ${outDir}`);
  const stream = await new XGFStreamExporter().write({
    sceneModel
  }, {
    partition: "object-order",
    chunkSize: 1,
    chunkMetric: "objects",
    chunkBudget: 1,
    minChunkBudget: 1,
    index: "index.json",
    runtimeIndex: "index.runtime.json",
    assetId: "terrain-assets",
    assetLibraryChunkSize: 1,
    sharedAssetMinLibraryUses: 1000000,
    sharedAssetMode: "local",
    coordinateSystem: LOCAL_COORDINATE_SYSTEM,
    yieldIntervalMs: 80
  });

  for (const [uri, fileData] of Object.entries(stream.files)) {
    const filePath = path.join(outDir, uri);
    fs.mkdirSync(path.dirname(filePath), {recursive: true});
    if (fileData instanceof ArrayBuffer) {
      fs.writeFileSync(filePath, Buffer.from(fileData));
    } else {
      fs.writeFileSync(filePath, `${JSON.stringify(fileData, null, 2)}\n`, "utf8");
    }
  }

  const sourceCoordinateSystem = {
    crs: "EPSG:2056",
    basis: LOCAL_COORDINATE_SYSTEM.basis.slice(),
    origin: sourceOrigin.slice(),
    units: "meters",
    scaleToMeters: 1
  };
  fs.writeFileSync(path.join(modelDir, "coordSys.json"), `${JSON.stringify(LOCAL_COORDINATE_SYSTEM, null, 2)}\n`);
  fs.writeFileSync(path.join(modelDir, "sourceCoordSys.json"), `${JSON.stringify(sourceCoordinateSystem, null, 2)}\n`);
  fs.writeFileSync(path.join(outDir, "attribution.json"), `${JSON.stringify({
    source: "Kanton Zürich Orthofoto Sommer RGB/Infrarot 2024/25 (OGD)",
    sourceUrl: ORTHOPHOTO_SOURCE_URL,
    serviceUrl: orthophotoWMSUrl,
    layer: orthophotoLayer,
    sourceCoordinateSystem,
    buildingStreamIndexPath: path.relative(rootDir, buildingStreamIndexPath),
    tileWorldSize,
    tileTextureSize,
    tileDivisions,
    tileCount: tilePlan.tiles.length,
    columns: tilePlan.columns,
    rows: tilePlan.rows,
    aabb: tilePlan.aabb,
    generatedAt: new Date().toISOString()
  }, null, 2)}\n`);

  const fileCount = Object.keys(stream.files).length;
  const totalBytes = directorySize(outDir);
  console.log(`[Zurich terrain stream] Wrote ${fileCount.toLocaleString()} files (${formatBytes(totalBytes)})`);
}

function buildTerrainTilePlan({streamIndexPath, tileWorldSize, tileDivisions}) {
  if (!fs.existsSync(streamIndexPath)) {
    throw new Error(`Building stream index not found: ${streamIndexPath}`);
  }

  const index = JSON.parse(fs.readFileSync(streamIndexPath, "utf8"));
  if (!Array.isArray(index.aabb) || index.aabb.length !== 6 || !Array.isArray(index.chunks)) {
    throw new Error(`Building stream index has no usable aabb/chunks: ${streamIndexPath}`);
  }

  const chunks = index.chunks
    .filter((chunk) => chunk && chunk.role !== "assetLibrary" && Array.isArray(chunk.aabb) && chunk.aabb.length === 6);

  if (chunks.length === 0) {
    throw new Error(`Building stream index has no scene chunk AABBs: ${streamIndexPath}`);
  }

  const rawHeights = chunks.map((chunk) => chunk.aabb[2]).sort((a, b) => a - b);
  const minHeight = quantile(rawHeights, HEIGHT_MIN_CLAMP_QUANTILE);
  const maxHeight = quantile(rawHeights, HEIGHT_MAX_CLAMP_QUANTILE);
  const samples = chunks.map((chunk) => {
    const aabb = chunk.aabb;
    return {
      x: (aabb[0] + aabb[3]) * 0.5,
      y: (aabb[1] + aabb[4]) * 0.5,
      z: clamp(aabb[2], minHeight, maxHeight)
    };
  });

  const minX = index.aabb[0] - UNDERLAY_PADDING;
  const minY = index.aabb[1] - UNDERLAY_PADDING;
  const maxX = index.aabb[3] + UNDERLAY_PADDING;
  const maxY = index.aabb[4] + UNDERLAY_PADDING;
  const width = maxX - minX;
  const depth = maxY - minY;
  const columns = Math.max(1, Math.ceil(width / tileWorldSize));
  const rows = Math.max(1, Math.ceil(depth / tileWorldSize));
  const tileWidth = width / columns;
  const tileDepth = depth / rows;
  const tiles = [];
  const aabb = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];

  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const bounds = [
        minX + (column * tileWidth),
        minY + (row * tileDepth),
        minX + ((column + 1) * tileWidth),
        minY + ((row + 1) * tileDepth)
      ];
      const tile = buildTerrainTile({
        row,
        column,
        bounds,
        divisions: tileDivisions,
        samples
      });
      tiles.push(tile);
      expandAABB(aabb, tile.aabb);
    }
  }

  return {
    tiles,
    columns,
    rows,
    aabb
  };
}

function buildTerrainTile({row, column, bounds, divisions, samples}) {
  const minX = bounds[0];
  const minY = bounds[1];
  const maxX = bounds[2];
  const maxY = bounds[3];
  const width = maxX - minX;
  const depth = maxY - minY;
  const positions = [];
  const uvs = [];
  const indices = [];
  const aabb = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];

  for (let yIndex = 0; yIndex <= divisions; yIndex++) {
    const y = minY + (depth * yIndex / divisions);
    for (let xIndex = 0; xIndex <= divisions; xIndex++) {
      const x = minX + (width * xIndex / divisions);
      const z = interpolateHeight(x, y, samples) + UNDERLAY_Z_OFFSET;
      const vertex = [x, y, z];
      positions.push(vertex[0], vertex[1], vertex[2]);
      uvs.push(xIndex / divisions, 1 - (yIndex / divisions));
      expandAABB(aabb, vertex);
    }
  }

  const rowStride = divisions + 1;
  for (let yIndex = 0; yIndex < divisions; yIndex++) {
    for (let xIndex = 0; xIndex < divisions; xIndex++) {
      const a = yIndex * rowStride + xIndex;
      const b = a + 1;
      const c = a + rowStride;
      const d = c + 1;
      indices.push(a, b, d, a, d, c);
    }
  }

  return {
    row,
    column,
    bounds,
    positions: new Float32Array(positions),
    normals: buildVertexNormals(positions, indices),
    uvs: new Float32Array(uvs),
    indices,
    aabb
  };
}

async function prepareTileOrthophoto({cacheDir, layer, refresh, size, sourceOrigin, tile, tileId, wmsUrl}) {
  fs.mkdirSync(cacheDir, {recursive: true});
  const cachePath = path.join(cacheDir, `${tileId}_${layer}_${size}.jpg`);
  const sourceBounds = localBoundsToSourceBounds(tile.bounds, sourceOrigin);
  const request = {
    service: "WMS",
    version: "1.3.0",
    layer,
    crs: "EPSG:2056",
    format: "image/jpeg",
    width: size,
    height: size,
    bbox: sourceBounds.map((value) => round(value, 3))
  };
  const metaPath = `${cachePath}.json`;
  const cachedRequest = readJSONIfExists(metaPath)?.request;
  const mustDownload = refresh
    || !fs.existsSync(cachePath)
    || JSON.stringify(cachedRequest) !== JSON.stringify(request);

  if (mustDownload) {
    await downloadWMSImage({request, outFile: cachePath, wmsUrl});
    fs.writeFileSync(metaPath, `${JSON.stringify({
      request,
      source: "Kanton Zürich Orthofoto Sommer RGB/Infrarot 2024/25 (OGD)",
      sourceUrl: ORTHOPHOTO_SOURCE_URL,
      wmsUrl,
      generatedAt: new Date().toISOString()
    }, null, 2)}\n`);
  }

  const buffer = fs.readFileSync(cachePath);
  return {
    textureId: `${tileId}_orthophoto`,
    buffer: toArrayBuffer(buffer),
    width: request.width,
    height: request.height,
    mediaType: detectMediaType(buffer, cachePath)
  };
}

function downloadWMSImage({request, outFile, wmsUrl}) {
  const params = new URLSearchParams({
    SERVICE: request.service,
    VERSION: request.version,
    REQUEST: "GetMap",
    LAYERS: request.layer,
    STYLES: "",
    FORMAT: request.format,
    CRS: request.crs,
    WIDTH: String(request.width),
    HEIGHT: String(request.height),
    BBOX: request.bbox.join(",")
  });
  const url = `${wmsUrl}?${params.toString()}`;

  return new Promise((resolve, reject) => {
    const requestHandle = https.get(url, (response) => {
      const contentType = String(response.headers["content-type"] || "").toLowerCase();
      if (response.statusCode !== 200 || !contentType.startsWith("image/")) {
        collectResponseText(response, (body) => {
          fs.rmSync(outFile, {force: true});
          reject(new Error(`WMS image request failed with HTTP ${response.statusCode}, content-type ${contentType}: ${body.slice(0, 500)}`));
        });
        return;
      }

      const file = fs.createWriteStream(outFile);
      response.pipe(file);
      file.on("finish", () => {
        file.close(resolve);
      });
      file.on("error", (error) => {
        requestHandle.destroy();
        fs.rmSync(outFile, {force: true});
        reject(error);
      });
    });
    requestHandle.on("error", (error) => {
      fs.rmSync(outFile, {force: true});
      reject(error);
    });
  });
}

function interpolateHeight(x, y, samples) {
  const nearest = samples
    .map((sample) => {
      const dx = x - sample.x;
      const dy = y - sample.y;
      return {
        d2: dx * dx + dy * dy,
        z: sample.z
      };
    })
    .sort((a, b) => a.d2 - b.d2)
    .slice(0, HEIGHT_SAMPLE_COUNT);

  if (nearest.length === 0) {
    return 0;
  }
  if (nearest[0].d2 < 1) {
    return nearest[0].z;
  }

  const localRadius2 = HEIGHT_LOCAL_RADIUS * HEIGHT_LOCAL_RADIUS;
  const localSamples = nearest.filter((sample) => sample.d2 <= Math.max(localRadius2, nearest[0].d2 * 4));
  const activeSamples = localSamples.length >= 4 ? localSamples : nearest.slice(0, Math.min(nearest.length, 8));
  const localHeights = activeSamples.map((sample) => sample.z).sort((a, b) => a - b);
  const localBaseHeight = interpolateQuantile(localHeights, HEIGHT_LOCAL_BASE_QUANTILE);

  let weightTotal = 0;
  let heightTotal = 0;
  for (const sample of activeSamples) {
    const weight = 1 / Math.max(sample.d2, 1);
    const z = Math.max(sample.z, localBaseHeight - HEIGHT_LOW_OUTLIER_TOLERANCE);
    weightTotal += weight;
    heightTotal += z * weight;
  }
  return heightTotal / weightTotal;
}

function buildVertexNormals(positions, indices) {
  const normals = new Float32Array(positions.length);
  for (let i = 0; i < indices.length; i += 3) {
    const ia = indices[i] * 3;
    const ib = indices[i + 1] * 3;
    const ic = indices[i + 2] * 3;
    const a = [positions[ia], positions[ia + 1], positions[ia + 2]];
    const b = [positions[ib], positions[ib + 1], positions[ib + 2]];
    const c = [positions[ic], positions[ic + 1], positions[ic + 2]];
    const normal = cross(subtract(b, a), subtract(c, a));
    normals[ia] += normal[0];
    normals[ia + 1] += normal[1];
    normals[ia + 2] += normal[2];
    normals[ib] += normal[0];
    normals[ib + 1] += normal[1];
    normals[ib + 2] += normal[2];
    normals[ic] += normal[0];
    normals[ic + 1] += normal[1];
    normals[ic + 2] += normal[2];
  }
  for (let i = 0; i < normals.length; i += 3) {
    const normal = normalize([normals[i], normals[i + 1], normals[i + 2]]);
    normals[i] = normal[0];
    normals[i + 1] = normal[1];
    normals[i + 2] = normal[2];
  }
  return normals;
}

function expandAABB(aabb, vertexOrAABB) {
  if (vertexOrAABB.length === 6) {
    aabb[0] = Math.min(aabb[0], vertexOrAABB[0]);
    aabb[1] = Math.min(aabb[1], vertexOrAABB[1]);
    aabb[2] = Math.min(aabb[2], vertexOrAABB[2]);
    aabb[3] = Math.max(aabb[3], vertexOrAABB[3]);
    aabb[4] = Math.max(aabb[4], vertexOrAABB[4]);
    aabb[5] = Math.max(aabb[5], vertexOrAABB[5]);
    return;
  }
  aabb[0] = Math.min(aabb[0], vertexOrAABB[0]);
  aabb[1] = Math.min(aabb[1], vertexOrAABB[1]);
  aabb[2] = Math.min(aabb[2], vertexOrAABB[2]);
  aabb[3] = Math.max(aabb[3], vertexOrAABB[0]);
  aabb[4] = Math.max(aabb[4], vertexOrAABB[1]);
  aabb[5] = Math.max(aabb[5], vertexOrAABB[2]);
}

function subtract(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function cross(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0]
  ];
}

function normalize(value) {
  const length = Math.hypot(value[0], value[1], value[2]);
  if (!Number.isFinite(length) || length === 0) {
    return [0, 0, 1];
  }
  return [value[0] / length, value[1] / length, value[2] / length];
}

function localBoundsToSourceBounds(bounds, sourceOrigin) {
  return [
    bounds[0] + sourceOrigin[0],
    bounds[1] + sourceOrigin[1],
    bounds[2] + sourceOrigin[0],
    bounds[3] + sourceOrigin[1]
  ];
}

function collectResponseText(response, done) {
  const chunks = [];
  response.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
  response.on("end", () => done(Buffer.concat(chunks).toString("utf8")));
}

function readJSONIfExists(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    console.warn(`[Zurich terrain stream] Ignoring unreadable JSON cache metadata ${filePath}: ${error.message}`);
    return null;
  }
}

function detectMediaType(buffer, filePath) {
  if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xd8) {
    return JPEGMediaType;
  }
  if (
    buffer.length >= 8
    && buffer[0] === 0x89
    && buffer[1] === 0x50
    && buffer[2] === 0x4e
    && buffer[3] === 0x47
    && buffer[4] === 0x0d
    && buffer[5] === 0x0a
    && buffer[6] === 0x1a
    && buffer[7] === 0x0a
  ) {
    return PNGMediaType;
  }
  throw new Error(`Unsupported cached orthophoto image type: ${filePath}`);
}

function toArrayBuffer(buffer) {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}

function quantile(sortedValues, fraction) {
  if (sortedValues.length === 0) {
    return 0;
  }
  const index = Math.max(0, Math.min(sortedValues.length - 1, Math.floor((sortedValues.length - 1) * fraction)));
  return sortedValues[index];
}

function interpolateQuantile(sortedValues, fraction) {
  if (sortedValues.length === 0) {
    return 0;
  }
  const index = Math.max(0, Math.min(sortedValues.length - 1, (sortedValues.length - 1) * fraction));
  const lowerIndex = Math.floor(index);
  const upperIndex = Math.ceil(index);
  const t = index - lowerIndex;
  return sortedValues[lowerIndex] * (1 - t) + sortedValues[upperIndex] * t;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!token.startsWith("--")) {
      continue;
    }
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      args[key] = true;
      continue;
    }
    args[key] = next;
    i++;
  }
  return args;
}

function parseVector(value, fallback, label) {
  if (value === undefined || value === null || value === true) {
    return fallback.slice();
  }
  const vector = String(value)
    .split(",")
    .map((part) => Number(part.trim()));
  if (vector.length !== fallback.length || vector.some((part) => !Number.isFinite(part))) {
    throw new Error(`--${label} must be ${fallback.length} comma-separated numbers`);
  }
  return vector;
}

function parseInteger(value, fallback, label) {
  if (value === undefined || value === null || value === true) {
    return fallback;
  }
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`--${label} must be a positive integer`);
  }
  return parsed;
}

function parseNumber(value, fallback, label) {
  if (value === undefined || value === null || value === true) {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`--${label} must be a positive number`);
  }
  return parsed;
}

function must(result) {
  if (!result.ok) {
    throw new Error(result.error);
  }
  return result.value;
}

function padNumber(value) {
  return String(value).padStart(2, "0");
}

function round(value, digits) {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function directorySize(dirPath) {
  let total = 0;
  for (const entry of fs.readdirSync(dirPath, {withFileTypes: true})) {
    const entryPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      total += directorySize(entryPath);
    } else if (entry.isFile()) {
      total += fs.statSync(entryPath).size;
    }
  }
  return total;
}

function formatBytes(bytes) {
  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function printHelp() {
  console.log(`Usage: node packages/website/tools/asset-pipeline/xgf-streaming/build-zurich-terrain-stream.js [options]

Options:
  --buildingStreamIndex path       Zurich building stream index used to size and height-fit the terrain tiles.
  --tileWorldSize meters           Approximate terrain tile width/depth. Default: ${TILE_WORLD_SIZE}
  --tileTextureSize pixels         Orthophoto texture width and height per tile. Default: ${TILE_TEXTURE_SIZE}
  --tileDivisions count            Ground mesh subdivisions per tile edge. Default: ${TILE_DIVISIONS}
  --tileCacheDir path              Cached orthophoto tile directory. Default: ${DEFAULT_TILE_CACHE_DIR}
  --orthophotoRefresh              Re-download cached orthophoto tiles.
  --orthophotoLayer name           WMS layer for terrain tile textures. Default: ${ORTHOPHOTO_LAYER}
  --orthophotoWMSUrl url           Orthophoto WMS endpoint. Default: ${ORTHOPHOTO_WMS_URL}
  --streamOut path                 Output xgfstream directory.
  --out path                       Output model directory. Default: packages/website/models/${MODEL_ID}
  --modelId id                     SceneModel/model id. Default: ${MODEL_ID}
  --sourceOrigin x,y,z             Source origin matching the Zurich building stream.
`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
