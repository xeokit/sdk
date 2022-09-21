/**
 * @private
 */
class PointsBatchingBuffer {
    maxVerts: number;
    maxIndices: number;
    positions: any[];
    colors: any[];
    intensities: any[];
    pickColors: any[];
    flags: any[];
    flags2: any[];
    offsets: any[];

    constructor(maxGeometryBatchSize: number = 5000000) {

        if (maxGeometryBatchSize > 5000000) {
            maxGeometryBatchSize = 5000000;
        }

        this.maxVerts = maxGeometryBatchSize;
        this.maxIndices = maxGeometryBatchSize * 3; // Rough rule-of-thumb
        this.positions = [];
        this.colors = [];
        this.intensities = [];
        this.pickColors = [];
        this.flags = [];
        this.flags2 = [];
        this.offsets = [];
    }
}

export {PointsBatchingBuffer};