import type {FloatArrayParam} from "../math";

/**
 * Parameters for a {@link DirLight}.
 *
 * * Returned by {@link DirLight.toParams | DirLight.toParams}
 * * Passed to {@link DirLight.fromParams | DirLight.fromParams}
 * * Located at {@link ViewParams.lights | ViewParams.lights}
 */
export interface DirLightParams {

  /** Optional ID, generated automatically when omitted.
   */
  id?: string;

  /**
   * 3D direction of the {@link DirLight}.
   *
   * Range is `[-1..1, -1..1, -1..1]`.
   *
   * Default value is `[1.0, 1.0, 1.0]`.
   */
  dir?: FloatArrayParam;

  /**
   * RGB color of the {@link DirLight}.
   *
   * Range is `[0..1, 0..1, 0..1]`.
   *
   * Default value is `[1.0, 1.0, 1.0]`.
   */
  color?: FloatArrayParam;

  /**
   * Intensity of the {@link DirLight}.
   *
   * Value is in range `[0..1]`.
   *
   * Default value is `1.0`.
   */
  intensity?: number;

  /**
   * 3D coordinate space in which the {@link DirLight} is oriented.
   *
   * Accepted value is "world" or "view".
   *
   * Default is "world".
   */
  space?: string;
}
