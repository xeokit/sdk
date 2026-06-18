import type {SceneModel} from "../../../model/scene";
import {SDKErrorType, type SDKResult} from "../../../base/core";
import type {Fix, FixApplyResult} from "../Fix";
import type {Issue} from "../Issue";


/**
 * Auto-fix for `TEXTURE_UNUSED` — destroys a SceneTexture that no
 * SceneMaterial binds. {@link SceneTexture.destroy} guards against
 * destruction while `numMaterials > 0`, so a stale issue (raced
 * with concurrent material reattachment) appears as the
 * underlying SDK error rather than a corruption.
 *
 * Idempotent: returns `{fixed: false}` when the texture is already
 * destroyed or absent.
 */
export const dropUnusedTexture: Fix = {

  codes: ["TEXTURE_UNUSED"],

  description: "Destroy unused textures",

  procedure: [
    "Find the unused texture",
    "Destroy it",
  ],

  config: {
    enabled: {
      kind: "boolean",
      key: "enableDropUnusedTexture",
      label: "Destroy unused textures",
      default: true,
    },
  },

  apply(issue: Issue, sceneModel: SceneModel): SDKResult<FixApplyResult> {
    const texId = issue.resourceId;
    if (!texId) {
      return {
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: `[dropUnusedTexture] issue has no resourceId (SceneTexture id)`,
      };
    }
    const tex = sceneModel.textures[texId];
    if (!tex || tex.destroyed) {
      return {ok: true, value: {fixed: false, reason: "target-missing"}};
    }
    const dRes = tex.destroy();
    if (dRes.ok === false) return dRes;
    return {ok: true, value: {fixed: true, trace: `destroyed texture '${texId}'`}};
  },
};
