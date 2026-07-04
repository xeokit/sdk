import type {SceneModel} from "../../../model/scene";
import {SDKErrorType, type SDKResult} from "../../../base/core";
import type {Fix, FixApplyResult} from "../Fix";
import type {Issue} from "../Issue";


/**
 * Auto-fix for `MATERIAL_UNUSED` — destroys a SceneMaterial that
 * no SceneMesh references. The fix checks live mesh references by
 * object identity before destroying; this lets it clean up models
 * whose `numMeshes` counter was left stale by a replaced same-id
 * material pointer.
 *
 * Idempotent: returns `{fixed: false}` when the material is
 * already destroyed or absent.
 */
export const dropUnusedMaterial: Fix = {

  codes: ["MATERIAL_UNUSED"],

  description: "Destroy unused materials",

  procedure: [
    "Find the unused material",
    "Destroy it (refused if any mesh still references it)",
  ],

  config: {
    enabled: {
      kind: "boolean",
      key: "enableDropUnusedMaterial",
      label: "Destroy unused materials",
      default: true,
    },
  },

  apply(issue: Issue, sceneModel: SceneModel): SDKResult<FixApplyResult> {
    const matId = issue.resourceId;
    if (!matId) {
      return {
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: `[dropUnusedMaterial] issue has no resourceId (SceneMaterial id)`,
      };
    }
    const mat = sceneModel.materials[matId];
    if (!mat || mat.destroyed) {
      return {ok: true, value: {fixed: false, reason: "target-missing"}};
    }

    for (const meshId in sceneModel.meshes) {
      const mesh = sceneModel.meshes[meshId];
      if (mesh.destroyed) continue;
      if (mesh.material === mat) {
        return {ok: true, value: {fixed: false, reason: "precondition-failed"}};
      }
    }

    const previousNumMeshes = mat.numMeshes;
    if (previousNumMeshes !== 0) {
      mat.numMeshes = 0;
    }
    const dRes = mat.destroy();
    if (dRes.ok === false) {
      mat.numMeshes = previousNumMeshes;
      return dRes;
    }
    return {ok: true, value: {fixed: true, trace: `destroyed material '${matId}'`}};
  },
};
