/**
 * Parameters for a {@link ColorGrading}.
 *
 * * Returned by {@link ColorGrading.toParams | ColorGrading.toParams}
 * * Passed to {@link ColorGrading.fromParams | ColorGrading.fromParams}
 * * Located at {@link EffectsParams.colorGrading}
 */
export interface ColorGradingParams {
  /**
   * Whether this component is enabled.
   */
  enabled?: boolean;

  /**
   * Linear brightness offset. Range roughly `[-1, 1]`. Default is `0`.
   */
  brightness?: number;

  /**
   * Contrast multiplier around mid gray. Range roughly `[0, 4]`.
   * Default is `1`.
   */
  contrast?: number;

  /**
   * Saturation multiplier. `0` is grayscale, `1` is neutral, values above
   * `1` increase colorfulness. Range roughly `[0, 4]`. Default is `1`.
   */
  saturation?: number;

  /**
   * Display-space gamma correction applied as `pow(color, 1 / gamma)`.
   * Range roughly `[0.1, 4]`. Default is `1`.
   */
  gamma?: number;

  /**
   * Warm/cool balance. Negative values cool the image, positive values warm
   * it. Range roughly `[-1, 1]`. Default is `0`.
   */
  temperature?: number;

  /**
   * Green/magenta tint balance. Negative values add magenta, positive values
   * add green. Range roughly `[-1, 1]`. Default is `0`.
   */
  tint?: number;
}
