import {DataTexture} from "./DataTexture";

export class DataTextureSet {

    cameraMatrices: DataTexture;
    sceneModelMatrices: DataTexture;
    positions: DataTexture; // All quantized positions for a Layer
    indices_8Bits: DataTexture; // All 8-bit indices
    indices_16Bits: DataTexture; // All 16-bit indices
    indices_32Bits: DataTexture; // All 32-bt indices
    edgeIndices_8Bits: DataTexture; // All 8-bit edge indices
    edgeIndices_16Bits: DataTexture; // All 16-bit edges indices
    edgeIndices_32Bits: DataTexture; // All 32-bit edges indices
    indices: { [key: number]: DataTexture }; // All 8, 16, and 32-bit indices
    edgeIndices: { [key: number]: DataTexture }; // All 8, 16 and 32-bit indices
    eachMeshAttributes: DataTexture; // For each mesh, a set of attributes including color, opacity, visibility etc
    eachMeshMatrices: DataTexture; // For each mesh, a positions decompression matrix and a modeling matrix
    eachEdgeOffset: DataTexture;
    eachTriangleMesh_8Bits: DataTexture;
    eachTriangleMesh_16Bits: DataTexture;
    eachTriangleMesh_32Bits: DataTexture;
    eachTriangleMesh: { [key: number]: DataTexture };
    eachEdgeMesh_8Bits: DataTexture;
    eachEdgeMesh_16Bits: DataTexture;
    eachEdgeMesh_32Bits: DataTexture;
    eachEdgeMesh: { [key: number]: DataTexture };
    #finalized: boolean;

    constructor() {
        this.cameraMatrices = null;
        this.sceneModelMatrices = null;
        this.positions = null;
        this.indices_8Bits = null;
        this.indices_16Bits = null;
        this.indices_32Bits = null;
        this.edgeIndices_8Bits = null;
        this.edgeIndices_16Bits = null;
        this.edgeIndices_32Bits = null;
        this.eachMeshAttributes = null;
        this.eachMeshMatrices = null;
        this.eachTriangleMesh_8Bits = null;
        this.eachTriangleMesh_16Bits = null;
        this.eachTriangleMesh_32Bits = null;
        this.eachEdgeMesh_8Bits = null;
        this.eachEdgeMesh_16Bits = null;
        this.eachEdgeMesh_32Bits = null;
        this.eachEdgeOffset = null;
        this.#finalized = false;
    }

    finalize() {
        this.indices = {
            8: this.indices_8Bits,
            16: this.indices_16Bits,
            32: this.indices_32Bits,
        };
        this.eachTriangleMesh = {
            8: this.eachTriangleMesh_8Bits,
            16: this.eachTriangleMesh_16Bits,
            32: this.eachTriangleMesh_32Bits,
        };
        this.edgeIndices = {
            8: this.edgeIndices_8Bits,
            16: this.edgeIndices_16Bits,
            32: this.edgeIndices_32Bits,
        };
        this.eachEdgeMesh = {
            8: this.eachEdgeMesh_8Bits,
            16: this.eachEdgeMesh_16Bits,
            32: this.eachEdgeMesh_32Bits,
        };
        this.#finalized = true;
    }

    destroy() {
        this.cameraMatrices.destroy();
        this.sceneModelMatrices.destroy();
        this.positions.destroy();
        this.indices_8Bits.destroy();
        this.indices_16Bits.destroy();
        this.indices_32Bits.destroy();
        this.edgeIndices_8Bits.destroy();
        this.edgeIndices_16Bits.destroy();
        this.edgeIndices_32Bits.destroy();
        this.eachMeshMatrices.destroy();
        this.eachMeshAttributes.destroy();
        this.eachEdgeOffset.destroy();
        this.eachTriangleMesh_8Bits.destroy();
        this.eachTriangleMesh_16Bits.destroy();
        this.eachTriangleMesh_32Bits.destroy();
        this.eachEdgeMesh_8Bits.destroy();
        this.eachEdgeMesh_16Bits.destroy();
        this.eachEdgeMesh_32Bits.destroy();
    }
}
