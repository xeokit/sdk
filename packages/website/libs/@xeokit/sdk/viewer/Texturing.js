import { Component } from "../core";
import { QualityRender } from "../constants";
/**
 * Configures when textures are rendered on {@link viewer!ViewObject | ViewObjects}.
 *
 * ## Summary
 *
 * * Located at {@link View.textures}.
 */
class Texturing extends Component {
    /**
     * The View to which this Texturing belongs.
     */
    view;
    /**
     * @private
     */
    #state;
    /**
     * @private
     */
    constructor(view, options = {}) {
        super(view, options);
        this.view = view;
        this.#state = {
            renderModes: options.renderModes || [QualityRender],
            enabled: options.enabled !== false
        };
    }
    /**
     * Sets which rendering modes in which to draw textures.
     *
     * Accepted modes are {@link constants!QualityRender} and {@link constants!FastRender}.
     *
     * Default value is [{@link constants!QualityRender}].
     */
    set renderModes(value) {
        this.#state.renderModes = value;
        this.view.needsRedraw();
    }
    /**
     * Gets which rendering modes in which to draw textures.
     *
     * Accepted modes are {@link constants!QualityRender} and {@link constants!FastRender}.
     *
     * Default value is [{@link constants!QualityRender}].
     */
    get renderModes() {
        return this.#state.renderModes;
    }
    /**
     * Sets if textures on {@link ViewObject | ViewObjects} are visible.
     *
     * Default is ````true````.
     */
    set enabled(value) {
        if (this.#state.enabled === value) {
            return;
        }
        this.#state.enabled = value;
        this.view.needsRedraw();
    }
    /**
     * Gets if textures on {@link ViewObject | ViewObjects} are visible.
     *
     * Default is ````true````.
     */
    get enabled() {
        return this.#state.enabled;
    }
    /**
     * Gets if textures are currently applied.
     *
     * This is `true` when {@link Texturing.enabled | Texturing.enabled} is `true`
     * and {@link View.renderMode | View.renderMode} is
     * in {@link Texturing.renderModes | Texturing.renderModes}.
     */
    get applied() {
        if (!this.#state.enabled) {
            return false;
        }
        for (let i = 0, len = this.#state.renderModes.length; i < len; i++) {
            if (this.view.renderMode === this.#state.renderModes[i]) {
                return true;
            }
        }
        return false;
    }
    /**
     * @private
     */
    destroy() {
        super.destroy();
    }
}
export { Texturing };
//# sourceMappingURL=Texturing.js.map
