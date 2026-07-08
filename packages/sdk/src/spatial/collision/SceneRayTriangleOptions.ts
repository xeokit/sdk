/**
 * Optional settings on {@link intersectSceneRayTriangle}.
 */
export interface SceneRayTriangleOptions {
  /** Minimum parametric distance along the ray. Defaults to `0`. */
  tMin?: number;
  /** Maximum parametric distance along the ray. Defaults to `Infinity`. */
  tMax?: number;
  /**
   * Pre-filter on candidate object IDs. Returning `false` skips the whole
   * object before any per-mesh / per-triangle work. Used to exclude
   * hidden, non-pickable, or marker-only objects from triangle scanning.
   */
  filter?: (objectId: string) => boolean;
  /**
   * When true, compute the world-space face normal of the hit triangle.
   * Defaults to false because it needs three extra point transforms for
   * every nearest-hit candidate.
   */
  pickSurfaceNormal?: boolean;
}
