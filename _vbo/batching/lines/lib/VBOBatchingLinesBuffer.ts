/**
 * @private
 */
export class VBOBatchingLinesBuffer {

    maxVerts: number;
    maxIndices: number;
    positions: number[];
    colors: number[];
    offsets: number[];
    indices: number[];

    constructor(maxGeometryBatchSize: number = 5000000) {

        if (maxGeometryBatchSize > 5000000) {
            maxGeometryBatchSize = 5000000;
        }

        this.maxVerts = maxGeometryBatchSize;
        this.maxIndices = maxGeometryBatchSize * 3; // Rough rule-of-thumb
        this.positions = [];
        this.colors = [];
        this.offsets = [];
        this.indices = [];
    }
}
