import type {SceneModel} from "../../scene";
import type {Inspection} from "../Inspection";
import type {Issue} from "../Issue";
import {isTriangleMesh} from "./util";


/**
 * Cross-check every (mesh, material, geometry) triple — flags
 * material → geometry attribute mismatches that render but waste
 * GPU or render flat:
 *
 *   - `MATERIAL_TEXTURED_GEOMETRY_NO_UVS` — colour-textured material,
 *     UV-less geometry; sampling is undefined.
 *   - `MATERIAL_PBR_GEOMETRY_NO_NORMALS` — PBR / normals texture,
 *     normals-less triangle geometry; shading falls back to flat.
 *
 * Both fixable in place by the matching `ensureGeometry…Fix`
 * — populates `context.geometryId` / `context.materialId` so the
 * fixer doesn't have to re-derive. Every issue carries a `highlight`
 * payload pointing at the owning SceneObject so the example UI can
 * locate the affected element in the Viewer.
 */
export const materialAttributeBinding: Inspection = {

  codes: [
    "MATERIAL_TEXTURED_GEOMETRY_NO_UVS",
    "MATERIAL_PBR_GEOMETRY_NO_NORMALS",
  ],

  description: "Material / geometry attribute mismatches",

  labels: {
    MATERIAL_TEXTURED_GEOMETRY_NO_UVS: "Textured material on UV-less geometry",
    MATERIAL_PBR_GEOMETRY_NO_NORMALS:  "PBR material on normals-less geometry",
  },

  descriptions: {
    MATERIAL_TEXTURED_GEOMETRY_NO_UVS:
      "Material samples a texture, but the geometry has no UV coordinates — texture lookup falls back to (0, 0) and the surface looks flat-coloured.",
    MATERIAL_PBR_GEOMETRY_NO_NORMALS:
      "PBR material needs surface normals to evaluate lighting, but the geometry has none — shading collapses to ambient.",
  },

  run(sceneModel: SceneModel): Issue[] {
    const issues: Issue[] = [];
    for (const meshId in sceneModel.meshes) {
      const mesh = sceneModel.meshes[meshId];
      if (mesh.destroyed) continue;

      const material = mesh.materialId ? sceneModel.materials[mesh.materialId] : undefined;
      const geom = sceneModel.geometries[mesh.geometryId];
      if (!material || !geom || geom.destroyed) continue;

      const hasUVs = !!geom.uvsCompressed && (geom.uvsCompressed as ArrayLike<number>).length > 0;
      const hasNormals = !!geom.normalsCompressed && (geom.normalsCompressed as ArrayLike<number>).length > 0;

      if (material.colorTexture && !hasUVs) {
        const objId = mesh.object?.id;
        issues.push({
          severity: "warning",
          code:     "MATERIAL_TEXTURED_GEOMETRY_NO_UVS",
          message:  `SceneMaterial '${material.id}' has a colour texture but bound geometry '${geom.id}' has no UVs — sampling is undefined; call ensureGeometryAttribs first`,
          summary:  `material '${material.id}' on geom '${geom.id}'`,
          resourceId: meshId,
          context:   {geometryId: geom.id, materialId: material.id},
          ...(objId ? {highlight: {objectIds: [objId]}} : {}),
        });
      }
      if ((material.normalsTexture || material.metallicRoughnessTexture) && !hasNormals && isTriangleMesh(geom)) {
        const objId = mesh.object?.id;
        issues.push({
          severity: "warning",
          code:     "MATERIAL_PBR_GEOMETRY_NO_NORMALS",
          message:  `SceneMaterial '${material.id}' uses PBR / normals textures but triangle geometry '${geom.id}' has no normals — shading falls back to flat`,
          summary:  `material '${material.id}' on geom '${geom.id}'`,
          resourceId: meshId,
          context:   {geometryId: geom.id, materialId: material.id},
          ...(objId ? {highlight: {objectIds: [objId]}} : {}),
        });
      }
    }
    return issues;
  },
};
