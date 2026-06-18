import type {SceneModel} from "../../../model/scene";


/**
 * Lazy per-column cache of derived data the inspect / fix
 * pipeline reads from a {@link model!scene.SceneModel | SceneModel}. Single source of
 * truth for "expensive precomputable rows" — content hashes,
 * vertex dedup maps, edge incidence counts, decompressed
 * positions, reverse-reference tables — so the same work isn't
 * repeated by every inspection that needs it (and again by every
 * fix that touches the same geometry).
 *
 * **Per-column lazy.** Each accessor builds and caches on first
 * call, returns the cached value thereafter. A consumer that only
 * needs `contentHash` doesn't pay for `decompressedPositions` or
 * `edgeToTriangles`.
 *
 * **Where it lives.** Held in a process-local WeakMap keyed by
 * SceneModel via {@link getInspectionIndex} — no SceneModel API
 * change, auto-GC'd, transparent to consumers. Each
 * `inspectSceneModel` / `applyFixes` run reuses the same index
 * across inspections + fixes.
 *
 * **Invalidation.** Coarse, orchestrator-driven. After a fix
 * mutates a geometry the orchestrator calls
 * {@link invalidateGeometry}; after a fix touches references it
 * calls {@link invalidateReferences}. Clients that mutate the
 * SceneModel outside the framework should call
 * {@link invalidateAll} when they're done.
 */
export interface SceneModelInspectionIndex {

  /** SceneModel this index is built against. */
  readonly sceneModel: SceneModel;

  // ── Per-geometry rows ───────────────────────────────────────

  /**
   * FNV-1a fingerprint over typed-array bytes + primitive constant
   * + AABB. Two geometries with the same `contentHash` have
   * identical content (modulo birthday-paradox collisions, which
   * are negligible for ≪ 10⁶ geometries). Used by
   * {@link duplicateGeometries}.
   */
  contentHash(geometryId: string): string;

  /**
   * `${primitive}|${vertCount}|${triCount}` topology key. Two
   * geometries with the same key have the same primitive type
   * and the same vertex / triangle counts — a fast pre-bucket
   * for shape-similarity matchers. Used by
   * {@link similarGeometries}.
   */
  topologyKey(geometryId: string): string;

  /**
   * 64-bin log₂ histogram of every triangle edge's length. Pose-
   * invariant shape fingerprint (translation / rotation /
   * reflection independent; NOT scale-invariant). Returns `null`
   * for non-triangle geometries. Used by
   * {@link similarGeometries}.
   */
  edgeLengthHistogram(geometryId: string): Uint32Array | null;

  /**
   * Dequantized vertex positions (3 floats per vertex), produced
   * by `decompressPositions3WithAABB3`. The heaviest column —
   * roughly `3 × vertCount × 4` bytes per geometry — gated behind
   * lazy access so callers that don't need it don't pay. Used by
   * {@link similarGeometries}, {@link geometryQuality}'s degenerate
   * triangle check, and the recenter / similar-merge fixes.
   */
  decompressedPositions(geometryId: string): Float32Array;

  /**
   * Bit per vertex slot — 1 = referenced by some entry of
   * `geom.indices` or `geom.edgeIndices`, 0 = unused. Used by
   * {@link geometryQuality}'s unused-vertex check and the
   * `compactUnusedVertices` fix.
   */
  vertexUsageMask(geometryId: string): Uint8Array;

  /**
   * Per-vertex-slot remap: `canonical[v] === v` iff `v` is the
   * first occurrence of its byte signature; otherwise points at
   * the canonical slot to coalesce onto. Returns `null` for
   * geometries without `positionsCompressed`. Used by
   * {@link geometryQuality}'s duplicate-vertex check and the
   * `mergeDuplicateVertices` fix.
   */
  canonicalSlots(geometryId: string): {
    canonical: Int32Array;
    uniqueCount: number;
  } | null;

  /**
   * Undirected edge → incidence count. Key is `lo_hi` with
   * `lo = min(a, b)`, `hi = max(a, b)`. Watertight closed
   * manifolds have every edge incident to exactly 2 triangles.
   * Returns `null` for non-triangle geometries. Used by
   * {@link geometryQuality}'s non-watertight check.
   */
  undirectedEdgeIncidence(geometryId: string): Map<string, number> | null;

  /**
   * Undirected edge → list of triangle ids that include it,
   * plus a per-triangle degeneracy bitmap. Same key shape as
   * {@link undirectedEdgeIncidence}, but the heavier triangle-id
   * list is only paid when a consumer actually needs adjacency
   * (the `unifyTriangleWinding` fix's flood-fill walk). The
   * `degenerate` bitmap has `degenerate[t] === 1` iff triangle
   * `t` has repeated indices (its edges are NOT registered in
   * `edges`). Returns `null` for non-triangle geometries.
   */
  edgeToTriangles(geometryId: string): {
    edges: Map<string, number[]>;
    degenerate: Uint8Array;
  } | null;

  /**
   * Directed edge → incidence count. Key is `a_b`. Manifold
   * meshes have each shared edge traversed in *opposite*
   * directions by its two adjacent triangles, so any directed
   * edge with count > 1 indicates inconsistent winding. Returns
   * `null` for non-triangle geometries. Used by
   * {@link geometryQuality}'s winding check.
   */
  directedEdgeIncidence(geometryId: string): Map<string, number> | null;

  /**
   * Sorted-vertex-triple keys for triangle-dedup, plus the count
   * of duplicate (already-seen) triangles encountered during the
   * walk and a per-triangle "kept" bitmap. Each key is `a_b_c`
   * with `a ≤ b ≤ c`, so all rotations / reflections of the same
   * triangle collapse to one key. Degenerate triangles
   * (`i0 === i1 || i1 === i2 || i0 === i2`) are kept (they're a
   * separate concern). Returns `null` for non-triangle geometries.
   *
   *   - `keys` — set of every distinct canonical key seen.
   *   - `duplicateCount` — count of triangles whose canonical key
   *     was already in `keys` at walk time. Read by
   *     {@link geometryQuality}'s duplicate-triangles check.
   *   - `kept` — `Uint8Array(triCount)` with `kept[t] === 1` iff
   *     `t` was the first occurrence of its canonical key (or is
   *     degenerate). Read by the `dropDuplicateTriangles` fix to
   *     know which triangles to keep.
   */
  canonicalTriangleKeys(geometryId: string): {
    keys: Set<string>;
    duplicateCount: number;
    kept: Uint8Array;
  } | null;

  /** Squared centroid magnitude `cx² + cy² + cz²` from the AABB. Cheap. */
  aabbCentroidMagSq(geometryId: string): number;

  // ── Per-object rows ─────────────────────────────────────────

  /**
   * World-space AABB (union of mesh world AABBs). Used by
   * {@link objectPlacement}'s far-from-origin and duplicate-AABB
   * checks.
   */
  objectWorldAABB(objectId: string): Float32Array;

  // ── Per-scene reverse-reference tables ──────────────────────

  /** materialId → mesh ids that reference it. */
  materialReferences(): ReadonlyMap<string, readonly string[]>;

  /** textureId → material ids that reference it. */
  textureReferences(): ReadonlyMap<string, readonly string[]>;

  /**
   * transformId → meshes that name it as parent + transforms
   * that name it as parent.
   */
  transformReferences(): ReadonlyMap<string, {
    meshes: readonly string[];
    childTransforms: readonly string[];
  }>;

  // ── Lifecycle hooks ─────────────────────────────────────────

  /** Drop one geometry's cached rows. */
  invalidateGeometry(geometryId: string): void;

  /** Drop one object's cached rows. */
  invalidateObject(objectId: string): void;

  /** Drop the per-scene reverse-reference tables. */
  invalidateReferences(): void;

  /** Clear every cached row in the index. */
  invalidateAll(): void;

  /**
   * Free the heaviest cached rows (decompressed positions,
   * directed/undirected edge maps, canonical-triangle key sets)
   * but keep the cheap ones (content hash, topology key,
   * canonical slots, AABB centroid). Called by the orchestrator
   * after `inspectSceneModel` returns, unless the caller pinned
   * them.
   */
  releaseHeavyRows(): void;
}
