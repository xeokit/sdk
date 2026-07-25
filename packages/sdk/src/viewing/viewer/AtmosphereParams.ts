/**
 * Parameters for a {@link Atmosphere}.
 *
 * * Returned by {@link Atmosphere.toParams | Atmosphere.toParams}
 * * Passed to {@link Atmosphere.fromParams | Atmosphere.fromParams}
 * * Located at {@link EffectsParams.atmosphere}
 */
export interface AtmosphereParams {

  /**
   * Which rendering modes in which to apply atmospheric attenuation.
   *
   * Default value is [{@link base!constants.RealisticRender | RealisticRender}]
   * when this effect is explicitly configured. Omitted
   * {@link EffectsParams.atmosphere} leaves the effect inactive.
   */
  renderModes?: number[];

  /**
   * RGB haze color mixed into distant scene geometry.
   *
   * Default is `[0.72, 0.82, 0.92]`.
   */
  color?: number[];

  /**
   * View-space distance, in world units, at which attenuation begins.
   *
   * Default is `80`.
   */
  startDistance?: number;

  /**
   * View-space distance, in world units, at which attenuation reaches
   * full configured strength.
   *
   * Default is `500`.
   */
  endDistance?: number;

  /**
   * Overall atmospheric attenuation strength.
   *
   * Default is `0.35`.
   */
  intensity?: number;

  /**
   * Maximum haze opacity after distance and intensity are applied.
   *
   * Default is `0.55`.
   */
  maxOpacity?: number;

  /**
   * Whether to haze sky/background pixels. Default `false`.
   */
  affectSky?: boolean;
}
