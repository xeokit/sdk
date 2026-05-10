/**
 * Optional knobs on {@link SceneCollisionIndex.intersectRay}.
 */
export interface SceneCollisionRayOptions {
  /** Minimum parametric distance along the ray. Defaults to `0`. */
  tMin?: number;
  /** Maximum parametric distance along the ray. Defaults to `Infinity`. */
  tMax?: number;
}
