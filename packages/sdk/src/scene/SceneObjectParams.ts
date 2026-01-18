/**
 * Parameters for a {@link SceneObject}.
 *
 * * Passed to  {@link SceneModel.createObject | SceneModel.createObject}
 * * Located at {@link SceneModelParams.objects | SceneModelParams.objects}
 *
 * See {@link scene | @xeokit/sdk/scene} for usage.
 */
export interface SceneObjectParams {

  /**
   * Unique ID for the SceneObject.
   */
  id: string;

  /**
   * ID of this SceneObject within the originating system, is any. Defaults to the value of
   * {@link SceneObjectParams.id | SceneObjectParams.id}.
   */
  originalSystemId?: string;

  /**
   * IDs of meshes previously created with {@link SceneModel.createMesh | SceneModel.createMesh}.
   */
  meshIds: string[];

  /**
   * Causes each {@link viewer!View} to put the corresponding {@link viewer!ViewObject | ViewObject} into
   * a {@link viewer!ViewLayer} with this ID.
   *
   * When you create an object in a model, each {@link viewer!View} will automatically create
   * a {@link viewer!ViewObject | ViewObject} to
   * represent it. When the object has a {@link SceneObjectParams.layerId} property, then each View will first
   * ensure that it has a {@link viewer!ViewLayer} with this ID, and will register the ViewObject in that ViewLayer.
   *
   * Overridden by {@link SceneObjectParams.layerId | SceneObjectParams.layerId}.
   */
  layerId?: string;
}
