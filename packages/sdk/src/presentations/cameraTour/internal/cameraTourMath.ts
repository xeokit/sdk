/**
 * Internal math helpers shared across the cameraTour pipeline —
 * up-axis resolution, AABB centroid, squared distance. Each one
 * was duplicated across three or more stages before this file
 * existed; consolidating here so a fix to one (e.g. an axis-
 * resolution edge case) automatically reaches every consumer.
 *
 * Not part of the public surface — `cameraTour/index.ts` does
 * not re-export from this file, and every callable here carries
 * `@internal`.
 *
 * @internal
 */
import type {Vec3} from "../../../base/math/vector";


/**
 * Index of the up axis within a 3-component vector — Y-up → 1,
 * Z-up → 2. Any non-axis-aligned up vector (an unusual scene
 * configuration) falls back to Y, the xeokit default.
 *
 * @internal
 */
export function resolveUpAxis(up: ArrayLike<number>): 1 | 2 {
  return Math.abs(up[2]) > Math.abs(up[1]) ? 2 : 1;
}


/**
 * Centroid of an AABB encoded as
 * `[xMin, yMin, zMin, xMax, yMax, zMax]`. Returns a fresh
 * `[x, y, z]` triple.
 *
 * @internal
 */
export function aabbCentroid(aabb: ArrayLike<number>): Vec3 {
  return [
    (aabb[0] + aabb[3]) * 0.5,
    (aabb[1] + aabb[4]) * 0.5,
    (aabb[2] + aabb[5]) * 0.5,
  ] as Vec3;
}


/**
 * Squared Euclidean distance between two 3-component vectors.
 * Skips the `Math.sqrt` since every caller is comparing distances
 * relative to each other (nearest-neighbour, min-by-distance) —
 * the monotonic transform doesn't change rankings.
 *
 * @internal
 */
export function squaredDist(a: ArrayLike<number>, b: ArrayLike<number>): number {
  const dx = a[0] - b[0], dy = a[1] - b[1], dz = a[2] - b[2];
  return dx * dx + dy * dy + dz * dz;
}
