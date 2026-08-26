import type {CityObject, CityScene, Vec2} from "../../types";
import type {MetricGroupResult} from "../CalibrationReport";
import {distanceToSegment, polygonArea} from "../../geometry/PolygonUtils";
import {aspectFromBounds, bounds, differenceScore, distribution, round, safeRatio, scoreAverage, targetRangeScore} from "./MetricUtils";

export function collectBuildingMetrics(scene: CityScene): MetricGroupResult {
  const buildings = scene.objects.filter((object) => object.type === "Building");
  const footprints = buildings.map((object) => metadataFootprint(object.metadata.footprint));
  const areas = buildings.map((object, index) => Number(object.metadata.footprintArea || Math.abs(polygonArea(footprints[index])) || 0));
  const floors = buildings.map((object) => Number(object.metadata.floors || 0)).filter((value) => value > 0);
  const heights = buildings.map((object) => Number(object.metadata.height || 0)).filter((value) => value > 0);
  const aspectRatios = footprints.filter((footprint) => footprint.length >= 3).map((footprint) => aspectFromBounds(bounds(footprint)));
  const coverageRatio = buildingCoverage(scene);
  const streetAlignment = streetEdgeAlignment(scene, buildings);
  const cornerResponse = cornerBuildingResponse(buildings);
  const setbackDistribution = distribution(buildings.map((object) => estimatedSetback(scene, object)));
  const spacingDistribution = distribution(buildingSpacing(scene, buildings));
  const courtyardFormation = safeRatio(buildings.filter((object) => String(object.metadata.patterns || "").includes("courtyard") || object.metadata.grammar === "perimeter-courtyard").length, buildings.length);
  const overlapCount = buildingOverlapCount(buildings);
  const roadOverlapCount = roadOverlapCountForBuildings(scene, buildings);
  const roadOverlapRatio = safeRatio(roadOverlapCount, buildings.length);
  const profile = scene.config.profileData;
  const score = scoreAverage([
    differenceScore(coverageRatio, profile?.buildings.coverage?.median ?? profile?.parcels.buildableCoverage?.median, 0.55),
    differenceScore(distribution(floors).median, profile?.buildings.levels?.median, 0.55),
    differenceScore(distribution(areas).median, profile?.buildings.footprintArea?.median, 0.65),
    streetAlignment,
    targetRangeScore(cornerResponse, 0.42, 0.9),
    targetRangeScore(overlapCount, 0, 0),
    targetRangeScore(roadOverlapRatio, 0, 0.04)
  ]);
  const warnings: string[] = [];
  if (overlapCount > 0) {
    warnings.push(`${overlapCount} severe building overlaps detected`);
  }
  if (roadOverlapRatio > 0.04) {
    warnings.push(`${roadOverlapCount} buildings overlap roads`);
  }
  if (streetAlignment < 0.45) {
    warnings.push("Street-edge alignment is weak");
  }
  return {
    key: "buildings",
    label: "Building metrics",
    score: round(score),
    warnings,
    metrics: [
      {key: "buildingCoverageRatio", label: "Building coverage ratio", value: round(coverageRatio), score: differenceScore(coverageRatio, profile?.buildings.coverage?.median ?? profile?.parcels.buildableCoverage?.median, 0.55)},
      {key: "medianFloors", label: "Median floor count", value: distribution(floors).median, score: differenceScore(distribution(floors).median, profile?.buildings.levels?.median, 0.55)},
      {key: "medianHeight", label: "Median height", value: distribution(heights).median, unit: "m", score: differenceScore(distribution(heights).median, profile?.buildings.heights?.median, 0.65)},
      {key: "medianFootprintArea", label: "Median footprint area", value: distribution(areas).median, unit: "m2", score: differenceScore(distribution(areas).median, profile?.buildings.footprintArea?.median, 0.65)},
      {key: "streetEdgeAlignment", label: "Street-edge alignment", value: round(streetAlignment), score: streetAlignment},
      {key: "cornerBuildingResponse", label: "Corner-building response", value: round(cornerResponse), score: targetRangeScore(cornerResponse, 0.42, 0.9)},
      {key: "medianSetback", label: "Median setback proxy", value: setbackDistribution.median, unit: "m"},
      {key: "medianBuildingSpacing", label: "Median building spacing", value: spacingDistribution.median, unit: "m"},
      {key: "courtyardFormation", label: "Courtyard formation", value: round(courtyardFormation), score: targetRangeScore(courtyardFormation, 0.08, 0.7)},
      {key: "buildingOverlapCount", label: "Building overlap count", value: overlapCount, score: targetRangeScore(overlapCount, 0, 0)},
      {key: "buildingRoadOverlapCount", label: "Building-road overlap count", value: roadOverlapCount},
      {key: "buildingRoadOverlaps", label: "Building-road overlap ratio", value: round(roadOverlapRatio), score: targetRangeScore(roadOverlapRatio, 0, 0.04)}
    ],
    details: {
      floors: distribution(floors),
      heights: distribution(heights),
      footprintArea: distribution(areas),
      footprintAspectRatio: distribution(aspectRatios)
    }
  };
}

function metadataFootprint(value: unknown): Vec2[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((point) => Array.isArray(point) && Number.isFinite(point[0]) && Number.isFinite(point[1]))
    .map((point) => [Number(point[0]), Number(point[1])] as Vec2);
}

function buildingCoverage(scene: CityScene): number {
  const buildableArea = scene.blocks
    .filter((block) => !block.openSpace && !block.landmark)
    .reduce((sum, block) => sum + Math.abs(block.area), 0);
  const footprintArea = scene.objects
    .filter((object) => object.type === "Building")
    .reduce((sum, object) => sum + Number(object.metadata.footprintArea || 0), 0);
  return safeRatio(footprintArea, buildableArea);
}

function streetEdgeAlignment(scene: CityScene, buildings: CityObject[]): number {
  const scores = buildings.map((building) => {
    const footprint = metadataFootprint(building.metadata.footprint);
    if (footprint.length < 3) {
      return 0;
    }
    let minDistance = Infinity;
    for (const road of scene.roads) {
      for (let i = 1; i < road.polyline.length; i++) {
        for (const point of footprint) {
          minDistance = Math.min(minDistance, distanceToSegment(point, road.polyline[i - 1], road.polyline[i]));
        }
      }
    }
    const roadType = String(building.metadata.roadHierarchy || "");
    const expected = roadType === "arterial" ? 22 : roadType === "collector" ? 17 : 13;
    return targetRangeScore(minDistance, 3, expected);
  });
  return scores.length ? scores.reduce((sum, score) => sum + score, 0) / scores.length : 0;
}

function cornerBuildingResponse(buildings: CityObject[]): number {
  const important = buildings.filter((building) => building.metadata.roadHierarchy === "arterial" || building.metadata.roadHierarchy === "collector");
  if (!important.length) {
    return 0.6;
  }
  const active = important.filter((building) => {
    const usage = String(building.metadata.usage || "");
    return usage === "Retail" || usage === "MixedUse" || usage === "Office" || Number(building.metadata.floors || 0) >= 6;
  }).length;
  return safeRatio(active, important.length);
}

function estimatedSetback(scene: CityScene, building: CityObject): number {
  const footprint = metadataFootprint(building.metadata.footprint);
  if (footprint.length < 3) {
    return 0;
  }
  let minDistance = Infinity;
  for (const road of scene.roads) {
    for (let i = 1; i < road.polyline.length; i++) {
      for (const point of footprint) {
        minDistance = Math.min(minDistance, distanceToSegment(point, road.polyline[i - 1], road.polyline[i]));
      }
    }
  }
  return Number.isFinite(minDistance) ? minDistance : 0;
}

function buildingSpacing(scene: CityScene, buildings: CityObject[]): number[] {
  const byBlock = new Map<string, Vec2[]>();
  for (const building of buildings) {
    const center = metadataPoint(building.metadata.center);
    if (!center) {
      continue;
    }
    const blockId = String(building.metadata.blockId || "");
    const centers = byBlock.get(blockId) || [];
    centers.push(center);
    byBlock.set(blockId, centers);
  }
  const spacing: number[] = [];
  for (const centers of byBlock.values()) {
    for (let i = 0; i < centers.length; i++) {
      let min = Infinity;
      for (let j = 0; j < centers.length; j++) {
        if (i !== j) {
          min = Math.min(min, Math.hypot(centers[i][0] - centers[j][0], centers[i][1] - centers[j][1]));
        }
      }
      if (Number.isFinite(min)) {
        spacing.push(min);
      }
    }
  }
  return spacing;
}

function metadataPoint(value: unknown): Vec2 | undefined {
  return Array.isArray(value) && Number.isFinite(value[0]) && Number.isFinite(value[1])
    ? [Number(value[0]), Number(value[1])]
    : undefined;
}

function buildingOverlapCount(buildings: CityObject[]): number {
  let overlaps = 0;
  const entries = buildings.map((building) => {
    const footprint = metadataFootprint(building.metadata.footprint);
    return {
      blockId: String(building.metadata.blockId || ""),
      footprint,
      area: Math.abs(polygonArea(footprint)),
      bounds: footprint.length >= 3 ? bounds(footprint) : [0, 0, 0, 0] as [number, number, number, number]
    };
  }).filter((entry) => entry.footprint.length >= 3);
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      if (entries[i].blockId !== entries[j].blockId) {
        continue;
      }
      if (!bboxOverlap(entries[i].bounds, entries[j].bounds)) {
        continue;
      }
      const boxOverlap = bboxIntersectionArea(entries[i].bounds, entries[j].bounds);
      const minArea = Math.min(entries[i].area, entries[j].area);
      if (boxOverlap > Math.max(12, minArea * 0.12)) {
        overlaps++;
      }
    }
  }
  return overlaps;
}

function roadOverlapCountForBuildings(scene: CityScene, buildings: CityObject[]): number {
  let count = 0;
  for (const building of buildings) {
    const footprint = metadataFootprint(building.metadata.footprint);
    const overlapsRoad = scene.roads.some((road) => {
      const threshold = Math.max(0.35, road.width * 0.055);
      return footprint.some((point) => road.polyline.some((roadPoint, index) => index > 0
        && distanceToSegment(point, road.polyline[index - 1], roadPoint) < threshold));
    });
    if (overlapsRoad) {
      count++;
    }
  }
  return count;
}

function bboxOverlap(a: [number, number, number, number], b: [number, number, number, number]): boolean {
  return a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];
}

function bboxIntersectionArea(a: [number, number, number, number], b: [number, number, number, number]): number {
  const x = Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0]));
  const y = Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]));
  return x * y;
}
