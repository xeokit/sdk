import polygonClipping from "polygon-clipping";
import type {Vec2} from "../types";

export function polygonArea(poly: Vec2[]): number {
  let area = 0;
  for (let i = 0, len = poly.length; i < len; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % len];
    area += a[0] * b[1] - b[0] * a[1];
  }
  return area / 2;
}

export function polygonCentroid(poly: Vec2[]): Vec2 {
  const area = polygonArea(poly);
  if (Math.abs(area) < 1e-6) {
    const sum = poly.reduce((acc, p) => [acc[0] + p[0], acc[1] + p[1]] as Vec2, [0, 0]);
    return [sum[0] / Math.max(1, poly.length), sum[1] / Math.max(1, poly.length)];
  }
  let x = 0;
  let y = 0;
  for (let i = 0, len = poly.length; i < len; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % len];
    const f = a[0] * b[1] - b[0] * a[1];
    x += (a[0] + b[0]) * f;
    y += (a[1] + b[1]) * f;
  }
  const factor = 1 / (6 * area);
  return [x * factor, y * factor];
}

export function ensureCCW(poly: Vec2[]): Vec2[] {
  return polygonArea(poly) >= 0 ? poly.slice() : poly.slice().reverse();
}

export function bbox(poly: Vec2[]): [number, number, number, number] {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const p of poly) {
    minX = Math.min(minX, p[0]);
    minY = Math.min(minY, p[1]);
    maxX = Math.max(maxX, p[0]);
    maxY = Math.max(maxY, p[1]);
  }
  return [minX, minY, maxX, maxY];
}

export function insetPolygon(poly: Vec2[], distance: number): Vec2[] {
  const c = polygonCentroid(poly);
  return poly.map((p) => {
    const dx = p[0] - c[0];
    const dy = p[1] - c[1];
    const len = Math.hypot(dx, dy) || 1;
    const shrink = Math.max(0, len - distance) / len;
    return [c[0] + dx * shrink, c[1] + dy * shrink];
  });
}

export function clipPolygonToBounds(poly: Vec2[], min: Vec2, max: Vec2): Vec2[] {
  const ring = closeRing(poly);
  const bounds = closeRing([
    [min[0], min[1]],
    [max[0], min[1]],
    [max[0], max[1]],
    [min[0], max[1]]
  ]);
  const result = polygonClipping.intersection([[ring]], [[bounds]]);
  const first = result?.[0]?.[0];
  if (!first || first.length < 4) {
    return [];
  }
  return first.slice(0, -1).map((p) => [p[0], p[1]] as Vec2);
}

export function lerp2(a: Vec2, b: Vec2, t: number): Vec2 {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

export function quadPoint(p00: Vec2, p10: Vec2, p11: Vec2, p01: Vec2, u: number, v: number): Vec2 {
  return lerp2(lerp2(p00, p10, u), lerp2(p01, p11, u), v);
}

export function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

export function segmentLength(polyline: Vec2[]): number {
  let len = 0;
  for (let i = 1; i < polyline.length; i++) {
    len += distance(polyline[i - 1], polyline[i]);
  }
  return len;
}

export function samplePolyline(polyline: Vec2[], spacing: number): Array<{point: Vec2; tangent: Vec2}> {
  const samples: Array<{point: Vec2; tangent: Vec2}> = [];
  for (let i = 1; i < polyline.length; i++) {
    const a = polyline[i - 1];
    const b = polyline[i];
    const len = distance(a, b);
    if (len < 1e-3) {
      continue;
    }
    const steps = Math.max(1, Math.floor(len / spacing));
    const tangent: Vec2 = [(b[0] - a[0]) / len, (b[1] - a[1]) / len];
    for (let s = 0; s < steps; s++) {
      const t = (s + 0.5) / steps;
      samples.push({point: lerp2(a, b, t), tangent});
    }
  }
  return samples;
}

export function distanceToPolyline(point: Vec2, polyline: Vec2[]): number {
  let best = Number.POSITIVE_INFINITY;
  for (let i = 1; i < polyline.length; i++) {
    best = Math.min(best, distanceToSegment(point, polyline[i - 1], polyline[i]));
  }
  return best;
}

export function distanceToSegment(p: Vec2, a: Vec2, b: Vec2): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-9) {
    return distance(p, a);
  }
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2));
  return Math.hypot(p[0] - (a[0] + dx * t), p[1] - (a[1] + dy * t));
}

export function rectPolygon(cx: number, cy: number, width: number, depth: number): Vec2[] {
  const hw = width / 2;
  const hd = depth / 2;
  return [
    [cx - hw, cy - hd],
    [cx + hw, cy - hd],
    [cx + hw, cy + hd],
    [cx - hw, cy + hd]
  ];
}

export function scalePolygon(poly: Vec2[], scaleX: number, scaleY: number): Vec2[] {
  const c = polygonCentroid(poly);
  return poly.map((p) => [c[0] + (p[0] - c[0]) * scaleX, c[1] + (p[1] - c[1]) * scaleY]);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function round(value: number, precision = 3): number {
  const m = 10 ** precision;
  return Math.round(value * m) / m;
}

function closeRing(poly: Vec2[]): number[][] {
  const ring = poly.map((p) => [p[0], p[1]]);
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (!last || first[0] !== last[0] || first[1] !== last[1]) {
    ring.push([first[0], first[1]]);
  }
  return ring;
}
