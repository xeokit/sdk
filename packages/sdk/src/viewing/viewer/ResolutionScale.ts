import {NavigationRender} from "../../base/constants";
import type {ResolutionScaleParams} from "./ResolutionScaleParams";
import type {View} from "./View";
import {type SDKResult} from "../../base/core";

/**
 * Configures canvas resolution scaling for a {@link viewing!viewer.View | View}.
 *
 * * Located at {@link View.resolutionScale}.
 * * Resolution scaling reduces the pixel resolution of a View's canvas to improve its frame
 * rate, typically applied temporarily during camera movement to enhance responsiveness.
 * * View will apply resulotion scaling when {@link View.renderMode | View.renderMode} is set to one of the values
 * specified in {@link ResolutionScale.renderModes}.
 *
 * See {@link viewer | @xeokit/sdk/viewing/viewer} for usage info.
 */
export class ResolutionScale {

    /**
     * The View to which this ResolutionScale belongs.
     */
    public readonly view: View;

    private _resolutionScale: number;
    private _renderModes: number[];

    /**
     * @private
     */
    constructor(view: View, options: ResolutionScaleParams = {}) {

        this.view = view;

        this._renderModes = options.renderModes || [NavigationRender];
        this._resolutionScale = options.resolutionScale || 1;
    }

    /**
     * Sets which rendering modes in which to apply ResolutionScale.
     *
     * Default value is [{@link base!constants.NavigationRender | NavigationRender}].
     */
    set renderModes(value: number[]) {
        this._renderModes = value;
        this.view.needsRender();
    }

    /**
     * Gets which rendering modes in which to apply ResolutionScale.
     *
     * Default value is [{@link base!constants.NavigationRender | NavigationRender}].
     */
    get renderModes(): number[] {
        return this._renderModes;
    }

    /**
     * Sets the scale when ResolutionScale is applied.
     *
     * Default is ````1.0````.
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
     * Default is ````1.0````.
     */
    get resolutionScale(): number {
        return this._resolutionScale;
    }

    /**
     * Gets if resolution scaling is currently applied.
     *
     * This is `true` when {@link View.renderMode | View.renderMode} is
     * in {@link ResolutionScale.renderModes | ResolutionScale.renderModes}.
     */
    get applied(): boolean {
        for (let i = 0, len = this._renderModes.length; i < len; i++) {
            if (this.view.renderMode === this._renderModes[i]) {
                return true;
            }
        }
        return false;
    }

    /**
     * Configures this ResolutionScale.
     *
     * @param resolutionScaleParams
     */
    fromParams(resolutionScaleParams: ResolutionScaleParams) : SDKResult<void> {
        if (resolutionScaleParams.renderModes !== undefined) {
            this.renderModes = resolutionScaleParams.renderModes;
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
            renderModes: this.renderModes,
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
