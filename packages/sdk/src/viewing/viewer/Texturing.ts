import {DetailedRender, RealisticRender} from "../../base/constants";
import {SDKErrorType, type SDKResult} from "../../base/core";
import type {TexturingParams} from "./TexturingParams";
import type {View} from "./View";


/**
 * Configures whether a {@link viewing!viewer.View | View} shows textures on its {@link ViewObject | ViewObjects}.
 *
 * * Located at {@link View.texturing}.
 *
 * See {@link viewer | @xeokit/sdk/viewing/viewer} for usage info.
 */
class Texturing {

    /**
     * The View to which this Texturing belongs.
     */
    public readonly view: View;

    private _enabled: boolean;
    private _renderModes: number[];
    private _destroyed: boolean = false;

    /**
     * @private
     */
    constructor(view: View, options: TexturingParams = {}) {
        this.view = view;
        this._renderModes = options.renderModes !== undefined ? options.renderModes.slice() : [DetailedRender, RealisticRender];
        this._enabled = options.enabled !== false;
    }

    /**
     * Sets which rendering modes in which to render textures.
     *
     * Default value is [{@link base!constants.DetailedRender | DetailedRender},
     * {@link base!constants.RealisticRender | RealisticRender}].
     */
    set renderModes(value: number[]) {
        this._renderModes = value !== undefined && value !== null ? value.slice() : [DetailedRender, RealisticRender];
        this.view.needsRender();
    }

    /**
     * Gets which rendering modes in which to render textures.
     *
     * Default value is [{@link base!constants.DetailedRender | DetailedRender},
     * {@link base!constants.RealisticRender | RealisticRender}].
     */
    get renderModes(): number[] {
        return this._renderModes;
    }

    /**
     * Sets if textures on {@link ViewObject | ViewObjects} are visible.
     *
     * Default is ````true````.
     */
    set enabled(value: boolean) {
        if (this._enabled === value) {
            return;
        }
        this._enabled = value;
        this.view.needsRender();
    }

    /**
     * Gets if textures on {@link ViewObject | ViewObjects} are visible.
     *
     * Default is ````true````.
     */
    get enabled(): boolean {
        return this._enabled;
    }

    /**
     * Gets if textures are currently applied.
     *
     * This is `true` when {@link Texturing.enabled | Texturing.enabled} is `true`
     * and {@link View.renderMode | View.renderMode} is
     * in {@link Texturing.renderModes | Texturing.renderModes}.
     */
    get applied(): boolean {
        if (!this._enabled) {
            return false;
        }
        for (let i = 0, len = this._renderModes.length; i < len; i++) {
            if (this.view.renderMode === this._renderModes[i]) {
                return true;
            }
        }
        return false;
    }

    /**
     * Gets this Texturing as JSON.
     */
    toParams(): SDKResult<TexturingParams> {
        return {
            ok: true,
            value: {
                enabled: this._enabled,
                renderModes: this._renderModes
            }
        };
    }

    /**
     * Configures this Texturing.
     */
    fromParams(params: TexturingParams): SDKResult<void> {
        if (this._destroyed) {
            return this.view.viewer.logError({
                ok: false,
                type: SDKErrorType.InvalidOperation,
                error: "[Texturing.fromParams] Texturing has been destroyed."
            });
        }
        if (params.enabled !== undefined) {
            this.enabled = params.enabled;
        }
        if (params.renderModes !== undefined) {
            this.renderModes = params.renderModes;
        }
        return {ok: true, value: undefined};
    }

    /**
     * @private
     */
    destroy() {
        this._destroyed = true;
    }
}

export {Texturing};
