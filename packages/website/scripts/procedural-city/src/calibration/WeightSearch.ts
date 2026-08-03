import type {AblationResult, CalibrationConfig, WeightSearchResult} from "./CalibrationReport";
import type {BenchmarkRun} from "./CalibrationReport";
import {runBenchmark} from "./BenchmarkSuite";
import {average, round} from "./metrics/MetricUtils";

export const evaluatorNames = [
  "Walkability",
  "Block Quality",
  "Pattern Fit",
  "Profile Fit",
  "Skyline",
  "Variety",
  "Landmark Quality"
];

export const candidateWeightSets: Array<{name: string; weights: Record<string, number>}> = [
  {
    name: "balanced-default",
    weights: {}
  },
  {
    name: "profile-fit-heavy",
    weights: {
      "Profile Fit": 1.25,
      "Pattern Fit": 1.05,
      "Walkability": 1,
      "Skyline": 0.75,
      "Variety": 0.65
    }
  },
  {
    name: "spatial-quality-heavy",
    weights: {
      "Walkability": 1.25,
      "Block Quality": 1.2,
      "Pattern Fit": 1,
      "Profile Fit": 0.8,
      "Skyline": 0.8
    }
  },
  {
    name: "skyline-and-variety",
    weights: {
      "Skyline": 1.2,
      "Variety": 1.05,
      "Pattern Fit": 0.95,
      "Profile Fit": 0.85,
      "Landmark Quality": 0.9
    }
  },
  {
    name: "validity-conservative",
    weights: {
      "Walkability": 1.1,
      "Block Quality": 1.1,
      "Profile Fit": 1,
      "Pattern Fit": 1,
      "Skyline": 0.72,
      "Variety": 0.55,
      "Landmark Quality": 0.55
    }
  }
];

export async function runAblations(config: CalibrationConfig, referenceRuns: BenchmarkRun[]): Promise<AblationResult[]> {
  const results: AblationResult[] = [];
  for (const evaluator of evaluatorNames) {
    const runs: BenchmarkRun[] = [];
    for (const seed of config.seeds) {
      runs.push(await runBenchmark({
        seed,
        mode: "evaluated",
        profile: config.profile,
        size: config.size,
        buildingCount: config.buildingCount,
        density: config.density,
        evaluationPreset: config.evaluationPreset,
        disabledEvaluator: evaluator
      }));
    }
    const deltas = runs.map((run) => {
      const ref = referenceRuns.find((candidate) => candidate.seed === run.seed);
      return run.metrics.overallScore - (ref?.metrics.overallScore || 0);
    });
    results.push({
      evaluator,
      averageScore: round(average(runs.map((run) => run.metrics.overallScore))),
      averageDeltaFromEvaluated: round(average(deltas)),
      worstScore: round(Math.min(...runs.map((run) => run.metrics.overallScore))),
      generationSeconds: round(average(runs.map((run) => run.generationSeconds))),
      warnings: ablationWarnings(evaluator, deltas)
    });
  }
  return results;
}

export async function searchWeights(config: CalibrationConfig): Promise<WeightSearchResult[]> {
  const results: WeightSearchResult[] = [];
  for (const set of candidateWeightSets) {
    const runs: BenchmarkRun[] = [];
    for (const seed of config.seeds) {
      runs.push(await runBenchmark({
        seed,
        mode: "evaluated",
        profile: config.profile,
        size: config.size,
        buildingCount: config.buildingCount,
        density: config.density,
        evaluationPreset: config.evaluationPreset,
        weights: normalizeWeights(set.weights),
        weightSetName: set.name
      }));
    }
    results.push({
      name: set.name,
      weights: normalizeWeights(set.weights),
      averageScore: round(average(runs.map((run) => run.metrics.overallScore))),
      worstScore: round(Math.min(...runs.map((run) => run.metrics.overallScore))),
      averageGenerationSeconds: round(average(runs.map((run) => run.generationSeconds))),
      hardFailureCount: runs.reduce((sum, run) => sum + run.metrics.hardFailures.length, 0)
    });
  }
  return results.sort((a, b) => {
    if (a.hardFailureCount !== b.hardFailureCount) {
      return a.hardFailureCount - b.hardFailureCount;
    }
    if (b.worstScore !== a.worstScore) {
      return b.worstScore - a.worstScore;
    }
    return b.averageScore - a.averageScore;
  });
}

export function recommendedWeights(results: WeightSearchResult[]): Record<string, number> | undefined {
  return results[0]?.weights;
}

function normalizeWeights(weights: Record<string, number>): Record<string, number> {
  const values = Object.values(weights).filter((value) => Number.isFinite(value) && value > 0);
  if (!values.length) {
    return weights;
  }
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const normalized: Record<string, number> = {};
  for (const [key, value] of Object.entries(weights)) {
    normalized[key] = round(value / mean);
  }
  return normalized;
}

function ablationWarnings(evaluator: string, deltas: number[]): string[] {
  const avg = average(deltas);
  if (avg > 0.015) {
    return [`Disabling ${evaluator} improved aggregate score; inspect evaluator weight or overlap`];
  }
  if (Math.abs(avg) < 0.004) {
    return [`Disabling ${evaluator} made little measurable difference`];
  }
  return [];
}
