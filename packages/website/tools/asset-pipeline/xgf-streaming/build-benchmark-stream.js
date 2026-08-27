// Generates the synthetic XGF streaming benchmark dataset.
//
// Demonstrates a repeatable Node-side fixture with explicit chunks and shared
// asset libraries, useful for profiling loader and scheduler behavior.

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

const OUT_DIR = path.resolve(__dirname, "..", "..", "..", "examples/benchmarks/streaming/xgf-basic/chunks");
const GRID_SIZE = 31;
const BLOCK_SPACING = 24;
const BLOCK_OBJECT_IDS = new Map();
const BUILDING_SPECS = {
  "apt-tower": {sx: 3.2, sy: 3.2, sz: 14},
  "apt-slab": {sx: 5.5, sy: 3.0, sz: 7},
  "office-tower": {sx: 5.0, sy: 5.0, sz: 32},
  "office-slab": {sx: 9.0, sy: 5.0, sz: 18},
  "office-needle": {sx: 3.6, sy: 3.6, sz: 52},
  "hotel-tower": {sx: 5.6, sy: 4.2, sz: 26},
  "civic-hall": {sx: 12.0, sy: 8.0, sz: 9},
  "brutalist-slab": {sx: 13.5, sy: 6.2, sz: 16},
  "eco-terrace": {sx: 7.5, sy: 5.0, sz: 9},
  "shopfront": {sx: 6.8, sy: 4.2, sz: 5.5},
  "townhouse": {sx: 4.2, sy: 5.8, sz: 5},
  "rowhouse": {sx: 3.4, sy: 7.2, sz: 6.5},
  "industrial-hall": {sx: 11.0, sy: 7.0, sz: 5.5},
  "landmark-core": {sx: 7.0, sy: 7.0, sz: 44}
};
const PARAPET_GEOMETRY_IDS = Object.keys(BUILDING_SPECS).flatMap((id) => [`parapet-${id}-front`, `parapet-${id}-side`]);

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function main() {
  fs.rmSync(OUT_DIR, {recursive: true, force: true});
  fs.mkdirSync(OUT_DIR, {recursive: true});

  const sceneModel = buildSceneModel();
  const chunks = [];
  for (let z = 0; z < GRID_SIZE; z++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      const id = blockId(x, z);
      chunks.push({
        id,
        uri: `chunks/${id}.xgf`,
        objectIds: BLOCK_OBJECT_IDS.get(id) || [],
        assetLibraryIds: ["geometry-assets", "material-assets"],
        priority: distancePriority(x, z),
        lod: 0
      });
    }
  }

  const result = await new XGFStreamingExporter().write({
    sceneModel,
    assetLibraries: [
      {
        id: "geometry-assets",
        uri: "chunks/geometry-assets.xgf",
        geometryIds: [
          "apt-tower",
          "apt-slab",
          "office-tower",
          "office-slab",
          "office-needle",
          "hotel-tower",
          "civic-hall",
          "brutalist-slab",
          "eco-terrace",
          "shopfront",
          "townhouse",
          "rowhouse",
          "industrial-hall",
          "industrial-stack",
          "landmark-core",
          "spire",
          "cyl-tank",
          "cyl-column",
          "cyl-stack",
          "sphere-dome",
          "sphere-tree",
          "roof-plant",
          "roof-unit",
          "solar-panel",
          "balcony-strip",
          "balcony-rail",
          "balcony-rail-narrow",
          "window-wide",
          "window-narrow",
          "shop-awning",
          "entry-door",
          ...PARAPET_GEOMETRY_IDS,
          "courtyard-podium",
          "retaining-wall",
          "stair-run",
          "plaza-tile",
          "park-tile",
          "water-tile",
          "street-segment",
          "avenue-segment",
          "rail-segment",
          "tree-canopy"
        ]
      },
      {
        id: "material-assets",
        uri: "chunks/material-assets.xgf",
        materialIds: [
          "concrete",
          "brick",
          "glass",
          "window",
          "awning",
          "metal",
          "roof",
          "asphalt",
          "green",
          "water",
          "office",
          "hotel",
          "brutalist",
          "shopfront",
          "eco",
          "landmark",
          "rail",
          "industrial",
          "terracotta"
        ]
      }
    ],
    chunks,
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

  console.log([
    `Generated ${chunks.length} block chunks`,
    `${sceneModel.stats.numObjects} city objects`,
    `${Object.keys(result.value.files).length} files`,
    OUT_DIR
  ].join(" | "));
}

function buildSceneModel() {
  const scene = new Scene();
  const sceneModel = must(scene.createModel({id: "xgfStreamingBenchmark"}));

  for (const [id, spec] of Object.entries(BUILDING_SPECS)) {
    createBoxGeometry(sceneModel, id, spec.sx, spec.sy, spec.sz);
  }
  createBoxGeometry(sceneModel, "industrial-stack", 1.2, 1.2, 16);
  createBoxGeometry(sceneModel, "spire", 1.2, 1.2, 18);
  createCylinderGeometry(sceneModel, "cyl-tank", 2.2, 4.2, 20);
  createCylinderGeometry(sceneModel, "cyl-column", 0.55, 7.0, 16);
  createCylinderGeometry(sceneModel, "cyl-stack", 0.75, 18.0, 16);
  createSphereGeometry(sceneModel, "sphere-dome", 4.2, 16, 8);
  createSphereGeometry(sceneModel, "sphere-tree", 1.4, 12, 6);
  createBoxGeometry(sceneModel, "roof-plant", 1.2, 1.2, 0.7);
  createBoxGeometry(sceneModel, "roof-unit", 1.7, 1.1, 0.85);
  createBoxGeometry(sceneModel, "solar-panel", 2.6, 1.4, 0.12);
  createBoxGeometry(sceneModel, "balcony-strip", 3.6, 0.35, 0.25);
  createBoxGeometry(sceneModel, "balcony-rail", 3.6, 0.18, 0.75);
  createBoxGeometry(sceneModel, "balcony-rail-narrow", 2.4, 0.18, 0.75);
  createBoxGeometry(sceneModel, "window-wide", 2.7, 0.12, 1.05);
  createBoxGeometry(sceneModel, "window-narrow", 0.9, 0.12, 1.2);
  createBoxGeometry(sceneModel, "shop-awning", 5.6, 0.85, 0.25);
  createBoxGeometry(sceneModel, "entry-door", 1.25, 0.16, 2.35);
  for (const [id, spec] of Object.entries(BUILDING_SPECS)) {
    createBoxGeometry(sceneModel, `parapet-${id}-front`, spec.sx + 0.18, 0.32, 0.7);
    createBoxGeometry(sceneModel, `parapet-${id}-side`, 0.32, spec.sy + 0.18, 0.7);
  }
  createBoxGeometry(sceneModel, "courtyard-podium", 11.5, 11.5, 0.5);
  createBoxGeometry(sceneModel, "retaining-wall", 18, 0.65, 4.8);
  createBoxGeometry(sceneModel, "stair-run", 3.2, 8.5, 0.45);
  createBoxGeometry(sceneModel, "plaza-tile", 13.5, 13.5, 0.08);
  createBoxGeometry(sceneModel, "park-tile", 14.5, 14.5, 0.08);
  createBoxGeometry(sceneModel, "water-tile", 17, 17, 0.04);
  createBoxGeometry(sceneModel, "street-segment", 18, 3.2, 0.05);
  createBoxGeometry(sceneModel, "avenue-segment", 21, 5.2, 0.05);
  createBoxGeometry(sceneModel, "rail-segment", 19, 1.2, 0.08);
  createBoxGeometry(sceneModel, "tree-canopy", 1.6, 1.6, 2.2);

  must(sceneModel.createMaterial({id: "concrete", color: [0.68, 0.66, 0.60], roughness: 0.9}));
  must(sceneModel.createMaterial({id: "brick", color: [0.55, 0.24, 0.18], roughness: 0.82}));
  must(sceneModel.createMaterial({id: "glass", color: [0.20, 0.42, 0.66], opacity: 0.72, metallic: 0.05, roughness: 0.12}));
  must(sceneModel.createMaterial({id: "window", color: [0.08, 0.17, 0.24], opacity: 0.76, metallic: 0.04, roughness: 0.16}));
  must(sceneModel.createMaterial({id: "awning", color: [0.70, 0.18, 0.12], roughness: 0.68}));
  must(sceneModel.createMaterial({id: "metal", color: [0.42, 0.43, 0.42], metallic: 0.12, roughness: 0.5}));
  must(sceneModel.createMaterial({id: "roof", color: [0.23, 0.25, 0.27], roughness: 0.7}));
  must(sceneModel.createMaterial({id: "asphalt", color: [0.10, 0.11, 0.12], roughness: 0.95}));
  must(sceneModel.createMaterial({id: "green", color: [0.20, 0.42, 0.22], roughness: 0.85}));
  must(sceneModel.createMaterial({id: "water", color: [0.08, 0.32, 0.50], opacity: 0.82, roughness: 0.2}));
  must(sceneModel.createMaterial({id: "office", color: [0.48, 0.56, 0.62], roughness: 0.58}));
  must(sceneModel.createMaterial({id: "hotel", color: [0.62, 0.50, 0.46], roughness: 0.62}));
  must(sceneModel.createMaterial({id: "brutalist", color: [0.50, 0.50, 0.47], roughness: 0.94}));
  must(sceneModel.createMaterial({id: "shopfront", color: [0.24, 0.31, 0.36], opacity: 0.82, roughness: 0.22}));
  must(sceneModel.createMaterial({id: "eco", color: [0.36, 0.48, 0.35], roughness: 0.86}));
  must(sceneModel.createMaterial({id: "landmark", color: [0.70, 0.58, 0.36], roughness: 0.48}));
  must(sceneModel.createMaterial({id: "rail", color: [0.32, 0.30, 0.27], roughness: 0.72}));
  must(sceneModel.createMaterial({id: "industrial", color: [0.44, 0.43, 0.38], roughness: 0.86}));
  must(sceneModel.createMaterial({id: "terracotta", color: [0.66, 0.32, 0.22], roughness: 0.8}));

  BLOCK_OBJECT_IDS.clear();
  for (let z = 0; z < GRID_SIZE; z++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      createBlock(sceneModel, x, z);
    }
  }

  return sceneModel;
}

function createBlock(sceneModel, gx, gz) {
  const originX = (gx - (GRID_SIZE - 1) / 2) * BLOCK_SPACING;
  const originY = (gz - (GRID_SIZE - 1) / 2) * BLOCK_SPACING;
  const baseZ = terrainHeight(gx, gz);
  const block = blockId(gx, gz);
  const meshIds = [];
  const addSimple = (suffix, geometryId, materialId, x, y, z, yaw = 0) => {
    const id = `${block}-${suffix}`;
    meshIds.push(createSimpleMesh(sceneModel, id, geometryId, materialId, x, y, baseZ + z, yaw));
  };
  const addBuilding = (suffix, params) => {
    const id = `${block}-${suffix}`;
    meshIds.push(...createBuildingMeshes(sceneModel, {id, z: baseZ, ...params}));
  };

  const district = classifyBlock(gx, gz);
  addSimple("street-ns", gx === Math.floor(GRID_SIZE / 2) ? "avenue-segment" : "street-segment", "asphalt", originX, originY - 10.4, 0);
  addSimple("street-ew", gz === Math.floor(GRID_SIZE / 2) ? "avenue-segment" : "street-segment", "asphalt", originX - 10.4, originY, 0, Math.PI / 2);
  if (gx === 2 || gx === GRID_SIZE - 3) {
    addSimple("rail", "rail-segment", "rail", originX, originY + 9.2, 0, Math.PI / 2);
  }
  if (baseZ > 8) {
    addSimple("retaining-north", "retaining-wall", "brutalist", originX, originY + 10.8, -0.2);
  }

  if (district === "waterfront") {
    addSimple("water", "water-tile", "water", originX, originY, -0.02);
    addSimple("quay", "avenue-segment", "concrete", originX, originY + 7.8, 0);
    for (let i = 0; i < 4; i++) {
      addBuilding(`warehouse-${i}`, {
        x: originX - 6 + i * 4,
        y: originY + 1.5 + (i % 2) * 4,
        geometryId: "industrial-hall",
        wallMaterialId: "industrial",
        height: 5.5,
        yaw: i % 2 ? Math.PI / 2 : 0
      });
    }
    addBuilding("hotel", {
      x: originX + 4.5,
      y: originY - 5.5,
      geometryId: "shopfront",
      wallMaterialId: "shopfront",
      height: 5.5,
      yaw: Math.PI / 6
    });
  } else if (district === "civic") {
    addSimple("plaza", "plaza-tile", "concrete", originX, originY, 0);
    addBuilding("hall", {
      x: originX - 5.5,
      y: originY + 3.5,
      geometryId: "civic-hall",
      wallMaterialId: "landmark",
      height: 9,
      yaw: 0
    });
    addBuilding("landmark", {
      x: originX,
      y: originY,
      geometryId: "landmark-core",
      wallMaterialId: "landmark",
      height: 44,
      yaw: Math.PI / 4,
      spire: true
    });
    addSimple("dome", "sphere-dome", "landmark", originX - 5.5, originY + 3.5, 9);
    addSimple("column-a", "cyl-column", "landmark", originX - 10.5, originY - 4.5, 0);
    addSimple("column-b", "cyl-column", "landmark", originX - 6.5, originY - 4.5, 0);
    addSimple("column-c", "cyl-column", "landmark", originX - 2.5, originY - 4.5, 0);
    addStreetTrees(addSimple, originX, originY, 6);
  } else if (district === "park") {
    addSimple("park", "park-tile", "green", originX, originY, 0);
    addStreetTrees(addSimple, originX, originY, 10);
    addBuilding("pavilion", {
      x: originX + 4.5,
      y: originY - 3.5,
      geometryId: "townhouse",
      wallMaterialId: "landmark",
      height: 5,
      yaw: Math.PI / 2
    });
  } else if (district === "shopping") {
    addSimple("lane", "avenue-segment", "asphalt", originX, originY, 0);
    for (let i = 0; i < 8; i++) {
      const side = i < 4 ? -1 : 1;
      const col = i % 4;
      addBuilding(`shop-${i}`, {
        x: originX - 7.2 + col * 4.8,
        y: originY + side * 5.2,
        geometryId: "shopfront",
        wallMaterialId: "shopfront",
        height: 5.5,
        yaw: 0
      });
    }
    addStreetTrees(addSimple, originX, originY, 6);
  } else if (district === "brutalist") {
    addSimple("podium", "plaza-tile", "brutalist", originX, originY, 0);
    addBuilding("slab-a", {
      x: originX - 3.5,
      y: originY + 1.5,
      geometryId: "brutalist-slab",
      wallMaterialId: "brutalist",
      height: 16,
      yaw: Math.PI / 10
    });
    addBuilding("slab-b", {
      x: originX + 5.5,
      y: originY - 4.5,
      geometryId: "office-slab",
      wallMaterialId: "concrete",
      height: 18,
      yaw: Math.PI / 2
    });
    addSimple("stairs", "stair-run", "concrete", originX - 8, originY - 1, 0, Math.PI / 2);
  } else if (district === "eco") {
    addSimple("courtyard", "park-tile", "green", originX, originY, 0);
    for (let i = 0; i < 6; i++) {
      addBuilding(`terrace-${i}`, {
        x: originX - 7.5 + (i % 3) * 7.5,
        y: originY - 4.2 + Math.floor(i / 3) * 8.5,
        geometryId: "eco-terrace",
        wallMaterialId: "eco",
        height: 9,
        yaw: i % 2 ? Math.PI / 2 : 0
      });
    }
    addStreetTrees(addSimple, originX, originY, 8);
  } else if (district === "downtown") {
    addSimple("plaza", "plaza-tile", "concrete", originX, originY, 0);
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      const radius = 4.8 + (i % 2) * 3.8;
      const variant = i % 4;
      addBuilding(`tower-${i}`, {
        x: originX + Math.cos(angle) * radius,
        y: originY + Math.sin(angle) * radius,
        geometryId: variant === 0 ? "office-needle" : variant === 1 ? "office-tower" : variant === 2 ? "hotel-tower" : "brutalist-slab",
        wallMaterialId: variant === 0 ? "office" : variant === 2 ? "hotel" : "office",
        height: variant === 0 ? 52 : variant === 1 ? 32 : variant === 2 ? 26 : 18,
        yaw: angle
      });
    }
  } else if (district === "industrial") {
    addSimple("yard", "courtyard-podium", "industrial", originX, originY, 0);
    for (let i = 0; i < 7; i++) {
      addBuilding(`shed-${i}`, {
        x: originX - 6 + (i % 3) * 6,
        y: originY - 3 + Math.floor(i / 3) * 6,
        geometryId: "industrial-hall",
        wallMaterialId: "industrial",
        height: 5.5,
        yaw: i % 2 ? Math.PI / 2 : 0
      });
    }
    addSimple("stack", "industrial-stack", "industrial", originX + 8, originY + 7, 0);
    addSimple("round-tank-a", "cyl-tank", "industrial", originX + 6.5, originY - 7.5, 0);
    addSimple("round-tank-b", "cyl-tank", "industrial", originX + 10.0, originY - 4.0, 0);
    addSimple("smokestack", "cyl-stack", "industrial", originX - 9.0, originY + 7.0, 0);
  } else {
    addSimple("podium", "courtyard-podium", "green", originX, originY, 0);
    for (let i = 0; i < 12; i++) {
      const col = i % 4;
      const row = Math.floor(i / 4);
      const localX = -6.8 + col * 4.5;
      const localY = -6.8 + row * 5.4;
      const variant = (gx * 3 + gz + i) % 5;
      addBuilding(`apt-${String(i).padStart(2, "0")}`, {
        x: originX + localX,
        y: originY + localY,
        geometryId: variant === 0 ? "apt-tower" : variant === 1 ? "apt-slab" : variant === 2 ? "townhouse" : variant === 3 ? "rowhouse" : "eco-terrace",
        wallMaterialId: variant === 3 ? "terracotta" : (i & 1) ? "brick" : "concrete",
        height: variant === 0 ? 14 : variant === 1 ? 7 : variant === 2 ? 5 : variant === 3 ? 6.5 : 9,
        yaw: ((gx + i) % 2) ? 0 : Math.PI / 2
      });
    }
  }

  must(sceneModel.createObject({id: block, meshIds}));
  BLOCK_OBJECT_IDS.set(block, [block]);
}

function createBuildingMeshes(sceneModel, params) {
  const base = `${params.id}-body`;
  const roof = `${params.id}-roof`;
  const baseZ = params.z || 0;
  const roofZ = baseZ + params.height + 0.35;
  const meshIds = [];
  const addMesh = (suffix, geometryId, materialId, localX, localY, z, yawOffset = 0) => {
    const meshId = `${params.id}-${suffix}`;
    const point = offsetPoint(params.x, params.y, localX, localY, params.yaw);
    must(sceneModel.createTransform({id: `${meshId}-xform`, matrix: transform(point.x, point.y, z, params.yaw + yawOffset)}));
    must(sceneModel.createMesh({id: meshId, geometryId, materialId, parentTransformId: `${meshId}-xform`}));
    meshIds.push(meshId);
  };

  must(sceneModel.createTransform({id: `${base}-xform`, matrix: transform(params.x, params.y, baseZ, params.yaw)}));
  must(sceneModel.createTransform({id: `${roof}-xform`, matrix: transform(params.x, params.y, roofZ, params.yaw)}));
  must(sceneModel.createMesh({id: base, geometryId: params.geometryId, materialId: params.wallMaterialId, parentTransformId: `${base}-xform`}));
  must(sceneModel.createMesh({id: roof, geometryId: "roof-plant", materialId: "roof", parentTransformId: `${roof}-xform`}));
  meshIds.push(base, roof);

  addBuildingDetails(params, baseZ, roofZ, addMesh);

  if (params.spire) {
    const spire = `${params.id}-spire`;
    must(sceneModel.createTransform({id: `${spire}-xform`, matrix: transform(params.x, params.y, baseZ + params.height + 18, params.yaw)}));
    must(sceneModel.createMesh({id: spire, geometryId: "spire", materialId: "landmark", parentTransformId: `${spire}-xform`}));
    meshIds.push(spire);
  }
  return meshIds;
}

function addBuildingDetails(params, baseZ, roofZ, addMesh) {
  const geometryId = params.geometryId;
  const spec = BUILDING_SPECS[geometryId] || {sx: 5, sy: 5};
  const frontY = -spec.sy / 2 - 0.08;
  const backY = spec.sy / 2 + 0.08;
  const roofInsetX = Math.max(0, spec.sx / 2 - 1.4);
  const roofInsetY = Math.max(0, spec.sy / 2 - 1.2);
  const floors = Math.max(1, Math.floor(params.height / 3.2));
  const isOffice = geometryId === "office-tower" || geometryId === "office-slab" || geometryId === "office-needle";
  const isResidential = geometryId === "apt-tower" || geometryId === "apt-slab" || geometryId === "townhouse" || geometryId === "rowhouse";
  const isShop = geometryId === "shopfront";
  const isBrutalist = geometryId === "brutalist-slab" || geometryId === "civic-hall" || geometryId === "landmark-core";
  const isIndustrial = geometryId === "industrial-hall";

  addParapet(addMesh, geometryId, spec, roofZ + 0.15);

  if (isShop) {
    addMesh("entry", "entry-door", "glass", 0, frontY, baseZ + 0.05);
    addMesh("awning", "shop-awning", "awning", 0, frontY - 0.28, baseZ + 2.7);
    addWindowRows(addMesh, 2, facadeOffsets(spec.sx, 3, 1.0), frontY, baseZ + 3.6, "window-wide", "window");
    addMesh("roof-ac-a", "roof-unit", "metal", -roofInsetX, roofInsetY, roofZ + 0.1);
    return;
  }

  if (isIndustrial) {
    addMesh("roller-door", "entry-door", "metal", -Math.min(2.4, roofInsetX), frontY, baseZ + 0.05);
    addMesh("office-door", "entry-door", "window", Math.min(3.2, roofInsetX), frontY, baseZ + 0.05);
    addWindowRows(addMesh, 1, facadeOffsets(spec.sx, 4, 1.0), frontY, baseZ + 3.1, "window-narrow", "window");
    addMesh("vent-a", "roof-unit", "metal", -roofInsetX, roofInsetY, roofZ + 0.1);
    addMesh("vent-b", "roof-unit", "metal", roofInsetX, Math.max(-roofInsetY, 0), roofZ + 0.1);
    return;
  }

  if (isOffice) {
    const rows = Math.min(floors, 13);
    const windowGeometry = spec.sx < 4.5 ? "window-narrow" : "window-wide";
    addWindowRows(addMesh, rows, facadeOffsets(spec.sx, spec.sx < 4.5 ? 2 : 3, 0.9), frontY, baseZ + 2.2, windowGeometry, "window");
    addWindowRows(addMesh, Math.min(floors, 8), facadeOffsets(spec.sx, 2, 1.0), backY, baseZ + 3.0, windowGeometry, "glass");
    addMesh("entry", "entry-door", "glass", 0, frontY, baseZ + 0.05);
    addMesh("roof-ac-a", "roof-unit", "metal", -roofInsetX, roofInsetY, roofZ + 0.1);
    addMesh("roof-ac-b", "roof-unit", "metal", roofInsetX, -roofInsetY, roofZ + 0.1, Math.PI / 2);
    addMesh("solar", "solar-panel", "glass", 0, roofInsetY, roofZ + 0.2, Math.PI / 2);
    return;
  }

  if (isResidential) {
    const rows = Math.min(floors, 6);
    addWindowRows(addMesh, rows, facadeOffsets(spec.sx, spec.sx < 4 ? 1 : 2, 0.85), frontY, baseZ + 1.8, "window-narrow", "window");
    addWindowRows(addMesh, Math.min(floors, 4), facadeOffsets(spec.sx, spec.sx < 4 ? 1 : 2, 0.85), backY, baseZ + 2.2, "window-narrow", "window");
    for (let i = 0; i < rows; i += 2) {
      addMesh(`balcony-${i}`, spec.sx < 4 ? "balcony-rail-narrow" : "balcony-rail", "metal", 0, frontY - 0.16, baseZ + 2.3 + i * 3.2);
    }
    addMesh("entry", "entry-door", "roof", 0, frontY, baseZ + 0.05);
    addMesh("roof-garden", "roof-plant", "green", -roofInsetX, roofInsetY, roofZ + 0.05);
    return;
  }

  if (isBrutalist) {
    addWindowRows(addMesh, Math.min(floors, 5), facadeOffsets(spec.sx, 4, 1.2), frontY, baseZ + 3.0, "window-narrow", "window");
    addMesh("deep-entry", "entry-door", "window", -Math.min(3.2, roofInsetX), frontY, baseZ + 0.05);
    addMesh("plant-room-a", "roof-unit", "concrete", -roofInsetX, roofInsetY, roofZ + 0.1);
    addMesh("plant-room-b", "roof-unit", "concrete", roofInsetX, -roofInsetY, roofZ + 0.1);
  }
}

function addWindowRows(addMesh, rows, xOffsets, localY, startZ, geometryId, materialId) {
  const side = localY.toFixed(1).replace("-", "m").replace(".", "p");
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < xOffsets.length; col++) {
      addMesh(`window-${row}-${col}-${side}`, geometryId, materialId, xOffsets[col], localY, startZ + row * 3.2);
    }
  }
}

function addParapet(addMesh, geometryId, spec, z) {
  addMesh("parapet-front", `parapet-${geometryId}-front`, "roof", 0, -spec.sy / 2, z);
  addMesh("parapet-back", `parapet-${geometryId}-front`, "roof", 0, spec.sy / 2, z);
  addMesh("parapet-left", `parapet-${geometryId}-side`, "roof", -spec.sx / 2, 0, z);
  addMesh("parapet-right", `parapet-${geometryId}-side`, "roof", spec.sx / 2, 0, z);
}

function facadeOffsets(width, targetColumns, inset) {
  const usableWidth = Math.max(0.1, width - inset * 2);
  const columns = Math.max(1, Math.min(targetColumns, Math.floor(usableWidth / 1.25)));
  if (columns === 1) {
    return [0];
  }
  const step = usableWidth / (columns - 1);
  const start = -usableWidth / 2;
  return Array.from({length: columns}, (_, i) => start + i * step);
}

function createSimpleMesh(sceneModel, id, geometryId, materialId, x, y, z, yaw = 0) {
  const transformId = `${id}-xform`;
  const meshId = `${id}-mesh`;
  must(sceneModel.createTransform({id: transformId, matrix: transform(x, y, z, yaw)}));
  must(sceneModel.createMesh({id: meshId, geometryId, materialId, parentTransformId: transformId}));
  return meshId;
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

function createCylinderGeometry(sceneModel, id, radius, height, segments) {
  const positions = [];
  const indices = [];
  positions.push(0, 0, 0);
  positions.push(0, 0, height);
  for (let i = 0; i < segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    positions.push(x, y, 0);
    positions.push(x, y, height);
  }
  for (let i = 0; i < segments; i++) {
    const next = (i + 1) % segments;
    const b0 = 2 + i * 2;
    const t0 = b0 + 1;
    const b1 = 2 + next * 2;
    const t1 = b1 + 1;
    indices.push(0, b1, b0);
    indices.push(1, t0, t1);
    indices.push(b0, b1, t1, b0, t1, t0);
  }
  must(sceneModel.createGeometry({
    id,
    primitive: TrianglesPrimitive,
    positions,
    indices
  }));
}

function createSphereGeometry(sceneModel, id, radius, segments, rings) {
  const positions = [];
  const indices = [];
  for (let ring = 0; ring <= rings; ring++) {
    const v = ring / rings;
    const phi = v * Math.PI;
    const z = Math.cos(phi) * radius + radius;
    const ringRadius = Math.sin(phi) * radius;
    for (let segment = 0; segment <= segments; segment++) {
      const u = segment / segments;
      const theta = u * Math.PI * 2;
      positions.push(
        Math.cos(theta) * ringRadius,
        Math.sin(theta) * ringRadius,
        z
      );
    }
  }
  const stride = segments + 1;
  for (let ring = 0; ring < rings; ring++) {
    for (let segment = 0; segment < segments; segment++) {
      const a = ring * stride + segment;
      const b = a + 1;
      const c = a + stride;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }
  must(sceneModel.createGeometry({
    id,
    primitive: TrianglesPrimitive,
    positions,
    indices
  }));
}

function addStreetTrees(addSimple, originX, originY, count) {
  for (let i = 0; i < count; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const along = -7 + Math.floor(i / 2) * 3.5;
    addSimple(`tree-${String(i).padStart(2, "0")}`, "sphere-tree", "green", originX + along, originY + side * 6.8, 0);
  }
}

function terrainHeight(gx, gz) {
  const nx = (gx - (GRID_SIZE - 1) / 2) / GRID_SIZE;
  const nz = (gz - (GRID_SIZE - 1) / 2) / GRID_SIZE;
  const ridge = Math.max(0, gz - 3) * 0.95;
  const westHill = Math.exp(-((nx + 0.22) * (nx + 0.22) + (nz - 0.08) * (nz - 0.08)) * 18) * 18;
  const eastHill = Math.exp(-((nx - 0.28) * (nx - 0.28) + (nz + 0.12) * (nz + 0.12)) * 20) * 12;
  const valley = Math.exp(-(nx * nx + (nz + 0.18) * (nz + 0.18)) * 30) * 8;
  return Math.max(0, ridge + westHill + eastHill - valley);
}

function classifyBlock(gx, gz) {
  const c = (GRID_SIZE - 1) / 2;
  const dx = gx - c;
  const dz = gz - c;
  const distance = Math.sqrt(dx * dx + dz * dz);
  const center = Math.floor(GRID_SIZE / 2);
  const parkA = [Math.floor(GRID_SIZE * 0.70), Math.floor(GRID_SIZE * 0.30)];
  const parkB = [Math.floor(GRID_SIZE * 0.25), Math.floor(GRID_SIZE * 0.75)];
  const shoppingBandX = Math.max(6, Math.floor(GRID_SIZE * 0.30));
  const shoppingBandZ = Math.max(5, Math.floor(GRID_SIZE * 0.26));
  const shoppingRow = Math.floor(GRID_SIZE * 0.30);
  const industrialColumns = Math.max(3, Math.floor(GRID_SIZE * 0.15));

  if (gz <= Math.max(1, Math.floor(GRID_SIZE * 0.08))) {
    return "waterfront";
  }
  if ((gx === center && gz === center) || (gx === center - 1 && gz === center) || (gx === center && gz === center - 1)) {
    return "civic";
  }
  if ((gx + gz) % 13 === 0 || (gx === parkA[0] && gz === parkA[1]) || (gx === parkB[0] && gz === parkB[1])) {
    return "park";
  }
  if (distance < GRID_SIZE * 0.24) {
    return "downtown";
  }
  if ((Math.abs(dx) <= shoppingBandX && Math.abs(dz) <= shoppingBandZ && (gx + gz) % 3 === 0) || gz === shoppingRow) {
    return "shopping";
  }
  if (gz >= Math.floor(GRID_SIZE * 0.60) && gx >= Math.floor(GRID_SIZE * 0.20) && gx <= Math.floor(GRID_SIZE * 0.80) && (gx + gz) % 2 === 0) {
    return "brutalist";
  }
  if (gz >= Math.floor(GRID_SIZE * 0.50) && gx <= Math.floor(GRID_SIZE * 0.25)) {
    return "eco";
  }
  if (gx >= GRID_SIZE - industrialColumns && gz >= 3 && gz <= GRID_SIZE - 3) {
    return "industrial";
  }
  return "residential";
}

function blockId(gx, gz) {
  return `block-${String(gx).padStart(2, "0")}-${String(gz).padStart(2, "0")}`;
}

function distancePriority(gx, gz) {
  const c = (GRID_SIZE - 1) / 2;
  const dx = gx - c;
  const dz = gz - c;
  return Math.round(Math.sqrt(dx * dx + dz * dz) * 10);
}

function offsetPoint(x, y, localX, localY, yaw = 0) {
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  return {
    x: x + localX * c - localY * s,
    y: y + localX * s + localY * c
  };
}

function transform(x, y, z, yaw = 0) {
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  return [
    c, s, 0, 0,
   -s, c, 0, 0,
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
