// Generates an XGF Stream dataset from several building-format examples.
//
// Demonstrates using the SDK to compose glTF and USDZ assets into one streamed
// city group: load each source model, place it around a small street/plaza
// layout, then export one grid-partitioned XGF Stream directory. USDZ loading
// is browser-only, so that source is cached as XGF via headless Chrome first.

const fs = require("fs");
const http = require("http");
const path = require("path");
const {pathToFileURL} = require("url");
const puppeteer = require("puppeteer");

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
const {XGFLoader} = sdkRequire("formats/xgf/XGFLoader");
const {XGFStreamExporter} = sdkRequire("formats/xgfstream/XGFStreamExporter");

const rootDir = path.resolve(__dirname, "..", "..", "..", "..", "..");
const modelsDir = path.join(rootDir, "packages/website/models");
const outDir = path.join(modelsDir, "GltfCityGroup/xgfstream");

const CITY_COORDINATE_SYSTEM = {
  basis: [1, 0, 0, 0, 0, 1, 0, 1, 0],
  origin: [0, 0, 0],
  units: "meters",
  scaleToMeters: 1
};

const SOURCE_COORDINATE_SYSTEM = {
  // Sketchfab glTF assets are Y-up. The target city stream is Z-up.
  basis: [1, 0, 0, 0, 1, 0, 0, 0, 1],
  origin: [0, 0, 0],
  units: "meters",
  scaleToMeters: 1
};

const CENTER_BUILDING_FOOTPRINT = 120;
const PEER_BUILDING_FOOTPRINT = CENTER_BUILDING_FOOTPRINT / 2;
const STREET_WIDTH = 8;
const CENTRAL_BLOCK_SETBACK = 14;
const OUTER_BLOCK_SETBACK = 12;
const INNER_STREET_CENTER = CENTER_BUILDING_FOOTPRINT / 2 + CENTRAL_BLOCK_SETBACK + STREET_WIDTH / 2;
const INNER_BUILDING_EDGE = INNER_STREET_CENTER + STREET_WIDTH / 2;
const OUTER_STREET_CENTER = INNER_BUILDING_EDGE + PEER_BUILDING_FOOTPRINT + OUTER_BLOCK_SETBACK + STREET_WIDTH / 2;
const GROUND_HALF_X = OUTER_STREET_CENTER + STREET_WIDTH / 2 + 10;
const GROUND_HALF_Y = OUTER_STREET_CENTER + STREET_WIDTH / 2 + 10;

const SOURCE_MODELS = [
  {
    id: "skyscraper_plaza",
    format: "gltf",
    model: "SkyscraperPlazaConcept",
    relPath: "SkyscraperPlazaConcept/gltf/model.glb",
    x: 0,
    y: 0,
    yaw: 0,
    sourceScale: 1.2,
    targetFootprint: CENTER_BUILDING_FOOTPRINT
  },
  {
    id: "residential_tower",
    format: "gltf",
    model: "ResidentialBuilding",
    relPath: "ResidentialBuilding/gltf/model.glb",
    maxX: -INNER_BUILDING_EDGE,
    y: 0,
    yaw: 0,
    sourceScale: 0.052,
    targetFootprint: PEER_BUILDING_FOOTPRINT
  },
  {
    id: "apartment_courtyard",
    format: "gltf",
    model: "ApartmentBuildings",
    relPath: "ApartmentBuildings/gltf/model.glb",
    x: 0,
    minY: INNER_BUILDING_EDGE,
    yaw: 0,
    sourceScale: 0.85,
    targetFootprint: PEER_BUILDING_FOOTPRINT
  },
  {
    id: "commercial_block",
    format: "gltf",
    model: "CommercialBuildingConcept",
    relPath: "CommercialBuildingConcept/gltf/model.glb",
    minX: INNER_BUILDING_EDGE,
    y: 0,
    yaw: 0,
    sourceScale: 0.95,
    targetFootprint: PEER_BUILDING_FOOTPRINT
  },
  {
    id: "mixed_use_retail",
    format: "usdz",
    model: "ResidentialCommercialRetailDevelopment",
    relPath: "ResidentialCommercialRetailDevelopment/usdz/model.usdz",
    cacheRelPath: "ResidentialCommercialRetailDevelopment/xgf/model.xgf",
    x: 0,
    maxY: -INNER_BUILDING_EDGE,
    yaw: 0,
    sourceScale: 0.1,
    targetFootprint: PEER_BUILDING_FOOTPRINT
  }
];

const REFERENCE_BUILDING_ID = "apartment_courtyard";
const APARTMENT_REFERENCE_PALETTE = {
  lightFacade: [0.80, 0.80, 0.80],
  warmFacade: [0.6281055212020874, 0.4835018217563629, 0.299740195274353],
  roof: [0.20880700647830963, 0.050665099173784256, 0.006232250016182661],
  darkTrim: [0.22653400897979736, 0.22653400897979736, 0.22653400897979736],
  concrete: [0.48540884256362915, 0.48540884256362915, 0.48540884256362915],
  glass: [0.3174790143966675, 0.6681780219078064, 0.8000069856643677],
  darkGlass: [0.038201771676540375, 0.08467695862054825, 0.10556041449308395],
  planting: [0.3173289895057678, 0.46267399191856384, 0.1517540067434311]
};

const CITY_BUILDING_PALETTE_VARIANTS = {
  skyscraper_plaza: {
    facade: [APARTMENT_REFERENCE_PALETTE.lightFacade, APARTMENT_REFERENCE_PALETTE.concrete],
    glass: [APARTMENT_REFERENCE_PALETTE.glass, APARTMENT_REFERENCE_PALETTE.darkGlass],
    trim: [APARTMENT_REFERENCE_PALETTE.darkTrim, APARTMENT_REFERENCE_PALETTE.concrete],
    accent: [APARTMENT_REFERENCE_PALETTE.warmFacade, APARTMENT_REFERENCE_PALETTE.roof],
    planting: [APARTMENT_REFERENCE_PALETTE.planting]
  },
  residential_tower: {
    facade: [APARTMENT_REFERENCE_PALETTE.warmFacade, APARTMENT_REFERENCE_PALETTE.lightFacade],
    glass: [APARTMENT_REFERENCE_PALETTE.glass],
    trim: [APARTMENT_REFERENCE_PALETTE.darkTrim],
    accent: [APARTMENT_REFERENCE_PALETTE.roof, APARTMENT_REFERENCE_PALETTE.warmFacade],
    planting: [APARTMENT_REFERENCE_PALETTE.planting]
  },
  commercial_block: {
    facade: [APARTMENT_REFERENCE_PALETTE.concrete, APARTMENT_REFERENCE_PALETTE.lightFacade],
    glass: [APARTMENT_REFERENCE_PALETTE.darkGlass, APARTMENT_REFERENCE_PALETTE.glass],
    trim: [APARTMENT_REFERENCE_PALETTE.darkTrim],
    accent: [APARTMENT_REFERENCE_PALETTE.warmFacade],
    planting: [APARTMENT_REFERENCE_PALETTE.planting]
  },
  mixed_use_retail: {
    facade: [APARTMENT_REFERENCE_PALETTE.warmFacade, APARTMENT_REFERENCE_PALETTE.lightFacade],
    glass: [APARTMENT_REFERENCE_PALETTE.glass, APARTMENT_REFERENCE_PALETTE.darkGlass],
    trim: [APARTMENT_REFERENCE_PALETTE.darkTrim, APARTMENT_REFERENCE_PALETTE.concrete],
    accent: [APARTMENT_REFERENCE_PALETTE.roof, APARTMENT_REFERENCE_PALETTE.warmFacade],
    planting: [APARTMENT_REFERENCE_PALETTE.planting]
  }
};

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
    id: "GltfCityGroup",
    coordinateSystem: CITY_COORDINATE_SYSTEM
  }));
  const dataModel = must(data.createModel({id: "GltfCityGroup"}));

  console.log("Building city context");
  addCityContext(sceneModel, dataModel);

  for (const spec of SOURCE_MODELS) {
    await loadPlacedSource(scene, data, sceneModel, dataModel, spec);
  }

  console.log(`Loaded ${sceneModel.stats.numObjects.toLocaleString()} composed objects`);
  console.log("Exporting XGF stream");
  const stream = await new XGFStreamExporter().write({
    sceneModel,
    dataModel
  }, {
    partition: "grid",
    chunkMetric: "meshes",
    chunkBudget: 220,
    minChunkBudget: 70,
    gridCellSize: 90,
    index: "index.json",
    runtimeIndex: "index.runtime.json",
    assetId: "gltf-city-assets",
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

function addCityContext(sceneModel, dataModel) {
  const verticalStreets = [-OUTER_STREET_CENTER, -INNER_STREET_CENTER, INNER_STREET_CENTER, OUTER_STREET_CENTER];
  const horizontalStreets = [-OUTER_STREET_CENTER, -INNER_STREET_CENTER, INNER_STREET_CENTER, OUTER_STREET_CENTER];

  addBoxObject(sceneModel, dataModel, {
    id: "city_ground",
    size: [GROUND_HALF_X * 2, GROUND_HALF_Y * 2, 0.4],
    position: [0, 0, -0.25],
    color: [0.48, 0.48, 0.45]
  });

  addStreetNetwork(sceneModel, dataModel, {
    verticalStreets,
    horizontalStreets,
    minX: -GROUND_HALF_X,
    maxX: GROUND_HALF_X,
    minY: -GROUND_HALF_Y,
    maxY: GROUND_HALF_Y,
    streetWidth: STREET_WIDTH
  });

  addBoxObject(sceneModel, dataModel, {
    id: "water_feature",
    size: [42, 5, 0.08],
    position: [INNER_BUILDING_EDGE + PEER_BUILDING_FOOTPRINT * 0.6, -INNER_BUILDING_EDGE - PEER_BUILDING_FOOTPRINT * 0.42, 0.18],
    color: [0.08, 0.58, 0.68]
  });
}

function addStreetNetwork(sceneModel, dataModel, {verticalStreets, horizontalStreets, minX, maxX, minY, maxY, streetWidth}) {
  const curbWidth = 0.9;
  const roadColor = [0.08, 0.09, 0.10];
  const curbColor = [0.70, 0.69, 0.64];
  const halfStreet = streetWidth / 2;
  const curbOffset = halfStreet + curbWidth / 2;
  const verticalCurbSegments = subtractStreetBands(minY, maxY, horizontalStreets, halfStreet);
  const horizontalCurbSegments = subtractStreetBands(minX, maxX, verticalStreets, halfStreet);

  for (let i = 0; i < verticalStreets.length; i++) {
    const x = verticalStreets[i];
    addBoxObject(sceneModel, dataModel, {
      id: `street_north_south_${i}`,
      size: [streetWidth, maxY - minY, 0.08],
      position: [x, (minY + maxY) / 2, 0.02],
      color: roadColor
    });
    for (let j = 0; j < verticalCurbSegments.length; j++) {
      const [segmentMinY, segmentMaxY] = verticalCurbSegments[j];
      for (const side of [-1, 1]) {
        addBoxObject(sceneModel, dataModel, {
          id: `kerb_ns_${i}_${j}_${side < 0 ? "w" : "e"}`,
          size: [curbWidth, segmentMaxY - segmentMinY, 0.22],
          position: [x + side * curbOffset, (segmentMinY + segmentMaxY) / 2, 0.11],
          color: curbColor
        });
      }
    }
  }

  for (let i = 0; i < horizontalStreets.length; i++) {
    const y = horizontalStreets[i];
    addBoxObject(sceneModel, dataModel, {
      id: `street_east_west_${i}`,
      size: [maxX - minX, streetWidth, 0.09],
      position: [(minX + maxX) / 2, y, 0.03],
      color: roadColor
    });
    for (let j = 0; j < horizontalCurbSegments.length; j++) {
      const [segmentMinX, segmentMaxX] = horizontalCurbSegments[j];
      for (const side of [-1, 1]) {
        addBoxObject(sceneModel, dataModel, {
          id: `kerb_ew_${i}_${j}_${side < 0 ? "s" : "n"}`,
          size: [segmentMaxX - segmentMinX, curbWidth, 0.22],
          position: [(segmentMinX + segmentMaxX) / 2, y + side * curbOffset, 0.11],
          color: curbColor
        });
      }
    }
  }
}

function subtractStreetBands(min, max, streetCenters, halfStreet) {
  const segments = [];
  let cursor = min;
  for (const center of streetCenters) {
    const bandMin = center - halfStreet;
    const bandMax = center + halfStreet;
    if (bandMin > cursor) {
      segments.push([cursor, bandMin]);
    }
    cursor = Math.max(cursor, bandMax);
  }
  if (cursor < max) {
    segments.push([cursor, max]);
  }
  return segments;
}

async function loadPlacedSource(scene, data, targetSceneModel, targetDataModel, spec) {
  if (spec.format === "usdz") {
    return loadPlacedUSDZ(scene, targetSceneModel, targetDataModel, spec);
  }
  return loadPlacedGLB(scene, data, targetSceneModel, targetDataModel, spec);
}

async function loadPlacedGLB(scene, data, targetSceneModel, targetDataModel, spec) {
  const sourcePath = path.join(modelsDir, spec.relPath);
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Missing ${spec.model} source GLB: ${sourcePath}`);
  }

  console.log(`Loading ${spec.relPath} as ${spec.id}`);
  const sourceSceneModel = must(scene.createModel({
    id: `${spec.id}Source`,
    coordinateSystem: {
      ...SOURCE_COORDINATE_SYSTEM,
      scaleToMeters: spec.sourceScale || 1
    }
  }));
  const sourceDataModel = must(data.createModel({id: `${spec.id}Source`}));
  const buffer = fs.readFileSync(sourcePath);

  await new GLTFLoader().load({
    fileData: bufferToArrayBuffer(buffer),
    sceneModel: sourceSceneModel,
    dataModel: sourceDataModel
  }, {
    baseUri: pathToFileURL(path.dirname(sourcePath) + path.sep).href,
    layerId: spec.id,
    yieldIntervalMs: 80
  });

  cloneModelIntoTarget(sourceSceneModel, targetSceneModel, targetDataModel, spec);
  sourceSceneModel.destroy();
  sourceDataModel.destroy();
}

async function loadPlacedUSDZ(scene, targetSceneModel, targetDataModel, spec) {
  const xgfPath = await ensureUSDZConvertedToXGF(spec);
  console.log(`Loading ${path.relative(modelsDir, xgfPath)} as ${spec.id}`);
  const sourceSceneModel = must(scene.createModel({
    id: `${spec.id}Source`,
    coordinateSystem: {
      ...SOURCE_COORDINATE_SYSTEM,
      scaleToMeters: spec.sourceScale || 1
    }
  }));
  const buffer = fs.readFileSync(xgfPath);

  await new XGFLoader().load({
    fileData: bufferToArrayBuffer(buffer),
    sceneModel: sourceSceneModel
  });

  cloneModelIntoTarget(sourceSceneModel, targetSceneModel, targetDataModel, spec);
  sourceSceneModel.destroy();
}

async function ensureUSDZConvertedToXGF(spec) {
  const sourcePath = path.join(modelsDir, spec.relPath);
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Missing ${spec.model} source USDZ: ${sourcePath}`);
  }
  const xgfPath = path.join(modelsDir, spec.cacheRelPath);
  if (isFreshFile(xgfPath, sourcePath)) {
    return xgfPath;
  }

  console.log(`Converting ${spec.relPath} to ${spec.cacheRelPath}`);
  fs.mkdirSync(path.dirname(xgfPath), {recursive: true});

  const websiteRoot = path.join(rootDir, "packages/website");
  const server = await startStaticServer(websiteRoot);
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      protocolTimeout: 180000,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--enable-unsafe-swiftshader"
      ]
    });
    const page = await browser.newPage();
    page.on("console", (message) => console.log(`[browser:${message.type()}] ${message.text()}`));
    await interceptTinyUSDZWasm(page);
    await page.goto(server.url, {waitUntil: "domcontentloaded", timeout: 30000});
    const base64 = await page.evaluate(async ({sourceUrl}) => {
      const xeokit = await import("/js/xeokit-studio-bundle.js");
      const scene = new xeokit.model.scene.Scene();
      const sceneModelResult = scene.createModel({
        id: "ResidentialCommercialRetailDevelopment",
        coordinateSystem: {
          basis: [1, 0, 0, 0, 1, 0, 0, 0, 1],
          origin: [0, 0, 0],
          units: "meters",
          scaleToMeters: 1
        }
      });
      if (!sceneModelResult.ok) {
        throw new Error(sceneModelResult.error);
      }
      const response = await fetch(sourceUrl);
      if (!response.ok) {
        throw new Error(`Could not fetch ${sourceUrl} (HTTP ${response.status})`);
      }
      const fileData = await response.arrayBuffer();
      await new xeokit.formats.usdz.USDZLoader().load({
        fileData,
        sceneModel: sceneModelResult.value
      });
      const xgf = await new xeokit.formats.xgf.XGFExporter().write({
        sceneModel: sceneModelResult.value
      });
      return arrayBufferToBase64(xgf);

      function arrayBufferToBase64(buffer) {
        const bytes = new Uint8Array(buffer);
        let binary = "";
        const chunkSize = 0x8000;
        for (let i = 0; i < bytes.length; i += chunkSize) {
          binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
        }
        return btoa(binary);
      }
    }, {
      sourceUrl: `/models/${spec.relPath}`
    });
    fs.writeFileSync(xgfPath, Buffer.from(base64, "base64"));
    return xgfPath;
  } finally {
    if (browser) {
      await browser.close();
    }
    await server.close();
  }
}

function cloneModelIntoTarget(sourceSceneModel, targetSceneModel, targetDataModel, spec) {
  const sourceMeshRecords = Object.values(sourceSceneModel.meshes).map((mesh) => {
    const matrix = applyYaw(Array.from(getMeshWorldMatrix(mesh, targetSceneModel.coordinateSystem)), spec.yaw || 0);
    const aabb = mesh.geometry && mesh.geometry.aabb ? transformAABB(mesh.geometry.aabb, matrix) : null;
    return {mesh, matrix, aabb};
  });
  const sourceAABB = unionRecordAABBs(sourceMeshRecords);
  const keptMeshRecords = sourceMeshRecords.filter((record) => !shouldSkipSourceSiteMesh(record, sourceAABB));
  const placementAABB = unionRecordAABBs(keptMeshRecords) || sourceAABB;
  const autoSizeScale = computeAutoSizeScale(placementAABB, spec);
  const scaleAnchor = placementAABB ? getAABBScaleAnchor(placementAABB) : [0, 0, 0];
  const scaledPlacementAABB = placementAABB ? scaleAABBAboutAnchor(placementAABB, scaleAnchor, autoSizeScale) : placementAABB;
  const placement = computePlacementOffset(scaledPlacementAABB, spec);
  const textureIdMap = new Map();
  const materialIdMap = new Map();
  const geometryIdMap = new Map();
  const meshIdMap = new Map();
  const usedMaterialIds = new Set();
  const usedGeometryIds = new Set();
  const usedTextureIds = new Set();
  const materialParamsById = new Map();

  if (placementAABB && spec.targetFootprint) {
    const scaledWidth = scaledPlacementAABB[3] - scaledPlacementAABB[0];
    const scaledDepth = scaledPlacementAABB[4] - scaledPlacementAABB[1];
    console.log(`  auto scale x${formatNumber(autoSizeScale)} -> ${formatNumber(scaledWidth)} x ${formatNumber(scaledDepth)}m footprint`);
  }

  for (const {mesh} of keptMeshRecords) {
    if (mesh.geometry) {
      usedGeometryIds.add(mesh.geometry.id);
    }
    if (mesh.material) {
      usedMaterialIds.add(mesh.material.id);
    }
  }

  for (const material of Object.values(sourceSceneModel.materials)) {
    if (!usedMaterialIds.has(material.id)) {
      continue;
    }
    const params = must(material.toParams());
    materialParamsById.set(material.id, params);
    collectTextureIds(params, usedTextureIds);
  }

  for (const texture of Object.values(sourceSceneModel.textures)) {
    if (!usedTextureIds.has(texture.id)) {
      continue;
    }
    const params = must(texture.toParams());
    const id = `${spec.id}_${params.id}`;
    textureIdMap.set(params.id, id);
    params.id = id;
    must(targetSceneModel.createTexture(params));
  }

  for (const material of Object.values(sourceSceneModel.materials)) {
    const params = materialParamsById.get(material.id);
    if (!params) {
      continue;
    }
    const id = `${spec.id}_${params.id}`;
    materialIdMap.set(params.id, id);
    params.id = id;
    remapParam(params, "colorTextureId", textureIdMap);
    remapParam(params, "metallicRoughnessTextureId", textureIdMap);
    remapParam(params, "normalsTextureId", textureIdMap);
    remapParam(params, "occlusionTextureId", textureIdMap);
    remapParam(params, "emissiveTextureId", textureIdMap);
    recolorCityBuildingMaterial(spec, params);
    must(targetSceneModel.createMaterial(params));
  }

  for (const geometry of Object.values(sourceSceneModel.geometries)) {
    if (!usedGeometryIds.has(geometry.id)) {
      continue;
    }
    const params = must(geometry.toParams());
    const id = `${spec.id}_${params.id}`;
    geometryIdMap.set(params.id, id);
    params.id = id;
    must(targetSceneModel.createGeometryCompressed(params));
  }

  for (const {mesh, matrix} of keptMeshRecords) {
    const id = `${spec.id}_${mesh.id}`;
    meshIdMap.set(mesh.id, id);
    const placedMatrix = applyUniformScaleAboutAnchor(matrix, scaleAnchor, autoSizeScale);
    placedMatrix[12] += placement[0];
    placedMatrix[13] += placement[1];
    placedMatrix[14] += placement[2];
    const params = {
      id,
      geometryId: geometryIdMap.get(mesh.geometry.id),
      matrix: placedMatrix,
      color: recolorCityBuildingColor(spec, Array.from(mesh.color), `${spec.id}_${mesh.id}`),
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
      type: "BuildingElement"
    });
  }

  if (sourceMeshRecords.length !== keptMeshRecords.length) {
    console.log(`  skipped ${sourceMeshRecords.length - keptMeshRecords.length} flat site mesh(es)`);
  }
}

function computePlacementOffset(sourceAABB, spec) {
  if (!sourceAABB) {
    return [spec.x || 0, spec.y || 0, 0];
  }
  const centerX = (sourceAABB[0] + sourceAABB[3]) / 2;
  const centerY = (sourceAABB[1] + sourceAABB[4]) / 2;
  console.log(`  extents ${formatNumber(sourceAABB[3] - sourceAABB[0])} x ${formatNumber(sourceAABB[4] - sourceAABB[1])} x ${formatNumber(sourceAABB[5] - sourceAABB[2])}m`);
  const offsetX = spec.minX !== undefined
    ? spec.minX - sourceAABB[0]
    : spec.maxX !== undefined
      ? spec.maxX - sourceAABB[3]
      : (spec.x || 0) - centerX;
  const offsetY = spec.minY !== undefined
    ? spec.minY - sourceAABB[1]
    : spec.maxY !== undefined
      ? spec.maxY - sourceAABB[4]
      : (spec.y || 0) - centerY;
  return [
    offsetX,
    offsetY,
    0.24 - sourceAABB[2]
  ];
}

function computeAutoSizeScale(sourceAABB, spec) {
  if (!sourceAABB || !spec.targetFootprint) {
    return 1;
  }
  const width = sourceAABB[3] - sourceAABB[0];
  const depth = sourceAABB[4] - sourceAABB[1];
  const footprint = Math.max(width, depth);
  return footprint > 0 ? spec.targetFootprint / footprint : 1;
}

function getAABBScaleAnchor(aabb) {
  return [
    (aabb[0] + aabb[3]) / 2,
    (aabb[1] + aabb[4]) / 2,
    aabb[2]
  ];
}

function scaleAABBAboutAnchor(aabb, anchor, scale) {
  return [
    anchor[0] + (aabb[0] - anchor[0]) * scale,
    anchor[1] + (aabb[1] - anchor[1]) * scale,
    anchor[2] + (aabb[2] - anchor[2]) * scale,
    anchor[0] + (aabb[3] - anchor[0]) * scale,
    anchor[1] + (aabb[4] - anchor[1]) * scale,
    anchor[2] + (aabb[5] - anchor[2]) * scale
  ];
}

function applyUniformScaleAboutAnchor(matrix, anchor, scale) {
  if (scale === 1) {
    return Array.from(matrix);
  }
  const result = Array.from(matrix);
  for (let col = 0; col < 3; col++) {
    const i = col * 4;
    result[i] *= scale;
    result[i + 1] *= scale;
    result[i + 2] *= scale;
  }
  result[12] = anchor[0] + (matrix[12] - anchor[0]) * scale;
  result[13] = anchor[1] + (matrix[13] - anchor[1]) * scale;
  result[14] = anchor[2] + (matrix[14] - anchor[2]) * scale;
  return result;
}

function unionRecordAABBs(records) {
  let result;
  for (const {aabb} of records) {
    if (aabb) {
      result = unionAABB(result, aabb);
    }
  }
  return result;
}

function shouldSkipSourceSiteMesh(record, sourceAABB) {
  if (!record.aabb || !sourceAABB) {
    return false;
  }
  const width = record.aabb[3] - record.aabb[0];
  const depth = record.aabb[4] - record.aabb[1];
  const height = record.aabb[5] - record.aabb[2];
  const sourceWidth = sourceAABB[3] - sourceAABB[0];
  const sourceDepth = sourceAABB[4] - sourceAABB[1];
  const sourceHeight = sourceAABB[5] - sourceAABB[2];
  if (sourceWidth <= 0 || sourceDepth <= 0 || sourceHeight <= 0) {
    return false;
  }
  const flat = height <= Math.max(0.55, sourceHeight * 0.035);
  const nearBase = record.aabb[2] <= sourceAABB[2] + Math.max(0.8, sourceHeight * 0.04)
    && record.aabb[5] <= sourceAABB[2] + Math.max(2.6, sourceHeight * 0.08);
  const broad = width >= sourceWidth * 0.55 && depth >= sourceDepth * 0.55;
  const greenLowPodium = isGreenMaterial(record.mesh)
    && height <= Math.max(5, sourceHeight * 0.12)
    && record.aabb[5] <= sourceAABB[2] + Math.max(6, sourceHeight * 0.15);
  return broad && ((flat && nearBase) || greenLowPodium);
}

function isGreenMaterial(mesh) {
  const color = getMaterialColor(mesh);
  return !!color && color[1] > 0.35 && color[1] > color[0] * 1.25 && color[1] > color[2] * 1.2;
}

function getMaterialColor(mesh) {
  if (mesh.material && mesh.material.color) {
    return Array.from(mesh.material.color);
  }
  if (mesh.material && mesh.material.toParams) {
    const result = mesh.material.toParams();
    if (result && result.ok && result.value && result.value.color) {
      return result.value.color;
    }
  }
  if (mesh.color) {
    return Array.from(mesh.color);
  }
  return null;
}

function recolorCityBuildingMaterial(spec, params) {
  if (spec.id === REFERENCE_BUILDING_ID) {
    return;
  }
  const sourceColor = params.color || params.baseColor;
  if (!sourceColor) {
    return;
  }
  const role = classifyCityMaterial(sourceColor, params);
  const color = pickCityPaletteColor(spec.id, role, params.id);
  if (!color) {
    return;
  }
  params.color = color;
  if (params.baseColor) {
    params.baseColor = color;
  }
  if (role === "glass") {
    params.metallic = Math.min(params.metallic ?? 0.25, 0.25);
    params.roughness = Math.min(params.roughness ?? 0.35, 0.45);
  } else if (role === "planting") {
    params.metallic = 0;
    params.roughness = Math.max(params.roughness ?? 0.7, 0.65);
  } else {
    params.metallic = Math.min(params.metallic ?? 0, role === "trim" ? 0.35 : 0.08);
    params.roughness = Math.max(params.roughness ?? 0.62, role === "trim" ? 0.48 : 0.58);
  }
}

function recolorCityBuildingColor(spec, color, seedText) {
  if (spec.id === REFERENCE_BUILDING_ID || !color) {
    return color;
  }
  const role = classifyCityMaterial(color, {});
  return pickCityPaletteColor(spec.id, role, seedText) || color;
}

function classifyCityMaterial(color, params) {
  const [r, g, b] = color;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const saturation = max > 0 ? (max - min) / max : 0;
  const brightness = (r + g + b) / 3;
  const metallic = params.metallic ?? 0;
  const roughness = params.roughness ?? 0.6;

  if (g > r * 1.18 && g > b * 1.12) {
    return "planting";
  }
  if ((b > r * 1.12 && g > r * 1.05) || (metallic > 0.65 && roughness < 0.35 && brightness < 0.55)) {
    return brightness < 0.16 ? "trim" : "glass";
  }
  if (r > g * 1.45 && r > b * 1.8 && brightness < 0.45) {
    return "accent";
  }
  if (brightness < 0.16) {
    return "trim";
  }
  if (saturation < 0.12 && brightness < 0.46) {
    return "trim";
  }
  if (saturation < 0.16) {
    return "facade";
  }
  if (r >= g && g >= b) {
    return "facade";
  }
  return "accent";
}

function pickCityPaletteColor(specId, role, seedText) {
  const palette = CITY_BUILDING_PALETTE_VARIANTS[specId];
  if (!palette) {
    return null;
  }
  const choices = palette[role] || palette.facade;
  if (!choices || choices.length === 0) {
    return null;
  }
  const seed = hashString(seedText || `${specId}:${role}`);
  return varyColor(choices[seed % choices.length], seed);
}

function varyColor(color, seed) {
  const factor = 0.9 + ((seed >>> 8) % 19) / 100;
  return color.map((component) => clamp(component * factor, 0.015, 0.92));
}

function hashString(value) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
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
  targetDataObject(dataModel, id, "CitySiteElement");
}

function targetDataObject(dataModel, id, type) {
  dataModel.createObject({id, name: id, type});
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

function collectTextureIds(params, textureIds) {
  for (const key of [
    "colorTextureId",
    "metallicRoughnessTextureId",
    "normalsTextureId",
    "occlusionTextureId",
    "emissiveTextureId"
  ]) {
    if (params[key]) {
      textureIds.add(params[key]);
    }
  }
}

function bufferToArrayBuffer(buffer) {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}

function formatNumber(value) {
  return value.toLocaleString(undefined, {maximumFractionDigits: 1});
}

function isFreshFile(targetPath, sourcePath) {
  if (!fs.existsSync(targetPath)) {
    return false;
  }
  return fs.statSync(targetPath).mtimeMs >= fs.statSync(sourcePath).mtimeMs;
}

function startStaticServer(root) {
  const server = http.createServer((request, response) => {
    const requestUrl = new URL(request.url || "/", "http://127.0.0.1");
    const pathname = decodeURIComponent(requestUrl.pathname === "/" ? "/index.html" : requestUrl.pathname);
    const filePath = path.resolve(root, `.${pathname}`);
    if (!filePath.startsWith(root + path.sep)) {
      response.writeHead(403);
      response.end("Forbidden");
      return;
    }
    fs.stat(filePath, (statError, stat) => {
      if (statError || !stat.isFile()) {
        response.writeHead(404);
        response.end("Not found");
        return;
      }
      response.writeHead(200, {"content-type": contentType(filePath)});
      fs.createReadStream(filePath).pipe(response);
    });
  });
  return new Promise((resolve, reject) => {
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      resolve({
        url: `http://127.0.0.1:${address.port}/`,
        close: () => new Promise((closeResolve, closeReject) => {
          server.close((error) => error ? closeReject(error) : closeResolve());
        })
      });
    });
  });
}

async function interceptTinyUSDZWasm(page) {
  const wasmPath = path.join(rootDir, "node_modules/.pnpm/tinyusdz@0.9.1/node_modules/tinyusdz/tinyusdz.wasm");
  if (!fs.existsSync(wasmPath)) {
    return;
  }
  const wasmBytes = fs.readFileSync(wasmPath);
  await page.setRequestInterception(true);
  page.on("request", (request) => {
    if (request.url() === "https://cdn.jsdelivr.net/npm/tinyusdz@0.9.1/tinyusdz.wasm") {
      request.respond({
        status: 200,
        contentType: "application/wasm",
        headers: {
          "access-control-allow-origin": "*"
        },
        body: wasmBytes
      });
      return;
    }
    request.continue();
  });
}

function contentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case ".html":
      return "text/html; charset=utf-8";
    case ".js":
      return "text/javascript; charset=utf-8";
    case ".json":
      return "application/json; charset=utf-8";
    case ".wasm":
      return "application/wasm";
    case ".glb":
    case ".xgf":
    case ".usdz":
      return "application/octet-stream";
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    default:
      return "application/octet-stream";
  }
}

function must(result) {
  if (!result || result.ok === false) {
    throw new Error(result?.error || "Operation failed");
  }
  return result.value;
}
