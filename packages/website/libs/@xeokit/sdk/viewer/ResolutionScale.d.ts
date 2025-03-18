import { Component } from "../core";
import type { View } from "./View";
import { ResolutionScaleParams } from "./ResolutionScaleParams";
/**
 * Configures canvas resolution scaling for a {@link View}.
 *
 * * Located at {@link View.resolutionScale}.
 * * Resolution scaling reduces the pixel resolution of a View's canvas to improve its frame
 * rate, typically applied temporarily during camera movement to enhance responsiveness.
 * * View will apply resulotion scaling when {@link View.renderMode | View.renderMode} is set to one of the values
 * specified in {@link ResolutionScale.renderModes}.
 *
 * See {@link viewer | @xeokit/sdk/viewer} for usage info.
 */
export declare class ResolutionScale extends Component {
    #private;
    /**
     * The View to which this ResolutionScale belongs.
     */
    readonly view: View;
    /**
     * @private
     */
    constructor(view: View, options?: ResolutionScaleParams);
    /**
     * Sets which rendering modes in which to apply ResolutionScale.
     *
     * Default value is [{@link constants!FastRender | FastRender}].
     */
    set renderModes(value: number[]);
    /**
     * Gets which rendering modes in which to apply ResolutionScale.
     *
     * Default value is [{@link constants!FastRender | FastRender}].
     */
    get renderModes(): number[];
    /**
     * Sets the scale when ResolutionScale is applied.
     *
     * Default is ````1.0````.
     */
    set resolutionScale(value: number);
    /**
     * Gets the scale when ResolutionScale is applied.
     *
     * Default is ````1.0````.
     */
    get resolutionScale(): number;
    /**
     * Gets if resolution scaling is currently applied.
     *
     * This is `true` when {@link View.renderMode | View.renderMode} is
     * in {@link ResolutionScale.renderModes | ResolutionScale.renderModes}.
     */
    get applied(): boolean;
    /**
     * Configures this ResolutionScale.
     *
     * @param resolutionScaleParams
     */
    fromParams(resolutionScaleParams: ResolutionScaleParams): void;
    /**
     * Gets the current configuration of this ResolutionScale.
     */
    toParams(): ResolutionScaleParams;
    /**
     * @private
     */
    destroy(): void;
}
//# sourceMappingURL=ResolutionScale.d.ts.map