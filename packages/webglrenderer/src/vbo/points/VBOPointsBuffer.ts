/**
 * @private
 */
export class VBOPointsBuffer {

    maxVerts: number;
    maxIndices: number;
    positions: number[];
    colors: number[];
    intensities: number[];
    pickColors: number[];
    offsets: number[];

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
        this.offsets = [];
    }
}
