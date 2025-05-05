import type { FloatArrayParam } from "../math";

/**
 * Parameters for an {@link AmbientLight}.
 *
 * * Returned by {@link AmbientLight.toParams | AmbientLight.toParams}
 * * Passed to {@link AmbientLight.fromParams | AmbientLight.fromParams}
 * * Located at {@link ViewParams.lights | ViewParams.lights}
 */
export interface AmbientLightParams {

  /** Optional ID, generated automatically when omitted.
     */
  id?: string;

  /**
     * RGB color of the {@link AmbientLight}.
     *
     * Range is `[0..1, 0..1, 0..1]`.
     *
     * Default value is `[1.0, 1.0, 1.0]`.
     */
  color?: FloatArrayParam;

  /**
     * Intensity of the {@link AmbientLight}.
     *
     * Default value is `0.5`.
     */
  intensity?: number;
}
