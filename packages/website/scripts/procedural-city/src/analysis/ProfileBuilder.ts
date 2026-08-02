import fs from "node:fs/promises";
import path from "node:path";
import type {CityProfile} from "../types";
import {loadOSMExtract} from "./OSMLoader";
import {analyzeRoads} from "./RoadAnalyzer";
import {analyzeBlocks} from "./BlockAnalyzer";
import {analyzeBuildings} from "./BuildingAnalyzer";
import {analyzeParcels} from "./ParcelAnalyzer";
import {analyzeLandUse} from "./LandUseAnalyzer";
import {analyzeDistricts} from "./DistrictAnalyzer";

export interface ProfileBuilderOptions {
  name: string;
  description?: string;
}

export async function buildProfileFromOSM(inputPath: string, options: ProfileBuilderOptions): Promise<CityProfile> {
  const extract = await loadOSMExtract(inputPath);
  const roads = analyzeRoads(extract);
  const blocks = analyzeBlocks(roads);
  const buildings = analyzeBuildings(extract, roads);
  const parcels = analyzeParcels(buildings, blocks);
  const landUse = analyzeLandUse(extract);
  const districts = analyzeDistricts(roads, buildings, landUse);

  return {
    schema: "xeokit-procedural-city-profile/1.0",
    version: 1,
    name: options.name,
    description: options.description || `Procedural city profile learned from ${path.basename(inputPath)}.`,
    source: {
      type: "osm",
      input: inputPath,
      region: options.name,
      areaSquareMeters: Math.round(roads.area),
      generatedAt: new Date().toISOString()
    },
    sampleCounts: {
      roads: roads.roadLines.length,
      roadSegments: roads.segmentCount,
      intersections: roads.intersections.length,
      blocks: blocks.profile.measuredCount || Math.round(roads.area / Math.max(1, blocks.profile.area?.median || blocks.profile.area?.mean || 7000)),
      buildings: buildings.footprints.length,
      buildingsWithLevels: buildings.footprints.filter((building) => Number.isFinite(building.levels)).length,
      buildingsWithHeights: buildings.footprints.filter((building) => Number.isFinite(building.height)).length,
      parks: Math.round((landUse.publicSpace.parkFrequency || 0) * extract.features.length),
      plazas: Math.round((landUse.publicSpace.plazaSize?.mean ? 1 : 0))
    },
    roads: roads.profile,
    blocks: {
      ...blocks.profile,
      courtyardFrequency: buildings.courtyardFrequency || blocks.profile.courtyardFrequency
    },
    parcels: parcels.profile,
    buildings: buildings.profile,
    landUse: landUse.profile,
    publicSpace: landUse.publicSpace,
    districts: districts.districts,
    relationships: districts.relationships
  };
}

export async function writeProfile(profile: CityProfile, outputPath: string): Promise<void> {
  await fs.mkdir(path.dirname(outputPath), {recursive: true});
  await fs.writeFile(outputPath, `${JSON.stringify(profile, null, 2)}\n`, "utf8");
}
