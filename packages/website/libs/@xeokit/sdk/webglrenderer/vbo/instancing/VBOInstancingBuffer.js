/**
 * @private
 */
export class VBOInstancingBuffer {
    maxVerts;
    maxIndices;
    positions;
    colors;
    uv;
    normals;
    pickColors;
    offsets;
    indices;
    edgeIndices;
    modelNormalMatrixCol0;
    modelNormalMatrixCol1;
    modelNormalMatrixCol2;
    modelMatrixCol0;
    modelMatrixCol1;
    modelMatrixCol2;
    modelMatrix;
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
//# sourceMappingURL=VBOInstancingBuffer.js.map