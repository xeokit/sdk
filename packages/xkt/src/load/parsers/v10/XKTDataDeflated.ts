/**
 * @private
 */
export interface XKTDataDeflated {
    metadata: Buffer;
    textureData: Buffer;
    eachTextureDataPortion: Buffer;
    eachTextureAttributes: Buffer;
    positions: Buffer;
    normals: Buffer;
    colors: Buffer;
    uvs: Buffer;
    indices: Buffer;
    edgeIndices: Buffer;
    eachTextureSetTextures: Buffer;
    matrices: Buffer;
    reusedGeometriesDecodeMatrix: Buffer;
    eachGeometryPrimitiveType: Buffer;
    eachGeometryPositionsPortion: Buffer;
    eachGeometryNormalsPortion: Buffer;
    eachGeometryColorsPortion: Buffer;
    eachGeometryUVsPortion: Buffer;
    eachGeometryIndicesPortion: Buffer;
    eachGeometryEdgeIndicesPortion: Buffer;
    eachMeshGeometriesPortion: Buffer;
    eachMeshMatricesPortion: Buffer;
    eachMeshTextureSet: Buffer;
    eachMeshMaterialAttributes: Buffer;
    eachEntityId: Buffer;
    eachEntityMeshesPortion: Buffer;
    eachTileAABB: Buffer;
    eachTileEntitiesPortion: Buffer;
}
