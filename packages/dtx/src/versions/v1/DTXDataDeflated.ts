/**
 * @private
 */
export interface DTXDataDeflated {
    positions: Buffer;
    colors: Buffer;
    indices: Buffer;
    edgeIndices: Buffer;
    aabbs: Buffer;
    eachGeometryPositionsBase: Buffer;
    eachGeometryColorsBase: Buffer;
    eachGeometryIndicesBase: Buffer;
    eachGeometryEdgeIndicesBase: Buffer;
    eachGeometryPrimitiveType: Buffer;
    eachGeometryAABBBase: Buffer;
    matrices: Buffer;
    eachMeshGeometriesBase: Buffer;
    eachMeshMatricesBase: Buffer;
    eachMeshMaterialAttributes: Buffer;
    eachObjectId: Buffer;
    eachObjectMeshesBase: Buffer;
}
