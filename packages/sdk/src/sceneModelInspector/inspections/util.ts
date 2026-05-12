import type {SceneGeometry} from "../../scene";
import {
  LinesPrimitive,
  SolidPrimitive,
  SurfacePrimitive,
  TrianglesPrimitive,
} from "../../constants";


/**
 * Predicates and small lookups shared by more than one inspection
 * in {@link inspections}. Kept private to the directory — public
 * inspection logic lives in the per-inspection files.
 */


/** True when every element of a 16-element matrix is finite. */
export function isFiniteMat4(m: ArrayLike<number>): boolean {
  if (m.length < 16) return false;
  for (let i = 0; i < 16; i++) {
    if (!Number.isFinite(m[i])) return false;
  }
  return true;
}


/** True when every element of a 6-element AABB tuple is finite. */
export function isFiniteAABB(a: ArrayLike<number>): boolean {
  if (a.length < 6) return false;
  for (let i = 0; i < 6; i++) {
    if (!Number.isFinite(a[i])) return false;
  }
  return true;
}


/**
 * Required index-array stride per primitive. Triangle variants
 * consume indices in groups of 3, lines in groups of 2, points
 * (un-indexed conventionally) → 0 = no stride check.
 */
export function indexStrideFor(primitive: number): number {
  switch (primitive) {
    case TrianglesPrimitive:
    case SolidPrimitive:
    case SurfacePrimitive:
      return 3;
    case LinesPrimitive:
      return 2;
    default:
      return 0;
  }
}


/** True when the geometry's primitive is one of the triangle variants. */
export function isTriangleMesh(geom: SceneGeometry): boolean {
  const p = geom.primitive;
  return p === TrianglesPrimitive || p === SolidPrimitive || p === SurfacePrimitive;
}


/**
 * Compact distance formatter used in `summary` strings on
 * far-from-origin inspections. Collapses 1.2e6 → `"1.2M units"`,
 * 4500 → `"4.5k units"`, 230 → `"230 units"`.
 */
export function formatDistance(d: number): string {
  if (!Number.isFinite(d)) return "?";
  if (d >= 1e6) return `${(d / 1e6).toFixed(1)}M units`;
  if (d >= 1e3) return `${(d / 1e3).toFixed(1)}k units`;
  return `${d.toFixed(0)} units`;
}
