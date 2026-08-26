import type {Block, CityObject, CityUrbanContext, RandomStreams, Vec2} from "../types";
import {bbox, insetPolygon, polygonCentroid, rectPolygon, round, scalePolygon} from "../geometry/PolygonUtils";
import {extrudePolygon} from "../geometry/Extrusion";
import {MeshBuilder} from "../geometry/MeshBuilder";
import {createRoofMeshes} from "./RoofGenerator";

export function generateParksAndPlazas(blocks: Block[], streams: RandomStreams, urbanContext?: CityUrbanContext): CityObject[] {
  const objects: CityObject[] = [];
  for (const block of blocks.filter((candidate) => candidate.openSpace)) {
    objects.push(...createOpenSpace(block, streams, urbanContext));
  }
  return objects;
}

export function generateLandmarks(blocks: Block[], streams: RandomStreams, urbanContext?: CityUrbanContext): CityObject[] {
  const objects: CityObject[] = [];
  for (const block of blocks.filter((candidate) => candidate.landmark)) {
    if (block.landmark === "cathedral") {
      objects.push(createCathedral(block, streams, urbanContext));
    } else if (block.landmark === "city-hall") {
      objects.push(createCityHall(block, streams, urbanContext));
    } else if (block.landmark === "museum") {
      objects.push(createMuseum(block, streams, urbanContext));
    } else {
      objects.push(createObservationTower(block, streams, urbanContext));
    }
  }
  return objects;
}

function createOpenSpace(block: Block, streams: RandomStreams, urbanContext?: CityUrbanContext): CityObject[] {
  const id = block.openSpace === "central-park" ? "park-central" : `${block.openSpace}-${block.id}`;
  const meshes = [];
  const detailMeshes = [];
  const blockContext = urbanContext?.blockContexts[block.id];
  const green = block.openSpace?.includes("park");
  const groundMaterial = green ? "grass" : "paving-stone";
  const parkPoly = insetPolygon(block.polygon, green ? 5 : 2.2);
  meshes.push(extrudePolygon({polygon: parkPoly, height: 0.08, baseZ: -0.03, materialId: groundMaterial}));

  const [minX, minY, maxX, maxY] = bbox(parkPoly);
  const center = polygonCentroid(parkPoly);
  const pathBuilder = new MeshBuilder();
  const civicAxis = blockContext?.viewCorridorPressure ?? 0;
  const pathWobble = 1 + (blockContext?.imperfection ?? 0.2) * 0.42;
  pathBuilder.addRoadSegment([minX + 6, center[1]], [maxX - 6, center[1] + (streams.vegetation() - 0.5) * 10 * pathWobble], green ? 4.2 + civicAxis * 1.4 : 6.5 + civicAxis * 2, 0.04);
  pathBuilder.addRoadSegment([center[0], minY + 6], [center[0] + (streams.vegetation() - 0.5) * 12 * pathWobble, maxY - 6], green ? 3.2 + civicAxis : 5.2 + civicAxis * 1.6, 0.045);
  meshes.push(pathBuilder.toMesh("paving-stone", "paths"));

  const treeTrunks = new MeshBuilder();
  const treeCrowns = new MeshBuilder();
  const furniture = new MeshBuilder();
  const waterfrontReduction = blockContext?.waterfrontInfluence ? 1 - blockContext.waterfrontInfluence * 0.24 : 1;
  const civicReduction = blockContext?.grammar === "civic-campus" ? 0.72 : 1;
  const patternTreeMultiplier = blockContext?.treeDensityMultiplier ?? 1;
  const treeCount = Math.floor((green ? Math.max(8, block.area / 850) : Math.max(3, block.area / 1800)) * waterfrontReduction * civicReduction * patternTreeMultiplier);
  for (let i = 0; i < treeCount; i++) {
    const x = minX + 7 + streams.vegetation() * Math.max(1, maxX - minX - 14);
    const y = minY + 7 + streams.vegetation() * Math.max(1, maxY - minY - 14);
    addTree(treeTrunks, treeCrowns, [x, y], 3.6 + streams.vegetation() * 4.6);
  }

  if (!green || block.openSpace === "central-park") {
    furniture.addCylinder([center[0], center[1], 0.18], Math.min(5.5, Math.max(2.6, Math.sqrt(block.area) * 0.035)), 0.35, 20);
    furniture.addDisc([center[0], center[1], 0.42], Math.min(4.7, Math.max(2.1, Math.sqrt(block.area) * 0.028)), 20);
  }
  for (let i = 0; i < 6; i++) {
    const x = minX + (i + 1) * (maxX - minX) / 7;
    furniture.addBox([x, center[1] + 4.5, 0.45], [2.4, 0.5, 0.45], 0);
  }

  detailMeshes.push(treeTrunks.toMesh("tree-trunk", "park-tree-trunks"));
  detailMeshes.push(treeCrowns.toMesh("tree-canopy", "park-tree-canopies"));
  detailMeshes.push(furniture.toMesh(block.openSpace?.includes("plaza") ? "limestone" : "street-furniture", "park-furniture"));

  const base: CityObject = {
    id,
    name: titleCase(block.openSpace || "park"),
    type: block.openSpace?.includes("plaza") ? "Plaza" : "Park",
    layerId: "parks",
    meshes,
    metadata: {
      id,
      type: block.openSpace?.includes("plaza") ? "Plaza" : "Park",
      blockId: block.id,
      district: block.district,
      openSpaceType: block.openSpace,
      treeCount,
      lodRole: "regular",
      area: round(block.area, 1),
      ...(blockContext ? {
        grammar: blockContext.grammar,
        growthPhase: blockContext.growthPhase,
        landValue: blockContext.landValue,
        viewCorridorPressure: blockContext.viewCorridorPressure,
        waterfrontInfluence: blockContext.waterfrontInfluence,
        patterns: blockContext.patterns.map((pattern) => ({
          id: pattern.id,
          weight: pattern.weight
        }))
      } : {})
    }
  };
  return [
    base,
    {
      id: `${id}-details`,
      name: `${titleCase(block.openSpace || "park")} details`,
      type: "OpenSpaceDetail",
      layerId: "parks",
      meshes: detailMeshes,
      metadata: {
        id: `${id}-details`,
        type: "OpenSpaceDetail",
        parentId: id,
        blockId: block.id,
        treeCount,
        lodRole: "detail"
      }
    }
  ];
}

function createCathedral(block: Block, streams: RandomStreams, urbanContext?: CityUrbanContext): CityObject {
  const [minX, minY, maxX, maxY] = bbox(insetPolygon(block.polygon, 7));
  const center = polygonCentroid(block.polygon);
  const width = Math.min(42, (maxX - minX) * 0.62);
  const depth = Math.min(78, (maxY - minY) * 0.78);
  const meshes = [];
  const nave = rectPolygon(center[0], center[1], width, depth);
  meshes.push(extrudePolygon({polygon: nave, height: 24, materialId: "limestone"}));
  meshes.push(...createRoofMeshes({bounds: bbox(nave), topZ: 24, roofType: "gable", roofMaterialId: "roof-tile", trimMaterialId: "limestone", equipmentMaterialId: "steel", rng: streams.roofs}));
  for (const x of [center[0] - width * 0.34, center[0] + width * 0.34]) {
    const tower = rectPolygon(x, center[1] - depth * 0.38, width * 0.22, width * 0.22);
    meshes.push(extrudePolygon({polygon: tower, height: 42, materialId: "sandstone"}));
    meshes.push(...createRoofMeshes({bounds: bbox(tower), topZ: 42, roofType: "gable", roofMaterialId: "roof-tile", trimMaterialId: "limestone", equipmentMaterialId: "steel", rng: streams.roofs}));
  }
  return landmarkObject("landmark-cathedral", "Cathedral", block, meshes, {height: 48, silhouette: "twin towers and gabled nave"}, urbanContext);
}

function createCityHall(block: Block, streams: RandomStreams, urbanContext?: CityUrbanContext): CityObject {
  const [minX, minY, maxX, maxY] = bbox(insetPolygon(block.polygon, 8));
  const center = polygonCentroid(block.polygon);
  const width = Math.min(74, (maxX - minX) * 0.74);
  const depth = Math.min(52, (maxY - minY) * 0.68);
  const meshes = [];
  const main = rectPolygon(center[0], center[1], width, depth);
  meshes.push(extrudePolygon({polygon: main, height: 20, materialId: "sandstone"}));
  const tower = rectPolygon(center[0], center[1] - depth * 0.18, width * 0.22, depth * 0.22);
  meshes.push(extrudePolygon({polygon: tower, height: 48, materialId: "limestone"}));
  meshes.push(...createRoofMeshes({bounds: bbox(main), topZ: 20, roofType: "terrace", roofMaterialId: "flat-roof", trimMaterialId: "limestone", equipmentMaterialId: "steel", rng: streams.roofs}));
  meshes.push(...createRoofMeshes({bounds: bbox(tower), topZ: 48, roofType: "mansard", roofMaterialId: "roof-tile", trimMaterialId: "limestone", equipmentMaterialId: "steel", rng: streams.roofs}));
  return landmarkObject("landmark-city-hall", "City Hall", block, meshes, {height: 52, silhouette: "civic tower and terrace roof"}, urbanContext);
}

function createMuseum(block: Block, streams: RandomStreams, urbanContext?: CityUrbanContext): CityObject {
  const [minX, minY, maxX, maxY] = bbox(insetPolygon(block.polygon, 9));
  const center = polygonCentroid(block.polygon);
  const width = Math.min(82, (maxX - minX) * 0.78);
  const depth = Math.min(50, (maxY - minY) * 0.66);
  const main = rectPolygon(center[0], center[1], width, depth);
  const meshes = [extrudePolygon({polygon: main, height: 18, materialId: "concrete"})];
  const columns = new MeshBuilder();
  for (let i = 0; i < 8; i++) {
    const x = center[0] - width * 0.38 + i * width * 0.76 / 7;
    columns.addCylinder([x, center[1] - depth * 0.52, 5.8], 0.55, 11.6, 12);
  }
  meshes.push(columns.toMesh("limestone", "museum-columns"));
  meshes.push(...createRoofMeshes({bounds: bbox(main), topZ: 18, roofType: "flat", roofMaterialId: "flat-roof", trimMaterialId: "limestone", equipmentMaterialId: "steel", rng: streams.roofs}));
  return landmarkObject("landmark-museum", "Museum", block, meshes, {height: 21, silhouette: "low plinth with columned front"}, urbanContext);
}

function createObservationTower(block: Block, streams: RandomStreams, urbanContext?: CityUrbanContext): CityObject {
  const center = polygonCentroid(block.polygon);
  const meshes = [];
  const shaft = new MeshBuilder();
  shaft.addCylinder([center[0], center[1], 34], 4, 68, 18);
  shaft.addCylinder([center[0], center[1], 72], 11, 8, 22);
  meshes.push(shaft.toMesh("steel", "tower-shaft"));
  const cap = rectPolygon(center[0], center[1], 18, 18);
  meshes.push(extrudePolygon({polygon: cap, height: 3, baseZ: 76, materialId: "dark-glass"}));
  return landmarkObject("landmark-observation-tower", "Observation Tower", block, meshes, {height: 79, silhouette: "slender tower with viewing deck"}, urbanContext);
}

function landmarkObject(id: string, name: string, block: Block, meshes: CityObject["meshes"], extra: Record<string, unknown>, urbanContext?: CityUrbanContext): CityObject {
  const blockContext = urbanContext?.blockContexts[block.id];
  return {
    id,
    name,
    type: "Landmark",
    layerId: "landmarks",
    meshes,
    metadata: {
      id,
      type: "Landmark",
      district: block.district,
      blockId: block.id,
      landmarkType: block.landmark,
      ...(blockContext ? {
        grammar: blockContext.grammar,
        growthPhase: blockContext.growthPhase,
        landValue: blockContext.landValue,
        landmarkInfluence: blockContext.landmarkInfluence,
        viewCorridorPressure: blockContext.viewCorridorPressure,
        patterns: blockContext.patterns.map((pattern) => ({
          id: pattern.id,
          weight: pattern.weight
        }))
      } : {}),
      ...extra
    }
  };
}

function addTree(trunks: MeshBuilder, crowns: MeshBuilder, point: Vec2, height: number): void {
  trunks.addCylinder([point[0], point[1], height * 0.28], 0.22 + height * 0.018, height * 0.56, 8);
  crowns.addBox([point[0], point[1], height * 0.76], [height * 0.58, height * 0.58, height * 0.46], Math.PI / 4);
}

function titleCase(value: string): string {
  return value.split("-").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}
