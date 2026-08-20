/**
 * Parameters for {@link Texturing}.
 *
 * * Passed to {@link ViewParams.texturing}.
 * * Returned by {@link Texturing.toParams}.
 */
export interface TexturingParams {

  /**
   * Whether textures on {@link ViewObject | ViewObjects} are visible.
   *
   * Default is `true`.
   */
  enabled?: boolean;
}
