export class DataTextureBuffer { // Temp data buffer as we build a Layer; converted into data textures once Layer is built

    positionsDecompressMatrices: number[];
    positionsCompressed: number[];
    indices_8Bits: number[];
    indices_16Bits: number[];
    indices_32Bits: number[];
    edgeIndices_8Bits: number[];
    edgeIndices_16Bits: number[];
    edgeIndices_32Bits: number[];

    eachPrimitiveMesh_8Bits: number[];
    eachPrimitiveMesh_16Bits: number[];
    eachPrimitiveMesh_32Bits: number[];

    eachEdgeMesh_8Bits: number[];
    eachEdgeMesh_16Bits: number[];
    eachEdgeMesh_32Bits: number[];

    eachMeshVertexPortionBase: number[];
    eachMeshVertexPortionOffset: number[];
    eachMeshEdgeIndicesOffset: number[];

    eachMeshColor: any[];
    eachMeshPickColor: any[];
    eachMeshMatrices: any[];
    eachMeshNormalMatrix: any[];
    eachMeshPositionsDecompressMatrix: any[];
    eachMeshFlags1: any[];
    eachMeshFlags2: any[];
    eachEdgeOffset: any[];
    eachMeshParts: number[];

    constructor() {
        this.positionsDecompressMatrices = [];
        this.positionsCompressed = [];
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
        this.eachMeshFlags1 = [];
        this.eachMeshFlags2 = [];
        this.eachPrimitiveMesh_32Bits = [];
        this.eachPrimitiveMesh_16Bits = [];
        this.eachPrimitiveMesh_8Bits = [];
        this.eachEdgeMesh_32Bits = [];
        this.eachEdgeMesh_16Bits = [];
        this.eachEdgeMesh_8Bits = [];
        this.eachEdgeOffset = [];
        this.eachMeshParts = [];
    }
}