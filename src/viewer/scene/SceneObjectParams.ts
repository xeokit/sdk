/**
 * {@link SceneObject} creation parameters for {@link SceneModel.createSceneObject}.
 */
export interface SceneObjectParams {

    /**
     * Unique ID for the SceneObject.
     */
    id?: string;

    /**
     * IDs of meshes previously created with {@link SceneModel.createMesh}.
     */
    meshIds: string[];

    /**
     * Optional ID of a {@link Transform} previously created with {@link SceneModel.createTransform}.
     */
    transformId?: string;
}