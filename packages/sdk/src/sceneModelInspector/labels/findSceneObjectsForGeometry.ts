import type {SceneModel} from "../../scene";


/**
 * Walk a {@link SceneModel}'s meshes, collect the ids of every
 * non-destroyed SceneObject that owns at least one mesh referencing
 * `geometryId`, and return them de-duplicated.
 *
 * This is the lookup the geometry-tied inspections need to populate
 * {@link Issue.highlight}: a problem is reported on a SceneGeometry,
 * but the user wants to *see* the affected SceneObjects in the
 * Viewer. A geometry can be referenced by zero, one, or many meshes
 * across many SceneObjects (instancing), so the result is a set —
 * order is the iteration order of `sceneModel.meshes`.
 *
 * Used by `inspectSceneModel` for `GEOMETRY_DUPLICATE`,
 * `GEOMETRY_SIMILAR`, `GEOMETRY_OVER_BUDGET`, `GEOMETRY_OVER_EXTENT`,
 * `MATERIAL_TEXTURED_GEOMETRY_NO_UVS`,
 * `MATERIAL_PBR_GEOMETRY_NO_NORMALS`. Returns an empty array when
 * the geometry is unreferenced or every owning mesh / object is
 * destroyed — caller decides whether to omit `highlight` entirely
 * in that case.
 *
 * @param sceneModel SceneModel to walk.
 * @param geometryId Geometry id to look up.
 * @returns De-duplicated SceneObject ids — empty when none qualify.
 */
export function findSceneObjectsForGeometry(
  sceneModel: SceneModel,
  geometryId: string,
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const meshId in sceneModel.meshes) {
    const mesh = sceneModel.meshes[meshId];
    if (mesh.destroyed) continue;
    if (mesh.geometryId !== geometryId) continue;
    const obj = mesh.object;
    if (!obj || obj.destroyed) continue;
    if (seen.has(obj.id)) continue;
    seen.add(obj.id);
    out.push(obj.id);
  }
  return out;
}
