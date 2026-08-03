import type {ComparisonReport} from "../report/ComparisonReport";
import type {ValidationReport} from "../validation/CityValidator";
import type {CityScene, EvaluationPresetName} from "../types";
import type {EvaluationSummary} from "../evaluation/EvaluationReport";

export const benchmarkSeeds = [7, 19, 42, 73, 101, 256, 512, 1024] as const;

export type BenchmarkMode = "baseline" | "evaluated";

export interface CalibrationThresholds {
  minimumScores: Record<string, number>;
  maximumValues: Record<string, number>;
}

export interface CalibrationConfig {
  profile: string;
  seeds: number[];
  size: number;
  buildingCount: number;
  density: "medium" | "high";
  evaluationPreset: EvaluationPresetName;
  outputDir: string;
  runAblation: boolean;
  runWeightSearch: boolean;
  captureVisuals: boolean;
  visualSeeds: number[];
  regression: boolean;
  updateBaseline: boolean;
  thresholds: CalibrationThresholds;
}

export interface NumericDistribution {
  count: number;
  min: number;
  p25: number;
  median: number;
  p75: number;
  max: number;
  mean: number;
}

export interface MetricValue {
  key: string;
  label: string;
  value: number;
  unit?: string;
  score?: number;
  warning?: string;
}

export interface MetricGroupResult {
  key: string;
  label: string;
  score: number;
  metrics: MetricValue[];
  warnings: string[];
  details?: Record<string, unknown>;
}

export interface CollectedCityMetrics {
  overallScore: number;
  profileFit: number;
  spatialQuality: number;
  patternScore: number;
  diversityScore: number;
  skylineScore: number;
  validityScore: number;
  performanceScore: number;
  hardFailures: string[];
  warnings: string[];
  groups: {
    roads: MetricGroupResult;
    blocks: MetricGroupResult;
    parcels: MetricGroupResult;
    buildings: MetricGroupResult;
    skyline: MetricGroupResult;
    patterns: MetricGroupResult;
    diversity: MetricGroupResult;
    performance: MetricGroupResult;
    profile: MetricGroupResult;
  };
}

export interface BenchmarkRun {
  seed: number;
  mode: BenchmarkMode;
  profile: string;
  size: number;
  buildingCount: number;
  evaluationPreset: EvaluationPresetName;
  disabledEvaluator?: string;
  weightSetName?: string;
  generationSeconds: number;
  memoryDeltaMb: number;
  stats: CityScene["stats"];
  evaluationSummary: EvaluationSummary;
  validation: ValidationReport;
  comparison: ComparisonReport;
  metrics: CollectedCityMetrics;
  fingerprint: string;
}

export interface BaselineComparison {
  seed: number;
  baseline: BenchmarkRun;
  evaluated: BenchmarkRun;
  changes: Record<string, number>;
  warnings: string[];
}

export interface AblationResult {
  evaluator: string;
  averageScore: number;
  averageDeltaFromEvaluated: number;
  worstScore: number;
  generationSeconds: number;
  warnings: string[];
}

export interface WeightSearchResult {
  name: string;
  weights: Record<string, number>;
  averageScore: number;
  worstScore: number;
  averageGenerationSeconds: number;
  hardFailureCount: number;
}

export interface CalibrationReport {
  schema: "xeokit-procedural-city-calibration/1.0";
  generatedAt: "deterministic";
  config: CalibrationConfig;
  aggregate: {
    baselineAverage: number;
    evaluatedAverage: number;
    evaluatedWorst: number;
    profileFitAverage: number;
    patternAverage: number;
    skylineAverage: number;
    validityAverage: number;
    performanceAverage: number;
    generationSecondsAverage: number;
    hardFailureCount: number;
  };
  comparisons: BaselineComparison[];
  ablations: AblationResult[];
  weightSearch: WeightSearchResult[];
  recommendedWeights?: Record<string, number>;
  regression: {
    ok: boolean;
    failures: string[];
    warnings: string[];
  };
  visualComparisons: Array<{
    seed: number;
    files: Array<{view: string; baseline: string; evaluated: string}>;
  }>;
}
