/**
 * @private
 */
export interface DTXDataDeflated {
    positions: Buffer;
    colors: Buffer;
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
    eachBucketIndicesPortion: Buffer;
    eachBucketEdgeIndicesPortion: Buffer;
    eachBucketIndicesBitness: Buffer;
    eachGeometryPrimitiveType: Buffer;
    eachGeometryBucketPortion: Buffer;
    eachGeometryDecodeMatricesPortion: Buffer;
    matrices: Buffer;
    origins: Buffer;
    eachMeshGeometriesPortion: Buffer;
    eachMeshMatricesPortion: Buffer;
    eachMeshOriginsPortion: Buffer;
    eachMeshMaterialAttributes: Buffer;
    eachGeometryId: Buffer;
    eachMeshId: Buffer;
    eachObjectId: Buffer;
    eachObjectMeshesPortion: Buffer;
}
