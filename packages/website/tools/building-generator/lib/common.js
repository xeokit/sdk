const fs = require("fs");
const path = require("path");
const {pathToFileURL} = require("url");

process.env.TS_NODE_COMPILER_OPTIONS = JSON.stringify({
  module: "commonjs",
  moduleResolution: "node",
  verbatimModuleSyntax: false
});

require("ts-node/register/transpile-only");

const {sdkRequire} = require("../../lib/sdk-require");

const {Scene} = sdkRequire("model/scene/Scene");
const {Data} = sdkRequire("model/data/Data");
const {TrianglesPrimitive, PointsPrimitive} = sdkRequire("base/constants");
const {buildBox} = sdkRequire("model/generation/buildGeometry/buildBox");
const {buildMat4} = sdkRequire("model/scene/buildMat4");
const {getMeshWorldMatrix} = sdkRequire("model/scene/getMeshWorldMatrix");
const {GLTFLoader} = sdkRequire("formats/gltf/GLTFLoader");
const {IFCLoader} = sdkRequire("formats/ifc/IFCLoader");
const {XGFLoader} = sdkRequire("formats/xgf/XGFLoader");
const {XGFExporter} = sdkRequire("formats/xgf/XGFExporter");
const {XKTLoader} = sdkRequire("formats/legacy/xkt/XKTLoader");
const {XGFStreamExporter} = sdkRequire("formats/xgfstream/XGFStreamExporter");
const {unpackUSDZ} = sdkRequire("formats/usdz/usdzArchive");

const rootDir = path.resolve(__dirname, "../../../../..");
const modelsDir = path.join(rootDir, "packages/website/models");

const Z_UP_COORDINATE_SYSTEM = {
  basis: [1, 0, 0, 0, 0, 1, 0, 1, 0],
  origin: [0, 0, 0],
  units: "meters",
  scaleToMeters: 1
};

const SOURCE_IDENTITY_COORDINATE_SYSTEM = {
  basis: [1, 0, 0, 0, 1, 0, 0, 0, 1],
  origin: [0, 0, 0],
  units: "meters",
  scaleToMeters: 1
};

const DEFAULT_SAMPLE_MODELS = [
  {id: "otc_civic_anchor", model: "OTCConferenceCenter"},
  {
    id: "residential_usdz",
    model: "ResidentialBuilding",
    scale: 0.04,
    sourceCandidates: [
      {format: "usdz", relPath: "ResidentialBuilding/usdz/model.usdz"}
    ],
    analysisFallbackCandidates: [
      {format: "xgf", relPath: "ResidentialBuilding/xgf/model.xgf"}
    ]
  },
  {id: "sample_apartment_west", model: "SampleApartment", scale: 8},
  {id: "duplex_lane_a", model: "Duplex", scale: 1.2},
  {id: "openhouse4_lane_b", model: "IfcOpenHouse4"},
  {id: "openhouse2x3_hillside", model: "IfcOpenHouse2x3"},
  {id: "sample_house_hillside", model: "Ifc4_SampleHouse"},
  {id: "blender_house_north", model: "BlenderHouse", scale: 1.5},
  {
    id: "building_site_house",
    model: "BuildingSite",
    scale: 1.4,
    sourceCandidates: [
      {format: "gltf", relPath: "BuildingSite/threedtiles/house.glb"}
    ]
  }
];

const SOURCE_FORMATS = {
  xgf: {
    label: "XGF",
    loader: () => new XGFLoader()
  },
  xkt: {
    label: "XKT",
    loader: () => new XKTLoader()
  },
  gltf: {
    label: "glTF",
    loader: () => new GLTFLoader(),
    options: (source) => ({
      baseUri: pathToFileURL(path.dirname(source.path) + path.sep).href
    })
  },
  ifc: {
    label: "IFC",
    loader: () => new IFCLoader()
  }
};

function defaultSourceCandidates(model) {
  return [
    {format: "xgf", relPath: `${model}/xgf/model.xgf`},
    {format: "xkt", relPath: `${model}/xkt/model.xkt`},
    {format: "gltf", relPath: `${model}/gltf/model.glb`},
    {format: "gltf", relPath: `${model}/gltf/model.gltf`},
    {format: "ifc", relPath: `${model}/ifc/model.ifc`},
    {format: "usdz", relPath: `${model}/usdz/model.usdz`}
  ];
}

function resolveSource(spec) {
  const candidates = (spec.sourceCandidates || defaultSourceCandidates(spec.model))
    .map(normalizeSourceCandidate);
  const usdzCandidate = candidates.find((candidate) => candidate.format === "usdz" && fs.existsSync(candidate.path));
  if (usdzCandidate && spec.analysisFallbackCandidates) {
    const analysisSource = spec.analysisFallbackCandidates
      .map(normalizeSourceCandidate)
      .find((candidate) => candidate.format !== "usdz" && fs.existsSync(candidate.path));
    if (!analysisSource) {
      throw new Error(`USDZ source found for ${spec.model}, but no loadable analysis fallback was found`);
    }
    return {
      ...analysisSource,
      trainingSource: {
        ...usdzCandidate,
        package: inspectUSDZPackage(usdzCandidate.path)
      },
      analysisSource
    };
  }
  for (const candidate of candidates) {
    if (candidate.format === "usdz" || !fs.existsSync(candidate.path)) {
      continue;
    }
    if (!SOURCE_FORMATS[candidate.format]) {
      throw new Error(`Unsupported source format '${candidate.format}' for ${spec.id || spec.model}`);
    }
    return candidate;
  }
  if (usdzCandidate) {
    throw new Error(`USDZ source found for ${spec.model}, but USDZ loading is browser-only in this Node generator: ${usdzCandidate.path}`);
  }
  throw new Error(`Missing loadable source for ${spec.model}; tried ${candidates.map((candidate) => candidate.relPath).join(", ")}`);
}

function normalizeSourceCandidate(candidate) {
  return {
    ...candidate,
    path: path.join(modelsDir, candidate.relPath)
  };
}

function inspectUSDZPackage(filePath) {
  const buffer = fs.readFileSync(filePath);
  const archive = unpackUSDZ(bufferToArrayBuffer(buffer));
  return {
    rootLayerName: archive.rootLayerName,
    entries: archive.entries.map((entry) => ({
      name: entry.name,
      byteLength: entry.data.byteLength
    }))
  };
}

async function loadSourceModel(spec) {
  const source = resolveSource(spec);
  const scene = new Scene();
  const data = new Data();
  const sourceId = sanitizeId(spec.id || spec.model);
  const sceneModel = must(scene.createModel({
    id: `${sourceId}Source`,
    coordinateSystem: sourceCoordinateSystem(spec)
  }));
  const dataModel = must(data.createModel({id: `${sourceId}Source`}));
  const buffer = fs.readFileSync(source.path);
  const format = SOURCE_FORMATS[source.format];
  await format.loader().load({
    fileData: bufferToArrayBuffer(buffer),
    sceneModel,
    dataModel
  }, {
    ...(format.options ? format.options(source) : {}),
    layerId: sourceId,
    yieldIntervalMs: 80
  });
  return {scene, data, sceneModel, dataModel, source};
}

function sourceCoordinateSystem(spec) {
  const coord = readSourceCoordinateSystem(spec.model);
  return {
    basis: coord.basis,
    origin: coord.origin || [0, 0, 0],
    units: coord.units || "meters",
    scaleToMeters: spec.scale || coord.scaleToMeters || 1
  };
}

function readSourceCoordinateSystem(model) {
  const coordPath = path.join(modelsDir, model, "coordSys.json");
  if (!fs.existsSync(coordPath)) {
    return SOURCE_IDENTITY_COORDINATE_SYSTEM;
  }
  return JSON.parse(fs.readFileSync(coordPath, "utf8"));
}

function computeSceneModelAABB(sceneModel, targetCoordinateSystem = Z_UP_COORDINATE_SYSTEM) {
  let result;
  for (const mesh of Object.values(sceneModel.meshes)) {
    if (!mesh.geometry || !mesh.geometry.aabb) {
      continue;
    }
    const matrix = getMeshWorldMatrix(mesh, targetCoordinateSystem);
    result = unionAABB(result, transformAABB(mesh.geometry.aabb, matrix));
  }
  return result || [0, 0, 0, 0, 0, 0];
}

function collectSceneModelStats(sceneModel, targetCoordinateSystem = Z_UP_COORDINATE_SYSTEM) {
  const geometries = Object.values(sceneModel.geometries);
  let vertices = 0;
  let triangles = 0;
  let points = 0;
  for (const geometry of geometries) {
    const vertexCount = geometry.positionsCompressed ? Math.floor(geometry.positionsCompressed.length / 3) : 0;
    vertices += vertexCount;
    if (geometry.primitive === PointsPrimitive) {
      points += vertexCount;
    } else if (geometry.primitive === TrianglesPrimitive) {
      triangles += geometry.indices ? Math.floor(geometry.indices.length / 3) : Math.floor(vertexCount / 3);
    }
  }
  const aabb = computeSceneModelAABB(sceneModel, targetCoordinateSystem);
  return {
    objects: Object.keys(sceneModel.objects).length,
    meshes: Object.keys(sceneModel.meshes).length,
    geometries: geometries.length,
    materials: Object.keys(sceneModel.materials).length,
    textures: Object.keys(sceneModel.textures).length,
    vertices,
    triangles,
    points,
    aabb,
    dimensions: aabbDimensions(aabb)
  };
}

function collectColorSamples(sceneModel) {
  const samples = [];
  for (const mesh of Object.values(sceneModel.meshes)) {
    const material = mesh.material;
    const color = material ? Array.from(material.color) : Array.from(mesh.color || [1, 1, 1]);
    const opacity = material ? material.opacity : mesh.opacity;
    const geometry = mesh.geometry;
    const vertexCount = geometry && geometry.positionsCompressed ? Math.floor(geometry.positionsCompressed.length / 3) : 1;
    samples.push({
      color: color.map(clamp01),
      opacity: opacity === undefined || opacity === null ? 1 : clamp01(opacity),
      weight: Math.max(1, vertexCount)
    });
  }
  return samples;
}

function addBoxObject(sceneModel, dataModel, geometryCache, params) {
  const geometryId = getBoxGeometry(sceneModel, geometryCache, params.size);
  const meshId = `${params.id}_mesh`;
  const meshParams = {
    id: meshId,
    geometryId,
    matrix: buildMat4({
      position: params.position || [0, 0, 0],
      rotation: params.rotation || [0, 0, 0],
      scale: [1, 1, 1]
    }),
    color: params.color || [1, 1, 1],
    opacity: params.opacity === undefined ? 1 : params.opacity
  };
  if (params.materialId) {
    meshParams.materialId = params.materialId;
  }
  must(sceneModel.createMesh(meshParams));
  must(sceneModel.createObject({
    id: params.id,
    meshIds: [meshId],
    layerId: params.layerId,
    originalSystemId: params.originalSystemId || params.id
  }));
  if (dataModel) {
    dataModel.createObject({
      id: params.id,
      name: params.name || params.id,
      type: params.type || "ProceduralBuildingElement"
    });
  }
}

function getBoxGeometry(sceneModel, cache, size) {
  const key = size.map((value) => round(value, 4)).join("x");
  const existing = cache.get(key);
  if (existing) {
    return existing;
  }
  const geometry = buildBox({
    xSize: size[0] / 2,
    ySize: size[1] / 2,
    zSize: size[2] / 2
  });
  if (!geometry.ok) {
    throw new Error(geometry.error);
  }
  const geometryId = `box_${cache.size}_${key}`;
  must(sceneModel.createGeometry({
    id: geometryId,
    primitive: TrianglesPrimitive,
    positions: geometry.value.positions,
    normals: geometry.value.normals,
    indices: geometry.value.indices
  }));
  cache.set(key, geometryId);
  return geometryId;
}

async function writeXGF(sceneModel, outFile) {
  fs.mkdirSync(path.dirname(outFile), {recursive: true});
  const fileData = await new XGFExporter().write({sceneModel}, {
    yieldIntervalMs: 80
  });
  fs.writeFileSync(outFile, Buffer.from(fileData));
}

async function writeXGFStream(sceneModel, outDir, options = {}) {
  fs.rmSync(outDir, {recursive: true, force: true});
  fs.mkdirSync(outDir, {recursive: true});
  const stream = await new XGFStreamExporter().write({sceneModel}, {
    partition: "grid",
    chunkMetric: "meshes",
    chunkBudget: options.chunkBudget || 1200,
    minChunkBudget: options.minChunkBudget || 300,
    gridCellSize: options.gridCellSize || 90,
    index: "index.json",
    runtimeIndex: "index.runtime.json",
    assetId: options.assetId || "procedural-buildings-assets",
    assetLibraryChunkSize: options.assetLibraryChunkSize || 1,
    sharedAssetMinLibraryUses: options.sharedAssetMinLibraryUses || 1000000,
    yieldIntervalMs: 80
  });
  for (const [uri, data] of Object.entries(stream.files)) {
    const filePath = path.join(outDir, uri);
    fs.mkdirSync(path.dirname(filePath), {recursive: true});
    if (data instanceof ArrayBuffer) {
      fs.writeFileSync(filePath, Buffer.from(data));
    } else {
      fs.writeFileSync(filePath, `${JSON.stringify(data)}\n`, "utf8");
    }
  }
  return stream;
}

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const token = argv[i];
    if (!token.startsWith("--")) {
      continue;
    }
    const eq = token.indexOf("=");
    if (eq !== -1) {
      args[token.slice(2, eq)] = token.slice(eq + 1);
      continue;
    }
    const key = token.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith("--")) {
      args[key] = next;
      i++;
    } else {
      args[key] = true;
    }
  }
  return args;
}

function selectedSampleModels(modelsArg) {
  if (!modelsArg) {
    return DEFAULT_SAMPLE_MODELS;
  }
  const defaultsByName = new Map();
  for (const spec of DEFAULT_SAMPLE_MODELS) {
    defaultsByName.set(spec.id, spec);
    defaultsByName.set(spec.model, spec);
  }
  return String(modelsArg)
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean)
    .map((name) => defaultsByName.get(name) || {id: sanitizeId(name), model: name});
}

function relativeToRoot(filePath) {
  return path.relative(rootDir, filePath).replace(/\\/g, "/");
}

function bufferToArrayBuffer(buffer) {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}

function transformAABB(aabb, matrix) {
  const result = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
  for (const x of [aabb[0], aabb[3]]) {
    for (const y of [aabb[1], aabb[4]]) {
      for (const z of [aabb[2], aabb[5]]) {
        expandAABB(result, transformPoint(matrix, x, y, z));
      }
    }
  }
  return result;
}

function transformPoint(matrix, x, y, z) {
  return [
    matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12],
    matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13],
    matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14]
  ];
}

function unionAABB(a, b) {
  if (!a) {
    return Array.from(b);
  }
  return [
    Math.min(a[0], b[0]),
    Math.min(a[1], b[1]),
    Math.min(a[2], b[2]),
    Math.max(a[3], b[3]),
    Math.max(a[4], b[4]),
    Math.max(a[5], b[5])
  ];
}

function expandAABB(aabb, point) {
  aabb[0] = Math.min(aabb[0], point[0]);
  aabb[1] = Math.min(aabb[1], point[1]);
  aabb[2] = Math.min(aabb[2], point[2]);
  aabb[3] = Math.max(aabb[3], point[0]);
  aabb[4] = Math.max(aabb[4], point[1]);
  aabb[5] = Math.max(aabb[5], point[2]);
}

function aabbDimensions(aabb) {
  return [
    Math.max(0, aabb[3] - aabb[0]),
    Math.max(0, aabb[4] - aabb[1]),
    Math.max(0, aabb[5] - aabb[2])
  ];
}

function clamp01(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
}

function round(value, digits = 3) {
  const scale = 10 ** digits;
  return Math.round((Number(value) || 0) * scale) / scale;
}

function sanitizeId(value) {
  return String(value).replace(/[^A-Za-z0-9_-]+/g, "_");
}

function must(result) {
  if (!result || result.ok === false) {
    throw new Error(result?.error || "Operation failed");
  }
  return result.value;
}

module.exports = {
  Data,
  DEFAULT_SAMPLE_MODELS,
  Scene,
  Z_UP_COORDINATE_SYSTEM,
  addBoxObject,
  collectColorSamples,
  collectSceneModelStats,
  computeSceneModelAABB,
  loadSourceModel,
  modelsDir,
  must,
  parseArgs,
  relativeToRoot,
  rootDir,
  round,
  sanitizeId,
  selectedSampleModels,
  writeXGF,
  writeXGFStream
};
