import type {SceneModel} from "../../scene";
import {SDKErrorType, type SDKResult} from "../../core";
import {splitGeometryAndRebuildMeshes} from "../internal/splitGeometryAndRebuildMeshes";
import type {Fix, FixApplyResult} from "../Fix";
import type {Issue} from "../Issue";


/**
 * Auto-fix for `GEOMETRY_OVER_BUDGET` — geometries flagged as
 * **dense** (too many vertices and/or primitives for the
 * configured storage budget).
 *
 * Splits the targeted SceneGeometry once via
 * {@link splitSceneGeometry} (whole-triangle midpoint partition),
 * then redirects every {@link SceneMesh} that referenced the source
 * onto BOTH pieces — each source mesh becomes two new meshes
 * (`{id}_a` / `{id}_b`) attached to the same SceneObject with the
 * same matrix / opacity / parentTransform. The pre-split geometry
 * is destroyed once its referencing meshes have been redirected.
 *
 * **One split per apply.** A piece that's still over the budget
 * after this single split is flagged again on the next inspection
 * pass; an outer loop (or {@link optimizeSceneModel}) re-runs
 * `applyFixes` until the report converges. Matches IDE-style
 * "one fix = one specific action".
 *
 * Pairs with {@link splitLargeGeometry}, which handles
 * the spatial-extent failure mode (`GEOMETRY_OVER_EXTENT`). Both
 * strategies delegate the actual split + mesh fan-out to
 * {@link splitGeometryAndRebuildMeshes}; only the trigger code
 * differs.
 */
export const splitDenseGeometry: Fix = {

  codes: ["GEOMETRY_OVER_BUDGET"],

  description: "Split dense geometry in half",

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
        error: `[splitDenseGeometry] issue has no resourceId (over-budget geometry id)`,
      };
    }
    return splitGeometryAndRebuildMeshes(sceneModel, geomId);
  },
};
