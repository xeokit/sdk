/**
 * Parameters for {@link BodyHatch}.
 *
 * * Returned by {@link BodyHatch.toParams | BodyHatch.toParams}
 * * Passed to {@link BodyHatch.fromParams | BodyHatch.fromParams}
 * * Located at {@link EffectsParams.bodyHatch}
 */
export interface BodyHatchParams {
  /**
   * Whether hatched-Lambert body shading is applied.
   *
   * Default is `false`.
   */
  enabled?: boolean;
}
