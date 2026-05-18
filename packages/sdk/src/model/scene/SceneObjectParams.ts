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

  /**
   * Initial value of the corresponding
   * {@link viewing!viewer.ViewObject.clippable | ViewObject.clippable}
   * flag in every {@link viewing!viewer.View | View} that picks
   * this SceneObject up.
   *
   * Defaults to `true` — the ViewObject participates in section-
   * plane clipping like every other scene object.
   *
   * Pass `false` for objects that should remain visible (and
   * pickable) regardless of any active section planes — drawings,
   * annotations, tool overlays, or other "out-of-band" content
   * that isn't part of the model being cut. The flag is wired
   * through to the renderer's per-mesh `clippable` bit at the
   * point the ViewObject is constructed, so this is a per-
   * creation default rather than a runtime API; callers can
   * still flip the flag later via `view.objects[id].clippable`.
   */
  clippable?: boolean;
}
