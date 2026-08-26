import type {FloatArrayParam} from "@xeokit/sdk/base/math";
import type {SceneMesh, SceneModel, SceneObject} from "@xeokit/sdk/model/scene";
import type {SceneCollisionIndex} from "@xeokit/sdk/spatial/collision";

import type {ProjectionBasis} from "../ProjectionBasis";

/**
 * Parameters for {@link extractFillsTiled}. Drives the tiled
 * fill-polygon extractor that powers high-resolution drawing
 * fills without paying `O(resolution²)` peak memory.
 */
export interface ExtractFillsTiledParams {
  /** Source SceneModel to rasterise. */
  sourceModel: SceneModel;
  /** Projection basis (right/up/forward orthonormal triple). */
  basis: ProjectionBasis;
  /** Source-model world AABB (drives the buffer's basis-space extents). */
  aabb: FloatArrayParam;
  /** Basis-space d-coord of the projection plane (where fill polygons land in world space). */
  planeDepth: number;
  /**
   * Effective output resolution along the longer of (u, v). The
   * shorter axis is scaled to match the basis-rotated AABB
   * aspect ratio. Default `2048`.
   */
  resolution?: number;
  /**
   * Per-tile pixel size (square). Default `1024`. Smaller tiles
   * bound memory more tightly but pay more per-tile overhead
   * (BVH query + halo rasterisation duplication).
   */
  tileSize?: number;
  /**
   * Optional SceneCollisionIndex to narrow candidate objects
   * per tile. Without it the extractor walks every source
   * SceneObject per tile and AABB-tests each — O(N×T). The BVH
   * query is O(log N) per tile, which matters at scale.
   */
  collisionIndex?: SceneCollisionIndex;
  /**
   * Drop fills whose summed owner-pixel count across all tiles
   * is below this. Filters out salt-and-pepper noise. Default `4`.
   */
  minPixelArea?: number;
  /**
   * Douglas-Peucker simplification tolerance in pixel units.
   * `0.25` (default) preserves sub-pixel detail while collapsing
   * the redundant collinear vertices marching-squares emits
   * along straight edges. `0` keeps every marching-squares
   * vertex.
   */
  simplifyEpsilon?: number;
  /**
   * Optional callback awaited between tiles so the host
   * renderer can paint the partial result (or any other
   * work can interleave) while extraction streams through.
   * Without a yield callback the extractor runs straight
   * through to completion — the right shape when the caller
   * wants a single atomic drawing with no intermediate
   * frames.
   *
   * Called once per tile after that tile's rasterise +
   * marching-squares is done; not called inside a tile (one
   * 1024² tile is bounded at ~100 ms even on dense BIM, which
   * is well below a render budget). Not called during the
   * final per-owner stitch + triangulate pass — that pass is
   * cheap relative to rasterisation.
   */
  yield?: () => Promise<void>;
  /**
   * Optional check called between tiles. Return `true` to
   * abort extraction; the function returns the partial
   * (probably empty) result up to that point. Lets callers
   * pre-empt a long-running extraction when, e.g., the user
   * changes settings mid-flight.
   */
  cancelled?: () => boolean;
  /**
   * Optional cut-away clip planes. Each entry is `{point, normal}`
   * in world space with `normal` unit length pointing toward the
   * **kept** half-space. Triangles whose centroid fails any
   * plane's test (`dot(centroid - point, normal) < 0`) are
   * dropped during tile rasterisation. Mirrors
   * {@link BuildHLEDepthBufferOptions.clipPlanes} so HLE and
   * fills agree about what's kept.
   */
  clipPlanes?: Array<{point: ArrayLike<number>; normal: ArrayLike<number>}>;
  /**
   * Optional per-mesh predicate. Returning `false` excludes the
   * mesh from rasterisation — no triangles are tested, no
   * pixels are owned, no fill polygon is emitted for it.
   * Mirrors {@link BuildHLEDepthBufferOptions.meshFilter}; the
   * two are typically supplied together so HLE depth and fill
   * extraction agree on which meshes participate. `buildDrawing`
   * uses this to drop transparent meshes from the fill pass
   * when `transparentAsWireframe` is on.
   */
  meshFilter?: (mesh: SceneMesh, object: SceneObject) => boolean;
}
