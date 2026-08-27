import type {ResolutionScaleParams} from "./ResolutionScaleParams";
import type {View} from "./View";
import {type SDKResult} from "../../base/core";

/**
 * Configures canvas resolution scaling for a {@link viewing!viewer.View | View}.
 *
 * * Located at {@link View.resolutionScale}.
 * * Resolution scaling reduces the pixel resolution of a View's canvas to improve its frame
 * rate, typically applied temporarily during camera movement to enhance responsiveness.
 * * View will apply resulotion scaling when the component enabled state is set to one of the values
 * specified in the component enabled state.
 *
 * See {@link viewing!viewer | @xeokit/sdk/viewing/viewer} for usage info.
 */
export class ResolutionScale {

    /**
     * The View to which this ResolutionScale belongs.
     */
    public readonly view: View;

    private _resolutionScale: number;
  private _enabled: boolean;

    /**
     * @private
     */
    constructor(view: View, options: ResolutionScaleParams = {}) {

        this.view = view;
    this._enabled = options.enabled !== false;
        this._resolutionScale = options.resolutionScale || 0.5;
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
     * Sets the scale when ResolutionScale is applied.
     *
     * Default is ````0.5````.
     */
    set resolutionScale(value: number) {
        if (this._resolutionScale === value) {
            return;
        }
        this._resolutionScale = value;
        this.view.needsRender();
    }

    /**
     * Gets the scale when ResolutionScale is applied.
     *
     * Default is ````0.5````.
     */
    get resolutionScale(): number {
        return this._resolutionScale;
    }

    /**
     * Gets if resolution scaling is currently applied.
     *
     * This is `true` when the component enabled state is
     * in the component enabled state.
     */
    get applied(): boolean {
    return this._enabled;
  }

    /**
     * Configures this ResolutionScale.
     *
     * @param resolutionScaleParams
     */
    fromParams(resolutionScaleParams: ResolutionScaleParams) : SDKResult<void> {
        if (resolutionScaleParams.enabled !== undefined) {
            this.enabled = resolutionScaleParams.enabled;
        }
        if (resolutionScaleParams.resolutionScale !== undefined) {
            this.resolutionScale = resolutionScaleParams.resolutionScale;
        }
        return {
            ok: true,
            value: undefined
        };
    }

    /**
     * Gets the current configuration of this ResolutionScale.
     */
    toParams(): SDKResult<ResolutionScaleParams> {
        return {
          ok: true,
          value: {
        enabled: this._enabled,
            resolutionScale: this.resolutionScale
          }
        };
    }

    /**
     * @private
     */
    destroy() {

    }
}
