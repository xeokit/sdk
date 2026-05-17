/**
 * Antialiasing mode applied by {@link AntiAliasing} as the final
 * post-process step.
 *
 * - `"none"`: no AA pass; the tonemap result goes straight to the canvas.
 * - `"fxaa"`: single-pass fast approximate AA. Smooths geometric edges at
 *   the cost of a slight overall softening.
 */
export type AntiAliasingMode = "none" | "fxaa";

/**
 * Parameters for an {@link AntiAliasing}.
 *
 * * Returned by {@link AntiAliasing.toParams | AntiAliasing.toParams}
 * * Passed to {@link AntiAliasing.fromParams | AntiAliasing.fromParams}
 * * Located at {@link EffectsParams.antiAliasing}
 */
export interface AntiAliasingParams {

  /**
   * Which rendering modes in which to apply {@link AntiAliasing}.
   *
   * Default value is [{@link base!constants.DetailedRender | DetailedRender},
   * {@link base!constants.RealisticRender | RealisticRender}].
   */
  renderModes?: number[];

  /**
   * AA mode. Default is `"fxaa"` so AA is on by default when the renderer
   * supports it.
   */
  mode?: AntiAliasingMode;
}
