/**
 * Tonemap mode applied by {@link Tonemap} to the HDR scene output before it
 * reaches the canvas.
 *
 * - `"none"`: identity copy; HDR values are clipped to [0,1] by the canvas.
 * - `"reinhard"`: `c / (c + 1)`, soft knee for bright values.
 * - `"aces"`: ACES Filmic approximation (Stephen Hill fit).
 */
export type TonemapMode = "none" | "reinhard" | "aces";

/**
 * Parameters for a {@link Tonemap}.
 *
 * * Returned by {@link Tonemap.toParams | Tonemap.toParams}
 * * Passed to {@link Tonemap.fromParams | Tonemap.fromParams}
 * * Located at {@link ViewParams.tonemap | ViewParams.tonemap}
 */
export interface TonemapParams {

  /**
   * Which rendering modes in which to apply {@link Tonemap} settings.
   *
   * When the active render mode is outside this list the tonemap pass
   * runs as an identity copy.
   *
   * Default value is [{@link constants!RealisticRender | RealisticRender}].
   */
  renderModes?: number[];

  /**
   * Linear scale applied to HDR scene colours before tonemapping. Values
   * above 1 make the scene brighter and push more of the range into the
   * tonemap curve; values below 1 darken.
   *
   * Default is `1.0`.
   */
  exposure?: number;

  /**
   * Tonemap curve. Default is `"aces"` — ACES Filmic — so HDR scene
   * values roll off into displayable range without clipping.
   * Switch to `"reinhard"` for a softer/cheaper curve, or `"none"`
   * for an identity copy that matches the pre-HDR look.
   */
  mode?: TonemapMode;

  /**
   * If `true`, the final colour is gamma-encoded with `pow(c, 1/2.2)` before
   * writing to the canvas. Only makes sense when scene colours are in linear
   * space; most setups still treat inputs as sRGB-ish, so this defaults to
   * `false` for the retrofit.
   */
  sRGBEncode?: boolean;

  /**
   * Supersampling factor. The scene (and all scene-phase FBOs) are rendered
   * at `canvas * renderScale` resolution, then the tonemap pass samples that
   * larger texture with `LINEAR` filtering when compositing to the canvas —
   * giving free box-filter downsampling antialiasing. Also helps subpixel
   * aliasing that FXAA can't reach.
   *
   * Range `[0.5, 4.0]`. `1.0` = no supersampling; `2.0` = 4× the fragment
   * work (rendering 4 pixels for every 1 displayed). Default is `1.0`.
   */
  renderScale?: number;
}
