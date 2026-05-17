/**
 * Parameters for a {@link model!scene.SceneObject | SceneObject}.
 *
 * * Passed to  {@link SceneModel.createObject | SceneModel.createObject}
 * * Located at {@link SceneModelParams.objects | SceneModelParams.objects}
 *
 * See {@link scene | @xeokit/sdk/model/scene} for usage.
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
   * IDs of meshes previously created with {@link SceneModel.createMesh | SceneModel.addMesh}.
   */
  meshIds: string[];

  /**
   * Causes each {@link viewing!viewer.View | View} to put the corresponding {@link viewing!viewer.ViewObject | ViewObject} into
   * a {@link viewing!viewer.ViewLayer | ViewLayer} with this ID.
   *
   * When you create an object in a model, each {@link viewing!viewer.View | View} will automatically create
   * a {@link viewing!viewer.ViewObject | ViewObject} to
   * represent it. When the object has a {@link SceneObjectParams.layerId} property, then each View will first
   * ensure that it has a {@link viewing!viewer.ViewLayer | ViewLayer} with this ID, and will register the ViewObject in that ViewLayer.
   *
   * Overridden by {@link SceneObjectParams.layerId | SceneObjectParams.layerId}.
   */
  layerId?: string;
}
