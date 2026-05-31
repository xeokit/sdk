/**
 * Configuration for a {@link ViewCuller}.
 *
 * All fields are optional; the defaults are chosen for AECO/BIM scenes.
 */
export interface CullParams {

  /**
   * Minimum on-screen solid angle, in radians, below which an object is culled.
   *
   * The test is resolution-independent: an object is culled when
   * `asin(boundingRadius / distance)` is smaller than this. Set to `0` to keep
   * frustum culling only. Defaults to `0.004`.
   */
  solidAngleLimit?: number;

  /**
   * Post a cull pass only every Nth camera-movement event, bounding worker
   * traffic during continuous camera motion.
   *
   * A trailing pass runs once movement settles, so the resting frame is culled
   * for the camera's final position. Defaults to `5`.
   */
  cullEveryNUpdates?: number;
}

/**
 * Default {@link CullParams}, applied field-by-field for any value the caller
 * omits.
 */
export const DEFAULT_CULL_PARAMS: Required<CullParams> = {
  solidAngleLimit: 0.004,
  cullEveryNUpdates: 5
};
