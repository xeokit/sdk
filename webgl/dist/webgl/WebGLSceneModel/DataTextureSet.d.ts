import type { DataTexture } from "../lib/DataTexture";
export declare class DataTextureSet {
    #private;
    positions: DataTexture | null;
    indices_8Bits: DataTexture | null;
    indices_16Bits: DataTexture | null;
    indices_32Bits: DataTexture | null;
    edgeIndices_8Bits: DataTexture | null;
    edgeIndices_16Bits: DataTexture | null;
    edgeIndices_32Bits: DataTexture | null;
    indices: {
        [key: number]: DataTexture | null;
    };
    edgeIndices: {
        [key: number]: DataTexture | null;
    } | null;
    eachMeshAttributes: DataTexture | null;
    eachMeshMatrices: DataTexture | null;
    eachEdgeOffset: DataTexture | null;
    eachPrimitiveMesh_8Bits: DataTexture | null;
    eachPrimitiveMesh_16Bits: DataTexture | null;
    eachPrimitiveMesh_32Bits: DataTexture | null;
    eachPrimitiveMesh: {
        [key: number]: DataTexture | null;
    } | null;
    eachEdgeMesh_8Bits: DataTexture | null;
    eachEdgeMesh_16Bits: DataTexture | null;
    eachEdgeMesh_32Bits: DataTexture | null;
    eachEdgeMesh: {
        [key: number]: DataTexture | null;
    } | null;
    constructor();
    build(): void;
    destroy(): void;
}
