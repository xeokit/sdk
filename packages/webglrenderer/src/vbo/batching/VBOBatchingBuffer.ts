
/**
 * @private
 */
export class VBOBatchingBuffer {

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

    constructor(maxGeometryBatchSize: number = 400000) {
        if (maxGeometryBatchSize > 400000) {
            maxGeometryBatchSize = 400000;
        }
        this.maxVerts = maxGeometryBatchSize;
        this.maxIndices = maxGeometryBatchSize
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

