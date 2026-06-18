import type {SceneModel} from "../../../model/scene";


/**
 * Kind of resource a {@link Issue.resourceId | resourceId} refers
 * to. Exposed by {@link findResourceLabel} so a UI can pick the
 * right icon / category colour for the row without parsing the
 * issue's code prefix.
 */
export type ResourceKind =
  | "object"
  | "mesh"
  | "geometry"
  | "material"
  | "texture"
  | "transform";


/**
 * Result of {@link findResourceLabel}.
 */
export interface ResourceLabel {

  /**
   * Which resource map the id was found in.
   */
  kind: ResourceKind;

  /**
   * Optional friendly name. For SceneObject this is
   * `originalSystemId` when it differs from the bare `id` (IFC
   * loaders typically set it to a GUID; exporters set it to a
   * human-readable name). For meshes / geometries / materials /
   * textures / transforms the SDK has no friendly-name surface,
   * so this is left `undefined` — the caller falls back to
   * rendering the id alone.
   */
  name?: string;
}


/**
 * Look up an {@link Issue.resourceId | issue resourceId} in the
 * SceneModel's resource maps and report which kind it is plus,
 * for SceneObjects, a friendly name from `originalSystemId`.
 *
 * Issue codes don't map cleanly to resource kinds — for example
 * `MATERIAL_TEXTURED_GEOMETRY_NO_UVS` has the *mesh* id as its
 * resourceId, not the material's. So a UI rendering rows can't
 * derive the kind from the code prefix; it has to ask the
 * SceneModel directly. That's what this helper does.
 *
 * Returns `null` when the id isn't in any of the SceneModel's
 * resource maps (most commonly because the resource was
 * destroyed by an earlier fix run).
 */
export function findResourceLabel(
  sceneModel: SceneModel,
  resourceId: string,
): ResourceLabel | null {
  if (!resourceId) return null;

  const obj = sceneModel.objects[resourceId];
  if (obj && !obj.destroyed) {
    const sysId = obj.originalSystemId;
    return {
      kind: "object",
      name: sysId && sysId !== obj.id ? sysId : undefined,
    };
  }
  if (sceneModel.meshes[resourceId]      && !sceneModel.meshes[resourceId].destroyed)      return {kind: "mesh"};
  if (sceneModel.geometries[resourceId]  && !sceneModel.geometries[resourceId].destroyed)  return {kind: "geometry"};
  if (sceneModel.materials[resourceId]   && !sceneModel.materials[resourceId].destroyed)   return {kind: "material"};
  if (sceneModel.textures[resourceId]    && !sceneModel.textures[resourceId].destroyed)    return {kind: "texture"};
  if (sceneModel.transforms[resourceId]  && !sceneModel.transforms[resourceId].destroyed)  return {kind: "transform"};

  return null;
}
