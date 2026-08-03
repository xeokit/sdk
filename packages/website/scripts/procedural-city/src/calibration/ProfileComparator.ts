import type {ComparisonReport} from "../report/ComparisonReport";
import type {MetricGroupResult, MetricValue} from "./CalibrationReport";
import {clamp01, round, scoreAverage} from "./metrics/MetricUtils";

export function createProfileComparisonGroup(comparison: ComparisonReport): MetricGroupResult {
  const metrics: MetricValue[] = comparison.metrics.map((metric) => {
    const score = metric.differencePercent === null
      ? 0.65
      : clamp01(1 - Math.abs(metric.differencePercent) / Math.max(1, metric.tolerancePercent));
    return {
      key: metric.key,
      label: metric.label,
      value: metric.generated ?? 0,
      unit: metric.unit,
      score: round(score),
      warning: metric.warning
    };
  });
  const score = scoreAverage(metrics.map((metric) => metric.score ?? 0.65));
  return {
    key: "profile",
    label: "OSM profile fit",
    score: round(score),
    metrics,
    warnings: comparison.warnings,
    details: {
      source: comparison.metrics.map((metric) => ({
        key: metric.key,
        source: metric.source,
        generated: metric.generated,
        differencePercent: metric.differencePercent,
        tolerancePercent: metric.tolerancePercent
      }))
    }
  };
}
