import type {BaselineComparison, BenchmarkRun, CalibrationReport, CalibrationThresholds} from "./CalibrationReport";
import {average, round} from "./metrics/MetricUtils";

export function detectRegressions(
  comparisons: BaselineComparison[],
  evaluatedRuns: BenchmarkRun[],
  thresholds: CalibrationThresholds,
  deterministicMismatch = false
): CalibrationReport["regression"] {
  const failures: string[] = [];
  const warnings: string[] = [];
  if (deterministicMismatch) {
    failures.push("Deterministic repeat fingerprint mismatch");
  }
  const aggregateScores = {
    profileFit: average(evaluatedRuns.map((run) => run.metrics.profileFit)),
    patternFit: average(evaluatedRuns.map((run) => run.metrics.patternScore)),
    skyline: average(evaluatedRuns.map((run) => run.metrics.skylineScore)),
    validity: average(evaluatedRuns.map((run) => run.metrics.validityScore)),
    overall: average(evaluatedRuns.map((run) => run.metrics.overallScore))
  };
  for (const [key, minimum] of Object.entries(thresholds.minimumScores)) {
    const value = aggregateScores[key as keyof typeof aggregateScores];
    if (Number.isFinite(value) && value < minimum) {
      failures.push(`${key} average score ${round(value)} is below ${minimum}`);
    }
  }
  const worstValidity = Math.min(...evaluatedRuns.map((run) => run.metrics.validityScore));
  if (worstValidity < (thresholds.minimumScores.validity || 0.98) - 0.08) {
    failures.push(`Worst-case validity ${round(worstValidity)} is below tolerance`);
  }
  const maxValues = {
    unusableParcelRatio: maxMetric(evaluatedRuns, "parcels", "unusableParcelRatio"),
    buildingRoadOverlaps: maxMetric(evaluatedRuns, "buildings", "buildingRoadOverlaps"),
    isolatedTowerCount: maxMetric(evaluatedRuns, "skyline", "isolatedTowerCount"),
    generationTimeSeconds: Math.max(...evaluatedRuns.map((run) => run.generationSeconds)),
    triangleCount: Math.max(...evaluatedRuns.map((run) => run.stats.triangles))
  };
  for (const [key, maximum] of Object.entries(thresholds.maximumValues)) {
    const value = maxValues[key as keyof typeof maxValues];
    if (Number.isFinite(value) && value > maximum) {
      failures.push(`${key} maximum ${round(value)} exceeds ${maximum}`);
    }
  }
  for (const run of evaluatedRuns) {
    for (const hardFailure of run.metrics.hardFailures) {
      failures.push(`Seed ${run.seed}: hard failure ${hardFailure}`);
    }
  }
  const losingSeeds = comparisons.filter((comparison) => comparison.evaluated.metrics.overallScore < comparison.baseline.metrics.overallScore);
  if (losingSeeds.length) {
    warnings.push(`Evaluated output underperformed baseline for seeds: ${losingSeeds.map((comparison) => comparison.seed).join(", ")}`);
  }
  return {
    ok: failures.length === 0,
    failures: Array.from(new Set(failures)),
    warnings: Array.from(new Set(warnings))
  };
}

function maxMetric(runs: BenchmarkRun[], group: keyof BenchmarkRun["metrics"]["groups"], key: string): number {
  return Math.max(...runs.map((run) => run.metrics.groups[group].metrics.find((metric) => metric.key === key)?.value ?? 0));
}
