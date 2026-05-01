import type {SceneModel} from "../../scene";
import {SDKErrorType, type SDKResult} from "../../core";
import {decompressPositions3WithAABB3} from "../../math/compression";
import type {Fix, FixApplyResult} from "../Fix";
import type {Issue} from "../Issue";


const DEGENERATE_AREA_EPS_SQ = 1e-20;


/**
 * Auto-fix for `GEOMETRY_DEGENERATE_TRIANGLES` — rewrites
 * `geom.indices` to drop every triangle that has repeated indices
 * or whose cross-product magnitude is below the area epsilon.
 *
 * Touches `indices` only — vertex arrays
 * (`positionsCompressed` / `normalsCompressed` / `uvsCompressed` /
 * `edgeIndices`) are left intact, so geometries that survive the
 * filter still have a valid AABB and stable vertex slots. The
 * companion {@link compactUnusedVertices} can then sweep up any
 * vertex slots that became unused as a side-effect.
 *
 * Idempotent: returns `{fixed: false}` when no triangles meet the
 * degenerate criterion. The geometry's `indices` field is mutated
 * in place via typed cast (the same pattern
 * {@link addMissingUVs} uses for `uvsCompressed`).
 */
export const dropDegenerateTriangles: Fix = {

  codes: ["GEOMETRY_DEGENERATE_TRIANGLES"],

  description: "Drop zero-area triangles",

  procedure: [
    "Visit each triangle",
    "Skip any triangle with two vertices in the same slot",
    "Skip any triangle whose three vertices are collinear (zero area)",
    "Keep the rest in a new triangle list",
    "Replace the geometry's triangle list with the kept triangles",
  ],

  apply(issue: Issue, sceneModel: SceneModel): SDKResult<FixApplyResult> {
    const geomId = issue.resourceId;
    if (!geomId) {
      return {
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: `[dropDegenerateTriangles] issue has no resourceId (geometry id)`,
      };
    }
    const geom = sceneModel.geometries[geomId];
    if (!geom || geom.destroyed) {
      return {ok: true, value: {fixed: false, reason: "target-missing"}};
    }
    if (!geom.indices || !geom.positionsCompressed || !geom.aabb) {
      return {ok: true, value: {fixed: false, reason: "malformed-issue"}};
    }
    const indices = geom.indices;
    const triCount = (indices.length / 3) | 0;
    if (triCount === 0) {
      return {ok: true, value: {fixed: false, reason: "no-op"}};
    }

    const keep = new Uint8Array(triCount);
    let kept = 0;
    let positions: Float32Array | null = null;

    for (let t = 0; t < triCount; t++) {
      const i0 = indices[t * 3];
      const i1 = indices[t * 3 + 1];
      const i2 = indices[t * 3 + 2];
      if (i0 === i1 || i1 === i2 || i0 === i2) continue;

      if (!positions) {
        positions = decompressPositions3WithAABB3(geom.positionsCompressed, geom.aabb) as Float32Array;
      }
      const ax = positions[i0 * 3], ay = positions[i0 * 3 + 1], az = positions[i0 * 3 + 2];
      const ex1 = positions[i1 * 3]     - ax;
      const ey1 = positions[i1 * 3 + 1] - ay;
      const ez1 = positions[i1 * 3 + 2] - az;
      const ex2 = positions[i2 * 3]     - ax;
      const ey2 = positions[i2 * 3 + 1] - ay;
      const ez2 = positions[i2 * 3 + 2] - az;
      const nx = ey1 * ez2 - ez1 * ey2;
      const ny = ez1 * ex2 - ex1 * ez2;
      const nz = ex1 * ey2 - ey1 * ex2;
      if (nx * nx + ny * ny + nz * nz <= DEGENERATE_AREA_EPS_SQ) continue;

      keep[t] = 1;
      kept++;
    }

    if (kept === triCount) {
      return {ok: true, value: {fixed: false, reason: "no-op"}};
    }
    const out = new Uint32Array(kept * 3);
    let w = 0;
    for (let t = 0; t < triCount; t++) {
      if (!keep[t]) continue;
      out[w++] = indices[t * 3];
      out[w++] = indices[t * 3 + 1];
      out[w++] = indices[t * 3 + 2];
    }
    (geom as { indices: typeof out }).indices = out;
    const dropped = triCount - kept;
    return {ok: true, value: {fixed: true, trace: `'${geomId}': dropped ${dropped.toLocaleString()} of ${triCount.toLocaleString()} triangles`}};
  },
};
