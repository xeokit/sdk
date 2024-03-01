/**
 * @private
 */
export class DataTextureBuffer {
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
     subMeshColors: any[];
     subMeshPickColors: any[];
     subMeshSolidFlags: boolean[];
     perObjectOffsets: any[];
     subMeshDecompressMatrices: any[];
     subMeshInstanceMatrices: any[];
     subMeshVertexBases: any[];
     subMeshIndicesBases: any[];
     subMeshEdgeIndicesBases: number[];
     primitiveToSubMeshLookup8Bits: number[];
     primitiveToSubMeshLookup16Bits: number[];
     primitiveToSubMeshLookup32Bits: number[];
     edgeToSubMeshLookup8Bits: number[];
     edgeToSubMeshLookup16Bits: number[];
     edgeToSubMeshLookup32Bits: number[];

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
        this.subMeshColors = [];
        this.subMeshPickColors = [];
        this.subMeshSolidFlags = [];
        this.perObjectOffsets = [];
        this.subMeshDecompressMatrices = [];
        this.subMeshInstanceMatrices = [];
        this.subMeshVertexBases = [];
        this.subMeshIndicesBases = [];
        this.subMeshEdgeIndicesBases = [];
        this.primitiveToSubMeshLookup8Bits = [];
        this.primitiveToSubMeshLookup16Bits = [];
        this.primitiveToSubMeshLookup32Bits = [];
        this.edgeToSubMeshLookup8Bits = [];
        this.edgeToSubMeshLookup16Bits = [];
        this.edgeToSubMeshLookup32Bits = [];
    }
}
