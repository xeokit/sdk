import type {SceneModel} from "../../scene";
import {findSceneObjectsForGeometry} from "../findSceneObjectsForGeometry";
import type {InspectSceneModelParams} from "../InspectSceneModelParams";
import type {Inspection} from "../Inspection";
import type {Issue} from "../Issue";
import type {SceneModelInspectionIndex} from "../SceneModelInspectionIndex";
import {getInspectionIndex} from "../getInspectionIndex";


/**
 * **Opt-in** ({@link InspectSceneModelParams.checkDuplicateGeometries}).
 * Detects byte-identical geometries by FNV-1a-hashing each
 * geometry's typed-array attributes plus its primitive constant
 * and AABB. Two geometries with the same fingerprint and lengths
 * are byte-identical (or birthday-paradox-collide; for ≪ 10⁶
 * geometries the false-positive rate is negligible).
 *
 * Each duplicate cluster emits one `GEOMETRY_DUPLICATE` warning,
 * with `context.duplicates` listing the redundant ids and
 * `highlight.objectIds` covering every owning SceneObject across
 * the cluster.
 *
 * {@link mergeDuplicateGeometries} consumes the issues —
 * repoints every referencing mesh at the canonical id and destroys
 * the duplicates.
 */
export const duplicateGeometries: Inspection = {

  codes: ["GEOMETRY_DUPLICATE"],

  description: "Duplicate geometries (byte-identical)",

  labels: {
    GEOMETRY_DUPLICATE: "Duplicate geometry",
  },

  descriptions: {
    GEOMETRY_DUPLICATE:
      "Two or more geometries are byte-identical — same primitive, same vertex / index buffers, same AABB. The duplicates waste GPU memory and slot count; they can be merged so every referencing mesh shares one canonical geometry.",
  },

  optIn: true,
  paramsKey: "checkDuplicateGeometries",

  run(
    sceneModel: SceneModel,
    params: InspectSceneModelParams,
    index?: SceneModelInspectionIndex,
  ): Issue[] {
    if (!params.checkDuplicateGeometries) return [];
    const ix = index ?? getInspectionIndex(sceneModel);

    const issues: Issue[] = [];
    const buckets = new Map<string, string[]>();
    for (const id in sceneModel.geometries) {
      const geom = sceneModel.geometries[id];
      if (geom.destroyed) continue;
      const key = ix.contentHash(id);
      const arr = buckets.get(key);
      if (arr) arr.push(id);
      else buckets.set(key, [id]);
    }
    for (const ids of buckets.values()) {
      if (ids.length < 2) continue;
      const [keep, ...dupes] = ids;
      const owners: string[] = [];
      const ownerSeen = new Set<string>();
      for (const id of ids) {
        for (const objId of findSceneObjectsForGeometry(sceneModel, id)) {
          if (ownerSeen.has(objId)) continue;
          ownerSeen.add(objId);
          owners.push(objId);
        }
      }
      issues.push({
        severity: "warning",
        code:     "GEOMETRY_DUPLICATE",
        message:  `${ids.length} SceneGeometries share identical content (positions / indices / normals / UVs / AABB) — '${keep}' could absorb '${dupes.join("', '")}' via instancing`,
        summary:  `→ collapses ${dupes.length} other${dupes.length === 1 ? "" : "s"}`,
        resourceId: keep,
        context:   {duplicates: dupes},
        ...(owners.length > 0 ? {highlight: {objectIds: owners}} : {}),
      });
    }
    return issues;
  },
};
