/**
 * Parameters for a {@link ResolutionScale}.
 *
 * * Returned by {@link ResolutionScale.toParams | ResolutionScale.toParams}
 * * Passed to {@link ResolutionScale.fromParams | ResolutionScale.fromParams}
 * * Located at {@link ViewParams.resolutionScale | ViewParams.resolutionScale}
 */
export interface ResolutionScaleParams {
  /**
   * Whether this component is enabled.
   */
  enabled?: boolean;

  /**
   *The scale when {@link ResolutionScale} is applied.
   *
   * Default is ````0.5````.
   */
  resolutionScale?: number;
}
