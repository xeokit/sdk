/**
 * Bounding volume and geometric error for an implicit tile, derived by
 * subdividing the implicit-root tile's `box`. Implicit tiles carry no explicit
 * bounding volume — at level `d` and integer coordinates `(x, y[, z])`, a tile
 * occupies one cell of the root box split into `2^d` along each subdivided axis
 * (X and Y for QUADTREE; X, Y and Z for OCTREE). The subdivided box is returned
 * as a world-space sphere (matching `TileTree`'s box → sphere convention) for
 * screen-space-error and frustum tests.
 */

import type {Mat4} from "../../../base/math/matrix";
import type {Vec3} from "../../../base/math/vector";
import {transformDir, transformPoint, vecLength} from "../streaming/TileTree";

/**
 * World-space bounding sphere of the implicit tile at `level` / `coords`.
 *
 * @param rootBox Root tile's local-frame box: centre + three half-axes (12 numbers).
 * @param dims Subdivided axes: 2 for QUADTREE (X, Y), 3 for OCTREE (X, Y, Z).
 * @param level Implicit level (root = 0).
 * @param coords Integer tile coordinates, one per subdivided axis.
 * @param world Implicit-root tile-to-world transform.
 */
export function subdividedSphere(
  rootBox: number[],
  dims: number,
  level: number,
  coords: number[],
  world: Mat4,
): {center: Vec3; radius: number} {
  const n = Math.pow(2, level);
  const c: Vec3 = [rootBox[0], rootBox[1], rootBox[2]];
  const axes: Vec3[] = [
    [rootBox[3], rootBox[4], rootBox[5]],
    [rootBox[6], rootBox[7], rootBox[8]],
    [rootBox[9], rootBox[10], rootBox[11]],
  ];

  const localCenter: Vec3 = [c[0], c[1], c[2]];
  const halfAxes: Vec3[] = axes.map(a => [a[0], a[1], a[2]] as Vec3);
  for (let axis = 0; axis < dims; axis++) {
    const t = (2 * coords[axis] + 1) / n - 1;
    localCenter[0] += axes[axis][0] * t;
    localCenter[1] += axes[axis][1] * t;
    localCenter[2] += axes[axis][2] * t;
    halfAxes[axis] = [axes[axis][0] / n, axes[axis][1] / n, axes[axis][2] / n];
  }

  const center = transformPoint(world, localCenter);
  const radius =
    vecLength(transformDir(world, halfAxes[0])) +
    vecLength(transformDir(world, halfAxes[1])) +
    vecLength(transformDir(world, halfAxes[2]));
  return {center, radius};
}

/** Geometric error at an implicit `level`: the root tile's error halved per level. */
export function geometricErrorAtLevel(rootGeometricError: number, level: number): number {
  return rootGeometricError / Math.pow(2, level);
}
