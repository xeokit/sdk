import { Component } from "@xeokit/core";
import type { View } from "./View";
import type { FloatArrayParam } from "@xeokit/math";
/**
 * Configures the appearance of {@link @xeokit/viewer!ViewObject | ViewObjects} when their edges are emphasised.
 *
 * ## Summary
 *
 * * Located at {@link View.edgeMaterial}.
 * * Emphasise edges of a {@link @xeokit/viewer!ViewObject} by setting {@link @xeokit/viewer!ViewObject.edges} ````true````.
 */
declare class EdgeMaterial extends Component {
    #private;
    /**
     * The View to which this EdgeMaterial belongs.
     */
    readonly view: View;
    /**
     * @private
     */
    constructor(view: View, options?: {
        edgeColor?: FloatArrayParam;
        edgeWidth?: number;
        edgeAlpha?: number;
        edges?: boolean;
        renderModes?: number[];
    });
    /**
     * Sets which rendering modes in which to render edges.
     *
     * Accepted modes are {@link QualityRender} and {@link FastRender}.
     *
     * Default value is [{@link QualityRender}].
     */
    set renderModes(value: number[]);
    /**
     * Gets which rendering modes in which to render edges.
     *
     * Accepted modes are {@link QualityRender} and {@link FastRender}.
     *
     * Default value is [{@link QualityRender}].
     */
    get renderModes(): number[];
    /**
     * Sets if edges of {@link ViewObjects} are visible.
     *
     * Default is ````true````.
     */
    set edges(value: boolean);
    /**
     * Gets if edges of {@link ViewObjects} are visible.
     *
     * Default is ````true````.
     */
    get edges(): boolean;
    /**
     * Sets RGB edge color for {@link ViewObjects}.
     *
     * Default value is ````[0.2, 0.2, 0.2]````.
     */
    set edgeColor(value: FloatArrayParam);
    /**
     * Gets RGB edge color for {@link ViewObjects}.
     *
     * Default value is ````[0.2, 0.2, 0.2]````.
     */
    get edgeColor(): Float32Array;
    /**
     * Sets edge transparency for {@link ViewObjects}.
     *
     * A value of ````0.0```` indicates fully transparent, ````1.0```` is fully opaque.
     *
     * Default value is ````1.0````.
     */
    set edgeAlpha(value: number);
    /**
     * Gets edge transparency for {@link ViewObjects}.
     *
     * A value of ````0.0```` indicates fully transparent, ````1.0```` is fully opaque.
     *
     * Default value is ````1.0````.
     */
    get edgeAlpha(): number;
    /**
     * Sets edge width for {@link ViewObjects}.
     *
     * Default value is ````1.0```` pixels.
     */
    set edgeWidth(value: number);
    /**
     * Gets edge width for {@link ViewObjects}.
     *
     * This is not supported by WebGL implementations based on DirectX [2019].
     *
     * Default value is ````1.0```` pixels.
     */
    get edgeWidth(): number;
    /**
     * @private
     */
    destroy(): void;
}
export { EdgeMaterial };
