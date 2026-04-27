/**
 * Parameters for an {@link SAO}.
 *
 * * Returned by {@link SAO.toParams | SAO.toParams}
 * * Passed to {@link SAO.fromParams | SAO.fromParams}
 * * Located at {@link ViewParams.sao | ViewParams.sao}
 */
export interface SAOParams {

  /**
   * Sets the maximum area that {@link SAO} takes into account when checking for possible occlusion for each fragment.
   *
   * Default value is ````100.0````.
   */
  kernelRadius?: number;

  /**
   * The {@link SAO} blend cutoff.
   *
   * Default value is ````0.3````.
   */
  blendCutoff?: number;

  /**
   * Whether the {@link SAO} Guassian blur is enabled.
   *
   * Default value is ````true````.
   */
  blur?: boolean;

  /**
   * The {@link SAO} occlusion scale.
   *
   * Default value is ````1.0````.
   */
  scale?: number;

  /**
   * The {@link SAO} bias.
   *
   * Default value is ````0.5````.
   */
  bias?: number;

  /**
   * The number of {@link SAO} samples.
   *
   * Default value is ````10````.
   */
  numSamples?: number;

  /**
   * The {@link SAO} blend scale.
   *
   * Default value is ````1.0````.
   */
  blendFactor?: number;

  /**
   * The {@link SAO} minimum resolution.
   *
   * Default value is ````0.0````.
   */
  minResolution?: number;

  /**
   * The degree of darkening (ambient obscurance) produced by the {@link SAO} effect.
   *
   * Default value is ````0.15````.
   */
  intensity?: number;

  /**
   * Which rendering modes in which to apply {@link SAO}.
   *
   * Default value is [{@link constants!DetailedRender | DetailedRender},
   * {@link constants!RealisticRender | RealisticRender}].
   */
  renderModes?: number[];
}
