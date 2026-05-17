import type {SceneModel} from "../../../model/scene";
import {SDKErrorType, type SDKResult} from "../../../base/core";
import type {Fix, FixApplyResult} from "../Fix";
import type {Issue} from "../Issue";


/**
 * Auto-fix for `TRANSFORM_IDENTITY` — re-parents every referencer
 * (meshes + child transforms) of an identity SceneTransform to its
 * grandparent (or detaches them if the identity is at the root),
 * then destroys it. World poses are preserved without
 * `preserveWorld: true` because the missing factor is the 4×4
 * identity — multiplying by it has no effect.
 *
 * `SceneTransform.destroy` would otherwise leave dangling
 * `mesh.parentTransform` references, since transforms (unlike
 * materials / textures) carry no destroy-time guard against mesh
 * referencers. This fix closes that gap explicitly.
 *
 * Idempotent: returns `{fixed: false}` when the transform is
 * already destroyed or absent.
 */
export const dropIdentityTransform: Fix = {

  codes: ["TRANSFORM_IDENTITY"],

  description: "Remove identity transforms",

  procedure: [
    "Find the identity transform and its parent (if any)",
    "Re-parent every mesh that pointed at it",
    "Re-parent every child transform that pointed at it",
    "Destroy the identity transform",
  ],

  config: {
    enabled: {
      kind: "boolean",
      key: "enableDropIdentityTransform",
      label: "Remove identity transforms",
      default: true,
    },
  },

  apply(issue: Issue, sceneModel: SceneModel): SDKResult<FixApplyResult> {
    const tId = issue.resourceId;
    if (!tId) {
      return {
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: `[dropIdentityTransform] issue has no resourceId (SceneTransform id)`,
      };
    }
    const t = sceneModel.transforms[tId];
    if (!t || t.destroyed) {
      return {ok: true, value: {fixed: false, reason: "target-missing"}};
    }
    const newParentId = t.parentTransform ? t.parentTransform.id : "";

    // Re-parent every mesh that pointed at the identity transform.
    for (const meshId in sceneModel.meshes) {
      const mesh = sceneModel.meshes[meshId];
      if (mesh.destroyed) continue;
      if (!mesh.parentTransform || mesh.parentTransform.id !== tId) continue;
      const r = mesh.setParentTransformId(newParentId);
      if (r.ok === false) return r;
    }

    // Re-parent every child SceneTransform.
    for (const tId2 in sceneModel.transforms) {
      const other = sceneModel.transforms[tId2];
      if (other.destroyed || other.id === tId) continue;
      if (!other.parentTransform || other.parentTransform.id !== tId) continue;
      const r = other.setParentTransformId(newParentId);
      if (r.ok === false) return r;
    }

    const dRes = t.destroy();
    if (dRes && (dRes as SDKResult<unknown>).ok === false) {
      return dRes as SDKResult<FixApplyResult>;
    }
    const traceParent = newParentId ? `'${newParentId}'` : "root";
    return {ok: true, value: {fixed: true, trace: `'${tId}' → re-parented to ${traceParent}, destroyed`}};
  },
};
