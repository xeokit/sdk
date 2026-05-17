/**
 * Summary statistics returned by {@link buildSectionCaps} on success.
 */
export interface BuildSectionCapsResult {

  /**
   * Number of source {@link model!scene.SceneObject | SceneObjects} that
   * produced at least one cap. Equals the number of new objects
   * created in the target {@link model!scene.SceneModel | SceneModel}.
   */
  numObjectsWithCaps: number;

  /**
   * Total number of cap {@link model!scene.SceneMesh | SceneMeshes}
   * emitted into the target {@link model!scene.SceneModel | SceneModel}, summed
   * across all source objects and cap planes.
   */
  numCapMeshes: number;

  /**
   * Number of source meshes whose cap segments could not be
   * stitched into a closed loop (typically caused by non-watertight
   * source geometry). Those meshes contributed no cap to the target
   * model. Diagnostic only — callers can ignore unless surface
   * quality matters.
   */
  numUnclosedMeshes: number;
}
