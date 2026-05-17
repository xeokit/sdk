import type {FloatArrayParam} from "../../../base/math";
import type {SceneModel} from "../../../model/scene";
import type {SceneCollisionIndex} from "../../../spatial/collision";

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
   * Optional cut-away clip plane. When supplied, triangles
   * whose **centroid** satisfies
   * `dot(centroid - clipPoint, clipNormal) < 0` are skipped
   * during tile rasterisation. `clipNormal` must be unit
   * length. The kept side of the plane is the side
   * `clipNormal` points toward.
   */
  clipPoint?: ArrayLike<number>;
  clipNormal?: ArrayLike<number>;
}
