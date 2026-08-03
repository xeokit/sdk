import type {CityScene, Vec2} from "../../types";
import type {MetricGroupResult} from "../CalibrationReport";
import {polygonArea} from "../../geometry/PolygonUtils";
import {aspectFromBounds, bounds, differenceScore, distribution, round, safeRatio, scoreAverage, targetRangeScore} from "./MetricUtils";

export function collectParcelMetrics(scene: CityScene): MetricGroupResult {
  const buildings = scene.objects.filter((object) => object.type === "Building");
  const footprints = buildings.map((object) => ({
    parcelId: String(object.metadata.parcelId || object.id),
    roadHierarchy: String(object.metadata.roadHierarchy || ""),
    footprint: metadataFootprint(object.metadata.footprint)
  })).filter((entry) => entry.footprint.length >= 3);
  const frontage = footprints.map((entry) => {
    const b = bounds(entry.footprint);
    return Math.min(Math.max(0.1, b[2] - b[0]), Math.max(0.1, b[3] - b[1]));
  });
  const depth = footprints.map((entry) => {
    const b = bounds(entry.footprint);
    return Math.max(Math.max(0.1, b[2] - b[0]), Math.max(0.1, b[3] - b[1]));
  });
  const areas = footprints.map((entry) => Math.abs(polygonArea(entry.footprint)));
  const aspectRatios = footprints.map((entry) => aspectFromBounds(bounds(entry.footprint)));
  const roadAccessRatio = safeRatio(footprints.filter((entry) => !!entry.roadHierarchy).length, footprints.length);
  const unusableRatio = safeRatio(footprints.filter((entry, index) => areas[index] < 18 || aspectRatios[index] > 7.5).length, footprints.length);
  const repeatedDimensionRatio = repeatedDimensionShare(frontage, depth);
  const cornerFrequency = safeRatio(footprints.filter((entry) => entry.roadHierarchy === "arterial" || entry.roadHierarchy === "collector").length, footprints.length);
  const profile = scene.config.profileData;
  const frontageStats = distribution(frontage);
  const depthStats = distribution(depth);
  const areaStats = distribution(areas);
  const score = scoreAverage([
    differenceScore(frontageStats.median, profile?.parcels.frontage?.median, 0.6),
    differenceScore(depthStats.median, profile?.parcels.depth?.median, 0.65),
    differenceScore(areaStats.median, profile?.parcels.area?.median ?? profile?.buildings.footprintArea?.median, 0.7),
    roadAccessRatio,
    targetRangeScore(unusableRatio, 0, 0.035),
    targetRangeScore(repeatedDimensionRatio, 0, 0.22),
    targetRangeScore(cornerFrequency, 0.08, 0.42)
  ]);
  const warnings: string[] = [];
  if (unusableRatio > 0.05) {
    warnings.push(`Estimated unusable parcel ratio is high (${round(unusableRatio)})`);
  }
  if (repeatedDimensionRatio > 0.28) {
    warnings.push("Parcel dimensions are becoming repetitive");
  }
  return {
    key: "parcels",
    label: "Parcel metrics",
    score: round(score),
    warnings,
    metrics: [
      {key: "medianFrontage", label: "Median frontage width", value: frontageStats.median, unit: "m", score: differenceScore(frontageStats.median, profile?.parcels.frontage?.median, 0.6)},
      {key: "medianDepth", label: "Median parcel depth", value: depthStats.median, unit: "m", score: differenceScore(depthStats.median, profile?.parcels.depth?.median, 0.65)},
      {key: "medianArea", label: "Median estimated parcel area", value: areaStats.median, unit: "m2", score: differenceScore(areaStats.median, profile?.parcels.area?.median ?? profile?.buildings.footprintArea?.median, 0.7)},
      {key: "buildableAreaRatio", label: "Buildable-area proxy", value: round(buildableAreaRatio(scene)), score: targetRangeScore(buildableAreaRatio(scene), 0.42, 0.86)},
      {key: "roadAccessRatio", label: "Road-access ratio", value: round(roadAccessRatio), score: roadAccessRatio},
      {key: "unusableParcelRatio", label: "Unusable parcel ratio", value: round(unusableRatio), score: targetRangeScore(unusableRatio, 0, 0.035)},
      {key: "cornerParcelFrequency", label: "Corner parcel frequency proxy", value: round(cornerFrequency), score: targetRangeScore(cornerFrequency, 0.08, 0.42)}
    ],
    details: {
      frontage: frontageStats,
      depth: depthStats,
      area: areaStats
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

function buildableAreaRatio(scene: CityScene): number {
  const buildableBlocks = scene.blocks.filter((block) => !block.openSpace && !block.landmark);
  const buildableArea = buildableBlocks.reduce((sum, block) => sum + Math.abs(block.area), 0);
  const buildingArea = scene.objects
    .filter((object) => object.type === "Building")
    .reduce((sum, object) => sum + Number(object.metadata.footprintArea || 0), 0);
  return safeRatio(buildingArea, buildableArea);
}

function repeatedDimensionShare(frontage: number[], depth: number[]): number {
  const buckets = new Map<string, number>();
  for (let i = 0; i < frontage.length; i++) {
    const key = `${Math.round(frontage[i] / 2) * 2}x${Math.round(depth[i] / 2) * 2}`;
    buckets.set(key, (buckets.get(key) || 0) + 1);
  }
  const repeated = Array.from(buckets.values()).filter((count) => count > 3).reduce((sum, count) => sum + count, 0);
  return safeRatio(repeated, frontage.length);
}
