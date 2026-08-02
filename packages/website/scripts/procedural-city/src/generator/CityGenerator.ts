import seedrandom from "seedrandom";
import {createNoise2D} from "simplex-noise";
import polygonClipping from "polygon-clipping";
import type {CityGeneratorConfig, CityObject, CityScene, MaterialDefinition, RandomStreams, Vec2, Waterway} from "../types";
import {rectPolygon, round} from "../geometry/PolygonUtils";
import {extrudePolygon} from "../geometry/Extrusion";
import {generateRoadNetwork} from "./RoadNetwork";
import {generateBlocks} from "./BlockGenerator";
import {generateParcels} from "./ParcelGenerator";
import {generateBuildings} from "./BuildingGenerator";
import {generateLandmarks, generateParksAndPlazas} from "./ParkGenerator";
import {generateRoadObjects, generateStreetDetails} from "./StreetDetailGenerator";
import {generateWaterwayObjects} from "./WaterwayGenerator";
import {resolveCityProfile} from "../profiles/ProfileResolver";

export async function generateCity(config: Partial<CityGeneratorConfig> = {}): Promise<CityScene> {
  const profile = await resolveCityProfile(config.profile);
  const resolved: CityGeneratorConfig = {
    seed: config.seed ?? 42,
    size: config.size ?? 1000,
    style: "european",
    density: config.density ?? "high",
    buildingCount: config.buildingCount,
    profile: config.profile,
    profileData: profile,
    outputPath: config.outputPath ?? "./public/generated-city.xgf"
  };
  const streams = createRandomStreams(resolved.seed);
  const network = generateRoadNetwork(resolved, streams);
  const blocks = generateBlocks(resolved, network, streams);
  const parcels = generateParcels(blocks, streams, profile);
  const buildings = generateBuildings(parcels, resolved, streams);
  const roadObjects = generateRoadObjects(network);
  const waterwayObjects = generateWaterwayObjects(network.waterways, streams);
  const parks = generateParksAndPlazas(blocks, streams);
  const landmarks = generateLandmarks(blocks, streams);
  const streetDetails = generateStreetDetails(network, resolved, streams);
  const base = createBaseObject(resolved.size, network.waterways);
  const objects: CityObject[] = [
    base,
    ...roadObjects,
    ...waterwayObjects,
    ...parks,
    ...landmarks,
    ...buildings,
    ...streetDetails
  ];

  const metadata: Record<string, Record<string, unknown>> = {};
  for (const object of objects) {
    metadata[object.id] = object.metadata;
  }
  for (const block of blocks) {
    metadata[block.id] = block.metadata;
  }
  metadata["district-historic-core"] = districtMetadata("Historic Core", "narrow streets, small parcels, perimeter blocks and civic heritage fabric");
  metadata["district-downtown"] = districtMetadata("Downtown", "wide streets, podiums, towers and concentrated skyline");
  metadata["district-mixed-residential"] = districtMetadata("Mixed Residential", "apartment blocks, shops, courtyards and internal gardens");
  metadata["district-civic"] = districtMetadata("Civic District", "standalone civic buildings, plazas and pedestrian tree space");
  metadata["city-profile"] = {
    id: "city-profile",
    type: "CityProfile",
    name: profile.name,
    version: profile.version,
    description: profile.description
  };

  return {
    id: `ProceduralCity-${resolved.seed}`,
    config: resolved,
    materials: createMaterials(),
    objects,
    blocks,
    roads: network.roads,
    metadata,
    stats: {
      buildings: buildings.length,
      blocks: blocks.length,
      roads: network.roads.length,
      parks: parks.length,
      landmarks: landmarks.length,
      trees: Number(streetDetails.find((object) => object.id === "street-trees")?.metadata.treeCount || 0)
        + parks.reduce((sum, park) => sum + Number(park.metadata.treeCount || 0), 0),
      streetFurniture: Number(streetDetails.find((object) => object.id === "street-furniture")?.metadata.count || 0),
      waterways: network.waterways.length,
      bridges: network.waterways.reduce((sum, waterway) => sum + waterway.bridgeCrossings.length, 0),
      triangles: countTriangles(objects)
    }
  };
}

export function createRandomStreams(seed: string | number): RandomStreams {
  const key = String(seed);
  const roadRandom = seedrandom(`${key}:roads`);
  const heightRandom = seedrandom(`${key}:height-noise`);
  return {
    roads: seedrandom(`${key}:roads-stream`),
    blocks: seedrandom(`${key}:blocks`),
    parcels: seedrandom(`${key}:parcels`),
    zoning: seedrandom(`${key}:zoning`),
    buildings: seedrandom(`${key}:buildings`),
    facades: seedrandom(`${key}:facades`),
    roofs: seedrandom(`${key}:roofs`),
    vegetation: seedrandom(`${key}:vegetation`),
    furniture: seedrandom(`${key}:furniture`),
    waterways: seedrandom(`${key}:waterways`),
    roadNoise: createNoise2D(roadRandom),
    waterNoise: createNoise2D(seedrandom(`${key}:water-noise`)),
    heightNoise: createNoise2D(heightRandom)
  };
}

function createBaseObject(size: number, waterways: Waterway[] = []): CityObject {
  const basePolygons = groundPolygons(size, waterways);
  return {
    id: "city-ground",
    name: "City ground plane",
    type: "Ground",
    layerId: "blocks",
    meshes: basePolygons.map((polygon, index) => extrudePolygon({
      id: `city-ground-${index}`,
      polygon,
      height: 0.04,
      baseZ: -0.08,
      materialId: "paving-stone"
    })),
    metadata: {
      id: "city-ground",
      type: "Ground",
      size,
      cutouts: waterways.length
    }
  };
}

function groundPolygons(size: number, waterways: Waterway[]): Vec2[][] {
  const base = rectPolygon(0, 0, size * 1.08, size * 1.08);
  if (!waterways.length) {
    return [base];
  }
  const subject = [[closeRing(base)]];
  const clips = waterways.map((waterway) => [closeRing(waterway.polygon)]);
  const result = polygonClipping.difference(subject as any, ...(clips as any));
  const polygons: Vec2[][] = [];
  for (const polygon of result || []) {
    const outer = polygon[0];
    if (!outer || outer.length < 4) {
      continue;
    }
    polygons.push(outer.slice(0, -1).map((point) => [point[0], point[1]] as Vec2));
  }
  return polygons.length ? polygons : [base];
}

function closeRing(poly: Vec2[]): number[][] {
  const ring = poly.map((point) => [point[0], point[1]]);
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first && last && (first[0] !== last[0] || first[1] !== last[1])) {
    ring.push([first[0], first[1]]);
  }
  return ring;
}

function createMaterials(): MaterialDefinition[] {
  return [
    {id: "brick", color: [0.50, 0.29, 0.22], roughness: 0.9},
    {id: "sandstone", color: [0.66, 0.58, 0.46], roughness: 0.86},
    {id: "limestone", color: [0.72, 0.70, 0.63], roughness: 0.88},
    {id: "concrete", color: [0.50, 0.52, 0.50], roughness: 0.86},
    {id: "painted-concrete", color: [0.70, 0.66, 0.58], roughness: 0.84},
    {id: "steel", color: [0.36, 0.38, 0.38], roughness: 0.46, metallic: 0.25},
    {id: "light-glass", color: [0.42, 0.62, 0.70], roughness: 0.18},
    {id: "dark-glass", color: [0.16, 0.26, 0.34], roughness: 0.16},
    {id: "asphalt", color: [0.085, 0.09, 0.09], roughness: 0.9},
    {id: "paving-stone", color: [0.56, 0.55, 0.50], roughness: 0.92},
    {id: "grass", color: [0.25, 0.42, 0.24], roughness: 0.96},
    {id: "roof-tile", color: [0.43, 0.18, 0.13], roughness: 0.82},
    {id: "flat-roof", color: [0.18, 0.19, 0.18], roughness: 0.78},
    {id: "tree-trunk", color: [0.31, 0.20, 0.13], roughness: 0.9},
    {id: "tree-canopy", color: [0.18, 0.38, 0.20], roughness: 0.95},
    {id: "street-furniture", color: [0.20, 0.22, 0.22], roughness: 0.62},
    {id: "traffic-light", color: [0.08, 0.09, 0.08], roughness: 0.52},
    {id: "river-wall", color: [0.42, 0.42, 0.38], roughness: 0.88},
    {id: "channel-floor", color: [0.055, 0.095, 0.10], roughness: 0.94},
    {id: "water", color: [0.055, 0.24, 0.31], opacity: 1, roughness: 0.42, alphaMode: "OPAQUE"}
  ];
}

function districtMetadata(name: string, description: string): Record<string, unknown> {
  return {
    id: `district-${name.toLowerCase().replace(/[^a-z]+/g, "-").replace(/-$/, "")}`,
    type: "District",
    name,
    description
  };
}

function countTriangles(objects: CityObject[]): number {
  let triangles = 0;
  for (const object of objects) {
    for (const mesh of object.meshes) {
      triangles += Math.floor(mesh.indices.length / 3);
    }
  }
  return triangles;
}

export function createManifest(scene: CityScene): Record<string, unknown> {
  return {
    schema: "xeokit-procedural-city/1.0",
    seed: scene.config.seed,
    size: scene.config.size,
    style: scene.config.style,
    density: scene.config.density,
    profile: {
      name: scene.config.profileData?.name,
      version: scene.config.profileData?.version,
      source: scene.config.profileData?.source?.type
    },
    stats: {
      ...scene.stats,
      triangles: round(scene.stats.triangles, 0)
    },
    roads: scene.roads.map((road) => ({
      id: road.id,
      name: road.name,
      hierarchy: road.hierarchy,
      width: road.width
    })),
    blocks: scene.blocks.map((block) => block.metadata),
    objects: scene.objects.map((object) => ({
      id: object.id,
      name: object.name,
      type: object.type,
      layerId: object.layerId,
      metadata: object.metadata
    })),
    metadata: scene.metadata
  };
}
