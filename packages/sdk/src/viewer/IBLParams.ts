/**
 * Parameters for {@link IBL}.
 *
 * * Returned by {@link IBL.toParams}
 * * Passed to {@link IBL.fromParams}
 * * Located at {@link LightsParams.ibl}
 */
export interface IBLParams {

  /**
   * Which rendering modes in which to apply cubemap {@link IBL}.
   *
   * Default value is [{@link constants!DetailedRender | DetailedRender},
   * {@link constants!RealisticRender | RealisticRender}].
   */
  renderModes?: number[];

  /**
   * Multiplier on the cubemap IBL ambient + specular contribution.
   * Range `[0, ∞)`. At `0` the cubemap contributes nothing even when
   * the active {@link View.renderMode} is in
   * {@link IBLParams.renderModes}.
   *
   * Default value is `1.4` — a modest boost over the natural `1.0`
   * level so RealisticRender's prefiltered-cubemap fill reads as
   * distinctly brighter than the analytical hemisphere fill in
   * NavigationRender / DetailedRender.
   */
  intensity?: number;
}
