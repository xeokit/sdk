import type {NumericDistribution} from "../CalibrationReport";
import type {Vec2} from "../../types";

export function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(1, value));
}

export function round(value: number, precision = 3): number {
  const f = 10 ** precision;
  return Math.round(value * f) / f;
}

export function safeRatio(numerator: number, denominator: number): number {
  return denominator > 0 ? numerator / denominator : 0;
}

export function distribution(values: number[]): NumericDistribution {
  const clean = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  if (!clean.length) {
    return {count: 0, min: 0, p25: 0, median: 0, p75: 0, max: 0, mean: 0};
  }
  return {
    count: clean.length,
    min: round(clean[0]),
    p25: round(percentile(clean, 0.25)),
    median: round(percentile(clean, 0.5)),
    p75: round(percentile(clean, 0.75)),
    max: round(clean[clean.length - 1]),
    mean: round(clean.reduce((sum, value) => sum + value, 0) / clean.length)
  };
}

export function percentile(sortedValues: number[], t: number): number {
  if (!sortedValues.length) {
    return 0;
  }
  const position = (sortedValues.length - 1) * clamp01(t);
  const lo = Math.floor(position);
  const hi = Math.ceil(position);
  return lo === hi ? sortedValues[lo] : sortedValues[lo] + (sortedValues[hi] - sortedValues[lo]) * (position - lo);
}

export function differenceScore(generated: number, target: number | undefined, tolerance = 0.35): number {
  if (!Number.isFinite(generated) || !Number.isFinite(target) || Math.abs(Number(target)) < 1e-9) {
    return 0.65;
  }
  const diff = Math.abs(generated - Number(target)) / Math.max(Math.abs(Number(target)), 1e-9);
  return clamp01(1 - diff / Math.max(0.05, tolerance));
}

export function targetRangeScore(value: number, low: number, high: number): number {
  if (value >= low && value <= high) {
    return 1;
  }
  const distance = value < low ? low - value : value - high;
  return clamp01(1 - distance / Math.max(0.01, high - low));
}

export function entropy(values: number[], bucketCount: number): number {
  if (!values.length || bucketCount <= 1) {
    return 0;
  }
  const buckets = new Array(bucketCount).fill(0);
  for (const value of values) {
    const i = Math.max(0, Math.min(bucketCount - 1, Math.floor(value * bucketCount)));
    buckets[i]++;
  }
  const total = values.length;
  let result = 0;
  for (const count of buckets) {
    if (!count) {
      continue;
    }
    const p = count / total;
    result -= p * Math.log2(p);
  }
  return clamp01(result / Math.log2(bucketCount));
}

export function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

export function bounds(points: Vec2[]): [number, number, number, number] {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const point of points) {
    minX = Math.min(minX, point[0]);
    minY = Math.min(minY, point[1]);
    maxX = Math.max(maxX, point[0]);
    maxY = Math.max(maxY, point[1]);
  }
  return [minX, minY, maxX, maxY];
}

export function bboxArea(b: [number, number, number, number]): number {
  return Math.max(0, b[2] - b[0]) * Math.max(0, b[3] - b[1]);
}

export function aspectFromBounds(b: [number, number, number, number]): number {
  const w = Math.max(0.001, b[2] - b[0]);
  const h = Math.max(0.001, b[3] - b[1]);
  return Math.max(w, h) / Math.min(w, h);
}

export function average(values: number[]): number {
  const clean = values.filter((value) => Number.isFinite(value));
  return clean.length ? clean.reduce((sum, value) => sum + value, 0) / clean.length : 0;
}

export function scoreAverage(scores: number[]): number {
  return clamp01(average(scores));
}
