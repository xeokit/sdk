/**
 *  XKT file data.
 *
 *  The elements of an [XKT](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#xkt) file, unpacked into a set of arrays for parsing.
 *
 *  This interface represents the structure of an [XKT](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#xkt) V10 file.
 */
export interface XKTData {
  metadata: any;
  textureData: Uint8Array<any>;
  eachTextureDataPortion: Uint32Array<any>;
  eachTextureAttributes: Uint16Array<any>;
  positions: Uint16Array<any>;
  normals: Int8Array<any>;
  colors: Uint8Array<any>;
  uvs: Float32Array<any>;
  indices: Uint32Array<any>;
  edgeIndices: Uint32Array<any>;
  eachMaterialTextures: Int32Array<any>;
  matrices: Float32Array<any>;
  reusedGeometriesDecodeMatrix: Float32Array<any>;
  eachGeometryPrimitiveType: Uint8Array<any>;
  eachGeometryPositionsPortion: Uint32Array<any>;
  eachGeometryNormalsPortion: Uint32Array<any>;
  eachGeometryColorsPortion: Uint32Array<any>;
  eachGeometryUVsPortion: Uint32Array<any>;
  eachGeometryIndicesPortion: Uint32Array<any>;
  eachGeometryEdgeIndicesPortion: Uint32Array<any>;
  eachMeshGeometriesPortion: Uint32Array<any>;
  eachMeshMatricesPortion: Uint32Array<any>;
  eachMeshMaterial: Int32Array<any>;
  eachMeshMaterialAttributes: Uint8Array<any>;
  eachEntityId: string[];
  eachEntityMeshesPortion: Uint32Array<any>;
  eachTileAABB: Float64Array<any>;
  eachTileEntitiesPortion: Uint32Array<any>;
}
