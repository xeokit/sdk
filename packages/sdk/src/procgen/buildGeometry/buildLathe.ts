import type {GeometryArrays} from "./GeometryArrays";
import {TrianglesPrimitive} from "../../constants";
import {SDKErrorType, type SDKResult} from "../../core";

/**
 * Surface-of-revolution geometry: revolve a 2D profile around the
 * Y axis to produce columns, balusters, vases, dome roofs, light
 * fixtures, doughnut shapes.
 *
 * The profile lies in the `(r, y)` half-plane — `r` is radial distance
 * from the Y axis, `y` is height. Each profile point sweeps a ring
 * of `segments` vertices around the axis. Smooth normals follow the
 * profile's local outward perpendicular.
 *
 * ## Conventions
 *
 *   - **`profile`** is a flat array `[r0, y0, r1, y1, ...]`. List
 *     points in order of increasing arc length along the profile.
 *     Outward surface normals assume the profile traces CCW in
 *     `(r, y)` space — for the typical "outer skin from bottom to
 *     top" path that means `r >= 0` and `y` increasing.
 *   - **Profile vertices on the axis** (`r = 0`) are allowed and
 *     produce a cone tip; the ring at that vertex collapses to a
 *     single point but each duplicated vertex still carries the
 *     smooth-shaded normal so triangles around the tip render
 *     correctly.
 *   - **`segments`** (default `32`) is the radial subdivision count
 *     around the Y axis.
 *   - **`closedProfile`** (default `false`) closes the profile loop
 *     so the ring at the last vertex connects back to the ring at
 *     the first, producing torus-shape geometry from a closed 2D
 *     profile (e.g. a circle offset from the axis).
 *
 * ## Usage
 *
 * ```javascript
 * // Wine-bottle silhouette revolved around Y.
 * const result = buildLathe({
 *   profile: [
 *     0.00, 0.0,    // base centre (on axis)
 *     0.30, 0.0,    // base rim
 *     0.30, 0.5,    // body bottom
 *     0.32, 1.5,    // shoulder
 *     0.10, 2.0,    // neck
 *     0.12, 2.4     // top rim
 *   ],
 *   segments: 48
 * });
 *
 * if (result.ok) {
 *   const geometry = result.value;
 *   // Pass to sceneModel.createGeometry(...)
 * } else {
 *   console.error("Error creating lathe geometry:", result.error);
 * }
 * ```
 *
 * @param cfg Configuration for the lathe.
 * @param cfg.profile Profile polyline, flat `[r0, y0, r1, y1, ...]`.
 *   Must contain at least 2 vertices (length ≥ 4, even).
 * @param [cfg.segments=32] Number of radial subdivisions around the
 *   Y axis. Clamped to a minimum of 3.
 * @param [cfg.closedProfile=false] Whether the profile closes back
 *   on itself, producing a torus-shape revolution.
 * @returns Geometry arrays for the surface of revolution, or an error.
 */
export function buildLathe(cfg: {
  profile: number[];
  segments?: number;
  closedProfile?: boolean;
}): SDKResult<GeometryArrays> {
  const profile = cfg.profile;
  const segments = Math.max(3, Math.floor(cfg.segments ?? 32));
  const closedProfile = cfg.closedProfile ?? false;

  if (!profile || profile.length < 4 || profile.length % 2 !== 0) {
    return {
      ok: false,
      type: SDKErrorType.InvalidInput,
      error: "[buildLathe] profile must be a flat 2D path with at least 2 vertices (length >= 4, even)."
    };
  }

  const profCount = profile.length / 2;
  const segCount = segments + 1;   // +1 for wrap-around vertex carrying u=1 at the seam

  // ── Profile vertex outward 2D normals.
  // For a profile traced CCW in (r, y), the outward perpendicular of
  // edge (dr, dy) is (dy, -dr). Per-vertex normal averages the two
  // adjacent edges' perpendiculars.
  const profNormals = new Float32Array(profCount * 2);
  for (let i = 0; i < profCount; i++) {
    const iPrev = i > 0 ? i - 1 : (closedProfile ? profCount - 1 : 0);
    const iNext = i < profCount - 1 ? i + 1 : (closedProfile ? 0 : profCount - 1);
    const dInR  = profile[i * 2]     - profile[iPrev * 2];
    const dInY  = profile[i * 2 + 1] - profile[iPrev * 2 + 1];
    const dOutR = profile[iNext * 2]     - profile[i * 2];
    const dOutY = profile[iNext * 2 + 1] - profile[i * 2 + 1];
    const nr = dInY + dOutY;
    const ny = -(dInR + dOutR);
    const len = Math.hypot(nr, ny) || 1;
    profNormals[i * 2]     = nr / len;
    profNormals[i * 2 + 1] = ny / len;
  }

  // ── Cumulative profile arc length → V coordinate.
  const profVs = new Float32Array(profCount);
  profVs[0] = 0;
  for (let i = 1; i < profCount; i++) {
    const dr = profile[i * 2]     - profile[(i - 1) * 2];
    const dy = profile[i * 2 + 1] - profile[(i - 1) * 2 + 1];
    profVs[i] = profVs[i - 1] + Math.hypot(dr, dy);
  }
  let profLen = profVs[profCount - 1];
  if (closedProfile) {
    const dr = profile[0] - profile[(profCount - 1) * 2];
    const dy = profile[1] - profile[(profCount - 1) * 2 + 1];
    profLen += Math.hypot(dr, dy);
  }
  if (profLen === 0) profLen = 1;

  // ── Vertices: profCount rings × segCount per ring.
  const positions: number[] = [];
  const normals:   number[] = [];
  const uv:        number[] = [];
  const TWO_PI = Math.PI * 2;

  for (let i = 0; i < profCount; i++) {
    const r  = profile[i * 2];
    const y  = profile[i * 2 + 1];
    const nr = profNormals[i * 2];
    const ny = profNormals[i * 2 + 1];
    const v  = profVs[i] / profLen;

    for (let s = 0; s < segCount; s++) {
      const angle = (s / segments) * TWO_PI;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      positions.push(r * cos, y, r * sin);
      normals.push(nr * cos, ny, nr * sin);
      uv.push(s / segments, v);
    }
  }

  // ── Indices: connect adjacent rings.
  const indices: number[] = [];
  const ringSegCount = closedProfile ? profCount : profCount - 1;
  for (let i = 0; i < ringSegCount; i++) {
    const i0 = i;
    const i1 = (i + 1) % profCount;
    for (let s = 0; s < segments; s++) {
      const a = i0 * segCount + s;
      const b = i0 * segCount + s + 1;
      const c = i1 * segCount + s + 1;
      const d = i1 * segCount + s;
      indices.push(a, b, c, a, c, d);
    }
  }

  return {
    ok: true,
    value: {
      primitive: TrianglesPrimitive,
      positions,
      normals,
      uv,
      indices
    }
  };
}
