import type {SceneModel} from "../../scene";
import {SDKErrorType, type SDKResult} from "../../core";
import {splitGeometryAndRebuildMeshes} from "../internal/splitGeometryAndRebuildMeshes";
import type {Fix, FixApplyResult} from "../Fix";
import type {Issue} from "../Issue";


/**
 * Auto-fix for `GEOMETRY_OVER_EXTENT` — geometries flagged as
 * **large** (AABB extent exceeds the configured spatial budget on
 * at least one axis).
 *
 * Mechanically identical to
 * {@link splitDenseGeometry}: splits the targeted
 * geometry once via {@link splitSceneGeometry}, fans every
 * referencing mesh onto the two pieces, destroys the source. Only
 * the trigger condition differs — this strategy targets
 * geometries that are physically big in world units rather than
 * heavy on vertex / primitive count.
 *
 * **One split per apply.** A piece whose AABB still exceeds the
 * extent threshold is flagged again on the next inspection pass.
 * Convergence may be slow when triangles are evenly spread across
 * the AABB (each midpoint split halves the triangle count without
 * reliably halving extent); for those cases consider authoring or
 * loading the model with smaller pre-split geometries to begin
 * with, or feeding {@link splitSceneGeometry} a custom
 * `predicate` that partitions on a spatial criterion.
 */
export const splitLargeGeometry: Fix = {

  codes: ["GEOMETRY_OVER_EXTENT"],

  description: "Split large geometry in half",

  procedure: [
    "Split the geometry into two halves at its midpoint",
    "Note every mesh that used the original geometry",
    "Replace each mesh with two copies, one per half",
    "Carry over the original placement, color, opacity, and material",
    "Re-attach the new meshes to their original objects",
    "Destroy the original geometry",
  ],

  apply(issue: Issue, sceneModel: SceneModel): SDKResult<FixApplyResult> {
    const geomId = issue.resourceId;
    if (!geomId) {
      return {
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: `[splitLargeGeometry] issue has no resourceId (over-extent geometry id)`,
      };
    }
    return splitGeometryAndRebuildMeshes(sceneModel, geomId);
  },
};
