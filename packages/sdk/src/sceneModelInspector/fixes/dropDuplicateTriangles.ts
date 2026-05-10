import type {SceneModel} from "../../scene";
import {SDKErrorType, type SDKResult} from "../../core";
import {SolidPrimitive, SurfacePrimitive, TrianglesPrimitive} from "../../constants";
import type {Fix, FixApplyResult} from "../Fix";
import {getInspectionIndex} from "../internal/getInspectionIndex";
import type {Issue} from "../Issue";


/**
 * Auto-fix for `GEOMETRY_DUPLICATE_INDICES` — rewrites
 * `geom.indices` keeping only the first occurrence of each
 * triangle (canonical key = sorted vertex tuple, so any rotation
 * or winding of the same vertex set collapses).
 *
 * Doesn't touch vertex arrays — duplicate indices waste
 * traversal / overdraw, not vertex storage. If the dropped
 * triangles' vertices become unreferenced, the matching
 * {@link compactUnusedVertices} cleans those up on a separate
 * pass.
 *
 * Degenerate triangles (any pair of repeated indices) are kept
 * as-is — they're handled by {@link dropDegenerateTriangles}.
 *
 * Idempotent: returns `{fixed: false}` when no triangle's
 * canonical key is seen twice.
 */
export const dropDuplicateTriangles: Fix = {

  codes: ["GEOMETRY_DUPLICATE_INDICES"],

  description: "Drop duplicate triangles",

  procedure: [
    "Visit each triangle",
    "Build a key by sorting its three vertex slots (so any rotation or winding matches)",
    "Keep the first triangle for each key; drop later duplicates",
    "Keep degenerate triangles as-is (handled by a separate fix)",
    "Replace the geometry's triangle list with the kept triangles",
  ],

  apply(issue: Issue, sceneModel: SceneModel): SDKResult<FixApplyResult> {
    const geomId = issue.resourceId;
    if (!geomId) {
      return {
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: `[dropDuplicateTriangles] issue has no resourceId (geometry id)`,
      };
    }
    const geom = sceneModel.geometries[geomId];
    if (!geom || geom.destroyed) return {ok: true, value: {fixed: false, reason: "target-missing"}};
    if (!geom.indices) return {ok: true, value: {fixed: false, reason: "malformed-issue"}};
    const isTri =
      geom.primitive === TrianglesPrimitive ||
      geom.primitive === SolidPrimitive ||
      geom.primitive === SurfacePrimitive;
    if (!isTri) return {ok: true, value: {fixed: false, reason: "precondition-failed"}};

    const indices = geom.indices;
    const triCount = (indices.length / 3) | 0;
    if (triCount === 0) return {ok: true, value: {fixed: false, reason: "no-op"}};

    // Per-triangle "kept" bitmap from the shared inspection index
    // — same canonicalisation the geometryQuality inspection
    // built when flagging this issue. `kept[t] === 1` iff `t`
    // was the first occurrence of its canonical key (or is
    // degenerate).
    const triInfo = getInspectionIndex(sceneModel).canonicalTriangleKeys(geomId);
    if (!triInfo) return {ok: true, value: {fixed: false, reason: "precondition-failed"}};
    const {kept, duplicateCount} = triInfo;
    if (duplicateCount === 0) return {ok: true, value: {fixed: false, reason: "no-op"}};
    const keptCount = triCount - duplicateCount;

    const out = new Uint32Array(keptCount * 3);
    let w = 0;
    for (let t = 0; t < triCount; t++) {
      if (!kept[t]) continue;
      out[w++] = indices[t * 3];
      out[w++] = indices[t * 3 + 1];
      out[w++] = indices[t * 3 + 2];
    }
    (geom as { indices: typeof out }).indices = out;
    return {ok: true, value: {fixed: true, trace: `'${geomId}': dropped ${duplicateCount.toLocaleString()} duplicate of ${triCount.toLocaleString()} triangles`}};
  },
};
