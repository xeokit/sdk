import type {CityProfile, Vec2} from "../types";
import type {OSMExtract, OSMFeature} from "./OSMLoader";
import {distribution, normalizeShares, polygonArea} from "./Stats";

export interface LandUseAnalysis {
  profile: CityProfile["landUse"];
  publicSpace: CityProfile["publicSpace"];
}

export function analyzeLandUse(extract: OSMExtract): LandUseAnalysis {
  const counts: Record<keyof CityProfile["landUse"], number> = {
    residential: 0,
    commercial: 0,
    mixedUse: 0,
    industrial: 0,
    parks: 0,
    civic: 0
  };
  const parkAreas: number[] = [];
  const plazaAreas: number[] = [];
  let treeCount = 0;
  for (const feature of extract.features) {
    const cls = classify(feature);
    if (cls) {
      counts[cls] += areaWeight(feature);
    }
    if (cls === "parks") {
      parkAreas.push(areaWeight(feature));
    }
    if (feature.properties.amenity === "marketplace" || feature.properties.place === "square") {
      plazaAreas.push(areaWeight(feature));
    }
    if (feature.properties.natural === "tree" || feature.properties.tree || feature.properties["tree:ref"]) {
      treeCount++;
    }
  }
  const area = Math.max(1, (extract.bounds[2] - extract.bounds[0]) * (extract.bounds[3] - extract.bounds[1]));
  return {
    profile: normalizeShares(counts) as CityProfile["landUse"],
    publicSpace: {
      parkFrequency: parkAreas.length / Math.max(1, extract.features.length),
      plazaSize: distribution(plazaAreas, {mean: 2500}),
      streetTreeDensity: {mean: treeCount / Math.max(1, area / 10000)},
      openSpaceRatio: Math.min(0.35, parkAreas.reduce((sum, value) => sum + value, 0) / area),
      areaRatio: Math.min(0.35, parkAreas.reduce((sum, value) => sum + value, 0) / area),
      parkFrequencyPerSquareKm: parkAreas.length / Math.max(0.001, area / 1000000),
      plazaFrequencyPerSquareKm: plazaAreas.length / Math.max(0.001, area / 1000000),
      averageOpenSpaceSize: parkAreas.length ? parkAreas.reduce((sum, value) => sum + value, 0) / parkAreas.length : 0
    }
  };
}

function classify(feature: OSMFeature): keyof CityProfile["landUse"] | undefined {
  const properties = feature.properties;
  const landuse = String(properties.landuse || "");
  const amenity = String(properties.amenity || "");
  if (landuse === "residential") return "residential";
  if (landuse === "commercial" || properties.shop || properties.office) return "commercial";
  if (landuse === "retail") return "mixedUse";
  if (landuse === "industrial" || landuse === "railway") return "industrial";
  if (landuse === "grass" || landuse === "recreation_ground" || properties.leisure === "park" || properties.boundary === "national_park") return "parks";
  if (amenity === "school" || amenity === "university" || amenity === "townhall" || amenity === "hospital" || amenity === "library") return "civic";
  if (properties.building === "apartments" || properties.building === "house") return "residential";
  if (properties.building === "commercial" || properties.building === "retail") return "commercial";
  return undefined;
}

function areaWeight(feature: OSMFeature): number {
  if (feature.geometry.type === "Polygon") {
    return Math.max(1, polygonArea((feature.geometry.coordinates as Vec2[][])[0]));
  }
  if (feature.geometry.type === "MultiPolygon") {
    return Math.max(1, (feature.geometry.coordinates as Vec2[][][]).reduce((sum, polygon) => sum + polygonArea(polygon[0]), 0));
  }
  return 1;
}
