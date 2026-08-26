/**
 *  XGF v2 file-format payload — geometry, PBR materials, textures, 3D
 *  Gaussian Splatting geometry (per-splat scales and rotation quaternions,
 *  plus the `GaussianSplatsPrimitive` primitive type), stable asset IDs,
 *  external mesh references, and transform hierarchies.
 *
 *  Pack order in the binary form is the field-declaration order below;
 *  `packXGF` and `unpackXGF` read/write it positionally.
 *
 *  @internal
 */
export interface XGFData_v2 {

  // ── v1-compatible geometry payload ──────────────────────────────────

  /** Quantised vertex positions (RGB16UI per vertex × 3). */
  positions: Uint16Array<any>;

  /** Vertex RGBA colours (Uint8 × 4 per vertex). */
  colors: Uint8Array<any>;

  /** Triangle / line indices. Stored as 16-bit when all indices fit. */
  indices: Uint16Array<any> | Uint32Array<any>;

  /** Bytes per primitive index: `2` or `4`. */
  indexSize: Uint8Array<any>;

  /** Edge-line indices. Stored as 16-bit when all indices fit. */
  edgeIndices: Uint16Array<any> | Uint32Array<any>;

  /** Bytes per edge index: `2` or `4`. */
  edgeIndexSize: Uint8Array<any>;

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

  // ── v3 geometry additions (3D Gaussian Splatting) ───────────────────

  /**
   * Per-splat scales — three floats (x, y, z) per splat. Only occupied
   * by {@link base!constants.GaussianSplatsPrimitive | GaussianSplatsPrimitive}
   * geometries; others occupy zero range.
   */
  scales: Float32Array<any>;

  /**
   * Per-splat rotation quaternions — four bytes (x, y, z, w) per splat,
   * quantised as `round(q · 128 + 128)` and decoded `(b − 128) / 128`
   * (the antimatter15 `.splat` convention). Only occupied by splat
   * geometries; others occupy zero range.
   */
  rotations: Uint8Array<any>;

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
   * Per-geometry base into {@link scales} (three floats per splat).
   * `0xffffffff` indicates the geometry carries no per-splat scales
   * (i.e. it isn't a splat geometry).
   */
  eachGeometryScalesBase: Uint32Array<any>;

  /**
   * Per-geometry base into {@link rotations} (four bytes per splat).
   * `0xffffffff` indicates the geometry carries no per-splat rotations.
   */
  eachGeometryRotationsBase: Uint32Array<any>;

  /**
   * Per-geometry primitive type:
   *   0 — TrianglesPrimitive
   *   1 — SolidPrimitive
   *   2 — SurfacePrimitive
   *   3 — LinesPrimitive
   *   4 — PointsPrimitive
   *   5 — GaussianSplatsPrimitive
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
   * Per-texture media type, matching {@link base!constants.PNGMediaType | PNGMediaType}
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
   * Each is the small-integer code from {@link base!constants | constants}:
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

  /**
   * Per-texture colour-space encoding, as the raw {@link base!constants | constants}
   * value (e.g. 3000 LinearEncoding, 3001 sRGBEncoding). Required so an sRGB
   * colour/albedo map reloads as sRGB rather than linear (which renders washed out).
   */
  eachTextureEncoding: Uint16Array<any>;

  /** Per-texture string ID. */
  eachTextureId: string[];

  // ── Materials (v2 only) ────────────────────────────────────────────

  /**
   * Per-material PBR + alpha attributes, eight bytes each (in order):
   *   color R, color G, color B, opacity,
   *   roughness, metallic,
   *   alphaMode (0=OPAQUE, 1=MASK, 2=BLEND), alphaCutoff
   *
   * All values quantised to `[0, 255]` from `[0, 1]`. The colour bytes here
   * are clamped to `[0, 1]`; read the full-precision colour from
   * {@link eachMaterialColor} instead (SceneMaterial.color is an unclamped
   * multiplier that can exceed 1.0).
   */
  eachMaterialPBR: Uint8Array<any>;

  /**
   * Per-material RGB colour factor, full-precision float (three per material).
   * SceneMaterial.color is an unclamped multiplier — values above 1.0 (a common
   * brightness boost) would clamp to 1.0 in the u8 {@link eachMaterialPBR} and
   * render washed out, so the colour is carried here as float.
   */
  eachMaterialColor: Float32Array<any>;

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

  /**
   * Per-material triplanar texture scale (one Float32 each) — the world-space
   * repeat distance for the renderer's triplanar (world-projected) texture
   * sampling. `1.0` is the default / no-op. Stored as a float because, unlike
   * the other PBR factors, it is a world distance rather than a `[0, 1]` value.
   * New in v4.
   */
  eachMaterialTriplanarScale: Float32Array<any>;

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

  // ── v2 references / transforms ────────────────────────────────────

  /** Per-geometry stable string ID. */
  eachGeometryId: string[];

  /**
   * Per-mesh geometry ID. When the geometry payload is omitted, this must name
   * a geometry already present in the destination SceneModel.
   */
  eachMeshGeometryId: string[];

  /**
   * Per-mesh material ID. Empty string means no material reference and falls
   * back to the inline RGBA attributes.
   */
  eachMeshMaterialId: string[];

  /** Per-transform stable string ID. */
  eachTransformId: string[];

  /** Per-transform parent ID. Empty string means root transform. */
  eachTransformParentId: string[];

  /** Per-transform base into {@link matrices}. */
  eachTransformMatricesBase: Uint32Array<any>;

  /** Per-mesh parent transform ID. Empty string means no parent transform. */
  eachMeshParentTransformId: string[];

  // ── Representation sets ───────────────────────────────────────────

  /** Per-representation-set string ID. */
  eachRepSetId: string[];

  /** Per-representation-set default representation ID. */
  eachRepSetDefaultRepId: string[];

  /**
   * Per-representation-set selection strategy:
   *   0 — no declarative selection metadata
   *   1 — projectedSize
   */
  eachRepSetSelectionStrategy: Uint8Array<any>;

  /**
   * Per-representation-set hysteresis in pixels. `NaN` means absent.
   */
  eachRepSetHysteresisPixels: Float32Array<any>;

  /** Per-representation-set base into the representation arrays. */
  eachRepSetRepsBase: Uint32Array<any>;

  /** Per-representation string ID. */
  eachRepId: string[];

  /** Per-representation minimum projected size in pixels. `NaN` means absent. */
  eachRepRangeMinPixels: Float32Array<any>;

  /** Per-representation maximum projected size in pixels. `NaN` means absent. */
  eachRepRangeMaxPixels: Float32Array<any>;

  /** Per-representation base into {@link repObjectIds}. */
  eachRepObjectIdsBase: Uint32Array<any>;

  /** SceneObject IDs referenced by representations. */
  repObjectIds: string[];
}
