import type {CityProfile, Vec2} from "../types";
import type {OSMExtract, OSMFeature} from "./OSMLoader";
import {aspectRatio, bbox, centroid, compactness, distribution, nearestSpacing, polygonArea, round} from "./Stats";
import type {RoadAnalysis} from "./RoadAnalyzer";

export interface BuildingAnalysis {
  profile: CityProfile["buildings"];
  footprints: Array<{points: Vec2[]; area: number; center: Vec2; levels?: number; height?: number; properties: Record<string, unknown>}>;
  courtyardFrequency: number;
  roadRelationships: {
    streetAlignmentProbability: number;
    heightRoadBias: number;
    commercialRoadBias: number;
    commercialIntersectionBias: number;
  };
}

export function analyzeBuildings(extract: OSMExtract, roads?: RoadAnalysis): BuildingAnalysis {
  const footprints = buildingFootprints(extract.features);
  const areas = footprints.map((building) => building.area);
  const ratios = footprints.map((building) => aspectRatio(building.points));
  const levels = footprints.map((building) => building.levels).filter((value): value is number => Number.isFinite(value));
  const heights = footprints.map((building) => building.height).filter((value): value is number => Number.isFinite(value));
  const centers = footprints.map((building) => building.center);
  const courtyardCount = footprints.filter((building) => hasCourtyardShape(building.points)).length;
  const contexts = roads ? footprints.map((building) => roadContextForBuilding(building, roads)) : [];
  const alignedContexts = contexts.filter((context) => context && context.distance < 28 && context.angleDifference <= 18);
  const streetDistances = contexts.map((context) => context?.distance).filter((value): value is number => Number.isFinite(value));
  const streetAlignmentProbability = contexts.length
    ? round(clamp(alignedContexts.length / contexts.length, 0.35, 0.94))
    : round(0.62 + Math.min(0.32, courtyardCount / Math.max(1, footprints.length)));
  const relationships = roadRelationships(footprints, contexts);
  return {
    profile: {
      footprintArea: distribution(areas, {mean: 600}),
      aspectRatio: distribution(ratios, {mean: 1.6}),
      coverage: distribution(footprints.map((building) => Math.min(0.95, compactness(building.points) * 0.92)), {mean: 0.55}),
      levels: distribution(levels.length ? levels : heights.map((height) => height / 3.3), {mean: 7, p25: 4, p75: 10}),
      heights: distribution(heights.length ? heights : levels.map((level) => level * 3.3), {mean: 24}),
      spacing: distribution(nearestSpacing(centers), {mean: 8}),
      streetAlignment: {mean: streetAlignmentProbability},
      streetAlignmentProbability,
      streetDistance: distribution(streetDistances, {mean: 12}),
      gapFrequency: round(Math.min(0.65, (distribution(nearestSpacing(centers), {mean: 8}).median || 8) / 36)),
      levelsConfidence: round(levels.length / Math.max(1, footprints.length)),
      heightsConfidence: round(heights.length / Math.max(1, footprints.length))
    },
    footprints,
    courtyardFrequency: round(courtyardCount / Math.max(1, footprints.length), 4),
    roadRelationships: relationships
  };
}

function buildingFootprints(features: OSMFeature[]): BuildingAnalysis["footprints"] {
  const footprints: BuildingAnalysis["footprints"] = [];
  for (const feature of features) {
    if (!feature.properties.building) {
      continue;
    }
    for (const points of polygons(feature.geometry)) {
      const area = polygonArea(points);
      if (area < 12) {
        continue;
      }
      footprints.push({
        points,
        area,
        center: centroid(points),
        levels: numericTag(feature.properties["building:levels"]),
        height: numericTag(feature.properties.height),
        properties: feature.properties
      });
    }
  }
  return footprints;
}

function polygons(geometry: OSMFeature["geometry"]): Vec2[][] {
  if (geometry.type === "Polygon") {
    return [(geometry.coordinates as Vec2[][])[0]];
  }
  if (geometry.type === "MultiPolygon") {
    return (geometry.coordinates as Vec2[][][]).map((polygon) => polygon[0]);
  }
  return [];
}

function numericTag(value: unknown): number | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  const parsed = Number(String(value).replace(/[^\d.]/g, ""));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function hasCourtyardShape(points: Vec2[]): boolean {
  const area = polygonArea(points);
  const [minX, minY, maxX, maxY] = bbox(points);
  const bboxArea = Math.max(1, (maxX - minX) * (maxY - minY));
  return area > 700 && area / bboxArea < 0.68;
}

function roadContextForBuilding(building: BuildingAnalysis["footprints"][number], roads: RoadAnalysis): {
  distance: number;
  hierarchy: string;
  roadOrientation: number;
  angleDifference: number;
} | undefined {
  let nearest: {distance: number; hierarchy: string; roadOrientation: number} | undefined;
  for (const road of roads.roadLines) {
    for (let i = 1; i < road.points.length; i++) {
      const a = road.points[i - 1];
      const b = road.points[i];
      const d = distancePointToSegment(building.center, a, b);
      if (!nearest || d < nearest.distance) {
        nearest = {
          distance: d,
          hierarchy: road.hierarchy,
          roadOrientation: orientation(a, b)
        };
      }
    }
  }
  if (!nearest) {
    return undefined;
  }
  const buildingOrientation = dominantBuildingOrientation(building.points);
  return {
    ...nearest,
    angleDifference: orientationDifference(buildingOrientation, nearest.roadOrientation)
  };
}

function roadRelationships(footprints: BuildingAnalysis["footprints"], contexts: Array<ReturnType<typeof roadContextForBuilding>>): BuildingAnalysis["roadRelationships"] {
  const withContext = footprints
    .map((building, index) => ({building, context: contexts[index]}))
    .filter((entry) => entry.context);
  const major = withContext.filter((entry) => entry.context!.distance < 42 && (entry.context!.hierarchy === "arterial" || entry.context!.hierarchy === "collector"));
  const local = withContext.filter((entry) => entry.context!.distance >= 42 || entry.context!.hierarchy === "local" || entry.context!.hierarchy === "alley");
  const majorHeight = average(major.map((entry) => buildingLevel(entry.building)).filter(Number.isFinite));
  const localHeight = average(local.map((entry) => buildingLevel(entry.building)).filter(Number.isFinite));
  const commercial = withContext.filter((entry) => commercialBuilding(entry.building.properties));
  const commercialNearMajor = commercial.filter((entry) => entry.context!.distance < 48 && (entry.context!.hierarchy === "arterial" || entry.context!.hierarchy === "collector"));
  const nearAnyRoad = withContext.filter((entry) => entry.context!.distance < 48);
  return {
    streetAlignmentProbability: withContext.length
      ? round(clamp(withContext.filter((entry) => entry.context!.distance < 28 && entry.context!.angleDifference <= 18).length / withContext.length, 0.35, 0.94))
      : 0.72,
    heightRoadBias: round(clamp(Number.isFinite(majorHeight) && Number.isFinite(localHeight) && localHeight > 0 ? majorHeight / localHeight : 0.72, 0.35, 1.55)),
    commercialRoadBias: round(clamp(commercial.length ? commercialNearMajor.length / commercial.length : 0.55, 0.25, 0.95)),
    commercialIntersectionBias: round(clamp(commercial.length ? commercialNearMajor.length / Math.max(1, nearAnyRoad.length) : 0.45, 0.15, 0.9))
  };
}

function buildingLevel(building: BuildingAnalysis["footprints"][number]): number {
  if (Number.isFinite(building.levels)) {
    return Number(building.levels);
  }
  if (Number.isFinite(building.height)) {
    return Number(building.height) / 3.3;
  }
  return NaN;
}

function commercialBuilding(properties: Record<string, unknown>): boolean {
  const building = String(properties.building || "");
  const amenity = String(properties.amenity || "");
  return Boolean(properties.shop || properties.office)
    || building === "commercial"
    || building === "retail"
    || building === "hotel"
    || amenity === "restaurant"
    || amenity === "cafe"
    || amenity === "bank";
}

function dominantBuildingOrientation(points: Vec2[]): number {
  let bestLength = 0;
  let bestAngle = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (length > bestLength) {
      bestLength = length;
      bestAngle = orientation(a, b);
    }
  }
  return bestAngle;
}

function orientation(a: Vec2, b: Vec2): number {
  const angle = Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI;
  return ((angle % 180) + 180) % 180;
}

function orientationDifference(a: number, b: number): number {
  const diff = Math.abs((((a - b) % 180) + 180) % 180);
  return Math.min(diff, 180 - diff);
}

function distancePointToSegment(point: Vec2, a: Vec2, b: Vec2): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq <= 1e-9) {
    return Math.hypot(point[0] - a[0], point[1] - a[1]);
  }
  const t = Math.max(0, Math.min(1, ((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) / lengthSq));
  return Math.hypot(point[0] - (a[0] + dx * t), point[1] - (a[1] + dy * t));
}

function average(values: number[]): number {
  const clean = values.filter((value) => Number.isFinite(value));
  return clean.length ? clean.reduce((sum, value) => sum + value, 0) / clean.length : NaN;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
