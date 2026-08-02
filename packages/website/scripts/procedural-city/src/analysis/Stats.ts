import type {DistributionProfile, Vec2} from "../types";

export function distribution(values: number[], fallback: DistributionProfile = {}): DistributionProfile {
  const clean = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  if (clean.length === 0) {
    return fallback;
  }
  const mean = clean.reduce((sum, value) => sum + value, 0) / clean.length;
  const variance = clean.reduce((sum, value) => sum + (value - mean) ** 2, 0) / clean.length;
  return {
    min: round(clean[0]),
    max: round(clean[clean.length - 1]),
    mean: round(mean),
    median: round(quantile(clean, 0.5)),
    p05: round(quantile(clean, 0.05)),
    p25: round(quantile(clean, 0.25)),
    p75: round(quantile(clean, 0.75)),
    p95: round(quantile(clean, 0.95)),
    stdDev: round(Math.sqrt(variance))
  };
}

export function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) {
    return 0;
  }
  const index = Math.max(0, Math.min(sorted.length - 1, (sorted.length - 1) * q));
  const lo = Math.floor(index);
  const hi = Math.ceil(index);
  if (lo === hi) {
    return sorted[lo];
  }
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (index - lo);
}

export function round(value: number, digits = 3): number {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

export function normalizeShares<T extends string>(counts: Partial<Record<T, number>>): Partial<Record<T, number>> {
  const total = Object.values(counts).reduce((sum, value) => sum + Number(value || 0), 0);
  if (total <= 0) {
    return counts;
  }
  const result: Partial<Record<T, number>> = {};
  for (const [key, value] of Object.entries(counts)) {
    result[key as T] = round(Number(value || 0) / total, 4);
  }
  return result;
}

export function lineLength(points: Vec2[]): number {
  let length = 0;
  for (let i = 1; i < points.length; i++) {
    length += distance(points[i - 1], points[i]);
  }
  return length;
}

export function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

export function polygonArea(points: Vec2[]): number {
  let area = 0;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    area += (points[j][0] + points[i][0]) * (points[j][1] - points[i][1]);
  }
  return Math.abs(area / 2);
}

export function polygonPerimeter(points: Vec2[]): number {
  let perimeter = 0;
  for (let i = 0; i < points.length; i++) {
    perimeter += distance(points[i], points[(i + 1) % points.length]);
  }
  return perimeter;
}

export function bbox(points: Vec2[]): [number, number, number, number] {
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

export function aspectRatio(points: Vec2[]): number {
  const [minX, minY, maxX, maxY] = bbox(points);
  const width = Math.max(0.001, maxX - minX);
  const depth = Math.max(0.001, maxY - minY);
  return Math.max(width, depth) / Math.min(width, depth);
}

export function compactness(points: Vec2[]): number {
  const area = polygonArea(points);
  const perimeter = polygonPerimeter(points);
  if (perimeter <= 0) {
    return 0;
  }
  return Math.min(1, (4 * Math.PI * area) / (perimeter * perimeter));
}

export function centroid(points: Vec2[]): Vec2 {
  if (points.length === 0) {
    return [0, 0];
  }
  const sum = points.reduce<Vec2>((acc, point) => [acc[0] + point[0], acc[1] + point[1]], [0, 0]);
  return [sum[0] / points.length, sum[1] / points.length];
}

export function nearestSpacing(points: Vec2[], sampleLimit = 500): number[] {
  const sample = points.length > sampleLimit ? points.filter((_point, index) => index % Math.ceil(points.length / sampleLimit) === 0) : points;
  const spacings: number[] = [];
  for (let i = 0; i < sample.length; i++) {
    let nearest = Infinity;
    for (let j = 0; j < sample.length; j++) {
      if (i !== j) {
        nearest = Math.min(nearest, distance(sample[i], sample[j]));
      }
    }
    if (Number.isFinite(nearest)) {
      spacings.push(nearest);
    }
  }
  return spacings;
}
