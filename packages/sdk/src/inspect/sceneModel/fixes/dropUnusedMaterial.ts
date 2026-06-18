import type {SceneModel} from "../../../model/scene";
import {SDKErrorType, type SDKResult} from "../../../base/core";
import type {Fix, FixApplyResult} from "../Fix";
import type {Issue} from "../Issue";


/**
 * Auto-fix for `MATERIAL_UNUSED` — destroys a SceneMaterial that
 * no SceneMesh references. {@link SceneMaterial.destroy} refuses
 * if any mesh still binds the material, so the inspection's "no
 * referencing mesh" precondition is also the destroy guard's
 * precondition; failure here means the inspection emitted a stale
 * issue (raced with another fix) and we report the SDK error.
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
    const dRes = mat.destroy();
    if (dRes.ok === false) return dRes;
    return {ok: true, value: {fixed: true, trace: `destroyed material '${matId}'`}};
  },
};
