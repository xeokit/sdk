import {FloatArrayParam, IntArrayParam} from "@xeokit/math";

/**
 * @
 */
export class TrianglesBuffer {
    positionsCompressed: IntArrayParam[];
    lenPositionsCompressed: number;
    metallicRoughness: IntArrayParam[];
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
    perSubMeshPickColors: IntArrayParam[];
    perSubMeshSolidFlag: boolean[];
    perObjectOffsets: number[];
    perSubMeshDecodeMatrices: FloatArrayParam[];
    perSubMeshInstancingMatrices: FloatArrayParam[];
    perSubMeshVertexBases: number[];
    perSubMeshIndicesBases: number[];
    perSubMeshEdgeIndicesBases: number[];
    perTriangleSubMesh8Bits: number[];
    perTriangleSubMesh16Bits: number[];
    perTriangleSubMesh32Bits: number[];
    perEdgeSubMesh8Bits: number[];
    perEdgeSubMesh16Bits: number[];
    perEdgeSubMesh32Bits: number[];
    perSubMeshColors: IntArrayParam[];

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
