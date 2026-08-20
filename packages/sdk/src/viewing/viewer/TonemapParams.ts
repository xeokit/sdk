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
 * * Located at {@link EffectsParams.tonemap}
 */
export interface TonemapParams {
  /**
   * Whether this component is enabled.
   */
  enabled?: boolean;

  /**
   * Linear scale applied to HDR scene colours before tonemapping. Values
   * above 1 make the scene brighter and push more of the range into the
   * tonemap curve; values below 1 darken.
   *
   * Default is `0.5` — chosen so ACES midtones stay below the
   * no-tonemap (detailed profile) reference, leaving headroom for
   * HDR specular peaks (sun, smooth-metal reflections) to read as
   * bright accents rather than washing into the rest of the frame.
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
   * writing to the canvas. The renderer's albedo textures upload as
   * `SRGB8_ALPHA8` (sRGB-source, linear-sample) and shading runs in linear
   * space, so the swap-chain write needs the inverse encode for the canvas
   * to display gamma-correct. Defaults to `true`; only set `false` if you
   * have a reason (e.g. a custom downstream encode in your own canvas
   * pipeline).
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
