export interface TrianglesLayerGeometryBucket { // Storage handle for a geometry bucket within a TrianglesLayer
    vertexBase: number;
    numVertices: number;
    numTriangles: number;
    numEdges: number;
    indicesBase: number;
    edgeIndicesBase: number
}