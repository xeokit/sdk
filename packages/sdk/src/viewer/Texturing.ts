import {QualityRender} from "../constants";
import type {View} from "./View";


/**
 * Configures whether a {@link View} shows textures on its {@link ViewObject | ViewObjects}.
 *
 * * Located at {@link View.texturing}.
 *
 * See {@link viewer | @xeokit/sdk/viewer} for usage info.
 */
class Texturing {

    /**
     * The View to which this Texturing belongs.
     */
    public readonly view: View;

    private _enabled: boolean;
    private _renderModes: number[];

    /**
     * @private
     */
    constructor(view: View, options: {
        enabled?: boolean;
        renderModes?: number[];
    } = {}) {
        this.view = view;
        this._renderModes = options.renderModes || [QualityRender];
        this._enabled = options.enabled !== false;
    }

    /**
     * Sets which rendering modes in which to render textures.
     *
     * Accepted modes are {@link constants!QualityRender} and {@link constants!FastRender}.
     *
     * Default value is [{@link constants!QualityRender}].
     */
    set renderModes(value: number[]) {
        this._renderModes = value;
        this.view.needsRender();
    }

    /**
     * Gets which rendering modes in which to render textures.
     *
     * Accepted modes are {@link constants!QualityRender} and {@link constants!FastRender}.
     *
     * Default value is [{@link constants!QualityRender}].
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
     * @private
     */
    destroy() {
    }
}

export {Texturing};
