import type {ColorGradingParams} from "./ColorGradingParams";
import type {View} from "./View";
import {SDKErrorType, type SDKResult} from "../../base/core";

/**
 * Configures color grading for a {@link viewing!viewer.View | View}.
 *
 * * Located at {@link Effects.colorGrading}, which lives at {@link View.effects}.
 * * WebGLRenderer and WebGPURenderer run it as a standalone HDR post-process
 *   before the final tonemap/sRGB canvas composite.
 */
export class ColorGrading {

  /** The View this ColorGrading belongs to. */
  public readonly view: View;
  private _enabled: boolean;
  private _brightness: number;
  private _contrast: number;
  private _saturation: number;
  private _gamma: number;
  private _temperature: number;
  private _tint: number;
  private _destroyed = false;

  /** @private */
  constructor(view: View, params: ColorGradingParams) {
    this.view = view;
    this._enabled = params.enabled === true;
    this._brightness = clampRange(params.brightness, -1, 1, 0);
    this._contrast = clampRange(params.contrast, 0, 4, 1);
    this._saturation = clampRange(params.saturation, 0, 4, 1);
    this._gamma = clampRange(params.gamma, 0.1, 4, 1);
    this._temperature = clampRange(params.temperature, -1, 1, 0);
    this._tint = clampRange(params.tint, -1, 1, 0);
  }

  set enabled(value: boolean) {
    const enabled = value === true;
    if (this._enabled === enabled) return;
    this._enabled = enabled;
    this.view.needsRender();
  }

  get enabled(): boolean {
    return this._enabled;
  }

  /**
   * Returns true if color grading is currently possible given the View's
   * state. The renderer is the authority on whether the GPU can actually run it.
   * @private
   */
  get possible(): boolean {
    return true;
  }

  /**
   * Gets if color grading is currently applied.
   */
  get applied(): boolean {
    return this._enabled;
  }

  /** Linear brightness offset. Default `0`. */
  get brightness(): number {
    return this._brightness;
  }

  set brightness(value: number) {
    value = clampRange(value, -1, 1, 0);
    if (this._brightness === value) return;
    this._brightness = value;
    this.view.needsRender();
  }

  /** Contrast multiplier around mid gray. Default `1`. */
  get contrast(): number {
    return this._contrast;
  }

  set contrast(value: number) {
    value = clampRange(value, 0, 4, 1);
    if (this._contrast === value) return;
    this._contrast = value;
    this.view.needsRender();
  }

  /** Saturation multiplier. Default `1`. */
  get saturation(): number {
    return this._saturation;
  }

  set saturation(value: number) {
    value = clampRange(value, 0, 4, 1);
    if (this._saturation === value) return;
    this._saturation = value;
    this.view.needsRender();
  }

  /** Display-space gamma. Default `1`. */
  get gamma(): number {
    return this._gamma;
  }

  set gamma(value: number) {
    value = clampRange(value, 0.1, 4, 1);
    if (this._gamma === value) return;
    this._gamma = value;
    this.view.needsRender();
  }

  /** Warm/cool balance. Default `0`. */
  get temperature(): number {
    return this._temperature;
  }

  set temperature(value: number) {
    value = clampRange(value, -1, 1, 0);
    if (this._temperature === value) return;
    this._temperature = value;
    this.view.needsRender();
  }

  /** Green/magenta tint balance. Default `0`. */
  get tint(): number {
    return this._tint;
  }

  set tint(value: number) {
    value = clampRange(value, -1, 1, 0);
    if (this._tint === value) return;
    this._tint = value;
    this.view.needsRender();
  }

  /** Gets this ColorGrading as JSON. */
  toParams(): SDKResult<ColorGradingParams> {
    return {
      ok: true,
      value: {
        enabled: this._enabled,
        brightness: this._brightness,
        contrast: this._contrast,
        saturation: this._saturation,
        gamma: this._gamma,
        temperature: this._temperature,
        tint: this._tint
      }
    };
  }

  /** Configures this ColorGrading. */
  fromParams(params: ColorGradingParams): SDKResult<any> {
    if (this._destroyed) {
      return this.view.viewer.logError({
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: "[ColorGrading.fromParams] ColorGrading has been destroyed."
      });
    }
    if (params.enabled !== undefined) this.enabled = params.enabled;
    if (params.brightness !== undefined) this.brightness = params.brightness;
    if (params.contrast !== undefined) this.contrast = params.contrast;
    if (params.saturation !== undefined) this.saturation = params.saturation;
    if (params.gamma !== undefined) this.gamma = params.gamma;
    if (params.temperature !== undefined) this.temperature = params.temperature;
    if (params.tint !== undefined) this.tint = params.tint;
    return {ok: true, value: undefined};
  }

  /** @private */
  destroy() {
    this._destroyed = true;
  }
}

function clampRange(value: number | undefined, min: number, max: number, fallback: number): number {
  if (value === undefined || value === null || !Number.isFinite(value)) return fallback;
  if (value < min) return min;
  if (value > max) return max;
  return value;
}
