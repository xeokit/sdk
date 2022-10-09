export class DataTextureBuffer {
    positions: any[];
    indices8Bits: any[];
    indices16Bits: any[];
    indices32Bits: any[];
    edgeIndices8Bits: any[];
    edgeIndices16Bits: any[];
    edgeIndices32Bits: any[];
    edgeIndices: any[];
    objectDataColors: any[];
    objectDataPickColors: any[];
    vertexBasesForObject: any[];
    indexBaseOffsetsForObject: any[];
    edgeIndexBaseOffsetsForObject: any[];
    objectDataPositionsMatrices: any[];
    objectDataInstanceGeometryMatrices: any[];
    objectDataInstanceNormalsMatrices: any[];
    portionIdForIndices8Bits: any[];
    portionIdForIndices16Bits: any[];
    portionIdForIndices32Bits: any[];
    portionIdForEdges8Bits: any[];
    portionIdForEdges16Bits: any[];
    portionIdForEdges32Bits: any[];
    portionIdFanOut: any[];

    constructor() {
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
