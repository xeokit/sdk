import type {CityScene, Vec2} from "../../types";
import type {MetricGroupResult} from "../CalibrationReport";
import {distance, polygonArea} from "../../geometry/PolygonUtils";
import {aspectFromBounds, bounds, differenceScore, distribution, round, safeRatio, scoreAverage, targetRangeScore} from "./MetricUtils";

export function collectBlockMetrics(scene: CityScene): MetricGroupResult {
  const buildable = scene.blocks.filter((block) => !block.openSpace && !block.landmark);
  const areas = buildable.map((block) => Math.abs(block.area));
  const perimeters = buildable.map((block) => polygonPerimeter(block.polygon));
  const compactness = buildable.map((block) => blockCompactness(block.polygon));
  const aspectRatios = buildable.map((block) => aspectFromBounds(bounds(block.polygon)));
  const irregularity = buildable.map((block) => blockIrregularity(block.polygon));
  const courtyardRatio = safeRatio(buildable.filter((block) => block.pattern === "perimeter-courtyard").length, buildable.length);
  const tinyRatio = safeRatio(areas.filter((area) => area < Math.max(600, (scene.config.profileData?.blocks.area?.p25 || 2400) * 0.35)).length, areas.length);
  const oversizedRatio = safeRatio(areas.filter((area) => area > Math.max(12000, (scene.config.profileData?.blocks.area?.p75 || 9000) * 2.3)).length, areas.length);
  const frontageAvailability = safeRatio(buildable.filter((block) => (block.metadata.roadHierarchy || block.metadata.grammar)).length, buildable.length);
  const profile = scene.config.profileData;
  const areaStats = distribution(areas);
  const compactnessStats = distribution(compactness);
  const aspectStats = distribution(aspectRatios);
  const score = scoreAverage([
    differenceScore(areaStats.median, profile?.blocks.area?.median, 0.55),
    differenceScore(compactnessStats.median, profile?.blocks.compactness?.median, 0.45),
    differenceScore(courtyardRatio, profile?.blocks.courtyardFrequency ?? profile?.relationships.courtyardProbability, 0.55),
    targetRangeScore(tinyRatio, 0, 0.08),
    targetRangeScore(oversizedRatio, 0, 0.08),
    targetRangeScore(aspectStats.median, 1.05, 3.8),
    frontageAvailability
  ]);
  const warnings: string[] = [];
  if (tinyRatio > 0.12) {
    warnings.push(`Tiny block ratio is high (${round(tinyRatio)})`);
  }
  if (oversizedRatio > 0.12) {
    warnings.push(`Oversized block ratio is high (${round(oversizedRatio)})`);
  }
  if (aspectStats.p75 > 5) {
    warnings.push("Many blocks are overly elongated");
  }
  return {
    key: "blocks",
    label: "Block metrics",
    score: round(score),
    warnings,
    metrics: [
      {key: "medianArea", label: "Median block area", value: areaStats.median, unit: "m2", score: differenceScore(areaStats.median, profile?.blocks.area?.median, 0.55)},
      {key: "medianPerimeter", label: "Median block perimeter", value: distribution(perimeters).median, unit: "m"},
      {key: "medianCompactness", label: "Median compactness", value: compactnessStats.median, score: differenceScore(compactnessStats.median, profile?.blocks.compactness?.median, 0.45)},
      {key: "medianAspectRatio", label: "Median aspect ratio", value: aspectStats.median, score: targetRangeScore(aspectStats.median, 1.05, 3.8)},
      {key: "medianIrregularity", label: "Median irregularity", value: distribution(irregularity).median, score: targetRangeScore(distribution(irregularity).median, 0.02, 0.32)},
      {key: "frontageAvailability", label: "Frontage availability", value: round(frontageAvailability), score: frontageAvailability},
      {key: "courtyardBlockRatio", label: "Courtyard-block ratio", value: round(courtyardRatio), score: differenceScore(courtyardRatio, profile?.blocks.courtyardFrequency ?? profile?.relationships.courtyardProbability, 0.55)},
      {key: "tinyBlockRatio", label: "Tiny-block ratio", value: round(tinyRatio), score: targetRangeScore(tinyRatio, 0, 0.08)},
      {key: "oversizedBlockRatio", label: "Oversized-block ratio", value: round(oversizedRatio), score: targetRangeScore(oversizedRatio, 0, 0.08)}
    ],
    details: {
      area: areaStats,
      compactness: compactnessStats,
      aspectRatio: aspectStats
    }
  };
}

function polygonPerimeter(points: Vec2[]): number {
  let result = 0;
  for (let i = 0; i < points.length; i++) {
    result += distance(points[i], points[(i + 1) % points.length]);
  }
  return result;
}

function blockCompactness(points: Vec2[]): number {
  const area = Math.abs(polygonArea(points));
  const perimeter = polygonPerimeter(points);
  return perimeter > 0 ? (4 * Math.PI * area) / (perimeter * perimeter) : 0;
}

function blockIrregularity(points: Vec2[]): number {
  const area = Math.abs(polygonArea(points));
  const boxArea = Math.max(1, (bounds(points)[2] - bounds(points)[0]) * (bounds(points)[3] - bounds(points)[1]));
  return Math.max(0, 1 - area / boxArea);
}
