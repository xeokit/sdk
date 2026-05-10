import type {TonemapMode, TonemapParams} from "./TonemapParams";
import type {View} from "./View";
import {SDKErrorType, type SDKResult} from "../core";
import {RealisticRender} from "../constants";

/**
 * Configures the HDR tonemap pass for a {@link View}.
 *
 * * Located at {@link Effects.tonemap}, which lives at {@link View.effects}.
 * * The renderer always composites the HDR scene target through this pass
 *   when HDR rendering is available. The defaults — `mode = "aces"`,
 *   `exposure = 0.5`, `sRGBEncode = true` — apply the ACES Filmic curve
 *   so HDR-range scene values roll off into displayable range without
 *   clipping, then encode the linear LDR result to sRGB so the canvas
 *   displays gamma-correct (the renderer's albedo textures upload as
 *   SRGB8_ALPHA8 and shade in linear space, so the swap-chain write
 *   needs the inverse encode). The exposure default is below 1.0
 *   because ACES lifts midtones noticeably above their linear input —
 *   at exposure 1.0 the scene reads brighter than the no-tonemap path
 *   that BIM assets are typically authored against; 0.5 controls
 *   midtones tightly so HDR peaks (sun, smooth-metal specular) stand
 *   out as bright accents rather than washing into the rest of the
 *   frame. Set `mode = "none"` for an identity copy.
 */
export class Tonemap {

  /** The View this Tonemap belongs to. */
  public readonly view: View;

  private _renderModes: number[];
  private _exposure: number;
  private _mode: TonemapMode;
  private _sRGBEncode: boolean;
  private _renderScale: number;
  private _destroyed = false;

  /** @private */
  constructor(view: View, params: TonemapParams) {
    this.view = view;
    this._renderModes = [RealisticRender];
    this._exposure = params.exposure !== undefined ? params.exposure : 0.5;
    this._mode = params.mode !== undefined ? params.mode : "aces";
    this._sRGBEncode = params.sRGBEncode !== undefined ? params.sRGBEncode === true : true;
    this._renderScale = clampRenderScale(params.renderScale !== undefined ? params.renderScale : 1.0);
  }

  /**
   * Sets which rendering modes in which to apply Tonemap settings.
   *
   * The {@link View} will apply this Tonemap configuration whenever
   * {@link View.renderMode} has been set to one of these values. When
   * {@link View.renderMode} falls outside this list the tonemap pass
   * still runs (it is the HDR-to-LDR composite), but it falls back to
   * an identity tone-curve: `mode = "none"`, `exposure = 1.0`. The
   * sRGB encode is always applied — the swap chain expects gamma-
   * encoded values regardless of which render mode is active.
   *
   * Default value is [{@link constants!RealisticRender | RealisticRender}].
   */
  set renderModes(value: number[]) {
    this._renderModes = value;
    this.view.needsRender();
  }

  /**
   * Gets which rendering modes in which to apply Tonemap settings.
   *
   * Default value is [{@link constants!RealisticRender | RealisticRender}].
   */
  get renderModes(): number[] {
    return this._renderModes;
  }

  /**
   * Returns true if Tonemap is currently possible given the View's
   * state. The renderer is the authority on whether the GPU can
   * actually run it.
   * @private
   */
  get possible(): boolean {
    return true;
  }

  /**
   * Gets if Tonemap settings are currently applied.
   *
   * This is `true` when {@link View.renderMode | View.renderMode} is
   * in {@link Tonemap.renderModes | Tonemap.renderModes}. When false,
   * the tonemap pass runs as an identity copy.
   */
  get applied(): boolean {
    for (let i = 0, len = this._renderModes.length; i < len; i++) {
      if (this.view.renderMode === this._renderModes[i]) {
        return true;
      }
    }
    return false;
  }

  /** Linear multiplier applied before tonemapping. Default `0.5`. */
  get exposure(): number {
    return this._exposure;
  }

  set exposure(value: number) {
    if (value === undefined || value === null) value = 1.0;
    if (this._exposure === value) return;
    this._exposure = value;
    this.view.needsRender();
  }

  /** Tonemap curve. Default `"aces"`. */
  get mode(): TonemapMode {
    return this._mode;
  }

  set mode(value: TonemapMode) {
    if (value !== "none" && value !== "reinhard" && value !== "aces") return;
    if (this._mode === value) return;
    this._mode = value;
    this.view.needsRender();
  }

  /** Whether to gamma-encode the final colour. Default `true`. */
  get sRGBEncode(): boolean {
    return this._sRGBEncode;
  }

  set sRGBEncode(value: boolean) {
    value = value === true;
    if (this._sRGBEncode === value) return;
    this._sRGBEncode = value;
    this.view.needsRender();
  }

  /** Supersampling factor (1.0 = off, 2.0 = 4× fragment work). Default `1.0`. */
  get renderScale(): number {
    return this._renderScale;
  }

  set renderScale(value: number) {
    if (value === undefined || value === null) value = 1.0;
    value = clampRenderScale(value);
    if (this._renderScale === value) return;
    this._renderScale = value;
    this.view.needsRender();
  }

  /** Gets this Tonemap as JSON. */
  toParams(): SDKResult<TonemapParams> {
    return {
      ok: true,
      value: {
        renderModes: this._renderModes,
        exposure: this._exposure,
        mode: this._mode,
        sRGBEncode: this._sRGBEncode,
        renderScale: this._renderScale
      }
    };
  }

  /** Configures this Tonemap. */
  fromParams(params: TonemapParams): SDKResult<any> {
    if (this._destroyed) {
      return this.view.viewer.logError({
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: "[Tonemap.fromParams] Tonemap has been destroyed."
      });
    }
    if (params.renderModes !== undefined) this.renderModes = params.renderModes;
    if (params.exposure !== undefined) this.exposure = params.exposure;
    if (params.mode !== undefined) this.mode = params.mode;
    if (params.sRGBEncode !== undefined) this.sRGBEncode = params.sRGBEncode;
    if (params.renderScale !== undefined) this.renderScale = params.renderScale;
    return {ok: true, value: undefined};
  }

  /** @private */
  destroy() {
    this._destroyed = true;
  }
}

function clampRenderScale(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 1.0;
  if (value < 0.5) return 0.5;
  if (value > 4.0) return 4.0;
  return value;
}
