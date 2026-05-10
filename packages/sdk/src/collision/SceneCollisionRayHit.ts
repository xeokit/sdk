/**
 * Hit record for a ray query against the {@link SceneCollisionIndex}.
 *
 * `tEnter` and `tExit` are the parametric distances along the ray at
 * which it enters and exits the object's world-space AABB. The hit
 * point is `origin + dir * tEnter`. Results are reported in
 * ray-AABB granularity — triangle-level intersection tests are not
 * performed.
 */
export interface SceneCollisionRayHit {
  /** ID of the {@link scene!SceneObject | SceneObject}. */
  objectId: string;
  /** Parametric distance along the ray at which it enters the object's AABB. */
  tEnter: number;
  /** Parametric distance along the ray at which it exits the object's AABB. */
  tExit: number;
}
