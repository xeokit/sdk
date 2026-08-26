import type {CityProfile, RoadHierarchy, Vec2} from "../types";
import type {OSMExtract, OSMFeature} from "./OSMLoader";
import {distribution, distance, lineLength, nearestSpacing, normalizeShares, round} from "./Stats";

export interface RoadAnalysis {
  profile: CityProfile["roads"];
  roadLines: Array<{hierarchy: RoadHierarchy; points: Vec2[]; length: number; properties: Record<string, unknown>}>;
  segmentCount: number;
  nodeCount: number;
  intersections: Vec2[];
  area: number;
  bounds: [number, number, number, number];
}

const HIGHWAY_TO_HIERARCHY: Record<string, RoadHierarchy> = {
  motorway: "arterial",
  trunk: "arterial",
  primary: "arterial",
  secondary: "arterial",
  tertiary: "collector",
  residential: "local",
  unclassified: "local",
  service: "alley",
  living_street: "alley",
  pedestrian: "pedestrian",
  footway: "pedestrian",
  path: "pedestrian"
};

export function analyzeRoads(extract: OSMExtract): RoadAnalysis {
  const roadLines = roadFeatures(extract.features);
  const segmentLengths: number[] = [];
  const angles: number[] = [];
  const orientations: number[] = [];
  const curvature: number[] = [];
  const hierarchyLengths: Partial<Record<RoadHierarchy, number>> = {};
  const nodeDegree = new Map<string, number>();
  const roadSegments: Array<{roadIndex: number; a: Vec2; b: Vec2}> = [];

  for (const [roadIndex, road] of roadLines.entries()) {
    hierarchyLengths[road.hierarchy] = (hierarchyLengths[road.hierarchy] || 0) + road.length;
    const chord = distance(road.points[0], road.points[road.points.length - 1]);
    if (chord > 0.01) {
      curvature.push(road.length / chord);
    }
    for (let i = 1; i < road.points.length; i++) {
      const a = road.points[i - 1];
      const b = road.points[i];
      const length = distance(a, b);
      if (length > 1) {
        segmentLengths.push(length);
        orientations.push(orientation(a, b));
      }
      addNode(nodeDegree, a);
      addNode(nodeDegree, b);
      roadSegments.push({roadIndex, a, b});
      if (i < road.points.length - 1) {
        angles.push(turnAngle(road.points[i - 1], road.points[i], road.points[i + 1]));
      }
    }
  }
  addGeometricCrossings(nodeDegree, roadSegments);

  const degreeValues = Array.from(nodeDegree.values());
  const intersections = Array.from(nodeDegree.entries())
    .filter((entry) => entry[1] >= 3)
    .map(([key]) => key.split(",").map(Number) as Vec2);
  const area = Math.max(1, (extract.bounds[2] - extract.bounds[0]) * (extract.bounds[3] - extract.bounds[1]));
  const arterialCount = roadLines.filter((road) => road.hierarchy === "arterial").length;
  const collectorCount = roadLines.filter((road) => road.hierarchy === "collector").length;
  const arterialSpacing = spacingFromCount(area, arterialCount);
  const collectorSpacing = spacingFromCount(area, collectorCount);
  const totalRoadLengthMeters = roadLines.reduce((sum, road) => sum + road.length, 0);
  const areaKm2 = Math.max(0.001, area / 1000000);

  return {
    profile: {
      hierarchyShare: normalizeShares(hierarchyLengths),
      widthByHierarchy: inferWidths(roadLines),
      arterialSpacing: distribution(arterialSpacing, {mean: 360}),
      collectorSpacing: distribution(collectorSpacing, {mean: 150}),
      segmentLength: distribution(segmentLengths, {mean: 90}),
      intersectionAngles: distribution(angles, {mean: 85}),
      nodeDegree: distribution(degreeValues, {mean: 3}),
      streetOrientation: distribution(orientations, {mean: 90}),
      curvature: distribution(curvature, {mean: 1.08}),
      intersectionSpacing: distribution(nearestSpacing(intersections), {mean: 140}),
      intersectionDegreeWeights: degreeWeights(degreeValues),
      orientationPeaksDegrees: orientationPeaks(orientations),
      averageSpacing: round((distribution([...arterialSpacing, ...collectorSpacing], {mean: 160}).median || 160), 2),
      roadDensityKmPerSquareKm: round((totalRoadLengthMeters / 1000) / areaKm2, 3),
      intersectionDensityPerSquareKm: round(intersections.length / areaKm2, 3)
    },
    roadLines,
    segmentCount: segmentLengths.length,
    nodeCount: nodeDegree.size,
    intersections,
    area,
    bounds: extract.bounds
  };
}

function roadFeatures(features: OSMFeature[]): RoadAnalysis["roadLines"] {
  const roads: RoadAnalysis["roadLines"] = [];
  for (const feature of features) {
    const highway = String(feature.properties.highway || "");
    if (!highway || !HIGHWAY_TO_HIERARCHY[highway]) {
      continue;
    }
    const hierarchy = HIGHWAY_TO_HIERARCHY[highway];
    for (const points of lineStrings(feature.geometry)) {
      if (points.length < 2) {
        continue;
      }
      roads.push({
        hierarchy,
        points,
        length: lineLength(points),
        properties: feature.properties
      });
    }
  }
  return roads;
}

function lineStrings(geometry: OSMFeature["geometry"]): Vec2[][] {
  if (geometry.type === "LineString") {
    return [geometry.coordinates as Vec2[]];
  }
  if (geometry.type === "MultiLineString") {
    return geometry.coordinates as Vec2[][];
  }
  return [];
}

function addNode(nodes: Map<string, number>, point: Vec2): void {
  const key = nodeKey(point);
  nodes.set(key, (nodes.get(key) || 0) + 1);
}

function addGeometricCrossings(nodes: Map<string, number>, segments: Array<{roadIndex: number; a: Vec2; b: Vec2}>): void {
  const maxPairs = 7000000;
  const stride = Math.max(1, Math.ceil((segments.length * segments.length) / Math.max(1, maxPairs)));
  for (let i = 0; i < segments.length; i++) {
    for (let j = i + 1; j < segments.length; j += stride) {
      const a = segments[i];
      const b = segments[j];
      if (a.roadIndex === b.roadIndex || !boxesOverlap(a.a, a.b, b.a, b.b)) {
        continue;
      }
      const intersection = segmentIntersection(a.a, a.b, b.a, b.b);
      if (!intersection) {
        continue;
      }
      const key = nodeKey(intersection);
      nodes.set(key, Math.max(nodes.get(key) || 0, 4));
    }
  }
}

function nodeKey(point: Vec2): string {
  return `${Math.round(point[0] / 3) * 3},${Math.round(point[1] / 3) * 3}`;
}

function boxesOverlap(a0: Vec2, a1: Vec2, b0: Vec2, b1: Vec2): boolean {
  return Math.max(Math.min(a0[0], a1[0]), Math.min(b0[0], b1[0])) <= Math.min(Math.max(a0[0], a1[0]), Math.max(b0[0], b1[0])) + 0.01
    && Math.max(Math.min(a0[1], a1[1]), Math.min(b0[1], b1[1])) <= Math.min(Math.max(a0[1], a1[1]), Math.max(b0[1], b1[1])) + 0.01;
}

function segmentIntersection(a: Vec2, b: Vec2, c: Vec2, d: Vec2): Vec2 | undefined {
  const r: Vec2 = [b[0] - a[0], b[1] - a[1]];
  const s: Vec2 = [d[0] - c[0], d[1] - c[1]];
  const denom = cross(r, s);
  if (Math.abs(denom) < 1e-9) {
    return undefined;
  }
  const ca: Vec2 = [c[0] - a[0], c[1] - a[1]];
  const t = cross(ca, s) / denom;
  const u = cross(ca, r) / denom;
  if (t <= 0.001 || t >= 0.999 || u <= 0.001 || u >= 0.999) {
    return undefined;
  }
  return [a[0] + t * r[0], a[1] + t * r[1]];
}

function cross(a: Vec2, b: Vec2): number {
  return a[0] * b[1] - a[1] * b[0];
}

function orientation(a: Vec2, b: Vec2): number {
  const angle = Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI;
  return Math.abs(((angle % 180) + 180) % 180);
}

function turnAngle(a: Vec2, b: Vec2, c: Vec2): number {
  const ab = Math.atan2(a[1] - b[1], a[0] - b[0]);
  const cb = Math.atan2(c[1] - b[1], c[0] - b[0]);
  let angle = Math.abs((cb - ab) * 180 / Math.PI);
  while (angle > 180) {
    angle = Math.abs(angle - 360);
  }
  return angle;
}

function spacingFromCount(area: number, count: number): number[] {
  if (count <= 0) {
    return [];
  }
  const spacing = Math.sqrt(area / count);
  return [spacing * 0.72, spacing, spacing * 1.28];
}

function inferWidths(roads: RoadAnalysis["roadLines"]): CityProfile["roads"]["widthByHierarchy"] {
  const widths: Partial<Record<RoadHierarchy, number[]>> = {};
  for (const road of roads) {
    const lanes = Number(road.properties.lanes || 0);
    const taggedWidth = Number(String(road.properties.width || "").replace(/[^\d.]/g, ""));
    const fallback = road.hierarchy === "arterial" ? 30 : road.hierarchy === "collector" ? 18 : road.hierarchy === "alley" ? 6 : road.hierarchy === "pedestrian" ? 8 : 11;
    const width = taggedWidth || (lanes > 0 ? lanes * 3.4 + 4 : fallback);
    widths[road.hierarchy] = widths[road.hierarchy] || [];
    widths[road.hierarchy]!.push(width);
  }
  const result: CityProfile["roads"]["widthByHierarchy"] = {};
  for (const [hierarchy, values] of Object.entries(widths)) {
    result[hierarchy as RoadHierarchy] = round(values.reduce((sum, value) => sum + value, 0) / values.length, 2);
  }
  return result;
}

function degreeWeights(values: number[]): Partial<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (const value of values) {
    if (value < 3) {
      continue;
    }
    const key = String(Math.min(6, value));
    counts[key] = (counts[key] || 0) + 1;
  }
  return normalizeShares(counts);
}

function orientationPeaks(values: number[]): number[] {
  if (values.length === 0) {
    return [];
  }
  const bins = new Array(18).fill(0);
  for (const value of values) {
    bins[Math.min(17, Math.floor((((value % 180) + 180) % 180) / 10))]++;
  }
  return bins
    .map((count, index) => ({count, angle: index * 10 + 5}))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3)
    .filter((entry) => entry.count > 0)
    .map((entry) => entry.angle);
}
