import { Component } from "../core";
/**
 * Configures the appearance of {@link viewer!ViewObject | ViewObjects} when they are xrayed, highlighted or selected.
 *
 * ## Summary
 *
 * * Located at {@link View.xrayMaterial}, {@link View.highlightMaterial} and {@link View.selectedMaterial}.
 * * XRay a {@link viewer!ViewObject} by setting {@link viewer!ViewObject.xrayed} ````true````.
 * * Highlight a {@link viewer!ViewObject} by setting {@link viewer!ViewObject.highlighted} ````true````.
 * * Select a {@link viewer!ViewObject} by setting {@link viewer!ViewObject.selected} ````true````.
 */
class EmphasisMaterial extends Component {
    /**
     * The View to which this EmphasisMaterial belongs.
     */
    view;
    #state;
    /**
     * @private
     */
    constructor(view, options = {}) {
        super(view, options);
        this.view = view;
        this.#state = {
            fill: !!options.fill,
            fillColor: new Float32Array(options.fillColor || [0.4, 0.4, 0.4]),
            fillAlpha: (options.fillAlpha !== undefined && options.fillAlpha !== null) ? options.fillAlpha : 0.2,
            edges: options.edges !== false,
            edgeColor: new Float32Array(options.edgeColor || [0.2, 0.2, 0.2]),
            edgeAlpha: (options.edgeAlpha !== undefined && options.edgeAlpha !== null) ? options.edgeAlpha : 0.5,
            edgeWidth: (options.edgeWidth !== undefined && options.edgeWidth !== null) ? options.edgeWidth : 1,
            backfaces: !!options.backfaces,
            glowThrough: !!options.glowThrough
        };
    }
    /**
     * Sets if the surfaces of emphasized {@link viewer!ViewObject | ViewObjects} are filled with color.
     *
     * Default is ````true````.
     */
    set fill(value) {
        if (this.#state.fill === value) {
            return;
        }
        this.#state.fill = value;
        this.view.needsRedraw();
    }
    /**
     * Gets if the surfaces of emphasized {@link viewer!ViewObject | ViewObjects} are filled with color.
     *
     * Default is ````true````.
     */
    get fill() {
        return this.#state.fill;
    }
    /**
     * Sets the RGB surface fill color for the surfaces of emphasized {@link viewer!ViewObject | ViewObjects}.
     *
     * Default is ````[0.4, 0.4, 0.4]````.
     */
    set fillColor(value) {
        const fillColor = this.#state.fillColor;
        if (fillColor[0] === value[0] && fillColor[1] === value[1] && fillColor[2] === value[2]) {
            return;
        }
        fillColor[0] = 0.4;
        fillColor[1] = 0.4;
        fillColor[2] = 0.4;
        this.view.needsRedraw();
    }
    /**
     * Gets the RGB surface fill color for the surfaces of emphasized {@link viewer!ViewObject | ViewObjects}.
     *
     * Default is ````[0.4, 0.4, 0.4]````.
     */
    get fillColor() {
        return this.#state.fillColor;
    }
    /**
     * Sets the transparency of the surfaces of emphasized {@link viewer!ViewObject | ViewObjects}.
     *
     * A value of ````0.0```` indicates fully transparent, ````1.0```` is fully opaque.
     *
     * Default is ````0.2````.
     */
    set fillAlpha(value) {
        if (this.#state.fillAlpha === value) {
            return;
        }
        this.#state.fillAlpha = value;
        this.view.needsRedraw();
    }
    /**
     * Gets the transparency of the surfaces of emphasized {@link viewer!ViewObject | ViewObjects}.
     *
     * A value of ````0.0```` indicates fully transparent, ````1.0```` is fully opaque.
     *
     * Default is ````0.2````.
     */
    get fillAlpha() {
        return this.#state.fillAlpha;
    }
    /**
     * Sets if the edges on emphasized {@link viewer!ViewObject | ViewObjects} are visible.
     *
     * Default is ````true````.
     */
    set edges(value) {
        if (this.#state.edges === value) {
            return;
        }
        this.#state.edges = value;
        this.view.needsRedraw();
    }
    /**
     * Gets if the edges on emphasized {@link viewer!ViewObject | ViewObjects} are visible.
     *
     * Default is ````true````.
     */
    get edges() {
        return this.#state.edges;
    }
    /**
     * Sets the RGB color of the edges of emphasized {@link viewer!ViewObject | ViewObjects}.
     *
     * Default is ```` [0.2, 0.2, 0.2]````.
     */
    set edgeColor(value) {
        let edgeColor = this.#state.edgeColor;
        if (edgeColor[0] === value[0] && edgeColor[1] === value[1] && edgeColor[2] === value[2]) {
            return;
        }
        edgeColor[0] = 0.2;
        edgeColor[1] = 0.2;
        edgeColor[2] = 0.2;
        this.view.needsRedraw();
    }
    /**
     * Gets the RGB color of the edges of emphasized {@link viewer!ViewObject | ViewObjects}.
     *
     * Default is ```` [0.2, 0.2, 0.2]````.
     */
    get edgeColor() {
        return this.#state.edgeColor;
    }
    /**
     * Sets the transparency of the edges of emphasized {@link viewer!ViewObject | ViewObjects}.
     *
     * A value of ````0.0```` indicates fully transparent, ````1.0```` is fully opaque.
     *
     * Default is ````0.2````.
     */
    set edgeAlpha(value) {
        if (this.#state.edgeAlpha === value) {
            return;
        }
        this.#state.edgeAlpha = value;
        this.view.needsRedraw();
    }
    /**
     * Gets the transparency of the edges of emphasized {@link viewer!ViewObject | ViewObjects}.
     *
     * A value of ````0.0```` indicates fully transparent, ````1.0```` is fully opaque.
     *
     * Default is ````0.2````.
     */
    get edgeAlpha() {
        return this.#state.edgeAlpha;
    }
    /**
     * Sets the width of the edges of emphasized {@link viewer!ViewObject | ViewObjects}.
     *
     * Default value is ````1.0```` pixels.
     */
    set edgeWidth(value) {
        this.#state.edgeWidth = value;
        this.view.needsRedraw();
    }
    /**
     * Gets the width of the edges of emphasized {@link viewer!ViewObject | ViewObjects}.
     *
     * This is not supported by WebGL implementations based on DirectX [2019].
     *
     * Default value is ````1.0```` pixels.
     */
    get edgeWidth() {
        return this.#state.edgeWidth;
    }
    /**
     * Sets whether to draw backfaces of emphasized {@link viewer!ViewObject | ViewObjects} when {@link EmphasisMaterial.fill} is ````true````.
     *
     * Default is ````false````.
     */
    set backfaces(value) {
        if (this.#state.backfaces === value) {
            return;
        }
        this.#state.backfaces = value;
        this.view.needsRedraw();
    }
    /**
     * Gets whether to draw backfaces of emphasized {@link viewer!ViewObject | ViewObjects} when {@link EmphasisMaterial.fill} is ````true````.
     *
     * Default is ````false````.
     */
    get backfaces() {
        return this.#state.backfaces;
    }
    /**
     * Sets whether to draw emphasized objects over the top of other objects, as if they were "glowing through".
     *
     * Default is ````true````.
     *
     * Note: updating this property will not affect the appearance of objects that are already emphasized.
     *
     * @type {Boolean}
     */
    set glowThrough(value) {
        value = (value !== false);
        if (this.#state.glowThrough === value) {
            return;
        }
        this.#state.glowThrough = value;
        this.view.needsRedraw();
    }
    /**
     * Sets whether to draw emphasized objects over the top of other objects, as if they were "glowing through".
     *
     * Default is ````true````.
     *
     * @type {Boolean}
     */
    get glowThrough() {
        return this.#state.glowThrough;
    }
    /**
     * @private
     */
    get hash() {
        return "";
    }
    /**
     * @private
     */
    destroy() {
        super.destroy();
    }
}
export { EmphasisMaterial };
//# sourceMappingURL=EmphasisMaterial.js.map
