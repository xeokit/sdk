/**
 * @private
 */
export interface DTXDataDeflated {
    metadata: Buffer;
    textureData: Buffer;
    eachTextureDataPortion: Buffer;
    eachTextureAttributes: Buffer;
    positions: Buffer;
    colors: Buffer;
    uvs: Buffer;
    indices8Bit: Buffer;
    indices16Bit: Buffer;
    indices32Bit: Buffer;
    edgeIndices8Bit: Buffer;
    edgeIndices16Bit: Buffer;
    edgeIndices32Bit: Buffer;
    eachTextureSetTextures: Buffer;
    decodeMatrices: Buffer;
    eachBucketPositionsPortion: Buffer;
    eachBucketColorsPortion: Buffer;
    eachBucketUVsPortion: Buffer;
    eachBucketIndicesPortion: Buffer;
    eachBucketEdgeIndicesPortion: Buffer;
    eachBucketIndicesBitness: Buffer;
    eachGeometryPrimitiveType: Buffer;
    eachGeometryBucketPortion: Buffer;
    eachGeometryDecodeMatricesPortion: Buffer;
    matrices: Buffer;
    eachMeshGeometriesPortion: Buffer;
    eachMeshMatricesPortion: Buffer;
    eachMeshTextureSet: Buffer;
    eachMeshMaterialAttributes: Buffer;
    eachObjectId: Buffer;
    eachObjectMeshesPortion: Buffer;
}