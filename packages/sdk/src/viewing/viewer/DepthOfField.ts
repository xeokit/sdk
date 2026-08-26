import type {DepthOfFieldParams} from "./DepthOfFieldParams";
import type {View} from "./View";
import {SDKErrorType, type SDKResult} from "../../base/core";

/**
 * Configures depth-of-field post processing for a {@link viewing!viewer.View | View}.
 *
 * * Located at {@link Effects.depthOfField}, which lives at {@link View.effects}.
 * * Disabled by default. Set {@link DepthOfField.enabled | enabled} to `true`
 *   or pass `effects: {depthOfField: {enabled: true}}` when creating a View.
 * * Runs after the HDR scene render and before tonemap.
 * * Uses scene depth to keep a configurable focus distance sharp while
 *   softly blurring nearer or farther pixels.
 */
export class DepthOfField {

  /** The View this DepthOfField belongs to. */
  public readonly view: View;
  private _enabled: boolean;
  private _focusDistance: number;
  private _focalRange: number;
  private _radius: number;
  private _intensity: number;
  private _nearBlur: number;
  private _farBlur: number;
  private _destroyed = false;

  /** @private */
  constructor(view: View, params: DepthOfFieldParams) {
    this.view = view;
    this._enabled = params.enabled === true;
    this._focusDistance = clampPositive(params.focusDistance, 50);
    this._focalRange = clampPositive(params.focalRange, 20);
    this._radius = clampRange(params.radius, 0, 12, 4);
    this._intensity = clampRange(params.intensity, 0, 1, 0.75);
    this._nearBlur = clampRange(params.nearBlur, 0, 1, 0.25);
    this._farBlur = clampRange(params.farBlur, 0, 1, 1.0);
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
   * Returns true if depth of field is currently possible given the View's
   * state. The renderer is the authority on whether the GPU can actually run it.
   * @private
   */
  get possible(): boolean {
    return true;
  }

  /**
   * Gets if depth of field is currently applied.
   *
   * This is `true` when the component enabled state is
   * in the component enabled state.
   */
  get applied(): boolean {
    return this._enabled;
  }

  /** View-space distance, in world units, that remains sharp. Default `50`. */
  get focusDistance(): number {
    return this._focusDistance;
  }

  set focusDistance(value: number) {
    value = clampPositive(value, 50);
    if (this._focusDistance === value) return;
    this._focusDistance = value;
    this.view.needsRender();
  }

  /** Distance band around {@link focusDistance} that remains mostly sharp. Default `20`. */
  get focalRange(): number {
    return this._focalRange;
  }

  set focalRange(value: number) {
    value = clampPositive(value, 20);
    if (this._focalRange === value) return;
    this._focalRange = value;
    this.view.needsRender();
  }

  /** Maximum blur radius in scene pixels. Default `4`. */
  get radius(): number {
    return this._radius;
  }

  set radius(value: number) {
    value = clampRange(value, 0, 12, 4);
    if (this._radius === value) return;
    this._radius = value;
    this.view.needsRender();
  }

  /** Overall blend strength for the blurred result. Default `0.75`. */
  get intensity(): number {
    return this._intensity;
  }

  set intensity(value: number) {
    value = clampRange(value, 0, 1, 0.75);
    if (this._intensity === value) return;
    this._intensity = value;
    this.view.needsRender();
  }

  /** Blur multiplier for geometry nearer than {@link focusDistance}. Default `0.25`. */
  get nearBlur(): number {
    return this._nearBlur;
  }

  set nearBlur(value: number) {
    value = clampRange(value, 0, 1, 0.25);
    if (this._nearBlur === value) return;
    this._nearBlur = value;
    this.view.needsRender();
  }

  /** Blur multiplier for geometry farther than {@link focusDistance}. Default `1.0`. */
  get farBlur(): number {
    return this._farBlur;
  }

  set farBlur(value: number) {
    value = clampRange(value, 0, 1, 1.0);
    if (this._farBlur === value) return;
    this._farBlur = value;
    this.view.needsRender();
  }

  /** Gets this DepthOfField as JSON. */
  toParams(): SDKResult<DepthOfFieldParams> {
    return {
      ok: true,
      value: {
        enabled: this._enabled,
        focusDistance: this._focusDistance,
        focalRange: this._focalRange,
        radius: this._radius,
        intensity: this._intensity,
        nearBlur: this._nearBlur,
        farBlur: this._farBlur
      }
    };
  }

  /** Configures this DepthOfField. */
  fromParams(params: DepthOfFieldParams): SDKResult<any> {
    if (this._destroyed) {
      return this.view.viewer.logError({
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: "[DepthOfField.fromParams] DepthOfField has been destroyed."
      });
    }
    if (params.enabled !== undefined) this.enabled = params.enabled;
    if (params.focusDistance !== undefined) this.focusDistance = params.focusDistance;
    if (params.focalRange !== undefined) this.focalRange = params.focalRange;
    if (params.radius !== undefined) this.radius = params.radius;
    if (params.intensity !== undefined) this.intensity = params.intensity;
    if (params.nearBlur !== undefined) this.nearBlur = params.nearBlur;
    if (params.farBlur !== undefined) this.farBlur = params.farBlur;
    return {ok: true, value: undefined};
  }

  /** @private */
  destroy() {
    this._destroyed = true;
  }
}

function clampPositive(value: number | undefined, fallback: number): number {
  if (value === undefined || value === null || !Number.isFinite(value) || value <= 0) {
    return fallback;
  }
  return value;
}

function clampRange(value: number | undefined, min: number, max: number, fallback: number): number {
  if (value === undefined || value === null || !Number.isFinite(value)) {
    return fallback;
  }
  if (value < min) return min;
  if (value > max) return max;
  return value;
}
