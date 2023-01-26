/**
 *  XKT data.
 */
export interface XKTData {
    metadata: {};
    textureData: Uint8Array;
    eachTextureDataPortion: Uint32Array;
    eachTextureAttributes: Uint16Array;
    positions: Uint16Array;
    colors: Uint8Array;
    uvs: Float32Array;
    indices8Bit: Uint8Array;
    indices16Bit: Uint16Array;
    indices32Bit: Uint32Array;
    edgeIndices8Bit: Uint8Array;
    edgeIndices16Bit: Uint16Array;
    edgeIndices32Bit: Uint32Array;
    eachTextureSetTextures: Int32Array;
    decodeMatrices: Float32Array;
    eachBucketPositionsPortion: Uint32Array;
    eachBucketColorsPortion: Uint32Array;
    eachBucketUVsPortion: Uint32Array;
    eachBucketIndicesPortion: Uint32Array;
    eachBucketEdgeIndicesPortion: Uint32Array;
    eachBucketIndicesBitness: Uint8Array;
    eachGeometryPrimitiveType: Uint8Array;
    eachGeometryBucketPortion: Uint32Array;
    eachGeometryDecodeMatricesPortion: Uint32Array;
    matrices: Float32Array;
    eachMeshGeometriesPortion: Uint32Array;
    eachMeshMatricesPortion: Uint32Array;
    eachMeshTextureSet: Uint32Array;
    eachMeshMaterialAttributes: Uint8Array;
    eachObjectId: string[];
    eachObjectMeshesPortion: Uint32Array;
}