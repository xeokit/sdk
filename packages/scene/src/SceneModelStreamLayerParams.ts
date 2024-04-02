
/**
 * Indicates storage to allocate in a renderer layer.
 *
 * Stored in {@link @scene/SceneModelStreamParams.layers | SceneModelStreamParams.layers}.
 */
export interface SceneModelStreamLayerParams {

    /**
     * Number of 32-bit geometry indices to allocate in the renderer layer.
     */
    numIndices32Bits: number;

    /**
     * Number of 16-bit geometry indices to allocate in the renderer layer.
     */
    numIndices16Bits: number;

    /**
     * Number of 8-bit geometry indices to allocate in the renderer layer.
     */
    numIndices8Bits: number;

    /**
     * Number of geometry vertices to allocate in the renderer layer.
     */
    numVertices: number;

    /**
     * Number of submeshes to allocate in the renderer layer.
     */
    numSubMeshes: number;
}
