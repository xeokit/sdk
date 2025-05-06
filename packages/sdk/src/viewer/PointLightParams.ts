import {type FloatArrayParam} from "../math";

/**
 * Parameters for a {@link PointLight}.
 *
 * * Returned by {@link PointLight.toParams | PointLight.toParams}
 * * Passed toy {@link PointLight.fromParams | PointLight.fromParams}
 * * Located at {@link ViewParams.lights | ViewParams.lights}
 */
export interface PointLightParams {

  /** Optional ID, generated automatically when omitted.
   */
  id?: string;

  /**
   * Intensity of the {@link PointLight}.
   *
   * Value is in range `[0..1]`.
   *
   * Default value is `1.0`.
   */
  intensity?: number;

  /**
   * RGB color of the {@link PointLight}.
   *
   * Range is `[0..1, 0..1, 0..1]`.
   *
   * Default value is `[1.0, 1.0, 1.0]`.
   */
  color?: FloatArrayParam;

  /**
   * 3D position of the {@link PointLight}.
   */
  pos?: FloatArrayParam;

  /**
   * 3D coordinate space in which the {@link PointLight} is positioned.
   *
   * Accepted value is "world" or "view".
   *
   * Default is "world".
   */
  space?: string;

  /** Quadratic attenuation factor of the {@link PointLight}.
   */
  quadraticAttenuation?: number;

  /** Constant attenuation factor of the {@link PointLight}.
   */
  constantAttenuation?: number;

  /** Linear attenuation factor of the {@link PointLight}.
   */
  linearAttenuation?: number;
}
