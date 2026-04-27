/**
 * Parameters for a {@link Bloom}.
 *
 * * Returned by {@link Bloom.toParams | Bloom.toParams}
 * * Passed to {@link Bloom.fromParams | Bloom.fromParams}
 * * Located at {@link ViewParams.bloom | ViewParams.bloom}
 */
export interface BloomParams {

  /**
   * Which rendering modes in which to apply {@link Bloom}.
   *
   * Default value is [{@link constants!RealisticRender | RealisticRender}].
   */
  renderModes?: number[];

  /**
   * Whether the bloom pass runs. When `false`, the renderer skips it
   * entirely (no FBOs bound, no shader dispatch) — cheaper than setting
   * {@link BloomParams.intensity} to 0.
   *
   * Default is `true` when the renderer has HDR. Bloom is only meaningful
   * with an HDR substrate; in LDR mode it's forced off.
   */
  enabled?: boolean;

  /**
   * Luminance threshold above which pixels contribute to bloom. Values
   * between scene-reasonable `1.0` and `~4.0` are common. Default is `1.0`.
   */
  threshold?: number;

  /**
   * Soft-knee width around the threshold. `0` gives a hard cut, higher
   * values smooth the roll-in so bloom appears more gradually as pixels
   * approach the threshold. Range roughly `[0, 1]`. Default is `0.5`.
   */
  knee?: number;

  /**
   * How strongly the bloom pyramid is added back to the scene. `0` = off
   * (but still costs the prep passes — use {@link enabled} to really skip
   * the work), `1` = full additive contribution. Default is `0.4`.
   */
  intensity?: number;
}
