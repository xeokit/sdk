/**
 * @private
 */
export interface LayerGeometryBucket { // Storage handle for a geometry bucket within a TrianglesLayer
    vertexBase: number;
    numVertices: number;
    numPrimitives: number;
    numEdges: number;
    indicesBase: number;
    edgeIndicesBase: number
}