
/**
 * Indicates storage to allocate in a renderer layer.
 *
 * Stored in {@link @scene/SceneModelStreamParams.layers | SceneModelStreamParams.layers}.
 */
export interface SceneModelStreamLayerParams {

    /**
     * Number of 32-bit geometry indices to allocate in the renderer layer.
     */
    numIndices: number;

    /**
     * Number of geometry vertices to allocate in the renderer layer.
     */
    numVertices: number;

    /**
     * Number of layer meshes to allocate in the renderer layer.
     */
    numLayerMeshes: number;
}
