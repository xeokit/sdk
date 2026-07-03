import type {SceneModel} from "../../../model/scene";
import type {SDKResult} from "../../../base/core";
import {SDKErrorType} from "../../../base/core";
import type {Fix, FixApplyResult} from "../Fix";
import type {Issue} from "../Issue";


/**
 * Auto-fix for `GEOMETRY_DUPLICATE`.
 *
 * Reads `context.duplicates` (the duplicate-geometry ids the
 * inspection found) plus `issue.resourceId` (the canonical id) and
 * for every mesh that points at any of the duplicates, rebuilds it
 * against the canonical geometry using the supported detach +
 * destroy + recreate + reattach pattern, preserving mesh creation
 * fields such as material and bin. Once no live mesh references a
 * duplicate, the duplicate geometry is destroyed.
 *
 * Constraints:
 *
 *   - Defensive: any duplicate id that still has a referencing
 *     mesh after the rebuild loop (shouldn't happen given correct
 *     inspection input, but guards against malformed reports) is
 *     left in place rather than destroyed mid-bind.
 */
export const mergeDuplicateGeometries: Fix = {

  codes: ["GEOMETRY_DUPLICATE"],

  description: "Coalesce duplicate geometries",

  procedure: [
    "Note every mesh that pointed at a duplicate geometry",
    "Detach and destroy each of those meshes",
    "Re-create each mesh against the canonical geometry, preserving its placement, color, opacity, material, bin, and parent",
    "Re-attach each new mesh to its original object",
    "Destroy the now-unused duplicate geometries",
  ],

  config: {
    enabled: {
      kind: "boolean",
      key: "enableMergeDuplicateGeometries",
      label: "Coalesce duplicate geometries",
      default: true,
    },
  },

  apply(issue: Issue, sceneModel: SceneModel): SDKResult<FixApplyResult> {
    const canonicalId = issue.resourceId;
    if (!canonicalId) {
      return {
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: `[mergeDuplicateGeometries] issue has no resourceId (canonical geometry id)`,
      };
    }
    const ctx = issue.context;
    const rawDupes = ctx ? ctx.duplicates : undefined;
    const duplicates = (Array.isArray(rawDupes) && rawDupes.every(x => typeof x === "string"))
      ? (rawDupes as string[])
      : undefined;
    if (!duplicates || duplicates.length === 0) {
      return {ok: true, value: {fixed: false, reason: "malformed-issue"}};
    }
    const canonical = sceneModel.geometries[canonicalId];
    if (!canonical || canonical.destroyed) {
      return {ok: true, value: {fixed: false, reason: "target-missing"}};
    }

    // Snapshot every mesh that points at any of the duplicate ids
    // up-front — the rebuild loop destroys + recreates meshes,
    // which would invalidate live iteration of `sceneModel.meshes`.
    const dupSet = new Set(duplicates);
    const targets: Array<{
      sceneObjectId: string;
      snap: {
        id:                string;
        matrix:            Float64Array<any>;
        color:             [number, number, number];
        opacity:           number;
        materialId:        string | undefined;
        bin:               string | undefined;
        parentTransformId: string | undefined;
      };
    }> = [];
    for (const meshId in sceneModel.meshes) {
      const mesh = sceneModel.meshes[meshId];
      if (mesh.destroyed) continue;
      if (!dupSet.has(mesh.geometryId)) continue;
      const obj = mesh.object;
      if (!obj || obj.destroyed) continue;
      targets.push({
        sceneObjectId: obj.id,
        snap: {
          id:                mesh.id,
          matrix:            new Float64Array(mesh.matrix),
          color:             [mesh.color[0], mesh.color[1], mesh.color[2]],
          opacity:           mesh.opacity,
          materialId:        mesh.materialId,
          bin:               mesh.bin,
          parentTransformId: mesh.parentTransform ? mesh.parentTransform.id : undefined,
        },
      });
    }

    let rebuilt = 0;
    for (const {sceneObjectId, snap} of targets) {
      const obj = sceneModel.objects[sceneObjectId];
      if (!obj || obj.destroyed) continue;
      const mesh = sceneModel.meshes[snap.id];
      if (!mesh || mesh.destroyed) continue;

      const rRes = obj.removeMesh(snap.id);
      if (rRes.ok === false) return rRes;
      const dRes = mesh.destroy();
      if (dRes.ok === false) return dRes;

      const cRes = sceneModel.createMesh({
        id:         snap.id,
        geometryId: canonicalId,
        matrix:     snap.matrix,
        color:      snap.color,
        opacity:    snap.opacity,
        ...(snap.materialId ? {materialId: snap.materialId} : {}),
        ...(snap.bin !== undefined ? {bin: snap.bin} : {}),
      });
      if (cRes.ok === false) return cRes;
      const aRes = obj.addMesh(cRes.value.id);
      if (aRes.ok === false) return aRes;
      if (snap.parentTransformId) {
        const tRes = cRes.value.setParentTransformId(snap.parentTransformId);
        if (tRes.ok === false) return tRes;
      }
      rebuilt++;
    }

    // Destroy duplicate geometries. Skip any that still have
    // referencing meshes — defensive guard against malformed
    // reports that misname a canonical id.
    const stillReferenced = new Set<string>();
    for (const meshId in sceneModel.meshes) {
      const mesh = sceneModel.meshes[meshId];
      if (mesh.destroyed) continue;
      stillReferenced.add(mesh.geometryId);
    }
    const destroyed: string[] = [];
    const leftReferenced: string[] = [];
    for (const dupId of duplicates) {
      if (stillReferenced.has(dupId)) {
        leftReferenced.push(dupId);
        continue;
      }
      const dup = sceneModel.geometries[dupId];
      if (!dup || dup.destroyed) continue;
      const r = dup.destroy();
      if (r.ok === false) return r;
      destroyed.push(dupId);
    }

    const did = rebuilt > 0 || destroyed.length > 0;
    if (!did) {
      return {
        ok: true,
        value: {
          fixed: false,
          reason: leftReferenced.length > 0 ? "precondition-failed" : "target-missing",
        },
      };
    }
    const traceParts = [
      `'${canonicalId}' kept`,
      `merged ${rebuilt} mesh${rebuilt === 1 ? "" : "es"}`,
    ];
    if (destroyed.length > 0) {
      traceParts.push(`destroyed: ${destroyed.join(", ")}`);
    }
    if (leftReferenced.length > 0) {
      traceParts.push(`left referenced: ${leftReferenced.join(", ")}`);
    }
    const trace = traceParts.join("; ");
    return {ok: true, value: {fixed: true, trace}};
  },
};
