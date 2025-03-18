import { Component } from "../core";
import { QualityRender } from "../constants";
/**
 * Configures the appearance of {@link viewer!ViewObject | ViewObjects} when their edges are emphasised.
 *
 * ## Summary
 *
 * * Located at {@link View.edges}.
 * * Emphasise edges of a {@link viewer!ViewObject} by setting {@link viewer!ViewObject.enabled} ````true````.
 */
class Edges extends Component {
    /**
     * The View to which this Edges belongs.
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
            enabled: options.enabled !== false,
            edgeColor: new Float32Array(options.edgeColor || [0.2, 0.2, 0.2]),
            edgeAlpha: (options.edgeAlpha !== undefined && options.edgeAlpha !== null) ? options.edgeAlpha : 0.5,
            edgeWidth: (options.edgeWidth !== undefined && options.edgeWidth !== null) ? options.edgeWidth : 1
        };
    }
    /**
     * Sets which rendering modes in which to render edges.
     *
     * Accepted modes are {@link constants!QualityRender | QualityRender} and {@link constants!FastRender | FastRender}.
     *
     * Default value is [{@link constants!QualityRender | QualityRender}].
     */
    set renderModes(value) {
        this.#state.renderModes = value;
        this.view.redraw();
    }
    /**
     * Gets which rendering modes in which to render edges.
     *
     * Accepted modes are {@link constants!QualityRender | QualityRender} and {@link constants!FastRender | FastRender}.
     *
     * Default value is [{@link constants!QualityRender | QualityRender}].
     */
    get renderModes() {
        return this.#state.renderModes;
    }
    /**
     * Sets if edges of {@link ViewObject | ViewObjects} are visible.
     *
     * Default is ````true````.
     */
    set enabled(value) {
        if (this.#state.enabled === value) {
            return;
        }
        this.#state.enabled = value;
        this.view.redraw();
    }
    /**
     * Gets if edges of {@link ViewObject | ViewObjects} are visible.
     *
     * Default is ````true````.
     */
    get enabled() {
        /////////////////////////////////////////////////////////////////////////
        // HACK
        /////////////////////////////////////////////////////////////////////////
        return false;
        //     return this.#state.enabled;
    }
    /**
     * Sets RGB edge color for {@link ViewObject | ViewObjects}.
     *
     * Default value is ````[0.2, 0.2, 0.2]````.
     */
    set edgeColor(value) {
        let edgeColor = this.#state.edgeColor;
        if (value && edgeColor[0] === value[0] && edgeColor[1] === value[1] && edgeColor[2] === value[2]) {
            return;
        }
        edgeColor[0] = 0.2;
        edgeColor[1] = 0.2;
        edgeColor[2] = 0.2;
        this.view.redraw();
    }
    /**
     * Gets RGB edge color for {@link ViewObject | ViewObjects}.
     *
     * Default value is ````[0.2, 0.2, 0.2]````.
     */
    get edgeColor() {
        return this.#state.edgeColor;
    }
    /**
     * Sets edge transparency for {@link ViewObject | ViewObjects}.
     *
     * A value of ````0.0```` indicates fully transparent, ````1.0```` is fully opaque.
     *
     * Default value is ````1.0````.
     */
    set edgeAlpha(value) {
        if (this.#state.edgeAlpha === value) {
            return;
        }
        this.#state.edgeAlpha = value;
        this.view.redraw();
    }
    /**
     * Gets edge transparency for {@link ViewObject | ViewObjects}.
     *
     * A value of ````0.0```` indicates fully transparent, ````1.0```` is fully opaque.
     *
     * Default value is ````1.0````.
     */
    get edgeAlpha() {
        return this.#state.edgeAlpha;
    }
    /**
     * Sets edge width for {@link ViewObject | ViewObjects}.
     *
     * Default value is ````1.0```` pixels.
     */
    set edgeWidth(value) {
        if (this.#state.edgeWidth === value) {
            return;
        }
        this.#state.edgeWidth = value;
        this.view.redraw();
    }
    /**
     * Gets edge width for {@link ViewObject | ViewObjects}.
     *
     * This is not supported by WebGL implementations based on DirectX [2019].
     *
     * Default value is ````1.0```` pixels.
     */
    get edgeWidth() {
        return this.#state.edgeWidth;
    }
    /**
     * Gets if edges are currently applied.
     *
     * This is `true` when {@link Edges.enabled | Edges.enabled} is `true`
     * and {@link View.renderMode | View.renderMode} is
     * in {@link Edges.renderModes | Edges.renderModes}.
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
export { Edges };
//# sourceMappingURL=Edges.js.map