/**
 * Parameters for {@link IBL}.
 *
 * * Returned by {@link IBL.toParams}
 * * Passed to {@link IBL.fromParams}
 * * Located at {@link LightsParams.ibl}
 */
export interface IBLParams {
  /**
   * Whether this component is enabled.
   */
  enabled?: boolean;

  /**
   * Multiplier on the cubemap IBL ambient + specular contribution.
   * Range `[0, ∞)`. At `0` the cubemap contributes nothing even when
   * the component is enabled.
   *
   * Default value is `1.0`.
   */
  intensity?: number;
}
