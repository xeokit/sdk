/**
 * Parameters for a {@link DepthOfField}.
 *
 * * Returned by {@link DepthOfField.toParams | DepthOfField.toParams}
 * * Passed to {@link DepthOfField.fromParams | DepthOfField.fromParams}
 * * Located at {@link EffectsParams.depthOfField}
 */
export interface DepthOfFieldParams {
  /**
   * Whether this component is enabled.
   */
  enabled?: boolean;

  /**
   * View-space distance, in world units, that remains sharp.
   *
   * Default is `50`.
   */
  focusDistance?: number;

  /**
   * Distance band around {@link DepthOfFieldParams.focusDistance} that
   * remains mostly sharp. Smaller values create a shallower focus region.
   *
   * Default is `20`.
   */
  focalRange?: number;

  /**
   * Maximum blur radius in scene pixels.
   *
   * Default is `4`.
   */
  radius?: number;

  /**
   * Overall blend strength for the blurred result.
   *
   * Default is `0.75`.
   */
  intensity?: number;

  /**
   * Blur multiplier for geometry nearer than {@link focusDistance}.
   *
   * Default is `0.25` so foreground geometry stays more legible.
   */
  nearBlur?: number;

  /**
   * Blur multiplier for geometry farther than {@link focusDistance}.
   *
   * Default is `1.0`.
   */
  farBlur?: number;
}
