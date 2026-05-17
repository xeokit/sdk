/**
 * Parameters for a {@link Bloom}.
 *
 * * Returned by {@link Bloom.toParams | Bloom.toParams}
 * * Passed to {@link Bloom.fromParams | Bloom.fromParams}
 * * Located at {@link EffectsParams.bloom}
 */
export interface BloomParams {

  /**
   * Which rendering modes in which to apply {@link Bloom}.
   *
   * Default value is [{@link base!constants.RealisticRender | RealisticRender}].
   */
  renderModes?: number[];

  /**
   * Luminance threshold above which pixels contribute to bloom. Values
   * between scene-reasonable `1.0` and `~4.0` are common. Default is
   * `4.0` — only the brightest HDR-range pixels (sun core, smooth-metal
   * specular peaks) bloom, so the effect reads as a tight glow on real
   * highlights rather than a haze over moderately-bright surfaces.
   */
  threshold?: number;

  /**
   * Soft-knee width around the threshold. `0` gives a hard cut, higher
   * values smooth the roll-in so bloom appears more gradually as pixels
   * approach the threshold. Range roughly `[0, 1]`. Default is `0.5`.
   */
  knee?: number;

  /**
   * How strongly the bloom pyramid is added back to the scene. `0` =
   * no contribution (but still costs the prep passes — drop the active
   * {@link View.renderMode} out of {@link BloomParams.renderModes} to
   * skip the work entirely), `1` = full additive contribution.
   * Default is `0.15` — a subtle additive contribution that picks
   * up specular peaks (HDR sun, smooth-metal reflections) without
   * washing out the rest of the scene. Increase for a more
   * pronounced glow.
   */
  intensity?: number;
}
