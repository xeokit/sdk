import type {SceneModel} from "../../../model/scene";
import {getInspectionIndex} from "../internal/getInspectionIndex";


/**
 * Return the ids of every non-destroyed SceneObject that owns at least
 * one mesh referencing `geometryId`, de-duplicated.
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
 * Backed by the shared {@link SceneModelInspectionIndex}'s
 * `geometryObjects` reverse table: the first lookup builds the whole
 * geometry→objects map with one mesh walk, every later lookup is O(1).
 * This collapses the geometry-tied inspections from O(geometries ×
 * meshes) to O(geometries + meshes) when they populate
 * {@link Issue.highlight}.
 *
 * @param sceneModel SceneModel to look up in.
 * @param geometryId Geometry id to look up.
 * @returns De-duplicated SceneObject ids — empty when none qualify.
 */
export function findSceneObjectsForGeometry(
  sceneModel: SceneModel,
  geometryId: string,
): string[] {
  // Copy so callers own the array (they stash it in Issue.highlight):
  // the index's row is shared/cached and must not be mutated. O(owners),
  // which is small — the former O(meshes) scan is gone.
  return getInspectionIndex(sceneModel).geometryObjects(geometryId).slice();
}
