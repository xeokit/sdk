import {performance} from "node:perf_hooks";
import crypto from "node:crypto";
import type {BenchmarkMode, BenchmarkRun, CalibrationConfig} from "./CalibrationReport";
import type {EvaluationPresetName} from "../types";
import {generateCity} from "../generator/CityGenerator";
import {createComparisonReport} from "../report/ComparisonReport";
import {validateCity} from "../validation/CityValidator";
import {summarizeEvaluationReports} from "../evaluation/EvaluationReport";
import {collectCityMetrics} from "./MetricCollector";

export interface BenchmarkRunOptions {
  seed: number;
  mode: BenchmarkMode;
  profile: string;
  size: number;
  buildingCount: number;
  density: "medium" | "high";
  evaluationPreset: EvaluationPresetName;
  weights?: Record<string, number>;
  disabledEvaluator?: string;
  weightSetName?: string;
}

export async function runBenchmarkSuite(config: CalibrationConfig): Promise<{
  baseline: BenchmarkRun[];
  evaluated: BenchmarkRun[];
}> {
  const baseline: BenchmarkRun[] = [];
  const evaluated: BenchmarkRun[] = [];
  for (const seed of config.seeds) {
    baseline.push(await runBenchmark({
      seed,
      mode: "baseline",
      profile: config.profile,
      size: config.size,
      buildingCount: config.buildingCount,
      density: config.density,
      evaluationPreset: config.evaluationPreset
    }));
    evaluated.push(await runBenchmark({
      seed,
      mode: "evaluated",
      profile: config.profile,
      size: config.size,
      buildingCount: config.buildingCount,
      density: config.density,
      evaluationPreset: config.evaluationPreset
    }));
  }
  return {baseline, evaluated};
}

export async function runBenchmark(options: BenchmarkRunOptions): Promise<BenchmarkRun> {
  const beforeMemory = process.memoryUsage().heapUsed;
  const start = performance.now();
  const weights = {
    ...options.weights,
    ...(options.disabledEvaluator ? {[options.disabledEvaluator]: 0} : {})
  };
  const scene = await generateCity({
    seed: options.seed,
    size: options.size,
    density: options.density,
    buildingCount: options.buildingCount,
    profile: options.profile,
    outputPath: "./artifacts/calibration/generated.xgf",
    evaluationPreset: options.evaluationPreset,
    evaluation: {
      enabled: options.mode === "evaluated",
      weights
    }
  });
  const generationSeconds = (performance.now() - start) / 1000;
  const memoryDeltaMb = Math.max(0, (process.memoryUsage().heapUsed - beforeMemory) / 1024 / 1024);
  const comparison = createComparisonReport(scene);
  const validation = validateCity(scene);
  const evaluationSummary = summarizeEvaluationReports(scene.evaluationReports || []);
  const metrics = collectCityMetrics(scene, {
    generationSeconds,
    memoryDeltaMb,
    comparison,
    validation,
    evaluationSummary
  });
  return {
    seed: options.seed,
    mode: options.mode,
    profile: scene.config.profileData?.name || options.profile,
    size: options.size,
    buildingCount: options.buildingCount,
    evaluationPreset: options.evaluationPreset,
    disabledEvaluator: options.disabledEvaluator,
    weightSetName: options.weightSetName,
    generationSeconds: round(generationSeconds),
    memoryDeltaMb: round(memoryDeltaMb),
    stats: scene.stats,
    evaluationSummary,
    validation,
    comparison,
    metrics,
    fingerprint: fingerprintRun(scene, metrics)
  };
}

export function compareBaselineRuns(baseline: BenchmarkRun[], evaluated: BenchmarkRun[]) {
  return evaluated.map((evaluatedRun) => {
    const baselineRun = baseline.find((run) => run.seed === evaluatedRun.seed);
    if (!baselineRun) {
      throw new Error(`Missing baseline run for seed ${evaluatedRun.seed}`);
    }
    const changes = {
      overallScore: deltaPercent(baselineRun.metrics.overallScore, evaluatedRun.metrics.overallScore),
      profileFit: deltaPercent(baselineRun.metrics.profileFit, evaluatedRun.metrics.profileFit),
      spatialQuality: deltaPercent(baselineRun.metrics.spatialQuality, evaluatedRun.metrics.spatialQuality),
      patternScore: deltaPercent(baselineRun.metrics.patternScore, evaluatedRun.metrics.patternScore),
      skylineScore: deltaPercent(baselineRun.metrics.skylineScore, evaluatedRun.metrics.skylineScore),
      diversityScore: deltaPercent(baselineRun.metrics.diversityScore, evaluatedRun.metrics.diversityScore),
      validityScore: deltaPercent(baselineRun.metrics.validityScore, evaluatedRun.metrics.validityScore),
      generationSeconds: deltaPercent(baselineRun.generationSeconds, evaluatedRun.generationSeconds)
    };
    const warnings = evaluatedRun.metrics.overallScore < baselineRun.metrics.overallScore
      ? [`Evaluated score is lower than baseline for seed ${evaluatedRun.seed}`]
      : [];
    return {
      seed: evaluatedRun.seed,
      baseline: baselineRun,
      evaluated: evaluatedRun,
      changes,
      warnings
    };
  });
}

function fingerprintRun(scene: Awaited<ReturnType<typeof generateCity>>, metrics: BenchmarkRun["metrics"]): string {
  const payload = {
    seed: scene.config.seed,
    profile: scene.config.profileData?.name,
    stats: scene.stats,
    scores: {
      overall: metrics.overallScore,
      profileFit: metrics.profileFit,
      spatialQuality: metrics.spatialQuality,
      skyline: metrics.skylineScore,
      validity: metrics.validityScore
    },
    districts: scene.blocks.reduce((acc, block) => {
      acc[block.district] = (acc[block.district] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  };
  return crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex").slice(0, 16);
}

function deltaPercent(before: number, after: number): number {
  if (!Number.isFinite(before) || Math.abs(before) < 1e-9) {
    return 0;
  }
  return round(((after - before) / before) * 100);
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
