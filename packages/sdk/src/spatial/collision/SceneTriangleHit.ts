import type {Vec3Float} from "../../base/math/vector";

/**
 * A triangle-precise ray hit against a SceneObject mesh.
 *
 * Returned by {@link intersectSceneRayTriangle} and surfaced through
 * {@link SceneRaycaster.pick} as the `value` of a successful hit.
 */
export interface SceneTriangleHit {
  /** ID of the {@link model!scene.SceneObject | SceneObject} the triangle belongs to. */
  objectId: string;
  /** ID of the {@link model!scene.SceneMesh | SceneMesh} the triangle belongs to. */
  meshId: string;
  /** World-space hit point. */
  worldPos: Vec3Float;
  /**
   * Parametric distance along the input ray, in `dir`-multiples. The hit
   * point equals `origin + dir * tHit` (modulo the same floating-point
   * round-off as any other ray test).
   */
  tHit: number;
  /** Index of the hit triangle (offset into `geometry.indices` divided by 3). */
  triangleIndex: number;
}
