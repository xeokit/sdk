
/**
 * @private
 */
export class VBOBatchingBuffer {

    maxVerts: number;
    maxIndices: number;
    positions: number[];
    colors: number[];
    uv: number[];
    metallicRoughness: number[];
    normals: number[];
    pickColors: number[];
    offsets: number[];
    indices: number[];
    edgeIndices: number[];

    constructor(maxGeometryBatchSize: number = 500000) {
        if (maxGeometryBatchSize > 500000) {
            maxGeometryBatchSize = 500000;
        }
        this.maxVerts = maxGeometryBatchSize;
        this.maxIndices = maxGeometryBatchSize
        this.positions = [];
        this.colors = [];
        this.uv = [];
        this.metallicRoughness = [];
        this.normals = [];
        this.pickColors = [];
        this.offsets = [];
        this.indices = [];
        this.edgeIndices = [];
    }
}

