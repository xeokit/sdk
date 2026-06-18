/**
 * Decoded payload of an XKT v12 file (uncompressed offset-table container).
 *
 * The arrays are split into parallel "portion" base indices: a geometry's data
 * is the slice of each pooled array from its base index to the next geometry's
 * base (or the array end for the last geometry). Positions are 16-bit quantised
 * against a decode matrix — the per-tile matrix for geometry used by a single
 * mesh, or the shared `reusedGeometriesDecodeMatrix` for instanced geometry.
 *
 * @private
 */
export interface XKTData_v12 {
  /** Model + per-object metadata (`metaObjects`, `propertySets`). */
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
  /** Shared decode matrix for instanced (reused) geometry. */
  reusedGeometriesDecodeMatrix: Float32Array;

  eachGeometryPrimitiveType: Uint8Array;
  /** Per-geometry text label (IFC axis labels); keyed by geometry index. */
  eachGeometryAxisLabel: any;
  eachGeometryPositionsPortion: Uint32Array;
  eachGeometryNormalsPortion: Uint32Array;
  eachGeometryColorsPortion: Uint32Array;
  eachGeometryUVsPortion: Uint32Array;
  eachGeometryIndicesPortion: Uint32Array;
  eachGeometryEdgeIndicesPortion: Uint32Array;

  eachMeshGeometriesPortion: Uint32Array;
  eachMeshMatricesPortion: Uint32Array;
  eachMeshTextureSet: Int32Array;
  /** Per mesh: 6 bytes — RGB colour, opacity, metallic, roughness. */
  eachMeshMaterialAttributes: Uint8Array;

  eachEntityId: string[];
  eachEntityMeshesPortion: Uint32Array;

  eachTileAABB: Float64Array;
  eachTileEntitiesPortion: Uint32Array;
}
