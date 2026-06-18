import type {SceneModel} from "../../../model/scene";
import {SDKErrorType, type SDKResult} from "../../../base/core";
import {createMat4Float64, mulMat4, translationMat4v} from "../../../base/math/matrix";
import type {Fix, FixApplyResult} from "../Fix";
import {getInspectionIndex} from "../internal/getInspectionIndex";
import type {Issue} from "../Issue";


const RECENTER_EPS = 1e-6;


/**
 * Auto-fix for `GEOMETRY_FAR_FROM_ORIGIN` — relocates the offset
 * out of the geometry's quantisation range and into every
 * referencing mesh's matrix. Lighter than introducing a
 * `SceneTransform`: just two mutations per fix call (the
 * geometry's `aabb` and N `mesh.matrix` slots).
 *
 * **Why this preserves world positions.** With centroid
 * `c = (aabb_min + aabb_max) / 2`, dequantisation gives
 * `D = aabb_min + (aabb_max - aabb_min) · compressed/65535`.
 * Shifting the AABB by `-c` shifts dequantised positions by `-c`
 * uniformly. To keep world positions unchanged, every referencing
 * mesh's matrix must apply `+c`:
 *
 *   M (D)        = world position before
 *   M' (D - c)   = world position after
 *   M' = M · T(c) makes them equal because
 *     M' (D - c) = M T(c) (D - c) = M (D - c + c) = M D.
 *
 * Where `T(c)` is a pure-translation Mat4 with `c` in its
 * translation column. Applied as a right-multiplication on each
 * mesh's local matrix, so any parent SceneTransform chain
 * upstream is left alone.
 *
 * Idempotent: `{fixed: false}` when the centroid magnitude is
 * already below {@link RECENTER_EPS} (already centred or
 * sub-millimetre offset).
 *
 * Sibling fix considered: stash the offset in a new
 * SceneTransform parented to every referencing mesh. Heavier
 * (one new transform allocation, plus parent-transform
 * re-linking) but instances would share the offset rather than
 * repeating it on every mesh. Out of scope for this iteration.
 */
export const recenterGeometry: Fix = {

  codes: ["GEOMETRY_FAR_FROM_ORIGIN"],

  description: "Recenter geometry at origin",

  procedure: [
    "Compute the geometry's bounding-box center",
    "Build a translation matrix that re-applies that offset",
    "Push the offset into each referencing mesh's transform",
    "Shift the geometry's bounding box so it sits at the origin",
  ],

  config: {
    enabled: {
      kind: "boolean",
      key: "enableRecenterGeometry",
      label: "Recenter geometry at origin",
      default: true,
    },
  },

  apply(issue: Issue, sceneModel: SceneModel): SDKResult<FixApplyResult> {
    const geomId = issue.resourceId;
    if (!geomId) {
      return {
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: `[recenterGeometry] issue has no resourceId (geometry id)`,
      };
    }
    const geom = sceneModel.geometries[geomId];
    if (!geom || geom.destroyed) return {ok: true, value: {fixed: false, reason: "target-missing"}};
    const aabb = geom.aabb;
    if (!aabb || aabb.length < 6) return {ok: true, value: {fixed: false, reason: "malformed-issue"}};

    // Squared centroid magnitude from the shared inspection
    // index — short-circuits the fix when the centroid is
    // already at the origin (within epsilon) without recomputing.
    const distSq = getInspectionIndex(sceneModel).aabbCentroidMagSq(geomId);
    if (distSq < RECENTER_EPS * RECENTER_EPS) {
      return {ok: true, value: {fixed: false, reason: "no-op"}};
    }
    const cx = (aabb[0] + aabb[3]) * 0.5;
    const cy = (aabb[1] + aabb[4]) * 0.5;
    const cz = (aabb[2] + aabb[5]) * 0.5;

    // Right-multiplication by T(c) on every referencing mesh.
    const tMat = translationMat4v([cx, cy, cz] as any);
    const out  = createMat4Float64();
    for (const meshId in sceneModel.meshes) {
      const mesh = sceneModel.meshes[meshId];
      if (mesh.destroyed) continue;
      if (mesh.geometryId !== geomId) continue;
      mulMat4(mesh.matrix, tMat, out);
      mesh.matrix = out;
    }

    // Shift the AABB so the geometry is centred at origin.
    // Mutate via the same typed-cast pattern the other geometry
    // fixes use for `*Compressed` / `indices`. Allocating a fresh
    // typed array decouples the renderer's view of the AABB from
    // the original buffer.
    const newAABB = new Float32Array(6);
    newAABB[0] = aabb[0] - cx;
    newAABB[1] = aabb[1] - cy;
    newAABB[2] = aabb[2] - cz;
    newAABB[3] = aabb[3] - cx;
    newAABB[4] = aabb[4] - cy;
    newAABB[5] = aabb[5] - cz;
    (geom as { aabb: typeof newAABB }).aabb = newAABB;

    const offset = `(${cx.toFixed(1)}, ${cy.toFixed(1)}, ${cz.toFixed(1)})`;
    return {ok: true, value: {fixed: true, trace: `'${geomId}': AABB shifted by ${offset}; offset pushed into referencing mesh matrices`}};
  },
};
