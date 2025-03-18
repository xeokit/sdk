/**
 * @private
 */
export class VBOBatchingBuffer {
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
    constructor(maxGeometryBatchSize = 400000) {
        if (maxGeometryBatchSize > 400000) {
            maxGeometryBatchSize = 400000;
        }
        this.maxVerts = maxGeometryBatchSize;
        this.maxIndices = maxGeometryBatchSize;
        this.positions = [];
        this.colors = [];
        this.uv = [];
        this.normals = [];
        this.pickColors = [];
        this.offsets = [];
        this.indices = [];
        this.edgeIndices = [];
    }
}
//# sourceMappingURL=VBOBatchingBuffer.js.map