import type {CityProfile} from "../types";
import {distribution} from "./Stats";
import type {BuildingAnalysis} from "./BuildingAnalyzer";
import type {BlockAnalysis} from "./BlockAnalyzer";

export interface ParcelAnalysis {
  profile: CityProfile["parcels"];
}

export function analyzeParcels(buildings: BuildingAnalysis, blocks: BlockAnalysis): ParcelAnalysis {
  const buildingAreas = buildings.footprints.map((building) => building.area);
  const blockFrontage = blocks.profile.frontageLength?.mean || 80;
  const frontage = buildings.footprints.map((building) => Math.sqrt(building.area) * 0.68);
  const depth = buildings.footprints.map((building) => Math.sqrt(building.area) * 1.42);
  return {
    profile: {
      frontage: distribution(frontage, {mean: Math.max(10, blockFrontage / 4)}),
      depth: distribution(depth, {mean: 38}),
      area: distribution(buildingAreas.map((area) => area * 1.35), {mean: 850}),
      buildableCoverage: distribution(buildingAreas.map((area) => Math.min(0.9, area / Math.max(area, area * 1.35))), {mean: 0.58}),
      setbacks: distribution(frontage.map((value) => Math.max(0.5, value * 0.14)), {mean: 4})
    }
  };
}
