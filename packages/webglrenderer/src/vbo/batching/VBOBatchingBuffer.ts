
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

    constructor(maxGeometryBatchSize: number = 4000000) {
        if (maxGeometryBatchSize > 4000000) {
            maxGeometryBatchSize = 4000000;
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

