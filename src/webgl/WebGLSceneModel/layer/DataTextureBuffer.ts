/**
 * Accumulates model data before it's loaded into a DataTexture.
 */
export class DataTextureBuffer {

    positions: number[];
    indices_8Bits: number[];
    indices_16Bits: number[];
    indices_32Bits: number[];
    edgeIndices_8Bits: number[];
    edgeIndices_16Bits: number[];
    edgeIndices_32Bits: number[];
    eachMeshVertexPortionBase: number[];
    eachMeshVertexPortionOffset: number[];
    eachMeshEdgeIndicesOffset: number[];
    eachMeshColor: any[];
    eachMeshPickColor: any[];
    eachMeshMatrices: any[];
    eachMeshNormalMatrix: any[];
    eachMeshPositionsDecompressMatrix: any[];
    eachTriangleMesh_32Bits: number[];
    eachTriangleMesh_16Bits: number[];
    eachTriangleMesh_8Bits: number[];
    eachEdgeMesh_32Bits: number[];
    eachEdgeMesh_16Bits: number[];
    eachEdgeMesh_8Bits: number[];
    eachEdgeOffset: any[];
    eachMeshParts: number[];

    constructor() {
        this.positions = [];
        this.indices_8Bits = [];
        this.indices_16Bits = [];
        this.indices_32Bits = [];
        this.edgeIndices_8Bits = [];
        this.edgeIndices_16Bits = [];
        this.edgeIndices_32Bits = [];
        this.eachMeshVertexPortionBase = [];
        this.eachMeshVertexPortionOffset = [];
        this.eachMeshEdgeIndicesOffset = [];
        this.eachMeshColor = [];
        this.eachMeshPickColor = [];
        this.eachMeshMatrices = [];
        this.eachMeshNormalMatrix = [];
        this.eachMeshPositionsDecompressMatrix = [];
        this.eachTriangleMesh_32Bits = [];
        this.eachTriangleMesh_16Bits = [];
        this.eachTriangleMesh_8Bits = [];
        this.eachEdgeMesh_32Bits = [];
        this.eachEdgeMesh_16Bits = [];
        this.eachEdgeMesh_8Bits = [];
        this.eachEdgeOffset = [];
        this.eachMeshParts = [];
    }
}
