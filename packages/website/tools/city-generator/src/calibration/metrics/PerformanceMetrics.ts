import type {CityScene} from "../../types";
import type {EvaluationSummary} from "../../evaluation/EvaluationReport";
import type {MetricGroupResult} from "../CalibrationReport";
import {round, scoreAverage, targetRangeScore} from "./MetricUtils";

export interface PerformanceMetricInput {
  generationSeconds: number;
  memoryDeltaMb: number;
  evaluationSummary: EvaluationSummary;
}

export function collectPerformanceMetrics(scene: CityScene, input: PerformanceMetricInput): MetricGroupResult {
  const evaluationCount = input.evaluationSummary.count;
  const objectCount = scene.objects.length;
  const geometryResourceCount = scene.objects.reduce((sum, object) => sum + object.meshes.length, 0);
  const materialCount = scene.materials.length;
  const estimatedXGFSizeMb = Math.round(scene.stats.triangles * 42 / 1024 / 1024 * 100) / 100;
  const score = scoreAverage([
    targetRangeScore(input.generationSeconds, 0, 8),
    targetRangeScore(input.memoryDeltaMb, 0, 700),
    targetRangeScore(scene.stats.triangles, 1, 2_000_000),
    targetRangeScore(objectCount, 1, 15_000),
    targetRangeScore(geometryResourceCount, 1, 80_000)
  ]);
  const warnings: string[] = [];
  if (input.generationSeconds > 8) {
    warnings.push(`Generation time exceeds 8 s (${round(input.generationSeconds)} s)`);
  }
  if (scene.stats.triangles > 2_000_000) {
    warnings.push(`Triangle count exceeds budget (${scene.stats.triangles})`);
  }
  return {
    key: "performance",
    label: "Performance metrics",
    score: round(score),
    warnings,
    metrics: [
      {key: "generationTimeSeconds", label: "Generation time", value: round(input.generationSeconds), unit: "s", score: targetRangeScore(input.generationSeconds, 0, 8)},
      {key: "evaluationDecisionCount", label: "Evaluation decision count", value: evaluationCount},
      {key: "candidateCount", label: "Candidate count", value: candidateCount(scene)},
      {key: "retryCount", label: "Retry count", value: retryCount(scene)},
      {key: "memoryDeltaMb", label: "Memory delta", value: round(input.memoryDeltaMb), unit: "MB", score: targetRangeScore(input.memoryDeltaMb, 0, 700)},
      {key: "triangleCount", label: "Triangle count", value: scene.stats.triangles, score: targetRangeScore(scene.stats.triangles, 1, 2_000_000)},
      {key: "objectCount", label: "Object count", value: objectCount, score: targetRangeScore(objectCount, 1, 15_000)},
      {key: "geometryResourceCount", label: "Geometry resource count", value: geometryResourceCount, score: targetRangeScore(geometryResourceCount, 1, 80_000)},
      {key: "materialCount", label: "Material count", value: materialCount, score: targetRangeScore(materialCount, 1, 48)},
      {key: "estimatedXGFSizeMb", label: "Estimated XGF size", value: estimatedXGFSizeMb, unit: "MB"}
    ]
  };
}

function candidateCount(scene: CityScene): number {
  return (scene.evaluationReports || []).reduce((sum, report) => sum + report.candidateCount, 0);
}

function retryCount(scene: CityScene): number {
  return (scene.evaluationReports || []).reduce((sum, report) => sum + Math.max(0, report.attemptCount - 1), 0);
}
