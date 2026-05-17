import type {Vec3Float} from "../../base/math/vector";

/**
 * Outcome of a {@link SceneRaycaster.pick} call.
 *
 * Always includes the world-space ray that was tested (useful for
 * downstream visualisation or follow-up queries). Hit fields are populated
 * iff `hit === true`.
 */
export interface SceneRaycastResult {
  /** True when the ray hit a triangle that satisfied the pick filters. */
  hit: boolean;

  /** Object ID of the hit. `null` on a miss. */
  objectId: string | null;

  /** Mesh ID of the hit triangle. `null` on a miss. */
  meshId: string | null;

  /** World-space hit position. `null` on a miss. */
  worldPos: Vec3Float | null;

  /** Parametric distance along the ray, in `dir`-multiples. `null` on a miss. */
  tHit: number | null;

  /** Index of the hit triangle (offset into geometry indices ÷ 3); `-1` on a miss. */
  triangleIndex: number;

  /** World-space ray origin used for the test. */
  rayOrigin: Vec3Float;

  /** World-space ray direction used for the test (unnormalised). */
  rayDir: Vec3Float;
}
