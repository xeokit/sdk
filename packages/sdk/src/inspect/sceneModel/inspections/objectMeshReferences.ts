import type {SceneModel} from "../../../model/scene";
import type {Inspection} from "../Inspection";
import type {Issue} from "../Issue";


/**
 * Walks every {@link model!scene.SceneObject | SceneObject} and emits `OBJECT_DANGLING_MESH`
 * for each entry in `obj.meshes` that is null, destroyed, or absent
 * from `sceneModel.meshes`.
 *
 * The owning SceneObject still renders (its surviving meshes do),
 * so the issue carries a `highlight` payload pointing at the
 * SceneObject — locating it in the Viewer is useful even when one
 * of its meshes is gone. {@link pruneDanglingMeshRefs}
 * splices the stale entry out.
 */
export const objectMeshReferences: Inspection = {

  codes: ["OBJECT_DANGLING_MESH"],

  description: "Object mesh references",

  labels: {
    OBJECT_DANGLING_MESH: "Object — missing mesh",
  },

  descriptions: {
    OBJECT_DANGLING_MESH:
      "Object references a SceneMesh that has been destroyed or never existed. The dangling slot inflates the meshes array but contributes nothing to render.",
  },

  run(sceneModel: SceneModel): Issue[] {
    const issues: Issue[] = [];
    for (const objId in sceneModel.objects) {
      const obj = sceneModel.objects[objId];
      if (obj.destroyed) continue;
      for (const m of obj.meshes) {
        if (!m || m.destroyed || !sceneModel.meshes[m.id]) {
          const danglingMeshId = m ? m.id : "";
          issues.push({
            severity: "error",
            code:     "OBJECT_DANGLING_MESH",
            message:  `SceneObject '${objId}' references missing or destroyed SceneMesh '${danglingMeshId || "<null>"}'`,
            summary:  danglingMeshId ? `missing '${danglingMeshId}'` : "missing mesh ref",
            resourceId: objId,
            context:   {danglingMeshId},
            highlight: {objectIds: [objId]},
          });
        }
      }
    }
    return issues;
  },
};
