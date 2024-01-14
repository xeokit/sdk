/**
 * @private
 */
export class TrianglesDataTextureBuffer {
     positionsCompressed: any[];
     lenPositionsCompressed: number;
     metallicRoughness: any[];
     indices8Bits: any[];
     lenIndices8Bits: number;
     indices16Bits: any[];
     lenIndices16Bits: number;
     indices32Bits: any[];
     lenIndices32Bits: number;
     edgeIndices8Bits: any[];
     lenEdgeIndices8Bits: number;
     edgeIndices16Bits: any[];
     lenEdgeIndices16Bits: number;
     edgeIndices32Bits: any[];
     lenEdgeIndices32Bits: number;
     perSubMeshColors: any[];
     perSubMeshPickColors: any[];
     perSubMeshSolidFlag: boolean[];
     perObjectOffsets: any[];
     perSubMeshDecodeMatrices: any[];
     perSubMeshInstancingMatrices: any[];
     perSubMeshVertexBases: any[];
     perSubMeshIndicesBases: any[];
     perSubMeshEdgeIndicesBases: number[];
     perTriangleSubMesh8Bits: number[];
     perTriangleSubMesh16Bits: number[];
     perTriangleSubMesh32Bits: number[];
     perEdgeSubMesh8Bits: number[];
     perEdgeSubMesh16Bits: number[];
     perEdgeSubMesh32Bits: number[];


    constructor() {
        this.positionsCompressed = [];
        this.lenPositionsCompressed = 0;
        this.metallicRoughness = [];
        this.indices8Bits = [];
        this.lenIndices8Bits = 0;
        this.indices16Bits = [];
        this.lenIndices16Bits = 0;
        this.indices32Bits = [];
        this.lenIndices32Bits = 0;
        this.edgeIndices8Bits = [];
        this.lenEdgeIndices8Bits = 0;
        this.edgeIndices16Bits = [];
        this.lenEdgeIndices16Bits = 0;
        this.edgeIndices32Bits = [];
        this.lenEdgeIndices32Bits = 0;
        this.perSubMeshColors = [];
        this.perSubMeshPickColors = [];
        this.perSubMeshSolidFlag = [];
        this.perObjectOffsets = [];
        this.perSubMeshDecodeMatrices = [];
        this.perSubMeshInstancingMatrices = [];
        this.perSubMeshVertexBases = [];
        this.perSubMeshIndicesBases = [];
        this.perSubMeshEdgeIndicesBases = [];
        this.perTriangleSubMesh8Bits = [];
        this.perTriangleSubMesh16Bits = [];
        this.perTriangleSubMesh32Bits = [];
        this.perEdgeSubMesh8Bits = [];
        this.perEdgeSubMesh16Bits = [];
        this.perEdgeSubMesh32Bits = [];
    }
}