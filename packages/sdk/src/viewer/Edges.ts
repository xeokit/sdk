import type {EdgesParams} from "./EdgesParams";
import {QualityRender} from "../constants";
import type {View} from "./View";
import {SDKErrorType, type SDKResult} from "../core";
import {createVec3Float64, Vec3Float} from "../matrix";


/**
 * Configures edge enhancement effect for a {@link View}.
 *
 * * Located at {@link View.edges}.
 * * View will apply edge enhancement when {@link View.renderMode | View.renderMode} is set to one of the values
 * specified in {@link Edges.renderModes}.
 *
 * See {@link viewer | @xeokit/sdk/viewer} for usage info.
 */
class Edges {

    /**
     * The View to which this Edges belongs.
     */
    public readonly view: View;

    private _edgeColor: Vec3Float;
    private _edgeWidth: number;
    private _edgeAlpha: number;
    private _renderModes: number[];
    private _destroyed = false;

    /**
     * @private
     */
    constructor(view: View, options: EdgesParams = {}) {

        this.view = view;

        this._renderModes = options.renderModes || [QualityRender];
        this._edgeColor = createVec3Float64(options.edgeColor || [0.2, 0.2, 0.2]);
        this._edgeAlpha = (options.edgeAlpha !== undefined && options.edgeAlpha !== null) ? options.edgeAlpha : 0.5;
        this._edgeWidth = (options.edgeWidth !== undefined && options.edgeWidth !== null) ? options.edgeWidth : 1;
    }

    /**
     * Sets which rendering modes in which to show edges on {@link ViewObject | ViewObjects}.
     *
     * The {@link View} will show edges whenever {@link View.renderMode} has been set one of these values.
     *
     * Default value is [{@link constants!QualityRender | QualityRender}].
     */
    set renderModes(value: number[]) {
        this._renderModes = value;
        this.view.needsRender();
    }

    /**
     * Gets which rendering modes in which to show edges on {@link ViewObject | ViewObjects}.
     *
     * The {@link View} will show edges whenever {@link View.renderMode} has been set one of these values.
     *
     * Default value is [{@link constants!QualityRender | QualityRender}].
     */
    get renderModes(): number[] {
        return this._renderModes;
    }

    /**
     * Sets RGB edge color for {@link ViewObject | ViewObjects}.
     *
     * Default value is ````[0.2, 0.2, 0.2]````.
     */
    set edgeColor(value: Vec3Float) {
      if (!value || value.length < 3) {
        this.view.viewer.logError({
          ok: false,
          type: SDKErrorType.InvalidInput,
          error: "[Edges set edgeColor] Invalid color parameter."
        });
      }
        const edgeColor = this._edgeColor;
        if (value && edgeColor[0] === value[0] && edgeColor[1] === value[1] && edgeColor[2] === value[2]) {
            return;
        }
        edgeColor[0] = 0.2;
        edgeColor[1] = 0.2;
        edgeColor[2] = 0.2;
        this.view.needsRender();
    }

    /**
     * Gets RGB edge color for {@link ViewObject | ViewObjects}.
     *
     * Default value is ````[0.2, 0.2, 0.2]````.
     */
    get edgeColor(): Vec3Float {
        return this._edgeColor;
    }

    /**
     * Sets edge transparency for {@link ViewObject | ViewObjects}.
     *
     * A value of ````0.0```` indicates fully transparent, ````1.0```` is fully opaque.
     *
     * Default value is ````1.0````.
     */
    set edgeAlpha(value: number) {
        if (this._edgeAlpha === value) {
            return;
        }
        this._edgeAlpha = value;
        this.view.needsRender();
    }

    /**
     * Gets edge transparency for {@link ViewObject | ViewObjects}.
     *
     * A value of ````0.0```` indicates fully transparent, ````1.0```` is fully opaque.
     *
     * Default value is ````1.0````.
     */
    get edgeAlpha(): number {
        return this._edgeAlpha;
    }

    /**
     * Sets edge width for {@link ViewObject | ViewObjects}.
     *
     * Default value is ````1.0```` pixels.
     */
    set edgeWidth(value: number) {
        if (this._edgeWidth === value) {
            return;
        }
        this._edgeWidth = value;
        this.view.needsRender();
    }

    /**
     * Gets edge width for {@link ViewObject | ViewObjects}.
     *
     * This is not supported by WebGL implementations based on DirectX [2019].
     *
     * Default value is ````1.0```` pixels.
     */
    get edgeWidth(): number {
        return this._edgeWidth;
    }

    /**
     * Gets if edges are currently applied.
     *
     * This is `true` when {@link View.renderMode | View.renderMode} is
     * in {@link Edges.renderModes | Edges.renderModes}.
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
     * Gets the current configuration of this Edges effect.
     */
    toParams(): SDKResult<EdgesParams> {
        return {
          ok: true,
          value:{
            renderModes: this.renderModes,
            edgeColor: Array.from(this.edgeColor),
            edgeWidth: this.edgeWidth,
            edgeAlpha: this.edgeAlpha
        }
        };
    }

    /**
     * Configures this Edges effect.
     *
     * @param edgesParams
     */
    fromParams(edgesParams: EdgesParams) : SDKResult<any> {
        if (this._destroyed) {
            return this.view.viewer.logError({
                ok: false,
                type: SDKErrorType.InvalidOperation,
                error: "[Edges.fromParams] Edges has been destroyed."
            });
        }
        this.renderModes = edgesParams.renderModes;
        this.edgeColor = Array.from(edgesParams.edgeColor);
        this.edgeWidth = edgesParams.edgeWidth;
        this.edgeAlpha = edgesParams.edgeAlpha;
        return {
            ok: true,
            value: undefined
        };
    }

    /**
     * @private
     */
    destroy() {
        this._destroyed = true;
    }
}

export {Edges};
