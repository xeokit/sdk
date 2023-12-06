import {Component} from "@xeokit/core";
import type {View} from "./View";
import type {FloatArrayParam} from "@xeokit/math";
import {QualityRender} from "@xeokit/constants";


/**
 * Configures when textures are rendered on {@link @xeokit/viewer!ViewObject | ViewObjects}.
 *
 * ## Summary
 *
 * * Located at {@link View.textures}.
 */
class Textures extends Component {

    /**
     * The View to which this Textures belongs.
     */
    public readonly view: View;

    /**
     * @private
     */
    #state: {
        enabled: boolean;
        renderModes: number[];
    };

    /**
     * @private
     */
    constructor(view: View, options: {
        enabled?: boolean;
        renderModes?: number[];
    } = {}) {

        super(view, options);

        this.view = view;

        this.#state = {
            renderModes: options.renderModes || [QualityRender],
            enabled: options.enabled !== false
        };
    }

    /**
     * Sets which rendering modes in which to render textures.
     *
     * Accepted modes are {@link QualityRender} and {@link FastRender}.
     *
     * Default value is [{@link QualityRender}].
     */
    set renderModes(value: number[]) {
        this.#state.renderModes = value;
        this.view.redraw();
    }

    /**
     * Gets which rendering modes in which to render textures.
     *
     * Accepted modes are {@link QualityRender} and {@link FastRender}.
     *
     * Default value is [{@link QualityRender}].
     */
    get renderModes(): number[] {
        return this.#state.renderModes;
    }

    /**
     * Sets if textures on {@link ViewObject | ViewObjects} are visible.
     *
     * Default is ````true````.
     */
    set enabled(value: boolean) {
        if (this.#state.enabled === value) {
            return;
        }
        this.#state.enabled = value;
        this.view.redraw();
    }

    /**
     * Gets if textures on {@link ViewObject | ViewObjects} are visible.
     *
     * Default is ````true````.
     */
    get enabled(): boolean {
        return this.#state.enabled;
    }

    /**
     * @private
     */
    destroy() {
        super.destroy();
    }
}

export {Textures};