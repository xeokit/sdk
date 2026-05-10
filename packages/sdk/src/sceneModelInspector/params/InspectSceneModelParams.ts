import type {SceneModel} from "../../scene";
import type {InspectionRegistry} from "../InspectionRegistry";
import type {InspectProgress} from "./InspectProgress";


/** Parameters for {@link inspectSceneModel}. */
export interface InspectSceneModelParams {

  /** SceneModel to inspect. May be in any state — finalised or not. */
  sceneModel: SceneModel;

  /**
   * Registry of {@link Inspection | inspections} to run. Defaults
   * to {@link DEFAULT_INSPECTION_REGISTRY} when omitted — that's
   * the singleton plugins extend on import. Tests / one-off
   * pipelines build a fresh {@link InspectionRegistry} and pass it
   * in here.
   *
   * Each registered inspection is invoked once per call. Opt-in
   * inspections still consult the matching `check…` flag below
   * before doing any work.
   */
  registry?: InspectionRegistry;

  /**
   * When `true`, hash every {@link SceneGeometry}'s content
   * (primitive, positions, indices, normals, UVs, AABB) and emit
   * one `GEOMETRY_DUPLICATE` warning per group of two or more
   * byte-identical geometries.
   *
   * Off by default — duplicate detection streams every vertex byte
   * of every geometry through an FNV-1a hash, which on a model
   * with many large geometries adds noticeable cost. Enable when
   * looking for instancing opportunities (multiple identical
   * geometries can collapse to one + multiple meshes), or when
   * tracking down loader bugs that emit redundant geometry.
   */
  checkDuplicateGeometries?: boolean;

  /**
   * When `true`, geometrically compare triangle-indexed
   * SceneGeometries and emit one `GEOMETRY_SIMILAR` warning per
   * group of two or more geometries with the same shape (same
   * topology + same edge-length distribution), regardless of
   * whether their vertex data is byte-identical. Catches "same
   * shape, different vertex order / different translation /
   * different rotation / different reflection" cases that the
   * byte-equality check can't.
   *
   * Off by default — the check decompresses positions and walks
   * every triangle edge of every triangle-indexed geometry,
   * which is heavier than the duplicate hash. The signature is
   * pose-invariant (edge lengths are preserved under translation,
   * rotation, and reflection) but **not** scale-invariant — a 1 m
   * cube and a 5 m cube fingerprint differently. False positives
   * are possible (two unrelated shapes happen to share a topology
   * and edge-length histogram); the warning is advisory and never
   * auto-collapses.
   */
  checkSimilarGeometries?: boolean;

  /**
   * When `true`, emit one `GEOMETRY_OVER_BUDGET` warning per
   * SceneGeometry whose vertex count exceeds {@link maxVertices}
   * or whose primitive count exceeds {@link maxPrimitives} —
   * "dense" geometry that's too heavy for the configured storage
   * budget. The built-in {@link splitDenseGeometry}
   * consumes these issues and splits each over-budget geometry
   * in half via {@link splitSceneGeometry}.
   *
   * Off by default — even though the check itself is cheap,
   * having every load surface a warning per heavy geometry is
   * noisy unless the caller is actively budgeting for the split
   * pipeline.
   */
  checkDenseGeometries?: boolean;

  /**
   * Vertex-count threshold for `GEOMETRY_OVER_BUDGET`. A geometry
   * with more than this many vertices is flagged. Default `65535`
   * — one less than the Uint16 quantisation cap, so each piece's
   * `positionsCompressed` slots cleanly into a `u16` index space.
   */
  maxVertices?: number;

  /**
   * Primitive-count threshold for `GEOMETRY_OVER_BUDGET` —
   * triangles for triangle-indexed geometries
   * (`Triangles` / `Solid` / `Surface`), lines for `Lines`, etc.
   * Default `32768` — comfortable for a single GPU batch while
   * still giving the renderer scope to coalesce many objects.
   */
  maxPrimitives?: number;

  /**
   * When `true`, emit one `GEOMETRY_OVER_EXTENT` warning per
   * SceneGeometry whose AABB extent on at least one axis exceeds
   * {@link maxExtent} — "large" geometry that's physically big in
   * world units. The built-in
   * {@link splitLargeGeometry} consumes these issues
   * and splits each over-extent geometry in half.
   *
   * Off by default. Orthogonal to {@link checkDenseGeometries} —
   * a geometry can be dense without being large (high-poly small
   * object) or large without being dense (coarsely tessellated
   * terrain).
   */
  checkLargeGeometries?: boolean;

  /**
   * Per-axis AABB extent threshold for `GEOMETRY_OVER_EXTENT`, in
   * the SceneModel's coordinate-system units (typically metres).
   * A geometry whose AABB has any axis dimension greater than this
   * is flagged. Default `100` — reasonable for individual building
   * elements; tune for site / district models.
   */
  maxExtent?: number;

  /**
   * When `true`, run the geometry-quality pass — five advisory
   * warnings derived from a single walk per geometry:
   *
   *   - `GEOMETRY_ZERO_VOLUME_AABB` — AABB collapsed to point /
   *     line.
   *   - `GEOMETRY_DEGENERATE_TRIANGLES` — repeated indices or
   *     near-zero face area.
   *   - `GEOMETRY_UNUSED_VERTICES` — vertex slots no index touches.
   *   - `GEOMETRY_DUPLICATE_VERTICES` — slots byte-identical
   *     across positions / normals / UVs.
   *   - `GEOMETRY_NON_WATERTIGHT` — `SolidPrimitive` with edges
   *     not shared by exactly two faces.
   *
   * Off by default — the degenerate-triangle and duplicate-vertex
   * checks decompress positions and hash every vertex's bytes,
   * which on a model with many large geometries adds noticeable
   * cost. Each emitted code has a matching auto-fix
   * (`dropDegenerateTriangles`, `compactUnusedVertices`,
   * `mergeDuplicateVertices`, `downgradeNonWatertight`); only
   * `GEOMETRY_ZERO_VOLUME_AABB` is left for manual triage since
   * remediation would cascade into mesh / object destruction.
   */
  checkGeometryQuality?: boolean;

  /**
   * Used-fraction threshold for `GEOMETRY_AABB_NOT_TIGHT` — the
   * inspection compares the actual u16 footprint of
   * `positionsCompressed` (per axis) against the available
   * `[0, 65535]` range. The check fires when the smallest-axis
   * fill is below this fraction. Default `0.5`.
   *
   * Lower values surface fewer warnings but miss real precision
   * waste; higher values flag mildly-sized AABBs that would
   * benefit only marginally from re-tightening.
   */
  minAabbFill?: number;

  /**
   * When `true`, run the object-structure pass — for each
   * SceneObject, compute the world-space AABB of its meshes and
   * emit:
   *
   *   - `OBJECT_FAR_FROM_ORIGIN` when the AABB centroid magnitude
   *     exceeds {@link maxOriginDistance}.
   *   - `OBJECT_DUPLICATE_AABB` when two or more SceneObjects
   *     share byte-identical world AABB and the same mesh count.
   *
   * Off by default. The far-from-origin check is the standard
   * tripwire for "this BIM was authored in georeferenced
   * coordinates"; the duplicate-AABB check catches loaders that
   * emit the same element twice.
   */
  checkObjectStructure?: boolean;

  /**
   * Centroid-magnitude threshold for `OBJECT_FAR_FROM_ORIGIN`, in
   * the SceneModel's coordinate-system units (typically metres).
   * A SceneObject whose world AABB centroid is further than this
   * from the origin is flagged. Default `1e6` — well below the
   * point where `Float32` precision starts to bite (~7 significant
   * decimal digits) but high enough that normal BIM-local models
   * never trip.
   */
  maxOriginDistance?: number;

  /**
   * When `true`, walk every SceneTexture and emit:
   *
   *   - `TEXTURE_NPOT` when width or height isn't a power of two.
   *   - `TEXTURE_OVERSIZED` when width or height exceeds
   *     {@link maxTextureDim}.
   *
   * Off by default. Both checks are advisory only — the SDK ships
   * no auto-fix; resize / downsample needs lossy judgement and
   * image-manipulation tooling outside this module's scope.
   */
  checkTextureSanity?: boolean;

  /**
   * Pixel-dimension threshold for `TEXTURE_OVERSIZED`. A texture
   * whose width or height exceeds this is flagged. Default
   * `4096` — the WebGL 2 minimum-guaranteed `MAX_TEXTURE_SIZE`,
   * which any real-world device clears comfortably; above that,
   * memory + upload cost grows quadratically (a 4K × 4K RGBA
   * texture is ~67 MB before mipmaps).
   */
  maxTextureDim?: number;

  /**
   * When `true`, run the geometry-far-from-origin pass — flags
   * every {@link SceneGeometry} whose **local** AABB centroid
   * has magnitude above {@link maxOriginDistance}.
   *
   * Distinct from {@link checkObjectStructure}'s
   * `OBJECT_FAR_FROM_ORIGIN`: that walks world-space AABBs after
   * `mesh.worldMatrix` is applied. This one localises the offset
   * to the geometry, where the matching {@link recenterGeometry}
   * can shift it out of `geom.aabb` and into each referencing
   * mesh's matrix without touching vertex data.
   *
   * Off by default. Re-uses {@link maxOriginDistance} as the
   * threshold — same units, same risk.
   */
  checkGeometryFarFromOrigin?: boolean;

  /**
   * Optional `AbortSignal`. {@link inspectSceneModelAsync} checks
   * `signal.aborted` between inspections and throws an
   * `AbortError` (a `DOMException` with `name === "AbortError"`)
   * when the caller aborts. Issues collected before the abort
   * are discarded — re-run after the abort to recompute. The
   * synchronous {@link inspectSceneModel} ignores this field.
   */
  signal?: AbortSignal;

  /**
   * Optional progress callback fired by
   * {@link inspectSceneModelAsync}. Called with
   * `phase: "before"` ahead of each inspection's `run`,
   * `phase: "after"` once it returns, and once more at
   * completion (`phase: "after"`, `current: total`,
   * `label: ""`). The synchronous {@link inspectSceneModel}
   * ignores this field.
   */
  onProgress?: (progress: InspectProgress) => void;
}
