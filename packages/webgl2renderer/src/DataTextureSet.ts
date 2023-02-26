/**
 * @private
 */
import {DataTexture} from "@xeokit/webgl2";


export class DataTextureSet {

    positions: DataTexture | null; // All quantized positions for a Layer
    indices_8Bits: DataTexture | null; // All 8-bit indices
    indices_16Bits: DataTexture | null; // All 16-bit indices
    indices_32Bits: DataTexture | null; // All 32-bt indices
    edgeIndices_8Bits: DataTexture | null; // All 8-bit edge indices
    edgeIndices_16Bits: DataTexture | null; // All 16-bit edges indices
    edgeIndices_32Bits: DataTexture | null; // All 32-bit edges indices
    indices: { [key: number]: DataTexture | null }; // All 8, 16, and 32-bit indices
    edgeIndices: { [key: number]: DataTexture | null } | null; // All 8, 16 and 32-bit indices
    eachMeshAttributes: DataTexture | null; // For each mesh, a set of attributes including color, opacity, visibility etc
    eachMeshMatrices: DataTexture | null; // For each mesh, a positions decompression matrix and a modeling matrix
    eachEdgeOffset: DataTexture | null;
    eachPrimitiveMesh_8Bits: DataTexture | null;
    eachPrimitiveMesh_16Bits: DataTexture | null;
    eachPrimitiveMesh_32Bits: DataTexture | null;
    eachPrimitiveMesh: { [key: number]: DataTexture | null } | null;
    eachEdgeMesh_8Bits: DataTexture | null;
    eachEdgeMesh_16Bits: DataTexture | null;
    eachEdgeMesh_32Bits: DataTexture | null;
    eachEdgeMesh: { [key: number]: DataTexture | null } | null;
    #built: boolean;

    constructor() {
        this.positions = null;
        this.indices_8Bits = null;
        this.indices_16Bits = null;
        this.indices_32Bits = null;
        this.edgeIndices_8Bits = null;
        this.edgeIndices_16Bits = null;
        this.edgeIndices_32Bits = null;
        this.eachMeshAttributes = null;
        this.eachMeshMatrices = null;
        this.eachPrimitiveMesh_8Bits = null;
        this.eachPrimitiveMesh_16Bits = null;
        this.eachPrimitiveMesh_32Bits = null;
        this.eachEdgeMesh_8Bits = null;
        this.eachEdgeMesh_16Bits = null;
        this.eachEdgeMesh_32Bits = null;
        this.eachEdgeOffset = null;
        this.#built = false;
    }

    build() {
        this.indices = {
            8: this.indices_8Bits,
            16: this.indices_16Bits,
            32: this.indices_32Bits,
        };
        this.eachPrimitiveMesh = {
            8: this.eachPrimitiveMesh_8Bits,
            16: this.eachPrimitiveMesh_16Bits,
            32: this.eachPrimitiveMesh_32Bits,
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
        this.#built = true;
    }

    destroy() {
        if (this.positions) {
            this.positions.destroy();
        }
        if (this.indices_8Bits) {
            this.indices_8Bits.destroy();
        }
        if (this.indices_16Bits) {
            this.indices_16Bits.destroy();
        }
        if (this.indices_32Bits) {
            this.indices_32Bits.destroy();
        }
        if (this.edgeIndices_8Bits) {
            this.edgeIndices_8Bits.destroy();
        }
        if (this.edgeIndices_16Bits) {
            this.edgeIndices_16Bits.destroy();
        }
        if (this.edgeIndices_32Bits) {
            this.edgeIndices_32Bits.destroy();
        }
        if (this.eachMeshMatrices) {
            this.eachMeshMatrices.destroy();
        }
        if (this.eachMeshAttributes) {
            this.eachMeshAttributes.destroy();
        }
        if (this.eachEdgeOffset) {
            this.eachEdgeOffset.destroy();
        }
        if (this.eachPrimitiveMesh_8Bits) {
            this.eachPrimitiveMesh_8Bits.destroy();
        }
        if (this.eachPrimitiveMesh_16Bits) {
            this.eachPrimitiveMesh_16Bits.destroy();
        }
        if (this.eachPrimitiveMesh_32Bits) {
            this.eachPrimitiveMesh_32Bits.destroy();
        }
        if (this.eachEdgeMesh_8Bits) {
            this.eachEdgeMesh_8Bits.destroy();
        }
        if (this.eachEdgeMesh_16Bits) {
            this.eachEdgeMesh_16Bits.destroy();
        }
        if (this.eachEdgeMesh_32Bits) {
            this.eachEdgeMesh_32Bits.destroy();
        }
    }
}
