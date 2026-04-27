import type {FloatArrayParam} from "../math";

/**
 * Parameters for a {@link Shadows}.
 *
 * * Returned by {@link Shadows.toParams | Shadows.toParams}
 * * Passed to {@link Shadows.fromParams | Shadows.fromParams}
 * * Located at {@link ViewParams.shadows | ViewParams.shadows}
 */
export interface ShadowsParams {

  /**
   * Which rendering modes in which to apply {@link Shadows}.
   *
   * Default value is [{@link constants!RealisticRender | RealisticRender}].
   */
  renderModes?: number[];

  /**
   * The darkness of the shadow where a surface is fully occluded from the light.
   *
   * Range is [0..1]. Default value is ````0.45````.
   */
  intensity?: number;

  /**
   * Depth-compare bias used to avoid self-shadowing ("shadow acne").
   *
   * Applied in light-space normalized depth units. Default value is ````0.003````.
   */
  bias?: number;

  /**
   * Edge-of-frustum dimension (world units) of the shadow map's orthographic projection.
   *
   * Larger values cover more of the scene but reduce resolution. Default value is ````30````.
   */
  projectionSize?: number;

  /**
   * Distance from the scene center to place the virtual light along {@link ShadowsParams.direction}.
   *
   * Default value is ````50````.
   */
  lightDistance?: number;

  /**
   * Pixel resolution of the (square) shadow map.
   *
   * Default value is ````2048````.
   */
  resolution?: number;

  /**
   * World-space direction the shadow-casting light points in.
   *
   * Default value is ````[-0.5, -1.0, -0.3]````.
   */
  direction?: FloatArrayParam;

  /**
   * When `true`, the shadow frustum is auto-sized each frame to tightly bracket
   * the camera's view frustum (clamped to {@link ShadowsParams.maxDistance}).
   * This directs the shadow map's texel budget at what the user is actually
   * looking at, dramatically improving effective resolution.
   *
   * When `false`, {@link ShadowsParams.projectionSize} and
   * {@link ShadowsParams.lightDistance} control the frustum manually.
   *
   * Default value is `true`.
   */
  autoFit?: boolean;

  /**
   * When {@link ShadowsParams.autoFit} is `true`, the far plane of the shadow
   * frustum is clamped to this distance from the camera, in world units.
   * Keeping this small focuses shadow-map resolution on nearby geometry.
   *
   * Default value is `200`.
   */
  maxDistance?: number;

  /**
   * Multiplier applied to the auto-fitted shadow frustum's width/height, to
   * pad against cracks at the edges (caused by edge samples outside the
   * fitted frustum).
   *
   * Range `[1.0, ~2.0]`. Default value is `1.1`.
   */
  padding?: number;

  /**
   * Side length of the PCF (Percentage Closer Filtering) kernel, in texels.
   * Must be an odd integer in the range `[1, 7]`. `1` disables PCF (hard
   * shadows). Larger kernels give softer edges at a quadratic sampling cost.
   *
   * Default value is `3`.
   */
  pcfKernelSize?: number;

  /**
   * View-space distance by which receivers are pushed toward the light before
   * sampling the shadow map. Eliminates shadow acne at glancing angles
   * without needing a large depth {@link ShadowsParams.bias}.
   *
   * Default value is `0.02`.
   */
  normalOffsetBias?: number;

  /**
   * Slope-scaled depth bias: `bias` has this much added to it as the surface
   * tilts away from the light. Scales linearly with `tan(angle(normal, light))`,
   * clamped to avoid blow-up at near-parallel angles. Complements
   * {@link ShadowsParams.normalOffsetBias}.
   *
   * Default value is `0.004`.
   */
  slopeBias?: number;

  /**
   * Number of shadow cascades (Cascaded Shadow Maps / PSSM). Higher counts
   * give sharper near-distance shadows while still covering far distances,
   * at the cost of one extra shadow-depth pass per cascade.
   *
   * Range `[1, 6]`. `1` disables CSM (equivalent to the previous
   * single-cascade behaviour). Default is `4`.
   */
  cascadeCount?: number;

  /**
   * Blend between logarithmic and uniform split schemes for the cascade
   * boundaries. `0.0` uses uniform-distance splits (good for near-camera
   * detail density), `1.0` uses logarithmic (good for long-distance
   * coverage). `0.5` is the standard "practical split scheme" compromise.
   *
   * Range `[0, 1]`. Default is `0.5`.
   */
  cascadeSplitLambda?: number;
}
