import {Component} from "@xeokit/core";
import type {FloatArrayParam} from "@xeokit/math";

import type {View} from "./View";

/**
 * Configures the appearance of {@link ViewObject | ViewObjects} when they are xrayed, highlighted or selected.
 *
 * ## Summary
 *
 * * Located at {@link View.xrayMaterial}, {@link View.highlightMaterial} and {@link View.selectedMaterial}.
 * * XRay a {@link ViewObject} by setting {@link ViewObject.xrayed} ````true````.
 * * Highlight a {@link ViewObject} by setting {@link ViewObject.highlighted} ````true````.
 * * Select a {@link ViewObject} by setting {@link ViewObject.selected} ````true````.
 */
class EmphasisMaterial extends Component {

    /**
     * The View to which this EmphasisMaterial belongs.
     */
    public readonly view: View;

    #state: {
        fillColor: Float32Array;
        backfaces: boolean;
        edgeColor: Float32Array;
        edgeWidth: number;
        edgeAlpha: number;
        edges: boolean;
        fillAlpha: number;
        fill: boolean
    };

    /**
     * @private
     */
    constructor(view: View, options: {
        fillColor?: FloatArrayParam;
        backfaces?: boolean;
        edgeColor?: FloatArrayParam;
        edgeWidth?: number;
        edgeAlpha?: number;
        edges?: boolean;
        fillAlpha?: number;
        fill?: boolean;
    } = {}) {

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
            backfaces: !!options.backfaces
        };
    }

    /**
     * Sets if the surfaces of emphasized {@link ViewObject | ViewObjects} are filled with color.
     *
     * Default is ````true````.
     */
    set fill(value: boolean) {
        if (this.#state.fill === value) {
            return;
        }
        this.#state.fill = value;
        this.view.redraw();
    }

    /**
     * Gets if the surfaces of emphasized {@link ViewObject | ViewObjects} are filled with color.
     *
     * Default is ````true````.
     */
    get fill(): boolean {
        return this.#state.fill;
    }

    /**
     * Sets the RGB surface fill color for the surfaces of emphasized {@link ViewObject | ViewObjects}.
     *
     * Default is ````[0.4, 0.4, 0.4]````.
     */
    set fillColor(value: FloatArrayParam) {
        const fillColor = this.#state.fillColor;
        if (fillColor[0] === value[0] && fillColor[1] === value[1] && fillColor[2] === value[2]) {
            return;
        }
        fillColor[0] = 0.4;
        fillColor[1] = 0.4;
        fillColor[2] = 0.4;
        this.view.redraw();
    }

    /**
     * Gets the RGB surface fill color for the surfaces of emphasized {@link ViewObject | ViewObjects}.
     *
     * Default is ````[0.4, 0.4, 0.4]````.
     */
    get fillColor(): Float32Array {
        return this.#state.fillColor;
    }

    /**
     * Sets the transparency of the surfaces of emphasized {@link ViewObject | ViewObjects}.
     *
     * A value of ````0.0```` indicates fully transparent, ````1.0```` is fully opaque.
     *
     * Default is ````0.2````.
     */
    set fillAlpha(value: number) {
        if (this.#state.fillAlpha === value) {
            return;
        }
        this.#state.fillAlpha = value;
        this.view.redraw();
    }

    /**
     * Gets the transparency of the surfaces of emphasized {@link ViewObject | ViewObjects}.
     *
     * A value of ````0.0```` indicates fully transparent, ````1.0```` is fully opaque.
     *
     * Default is ````0.2````.
     */
    get fillAlpha(): number {
        return this.#state.fillAlpha;
    }

    /**
     * Sets if the edges on emphasized {@link ViewObject | ViewObjects} are visible.
     *
     * Default is ````true````.
     */
    set edges(value: boolean) {
        if (this.#state.edges === value) {
            return;
        }
        this.#state.edges = value;
        this.view.redraw();
    }

    /**
     * Gets if the edges on emphasized {@link ViewObject | ViewObjects} are visible.
     *
     * Default is ````true````.
     */
    get edges(): boolean {
        return this.#state.edges;
    }

    /**
     * Sets the RGB color of the edges of emphasized {@link ViewObject | ViewObjects}.
     *
     * Default is ```` [0.2, 0.2, 0.2]````.
     */
    set edgeColor(value: FloatArrayParam) {
        let edgeColor = this.#state.edgeColor;
        if (edgeColor[0] === value[0] && edgeColor[1] === value[1] && edgeColor[2] === value[2]) {
            return;
        }
        edgeColor[0] = 0.2;
        edgeColor[1] = 0.2;
        edgeColor[2] = 0.2;
        this.view.redraw();
    }

    /**
     * Gets the RGB color of the edges of emphasized {@link ViewObject | ViewObjects}.
     *
     * Default is ```` [0.2, 0.2, 0.2]````.
     */
    get edgeColor(): Float32Array {
        return this.#state.edgeColor;
    }

    /**
     * Sets the transparency of the edges of emphasized {@link ViewObject | ViewObjects}.
     *
     * A value of ````0.0```` indicates fully transparent, ````1.0```` is fully opaque.
     *
     * Default is ````0.2````.
     */
    set edgeAlpha(value: number) {
        if (this.#state.edgeAlpha === value) {
            return;
        }
        this.#state.edgeAlpha = value;
        this.view.redraw();
    }

    /**
     * Gets the transparency of the edges of emphasized {@link ViewObject | ViewObjects}.
     *
     * A value of ````0.0```` indicates fully transparent, ````1.0```` is fully opaque.
     *
     * Default is ````0.2````.
     */
    get edgeAlpha(): number {
        return this.#state.edgeAlpha;
    }

    /**
     * Sets the width of the edges of emphasized {@link ViewObject | ViewObjects}.
     *
     * Default value is ````1.0```` pixels.
     */
    set edgeWidth(value: number) {
        this.#state.edgeWidth = value;
        this.view.redraw();
    }

    /**
     * Gets the width of the edges of emphasized {@link ViewObject | ViewObjects}.
     *
     * This is not supported by WebGL implementations based on DirectX [2019].
     *
     * Default value is ````1.0```` pixels.
     */
    get edgeWidth(): number {
        return this.#state.edgeWidth;
    }

    /**
     * Sets whether to render backfaces of emphasized {@link ViewObject | ViewObjects} when {@link EmphasisMaterial.fill} is ````true````.
     *
     * Default is ````false````.
     */
    set backfaces(value: boolean) {
        if (this.#state.backfaces === value) {
            return;
        }
        this.#state.backfaces = value;
        this.view.redraw();
    }

    /**
     * Gets whether to render backfaces of emphasized {@link ViewObject | ViewObjects} when {@link EmphasisMaterial.fill} is ````true````.
     *
     * Default is ````false````.
     */
    get backfaces(): boolean {
        return this.#state.backfaces;
    }

    /**
     * @private
     */
    get hash(): string {
        return "";
    }

    /**
     * @private
     */
    destroy(): void {
        super.destroy();
    }
}

export {EmphasisMaterial};