// Generates the small hand-authored XGF Stream chunks example.
//
// Demonstrates explicit asset-library and references-only chunk manifests when
// an application wants direct control over chunk membership instead of automatic
// grid partitioning.

const fs = require("fs");
const path = require("path");

process.env.TS_NODE_COMPILER_OPTIONS = JSON.stringify({
  module: "commonjs",
  moduleResolution: "node",
  verbatimModuleSyntax: false
});

require("ts-node/register/transpile-only");

const {sdkRequire} = require("../../lib/sdk-require");

const {TrianglesPrimitive} = sdkRequire("base/constants");
const {Scene} = sdkRequire("model/scene/Scene");
const {XGFStreamingExporter} = sdkRequire("formats/xgfstream/XGFStreamingExporter");

const OUT_DIR = path.resolve(__dirname, "..", "..", "..", "examples/streaming/xgf/chunks/chunks");

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function main() {
  fs.mkdirSync(OUT_DIR, {recursive: true});

  const sceneModel = buildSceneModel();
  const result = await new XGFStreamingExporter().write({
    sceneModel,
    assetLibraries: [
      {
        id: "shared-assets",
        uri: "chunks/shared-assets.xgf",
        objectIds: ["west-building"],
        geometryIds: ["tall-block", "roof-cap"],
        materialIds: ["roof"]
      },
      {
        id: "glass-materials",
        uri: "chunks/glass-materials.xgf",
        materialIds: ["glass"]
      }
    ],
    chunks: [
      {
        id: "west-tile",
        uri: "chunks/west-tile.xgf",
        objectIds: ["west-building"],
        assetLibraryIds: ["shared-assets", "glass-materials"],
        priority: 10,
        lod: 0
      },
      {
        id: "center-tile",
        uri: "chunks/center-tile.xgf",
        objectIds: ["center-building"],
        assetLibraryIds: ["shared-assets", "glass-materials"],
        priority: 20,
        lod: 0
      },
      {
        id: "east-tile",
        uri: "chunks/east-tile.xgf",
        objectIds: ["east-building"],
        assetLibraryIds: ["shared-assets", "glass-materials"],
        priority: 30,
        lod: 0
      }
    ],
    indexUri: "chunks/index.json",
    runtimeIndexUri: "chunks/index.runtime.json"
  });

  if (!result.ok) {
    throw new Error(result.error);
  }

  for (const [uri, data] of Object.entries(result.value.files)) {
    const fileName = path.basename(uri);
    const filePath = path.join(OUT_DIR, fileName);
    if (data instanceof ArrayBuffer) {
      fs.writeFileSync(filePath, Buffer.from(data));
    } else {
      fs.writeFileSync(filePath, `${JSON.stringify(data)}\n`, "utf8");
    }
  }

  console.log(`Generated ${Object.keys(result.value.files).length} XGF streaming files in ${OUT_DIR}`);
}

function buildSceneModel() {
  const scene = new Scene();
  const sceneModelResult = scene.createModel({id: "xgfStreamingFixture"});
  if (!sceneModelResult.ok) {
    throw new Error(sceneModelResult.error);
  }
  const sceneModel = sceneModelResult.value;

  createBoxGeometry(sceneModel, "low-block", 4, 4, 3);
  createBoxGeometry(sceneModel, "tall-block", 3, 3, 8);
  createBoxGeometry(sceneModel, "roof-cap", 4.6, 4.6, 0.5);

  must(sceneModel.createMaterial({id: "facade", color: [0.78, 0.66, 0.48], roughness: 0.85}));
  must(sceneModel.createMaterial({id: "roof", color: [0.42, 0.16, 0.12], roughness: 0.65}));
  must(sceneModel.createMaterial({id: "glass", color: [0.25, 0.55, 0.85], opacity: 0.72, metallic: 0.05, roughness: 0.18}));

  createBuilding(sceneModel, {
    id: "west-building",
    x: -6,
    y: 0,
    coreGeometryId: "low-block",
    coreMaterialId: "facade",
    roofMaterialId: "facade"
  });
  createBuilding(sceneModel, {
    id: "center-building",
    x: 0,
    y: 0,
    coreGeometryId: "tall-block",
    coreMaterialId: "glass",
    roofMaterialId: "roof"
  });
  createBuilding(sceneModel, {
    id: "east-building",
    x: 6,
    y: 0,
    coreGeometryId: "low-block",
    coreMaterialId: "roof",
    roofMaterialId: "roof"
  });

  return sceneModel;
}

function createBuilding(sceneModel, params) {
  const baseTransformId = `${params.id}-base`;
  const roofTransformId = `${params.id}-roof`;
  const coreMeshId = `${params.id}-core`;
  const roofMeshId = `${params.id}-cap`;

  must(sceneModel.createTransform({
    id: baseTransformId,
    matrix: translation(params.x, params.y, 0)
  }));
  must(sceneModel.createTransform({
    id: roofTransformId,
    matrix: translation(params.x, params.y, params.coreGeometryId === "tall-block" ? 8.25 : 3.25)
  }));
  must(sceneModel.createMesh({
    id: coreMeshId,
    geometryId: params.coreGeometryId,
    materialId: params.coreMaterialId,
    parentTransformId: baseTransformId
  }));
  must(sceneModel.createMesh({
    id: roofMeshId,
    geometryId: "roof-cap",
    materialId: params.roofMaterialId,
    parentTransformId: roofTransformId
  }));
  must(sceneModel.createObject({
    id: params.id,
    meshIds: [coreMeshId, roofMeshId]
  }));
}

function createBoxGeometry(sceneModel, id, sx, sy, sz) {
  const x = sx / 2;
  const y = sy / 2;
  const z = sz;
  must(sceneModel.createGeometry({
    id,
    primitive: TrianglesPrimitive,
    positions: [
      -x, -y, 0,  x, -y, 0,  x,  y, 0, -x,  y, 0,
      -x, -y, z,  x, -y, z,  x,  y, z, -x,  y, z
    ],
    indices: [
      0, 1, 2, 0, 2, 3,
      4, 6, 5, 4, 7, 6,
      0, 4, 5, 0, 5, 1,
      1, 5, 6, 1, 6, 2,
      2, 6, 7, 2, 7, 3,
      3, 7, 4, 3, 4, 0
    ]
  }));
}

function translation(x, y, z) {
  return [
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    x, y, z, 1
  ];
}

function must(result) {
  if (!result.ok) {
    throw new Error(result.error);
  }
  return result.value;
}
