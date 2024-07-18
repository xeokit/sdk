
/**
 * @private
 */
export class VBOInstancingBuffer {

    maxVerts: number;
    maxIndices: number;
    positions: number[];
    colors: number[];
    uv: number[];
    normals: number[];
    pickColors: number[];
    offsets: number[];
    indices: number[];
    edgeIndices: number[];
    modelNormalMatrixCol0: number[];
    modelNormalMatrixCol1: number[];
    modelNormalMatrixCol2: number[];
    modelMatrixCol0: number[];
    modelMatrixCol1: number[];
    modelMatrixCol2: number[];
    modelMatrix: number[];

    constructor() {
        this.positions = [];
        this.colors = [];
        this.uv = [];
        this.normals = [];
        this.pickColors = [];
        this.offsets = [];
        this.indices = [];
        this.edgeIndices = [];
        this.modelMatrixCol0 = [];
        this.modelMatrixCol1 = [];
        this.modelMatrixCol2 = [];
    }
}

