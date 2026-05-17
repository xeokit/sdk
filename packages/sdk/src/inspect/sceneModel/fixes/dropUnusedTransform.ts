import type {SceneModel} from "../../../model/scene";
import {SDKErrorType, type SDKResult} from "../../../base/core";
import type {Fix, FixApplyResult} from "../Fix";
import type {Issue} from "../Issue";


/**
 * Auto-fix for `TRANSFORM_UNUSED` — destroys a SceneTransform with
 * nothing in its mesh-parent chain. Unlike `SceneMaterial` /
 * `SceneTexture`, {@link SceneTransform.destroy} doesn't guard
 * against mesh references — `unusedResources` is the
 * precondition, not the SDK. The fix double-checks (no mesh
 * references the transform, no live child transforms reference
 * it) before destroying, so a stale issue lands as
 * `{fixed: false}` rather than corrupting live mesh refs.
 *
 * Idempotent: returns `{fixed: false}` when the transform is
 * already destroyed, missing, or has live referencers.
 */
export const dropUnusedTransform: Fix = {

  codes: ["TRANSFORM_UNUSED"],

  description: "Destroy unused transforms",

  procedure: [
    "Find the unused transform",
    "Confirm no live mesh references it as a parent",
    "Confirm no live transform references it as a parent",
    "Destroy it",
  ],

  config: {
    enabled: {
      kind: "boolean",
      key: "enableDropUnusedTransform",
      label: "Destroy unused transforms",
      default: true,
    },
  },

  apply(issue: Issue, sceneModel: SceneModel): SDKResult<FixApplyResult> {
    const tId = issue.resourceId;
    if (!tId) {
      return {
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: `[dropUnusedTransform] issue has no resourceId (SceneTransform id)`,
      };
    }
    const t = sceneModel.transforms[tId];
    if (!t || t.destroyed) {
      return {ok: true, value: {fixed: false, reason: "target-missing"}};
    }

    for (const meshId in sceneModel.meshes) {
      const mesh = sceneModel.meshes[meshId];
      if (mesh.destroyed) continue;
      if (mesh.parentTransform && mesh.parentTransform.id === tId) {
        return {ok: true, value: {fixed: false, reason: "precondition-failed"}};
      }
    }
    for (const tId2 in sceneModel.transforms) {
      const other = sceneModel.transforms[tId2];
      if (other.destroyed || other.id === tId) continue;
      if (other.parentTransform && other.parentTransform.id === tId) {
        return {ok: true, value: {fixed: false, reason: "precondition-failed"}};
      }
    }

    const dRes = t.destroy();
    if (dRes && (dRes as SDKResult<unknown>).ok === false) {
      return dRes as SDKResult<FixApplyResult>;
    }
    return {ok: true, value: {fixed: true, trace: `destroyed transform '${tId}'`}};
  },
};
