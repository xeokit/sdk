#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const {
  Data,
  Scene,
  Z_UP_COORDINATE_SYSTEM,
  addBoxObject,
  collectSceneModelStats,
  must,
  parseArgs,
  relativeToRoot,
  rootDir,
  round,
  writeXGF,
  writeXGFStream
} = require("./lib/common");

const defaultProfile = path.join(__dirname, "building-style.json");
const defaultOutDir = path.join(rootDir, "packages/website/models/ProceduralBuildings");
const SURFACE_EPSILON = 0.003;
const WINDOW_PANE_THICKNESS = 0.018;
const WINDOW_RECESS_THICKNESS = 0.04;

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function main() {
  const args = parseArgs(process.argv);
  const profilePath = resolveRootPath(args.profile || defaultProfile);
  const outDir = resolveRootPath(args.out || defaultOutDir);
  const profile = JSON.parse(fs.readFileSync(profilePath, "utf8"));
  const count = positiveInteger(args.count, profile.aggregate?.generationDefaults?.buildingCount || 10);
  const seed = positiveInteger(args.seed, profile.aggregate?.generationDefaults?.randomSeed || 42);
  const rng = mulberry32(seed);

  const scene = new Scene({coordinateSystem: Z_UP_COORDINATE_SYSTEM});
  const data = new Data();
  const sceneModel = must(scene.createModel({
    id: "ProceduralBuildings",
    coordinateSystem: Z_UP_COORDINATE_SYSTEM
  }));
  const dataModel = must(data.createModel({id: "ProceduralBuildings"}));
  const geometryCache = new Map();
  const materials = createMaterials(sceneModel, profile.aggregate.palette);
  const layout = createLayout(count, profile.aggregate.generationDefaults?.spacing || 70);
  createSiteContext(sceneModel, dataModel, geometryCache, materials, layout, profile.aggregate.generationDefaults?.spacing || 70);

  for (let i = 0; i < count; i++) {
    const spec = deriveBuildingSpec(profile, i, rng);
    spec.x = layout[i].x;
    spec.y = layout[i].y;
    spec.yaw = layout[i].yaw;
    createProceduralBuilding(sceneModel, dataModel, geometryCache, materials, spec, rng);
  }

  const xgfPath = path.join(outDir, "xgf/model.xgf");
  const streamDir = path.join(outDir, "xgfstream");
  const metadataPath = path.join(outDir, "procedural-buildings.json");

  await writeXGF(sceneModel, xgfPath);
  const stream = await writeXGFStream(sceneModel, streamDir, {
    assetId: "procedural-buildings-assets",
    chunkBudget: 1200,
    minChunkBudget: 300,
    gridCellSize: 80
  });

  const stats = collectSceneModelStats(sceneModel);
  fs.writeFileSync(metadataPath, `${JSON.stringify({
    schema: "xeokit-procedural-buildings/1.0",
    generatedAt: new Date().toISOString(),
    profile: relativeToRoot(profilePath),
    seed,
    buildingCount: count,
    xgf: relativeToRoot(xgfPath),
    xgfstream: relativeToRoot(streamDir),
    streamFiles: Object.keys(stream.files).length,
    stats
  }, null, 2)}\n`, "utf8");

  console.log(`Generated ${count} procedural buildings`);
  console.log(`Wrote ${relativeToRoot(xgfPath)}`);
  console.log(`Wrote ${relativeToRoot(streamDir)} (${Object.keys(stream.files).length} files)`);
  console.log(`Wrote ${relativeToRoot(metadataPath)}`);
}

function createMaterials(sceneModel, palette) {
  const safePalette = palette || {};
  const wallColor = safePalette.wall || [0.7, 0.72, 0.68];
  const glassColor = safePalette.glass || [0.32, 0.58, 0.72];
  const trimColor = safePalette.trim || [0.24, 0.27, 0.28];
  const accentColor = safePalette.accent || [0.64, 0.34, 0.24];
  const materials = {
    wall: "mat_wall",
    wallLight: "mat_wall_light",
    wallWarm: "mat_wall_warm",
    wallDark: "mat_wall_dark",
    wallSand: "mat_wall_sand",
    wallBrick: "mat_wall_brick",
    wallCool: "mat_wall_cool",
    glass: "mat_glass",
    glassDark: "mat_glass_dark",
    trim: "mat_trim",
    roof: "mat_roof",
    accent: "mat_accent",
    windowPocket: "mat_window_pocket",
    metal: "mat_metal",
    greenRoof: "mat_green_roof",
    concrete: "mat_concrete",
    paving: "mat_paving",
    asphalt: "mat_asphalt",
    landscape: "mat_landscape"
  };
  must(sceneModel.createMaterial({
    id: materials.wall,
    color: wallColor,
    roughness: 0.82,
    metallic: 0
  }));
  must(sceneModel.createMaterial({
    id: materials.wallLight,
    color: lighten(wallColor, 0.18),
    roughness: 0.84,
    metallic: 0
  }));
  must(sceneModel.createMaterial({
    id: materials.wallWarm,
    color: mixColors(wallColor, accentColor, 0.18),
    roughness: 0.82,
    metallic: 0
  }));
  must(sceneModel.createMaterial({
    id: materials.wallDark,
    color: darken(wallColor, 0.22),
    roughness: 0.82,
    metallic: 0
  }));
  must(sceneModel.createMaterial({
    id: materials.wallSand,
    color: mixColors([0.72, 0.69, 0.62], wallColor, 0.18),
    roughness: 0.86,
    metallic: 0
  }));
  must(sceneModel.createMaterial({
    id: materials.wallBrick,
    color: mixColors([0.55, 0.46, 0.40], accentColor, 0.12),
    roughness: 0.88,
    metallic: 0
  }));
  must(sceneModel.createMaterial({
    id: materials.wallCool,
    color: mixColors([0.50, 0.57, 0.56], wallColor, 0.28),
    roughness: 0.84,
    metallic: 0
  }));
  must(sceneModel.createMaterial({
    id: materials.glass,
    color: glassColor,
    opacity: 0.62,
    roughness: 0.18,
    metallic: 0,
    alphaMode: "BLEND"
  }));
  must(sceneModel.createMaterial({
    id: materials.glassDark,
    color: darken(glassColor, 0.22),
    opacity: 0.68,
    roughness: 0.16,
    metallic: 0,
    alphaMode: "BLEND"
  }));
  must(sceneModel.createMaterial({
    id: materials.trim,
    color: trimColor,
    roughness: 0.65
  }));
  must(sceneModel.createMaterial({
    id: materials.roof,
    color: safePalette.roof || [0.16, 0.18, 0.18],
    roughness: 0.72
  }));
  must(sceneModel.createMaterial({
    id: materials.accent,
    color: accentColor,
    roughness: 0.75
  }));
  must(sceneModel.createMaterial({
    id: materials.windowPocket,
    color: darken(trimColor, 0.46),
    roughness: 0.58
  }));
  must(sceneModel.createMaterial({
    id: materials.metal,
    color: mixColors(trimColor, [0.55, 0.57, 0.56], 0.34),
    roughness: 0.42,
    metallic: 0.25
  }));
  must(sceneModel.createMaterial({
    id: materials.greenRoof,
    color: [0.24, 0.38, 0.25],
    roughness: 0.95
  }));
  must(sceneModel.createMaterial({
    id: materials.concrete,
    color: [0.54, 0.56, 0.54],
    roughness: 0.9
  }));
  must(sceneModel.createMaterial({
    id: materials.paving,
    color: [0.55, 0.58, 0.57],
    roughness: 0.92
  }));
  must(sceneModel.createMaterial({
    id: materials.asphalt,
    color: [0.11, 0.12, 0.12],
    roughness: 0.88
  }));
  must(sceneModel.createMaterial({
    id: materials.landscape,
    color: [0.28, 0.46, 0.30],
    roughness: 0.95
  }));
  return materials;
}

function createSiteContext(sceneModel, dataModel, geometryCache, materials, layout, spacing) {
  if (layout.length === 0) {
    return;
  }
  const xs = layout.map((item) => item.x);
  const ys = layout.map((item) => item.y);
  const minX = Math.min(...xs) - spacing * 0.9;
  const maxX = Math.max(...xs) + spacing * 0.9;
  const minY = Math.min(...ys) - spacing * 0.9;
  const maxY = Math.max(...ys) + spacing * 0.9;
  const width = maxX - minX;
  const depth = maxY - minY;
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;

  addSitePart(sceneModel, dataModel, geometryCache, "district_paving", [width, depth, 0.06], [centerX, centerY, -0.08], materials.paving, "SitePaving");
  const columns = uniqueSorted(xs);
  const rows = uniqueSorted(ys);
  for (let i = 0; i < columns.length; i++) {
    const x = columns[i] + spacing * 0.5;
    if (x < maxX - spacing * 0.25) {
      addSitePart(sceneModel, dataModel, geometryCache, `road_ns_${i}`, [9.5, depth + 12, 0.06], [x, centerY, -0.035], materials.asphalt, "Road");
    }
  }
  for (let i = 0; i < rows.length; i++) {
    const y = rows[i] + spacing * 0.5;
    if (y < maxY - spacing * 0.25) {
      addSitePart(sceneModel, dataModel, geometryCache, `road_ew_${i}`, [width + 12, 9.5, 0.06], [centerX, y, -0.03], materials.asphalt, "Road");
    }
  }
  for (let i = 0; i < layout.length; i++) {
    const lot = layout[i];
    addSitePart(sceneModel, dataModel, geometryCache, `building_pad_${i}`, [spacing * 0.72, spacing * 0.66, 0.06], [lot.x, lot.y, -0.035], materials.concrete, "BuildingPad");
    if (i % 3 === 1) {
      addSitePart(sceneModel, dataModel, geometryCache, `pocket_green_${i}`, [spacing * 0.24, spacing * 0.18, 0.08], [lot.x - spacing * 0.28, lot.y + spacing * 0.25, -0.015], materials.landscape, "Landscape");
    }
  }
}

function addSitePart(sceneModel, dataModel, geometryCache, id, size, position, materialId, type) {
  addBoxObject(sceneModel, dataModel, geometryCache, {
    id: `site_${id}`,
    size,
    position,
    materialId,
    layerId: "site",
    type
  });
}

function deriveBuildingSpec(profile, index, rng) {
  const aggregate = profile.aggregate;
  const width = sampleDistribution(aggregate.dimensions.width, rng, 10, 70);
  const depth = sampleDistribution(aggregate.dimensions.depth, rng, 10, 60);
  const floorHeight = aggregate.facade.floorHeight || 3.4;
  const learnedStoreys = sampleDistribution(aggregate.storeys, rng, 3, 16);
  const tower = rng() < (aggregate.massing.towerProbability || 0.35);
  const podium = rng() < (aggregate.massing.podiumProbability || 0.35);
  const storeys = Math.max(2, Math.round(learnedStoreys * (tower ? randomRange(rng, 1.1, 1.65) : randomRange(rng, 0.65, 1.2))));
  const typologies = ["slab", "corner", "stepped", "podium", "terraced", "laneway"];
  const facadeStyles = ["punched", "ribbon", "mixed", "grid", "residential"];
  const learnedWindowRatio = aggregate.facade.windowToWallRatio || 0.32;
  return {
    id: `procedural_building_${String(index + 1).padStart(3, "0")}`,
    width: round(width * randomRange(rng, 0.82, 1.18), 3),
    depth: round(depth * randomRange(rng, 0.82, 1.18), 3),
    storeys,
    floorHeight,
    bayWidth: aggregate.facade.bayWidth || 4.2,
    recessDepth: aggregate.facade.recessDepth || 0.2,
    mullionWidth: aggregate.facade.mullionWidth || 0.18,
    windowRatio: clamp(learnedWindowRatio * randomRange(rng, 1.1, 1.7), 0.28, 0.52),
    setbackRatio: aggregate.massing.setbackRatio || 0.12,
    roofPlant: rng() < Math.max(aggregate.massing.roofPlantProbability || 0.5, 0.62),
    podium,
    typology: typologies[index % typologies.length],
    facadeStyle: facadeStyles[Math.floor(rng() * facadeStyles.length)],
    wallMaterialKey: ["wall", "wallSand", "wallCool", "wallWarm", "wallBrick", "wallLight", "wallDark"][index % 7],
    secondaryWallMaterialKey: ["wallLight", "wallWarm", "wallSand", "wallCool", "wall", "wallBrick", "wallDark"][(index + 2) % 7]
  };
}

function createProceduralBuilding(sceneModel, dataModel, geometryCache, materials, spec, rng) {
  const height = spec.storeys * spec.floorHeight;
  const podiumHeight = spec.podium ? Math.min(height * 0.32, spec.floorHeight * randomRange(rng, 2, 4)) : 0;
  const towerHeight = Math.max(spec.floorHeight, height - podiumHeight);
  const towerWidth = spec.podium ? spec.width * (1 - spec.setbackRatio * randomRange(rng, 0.7, 1.35)) : spec.width;
  const towerDepth = spec.podium ? spec.depth * (1 - spec.setbackRatio * randomRange(rng, 0.7, 1.35)) : spec.depth;
  const part = partAdder(sceneModel, dataModel, geometryCache, spec);
  const wallMaterial = materials[spec.wallMaterialKey] || materials.wall;
  const secondaryWallMaterial = materials[spec.secondaryWallMaterialKey] || materials.wallLight;

  if (spec.podium) {
    part("podium_mass", [spec.width, spec.depth, podiumHeight], [0, 0, podiumHeight / 2], secondaryWallMaterial, "BuildingPodium");
    addFacadeBands(part, spec.width, spec.depth, podiumHeight, spec.floorHeight, materials.trim, spec);
    addPodiumStorefronts(part, spec.width, spec.depth, podiumHeight, materials.glass, spec, rng);
  }

  part("tower_mass", [towerWidth, towerDepth, towerHeight], [0, 0, podiumHeight + towerHeight / 2], wallMaterial, "BuildingCore");
  addMassingVariation(part, towerWidth, towerDepth, podiumHeight, towerHeight, materials, spec, rng);
  addFacadeWindows(part, towerWidth, towerDepth, podiumHeight, towerHeight, materials, spec, rng);
  addGroundFloorEntrances(part, towerWidth, towerDepth, podiumHeight, materials, spec, rng);
  addRoof(part, towerWidth, towerDepth, height, materials, spec, rng);
}

function partAdder(sceneModel, dataModel, geometryCache, spec) {
  let nextPart = 0;
  return function addPart(name, size, localPosition, materialId, type, color, opacity) {
    const worldPosition = rotateXY(localPosition, spec.yaw);
    worldPosition[0] += spec.x;
    worldPosition[1] += spec.y;
    addBoxObject(sceneModel, dataModel, geometryCache, {
      id: `${spec.id}_${String(nextPart++).padStart(4, "0")}_${name}`,
      size,
      position: worldPosition,
      rotation: [0, 0, spec.yaw],
      materialId,
      color,
      opacity,
      layerId: spec.id,
      type
    });
  };
}

function addFacadeWindows(part, width, depth, baseZ, height, materials, spec, rng) {
  const floorCount = Math.max(1, Math.floor(height / spec.floorHeight));
  const longBays = Math.max(2, Math.floor(width / spec.bayWidth));
  const shortBays = Math.max(2, Math.floor(depth / spec.bayWidth));
  const ribbonFacade = spec.facadeStyle === "ribbon";
  const windowHeight = spec.floorHeight * clamp(spec.windowRatio * (ribbonFacade ? 1.45 : 1.18), 0.34, 0.68);
  const longWindowWidth = Math.max(1.1, width / longBays * (ribbonFacade ? 0.78 : 0.52));
  const shortWindowWidth = Math.max(1.1, depth / shortBays * (ribbonFacade ? 0.76 : 0.5));
  const glassMaterial = spec.facadeStyle === "mixed" ? materials.glassDark : materials.glass;

  for (let floor = 0; floor < floorCount; floor++) {
    const z = baseZ + floor * spec.floorHeight + spec.floorHeight * 0.56;
    const skipFloor = floor === 0 && rng() < 0.25;
    const accentFloor = floor > 0 && (floor + Math.floor(width)) % 4 === 0;
    for (let bay = 0; bay < longBays; bay++) {
      if (skipFloor || rng() < 0.03) {
        continue;
      }
      const x = -width / 2 + (bay + 0.5) * (width / longBays);
      addFacadeOpening(part, "n", `window_n_${floor}_${bay}`, width, depth, x, longWindowWidth, windowHeight, z, materials, {
        glassMaterial,
        mullions: ribbonFacade ? 1 : 0,
        sill: spec.facadeStyle === "residential" || bay % 3 === 0
      });
      if (rng() > 0.1) {
        addFacadeOpening(part, "s", `window_s_${floor}_${bay}`, width, depth, x, longWindowWidth, windowHeight, z, materials, {
          glassMaterial,
          mullions: ribbonFacade ? 1 : 0,
          sill: spec.facadeStyle === "residential" || bay % 3 === 0
        });
      }
      if (accentFloor && bay % 3 === 1) {
        const panelThickness = 0.06;
        part(`accent_spandrel_n_${floor}_${bay}`, [longWindowWidth * 0.92, panelThickness, 0.26], [x, depth / 2 + faceOffset(panelThickness), z - windowHeight * 0.58], materials.accent, "FacadePanel");
      }
    }
    for (let bay = 0; bay < shortBays; bay++) {
      if (skipFloor || rng() < 0.07) {
        continue;
      }
      const y = -depth / 2 + (bay + 0.5) * (depth / shortBays);
      addFacadeOpening(part, "e", `window_e_${floor}_${bay}`, width, depth, y, shortWindowWidth, windowHeight, z, materials, {
        glassMaterial,
        sill: spec.facadeStyle === "residential" && bay % 2 === 0
      });
      if (rng() > 0.05) {
        addFacadeOpening(part, "w", `window_w_${floor}_${bay}`, width, depth, y, shortWindowWidth, windowHeight, z, materials, {
          glassMaterial,
          sill: spec.facadeStyle === "residential" && bay % 2 === 0
        });
      }
    }
  }

  addFacadeBands(part, width, depth, height + baseZ, spec.floorHeight, materials.trim, spec, baseZ);
  addVerticalFacadeFins(part, width, depth, baseZ, height, materials.trim, spec);
  addBalconyLedges(part, width, depth, baseZ, height, materials.concrete, spec);
  addFacadeCladdingPanels(part, width, depth, baseZ, height, materials, spec);
}

function addFacadeOpening(part, face, id, width, depth, along, openingWidth, openingHeight, z, materials, options = {}) {
  const pocketPadX = options.pocketPadX ?? Math.min(0.22, Math.max(0.12, openingWidth * 0.06));
  const pocketPadZ = options.pocketPadZ ?? 0.14;
  const pocketWidth = openingWidth + pocketPadX * 2;
  const pocketHeight = openingHeight + pocketPadZ * 2;
  const pocketOffset = -WINDOW_RECESS_THICKNESS * 0.28;
  const paneOffset = WINDOW_PANE_THICKNESS * 0.16;
  const mullionOffset = WINDOW_PANE_THICKNESS * 0.38;
  const type = options.type || "Window";

  addFaceBox(part, `${id}_recess`, face, width, depth, along, pocketWidth, WINDOW_RECESS_THICKNESS, pocketHeight, pocketOffset, z, materials.windowPocket, `${type}Recess`);
  addFaceBox(part, `${id}_pane`, face, width, depth, along, openingWidth, WINDOW_PANE_THICKNESS, openingHeight, paneOffset, z, options.glassMaterial || materials.glass, type);

  if (openingWidth > 2.1 || options.mullions) {
    const mullionWidth = Math.min(0.11, Math.max(0.055, openingWidth * 0.035));
    addFaceBox(part, `${id}_mullion_v`, face, width, depth, along, mullionWidth, WINDOW_PANE_THICKNESS, openingHeight * 0.94, mullionOffset, z, materials.metal, "WindowMullion");
  }
  if (openingHeight > 1.1 && (options.mullions || type === "Storefront")) {
    addFaceBox(part, `${id}_mullion_h`, face, width, depth, along, openingWidth * 0.92, WINDOW_PANE_THICKNESS, Math.min(0.07, openingHeight * 0.06), mullionOffset, z + openingHeight * 0.16, materials.metal, "WindowMullion");
  }
  if (options.sill) {
    const sillDepth = 0.16;
    addFaceBox(part, `${id}_sill`, face, width, depth, along, pocketWidth * 1.05, sillDepth, 0.1, faceOffset(sillDepth), z - pocketHeight / 2 - 0.08, materials.concrete, "WindowSill");
  }
}

function addFaceBox(part, name, face, width, depth, along, alongSize, normalDepth, height, normalOffset, z, materialId, type) {
  if (face === "n") {
    part(name, [alongSize, normalDepth, height], [along, depth / 2 + normalOffset, z], materialId, type);
  } else if (face === "s") {
    part(name, [alongSize, normalDepth, height], [along, -depth / 2 - normalOffset, z], materialId, type);
  } else if (face === "e") {
    part(name, [normalDepth, alongSize, height], [width / 2 + normalOffset, along, z], materialId, type);
  } else if (face === "w") {
    part(name, [normalDepth, alongSize, height], [-width / 2 - normalOffset, along, z], materialId, type);
  }
}

function addFacadeBands(part, width, depth, height, floorHeight, trimMaterialId, spec, baseZ = 0) {
  const floors = Math.max(1, Math.floor((height - baseZ) / floorHeight));
  const bandHeight = Math.max(0.12, spec.mullionWidth * 0.65);
  const bandDepth = 0.08;
  const bandOffset = faceOffset(bandDepth);
  for (let floor = 1; floor <= floors; floor++) {
    if (floor % 2 !== 0 && floors > 5) {
      continue;
    }
    const z = baseZ + floor * floorHeight;
    part(`band_n_${floor}`, [width + 0.24, bandDepth, bandHeight], [0, depth / 2 + bandOffset, z], trimMaterialId, "FacadeBand");
    part(`band_s_${floor}`, [width + 0.24, bandDepth, bandHeight], [0, -depth / 2 - bandOffset, z], trimMaterialId, "FacadeBand");
    part(`band_e_${floor}`, [bandDepth, depth + 0.24, bandHeight], [width / 2 + bandOffset, 0, z], trimMaterialId, "FacadeBand");
    part(`band_w_${floor}`, [bandDepth, depth + 0.24, bandHeight], [-width / 2 - bandOffset, 0, z], trimMaterialId, "FacadeBand");
  }
}

function addPodiumStorefronts(part, width, depth, podiumHeight, glassMaterialId, spec, rng) {
  const z = Math.min(podiumHeight * 0.46, spec.floorHeight * 0.65);
  const height = Math.min(spec.floorHeight * 0.7, podiumHeight * 0.52);
  const count = Math.max(2, Math.floor(width / Math.max(4, spec.bayWidth * 1.25)));
  const canopyDepth = 1.1;
  for (let i = 0; i < count; i++) {
    const x = -width / 2 + (i + 0.5) * (width / count);
    addFacadeOpening(part, "n", `storefront_n_${i}`, width, depth, x, width / count * 0.72, height, z, materialsForStorefront(glassMaterialId, spec), {
      glassMaterial: glassMaterialId,
      type: "Storefront",
      pocketPadX: 0.22,
      pocketPadZ: 0.18,
      mullions: 1
    });
    part(`canopy_n_${i}`, [width / count * 0.84, canopyDepth, 0.16], [x, depth / 2 + faceOffset(canopyDepth), z + height / 2 + 0.22], spec.secondaryWallMaterialKey ? "mat_accent" : glassMaterialId, "Awning");
    if (rng() > 0.35) {
      addFacadeOpening(part, "s", `storefront_s_${i}`, width, depth, x, width / count * 0.72, height, z, materialsForStorefront(glassMaterialId, spec), {
        glassMaterial: glassMaterialId,
        type: "Storefront",
        pocketPadX: 0.22,
        pocketPadZ: 0.18,
        mullions: 1
      });
      part(`canopy_s_${i}`, [width / count * 0.84, canopyDepth, 0.16], [x, -depth / 2 - faceOffset(canopyDepth), z + height / 2 + 0.22], "mat_accent", "Awning");
    }
  }
}

function materialsForStorefront(glassMaterialId) {
  return {
    glass: glassMaterialId,
    windowPocket: "mat_window_pocket",
    metal: "mat_metal",
    concrete: "mat_concrete"
  };
}

function addGroundFloorEntrances(part, width, depth, baseZ, materials, spec, rng) {
  if (baseZ > 0.01 || width < 8 || depth < 8) {
    return;
  }
  const entryWidth = Math.min(Math.max(2.2, spec.bayWidth * 0.7), width * 0.34);
  const entryHeight = Math.min(spec.floorHeight * 0.78, 2.9);
  const z = entryHeight / 2 + 0.08;
  const x = randomRange(rng, -width * 0.18, width * 0.18);
  addFacadeOpening(part, "n", "main_entry", width, depth, x, entryWidth, entryHeight, z, materials, {
    glassMaterial: materials.glassDark,
    type: "Entrance",
    pocketPadX: 0.24,
    pocketPadZ: 0.18,
    mullions: 1
  });

  const awningDepth = 0.9;
  part("main_entry_awning", [entryWidth * 1.32, awningDepth, 0.16], [x, depth / 2 + faceOffset(awningDepth), z + entryHeight / 2 + 0.22], materials.accent, "Awning");
  if (rng() > 0.45) {
    part("main_entry_side_panel_l", [0.16, 0.12, entryHeight * 0.92], [x - entryWidth * 0.62, depth / 2 + faceOffset(0.12), z], materials.metal, "EntryFrame");
    part("main_entry_side_panel_r", [0.16, 0.12, entryHeight * 0.92], [x + entryWidth * 0.62, depth / 2 + faceOffset(0.12), z], materials.metal, "EntryFrame");
  }
}

function addMassingVariation(part, width, depth, baseZ, height, materials, spec, rng) {
  if (spec.typology === "corner") {
    const sideW = width * randomRange(rng, 0.32, 0.46);
    const sideD = depth * randomRange(rng, 0.45, 0.72);
    const sideH = height * randomRange(rng, 0.58, 0.92);
    part("corner_wing", [sideW, sideD, sideH], [
      width * randomRange(rng, 0.20, 0.32),
      -depth * randomRange(rng, 0.18, 0.28),
      baseZ + sideH / 2
    ], materials[spec.secondaryWallMaterialKey] || materials.wallLight, "BuildingWing");
  } else if (spec.typology === "stepped") {
    const topW = width * randomRange(rng, 0.58, 0.78);
    const topD = depth * randomRange(rng, 0.58, 0.78);
    const topH = height * randomRange(rng, 0.28, 0.42);
    part("upper_setback", [topW, topD, topH], [
      randomRange(rng, -width * 0.05, width * 0.08),
      randomRange(rng, -depth * 0.05, depth * 0.08),
      baseZ + height - topH / 2
    ], materials[spec.secondaryWallMaterialKey] || materials.wallLight, "UpperSetback");
  } else if (spec.typology === "slab" && width > 18 && depth > 14) {
    const slotW = Math.min(width * 0.18, 4.2);
    const recessDepth = 0.1;
    part("entry_recess_shadow", [slotW, recessDepth, Math.min(height * 0.2, spec.floorHeight * 1.8)], [
      -width * 0.22,
      depth / 2 + faceOffset(recessDepth),
      baseZ + Math.min(height * 0.1, spec.floorHeight * 0.9)
    ], materials.trim, "EntryRecess");
  } else if (spec.typology === "terraced") {
    const terraceCount = 2;
    for (let i = 0; i < terraceCount; i++) {
      const blockW = width * randomRange(rng, 0.42, 0.64);
      const blockD = depth * randomRange(rng, 0.42, 0.62);
      const blockH = height * randomRange(rng, 0.22, 0.38);
      part(`terrace_volume_${i}`, [blockW, blockD, blockH], [
        randomRange(rng, -width * 0.14, width * 0.14),
        randomRange(rng, -depth * 0.14, depth * 0.14),
        baseZ + height - blockH / 2 - i * spec.floorHeight * 0.55
      ], materials[spec.secondaryWallMaterialKey] || materials.wallLight, "TerracedVolume");
    }
  } else if (spec.typology === "laneway") {
    const coreW = Math.max(2.4, width * 0.12);
    const coreD = Math.max(3.2, depth * 0.22);
    part("side_service_core", [coreW, coreD, height * 0.96], [
      -width / 2 + coreW / 2,
      depth * randomRange(rng, -0.18, 0.18),
      baseZ + height * 0.48
    ], materials.wallDark, "ServiceCore");
  }
}

function addVerticalFacadeFins(part, width, depth, baseZ, height, trimMaterialId, spec) {
  const longBays = Math.max(2, Math.floor(width / spec.bayWidth));
  const shortBays = Math.max(2, Math.floor(depth / spec.bayWidth));
  const finDepth = 0.12;
  const finWidth = Math.max(0.12, spec.mullionWidth * 0.72);
  const finHeight = Math.max(spec.floorHeight * 1.5, height * 0.82);
  const finZ = baseZ + height / 2;
  const finOffset = faceOffset(finDepth);
  for (let bay = 1; bay < longBays; bay++) {
    if (bay % 2 !== 0 && spec.facadeStyle !== "ribbon") {
      continue;
    }
    const x = -width / 2 + bay * (width / longBays);
    part(`fin_n_${bay}`, [finWidth, finDepth, finHeight], [x, depth / 2 + finOffset, finZ], trimMaterialId, "FacadeFin");
    if (spec.typology !== "corner") {
      part(`fin_s_${bay}`, [finWidth, finDepth, finHeight], [x, -depth / 2 - finOffset, finZ], trimMaterialId, "FacadeFin");
    }
  }
  for (let bay = 1; bay < shortBays; bay++) {
    if (bay % 2 !== 0) {
      continue;
    }
    const y = -depth / 2 + bay * (depth / shortBays);
    part(`fin_e_${bay}`, [finDepth, finWidth, finHeight], [width / 2 + finOffset, y, finZ], trimMaterialId, "FacadeFin");
  }
}

function addBalconyLedges(part, width, depth, baseZ, height, concreteMaterialId, spec) {
  if (spec.facadeStyle === "ribbon" || width < 13 || height < spec.floorHeight * 4) {
    return;
  }
  const floors = Math.max(1, Math.floor(height / spec.floorHeight));
  const ledgeWidth = Math.min(width * 0.72, Math.max(6, spec.bayWidth * 3));
  const ledgeDepth = 0.9;
  const ledgeOffset = faceOffset(ledgeDepth);
  for (let floor = 2; floor < floors; floor += 3) {
    const z = baseZ + floor * spec.floorHeight + 0.14;
    part(`balcony_n_${floor}`, [ledgeWidth, ledgeDepth, 0.16], [0, depth / 2 + ledgeOffset, z], concreteMaterialId, "Balcony");
    part(`balcony_rail_n_${floor}`, [ledgeWidth, 0.08, 0.62], [0, depth / 2 + faceOffset(ledgeDepth + 0.08), z + 0.36], "mat_metal", "BalconyRail");
    if (floor % 2 === 0) {
      part(`balcony_w_${floor}`, [ledgeDepth, Math.min(depth * 0.46, spec.bayWidth * 3), 0.16], [-width / 2 - ledgeOffset, 0, z], concreteMaterialId, "Balcony");
      part(`balcony_rail_w_${floor}`, [0.08, Math.min(depth * 0.46, spec.bayWidth * 3), 0.62], [-width / 2 - faceOffset(ledgeDepth + 0.08), 0, z + 0.36], "mat_metal", "BalconyRail");
    }
  }
}

function addFacadeCladdingPanels(part, width, depth, baseZ, height, materials, spec) {
  if (height < spec.floorHeight * 3) {
    return;
  }
  const panelDepth = 0.045;
  const panelOffset = faceOffset(panelDepth);
  const z = baseZ + height * 0.52;
  const panelHeight = Math.max(spec.floorHeight * 1.2, height * 0.42);
  const panelWidth = Math.max(0.5, spec.bayWidth * 0.28);
  const count = Math.min(4, Math.max(2, Math.floor(width / (spec.bayWidth * 2.2))));
  for (let i = 0; i < count; i++) {
    const x = -width * 0.36 + i * (width * 0.72 / Math.max(1, count - 1));
    if ((i + spec.id.length) % 2 === 0) {
      part(`cladding_n_${i}`, [panelWidth, panelDepth, panelHeight], [x, depth / 2 + panelOffset, z], i % 3 === 0 ? materials.accent : materials.wallDark, "FacadeCladding");
    }
  }
  if (spec.facadeStyle === "grid" || spec.typology === "laneway") {
    const sidePanelHeight = Math.max(spec.floorHeight * 1.4, height * 0.5);
    part("side_cladding_e", [panelDepth, Math.max(0.6, spec.bayWidth * 0.34), sidePanelHeight], [width / 2 + panelOffset, 0, baseZ + height * 0.52], materials.wallDark, "FacadeCladding");
  }
}

function addRoof(part, width, depth, height, materials, spec, rng) {
  const parapetHeight = Math.max(0.45, spec.floorHeight * 0.16);
  const t = 0.35;
  part("roof_slab", [width + 0.5, depth + 0.5, 0.28], [0, 0, height + 0.14], materials.roof, "Roof");
  part("parapet_n", [width + 0.5, t, parapetHeight], [0, depth / 2 + t / 2, height + parapetHeight / 2], materials.trim, "Parapet");
  part("parapet_s", [width + 0.5, t, parapetHeight], [0, -depth / 2 - t / 2, height + parapetHeight / 2], materials.trim, "Parapet");
  part("parapet_e", [t, depth + 0.5, parapetHeight], [width / 2 + t / 2, 0, height + parapetHeight / 2], materials.trim, "Parapet");
  part("parapet_w", [t, depth + 0.5, parapetHeight], [-width / 2 - t / 2, 0, height + parapetHeight / 2], materials.trim, "Parapet");

  if (!spec.roofPlant) {
    return;
  }
  if (width > 16 && depth > 14) {
    part("green_roof_patch", [width * 0.34, depth * 0.28, 0.08], [
      randomRange(rng, -width * 0.18, width * 0.18),
      randomRange(rng, -depth * 0.18, depth * 0.18),
      height + 0.34
    ], materials.greenRoof, "GreenRoof");
    const solarCount = width > 24 ? 2 : 1;
    for (let i = 0; i < solarCount; i++) {
      part(`solar_panel_${i}`, [Math.min(5.4, width * 0.2), 1.05, 0.08], [
        randomRange(rng, -width * 0.28, width * 0.28),
        randomRange(rng, -depth * 0.28, depth * 0.28),
        height + 0.48
      ], materials.glassDark, "SolarPanel");
    }
  }
  const plantCount = 1 + Math.floor(rng() * 4);
  for (let i = 0; i < plantCount; i++) {
    const plantW = randomRange(rng, 1.8, Math.max(2.2, width * 0.18));
    const plantD = randomRange(rng, 1.6, Math.max(2.0, depth * 0.14));
    const plantH = randomRange(rng, 0.9, 2.8);
    part(`roof_plant_${i}`, [plantW, plantD, plantH], [
      randomRange(rng, -width * 0.32, width * 0.32),
      randomRange(rng, -depth * 0.32, depth * 0.32),
      height + 0.28 + plantH / 2
    ], i % 2 === 0 ? materials.concrete : materials.accent, "RoofPlant");
  }
}

function createLayout(count, spacing) {
  const cols = Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / cols);
  const layout = [];
  for (let i = 0; i < count; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    layout.push({
      x: (col - (cols - 1) / 2) * spacing,
      y: (row - (rows - 1) / 2) * spacing,
      yaw: ((i % 4) - 1.5) * 0.12
    });
  }
  return layout;
}

function uniqueSorted(values) {
  return Array.from(new Set(values.map((value) => round(value, 3)))).sort((a, b) => a - b);
}

function sampleDistribution(dist, rng, fallbackMin, fallbackMax) {
  if (!dist) {
    return randomRange(rng, fallbackMin, fallbackMax);
  }
  const min = positiveOr(dist.min, fallbackMin);
  const median = positiveOr(dist.median, (fallbackMin + fallbackMax) / 2);
  const p80 = positiveOr(dist.p80, median);
  const max = positiveOr(dist.max, fallbackMax);
  const t = rng();
  if (t < 0.5) {
    return lerp(min, median, t / 0.5);
  }
  if (t < 0.82) {
    return lerp(median, p80, (t - 0.5) / 0.32);
  }
  return lerp(p80, max, (t - 0.82) / 0.18);
}

function rotateXY(localPosition, yaw) {
  const c = Math.cos(yaw || 0);
  const s = Math.sin(yaw || 0);
  const x = localPosition[0];
  const y = localPosition[1];
  return [
    c * x - s * y,
    s * x + c * y,
    localPosition[2]
  ];
}

function faceOffset(thickness) {
  return thickness / 2 + SURFACE_EPSILON;
}

function mulberry32(seed) {
  let state = seed >>> 0;
  return function random() {
    state += 0x6D2B79F5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomRange(rng, min, max) {
  return min + (max - min) * rng();
}

function lighten(color, amount) {
  return color.map((value) => clamp(value + (1 - value) * amount, 0, 1));
}

function darken(color, amount) {
  return color.map((value) => clamp(value * (1 - amount), 0, 1));
}

function mixColors(a, b, t) {
  return [
    lerp(a[0], b[0], t),
    lerp(a[1], b[1], t),
    lerp(a[2], b[2], t)
  ].map((value) => clamp(value, 0, 1));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function positiveInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function positiveOr(value, fallback) {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function resolveRootPath(filePath) {
  return path.isAbsolute(filePath) ? filePath : path.resolve(rootDir, filePath);
}
