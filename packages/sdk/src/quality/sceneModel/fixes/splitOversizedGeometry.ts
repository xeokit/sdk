import type {SceneModel} from "../../../model/scene";
import {SDKErrorType, type SDKResult} from "../../../base/core";
import {splitGeometryAndRebuildMeshes} from "../internal/splitGeometryAndRebuildMeshes";
import type {Fix, FixApplyResult} from "../Fix";
import type {Issue} from "../Issue";


/**
 * Auto-fix for `GEOMETRY_ARRAY_OVERSIZED` — geometries whose raw
 * `positionsCompressed`, `indices`, `edgeIndices`,
 * `normalsCompressed`, `uvsCompressed`, or `colorsCompressed`
 * array lengths exceed the configured
 * per-geometry batch-portion thresholds.
 *
 * Mechanically identical to {@link splitDenseGeometry} and
 * {@link splitLargeGeometry}: splits the targeted geometry once
 * via {@link splitSceneGeometry} (whole-triangle midpoint
 * partition), fans every referencing {@link model!scene.SceneMesh | SceneMesh}
 * onto the two pieces, destroys the source. Only the trigger
 * condition differs — this strategy targets geometries whose
 * array lengths would trip the `WebGLRenderer`'s
 * `GPUMemoryBatch.addMesh` portion-allocation guard at upload
 * time.
 *
 * **One split per apply.** A piece that still exceeds any of the
 * configured array-length thresholds after this single split is
 * flagged again on the next inspection pass; an outer loop (or
 * {@link optimizeSceneModel}) re-runs `applyFixes` until the
 * report converges. Matches the rest of the geometry-split fixes
 * — IDE-style "one fix = one specific action".
 */
export const splitOversizedGeometry: Fix = {

  codes: ["GEOMETRY_ARRAY_OVERSIZED"],

  description: "Split geometry with oversized vertex / index arrays in half",

  procedure: [
    "Split the geometry into two halves at its midpoint",
    "Note every mesh that used the original geometry",
    "Replace each mesh with two copies, one per half",
    "Carry over the original placement, color, opacity, and material",
    "Re-attach the new meshes to their original objects",
    "Destroy the original geometry",
  ],

  config: {
    enabled: {
      kind: "boolean",
      key: "enableSplitOversizedGeometry",
      label: "Split oversized geometry in half",
      default: true,
    },
  },

  apply(issue: Issue, sceneModel: SceneModel): SDKResult<FixApplyResult> {
    const geomId = issue.resourceId;
    if (!geomId) {
      return {
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: `[splitOversizedGeometry] issue has no resourceId (oversized-array geometry id)`,
      };
    }
    return splitGeometryAndRebuildMeshes(sceneModel, geomId);
  },
};
