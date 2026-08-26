#!/usr/bin/env node

// Builds a localized XGF terrain model from Zurich's DTM TIN WFS.

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
const {XGFExporter} = sdkRequire("formats/xgf/XGFExporter");
const {optimizeSceneModel} = sdkRequire("inspect/sceneModel/optimizeSceneModel");

const MODEL_ID = "Zurich_Terrain_TIN";
const WFS_URL = "https://www.ogd.stadt-zuerich.ch/wfs/geoportal/Digitales_Terrainmodell__TIN_";
const WFS_TYPE_NAME = "lod0_gelaende";
const ORTHOPHOTO_WMS_URL = "https://wms.zh.ch/OGDOrthoZH";
const ORTHOPHOTO_SOURCE_URL = "https://geolion.zh.ch/geodatensatz/5011";
const ORTHOPHOTO_LAYER = "ortho_s_2024";
const DEFAULT_CACHE_PATH = "/tmp/Zurich_Terrain_TIN_center_2km.gml";
const DEFAULT_ORTHOPHOTO_CACHE_PATH = "/tmp/Zurich_Terrain_TIN_orthophoto_4096.jpg";
const DEFAULT_BUILDING_STREAM_INDEX = "packages/website/models/Zurich_Building_LoD2_V10/xgfstream/index.json";
const DEFAULT_SOURCE_ORIGIN = [2678701.758, 1252228.936, 509.796];
const DEFAULT_BBOX = [
  2682249.180,
  1246994.987,
  2684249.180,
  1248994.987
];
const TERRAIN_MAX_VERTICES_PER_GEOMETRY = 65535;
const TERRAIN_MAX_TRIANGLES_PER_GEOMETRY = 32768;
const UNDERLAY_CELL_SIZE = 160;
const UNDERLAY_MIN_DIVISIONS = 32;
const UNDERLAY_MAX_DIVISIONS = 96;
const UNDERLAY_PADDING = 350;
const UNDERLAY_Z_OFFSET = -4;
const ORTHOPHOTO_SIZE = 4096;

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

const TERRAIN_MATERIAL = {
  id: "zurich-terrain",
  color: [0.43, 0.50, 0.39],
  roughness: 0.96,
  metallic: 0
};

const TEXTURED_TERRAIN_MATERIAL = {
  ...TERRAIN_MATERIAL,
  color: [1, 1, 1],
  roughness: 1,
  metallic: 0
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
  const outFile = path.join(modelDir, "xgf/model.xgf");
  const cachePath = path.resolve(args.input || args.cache || DEFAULT_CACHE_PATH);
  const orthophotoEnabled = args.noOrthophoto !== true && args.orthophoto !== "false";
  const orthophotoCachePath = path.resolve(args.orthophotoCache || DEFAULT_ORTHOPHOTO_CACHE_PATH);
  const orthophotoLayer = args.orthophotoLayer || ORTHOPHOTO_LAYER;
  const orthophotoWMSUrl = args.orthophotoWMSUrl || ORTHOPHOTO_WMS_URL;
  const orthophotoSize = parseInteger(args.orthophotoSize, ORTHOPHOTO_SIZE, "orthophotoSize");
  const buildingStreamIndexPath = path.resolve(args.buildingStreamIndex || path.join(rootDir, DEFAULT_BUILDING_STREAM_INDEX));
  const sourceOrigin = parseVector(args.sourceOrigin, DEFAULT_SOURCE_ORIGIN, "sourceOrigin");
  const bbox = parseVector(args.bbox, DEFAULT_BBOX, "bbox");

  if (!fs.existsSync(cachePath) || args.refresh) {
    console.log(`[Zurich terrain] Downloading WFS crop to ${cachePath}`);
    await downloadWFS({bbox, outFile: cachePath});
  } else {
    console.log(`[Zurich terrain] Reusing cached WFS crop ${cachePath}`);
  }

  console.log(`[Zurich terrain] Parsing ${cachePath}`);
  const geometry = await parseTerrainGML(cachePath, sourceOrigin);
  if (geometry.triangleCount === 0) {
    throw new Error("No terrain triangles were parsed from the WFS response.");
  }

  console.log(`[Zurich terrain] Parsed ${geometry.triangleCount.toLocaleString()} triangles`);
  console.log(`[Zurich terrain] Local AABB ${geometry.aabb.map((value) => round(value, 3)).join(", ")}`);

  const underlay = buildTerrainUnderlay({
    streamIndexPath: buildingStreamIndexPath,
    modelId,
    materialId: TERRAIN_MATERIAL.id
  });
  const textureBounds = buildPlanarTextureBounds([
    geometry.aabb,
    ...(underlay ? [underlay.aabb] : [])
  ]);
  const orthophoto = await prepareOrthophoto({
    enabled: orthophotoEnabled,
    cachePath: orthophotoCachePath,
    refresh: args.refresh || args.orthophotoRefresh,
    layer: orthophotoLayer,
    modelId,
    size: orthophotoSize,
    sourceOrigin,
    textureBounds,
    wmsUrl: orthophotoWMSUrl
  });
  const terrainMaterial = orthophoto
    ? {...TEXTURED_TERRAIN_MATERIAL, colorTextureId: orthophoto.textureId}
    : TERRAIN_MATERIAL;

  const scene = new Scene({logging: false});
  const sceneModel = must(scene.createModel({
    id: modelId,
    coordinateSystem: LOCAL_COORDINATE_SYSTEM
  }));

  const meshIds = [];
  if (orthophoto) {
    must(sceneModel.createTexture({
      id: orthophoto.textureId,
      buffers: [orthophoto.buffer],
      width: orthophoto.width,
      height: orthophoto.height,
      mediaType: orthophoto.mediaType,
      encoding: sRGBEncoding,
      magFilter: LinearFilter,
      minFilter: LinearMipmapLinearFilter,
      wrapS: ClampToEdgeWrapping,
      wrapT: ClampToEdgeWrapping,
      flipY: false,
      mipmap: true
    }));
  }
  must(sceneModel.createMaterial(terrainMaterial));
  must(sceneModel.createGeometry({
    id: `${modelId}-geometry`,
    primitive: TrianglesPrimitive,
    positions: geometry.positions,
    normals: geometry.normals,
    uvs: buildPlanarUVs(geometry.positions, textureBounds),
    indices: geometry.indices
  }));
  must(sceneModel.createMesh({
    id: `${modelId}-mesh`,
    geometryId: `${modelId}-geometry`,
    materialId: terrainMaterial.id
  }));
  meshIds.push(`${modelId}-mesh`);

  if (underlay) {
    must(sceneModel.createGeometry({
      id: underlay.geometryId,
      primitive: TrianglesPrimitive,
      positions: underlay.positions,
      normals: underlay.normals,
      uvs: buildPlanarUVs(underlay.positions, textureBounds),
      indices: underlay.indices
    }));
    must(sceneModel.createMesh({
      id: underlay.meshId,
      geometryId: underlay.geometryId,
      materialId: underlay.materialId
    }));
    meshIds.push(underlay.meshId);
    console.log(`[Zurich terrain] Added ${underlay.triangleCount.toLocaleString()}-triangle full-footprint terrain underlay`);
    console.log(`[Zurich terrain] Underlay AABB ${underlay.aabb.map((value) => round(value, 3)).join(", ")}`);
  }

  must(sceneModel.createObject({
    id: modelId,
    name: "Zurich terrain TIN crop",
    meshIds,
    originalSystemId: WFS_TYPE_NAME,
    clippable: false
  }));

  must(optimizeSceneModel({
    sceneModel,
    maxVertices: TERRAIN_MAX_VERTICES_PER_GEOMETRY,
    maxPrimitives: TERRAIN_MAX_TRIANGLES_PER_GEOMETRY
  }));
  const splitGeometryCount = Object.keys(sceneModel.geometries).length;
  console.log(`[Zurich terrain] Split terrain into ${splitGeometryCount.toLocaleString()} geometries`);

  fs.rmSync(path.dirname(outFile), {recursive: true, force: true});
  fs.mkdirSync(path.dirname(outFile), {recursive: true});

  console.log(`[Zurich terrain] Exporting ${outFile}`);
  const fileData = await new XGFExporter().write({sceneModel}, {
    coordinateSystem: LOCAL_COORDINATE_SYSTEM,
    yieldIntervalMs: 80
  });
  fs.writeFileSync(outFile, Buffer.from(fileData));

  const sourceCoordinateSystem = {
    crs: "EPSG:2056",
    basis: LOCAL_COORDINATE_SYSTEM.basis.slice(),
    origin: sourceOrigin.slice(),
    units: "meters",
    scaleToMeters: 1
  };

  fs.writeFileSync(path.join(modelDir, "coordSys.json"), `${JSON.stringify(LOCAL_COORDINATE_SYSTEM, null, 2)}\n`);
  fs.writeFileSync(path.join(modelDir, "sourceCoordSys.json"), `${JSON.stringify(sourceCoordinateSystem, null, 2)}\n`);
  fs.writeFileSync(path.join(modelDir, "attribution.json"), `${JSON.stringify({
    source: "Stadt Zürich Digitales Terrainmodell (TIN) (3D)",
    sourceUrl: WFS_URL,
    typeName: WFS_TYPE_NAME,
    sourceCoordinateSystem,
    bbox,
    triangleCount: geometry.triangleCount + (underlay ? underlay.triangleCount : 0),
    detailedTriangleCount: geometry.triangleCount,
    underlayTriangleCount: underlay ? underlay.triangleCount : 0,
    underlaySource: underlay ? "Interpolated from Zurich building stream chunk ground-height samples" : undefined,
    underlayAABB: underlay ? underlay.aabb : undefined,
    buildingStreamIndexPath: underlay ? path.relative(rootDir, buildingStreamIndexPath) : undefined,
    orthophoto: orthophoto ? orthophoto.attribution : undefined,
    geometryCount: splitGeometryCount,
    maxVerticesPerGeometry: TERRAIN_MAX_VERTICES_PER_GEOMETRY,
    maxTrianglesPerGeometry: TERRAIN_MAX_TRIANGLES_PER_GEOMETRY,
    generatedAt: new Date().toISOString()
  }, null, 2)}\n`);

  console.log(`[Zurich terrain] Wrote ${formatBytes(fs.statSync(outFile).size)} XGF`);
}

function downloadWFS({bbox, outFile}) {
  fs.mkdirSync(path.dirname(outFile), {recursive: true});
  const params = new URLSearchParams({
    SERVICE: "WFS",
    VERSION: "1.1.0",
    REQUEST: "GetFeature",
    TYPENAME: WFS_TYPE_NAME,
    SRSNAME: "EPSG:2056",
    BBOX: `${bbox.join(",")},EPSG:2056`
  });
  const url = `${WFS_URL}?${params.toString()}`;

  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(outFile);
    const request = https.get(url, (response) => {
      if (response.statusCode !== 200) {
        response.resume();
        file.close();
        fs.rmSync(outFile, {force: true});
        reject(new Error(`WFS request failed with HTTP ${response.statusCode}`));
        return;
      }
      response.pipe(file);
      file.on("finish", () => {
        file.close(resolve);
      });
    });
    request.on("error", (error) => {
      file.close();
      fs.rmSync(outFile, {force: true});
      reject(error);
    });
    file.on("error", (error) => {
      request.destroy();
      fs.rmSync(outFile, {force: true});
      reject(error);
    });
  });
}

async function prepareOrthophoto({
  enabled,
  cachePath,
  refresh,
  layer,
  modelId,
  size,
  sourceOrigin,
  textureBounds,
  wmsUrl
}) {
  if (!enabled) {
    console.log("[Zurich terrain] Orthophoto texture disabled");
    return null;
  }

  const sourceBounds = localBoundsToSourceBounds(textureBounds, sourceOrigin);
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
    console.log(`[Zurich terrain] Downloading ${layer} orthophoto ${request.width}x${request.height} to ${cachePath}`);
    await downloadWMSImage({request, outFile: cachePath, wmsUrl});
    fs.writeFileSync(metaPath, `${JSON.stringify({
      request,
      source: "Kanton Zürich Orthofoto Sommer RGB/Infrarot 2024/25 (OGD)",
      sourceUrl: ORTHOPHOTO_SOURCE_URL,
      wmsUrl,
      generatedAt: new Date().toISOString()
    }, null, 2)}\n`);
  } else {
    console.log(`[Zurich terrain] Reusing cached orthophoto ${cachePath}`);
  }

  const buffer = fs.readFileSync(cachePath);
  const mediaType = detectMediaType(buffer, cachePath);
  console.log(`[Zurich terrain] Using ${formatBytes(buffer.length)} orthophoto texture from ${layer}`);

  return {
    textureId: `${modelId}-orthophoto`,
    buffer: toArrayBuffer(buffer),
    width: request.width,
    height: request.height,
    mediaType,
    attribution: {
      source: "Kanton Zürich Orthofoto Sommer RGB/Infrarot 2024/25 (OGD)",
      sourceUrl: ORTHOPHOTO_SOURCE_URL,
      serviceUrl: wmsUrl,
      layer,
      crs: request.crs,
      bbox: request.bbox,
      width: request.width,
      height: request.height,
      cachePath
    }
  };
}

function downloadWMSImage({request, outFile, wmsUrl}) {
  fs.mkdirSync(path.dirname(outFile), {recursive: true});
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
    console.warn(`[Zurich terrain] Ignoring unreadable JSON cache metadata ${filePath}: ${error.message}`);
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

function parseTerrainGML(inputPath, sourceOrigin) {
  return new Promise((resolve, reject) => {
    const state = {
      buffer: "",
      positions: [],
      normals: [],
      indices: [],
      triangleCount: 0,
      aabb: [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity]
    };

    const stream = fs.createReadStream(inputPath, {encoding: "utf8"});
    stream.on("data", (chunk) => {
      state.buffer += chunk;
      consumePosLists(state, sourceOrigin, false);
    });
    stream.on("error", reject);
    stream.on("end", () => {
      consumePosLists(state, sourceOrigin, true);
      if (state.triangleCount === 0) {
        reject(new Error("No <posList> triangles found in GML response."));
        return;
      }
      resolve({
        positions: state.positions,
        normals: state.normals,
        indices: state.indices,
        triangleCount: state.triangleCount,
        aabb: state.aabb
      });
    });
  });
}

function consumePosLists(state, sourceOrigin, final) {
  const regex = /<posList\b([^>]*)>([\s\S]*?)<\/posList>/g;
  let match;
  let processedUntil = 0;

  while ((match = regex.exec(state.buffer)) !== null) {
    processedUntil = regex.lastIndex;
    const dimension = parseDimension(match[1]);
    const vertices = parseVertices(match[2], dimension, sourceOrigin);
    addPolygonTriangles(state, removeClosingDuplicate(vertices));
  }

  const trailing = state.buffer.slice(processedUntil);
  if (final) {
    state.buffer = trailing.trim();
    if (state.buffer.includes("<Exception") || state.buffer.includes("ExceptionReport")) {
      throw new Error(`WFS returned an exception: ${state.buffer.slice(0, 500)}`);
    }
    return;
  }
  state.buffer = trailing.slice(-4096);
}

function parseDimension(attrsText) {
  const match = attrsText.match(/\bsrsDimension\s*=\s*(?:"(\d+)"|'(\d+)')/);
  if (!match) {
    return 3;
  }
  const dimension = Number.parseInt(match[1] || match[2], 10);
  return Number.isFinite(dimension) && dimension >= 2 ? dimension : 3;
}

function parseVertices(text, dimension, sourceOrigin) {
  const numbers = parseNumberList(text);
  const vertices = [];
  for (let i = 0; i + dimension - 1 < numbers.length; i += dimension) {
    vertices.push([
      numbers[i] - sourceOrigin[0],
      numbers[i + 1] - sourceOrigin[1],
      (numbers[i + 2] || 0) - sourceOrigin[2]
    ]);
  }
  return vertices;
}

function parseNumberList(text) {
  const numbers = [];
  const regex = /[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    numbers.push(Number(match[0]));
  }
  return numbers;
}

function removeClosingDuplicate(vertices) {
  if (vertices.length < 2) {
    return vertices;
  }
  const first = vertices[0];
  const last = vertices[vertices.length - 1];
  return samePoint(first, last) ? vertices.slice(0, -1) : vertices;
}

function samePoint(a, b) {
  return Math.abs(a[0] - b[0]) < 1e-7
    && Math.abs(a[1] - b[1]) < 1e-7
    && Math.abs(a[2] - b[2]) < 1e-7;
}

function addPolygonTriangles(state, vertices) {
  if (vertices.length < 3) {
    return;
  }
  for (let i = 1; i + 1 < vertices.length; i++) {
    addTriangle(state, vertices[0], vertices[i], vertices[i + 1]);
  }
}

function addTriangle(state, a, b, c) {
  let normal = cross(subtract(b, a), subtract(c, a));
  if (normal[2] < 0) {
    const tmp = b;
    b = c;
    c = tmp;
    normal = cross(subtract(b, a), subtract(c, a));
  }
  normal = normalize(normal);
  const baseIndex = state.positions.length / 3;
  pushVertex(state, a, normal);
  pushVertex(state, b, normal);
  pushVertex(state, c, normal);
  state.indices.push(baseIndex, baseIndex + 1, baseIndex + 2);
  state.triangleCount++;
}

function pushVertex(state, vertex, normal) {
  state.positions.push(vertex[0], vertex[1], vertex[2]);
  state.normals.push(normal[0], normal[1], normal[2]);
  expandAABB(state.aabb, vertex);
}

function buildPlanarTextureBounds(aabbs) {
  const bounds = [Infinity, Infinity, -Infinity, -Infinity];
  for (const aabb of aabbs) {
    bounds[0] = Math.min(bounds[0], aabb[0]);
    bounds[1] = Math.min(bounds[1], aabb[1]);
    bounds[2] = Math.max(bounds[2], aabb[3]);
    bounds[3] = Math.max(bounds[3], aabb[4]);
  }
  if (!bounds.every(Number.isFinite) || bounds[0] >= bounds[2] || bounds[1] >= bounds[3]) {
    throw new Error("Unable to build orthophoto texture bounds from terrain geometry.");
  }
  return bounds;
}

function buildPlanarUVs(positions, bounds) {
  const minX = bounds[0];
  const minY = bounds[1];
  const width = bounds[2] - bounds[0];
  const depth = bounds[3] - bounds[1];
  const uvs = new Float32Array((positions.length / 3) * 2);

  for (let vertexIndex = 0, uvIndex = 0; vertexIndex < positions.length; vertexIndex += 3, uvIndex += 2) {
    uvs[uvIndex] = clamp((positions[vertexIndex] - minX) / width, 0, 1);
    uvs[uvIndex + 1] = clamp(1 - ((positions[vertexIndex + 1] - minY) / depth), 0, 1);
  }

  return uvs;
}

function localBoundsToSourceBounds(bounds, sourceOrigin) {
  return [
    bounds[0] + sourceOrigin[0],
    bounds[1] + sourceOrigin[1],
    bounds[2] + sourceOrigin[0],
    bounds[3] + sourceOrigin[1]
  ];
}

function buildTerrainUnderlay({streamIndexPath, modelId, materialId}) {
  if (!fs.existsSync(streamIndexPath)) {
    console.warn(`[Zurich terrain] Building stream index not found, skipping full-footprint underlay: ${streamIndexPath}`);
    return null;
  }

  const index = JSON.parse(fs.readFileSync(streamIndexPath, "utf8"));
  if (!Array.isArray(index.aabb) || index.aabb.length !== 6 || !Array.isArray(index.chunks)) {
    console.warn(`[Zurich terrain] Building stream index has no usable aabb/chunks, skipping underlay: ${streamIndexPath}`);
    return null;
  }

  const chunks = index.chunks
    .filter((chunk) => chunk && chunk.role !== "assetLibrary" && Array.isArray(chunk.aabb) && chunk.aabb.length === 6);

  if (chunks.length === 0) {
    console.warn(`[Zurich terrain] Building stream index has no scene chunk AABBs, skipping underlay: ${streamIndexPath}`);
    return null;
  }

  const rawHeights = chunks.map((chunk) => chunk.aabb[2]).sort((a, b) => a - b);
  const minHeight = quantile(rawHeights, 0.05);
  const maxHeight = quantile(rawHeights, 0.95);
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
  const divisionsX = clamp(Math.ceil(width / UNDERLAY_CELL_SIZE), UNDERLAY_MIN_DIVISIONS, UNDERLAY_MAX_DIVISIONS);
  const divisionsY = clamp(Math.ceil(depth / UNDERLAY_CELL_SIZE), UNDERLAY_MIN_DIVISIONS, UNDERLAY_MAX_DIVISIONS);

  const positions = [];
  const indices = [];
  const aabb = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];

  for (let yIndex = 0; yIndex <= divisionsY; yIndex++) {
    const y = minY + (depth * yIndex / divisionsY);
    for (let xIndex = 0; xIndex <= divisionsX; xIndex++) {
      const x = minX + (width * xIndex / divisionsX);
      const z = interpolateHeight(x, y, samples) + UNDERLAY_Z_OFFSET;
      const vertex = [x, y, z];
      positions.push(vertex[0], vertex[1], vertex[2]);
      expandAABB(aabb, vertex);
    }
  }

  const rowStride = divisionsX + 1;
  for (let yIndex = 0; yIndex < divisionsY; yIndex++) {
    for (let xIndex = 0; xIndex < divisionsX; xIndex++) {
      const a = yIndex * rowStride + xIndex;
      const b = a + 1;
      const c = a + rowStride;
      const d = c + 1;
      indices.push(a, b, d, a, d, c);
    }
  }

  return {
    geometryId: `${modelId}-underlay-geometry`,
    meshId: `${modelId}-underlay-mesh`,
    materialId,
    positions: new Float32Array(positions),
    normals: buildVertexNormals(positions, indices),
    indices,
    triangleCount: indices.length / 3,
    aabb
  };
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
    .slice(0, 12);

  if (nearest.length === 0) {
    return 0;
  }
  if (nearest[0].d2 < 1) {
    return nearest[0].z;
  }

  let weightTotal = 0;
  let heightTotal = 0;
  for (const sample of nearest) {
    const weight = 1 / Math.max(sample.d2, 1);
    weightTotal += weight;
    heightTotal += sample.z * weight;
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

function expandAABB(aabb, vertex) {
  aabb[0] = Math.min(aabb[0], vertex[0]);
  aabb[1] = Math.min(aabb[1], vertex[1]);
  aabb[2] = Math.min(aabb[2], vertex[2]);
  aabb[3] = Math.max(aabb[3], vertex[0]);
  aabb[4] = Math.max(aabb[4], vertex[1]);
  aabb[5] = Math.max(aabb[5], vertex[2]);
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

function quantile(sortedValues, fraction) {
  if (sortedValues.length === 0) {
    return 0;
  }
  const index = Math.max(0, Math.min(sortedValues.length - 1, Math.floor((sortedValues.length - 1) * fraction)));
  return sortedValues[index];
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

function must(result) {
  if (!result.ok) {
    throw new Error(result.error);
  }
  return result.value;
}

function round(value, digits) {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function formatBytes(bytes) {
  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function printHelp() {
  console.log(`Usage: node packages/website/tools/asset-pipeline/conversions/build-zurich-terrain-xgf.js [options]

Options:
  --bbox minX,minY,maxX,maxY       EPSG:2056 WFS crop. Defaults to a 2km central Zurich crop.
  --cache path                     Cached WFS GML path.
  --input path                     Use an existing WFS GML file instead of the default cache.
  --buildingStreamIndex path        Zurich building stream index used to generate the full-footprint underlay.
  --noOrthophoto                   Disable the orthophoto texture and use the flat terrain material.
  --orthophotoCache path           Cached orthophoto image path. Default: ${DEFAULT_ORTHOPHOTO_CACHE_PATH}
  --orthophotoRefresh              Re-download the orthophoto texture cache.
  --orthophotoLayer name           WMS layer for the terrain texture. Default: ${ORTHOPHOTO_LAYER}
  --orthophotoSize pixels          Orthophoto texture width and height. Default: ${ORTHOPHOTO_SIZE}
  --orthophotoWMSUrl url           Orthophoto WMS endpoint. Default: ${ORTHOPHOTO_WMS_URL}
  --refresh                        Re-download even when the cache file exists.
  --out path                       Output model directory.
  --modelId id                     SceneModel/model id. Default: ${MODEL_ID}
  --sourceOrigin x,y,z             Source origin matching the Zurich building stream.
`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
