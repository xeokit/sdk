/**
 * Internal basis-math helpers shared by {@link buildDrawing} and
 * {@link buildDrawingPanel} — small functions that turn a
 * {@link ProjectionBasis} and a world-space AABB into the
 * basis-space extents the chrome (frame, panel, title block)
 * sizes itself against, plus a couple of supporting utilities.
 *
 * @internal
 */
import type {FloatArrayParam} from "../../../base/math";
import type {ProjectionBasis} from "../ProjectionBasis";


/**
 * Project the 8 corners of a world-space AABB onto the basis
 * `right`/`up` axes and return the rotated rectangle's u/v
 * extents. Same as the helper used inside `buildHLEDepthBuffer`,
 * re-derived here so the chrome (frame, panel, title block)
 * can size itself without a depth-buffer build.
 *
 * @internal
 */
export function basisUVExtents(
    basis: ProjectionBasis,
    aabb: FloatArrayParam,
): {uMin: number; uMax: number; vMin: number; vMax: number} {
  const {right, up} = basis;
  const xMin = aabb[0], yMin = aabb[1], zMin = aabb[2];
  const xMax = aabb[3], yMax = aabb[4], zMax = aabb[5];
  let uMin =  Infinity, uMax = -Infinity;
  let vMin =  Infinity, vMax = -Infinity;
  for (let i = 0; i < 8; i++) {
    const x = (i & 1) ? xMax : xMin;
    const y = (i & 2) ? yMax : yMin;
    const z = (i & 4) ? zMax : zMin;
    const u = x * right[0] + y * right[1] + z * right[2];
    const v = x * up[0]    + y * up[1]    + z * up[2];
    if (u < uMin) uMin = u; if (u > uMax) uMax = u;
    if (v < vMin) vMin = v; if (v > vMax) vMax = v;
  }
  return {uMin, uMax, vMin, vMax};
}


/**
 * Minimum basis-d coord over the 8 AABB corners — the depth
 * value of the AABB face nearest the camera. The projection
 * plane sits `offset` past this on the camera side.
 *
 * @internal
 */
export function computeBasisDMin(basis: ProjectionBasis, aabb: FloatArrayParam): number {
  const f = basis.forward;
  const xMin = aabb[0], yMin = aabb[1], zMin = aabb[2];
  const xMax = aabb[3], yMax = aabb[4], zMax = aabb[5];
  let dMin = Infinity;
  for (let i = 0; i < 8; i++) {
    const x = (i & 1) ? xMax : xMin;
    const y = (i & 2) ? yMax : yMin;
    const z = (i & 4) ? zMax : zMin;
    const d = x * f[0] + y * f[1] + z * f[2];
    if (d < dMin) dMin = d;
  }
  return dMin;
}


/**
 * Signed handedness of a {right, up, forward} basis — equal
 * to `(right × up) · forward`. Right-handed bases give `+1`,
 * left-handed bases `-1`. The panel-box winding flips with
 * sign so the inside-out box always shows the inside-facing
 * surface no matter which way the basis chirality lands.
 *
 * @internal
 */
export function basisHandedness(basis: ProjectionBasis): number {
  const r = basis.right, u = basis.up, f = basis.forward;
  const cx = r[1] * u[2] - r[2] * u[1];
  const cy = r[2] * u[0] - r[0] * u[2];
  const cz = r[0] * u[1] - r[1] * u[0];
  return cx * f[0] + cy * f[1] + cz * f[2];
}


/**
 * Subtract `origin` from every triple in `positions` in place.
 *
 * Keeps emitted geometry positions in a small range near zero
 * so `SceneGeometry.aabb` — stored as Float32 — stays precise
 * even when the source model sits far from the world origin.
 * The caller passes the same `origin` to
 * `SceneModel.createMesh`'s `position` so the world placement
 * carries the full-precision offset in the mesh's Float64 local
 * matrix.
 *
 * @internal
 */
export function recenterPositions(
    positions: number[],
    origin: [number, number, number],
): void {
  for (let i = 0, n = positions.length; i < n; i += 3) {
    positions[i]     -= origin[0];
    positions[i + 1] -= origin[1];
    positions[i + 2] -= origin[2];
  }
}
