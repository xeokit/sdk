/**
 * @private
 */
export interface DTXLayerGeometryBucket { // Storage handle for a geometry bucket within a TrianglesLayer
    vertexBase: number;
    numVertices: number;
    numPrimitives: number;
    numEdges: number;
    indicesBase: number;
    edgeIndicesBase: number
}
