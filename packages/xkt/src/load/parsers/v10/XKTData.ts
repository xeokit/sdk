/**
 *  XKT file data.
 *
 *  The elements of an [XKT](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#xkt) file, unpacked into a set of arrays for parsing.
 *
 *  This interface represents the structure of an [XKT](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#xkt) V10 file.
 */
export interface XKTData {
    metadata: any;
    textureData: Uint8Array;
    eachTextureDataPortion: Uint32Array;
    eachTextureAttributes: Uint16Array;
    positions: Uint16Array;
    normals: Int8Array;
    colors: Uint8Array;
    uvs: Float32Array;
    indices: Uint32Array;
    edgeIndices: Uint32Array;
    eachTextureSetTextures: Int32Array;
    matrices: Float32Array;
    reusedGeometriesDecodeMatrix: Float32Array;
    eachGeometryPrimitiveType: Uint8Array;
    eachGeometryPositionsPortion: Uint32Array;
    eachGeometryNormalsPortion: Uint32Array;
    eachGeometryColorsPortion: Uint32Array;
    eachGeometryUVsPortion: Uint32Array;
    eachGeometryIndicesPortion: Uint32Array;
    eachGeometryEdgeIndicesPortion: Uint32Array;
    eachMeshGeometriesPortion: Uint32Array;
    eachMeshMatricesPortion: Uint32Array;
    eachMeshTextureSet: Int32Array;
    eachMeshMaterialAttributes: Uint8Array;
    eachEntityId: string[];
    eachEntityMeshesPortion: Uint32Array;
    eachTileAABB: Float64Array;
    eachTileEntitiesPortion: Uint32Array;
}
