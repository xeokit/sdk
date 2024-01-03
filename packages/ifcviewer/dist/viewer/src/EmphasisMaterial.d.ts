import { Component } from "@xeokit/core";
import type { FloatArrayParam } from "@xeokit/math";
import type { View } from "./View";
/**
 * Configures the appearance of {@link @xeokit/viewer!ViewObject | ViewObjects} when they are xrayed, highlighted or selected.
 *
 * ## Summary
 *
 * * Located at {@link View.xrayMaterial}, {@link View.highlightMaterial} and {@link View.selectedMaterial}.
 * * XRay a {@link @xeokit/viewer!ViewObject} by setting {@link @xeokit/viewer!ViewObject.xrayed} ````true````.
 * * Highlight a {@link @xeokit/viewer!ViewObject} by setting {@link @xeokit/viewer!ViewObject.highlighted} ````true````.
 * * Select a {@link @xeokit/viewer!ViewObject} by setting {@link @xeokit/viewer!ViewObject.selected} ````true````.
 */
declare class EmphasisMaterial extends Component {
    #private;
    /**
     * The View to which this EmphasisMaterial belongs.
     */
    readonly view: View;
    /**
     * @private
     */
    constructor(view: View, options?: {
        fillColor?: FloatArrayParam;
        backfaces?: boolean;
        edgeColor?: FloatArrayParam;
        edgeWidth?: number;
        edgeAlpha?: number;
        edges?: boolean;
        fillAlpha?: number;
        fill?: boolean;
    });
    /**
     * Sets if the surfaces of emphasized {@link @xeokit/viewer!ViewObject | ViewObjects} are filled with color.
     *
     * Default is ````true````.
     */
    set fill(value: boolean);
    /**
     * Gets if the surfaces of emphasized {@link @xeokit/viewer!ViewObject | ViewObjects} are filled with color.
     *
     * Default is ````true````.
     */
    get fill(): boolean;
    /**
     * Sets the RGB surface fill color for the surfaces of emphasized {@link @xeokit/viewer!ViewObject | ViewObjects}.
     *
     * Default is ````[0.4, 0.4, 0.4]````.
     */
    set fillColor(value: FloatArrayParam);
    /**
     * Gets the RGB surface fill color for the surfaces of emphasized {@link @xeokit/viewer!ViewObject | ViewObjects}.
     *
     * Default is ````[0.4, 0.4, 0.4]````.
     */
    get fillColor(): Float32Array;
    /**
     * Sets the transparency of the surfaces of emphasized {@link @xeokit/viewer!ViewObject | ViewObjects}.
     *
     * A value of ````0.0```` indicates fully transparent, ````1.0```` is fully opaque.
     *
     * Default is ````0.2````.
     */
    set fillAlpha(value: number);
    /**
     * Gets the transparency of the surfaces of emphasized {@link @xeokit/viewer!ViewObject | ViewObjects}.
     *
     * A value of ````0.0```` indicates fully transparent, ````1.0```` is fully opaque.
     *
     * Default is ````0.2````.
     */
    get fillAlpha(): number;
    /**
     * Sets if the edges on emphasized {@link @xeokit/viewer!ViewObject | ViewObjects} are visible.
     *
     * Default is ````true````.
     */
    set edges(value: boolean);
    /**
     * Gets if the edges on emphasized {@link @xeokit/viewer!ViewObject | ViewObjects} are visible.
     *
     * Default is ````true````.
     */
    get edges(): boolean;
    /**
     * Sets the RGB color of the edges of emphasized {@link @xeokit/viewer!ViewObject | ViewObjects}.
     *
     * Default is ```` [0.2, 0.2, 0.2]````.
     */
    set edgeColor(value: FloatArrayParam);
    /**
     * Gets the RGB color of the edges of emphasized {@link @xeokit/viewer!ViewObject | ViewObjects}.
     *
     * Default is ```` [0.2, 0.2, 0.2]````.
     */
    get edgeColor(): Float32Array;
    /**
     * Sets the transparency of the edges of emphasized {@link @xeokit/viewer!ViewObject | ViewObjects}.
     *
     * A value of ````0.0```` indicates fully transparent, ````1.0```` is fully opaque.
     *
     * Default is ````0.2````.
     */
    set edgeAlpha(value: number);
    /**
     * Gets the transparency of the edges of emphasized {@link @xeokit/viewer!ViewObject | ViewObjects}.
     *
     * A value of ````0.0```` indicates fully transparent, ````1.0```` is fully opaque.
     *
     * Default is ````0.2````.
     */
    get edgeAlpha(): number;
    /**
     * Sets the width of the edges of emphasized {@link @xeokit/viewer!ViewObject | ViewObjects}.
     *
     * Default value is ````1.0```` pixels.
     */
    set edgeWidth(value: number);
    /**
     * Gets the width of the edges of emphasized {@link @xeokit/viewer!ViewObject | ViewObjects}.
     *
     * This is not supported by WebGL implementations based on DirectX [2019].
     *
     * Default value is ````1.0```` pixels.
     */
    get edgeWidth(): number;
    /**
     * Sets whether to render backfaces of emphasized {@link @xeokit/viewer!ViewObject | ViewObjects} when {@link EmphasisMaterial.fill} is ````true````.
     *
     * Default is ````false````.
     */
    set backfaces(value: boolean);
    /**
     * Gets whether to render backfaces of emphasized {@link @xeokit/viewer!ViewObject | ViewObjects} when {@link EmphasisMaterial.fill} is ````true````.
     *
     * Default is ````false````.
     */
    get backfaces(): boolean;
    /**
     * @private
     */
    get hash(): string;
    /**
     * @private
     */
    destroy(): void;
}
export { EmphasisMaterial };
