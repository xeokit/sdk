export interface GeometryBucketHandle { // Storage handle for a geometry bucket within a Layer
    vertexBase: number;
    numVertices: number;
    numTriangles: number;
    numLines: number;
    numPoints: number;
    numEdges: number;
    indicesBase: number;
    edgeIndicesBase: number
}