import { Component } from "../core";
import type { View } from "./View";
import type { FloatArrayParam } from "../math";
import { EdgesParams } from "./EdgesParams";
/**
 * Configures edge enhancement effect for a {@link View}.
 *
 * * Located at {@link View.edges}.
 * * View will apply edge enhancement when {@link View.renderMode | View.renderMode} is set to one of the values
 * specified in {@link Edges.renderModes}.
 *
 * See {@link viewer | @xeokit/sdk/viewer} for usage info.
 */
declare class Edges extends Component {
    #private;
    /**
     * The View to which this Edges belongs.
     */
    readonly view: View;
    /**
     * @private
     */
    constructor(view: View, options?: EdgesParams);
    /**
     * Sets which rendering modes in which to show edges on {@link ViewObject | ViewObjects}.
     *
     * The {@link View} will show edges whenever {@link View.renderMode} has been set one of these values.
     *
     * Default value is [{@link constants!QualityRender | QualityRender}].
     */
    set renderModes(value: number[]);
    /**
     * Gets which rendering modes in which to show edges on {@link ViewObject | ViewObjects}.
     *
     * The {@link View} will show edges whenever {@link View.renderMode} has been set one of these values.
     *
     * Default value is [{@link constants!QualityRender | QualityRender}].
     */
    get renderModes(): number[];
    /**
     * Sets RGB edge color for {@link ViewObject | ViewObjects}.
     *
     * Default value is ````[0.2, 0.2, 0.2]````.
     */
    set edgeColor(value: FloatArrayParam);
    /**
     * Gets RGB edge color for {@link ViewObject | ViewObjects}.
     *
     * Default value is ````[0.2, 0.2, 0.2]````.
     */
    get edgeColor(): FloatArrayParam;
    /**
     * Sets edge transparency for {@link ViewObject | ViewObjects}.
     *
     * A value of ````0.0```` indicates fully transparent, ````1.0```` is fully opaque.
     *
     * Default value is ````1.0````.
     */
    set edgeAlpha(value: number);
    /**
     * Gets edge transparency for {@link ViewObject | ViewObjects}.
     *
     * A value of ````0.0```` indicates fully transparent, ````1.0```` is fully opaque.
     *
     * Default value is ````1.0````.
     */
    get edgeAlpha(): number;
    /**
     * Sets edge width for {@link ViewObject | ViewObjects}.
     *
     * Default value is ````1.0```` pixels.
     */
    set edgeWidth(value: number);
    /**
     * Gets edge width for {@link ViewObject | ViewObjects}.
     *
     * This is not supported by WebGL implementations based on DirectX [2019].
     *
     * Default value is ````1.0```` pixels.
     */
    get edgeWidth(): number;
    /**
     * Gets if edges are currently applied.
     *
     * This is `true` when {@link View.renderMode | View.renderMode} is
     * in {@link Edges.renderModes | Edges.renderModes}.
     */
    get applied(): boolean;
    /**
     * Gets the current configuration of this Edges effect.
     */
    toParams(): EdgesParams;
    /**
     * Configures this Edges effect.
     *
     * @param edgesParams
     */
    fromParams(edgesParams: EdgesParams): void;
    /**
     * @private
     */
    destroy(): void;
}
export { Edges };
//# sourceMappingURL=Edges.d.ts.map