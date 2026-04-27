/**
 *  XGF v2 file-format payload — extends v1 with PBR materials,
 *  textures, per-geometry normals and per-geometry UVs.
 *
 *  Pack order in the binary form is the field-declaration order below;
 *  {@link packXGF} and {@link unpackXGF} read/write it positionally.
 *
 *  @internal
 */
export interface XGFData_v2 {

  // ── v1-compatible geometry payload ──────────────────────────────────

  /** Quantised vertex positions (RGB16UI per vertex × 3). */
  positions: Uint16Array<any>;

  /** Vertex RGBA colours (Uint8 × 4 per vertex). */
  colors: Uint8Array<any>;

  /** 32-bit triangle / line indices. */
  indices: Uint32Array<any>;

  /** 32-bit edge-line indices. */
  edgeIndices: Uint32Array<any>;

  /** Geometry AABBs (six floats each: minX, minY, minZ, maxX, maxY, maxZ). */
  aabbs: Float32Array<any>;

  // ── v2 geometry additions ───────────────────────────────────────────

  /**
   * Octahedral RG16UI vertex normals — one (x, y) pair per vertex.
   * Geometries that don't carry normals occupy zero range.
   */
  normals: Uint16Array<any>;

  /**
   * RG32F vertex UVs — one (u, v) pair per vertex. Floats (not
   * quantised) so tiling values outside `[0, 1]` round-trip through
   * the file intact, mirroring the runtime VertexUVTexture format.
   */
  uvs: Float32Array<any>;

  // ── Per-geometry pointers ──────────────────────────────────────────

  eachGeometryPositionsBase: Uint32Array<any>;
  eachGeometryColorsBase: Uint32Array<any>;
  eachGeometryIndicesBase: Uint32Array<any>;
  eachGeometryEdgeIndicesBase: Uint32Array<any>;

  /**
   * Per-geometry base into {@link normals}. `0xffffffff` (UINT32_MAX)
   * indicates the geometry has no normals.
   */
  eachGeometryNormalsBase: Uint32Array<any>;

  /**
   * Per-geometry base into {@link uvs}. `0xffffffff` indicates the
   * geometry has no UVs.
   */
  eachGeometryUVsBase: Uint32Array<any>;

  /**
   * Per-geometry primitive type:
   *   0 — TrianglesPrimitive
   *   1 — SolidPrimitive
   *   2 — SurfacePrimitive
   *   3 — LinesPrimitive
   *   4 — PointsPrimitive
   */
  eachGeometryPrimitiveType: Uint8Array<any>;

  /** Per-geometry base into {@link aabbs} (six floats). */
  eachGeometryAABBBase: Uint32Array<any>;

  // ── Modelling matrices ─────────────────────────────────────────────

  matrices: Float64Array<any>;

  // ── Textures (v2 only) ─────────────────────────────────────────────

  /**
   * Concatenated encoded image bytes for every texture in the model
   * (typically PNG / JPEG / GIF). The {@link eachTextureMediaType} and
   * {@link eachTextureDataBase} arrays describe how to slice and decode.
   */
  textureData: Uint8Array<any>;

  /** Per-texture base into {@link textureData}. */
  eachTextureDataBase: Uint32Array<any>;

  /**
   * Per-texture media type, matching {@link constants!PNGMediaType}
   * etc. Stored as a small integer:
   *   0 — PNG
   *   1 — JPEG
   *   2 — GIF
   * 255 — opaque transcoded buffer (treat as raw bytes; not decoded
   *        at load time)
   */
  eachTextureMediaType: Uint8Array<any>;

  /** Per-texture pixel width. */
  eachTextureWidth: Uint16Array<any>;

  /** Per-texture pixel height. */
  eachTextureHeight: Uint16Array<any>;

  /**
   * Per-texture sampler params, five bytes each (in order):
   *   minFilter, magFilter, wrapS, wrapT, wrapR
   *
   * Each is the small-integer code from {@link constants}:
   *   1 — RepeatWrapping
   *   2 — ClampToEdgeWrapping
   *   3 — MirroredRepeatWrapping
   *   4 — NearestFilter
   *   5 — LinearFilter
   *   6 — NearestMipMapNearestFilter
   *   7 — LinearMipMapNearestFilter
   *   8 — NearestMipMapLinearFilter
   *   9 — LinearMipMapLinearFilter
   */
  eachTextureSampler: Uint8Array<any>;

  /** Per-texture string ID. */
  eachTextureId: string[];

  // ── Materials (v2 only) ────────────────────────────────────────────

  /**
   * Per-material PBR + alpha attributes, eight bytes each (in order):
   *   color R, color G, color B, opacity,
   *   roughness, metallic,
   *   alphaMode (0=OPAQUE, 1=MASK, 2=BLEND), alphaCutoff
   *
   * All values quantised to `[0, 255]` from `[0, 1]`.
   */
  eachMaterialPBR: Uint8Array<any>;

  /**
   * Per-material texture references, five Int32 entries each (in order):
   *   colorTextureIndex,
   *   metallicRoughnessTextureIndex,
   *   normalsTextureIndex,
   *   occlusionTextureIndex,
   *   emissiveTextureIndex
   *
   * Each entry is a 0-based index into the texture array, or `-1` to
   * indicate "no texture".
   */
  eachMaterialTextures: Int32Array<any>;

  /** Per-material string ID. */
  eachMaterialId: string[];

  // ── Per-mesh ───────────────────────────────────────────────────────

  eachMeshGeometriesBase: Uint32Array<any>;
  eachMeshMatricesBase: Uint32Array<any>;

  /**
   * Per-mesh inline RGBA colour fallback (4 bytes/mesh: R, G, B,
   * opacity). Used when {@link eachMeshMaterial} for that mesh is `-1`
   * — i.e. the mesh has no material reference and renders as a flat
   * colour.
   */
  eachMeshMaterialAttributes: Uint8Array<any>;

  /**
   * Per-mesh material reference: index into the material array, or
   * `-1` to fall back to {@link eachMeshMaterialAttributes}.
   */
  eachMeshMaterial: Int32Array<any>;

  // ── Per-object ─────────────────────────────────────────────────────

  eachObjectId: string[];
  eachObjectMeshesBase: Uint32Array<any>;
}
