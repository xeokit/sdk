import earcut from "earcut";
import type {MeshData, Vec2} from "../types";
import {ensureCCW} from "./PolygonUtils";

export function extrudePolygon(params: {
  id?: string;
  polygon: Vec2[];
  height: number;
  baseZ?: number;
  materialId: string;
}): MeshData {
  const poly = ensureCCW(params.polygon);
  const baseZ = params.baseZ ?? 0;
  const topZ = baseZ + params.height;
  const flat: number[] = [];
  for (const p of poly) {
    flat.push(p[0], p[1]);
  }
  const capTriangles = earcut(flat);
  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];

  const bottomBase = positions.length / 3;
  for (const p of poly) {
    positions.push(p[0], p[1], baseZ);
    normals.push(0, 0, -1);
  }
  for (let i = 0; i < capTriangles.length; i += 3) {
    indices.push(bottomBase + capTriangles[i + 2], bottomBase + capTriangles[i + 1], bottomBase + capTriangles[i]);
  }

  const topBase = positions.length / 3;
  for (const p of poly) {
    positions.push(p[0], p[1], topZ);
    normals.push(0, 0, 1);
  }
  for (let i = 0; i < capTriangles.length; i += 3) {
    indices.push(topBase + capTriangles[i], topBase + capTriangles[i + 1], topBase + capTriangles[i + 2]);
  }

  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len = Math.hypot(dx, dy) || 1;
    const n: [number, number, number] = [dy / len, -dx / len, 0];
    const base = positions.length / 3;
    positions.push(a[0], a[1], baseZ, b[0], b[1], baseZ, b[0], b[1], topZ, a[0], a[1], topZ);
    normals.push(...n, ...n, ...n, ...n);
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }

  return {
    id: params.id,
    materialId: params.materialId,
    positions,
    normals,
    indices
  };
}
