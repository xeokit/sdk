// Generates a City CBD XGF Stream dataset from existing website model assets.
//
// Demonstrates using the SDK from Node to compose several BIM/model assets into
// one larger streamed city scene: build procedural terrain/streets, load source
// XGF/XKT/glTF/IFC models, place each model on the terrain, then export one
// grid-partitioned XGF Stream directory.

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
const {TrianglesPrimitive} = sdkRequire("base/constants");
const {buildBox} = sdkRequire("model/generation/buildGeometry/buildBox");
const {buildMat4} = sdkRequire("model/scene/buildMat4");
const {getMeshWorldMatrix} = sdkRequire("model/scene/getMeshWorldMatrix");
const {GLTFLoader} = sdkRequire("formats/gltf/GLTFLoader");
const {IFCLoader} = sdkRequire("formats/ifc/IFCLoader");
const {XGFLoader} = sdkRequire("formats/xgf/XGFLoader");
const {XKTLoader} = sdkRequire("formats/legacy/xkt/XKTLoader");
const {XGFStreamExporter} = sdkRequire("formats/xgfstream/XGFStreamExporter");

const rootDir = path.resolve(__dirname, "..", "..", "..", "..", "..");
const modelsDir = path.join(rootDir, "packages/website/models");
const outDir = path.join(modelsDir, "CityCBD/xgfstream");

const CITY_COORDINATE_SYSTEM = {
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

const SOURCE_MODELS = [
  {id: "otc_civic_anchor", model: "OTCConferenceCenter", x: 0, y: 0, yaw: 0},
  {id: "residential_east", model: "ResidentialBuilding", x: 190, y: -115, yaw: Math.PI / 5, scale: 0.04},
  {id: "sample_apartment_west", model: "SampleApartment", x: -205, y: 135, yaw: -Math.PI / 4, scale: 8},
  {id: "duplex_lane_a", model: "Duplex", x: 90, y: -210, yaw: Math.PI / 2, scale: 1.2},
  {id: "openhouse4_lane_b", model: "IfcOpenHouse4", x: -85, y: -205, yaw: -Math.PI / 8},
  {id: "openhouse2x3_hillside", model: "IfcOpenHouse2x3", x: 235, y: 160, yaw: Math.PI / 3},
  {id: "sample_house_hillside", model: "Ifc4_SampleHouse", x: -240, y: -155, yaw: -Math.PI / 3},
  {id: "blender_house_north", model: "BlenderHouse", x: -65, y: 220, yaw: Math.PI / 7, scale: 1.5},
  {
    id: "building_site_house",
    model: "BuildingSite",
    x: 260,
    y: 40,
    yaw: -Math.PI / 5,
    scale: 1.4,
    sourceCandidates: [
      {format: "gltf", relPath: "BuildingSite/threedtiles/house.glb"}
    ]
  }
];

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function main() {
  fs.rmSync(outDir, {recursive: true, force: true});
  fs.mkdirSync(outDir, {recursive: true});

  const scene = new Scene();
  const data = new Data();
  const sceneModel = must(scene.createModel({
    id: "CityCBD",
    coordinateSystem: CITY_COORDINATE_SYSTEM
  }));
  const dataModel = must(data.createModel({id: "CityCBD"}));

  console.log("Building procedural CBD terrain");
  addCityLandscape(sceneModel, dataModel);

  for (const spec of SOURCE_MODELS) {
    await loadPlacedModel(scene, data, sceneModel, dataModel, spec);
  }

  console.log(`Loaded ${sceneModel.stats.numObjects.toLocaleString()} composed objects`);
  console.log("Exporting XGF stream");
  const stream = await new XGFStreamExporter().write({
    sceneModel,
    dataModel
  }, {
    coordinateSystem: scene.coordinateSystem,
    partition: "grid",
    chunkMetric: "meshes",
    chunkBudget: 1600,
    minChunkBudget: 450,
    gridCellSize: 120,
    index: "index.json",
    runtimeIndex: "index.runtime.json",
    assetId: "city-cbd-assets",
    assetLibraryChunkSize: 1,
    sharedAssetMinLibraryUses: 1000000,
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

  console.log(`Generated ${Object.keys(stream.files).length} XGF streaming files in ${outDir}`);
}

function addCityLandscape(sceneModel, dataModel) {
  const tileSize = 80;
  for (let row = -3; row <= 3; row++) {
    for (let col = -3; col <= 3; col++) {
      const x = col * tileSize;
      const y = row * tileSize;
      const z = terrainHeight(x, y);
      addBoxObject(sceneModel, dataModel, {
        id: `terrain_${col + 3}_${row + 3}`,
        size: [tileSize - 2, tileSize - 2, 0.6],
        position: [x, y, z - 0.35],
        color: colorForTerrain(col, row)
      });
    }
  }

  for (let i = -3; i <= 3; i++) {
    addBoxObject(sceneModel, dataModel, {
      id: `road_east_west_${i + 3}`,
      size: [600, 11, 0.08],
      position: [0, i * tileSize, terrainHeight(0, i * tileSize) - 0.02],
      color: [0.09, 0.10, 0.11]
    });
    addBoxObject(sceneModel, dataModel, {
      id: `road_north_south_${i + 3}`,
      size: [11, 600, 0.08],
      position: [i * tileSize, 0, terrainHeight(i * tileSize, 0) - 0.01],
      color: [0.09, 0.10, 0.11]
    });
  }

  for (let i = 0; i < SOURCE_MODELS.length; i++) {
    const spec = SOURCE_MODELS[i];
    addBoxObject(sceneModel, dataModel, {
      id: `pad_${spec.id}`,
      size: [62, 62, 0.18],
      position: [spec.x, spec.y, terrainHeight(spec.x, spec.y) - 0.08],
      color: i % 3 === 0 ? [0.58, 0.58, 0.56] : [0.47, 0.50, 0.51]
    });
  }

  for (let i = 0; i < 24; i++) {
    const angle = i * 1.7;
    const radius = 95 + (i % 5) * 38;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    addBoxObject(sceneModel, dataModel, {
      id: `urban_tree_${i}`,
      size: [4, 4, 7],
      position: [x, y, terrainHeight(x, y) + 3.6],
      color: [0.24, 0.46, 0.27]
    });
  }
}

async function loadPlacedModel(scene, data, targetSceneModel, targetDataModel, spec) {
  const source = resolveSource(spec);

  console.log(`Loading ${source.relPath} as ${spec.id} (${SOURCE_FORMATS[source.format].label})`);
  const sourceSceneModel = must(scene.createModel({
    id: `${spec.id}Source`,
    coordinateSystem: sourceCoordinateSystem(spec)
  }));
  const sourceDataModel = must(data.createModel({id: `${spec.id}Source`}));
  const buffer = fs.readFileSync(source.path);
  const format = SOURCE_FORMATS[source.format];
  await format.loader().load({
    fileData: bufferToArrayBuffer(buffer),
    sceneModel: sourceSceneModel,
    dataModel: sourceDataModel
  }, {
    ...(format.options ? format.options(source) : {}),
    layerId: spec.id,
    yieldIntervalMs: 80
  });

  cloneModelIntoTarget(sourceSceneModel, sourceDataModel, targetSceneModel, targetDataModel, spec);
  sourceSceneModel.destroy();
  sourceDataModel.destroy();
}

function resolveSource(spec) {
  const candidates = (spec.sourceCandidates || defaultSourceCandidates(spec.model))
    .map((candidate) => ({
      ...candidate,
      path: path.join(modelsDir, candidate.relPath)
    }));
  const usdzCandidate = candidates.find((candidate) => candidate.format === "usdz" && fs.existsSync(candidate.path));
  for (const candidate of candidates) {
    if (candidate.format === "usdz" || !fs.existsSync(candidate.path)) {
      continue;
    }
    if (!SOURCE_FORMATS[candidate.format]) {
      throw new Error(`Unsupported source format '${candidate.format}' for ${spec.id}`);
    }
    return candidate;
  }
  if (usdzCandidate) {
    throw new Error(`USDZ source found for ${spec.model}, but USDZ loading is browser-only in this Node generator: ${usdzCandidate.path}`);
  }
  throw new Error(`Missing loadable source for ${spec.model}; tried ${candidates.map((candidate) => candidate.relPath).join(", ")}`);
}

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

function bufferToArrayBuffer(buffer) {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}

function cloneModelIntoTarget(sourceSceneModel, sourceDataModel, targetSceneModel, targetDataModel, spec) {
  const placement = computePlacementOffset(sourceSceneModel, targetSceneModel, spec);
  const textureIdMap = new Map();
  const materialIdMap = new Map();
  const geometryIdMap = new Map();
  const meshIdMap = new Map();

  for (const texture of Object.values(sourceSceneModel.textures)) {
    const params = must(texture.toParams());
    const id = `${spec.id}_${params.id}`;
    textureIdMap.set(params.id, id);
    params.id = id;
    must(targetSceneModel.createTexture(params));
  }
  for (const material of Object.values(sourceSceneModel.materials)) {
    const params = must(material.toParams());
    const id = `${spec.id}_${params.id}`;
    materialIdMap.set(params.id, id);
    params.id = id;
    remapParam(params, "colorTextureId", textureIdMap);
    remapParam(params, "metallicRoughnessTextureId", textureIdMap);
    remapParam(params, "normalsTextureId", textureIdMap);
    remapParam(params, "occlusionTextureId", textureIdMap);
    remapParam(params, "emissiveTextureId", textureIdMap);
    must(targetSceneModel.createMaterial(params));
  }
  for (const geometry of Object.values(sourceSceneModel.geometries)) {
    const params = must(geometry.toParams());
    const id = `${spec.id}_${params.id}`;
    geometryIdMap.set(params.id, id);
    params.id = id;
    must(targetSceneModel.createGeometryCompressed(params));
  }
  for (const mesh of Object.values(sourceSceneModel.meshes)) {
    const id = `${spec.id}_${mesh.id}`;
    meshIdMap.set(mesh.id, id);
    const matrix = applyYaw(Array.from(getMeshWorldMatrix(mesh, targetSceneModel.coordinateSystem)), spec.yaw || 0);
    matrix[12] += placement[0];
    matrix[13] += placement[1];
    matrix[14] += placement[2];
    const params = {
      id,
      geometryId: geometryIdMap.get(mesh.geometry.id),
      matrix,
      color: Array.from(mesh.color),
      opacity: mesh.opacity
    };
    if (mesh.material) {
      params.materialId = materialIdMap.get(mesh.material.id);
    }
    must(targetSceneModel.createMesh(params));
  }
  for (const object of Object.values(sourceSceneModel.objects)) {
    const meshIds = object.meshes.map((mesh) => meshIdMap.get(mesh.id)).filter(Boolean);
    if (meshIds.length === 0) {
      continue;
    }
    const id = `${spec.id}_${object.id}`;
    must(targetSceneModel.createObject({
      id,
      meshIds,
      layerId: spec.id,
      originalSystemId: object.originalSystemId || object.id
    }));
    targetDataModel.createObject({
      id,
      name: id,
      type: "BasicEntity"
    });
  }
}

function computePlacementOffset(sourceSceneModel, targetSceneModel, spec) {
  let sourceAABB;
  for (const mesh of Object.values(sourceSceneModel.meshes)) {
    if (!mesh.geometry || !mesh.geometry.aabb) {
      continue;
    }
    const matrix = applyYaw(getMeshWorldMatrix(mesh, targetSceneModel.coordinateSystem), spec.yaw || 0);
    sourceAABB = unionAABB(sourceAABB, transformAABB(mesh.geometry.aabb, matrix));
  }
  if (!sourceAABB) {
    return [spec.x, spec.y, terrainHeight(spec.x, spec.y)];
  }
  const centerX = (sourceAABB[0] + sourceAABB[3]) / 2;
  const centerY = (sourceAABB[1] + sourceAABB[4]) / 2;
  console.log(`  extents ${formatNumber(sourceAABB[3] - sourceAABB[0])} x ${formatNumber(sourceAABB[4] - sourceAABB[1])} x ${formatNumber(sourceAABB[5] - sourceAABB[2])}m`);
  return [
    spec.x - centerX,
    spec.y - centerY,
    terrainHeight(spec.x, spec.y) + 0.18 - sourceAABB[2]
  ];
}

function addBoxObject(sceneModel, dataModel, {id, size, position, color}) {
  const geom = buildBox({
    xSize: size[0],
    ySize: size[1],
    zSize: size[2]
  });
  if (!geom.ok) {
    throw new Error(geom.error);
  }
  const geometryId = `${id}_geometry`;
  const meshId = `${id}_mesh`;
  must(sceneModel.createGeometry({
    id: geometryId,
    primitive: TrianglesPrimitive,
    positions: geom.value.positions,
    normals: geom.value.normals,
    indices: geom.value.indices
  }));
  must(sceneModel.createMesh({
    id: meshId,
    geometryId,
    matrix: buildMat4({position, rotation: [0, 0, 0], scale: [1, 1, 1]}),
    color
  }));
  must(sceneModel.createObject({id, meshIds: [meshId]}));
  dataModel.createObject({id, name: id, type: "CitySiteElement"});
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

function applyYaw(matrix, yaw) {
  if (!yaw) {
    return Array.from(matrix);
  }
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  const result = Array.from(matrix);
  for (let col = 0; col < 4; col++) {
    const i = col * 4;
    const x = matrix[i];
    const y = matrix[i + 1];
    result[i] = c * x - s * y;
    result[i + 1] = s * x + c * y;
  }
  return result;
}

function terrainHeight(x, y) {
  const ridge = 0.018 * y;
  const westHill = Math.exp(-(((x + 160) / 180) ** 2 + ((y - 60) / 150) ** 2)) * 18;
  const eastHill = Math.exp(-(((x - 170) / 160) ** 2 + ((y + 130) / 180) ** 2)) * 13;
  const valley = Math.exp(-((x / 120) ** 2 + ((y + 20) / 160) ** 2)) * 6;
  return Math.max(0, ridge + westHill + eastHill - valley);
}

function colorForTerrain(col, row) {
  if (Math.abs(col) <= 1 && Math.abs(row) <= 1) {
    return [0.48, 0.50, 0.49];
  }
  if ((col + row) % 4 === 0) {
    return [0.35, 0.52, 0.37];
  }
  return [0.56, 0.58, 0.56];
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

function remapParam(params, key, map) {
  if (params[key]) {
    params[key] = map.get(params[key]) || params[key];
  }
}

function formatNumber(value) {
  return value.toLocaleString(undefined, {maximumFractionDigits: 1});
}

function must(result) {
  if (!result || result.ok === false) {
    throw new Error(result?.error || "Operation failed");
  }
  return result.value;
}
