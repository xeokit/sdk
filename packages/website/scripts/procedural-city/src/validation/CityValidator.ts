import type {Block, CityScene, Vec2} from "../types";
import {distanceToSegment, polygonArea} from "../geometry/PolygonUtils";
import {metadataFootprint, polygonBounds} from "../report/ComparisonReport";
import polygonClipping from "polygon-clipping";

export interface ValidationCheck {
  key: string;
  label: string;
  ok: boolean;
  value: number | boolean;
  tolerance?: number;
  warning?: string;
}

export interface ValidationReport {
  schema: "xeokit-procedural-city-validation/1.0";
  ok: boolean;
  checks: ValidationCheck[];
  warnings: string[];
}

export function validateCity(scene: CityScene): ValidationReport {
  const checks: ValidationCheck[] = [
    emptySceneCheck(scene),
    connectedRoadNetworkCheck(scene),
    blockSelfIntersectionCheck(scene),
    buildingsInsideBlocksCheck(scene),
    buildingsOverRoadsCheck(scene),
    severeBuildingOverlapCheck(scene)
  ];
  const warnings = checks.flatMap((check) => check.warning ? [check.warning] : []);
  return {
    schema: "xeokit-procedural-city-validation/1.0",
    ok: checks.every((check) => check.ok),
    checks,
    warnings
  };
}

function emptySceneCheck(scene: CityScene): ValidationCheck {
  const ok = scene.objects.length > 0 && scene.stats.triangles > 0;
  return {
    key: "nonEmptyScene",
    label: "No empty XGF scene",
    ok,
    value: scene.stats.triangles,
    warning: ok ? undefined : "Generated city contains no triangles"
  };
}

function connectedRoadNetworkCheck(scene: CityScene): ValidationCheck {
  const keysByRoad = scene.roads.map((road) => road.polyline.flatMap((point) => nearbyNodeKeys(point)));
  const nodeToRoads = new Map<string, number[]>();
  keysByRoad.forEach((keys, roadIndex) => {
    for (const key of keys) {
      const roads = nodeToRoads.get(key) || [];
      roads.push(roadIndex);
      nodeToRoads.set(key, roads);
    }
  });
  const visited = new Set<number>();
  const stack = [0];
  while (stack.length) {
    const roadIndex = stack.pop()!;
    if (visited.has(roadIndex)) {
      continue;
    }
    visited.add(roadIndex);
    for (const key of keysByRoad[roadIndex] || []) {
      for (const adjacent of nodeToRoads.get(key) || []) {
        if (!visited.has(adjacent)) {
          stack.push(adjacent);
        }
      }
    }
  }
  const connectedShare = scene.roads.length ? visited.size / scene.roads.length : 0;
  const ok = connectedShare >= 0.72;
  return {
    key: "connectedRoadNetwork",
    label: "Connected road network",
    ok,
    value: connectedShare,
    tolerance: 0.72,
    warning: ok ? undefined : `Only ${Math.round(connectedShare * 100)}% of roads are in the largest connected component`
  };
}

function blockSelfIntersectionCheck(scene: CityScene): ValidationCheck {
  const invalid = scene.blocks.filter((block) => !simplePolygon(block.polygon)).length;
  return {
    key: "noSelfIntersectingBlocks",
    label: "No self-intersecting blocks",
    ok: invalid === 0,
    value: invalid,
    warning: invalid === 0 ? undefined : `${invalid} blocks are self-intersecting`
  };
}

function buildingsInsideBlocksCheck(scene: CityScene): ValidationCheck {
  const blockById = new Map(scene.blocks.map((block) => [block.id, block]));
  let outside = 0;
  for (const object of scene.objects) {
    if (object.type !== "Building") {
      continue;
    }
    const block = blockById.get(String(object.metadata.blockId || ""));
    const footprint = metadataFootprint(object.metadata.footprint);
    if (!block || footprint.some((point) => !pointInPolygon(point, block.polygon, 0.75))) {
      outside++;
    }
  }
  return {
    key: "buildingsInsideBlocks",
    label: "No buildings outside blocks",
    ok: outside === 0,
    value: outside,
    warning: outside === 0 ? undefined : `${outside} buildings have footprint points outside their block`
  };
}

function buildingsOverRoadsCheck(scene: CityScene): ValidationCheck {
  let overlaps = 0;
  for (const object of scene.objects) {
    if (object.type !== "Building") {
      continue;
    }
    const footprint = metadataFootprint(object.metadata.footprint);
    if (footprint.length < 3) {
      continue;
    }
    const tooClose = scene.roads.some((road) => {
      const threshold = Math.max(0.35, road.width * 0.06);
      for (const point of footprint) {
        for (let i = 1; i < road.polyline.length; i++) {
          if (distanceToSegment(point, road.polyline[i - 1], road.polyline[i]) < threshold) {
            return true;
          }
        }
      }
      return false;
    });
    if (tooClose) {
      overlaps++;
    }
  }
  const share = scene.stats.buildings ? overlaps / scene.stats.buildings : 0;
  const ok = share < 0.04;
  return {
    key: "buildingsOverRoads",
    label: "No buildings overlapping roads",
    ok,
    value: share,
    tolerance: 0.04,
    warning: ok ? undefined : `${overlaps} buildings are too close to road centerlines`
  };
}

function severeBuildingOverlapCheck(scene: CityScene): ValidationCheck {
  const byBlock = new Map<string, Array<{id: string; footprint: Vec2[]; bounds: [number, number, number, number]; area: number}>>();
  for (const object of scene.objects) {
    if (object.type !== "Building") {
      continue;
    }
    const footprint = metadataFootprint(object.metadata.footprint);
    if (footprint.length < 3) {
      continue;
    }
    const blockId = String(object.metadata.blockId || "");
    const entries = byBlock.get(blockId) || [];
    entries.push({id: object.id, footprint, bounds: polygonBounds(footprint), area: Math.abs(polygonArea(footprint))});
    byBlock.set(blockId, entries);
  }
  let severe = 0;
  for (const entries of byBlock.values()) {
    for (let i = 0; i < entries.length; i++) {
      for (let j = i + 1; j < entries.length; j++) {
        if (bboxIntersectionArea(entries[i].bounds, entries[j].bounds) <= 1) {
          continue;
        }
        const area = polygonIntersectionArea(entries[i].footprint, entries[j].footprint);
        const minArea = Math.min(entries[i].area, entries[j].area);
        if (area > Math.max(8, minArea * 0.08)) {
          severe++;
        }
      }
    }
  }
  return {
    key: "severeBuildingOverlap",
    label: "No severe building overlap",
    ok: severe === 0,
    value: severe,
    warning: severe === 0 ? undefined : `${severe} severe building footprint overlaps detected`
  };
}

function nearbyNodeKeys(point: Vec2): string[] {
  const step = 24;
  const x = Math.round(point[0] / step);
  const y = Math.round(point[1] / step);
  const keys: string[] = [];
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      keys.push(`${x + dx},${y + dy}`);
    }
  }
  return keys;
}

function simplePolygon(points: Vec2[]): boolean {
  if (points.length < 3 || Math.abs(polygonArea(points)) < 1) {
    return false;
  }
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    for (let j = i + 1; j < points.length; j++) {
      if (Math.abs(i - j) <= 1 || (i === 0 && j === points.length - 1)) {
        continue;
      }
      const c = points[j];
      const d = points[(j + 1) % points.length];
      if (segmentsIntersect(a, b, c, d)) {
        return false;
      }
    }
  }
  return true;
}

function pointInPolygon(point: Vec2, polygon: Vec2[], tolerance: number): boolean {
  if (polygon.some((vertex) => Math.hypot(vertex[0] - point[0], vertex[1] - point[1]) <= tolerance)) {
    return true;
  }
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0];
    const yi = polygon[i][1];
    const xj = polygon[j][0];
    const yj = polygon[j][1];
    const intersects = ((yi > point[1]) !== (yj > point[1]))
      && point[0] < (xj - xi) * (point[1] - yi) / ((yj - yi) || 1e-9) + xi;
    if (intersects) {
      inside = !inside;
    }
  }
  return inside;
}

function segmentsIntersect(a: Vec2, b: Vec2, c: Vec2, d: Vec2): boolean {
  const d1 = direction(c, d, a);
  const d2 = direction(c, d, b);
  const d3 = direction(a, b, c);
  const d4 = direction(a, b, d);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}

function direction(a: Vec2, b: Vec2, c: Vec2): number {
  return (c[0] - a[0]) * (b[1] - a[1]) - (c[1] - a[1]) * (b[0] - a[0]);
}

function bboxIntersectionArea(a: [number, number, number, number], b: [number, number, number, number]): number {
  const width = Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0]));
  const height = Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]));
  return width * height;
}

function polygonIntersectionArea(a: Vec2[], b: Vec2[]): number {
  const result = polygonClipping.intersection([[closeRing(a)]], [[closeRing(b)]]);
  let area = 0;
  for (const polygon of result || []) {
    for (const ring of polygon) {
      const points = ring.slice(0, -1).map((point) => [point[0], point[1]] as Vec2);
      area += Math.abs(polygonArea(points));
    }
  }
  return area;
}

function closeRing(poly: Vec2[]): number[][] {
  const ring = poly.map((point) => [point[0], point[1]]);
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first && (!last || first[0] !== last[0] || first[1] !== last[1])) {
    ring.push([first[0], first[1]]);
  }
  return ring;
}
