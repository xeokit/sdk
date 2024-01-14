/**
 * @private
 */
import type { WebGLDataTexture } from "@xeokit/webglutils";
export declare class DataTextureSet {
    #private;
    positions: WebGLDataTexture | null;
    indices_8Bits: WebGLDataTexture | null;
    indices_16Bits: WebGLDataTexture | null;
    indices_32Bits: WebGLDataTexture | null;
    edgeIndices_8Bits: WebGLDataTexture | null;
    edgeIndices_16Bits: WebGLDataTexture | null;
    edgeIndices_32Bits: WebGLDataTexture | null;
    indices: {
        [key: number]: WebGLDataTexture | null;
    };
    edgeIndices: {
        [key: number]: WebGLDataTexture | null;
    } | null;
    eachMeshAttributes: WebGLDataTexture | null;
    eachMeshMatrices: WebGLDataTexture | null;
    eachEdgeOffset: WebGLDataTexture | null;
    eachPrimitiveMesh_8Bits: WebGLDataTexture | null;
    eachPrimitiveMesh_16Bits: WebGLDataTexture | null;
    eachPrimitiveMesh_32Bits: WebGLDataTexture | null;
    eachPrimitiveMesh: {
        [key: number]: WebGLDataTexture | null;
    } | null;
    eachEdgeMesh_8Bits: WebGLDataTexture | null;
    eachEdgeMesh_16Bits: WebGLDataTexture | null;
    eachEdgeMesh_32Bits: WebGLDataTexture | null;
    eachEdgeMesh: {
        [key: number]: WebGLDataTexture | null;
    } | null;
    constructor();
    build(): void;
    destroy(): void;
}
