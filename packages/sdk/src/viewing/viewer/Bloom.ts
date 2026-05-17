import type {BloomParams} from "./BloomParams";
import type {View} from "./View";
import {SDKErrorType, type SDKResult} from "../../base/core";
import {RealisticRender} from "../../base/constants";

/**
 * Configures the HDR bloom post-process for a {@link viewing!viewer.View | View}.
 *
 * * Located at {@link Effects.bloom}, which lives at {@link View.effects}.
 * * Runs between the scene phase and the tonemap pass. Reads the HDR scene
 *   target, builds a blur pyramid using Kawase dual filtering, and adds the
 *   result back into the HDR target before tonemap.
 * * Has no effect in LDR fallback mode — bloom needs HDR-range input values
 *   to produce anything interesting.
 */
export class Bloom {

  /** The View this Bloom belongs to. */
  public readonly view: View;

  private _renderModes: number[];
  private _threshold: number;
  private _knee: number;
  private _intensity: number;
  private _destroyed = false;

  /** @private */
  constructor(view: View, params: BloomParams) {
    this.view = view;
    this._renderModes = params.renderModes ?? [RealisticRender];
    this._threshold = params.threshold !== undefined ? params.threshold : 4.0;
    this._knee = params.knee !== undefined ? params.knee : 0.5;
    this._intensity = params.intensity !== undefined ? params.intensity : 0.15;
  }

  /**
   * Sets which rendering modes in which to apply Bloom.
   *
   * The {@link viewing!viewer.View | View} will apply Bloom whenever {@link View.renderMode} has been set one of these values.
   *
   * Default value is [{@link base!constants.RealisticRender | RealisticRender}].
   */
  set renderModes(value: number[]) {
    this._renderModes = value;
    this.view.needsRender();
  }

  /**
   * Gets which rendering modes in which to apply Bloom.
   *
   * The {@link viewing!viewer.View | View} will apply Bloom whenever {@link View.renderMode} has been set one of these values.
   *
   * Default value is [{@link base!constants.RealisticRender | RealisticRender}].
   */
  get renderModes(): number[] {
    return this._renderModes;
  }

  /**
   * Returns true if Bloom is currently possible given the View's
   * state. The renderer is the authority on whether the GPU can
   * actually run it.
   * @private
   */
  get possible(): boolean {
    return true;
  }

  /**
   * Gets if Bloom is currently applied.
   *
   * This is `true` when {@link View.renderMode | View.renderMode} is
   * in {@link Bloom.renderModes | Bloom.renderModes}.
   */
  get applied(): boolean {
    for (let i = 0, len = this._renderModes.length; i < len; i++) {
      if (this.view.renderMode === this._renderModes[i]) {
        return true;
      }
    }
    return false;
  }

  /** Luminance threshold. Default `4.0`. */
  get threshold(): number {
    return this._threshold;
  }

  set threshold(value: number) {
    if (value === undefined || value === null) value = 1.0;
    if (this._threshold === value) return;
    this._threshold = value;
    this.view.needsRender();
  }

  /** Soft-knee width. Default `0.5`. */
  get knee(): number {
    return this._knee;
  }

  set knee(value: number) {
    if (value === undefined || value === null) value = 0.5;
    if (this._knee === value) return;
    this._knee = value;
    this.view.needsRender();
  }

  /** Composite intensity. Default `0.15`. */
  get intensity(): number {
    return this._intensity;
  }

  set intensity(value: number) {
    if (value === undefined || value === null) value = 0.15;
    if (this._intensity === value) return;
    this._intensity = value;
    this.view.needsRender();
  }

  /** Gets this Bloom as JSON. */
  toParams(): SDKResult<BloomParams> {
    return {
      ok: true,
      value: {
        renderModes: this._renderModes,
        threshold: this._threshold,
        knee: this._knee,
        intensity: this._intensity
      }
    };
  }

  /** Configures this Bloom. */
  fromParams(params: BloomParams): SDKResult<any> {
    if (this._destroyed) {
      return this.view.viewer.logError({
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: "[Bloom.fromParams] Bloom has been destroyed."
      });
    }
    if (params.renderModes !== undefined) this.renderModes = params.renderModes;
    if (params.threshold !== undefined) this.threshold = params.threshold;
    if (params.knee !== undefined) this.knee = params.knee;
    if (params.intensity !== undefined) this.intensity = params.intensity;
    return {ok: true, value: undefined};
  }

  /** @private */
  destroy() {
    this._destroyed = true;
  }
}
