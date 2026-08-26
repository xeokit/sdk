import earcut from "earcut";
import type {MeshData, Polygon, TileKey} from "../types";
import {densifyRingGeodesic} from "./densifyGeodesic";
import {DEG2RAD, lonLatFromUnit, lonLatToXYZ, normalize3, unitFromLonLat} from "./lonLatToXYZ";

export function triangulateTilePolygon(
  polygon: Polygon,
  tile: TileKey,
  radius: number,
  maxEdgeAngle: number,
  id: string,
  materialId: string,
  layerId?: string
): MeshData | null {
  const rings = polygon.map((ring) => densifyRingGeodesic(ring, maxEdgeAngle)).filter((ring) => ring.length >= 4);
  if (rings.length === 0) return null;
  const centerLat = ((tile.minLat + tile.maxLat) / 2) * DEG2RAD;
  const cosCenter = Math.max(0.05, Math.cos(centerLat));
  const flat: number[] = [];
  const holes: number[] = [];
  const lonLats: [number, number][] = [];

  for (let r = 0; r < rings.length; r++) {
    if (r > 0) holes.push(lonLats.length);
    const ring = rings[r];
    for (let i = 0; i < ring.length - 1; i++) {
      const p = ring[i];
      lonLats.push(p);
      flat.push((p[0] - tile.minLon) * cosCenter, p[1] - tile.minLat);
    }
  }

  const tri = earcut(flat, holes, 2);
  if (tri.length === 0) return null;
  const tessellated = tessellateTriangles(lonLats, tri, Math.max(maxEdgeAngle, 2.0));
  const positions = new Float64Array(lonLats.length * 3);
  const normals = new Float32Array(lonLats.length * 3);
  for (let i = 0; i < lonLats.length; i++) {
    const [x, y, z] = lonLatToXYZ(lonLats[i], radius);
    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;
    const n = normalize3(x, y, z);
    normals[i * 3] = n[0];
    normals[i * 3 + 1] = n[1];
    normals[i * 3 + 2] = n[2];
  }
  const indices = new Uint32Array(tessellated.indices);
  fixOutwardWinding(positions, indices);
  return {id, positions, normals, indices, materialId, layerId};
}

function tessellateTriangles(lonLats: [number, number][], indices: number[], maxEdgeAngle: number): {indices: number[]} {
  const out: number[] = [];
  const midpointByEdge = new Map<string, number>();
  const maxDepth = 16;

  const midpoint = (a: number, b: number): number => {
    const lo = Math.min(a, b);
    const hi = Math.max(a, b);
    const key = `${lo}:${hi}`;
    const existing = midpointByEdge.get(key);
    if (existing !== undefined) {
      return existing;
    }
    const au = unitFromLonLat(lonLats[a]);
    const bu = unitFromLonLat(lonLats[b]);
    const mx = au[0] + bu[0];
    const my = au[1] + bu[1];
    const mz = au[2] + bu[2];
    const len = Math.hypot(mx, my, mz) || 1;
    const index = lonLats.length;
    lonLats.push(lonLatFromUnit([mx / len, my / len, mz / len]));
    midpointByEdge.set(key, index);
    return index;
  };

  const split = (a: number, b: number, c: number, depth: number): void => {
    const ab = angularDistanceDegrees(lonLats[a], lonLats[b]);
    const bc = angularDistanceDegrees(lonLats[b], lonLats[c]);
    const ca = angularDistanceDegrees(lonLats[c], lonLats[a]);
    const longest = Math.max(ab, bc, ca);
    if (longest <= maxEdgeAngle || depth >= maxDepth) {
      out.push(a, b, c);
      return;
    }
    if (longest === ab) {
      const m = midpoint(a, b);
      split(a, m, c, depth + 1);
      split(m, b, c, depth + 1);
    } else if (longest === bc) {
      const m = midpoint(b, c);
      split(a, b, m, depth + 1);
      split(a, m, c, depth + 1);
    } else {
      const m = midpoint(c, a);
      split(a, b, m, depth + 1);
      split(m, b, c, depth + 1);
    }
  };

  for (let i = 0; i + 2 < indices.length; i += 3) {
    split(indices[i], indices[i + 1], indices[i + 2], 0);
  }

  return {indices: out};
}

function angularDistanceDegrees(a: [number, number], b: [number, number]): number {
  const au = unitFromLonLat(a);
  const bu = unitFromLonLat(b);
  const dot = Math.max(-1, Math.min(1, au[0] * bu[0] + au[1] * bu[1] + au[2] * bu[2]));
  return Math.acos(dot) / DEG2RAD;
}

function fixOutwardWinding(positions: Float64Array, indices: Uint32Array): void {
  for (let i = 0; i + 2 < indices.length; i += 3) {
    const sign = triangleOutwardSign(positions, indices[i], indices[i + 1], indices[i + 2]);
    if (sign < 0) {
      const t = indices[i + 1];
      indices[i + 1] = indices[i + 2];
      indices[i + 2] = t;
    }
  }
}

function triangleOutwardSign(p: Float64Array, ia: number, ib: number, ic: number): number {
  const ax = p[ia * 3], ay = p[ia * 3 + 1], az = p[ia * 3 + 2];
  const bx = p[ib * 3], by = p[ib * 3 + 1], bz = p[ib * 3 + 2];
  const cx = p[ic * 3], cy = p[ic * 3 + 1], cz = p[ic * 3 + 2];
  const abx = bx - ax, aby = by - ay, abz = bz - az;
  const acx = cx - ax, acy = cy - ay, acz = cz - az;
  const nx = aby * acz - abz * acy;
  const ny = abz * acx - abx * acz;
  const nz = abx * acy - aby * acx;
  const mx = (ax + bx + cx) / 3;
  const my = (ay + by + cy) / 3;
  const mz = (az + bz + cz) / 3;
  return nx * mx + ny * my + nz * mz;
}
