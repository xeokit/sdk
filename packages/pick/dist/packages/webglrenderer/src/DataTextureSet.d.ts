/**
 * @private
 */
import type { GLDataTexture } from "@xeokit/webglutils";
export declare class DataTextureSet {
    #private;
    positions: GLDataTexture | null;
    indices_8Bits: GLDataTexture | null;
    indices_16Bits: GLDataTexture | null;
    indices_32Bits: GLDataTexture | null;
    edgeIndices_8Bits: GLDataTexture | null;
    edgeIndices_16Bits: GLDataTexture | null;
    edgeIndices_32Bits: GLDataTexture | null;
    indices: {
        [key: number]: GLDataTexture | null;
    };
    edgeIndices: {
        [key: number]: GLDataTexture | null;
    } | null;
    eachMeshAttributes: GLDataTexture | null;
    eachMeshMatrices: GLDataTexture | null;
    eachEdgeOffset: GLDataTexture | null;
    eachPrimitiveMesh_8Bits: GLDataTexture | null;
    eachPrimitiveMesh_16Bits: GLDataTexture | null;
    eachPrimitiveMesh_32Bits: GLDataTexture | null;
    eachPrimitiveMesh: {
        [key: number]: GLDataTexture | null;
    } | null;
    eachEdgeMesh_8Bits: GLDataTexture | null;
    eachEdgeMesh_16Bits: GLDataTexture | null;
    eachEdgeMesh_32Bits: GLDataTexture | null;
    eachEdgeMesh: {
        [key: number]: GLDataTexture | null;
    } | null;
    constructor();
    build(): void;
    destroy(): void;
}
