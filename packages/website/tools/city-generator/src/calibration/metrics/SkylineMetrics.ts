import type {CityObject, CityScene, Vec2} from "../../types";
import type {MetricGroupResult} from "../CalibrationReport";
import {average, clamp01, distribution, round, safeRatio, scoreAverage, targetRangeScore} from "./MetricUtils";

export function collectSkylineMetrics(scene: CityScene): MetricGroupResult {
  const buildings = scene.objects.filter((object) => object.type === "Building");
  const entries = buildings.map((building) => ({
    id: building.id,
    center: metadataPoint(building.metadata.center),
    height: Number(building.metadata.height || 0),
    floors: Number(building.metadata.floors || 0),
    district: String(building.metadata.district || "")
  })).filter((entry) => entry.center && entry.height > 0) as Array<{id: string; center: Vec2; height: number; floors: number; district: string}>;
  const neighborDiffs = neighborHeightDifferences(entries);
  const heights = entries.map((entry) => entry.height);
  const heightStats = distribution(heights);
  const skylineVariation = heightStats.mean > 0 ? (heightStats.p75 - heightStats.p25) / heightStats.mean : 0;
  const continuity = 1 - Math.min(1, average(neighborDiffs) / Math.max(8, heightStats.median));
  const tallThreshold = Math.max(heightStats.p75 * 1.65, heightStats.median + 35);
  const tall = entries.filter((entry) => entry.height >= tallThreshold);
  const isolatedTowers = tall.filter((tower) => nearestTallDistance(tower.center, tall.map((entry) => entry.center)) > 220).length;
  const downtown = entries.filter((entry) => entry.district === "Downtown");
  const outer = entries.filter((entry) => entry.district !== "Downtown");
  const districtGradient = average(downtown.map((entry) => entry.height)) / Math.max(1, average(outer.map((entry) => entry.height)));
  const landmarkProminence = landmarkProminenceScore(scene, heightStats.p75);
  const parkEdgeReduction = parkEdgeHeightReduction(scene, entries);
  const peakCount = skylinePeakCount(entries, tallThreshold);
  const score = scoreAverage([
    targetRangeScore(skylineVariation, 0.22, 1.25),
    clamp01(continuity),
    targetRangeScore(isolatedTowers, 0, 2),
    targetRangeScore(districtGradient, 1.12, 3.6),
    landmarkProminence,
    parkEdgeReduction,
    targetRangeScore(peakCount, 1, 9)
  ]);
  const warnings: string[] = [];
  if (isolatedTowers > 2) {
    warnings.push(`${isolatedTowers} isolated towers detected`);
  }
  if (skylineVariation < 0.12) {
    warnings.push("Skyline is too flat");
  }
  if (districtGradient > 4.2) {
    warnings.push("Downtown height gradient is too abrupt");
  }
  return {
    key: "skyline",
    label: "Skyline metrics",
    score: round(score),
    warnings,
    metrics: [
      {key: "neighboringHeightDifference", label: "Neighboring height difference", value: round(average(neighborDiffs)), unit: "m", score: clamp01(continuity)},
      {key: "skylineVariation", label: "Skyline variation", value: round(skylineVariation), score: targetRangeScore(skylineVariation, 0.22, 1.25)},
      {key: "localHeightContinuity", label: "Local height continuity", value: round(continuity), score: clamp01(continuity)},
      {key: "tallBuildingClustering", label: "Tall-building clustering", value: round(1 - safeRatio(isolatedTowers, Math.max(1, tall.length))), score: targetRangeScore(isolatedTowers, 0, 2)},
      {key: "isolatedTowerCount", label: "Isolated tower count", value: isolatedTowers, score: targetRangeScore(isolatedTowers, 0, 2)},
      {key: "districtHeightGradient", label: "District height gradient", value: round(districtGradient), score: targetRangeScore(districtGradient, 1.12, 3.6)},
      {key: "landmarkProminence", label: "Landmark prominence", value: round(landmarkProminence), score: landmarkProminence},
      {key: "parkEdgeHeightReduction", label: "Park-edge height reduction", value: round(parkEdgeReduction), score: parkEdgeReduction},
      {key: "skylinePeakCount", label: "Skyline peak count", value: peakCount, score: targetRangeScore(peakCount, 1, 9)}
    ],
    details: {
      height: heightStats,
      tallThreshold: round(tallThreshold)
    }
  };
}

function neighborHeightDifferences(entries: Array<{center: Vec2; height: number}>): number[] {
  return entries.map((entry, index) => {
    const neighbors = entries
      .map((other, otherIndex) => otherIndex === index ? undefined : {
        distance: Math.hypot(entry.center[0] - other.center[0], entry.center[1] - other.center[1]),
        height: other.height
      })
      .filter(Boolean) as Array<{distance: number; height: number}>;
    neighbors.sort((a, b) => a.distance - b.distance);
    const near = neighbors.slice(0, 4);
    return near.length ? average(near.map((neighbor) => Math.abs(entry.height - neighbor.height))) : 0;
  });
}

function nearestTallDistance(center: Vec2, centers: Vec2[]): number {
  let min = Infinity;
  for (const other of centers) {
    const d = Math.hypot(center[0] - other[0], center[1] - other[1]);
    if (d > 1) {
      min = Math.min(min, d);
    }
  }
  return min;
}

function skylinePeakCount(entries: Array<{center: Vec2; height: number}>, threshold: number): number {
  const peaks = entries.filter((entry) => entry.height >= threshold && entries.every((other) => {
    const d = Math.hypot(entry.center[0] - other.center[0], entry.center[1] - other.center[1]);
    return d > 130 || entry.height >= other.height * 0.95;
  }));
  return peaks.length;
}

function landmarkProminenceScore(scene: CityScene, heightReference: number): number {
  const landmarkHeights = scene.objects
    .filter((object) => object.layerId === "landmarks")
    .map((object) => Number(object.metadata.height || object.metadata.towerHeight || 0))
    .filter((height) => height > 0);
  if (!landmarkHeights.length) {
    return 0.55;
  }
  return targetRangeScore(Math.max(...landmarkHeights) / Math.max(1, heightReference), 0.65, 2.2);
}

function parkEdgeHeightReduction(scene: CityScene, entries: Array<{center: Vec2; height: number}>): number {
  const parks = scene.blocks.filter((block) => block.openSpace);
  if (!parks.length || !entries.length) {
    return 0.65;
  }
  const nearPark = entries.filter((entry) => parks.some((park) => Math.hypot(entry.center[0] - park.center[0], entry.center[1] - park.center[1]) < 170));
  if (!nearPark.length) {
    return 0.55;
  }
  const nearHeight = average(nearPark.map((entry) => entry.height));
  const allHeight = average(entries.map((entry) => entry.height));
  return targetRangeScore(safeRatio(nearHeight, allHeight), 0.45, 1.05);
}

function metadataPoint(value: unknown): Vec2 | undefined {
  return Array.isArray(value) && Number.isFinite(value[0]) && Number.isFinite(value[1])
    ? [Number(value[0]), Number(value[1])]
    : undefined;
}
