/**
 * {@link SceneObject} creation parameters for {@link SceneModel.createObject}.
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
}