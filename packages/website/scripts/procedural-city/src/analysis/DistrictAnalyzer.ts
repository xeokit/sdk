import type {CityProfile, DistrictName} from "../types";
import {normalizeShares, round} from "./Stats";
import type {BuildingAnalysis} from "./BuildingAnalyzer";
import type {LandUseAnalysis} from "./LandUseAnalyzer";
import type {RoadAnalysis} from "./RoadAnalyzer";

export interface DistrictAnalysis {
  districts: CityProfile["districts"];
  relationships: CityProfile["relationships"];
}

export function analyzeDistricts(roads: RoadAnalysis, buildings: BuildingAnalysis, landUse: LandUseAnalysis): DistrictAnalysis {
  const density = buildings.footprints.length / Math.max(1, roads.area / 1000000);
  const highRiseShare = buildings.footprints.filter((building) => (building.levels || 0) >= 12 || (building.height || 0) >= 45).length / Math.max(1, buildings.footprints.length);
  const mixedUse = landUse.profile.mixedUse || 0;
  const commercial = landUse.profile.commercial || 0;
  const historic = Math.max(0.05, Math.min(0.52, (roads.profile.curvature?.mean || 1.08) - 0.82 + buildings.courtyardFrequency * 0.3));
  const downtown = Math.max(0.08, Math.min(0.48, highRiseShare * 2.4 + commercial * 0.8));
  const civic = Math.max(0.06, Math.min(0.18, (landUse.profile.civic || 0) * 1.8 + (landUse.publicSpace.openSpaceRatio || 0) * 0.35));
  const residential = Math.max(0.18, 1 - historic - downtown - civic);
  const roadDensity = roads.profile.roadDensityKmPerSquareKm || 10;
  const intersectionDensity = roads.profile.intersectionDensityPerSquareKm || 70;
  const pedestrianShare = roads.profile.hierarchyShare?.pedestrian || 0.03;
  const perimeterBias = Math.min(0.86, Math.max(0.16, buildings.courtyardFrequency * 1.15 + (buildings.profile.streetAlignmentProbability || 0.72) * 0.32));
  const districts = normalizeShares<DistrictName>({
    "Historic Core": historic,
    Downtown: downtown,
    "Mixed Residential": residential + mixedUse * 0.18,
    "Civic District": civic
  });
  return {
    districts,
    relationships: {
      downtownHeightGradient: round(0.65 + highRiseShare * 2.8),
      commercialRoadBias: round(Math.min(0.95, Math.max(0.35, buildings.roadRelationships.commercialRoadBias || (0.45 + commercial * 1.3)))),
      courtyardProbability: round(Math.min(0.65, 0.1 + buildings.courtyardFrequency * 1.1)),
      roadHierarchyBlockScale: round(Math.max(0.65, Math.min(1.4, (roads.profile.segmentLength?.mean || 90) / 90))),
      streetIrregularity: round(Math.min(1, Math.max(0, ((roads.profile.curvature?.mean || 1.08) - 1) * 4 + Math.abs((roads.profile.intersectionAngles?.p25 || 70) - 90) / 90))),
      buildingStreetAlignment: round(buildings.profile.streetAlignment?.mean || 0.72),
      heightRoadBias: round(Math.min(1.4, Math.max(0.35, buildings.roadRelationships.heightRoadBias || (0.4 + highRiseShare * 1.8 + density / 2400)))),
      perimeterBlockBias: round(perimeterBias),
      pedestrianStreetBias: round(Math.min(1.8, Math.max(0.45, 0.7 + pedestrianShare * 8))),
      localRoadDensityBias: round(Math.min(1.6, Math.max(0.65, roadDensity / 12))),
      commercialIntersectionBias: round(Math.min(1.25, Math.max(0.25, buildings.roadRelationships.commercialIntersectionBias + intersectionDensity / 900)))
    }
  };
}
