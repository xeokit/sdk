/**
 * @private
 */
class LinesBatchingBuffer {
    maxVerts: number;
    maxIndices: number;
    positions: number[];
    colors: number[];
    flags: number[];
    flags2: number[];
    offsets: number[];
    indices: number[];

    constructor(maxGeometryBatchSize = 5000000) {

        if (maxGeometryBatchSize > 5000000) {
            maxGeometryBatchSize = 5000000;
        }

        this.maxVerts = maxGeometryBatchSize;
        this.maxIndices = maxGeometryBatchSize * 3; // Rough rule-of-thumb
        this.positions = [];
        this.colors = [];
        this.flags = [];
        this.flags2 = [];
        this.offsets = [];
        this.indices = [];
    }
}

export {LinesBatchingBuffer};