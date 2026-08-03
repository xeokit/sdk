import type {CityScene} from "../types";
import type {ComparisonReport} from "../report/ComparisonReport";
import type {ValidationReport} from "../validation/CityValidator";
import type {EvaluationSummary} from "../evaluation/EvaluationReport";
import type {CollectedCityMetrics, MetricGroupResult} from "./CalibrationReport";
import {collectRoadMetrics} from "./metrics/RoadMetrics";
import {collectBlockMetrics} from "./metrics/BlockMetrics";
import {collectParcelMetrics} from "./metrics/ParcelMetrics";
import {collectBuildingMetrics} from "./metrics/BuildingMetrics";
import {collectSkylineMetrics} from "./metrics/SkylineMetrics";
import {collectPatternMetrics} from "./metrics/PatternMetrics";
import {collectDiversityMetrics} from "./metrics/DiversityMetrics";
import {collectPerformanceMetrics} from "./metrics/PerformanceMetrics";
import {createProfileComparisonGroup} from "./ProfileComparator";
import {clamp01, round, scoreAverage} from "./metrics/MetricUtils";

export interface MetricCollectorInput {
  generationSeconds: number;
  memoryDeltaMb: number;
  comparison: ComparisonReport;
  validation: ValidationReport;
  evaluationSummary: EvaluationSummary;
}

export function collectCityMetrics(scene: CityScene, input: MetricCollectorInput): CollectedCityMetrics {
  const roads = collectRoadMetrics(scene);
  const blocks = collectBlockMetrics(scene);
  const parcels = collectParcelMetrics(scene);
  const buildings = collectBuildingMetrics(scene);
  const skyline = collectSkylineMetrics(scene);
  const patterns = collectPatternMetrics(scene);
  const diversity = collectDiversityMetrics(scene);
  const performance = collectPerformanceMetrics(scene, {
    generationSeconds: input.generationSeconds,
    memoryDeltaMb: input.memoryDeltaMb,
    evaluationSummary: input.evaluationSummary
  });
  const profile = createProfileComparisonGroup(input.comparison);
  const validityScore = validityFromValidation(input.validation, buildings, parcels, performance);
  const hardFailures = hardFailuresFrom(input.validation, buildings, parcels, skyline, performance);
  const spatialQuality = scoreAverage([roads.score, blocks.score, parcels.score, buildings.score]);
  const overallScore = scoreAverage([
    profile.score * 1.05,
    spatialQuality * 1.15,
    patterns.score,
    diversity.score * 0.85,
    skyline.score,
    validityScore * 1.35,
    performance.score * 0.72
  ]);
  const warnings = [
    ...profile.warnings,
    ...roads.warnings,
    ...blocks.warnings,
    ...parcels.warnings,
    ...buildings.warnings,
    ...skyline.warnings,
    ...patterns.warnings,
    ...diversity.warnings,
    ...performance.warnings,
    ...input.validation.warnings
  ];
  return {
    overallScore: round(overallScore),
    profileFit: profile.score,
    spatialQuality: round(spatialQuality),
    patternScore: patterns.score,
    diversityScore: diversity.score,
    skylineScore: skyline.score,
    validityScore: round(validityScore),
    performanceScore: performance.score,
    hardFailures,
    warnings: Array.from(new Set(warnings)),
    groups: {
      roads,
      blocks,
      parcels,
      buildings,
      skyline,
      patterns,
      diversity,
      performance,
      profile
    }
  };
}

export function metricValue(group: MetricGroupResult, key: string): number {
  return group.metrics.find((metric) => metric.key === key)?.value ?? 0;
}

function validityFromValidation(
  validation: ValidationReport,
  buildings: MetricGroupResult,
  parcels: MetricGroupResult,
  performance: MetricGroupResult
): number {
  const validationScore = validation.checks.length
    ? validation.checks.filter((check) => check.ok).length / validation.checks.length
    : 0;
  const overlapPenalty = metricValue(buildings, "buildingRoadOverlaps") > 0.04 || metricValue(buildings, "buildingOverlapCount") > 0 ? 0.25 : 0;
  const unusablePenalty = clamp01(metricValue(parcels, "unusableParcelRatio") / 0.08) * 0.22;
  const trianglePenalty = metricValue(performance, "triangleCount") > 2_000_000 ? 0.25 : 0;
  return clamp01(validationScore - overlapPenalty - unusablePenalty - trianglePenalty);
}

function hardFailuresFrom(
  validation: ValidationReport,
  buildings: MetricGroupResult,
  parcels: MetricGroupResult,
  skyline: MetricGroupResult,
  performance: MetricGroupResult
): string[] {
  const failures: string[] = [];
  for (const check of validation.checks) {
    if (!check.ok) {
      failures.push(check.key);
    }
  }
  if (metricValue(buildings, "buildingRoadOverlaps") > 0.04) {
    failures.push("buildingRoadOverlaps");
  }
  if (metricValue(parcels, "unusableParcelRatio") > 0.08) {
    failures.push("unusableParcelRatio");
  }
  if (metricValue(skyline, "isolatedTowerCount") > 4) {
    failures.push("isolatedTowerCount");
  }
  if (metricValue(performance, "triangleCount") > 2_000_000) {
    failures.push("triangleBudget");
  }
  return Array.from(new Set(failures));
}
