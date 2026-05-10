import type {SceneModel} from "../../scene";
import type {Inspection} from "../Inspection";
import type {Issue} from "../Issue";
import {isFiniteMat4} from "./util";


/**
 * Per-mesh integrity walk — every {@link SceneMesh}'s reference into
 * `geometries`, `materials`, and `transforms` resolves, and every
 * mesh.matrix is finite.
 *
 *   - `MESH_DANGLING_GEOMETRY`   missing SceneGeometry
 *   - `MESH_DANGLING_MATERIAL`   missing SceneMaterial
 *   - `MESH_DANGLING_TRANSFORM`  missing SceneTransform parent
 *   - `MESH_NONFINITE_MATRIX`    NaN / Infinity in mesh.matrix
 *
 * No `highlight` payload — the affected meshes typically don't
 * render anything the user can locate. Triage manually.
 */
export const meshReferences: Inspection = {

  codes: [
    "MESH_DANGLING_GEOMETRY",
    "MESH_DANGLING_MATERIAL",
    "MESH_DANGLING_TRANSFORM",
    "MESH_NONFINITE_MATRIX",
  ],

  description: "Mesh references",

  labels: {
    MESH_DANGLING_GEOMETRY:  "Mesh — missing geometry",
    MESH_DANGLING_MATERIAL:  "Mesh — missing material",
    MESH_DANGLING_TRANSFORM: "Mesh — missing transform",
    MESH_NONFINITE_MATRIX:   "Mesh — non-finite matrix",
  },

  descriptions: {
    MESH_DANGLING_GEOMETRY:
      "Mesh references a SceneGeometry id that isn't present in the SceneModel. The mesh has nothing to draw.",
    MESH_DANGLING_MATERIAL:
      "Mesh references a SceneMaterial id that isn't present in the SceneModel. Shading falls back to the renderer default.",
    MESH_DANGLING_TRANSFORM:
      "Mesh references a SceneTransform id that isn't present in the SceneModel. Its placement is undefined.",
    MESH_NONFINITE_MATRIX:
      "Mesh's local matrix contains NaN or ±Infinity, so its world placement is undefined and downstream culling and picking break.",
  },

  run(sceneModel: SceneModel): Issue[] {
    const issues: Issue[] = [];
    for (const meshId in sceneModel.meshes) {
      const mesh = sceneModel.meshes[meshId];
      if (mesh.destroyed) continue;

      if (!sceneModel.geometries[mesh.geometryId]) {
        issues.push({
          severity: "error",
          code:     "MESH_DANGLING_GEOMETRY",
          message:  `SceneMesh '${meshId}' references missing SceneGeometry '${mesh.geometryId}'`,
          summary:  `→ missing '${mesh.geometryId}'`,
          resourceId: meshId,
        });
      }
      if (mesh.materialId && !sceneModel.materials[mesh.materialId]) {
        issues.push({
          severity: "error",
          code:     "MESH_DANGLING_MATERIAL",
          message:  `SceneMesh '${meshId}' references missing SceneMaterial '${mesh.materialId}'`,
          summary:  `→ missing '${mesh.materialId}'`,
          resourceId: meshId,
        });
      }
      const parent = mesh.parentTransform;
      if (parent && !sceneModel.transforms[parent.id]) {
        issues.push({
          severity: "error",
          code:     "MESH_DANGLING_TRANSFORM",
          message:  `SceneMesh '${meshId}' references missing SceneTransform '${parent.id}'`,
          summary:  `→ missing '${parent.id}'`,
          resourceId: meshId,
        });
      }
      if (mesh.matrix && !isFiniteMat4(mesh.matrix)) {
        issues.push({
          severity: "error",
          code:     "MESH_NONFINITE_MATRIX",
          message:  `SceneMesh '${meshId}' matrix contains NaN or Infinity`,
          resourceId: meshId,
        });
      }
    }
    return issues;
  },
};
