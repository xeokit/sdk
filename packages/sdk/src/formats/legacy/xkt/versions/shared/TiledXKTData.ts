/**
 * Common decoded payload for tiled XKT versions (V7 onwards), consumed by
 * {@link buildTiledSceneModel}.
 *
 * Each version's parser inflates its own container into this shape. Fields
 * that a given version does not store (textures, UVs, normals, edges) are
 * dropped during inflation — the renderer derives flat normals and edges, so
 * they are not needed to build the SceneModel.
 *
 * Arrays are split into parallel "portion" base indices: a geometry's data is
 * the slice of each pooled array from its base index to the next geometry's
 * base (or the array end for the last geometry). Positions are 16-bit quantised
 * against a decode matrix — the per-tile matrix for geometry used by a single
 * mesh, or the shared `reusedGeometriesDecodeMatrix` for instanced geometry.
 *
 * @private
 */
export interface TiledXKTData {
  positions: Uint16Array;

  /** Pooled vertex colours (points only); `colorComponents` per vertex. */
  colors: Uint8Array;
  /** 3 (RGB, V7–V8) or 4 (RGBA, V9 onwards). */
  colorComponents: number;

  indices: Uint32Array;

  matrices: Float32Array;
  /** Shared decode matrix for instanced (reused) geometry. */
  reusedGeometriesDecodeMatrix: Float32Array;

  eachGeometryPrimitiveType: Uint8Array;
  eachGeometryPositionsPortion: Uint32Array;
  eachGeometryColorsPortion: Uint32Array;
  eachGeometryIndicesPortion: Uint32Array;

  eachMeshGeometriesPortion: Uint32Array;
  eachMeshMatricesPortion: Uint32Array;
  /** Per mesh: 6 bytes — RGB colour, opacity, metallic, roughness. */
  eachMeshMaterialAttributes: Uint8Array;

  eachEntityId: string[];
  eachEntityMeshesPortion: Uint32Array;

  eachTileAABB: Float64Array;
  eachTileEntitiesPortion: Uint32Array;

  /** Model + per-object metadata (`metaObjects`, `propertySets`); V8 onwards. */
  metadata?: any;
}
