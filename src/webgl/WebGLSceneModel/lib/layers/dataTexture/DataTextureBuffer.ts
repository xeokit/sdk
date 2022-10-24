export class DataTextureBuffer {
    positions: number[];
    indices8Bits: number[];
    indices16Bits: number[];
    indices32Bits: number[];
    edgeIndices8Bits: number[];
    edgeIndices16Bits: number[];
    edgeIndices32Bits: number[];
    edgeIndices: number[];
    objectDataColors: number[];
    objectDataPickColors: number[];
    vertexBasesForObject: number[];
    indexBaseOffsetsForObject: number[];
    edgeIndexBaseOffsetsForObject: number[];
    objectDataPositionsMatrices: number[];
    objectDataInstanceGeometryMatrices: number[];
    objectDataInstanceNormalsMatrices: number[];
    portionIdForIndices8Bits: number[];
    portionIdForIndices16Bits: number[];
    portionIdForIndices32Bits: number[];
    portionIdForEdges8Bits: number[];
    portionIdForEdges16Bits: number[];
    portionIdForEdges32Bits: number[];
    portionIdFanOut: number[];
    perObjectPositionsDecodeMatrices: any[];

    constructor(maxGeometryBatchSize: number) {
        this.positions = [];
        this.indices8Bits = [];
        this.indices16Bits = [];
        this.indices32Bits = [];
        this.edgeIndices8Bits = [];
        this.edgeIndices16Bits = [];
        this.edgeIndices32Bits = [];
        this.edgeIndices = [];
        this.objectDataColors = [];
        this.objectDataPickColors = [];
        this.vertexBasesForObject = [];
        this.indexBaseOffsetsForObject = [];
        this.edgeIndexBaseOffsetsForObject = [];
        this.objectDataPositionsMatrices = [];
        this.objectDataInstanceGeometryMatrices = [];
        this.objectDataInstanceNormalsMatrices = [];
        this.portionIdForIndices8Bits = [];
        this.portionIdForIndices16Bits = [];
        this.portionIdForIndices32Bits = [];
        this.portionIdForEdges8Bits = [];
        this.portionIdForEdges16Bits = [];
        this.portionIdForEdges32Bits = [];
        this.portionIdFanOut = [];
    }
}
