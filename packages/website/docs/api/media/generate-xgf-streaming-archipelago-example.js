// Generates the Archipelago XGF Stream dataset from procedural scene content
// plus placed model files.
//
// Demonstrates using the SDK from Node to build a SceneModel, load existing XGF
// models with per-model placement, then export the combined scene as one stream.

const fs = require("fs");
const path = require("path");

process.env.TS_NODE_COMPILER_OPTIONS = JSON.stringify({
  module: "commonjs",
  moduleResolution: "node",
  verbatimModuleSyntax: false
});

require("ts-node/register/transpile-only");

const {Scene} = require("../../sdk/src/model/scene/Scene");
const {Data} = require("../../sdk/src/model/data/Data");
const {TrianglesPrimitive, sRGBEncoding, LinearFilter} = require("../../sdk/src/base/constants");
const {yieldToHost} = require("../../sdk/src/base/utils");
const {buildBox} = require("../../sdk/src/model/procgen/buildGeometry/buildBox");
const {buildMat4} = require("../../sdk/src/model/scene/buildMat4");
const {getMeshWorldMatrix} = require("../../sdk/src/model/scene/getMeshWorldMatrix");
const {XGFLoader} = require("../../sdk/src/formats/xgf/XGFLoader");
const {XGFStreamExporter} = require("../../sdk/src/formats/xgfstream/XGFStreamExporter");

const rootDir = path.resolve(__dirname, "../../..");
const outDir = path.join(rootDir, "packages/website/models/Archipelago/xgfstream");

const UTM_EAST = 267000.0;
const UTM_NORTH = 6550000.0;
const ARCH_COORDINATE_SYSTEM = {
  basis: [1, 0, 0, 0, 0, 1, 0, 1, 0],
  origin: [UTM_EAST, 0.0, UTM_NORTH],
  units: "meters",
  scaleToMeters: 1
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function main() {
  fs.rmSync(outDir, {recursive: true, force: true});
  fs.mkdirSync(outDir, {recursive: true});

  const {buildArchipelago} = await import("../examples/building_doublePrecision_archipelago/archipelago.js");
  const scene = new Scene();
  const data = new Data();
  const sceneModel = must(scene.createModel({
    id: "Archipelago",
    coordinateSystem: ARCH_COORDINATE_SYSTEM
  }));
  const dataModel = must(data.createModel({id: "Archipelago"}));

  const xeokit = {
    base: {
      constants: {TrianglesPrimitive, sRGBEncoding, LinearFilter},
      utils: {yieldToHost}
    },
    model: {
      procgen: {buildGeometry: {buildBox}},
      scene: {buildMat4}
    }
  };

  console.log("Building procedural archipelago");
  const {duplexAnchor, houseAnchor, SEA_LEVEL} = await buildArchipelago(xeokit, sceneModel, yieldToHost);
  console.log("Anchors", JSON.stringify({duplexAnchor, houseAnchor, SEA_LEVEL}));

  addBuildingFoundations(sceneModel, {duplexAnchor, houseAnchor});
  await loadPlacedXGF(scene, data, sceneModel, dataModel, {
    id: "duplex",
    src: "packages/website/models/Duplex/xgf/model.xgf",
    coordinateSystem: {
      basis: [1, 0, 0, 0, 1, 0, 0, 0, 1],
      origin: [UTM_EAST + duplexAnchor[0], duplexAnchor[2] + 3.0, UTM_NORTH + duplexAnchor[1]],
      units: "meters",
      scaleToMeters: 1
    }
  });
  await loadPlacedXGF(scene, data, sceneModel, dataModel, {
    id: "house",
    src: "packages/website/models/IfcOpenHouse4/xgf/model.xgf",
    coordinateSystem: {
      basis: [1, 0, 0, 0, 1, 0, 0, 0, 1],
      origin: [UTM_EAST + houseAnchor[0], houseAnchor[2] + 13.0, UTM_NORTH + houseAnchor[1]],
      units: "meters",
      scaleToMeters: 1
    }
  });
  await loadPlacedXGF(scene, data, sceneModel, dataModel, {
    id: "ferry",
    src: "packages/website/models/Ferry/xgf/model.xgf",
    coordinateSystem: {
      basis: [1, 0, 0, 0, 1, 0, 0, 0, 1],
      origin: [UTM_EAST + 8500, SEA_LEVEL, UTM_NORTH - 8500],
      units: "meters",
      scaleToMeters: 1
    }
  });

  console.log(`Loaded ${sceneModel.stats.numObjects.toLocaleString()} merged objects`);
  console.log("Exporting XGF stream");
  const stream = await new XGFStreamExporter().write({
    sceneModel,
    dataModel
  }, {
    coordinateSystem: scene.coordinateSystem,
    partition: "grid",
    chunkMetric: "meshes",
    chunkBudget: 280,
    minChunkBudget: 90,
    gridCellSize: 1800,
    index: "index.json",
    runtimeIndex: "index.runtime.json",
    assetId: "archipelago-assets",
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

function addBuildingFoundations(sceneModel, {duplexAnchor, houseAnchor}) {
  if (duplexAnchor) {
    const [x, y, z] = duplexAnchor;
    addBoxObject(sceneModel, {
      id: "duplex_pedestal",
      size: [11, 30, 2],
      position: [x, y, z],
      color: [0.55, 0.55, 0.58]
    });
  }
  if (houseAnchor) {
    const [x, y, z] = houseAnchor;
    addBoxObject(sceneModel, {
      id: "house_slab",
      size: [16, 16, 2],
      position: [x, y, z + 6],
      color: [0.55, 0.55, 0.58]
    });
  }
}

function addBoxObject(sceneModel, {id, size, position, color}) {
  const geom = buildBox({xSize: size[0], ySize: size[1], zSize: size[2]});
  if (!geom.ok) {
    throw new Error(geom.error);
  }
  const geometryId = `${id}_geom`;
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
    materialId: "MAT_MATTE",
    matrix: buildMat4({position, rotation: [0, 0, 0], scale: [1, 1, 1]}),
    color
  }));
  must(sceneModel.createObject({id, meshIds: [meshId]}));
}

async function loadPlacedXGF(scene, data, targetSceneModel, targetDataModel, spec) {
  console.log(`Loading ${spec.id}`);
  const sourceSceneModel = must(scene.createModel({
    id: `${spec.id}Source`,
    coordinateSystem: spec.coordinateSystem
  }));
  const sourceDataModel = must(data.createModel({id: `${spec.id}Source`}));
  const buffer = fs.readFileSync(path.join(rootDir, spec.src));
  await new XGFLoader().load({
    fileData: buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
    sceneModel: sourceSceneModel,
    dataModel: sourceDataModel
  }, {
    layerId: spec.id,
    yieldIntervalMs: 80
  });
  cloneModelIntoTarget(sourceSceneModel, sourceDataModel, targetSceneModel, targetDataModel, spec.id);
  sourceSceneModel.destroy();
  sourceDataModel.destroy();
}

function cloneModelIntoTarget(sourceSceneModel, sourceDataModel, targetSceneModel, targetDataModel, prefix) {
  const textureIdMap = new Map();
  const materialIdMap = new Map();
  const geometryIdMap = new Map();
  const meshIdMap = new Map();

  for (const texture of Object.values(sourceSceneModel.textures)) {
    const params = must(texture.toParams());
    const id = `${prefix}_${params.id}`;
    textureIdMap.set(params.id, id);
    params.id = id;
    must(targetSceneModel.createTexture(params));
  }
  for (const material of Object.values(sourceSceneModel.materials)) {
    const params = must(material.toParams());
    const id = `${prefix}_${params.id}`;
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
    const id = `${prefix}_${params.id}`;
    geometryIdMap.set(params.id, id);
    params.id = id;
    must(targetSceneModel.createGeometryCompressed(params));
  }
  for (const mesh of Object.values(sourceSceneModel.meshes)) {
    const id = `${prefix}_${mesh.id}`;
    meshIdMap.set(mesh.id, id);
    const params = {
      id,
      geometryId: geometryIdMap.get(mesh.geometry.id),
      matrix: Array.from(getMeshWorldMatrix(mesh, targetSceneModel.coordinateSystem)),
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
    const id = `${prefix}_${object.id}`;
    must(targetSceneModel.createObject({
      id,
      meshIds,
      layerId: prefix,
      originalSystemId: object.originalSystemId || object.id
    }));
    targetDataModel.createObject({id, name: id, type: "BasicEntity"});
  }
}

function remapParam(params, key, map) {
  if (params[key]) {
    params[key] = map.get(params[key]) || params[key];
  }
}

function must(result) {
  if (!result || result.ok === false) {
    throw new Error(result?.error || "Operation failed");
  }
  return result.value;
}
