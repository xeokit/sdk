import polygonClipping from "polygon-clipping";
import type {LineFeature, PolygonFeature} from "../naturalEarth/loadNaturalEarth";
import type {MultiPolygon, Ring, TileKey} from "../types";

export function createTiles(tileDegrees: number, bounds?: {minLon?: number; maxLon?: number; minLat?: number; maxLat?: number}): TileKey[] {
  const tiles: TileKey[] = [];
  let y = 0;
  for (let minLat = -90; minLat < 90; minLat += tileDegrees, y++) {
    let x = 0;
    for (let minLon = -180; minLon < 180; minLon += tileDegrees, x++) {
      const tile = {x, y, minLon, minLat, maxLon: Math.min(180, minLon + tileDegrees), maxLat: Math.min(90, minLat + tileDegrees)};
      if (!bounds || tileIntersectsBounds(tile, bounds)) {
        tiles.push(tile);
      }
    }
  }
  return tiles;
}

function tileIntersectsBounds(tile: TileKey, bounds: {minLon?: number; maxLon?: number; minLat?: number; maxLat?: number}): boolean {
  if (bounds.minLat !== undefined && tile.maxLat < bounds.minLat) return false;
  if (bounds.maxLat !== undefined && tile.minLat > bounds.maxLat) return false;
  if (bounds.minLon !== undefined && tile.maxLon < bounds.minLon) return false;
  if (bounds.maxLon !== undefined && tile.minLon > bounds.maxLon) return false;
  return true;
}

export function clipFeatureToTile(feature: PolygonFeature, tile: TileKey): MultiPolygon {
  const tilePoly = [[[
    [tile.minLon, tile.minLat],
    [tile.maxLon, tile.minLat],
    [tile.maxLon, tile.maxLat],
    [tile.minLon, tile.maxLat],
    [tile.minLon, tile.minLat]
  ]]];
  const result: MultiPolygon = [];
  for (const shift of [-360, 0, 360]) {
    const shifted = shiftMultiPolygon(feature.geometry, shift);
    const clipped = polygonClipping.intersection(shifted as any, tilePoly as any) as any;
    for (const poly of clipped || []) {
      const cleaned = poly.map((ring: number[][]) => ring.map((p) => [normalizeLon(p[0]), clampLat(p[1])] as [number, number]))
        .filter((ring: Ring) => ring.length >= 4);
      if (cleaned.length > 0) {
        result.push(cleaned);
      }
    }
  }
  return result;
}

export function lineSegmentsForTile(feature: LineFeature, tile: TileKey): Ring[] {
  const out: Ring[] = [];
  for (const line of feature.lines) {
    for (const shift of [-360, 0, 360]) {
      let current: Ring = [];
      for (let i = 0; i + 1 < line.length; i++) {
        const a: [number, number] = [line[i][0] + shift, line[i][1]];
        const b: [number, number] = [line[i + 1][0] + shift, line[i + 1][1]];
        const clipped = clipSegment(a, b, tile);
        if (!clipped) {
          if (current.length > 1) out.push(current);
          current = [];
          continue;
        }
        const ca: [number, number] = [normalizeLon(clipped[0][0]), clipped[0][1]];
        const cb: [number, number] = [normalizeLon(clipped[1][0]), clipped[1][1]];
        if (current.length === 0 || !same(current[current.length - 1], ca)) current.push(ca);
        current.push(cb);
      }
      if (current.length > 1) out.push(current);
    }
  }
  return out;
}

function shiftMultiPolygon(multi: MultiPolygon, shift: number): MultiPolygon {
  return multi.map((poly) => poly.map((ring) => ring.map((p) => [p[0] + shift, p[1]])));
}

function normalizeLon(lon: number): number {
  let v = lon;
  while (v < -180) v += 360;
  while (v > 180) v -= 360;
  return Object.is(v, -0) ? 0 : v;
}

function clampLat(lat: number): number {
  return Math.max(-90, Math.min(90, lat));
}

function clipSegment(a: [number, number], b: [number, number], tile: TileKey): [[number, number], [number, number]] | null {
  let t0 = 0;
  let t1 = 1;
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const tests = [
    [-dx, a[0] - tile.minLon],
    [dx, tile.maxLon - a[0]],
    [-dy, a[1] - tile.minLat],
    [dy, tile.maxLat - a[1]]
  ];
  for (const [p, q] of tests) {
    if (Math.abs(p) < 1e-12) {
      if (q < 0) return null;
    } else {
      const r = q / p;
      if (p < 0) t0 = Math.max(t0, r);
      else t1 = Math.min(t1, r);
      if (t0 > t1) return null;
    }
  }
  return [[a[0] + t0 * dx, a[1] + t0 * dy], [a[0] + t1 * dx, a[1] + t1 * dy]];
}

function same(a: [number, number], b: [number, number]): boolean {
  return Math.abs(a[0] - b[0]) < 1e-9 && Math.abs(a[1] - b[1]) < 1e-9;
}
