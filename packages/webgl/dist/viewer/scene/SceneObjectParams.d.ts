/**
 * {@link SceneObject} creation parameters for {@link SceneModel.createObject}.
 */
export interface SceneObjectParams {
    /**
     * Unique ID for the SceneObject.
     */
    id: string;
    /**
     * IDs of meshes previously created with {@link SceneModel.createMesh}.
     */
    meshIds: string[];
    /**
     * Causes each {@link View} to put the corresponding {@link ViewObject} into a {@link ViewLayer} with this ID.
     *
     * When you create a SceneObject, each {@link View} will automatically create a {@link ViewObject} to
     * represent it. When the SceneObject has a {@link SceneObject.viewLayerId} property, then each View will first ensure that it
     * has a {@link ViewLayer} with this ID, and will register the ViewObject in that ViewLayer.
     *
     * Overrides {@link SceneModelParams.viewLayerId}.
     */
    viewLayerId?: string;
}
