import {Component} from "@xeokit/core/components";



import type {View} from "./View";
import {FloatArrayParam} from "@xeokit/math/math";
import {QualityRender} from "@xeokit/core/constants";


/**
 * Configures the appearance of {@link ViewObject | ViewObjects} when their edges are emphasised.
 *
 * ## Summary
 *
 * * Located at {@link View.edgeMaterial}.
 * * Emphasise edges of a {@link ViewObject} by setting {@link ViewObject.edges} ````true````.
 */
class EdgeMaterial extends Component {

    /**
     * The View to which this EdgeMaterial belongs.
     */
    public readonly view: View;

    /**
     * @private
     */
    #state: {
        edgeColor: Float32Array;
        edgeWidth: number;
        edgeAlpha: number;
        edges: boolean;
        renderModes: number[];
    };

    /**
     * @private
     */
    constructor(view: View, options: {
        edgeColor?: FloatArrayParam;
        edgeWidth?: number;
        edgeAlpha?: number;
        edges?: boolean;
        renderModes?: number[];
    } = {}) {

        super(view, options);

        this.view = view;

        this.#state = {
            renderModes: options.renderModes || [QualityRender],
            edges: options.edges !== false,
            edgeColor: new Float32Array(options.edgeColor || [0.2, 0.2, 0.2]),
            edgeAlpha: (options.edgeAlpha !== undefined && options.edgeAlpha !== null) ? options.edgeAlpha : 0.5,
            edgeWidth: (options.edgeWidth !== undefined && options.edgeWidth !== null) ? options.edgeWidth : 1
        };
    }

    /**
     * Sets which rendering modes in which to render edges.
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
     * Gets which rendering modes in which to render edges.
     *
     * Accepted modes are {@link QualityRender} and {@link FastRender}.
     *
     * Default value is [{@link QualityRender}].
     */
    get renderModes(): number[] {
        return this.#state.renderModes;
    }

    /**
     * Sets if edges of {@link ViewObjects} are visible.
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
     * Gets if edges of {@link ViewObjects} are visible.
     *
     * Default is ````true````.
     */
    get edges(): boolean {
        return this.#state.edges;
    }

    /**
     * Sets RGB edge color for {@link ViewObjects}.
     *
     * Default value is ````[0.2, 0.2, 0.2]````.
     */
    set edgeColor(value: FloatArrayParam) {
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
     * Gets RGB edge color for {@link ViewObjects}.
     *
     * Default value is ````[0.2, 0.2, 0.2]````.
     */
    get edgeColor(): Float32Array {
        return this.#state.edgeColor;
    }

    /**
     * Sets edge transparency for {@link ViewObjects}.
     *
     * A value of ````0.0```` indicates fully transparent, ````1.0```` is fully opaque.
     *
     * Default value is ````1.0````.
     */
    set edgeAlpha(value: number) {
        if (this.#state.edgeAlpha === value) {
            return;
        }
        this.#state.edgeAlpha = value;
        this.view.redraw();
    }

    /**
     * Gets edge transparency for {@link ViewObjects}.
     *
     * A value of ````0.0```` indicates fully transparent, ````1.0```` is fully opaque.
     *
     * Default value is ````1.0````.
     */
    get edgeAlpha(): number {
        return this.#state.edgeAlpha;
    }

    /**
     * Sets edge width for {@link ViewObjects}.
     *
     * Default value is ````1.0```` pixels.
     */
    set edgeWidth(value: number) {
        if (this.#state.edgeWidth === value) {
            return;
        }
        this.#state.edgeWidth = value;
        this.view.redraw();
    }

    /**
     * Gets edge width for {@link ViewObjects}.
     *
     * This is not supported by WebGL implementations based on DirectX [2019].
     *
     * Default value is ````1.0```` pixels.
     */
    get edgeWidth(): number {
        return this.#state.edgeWidth;
    }

    /**
     * @private
     */
    destroy() {
        super.destroy();
    }
}

export {EdgeMaterial};