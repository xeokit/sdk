import {FloatArrayParam, IntArrayParam} from "@xeokit/math";

/**
 * @private
 */
export class DTXBuffer {
     positionsCompressed: IntArrayParam[];
     lenPositionsCompressed: number;
     metallicRoughness: number[];
     indices8Bits: IntArrayParam[];
     lenIndices8Bits: number;
     indices16Bits: IntArrayParam[];
     lenIndices16Bits: number;
     indices32Bits: IntArrayParam[];
     lenIndices32Bits: number;
     edgeIndices8Bits: IntArrayParam[];
     lenEdgeIndices8Bits: number;
     edgeIndices16Bits: IntArrayParam[];
     lenEdgeIndices16Bits: number;
     edgeIndices32Bits: IntArrayParam[];
     lenEdgeIndices32Bits: number;
     subMeshColors: number[][];
     subMeshPickColors: IntArrayParam[];
     subMeshSolidFlags: boolean[];
     perObjectOffsets: IntArrayParam;
     subMeshDecompressMatrices: FloatArrayParam[];
     subMeshInstanceMatrices: FloatArrayParam[];
     subMeshVertexBases: number[];
     subMeshIndicesBases: number[];
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
