import type {SceneModel} from "../../../model/scene";
import {SDKErrorType, type SDKResult} from "../../../base/core";
import type {Fix, FixApplyResult} from "../Fix";
import type {Issue} from "../Issue";


/**
 * Auto-fix for `OBJECT_DUPLICATE_AABB` — destroys every duplicate
 * SceneObject listed in `context.duplicates`, leaving the
 * canonical (`issue.resourceId`) one in place.
 *
 * SceneObject.destroy() doesn't cascade-destroy meshes — meshes
 * left attached to a destroyed object would dangle. The fix
 * detaches each mesh first (`obj.removeMesh`), then destroys the
 * mesh (`mesh.destroy` refuses while attached), then destroys the
 * object. Geometries the duplicate referenced are not touched —
 * if they become unreferenced, the existing
 * {@link unusedResources} flow can clean them up on a
 * subsequent pass.
 *
 * Idempotent: returns `{fixed: false}` when every listed
 * duplicate is already missing or destroyed.
 */
export const dropDuplicateObject: Fix = {

  codes: ["OBJECT_DUPLICATE_AABB"],

  description: "Destroy duplicate objects",

  procedure: [
    "Find the redundant duplicate objects",
    "For each duplicate, detach every mesh from the object",
    "Destroy each detached mesh",
    "Destroy the now-empty object",
  ],

  config: {
    enabled: {
      kind: "boolean",
      key: "enableDropDuplicateObject",
      label: "Destroy duplicate objects",
      default: true,
    },
  },

  apply(issue: Issue, sceneModel: SceneModel): SDKResult<FixApplyResult> {
    const ctx = issue.context;
    const rawDupes = ctx ? ctx.duplicates : undefined;
    const duplicates = (Array.isArray(rawDupes) && rawDupes.every(x => typeof x === "string"))
      ? (rawDupes as string[])
      : undefined;
    if (!duplicates || duplicates.length === 0) {
      return {ok: true, value: {fixed: false, reason: "malformed-issue"}};
    }

    let removed = 0;
    const removedIds: string[] = [];
    for (const dupId of duplicates) {
      const obj = sceneModel.objects[dupId];
      if (!obj || obj.destroyed) continue;

      // Snapshot the mesh ids before mutation — `obj.removeMesh`
      // splices the meshes array under us.
      const meshIds: string[] = [];
      for (const mesh of obj.meshes) {
        if (!mesh || mesh.destroyed) continue;
        meshIds.push(mesh.id);
      }

      for (const meshId of meshIds) {
        const mesh = sceneModel.meshes[meshId];
        if (!mesh || mesh.destroyed) continue;
        const rRes = obj.removeMesh(meshId);
        if (rRes.ok === false) return rRes;
        const dRes = mesh.destroy();
        if (dRes.ok === false) return dRes;
      }

      const oRes = obj.destroy();
      if (oRes.ok === false) return oRes;
      removed++;
      removedIds.push(dupId);
    }

    if (removed === 0) return {ok: true, value: {fixed: false, reason: "target-missing"}};
    const trace = `'${issue.resourceId ?? "?"}' kept; destroyed: ${removedIds.join(", ")}`;
    return {ok: true, value: {fixed: true, trace}};
  },
};
