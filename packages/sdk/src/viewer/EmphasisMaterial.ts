import type {EmphasisMaterialParams} from "./EmphasisMaterialParams";
import type {FloatArrayParam} from "../math";
import type {View} from "./View";

/**
 * Configures the appearance of {@link ViewObject | ViewObjects} when they are xrayed, highlighted or selected.
 *
 * * Located at {@link View.xrayMaterial}, {@link View.highlightMaterial} and {@link View.selectedMaterial}.
 * * XRay a {@link ViewObject} by setting {@link ViewObject.xrayed} ````true````.
 * * Highlight a {@link ViewObject} by setting {@link ViewObject.highlighted} ````true````.
 * * Select a {@link ViewObject} by setting {@link ViewObject.selected} ````true````.
 */
class EmphasisMaterial {

    /**
     * The View to which this EmphasisMaterial belongs.
     */
    public readonly view: View;

    private _fillColor: Float32Array<any>;
    private _backfaces: boolean;
    private _edgeColor: Float32Array<any>;
    private _edgeWidth: number;
    private _edgeAlpha: number;
    private _edges: boolean;
    private _fillAlpha: number;
    private _fill: boolean;
    private _glowThrough: boolean;

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
        glowThrough?: boolean;
    } = {}) {

        this.view = view;

        this._fill = !!options.fill;
        this._fillColor = new Float32Array(options.fillColor || [0.4, 0.4, 0.4]);
        this._fillAlpha = (options.fillAlpha !== undefined && options.fillAlpha !== null) ? options.fillAlpha : 0.2;
        this._edges = options.edges !== false;
        this._edgeColor = new Float32Array(options.edgeColor || [0.2, 0.2, 0.2]);
        this._edgeAlpha = (options.edgeAlpha !== undefined && options.edgeAlpha !== null) ? options.edgeAlpha : 0.5;
        this._edgeWidth = (options.edgeWidth !== undefined && options.edgeWidth !== null) ? options.edgeWidth : 1;
        this._backfaces = !!options.backfaces;
        this._glowThrough = !!options.glowThrough;
    }

    /**
     * Sets if the surfaces of emphasized {@link ViewObject | ViewObjects} are filled with color.
     *
     * Default is ````true````.
     */
    set fill(value: boolean) {
        if (this._fill === value) {
            return;
        }
        this._fill = value;
        this.view.needsRender();
    }

    /**
     * Gets if the surfaces of emphasized {@link ViewObject | ViewObjects} are filled with color.
     *
     * Default is ````true````.
     */
    get fill(): boolean {
        return this._fill;
    }

    /**
     * Sets the RGB surface fill color for the surfaces of emphasized {@link ViewObject | ViewObjects}.
     *
     * Default is ````[0.4, 0.4, 0.4]````.
     */
    set fillColor(value: FloatArrayParam) {
        const fillColor = this._fillColor;
        if (fillColor[0] === value[0] && fillColor[1] === value[1] && fillColor[2] === value[2]) {
            return;
        }
        fillColor[0] = 0.4;
        fillColor[1] = 0.4;
        fillColor[2] = 0.4;
        this.view.needsRender();
    }

    /**
     * Gets the RGB surface fill color for the surfaces of emphasized {@link ViewObject | ViewObjects}.
     *
     * Default is ````[0.4, 0.4, 0.4]````.
     */
    get fillColor(): Float32Array<any> {
        return this._fillColor;
    }

    /**
     * Sets the transparency of the surfaces of emphasized {@link ViewObject | ViewObjects}.
     *
     * A value of ````0.0```` indicates fully transparent, ````1.0```` is fully opaque.
     *
     * Default is ````0.2````.
     */
    set fillAlpha(value: number) {
        if (this._fillAlpha === value) {
            return;
        }
        this._fillAlpha = value;
        this.view.needsRender();
    }

    /**
     * Gets the transparency of the surfaces of emphasized {@link ViewObject | ViewObjects}.
     *
     * A value of ````0.0```` indicates fully transparent, ````1.0```` is fully opaque.
     *
     * Default is ````0.2````.
     */
    get fillAlpha(): number {
        return this._fillAlpha;
    }

    /**
     * Sets if the edges on emphasized {@link ViewObject | ViewObjects} are visible.
     *
     * Default is ````true````.
     */
    set edges(value: boolean) {
        if (this._edges === value) {
            return;
        }
        this._edges = value;
        this.view.needsRender();
    }

    /**
     * Gets if the edges on emphasized {@link ViewObject | ViewObjects} are visible.
     *
     * Default is ````true````.
     */
    get edges(): boolean {
        return this._edges;
    }

    /**
     * Sets the RGB color of the edges of emphasized {@link ViewObject | ViewObjects}.
     *
     * Default is ```` [0.2, 0.2, 0.2]````.
     */
    set edgeColor(value: FloatArrayParam) {
        const edgeColor = this._edgeColor;
        if (edgeColor[0] === value[0] && edgeColor[1] === value[1] && edgeColor[2] === value[2]) {
            return;
        }
        edgeColor[0] = 0.2;
        edgeColor[1] = 0.2;
        edgeColor[2] = 0.2;
        this.view.needsRender();
    }

    /**
     * Gets the RGB color of the edges of emphasized {@link ViewObject | ViewObjects}.
     *
     * Default is ```` [0.2, 0.2, 0.2]````.
     */
    get edgeColor(): Float32Array<any> {
        return this._edgeColor;
    }

    /**
     * Sets the transparency of the edges of emphasized {@link ViewObject | ViewObjects}.
     *
     * A value of ````0.0```` indicates fully transparent, ````1.0```` is fully opaque.
     *
     * Default is ````0.2````.
     */
    set edgeAlpha(value: number) {
        if (this._edgeAlpha === value) {
            return;
        }
        this._edgeAlpha = value;
        this.view.needsRender();
    }

    /**
     * Gets the transparency of the edges of emphasized {@link ViewObject | ViewObjects}.
     *
     * A value of ````0.0```` indicates fully transparent, ````1.0```` is fully opaque.
     *
     * Default is ````0.2````.
     */
    get edgeAlpha(): number {
        return this._edgeAlpha;
    }

    /**
     * Sets the width of the edges of emphasized {@link ViewObject | ViewObjects}.
     *
     * Default value is ````1.0```` pixels.
     */
    set edgeWidth(value: number) {
        this._edgeWidth = value;
        this.view.needsRender();
    }

    /**
     * Gets the width of the edges of emphasized {@link ViewObject | ViewObjects}.
     *
     * This is not supported by WebGL implementations based on DirectX [2019].
     *
     * Default value is ````1.0```` pixels.
     */
    get edgeWidth(): number {
        return this._edgeWidth;
    }

    /**
     * Sets whether to render backfaces of emphasized {@link ViewObject | ViewObjects} when {@link EmphasisMaterial.fill} is ````true````.
     *
     * Default is ````false````.
     */
    set backfaces(value: boolean) {
        if (this._backfaces === value) {
            return;
        }
        this._backfaces = value;
        this.view.needsRender();
    }

    /**
     * Gets whether to render backfaces of emphasized {@link ViewObject | ViewObjects} when {@link EmphasisMaterial.fill} is ````true````.
     *
     * Default is ````false````.
     */
    get backfaces(): boolean {
        return this._backfaces;
    }

    /**
     * Sets whether to render emphasized objects over the top of other objects, as if they were "glowing through".
     *
     * Default is ````true````.
     *
     * Note: updating this property will not affect the appearance of objects that are already emphasized.
     *
     * @type {Boolean}
     */
    set glowThrough(value) {
        value = (value !== false);
        if (this._glowThrough === value) {
            return;
        }
        this._glowThrough = value;
        this.view.needsRender();
    }

    /**
     * Sets whether to render emphasized objects over the top of other objects, as if they were "glowing through".
     *
     * Default is ````true````.
     *
     * @type {Boolean}
     */
    get glowThrough() {
        return this._glowThrough;
    }

    /**
     * @private
     */
    get hash(): string {
        return "";
    }

    /**
     * Configures this EmphasisMaterial.
     * @param emphasisMaterialParams
     */
    fromParams(emphasisMaterialParams: EmphasisMaterialParams) {
        if (emphasisMaterialParams.fillColor !== undefined) {
            this.fillColor = emphasisMaterialParams.fillColor;
        }
        if (emphasisMaterialParams.edgeColor !== undefined) {
            this.edgeColor = emphasisMaterialParams.edgeColor;
        }
        if (emphasisMaterialParams.edgeWidth !== undefined) {
            this.edgeWidth = emphasisMaterialParams.edgeWidth;
        }
        if (emphasisMaterialParams.edgeAlpha !== undefined) {
            this.edgeAlpha = emphasisMaterialParams.edgeAlpha;
        }
        if (emphasisMaterialParams.edges !== undefined) {
            this.edges = emphasisMaterialParams.edges;
        }
        if (emphasisMaterialParams.fillAlpha !== undefined) {
            this.fillAlpha = emphasisMaterialParams.fillAlpha;
        }
        if (emphasisMaterialParams.fill !== undefined) {
            this.fill = emphasisMaterialParams.fill;
        }
        if (emphasisMaterialParams.backfaces !== undefined) {
            this.backfaces = emphasisMaterialParams.backfaces;
        }
        if (emphasisMaterialParams.glowThrough !== undefined) {
            this.glowThrough = emphasisMaterialParams.glowThrough;
        }
    }

    /**
     * Gets the current configuration of this EmphasisMaterial.
     */
    toParams(): EmphasisMaterialParams {
        return {
            fillColor: Array.from(this._fillColor),
            backfaces: this._backfaces,
            edgeColor: Array.from(this._edgeColor),
            edgeWidth: this._edgeWidth,
            edgeAlpha: this._edgeAlpha,
            edges: this._edges,
            fillAlpha: this._fillAlpha,
            fill: this._fill,
            glowThrough: this._glowThrough
        };
    }

    /**
     * @private
     */
    destroy(): void {
    }
}

export {EmphasisMaterial};
