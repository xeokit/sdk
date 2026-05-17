import type {SceneMesh, SceneModel} from "../../../model/scene";
import type {SDKResult} from "../../../base/core";
import {SDKErrorType} from "../../../base/core";
import type {Fix, FixApplyResult} from "../Fix";
import type {Issue} from "../Issue";


/**
 * Auto-fix for `OBJECT_DANGLING_MESH`.
 *
 * The SceneObject's `meshes` list still carries a SceneMesh that
 * has been destroyed (or was never registered in the SceneModel).
 * `SceneObject.removeMesh` refuses to operate on missing meshes —
 * it requires the mesh to exist in the model — so this strategy
 * splices the stale entry out of the array directly.
 *
 * The `meshes` array is `readonly` at the type level only; runtime
 * mutation is the SDK-internal pattern for this rare case. After
 * the splice the SceneObject is well-formed again.
 *
 * The fix scans every entry in the SceneObject's `meshes` array
 * (not just the one named in `context.danglingMeshId`) so a single
 * pass clears every dangling reference, even if the inspection
 * only flagged one.
 */
export const pruneDanglingMeshRefs: Fix = {

  codes: ["OBJECT_DANGLING_MESH"],

  description: "Drop dangling mesh references",

  procedure: [
    "Walk the object's mesh list",
    "Remove any entry that's missing or destroyed",
  ],

  config: {
    enabled: {
      kind: "boolean",
      key: "enablePruneDanglingMeshRefs",
      label: "Drop dangling mesh references",
      default: true,
    },
  },

  apply(issue: Issue, sceneModel: SceneModel): SDKResult<FixApplyResult> {
    const objId = issue.resourceId;
    if (!objId) {
      return {
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: `[pruneDanglingMeshRefs] issue has no resourceId (SceneObject id)`,
      };
    }
    const obj = sceneModel.objects[objId];
    if (!obj || obj.destroyed) {
      return {ok: true, value: {fixed: false, reason: "target-missing"}};
    }
    const ctx = issue.context;
    const danglingId = (ctx && typeof ctx.danglingMeshId === "string") ? ctx.danglingMeshId : "";

    const meshes = obj.meshes as unknown as SceneMesh[];
    let removed = 0;
    for (let i = meshes.length - 1; i >= 0; i--) {
      const m = meshes[i];
      const looksDangling = !m
        || m.destroyed
        || !sceneModel.meshes[m.id]
        || (danglingId && m.id === danglingId);
      if (looksDangling) {
        meshes.splice(i, 1);
        removed++;
      }
    }
    if (removed === 0) return {ok: true, value: {fixed: false, reason: "no-op"}};
    return {ok: true, value: {fixed: true, trace: `'${objId}': removed ${removed} stale ref${removed === 1 ? "" : "s"}`}};
  },
};
