import type {CityScene, Road, Vec2} from "../../types";
import type {MetricGroupResult} from "../CalibrationReport";
import {distance as pointDistance, distanceToSegment} from "../../geometry/PolygonUtils";
import {average, clamp01, differenceScore, distribution, entropy, round, safeRatio, scoreAverage, targetRangeScore} from "./MetricUtils";

export function collectRoadMetrics(scene: CityScene): MetricGroupResult {
  const roadSegments = segmentLengths(scene.roads);
  const graph = roadAdjacencyGraph(scene.roads);
  const componentCount = connectedComponentCount(graph);
  const nodeDegrees = Array.from(graph.intersectionNodes.values()).map((roads) => roads.size);
  const intersectionCount = nodeDegrees.length;
  const deadEndRatio = safeRatio(nodeDegrees.filter((degree) => degree <= 1).length, nodeDegrees.length);
  const areaKm2 = Math.max(0.001, (scene.config.size * scene.config.size) / 1_000_000);
  const orientationEntropy = roadOrientationEntropy(scene.roads);
  const directness = average(scene.roads.map(routeDirectness));
  const segmentStats = distribution(roadSegments);
  const profile = scene.config.profileData;
  const medianSegmentScore = differenceScore(segmentStats.median, profile?.roads.segmentLength?.median, 0.45);
  const intersectionDensityScore = differenceScore(intersectionCount / areaKm2, profile?.roads.intersectionDensityPerSquareKm, 0.55);
  const componentScore = componentCount <= 1 ? 1 : componentCount <= 3 ? 0.75 : 0.35;
  const deadEndScore = targetRangeScore(deadEndRatio, 0.02, 0.18);
  const entropyScore = targetRangeScore(orientationEntropy, 0.34, 0.86);
  const directnessScore = targetRangeScore(directness, 0.72, 0.98);
  const score = scoreAverage([
    componentScore * 1.35,
    deadEndScore,
    medianSegmentScore,
    intersectionDensityScore,
    entropyScore,
    directnessScore
  ]);
  const warnings: string[] = [];
  if (componentCount > 3) {
    warnings.push(`Road network has ${componentCount} connected components`);
  }
  if (deadEndRatio > 0.22) {
    warnings.push(`Dead-end ratio is high (${round(deadEndRatio)})`);
  }
  if (orientationEntropy < 0.28) {
    warnings.push("Street orientations are too uniform");
  }
  return {
    key: "roads",
    label: "Road metrics",
    score: round(score),
    warnings,
    metrics: [
      {key: "connectedComponents", label: "Connected component count", value: componentCount, score: componentScore},
      {key: "intersectionDensity", label: "Intersection density", value: round(intersectionCount / areaKm2), unit: "per km2", score: intersectionDensityScore},
      {key: "averageNodeDegree", label: "Average node degree", value: round(average(nodeDegrees)), score: targetRangeScore(average(nodeDegrees), 2.2, 3.8)},
      {key: "deadEndRatio", label: "Dead-end ratio", value: round(deadEndRatio), score: deadEndScore},
      {key: "medianSegmentLength", label: "Median segment length", value: segmentStats.median, unit: "m", score: medianSegmentScore},
      {key: "streetOrientationEntropy", label: "Street orientation entropy", value: round(orientationEntropy), score: entropyScore},
      {key: "routeDirectness", label: "Route directness", value: round(directness), score: directnessScore},
      {key: "arterialSpacing", label: "Arterial spacing", value: round(hierarchySpacing(scene.roads, "arterial")), unit: "m"},
      {key: "localStreetSpacing", label: "Local street spacing", value: round(hierarchySpacing(scene.roads, "local")), unit: "m"},
      {key: "averageBlockAccessCount", label: "Average block access count", value: round(averageBlockAccessCount(scene)), score: targetRangeScore(averageBlockAccessCount(scene), 1.2, 4.5)}
    ],
    details: {
      segmentLength: segmentStats
    }
  };
}

function segmentLengths(roads: Road[]): number[] {
  const lengths: number[] = [];
  for (const road of roads) {
    for (let i = 1; i < road.polyline.length; i++) {
      const length = pointDistance(road.polyline[i - 1], road.polyline[i]);
      if (length > 1) {
        lengths.push(length);
      }
    }
  }
  return lengths;
}

function roadAdjacencyGraph(roads: Road[]): {adjacency: Map<number, Set<number>>; intersectionNodes: Map<string, Set<number>>} {
  const adjacency = new Map<number, Set<number>>();
  const intersectionNodes = new Map<string, Set<number>>();
  for (let i = 0; i < roads.length; i++) {
    adjacency.set(i, new Set<number>());
  }
  for (let i = 0; i < roads.length; i++) {
    for (let j = i + 1; j < roads.length; j++) {
      const point = roadTouchPoint(roads[i], roads[j]);
      if (point) {
        adjacency.get(i)!.add(j);
        adjacency.get(j)!.add(i);
        const key = intersectionNodeKey(point);
        const roadsAtNode = intersectionNodes.get(key) || new Set<number>();
        roadsAtNode.add(i);
        roadsAtNode.add(j);
        intersectionNodes.set(key, roadsAtNode);
      }
    }
  }
  return {adjacency, intersectionNodes};
}

function connectedComponentCount(graph: {adjacency: Map<number, Set<number>>}): number {
  const allRoads = Array.from(graph.adjacency.keys());
  const seen = new Set<number>();
  let components = 0;
  for (const start of allRoads) {
    if (seen.has(start)) {
      continue;
    }
    components++;
    const stack = [start];
    while (stack.length) {
      const road = stack.pop()!;
      if (seen.has(road)) {
        continue;
      }
      seen.add(road);
      for (const next of graph.adjacency.get(road) || []) {
        if (!seen.has(next)) {
          stack.push(next);
        }
      }
    }
  }
  return components;
}

function roadTouchPoint(a: Road, b: Road): Vec2 | undefined {
  const threshold = Math.max(7, Math.min(18, (a.width + b.width) * 0.35));
  for (let i = 1; i < a.polyline.length; i++) {
    const a0 = a.polyline[i - 1];
    const a1 = a.polyline[i];
    for (let j = 1; j < b.polyline.length; j++) {
      const b0 = b.polyline[j - 1];
      const b1 = b.polyline[j];
      if (segmentsIntersect(a0, a1, b0, b1)) {
        return segmentIntersectionPoint(a0, a1, b0, b1);
      }
      if (distanceToSegment(a0, b0, b1) <= threshold) {
        return a0;
      }
      if (distanceToSegment(a1, b0, b1) <= threshold) {
        return a1;
      }
      if (distanceToSegment(b0, a0, a1) <= threshold) {
        return b0;
      }
      if (distanceToSegment(b1, a0, a1) <= threshold) {
        return b1;
      }
    }
  }
  return undefined;
}

function segmentsIntersect(a: Vec2, b: Vec2, c: Vec2, d: Vec2): boolean {
  const d1 = direction(c, d, a);
  const d2 = direction(c, d, b);
  const d3 = direction(a, b, c);
  const d4 = direction(a, b, d);
  return ((d1 >= 0 && d2 <= 0) || (d1 <= 0 && d2 >= 0))
    && ((d3 >= 0 && d4 <= 0) || (d3 <= 0 && d4 >= 0))
    && rangesOverlap(a[0], b[0], c[0], d[0])
    && rangesOverlap(a[1], b[1], c[1], d[1]);
}

function rangesOverlap(a: number, b: number, c: number, d: number): boolean {
  return Math.max(Math.min(a, b), Math.min(c, d)) <= Math.min(Math.max(a, b), Math.max(c, d)) + 1e-6;
}

function direction(a: Vec2, b: Vec2, c: Vec2): number {
  return (c[0] - a[0]) * (b[1] - a[1]) - (c[1] - a[1]) * (b[0] - a[0]);
}

function segmentIntersectionPoint(a: Vec2, b: Vec2, c: Vec2, d: Vec2): Vec2 {
  const x1 = a[0];
  const y1 = a[1];
  const x2 = b[0];
  const y2 = b[1];
  const x3 = c[0];
  const y3 = c[1];
  const x4 = d[0];
  const y4 = d[1];
  const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
  if (Math.abs(denom) < 1e-9) {
    return [(Math.max(Math.min(x1, x2), Math.min(x3, x4)) + Math.min(Math.max(x1, x2), Math.max(x3, x4))) / 2,
      (Math.max(Math.min(y1, y2), Math.min(y3, y4)) + Math.min(Math.max(y1, y2), Math.max(y3, y4))) / 2];
  }
  const px = ((x1 * y2 - y1 * x2) * (x3 - x4) - (x1 - x2) * (x3 * y4 - y3 * x4)) / denom;
  const py = ((x1 * y2 - y1 * x2) * (y3 - y4) - (y1 - y2) * (x3 * y4 - y3 * x4)) / denom;
  return [px, py];
}

function intersectionNodeKey(point: Vec2): string {
  const step = 18;
  return `${Math.round(point[0] / step)},${Math.round(point[1] / step)}`;
}

function roadOrientationEntropy(roads: Road[]): number {
  const orientations: number[] = [];
  for (const road of roads) {
    for (let i = 1; i < road.polyline.length; i++) {
      const a = road.polyline[i - 1];
      const b = road.polyline[i];
      const angle = Math.atan2(b[1] - a[1], b[0] - a[0]);
      const normalized = ((angle % Math.PI) + Math.PI) % Math.PI / Math.PI;
      orientations.push(normalized);
    }
  }
  return entropy(orientations, 12);
}

function routeDirectness(road: Road): number {
  let path = 0;
  for (let i = 1; i < road.polyline.length; i++) {
    path += pointDistance(road.polyline[i - 1], road.polyline[i]);
  }
  const direct = road.polyline.length > 1 ? pointDistance(road.polyline[0], road.polyline[road.polyline.length - 1]) : path;
  return clamp01(safeRatio(direct, path || direct));
}

function hierarchySpacing(roads: Road[], hierarchy: Road["hierarchy"]): number {
  const centers = roads
    .filter((road) => road.hierarchy === hierarchy)
    .map((road) => roadCenter(road));
  if (centers.length < 2) {
    return 0;
  }
  const nearest = centers.map((center, index) => {
    let d = Infinity;
    for (let i = 0; i < centers.length; i++) {
      if (i !== index) {
        d = Math.min(d, pointDistance(center, centers[i]));
      }
    }
    return d;
  });
  return distribution(nearest).median;
}

function averageBlockAccessCount(scene: CityScene): number {
  const centers = scene.roads.map(roadCenter);
  const counts = scene.blocks.map((block) => {
    const radius = Math.max(90, Math.sqrt(Math.abs(block.area)) * 1.1);
    return centers.filter((center) => pointDistance(center, block.center) <= radius).length;
  });
  return average(counts);
}

function roadCenter(road: Road): Vec2 {
  const points = road.polyline;
  const sum = points.reduce((acc, point) => [acc[0] + point[0], acc[1] + point[1]] as Vec2, [0, 0]);
  return [sum[0] / Math.max(1, points.length), sum[1] / Math.max(1, points.length)];
}
