import type { View } from "./View";
import { Component, SDKError } from "@xeokit/core";
/**
 * Configures Scalable Ambient Obscurance (SAO) for a {@link @xeokit/viewer!View}.
 */
export declare class SAO extends Component {
    #private;
    /**
     * The View to which this SAO belongs.
     */
    readonly view: View;
    /** @private */
    constructor(view: View, params: any);
    /**
     * Sets which rendering modes in which to render SAO.
     *
     * Supported rendering modes are:
     *
     * * {@link @xeokit/constants!FastRender | FastRender} - Fast rendering mode for smooth interactivity.
     * * {@link @xeokit/constants!QualityRender | QualityRender} - Quality rendering mode for maximum image fidelity.
     *
     * Default value is [{@link @xeokit/constants!QualityRender | QualityRender}].
     *
     * @param renderModes The rendering modes
     * @returns *{@link @xeokit/core!SDKError}*
     * * Rendering mode not supported.
     */
    setRenderModes(renderModes: number[]): SDKError | void;
    /**
     * Gets which rendering modes in which to render SAO.
     *
     * Supported rendering modes are:
     *
     * * {@link @xeokit/constants!FastRender | FastRender} - Fast rendering mode for smooth interactivity.
     * * {@link @xeokit/constants!QualityRender | QualityRender} - Quality rendering mode for maximum image fidelity.
     *
     * Default value is [{@link @xeokit/constants!QualityRender | QualityRender}].
     */
    get renderModes(): number[];
    /**
     * Gets whether SAO is supported by this browser and GPU.
     *
     * Even when enabled, SAO will only work if supported.
     */
    get supported(): boolean;
    /**
     * Gets whether SAO is enabled for the {@link @xeokit/viewer!View}.
     *
     * Even when enabled, SAO will only apply if supported.
     *
     * Default value is ````false````.
     */
    get enabled(): boolean;
    /**
     * Sets whether SAO is enabled for the {@link @xeokit/viewer!View}.
     *
     * Even when enabled, SAO will only work if supported.
     *
     * Default value is ````false````.
     */
    set enabled(value: boolean);
    /**
     * Returns true if SAO is currently possible, where it is supported, enabled, and the current view state is compatible.
     * Called internally by renderer logic.
     * @private
     */
    get possible(): boolean;
    /**
     * Gets the maximum area that SAO takes into account when checking for possible occlusion for each fragment.
     *
     * Default value is ````100.0````.
     */
    get kernelRadius(): number;
    /**
     * Sets the maximum area that SAO takes into account when checking for possible occlusion for each fragment.
     *
     * Default value is ````100.0````.
     */
    set kernelRadius(value: number);
    /**
     * Gets the degree of darkening (ambient obscurance) produced by the SAO effect.
     *
     * Default value is ````0.15````.
     */
    get intensity(): number;
    /**
     * Sets the degree of darkening (ambient obscurance) produced by the SAO effect.
     *
     * Default value is ````0.15````.
     */
    set intensity(value: number);
    /**
     * Gets the SAO bias.
     *
     * Default value is ````0.5````.
     */
    get bias(): number;
    /**
     * Sets the SAO bias.
     *
     * Default value is ````0.5````.
     */
    set bias(value: number);
    /**
     * Gets the SAO occlusion scale.
     *
     * Default value is ````1.0````.
     */
    get scale(): number;
    /**
     * Sets the SAO occlusion scale.
     *
     * Default value is ````1.0````.
     */
    set scale(value: number);
    /**
     * Gets the SAO minimum resolution.
     *
     * Default value is ````0.0````.
     */
    get minResolution(): number;
    /**
     * Sets the SAO minimum resolution.
     *
     * Default value is ````0.0````.
     */
    set minResolution(value: number);
    /**
     * Gets the number of SAO samples.
     *
     * Default value is ````10````.
     */
    get numSamples(): number;
    /**
     * Sets the number of SAO samples.
     *
     * Default value is ````10````.
     *
     * Update this sparingly, since it causes a shader recompile.
     */
    set numSamples(value: number);
    /**
     * Gets whether Guassian blur is enabled.
     *
     * Default value is ````true````.
     */
    get blur(): boolean;
    /**
     * Sets whether Guassian blur is enabled.
     *
     * Default value is ````true````.
     */
    set blur(value: boolean);
    /**
     * Gets the SAO blend cutoff.
     *
     * Default value is ````0.3````.
     *
     * Normally you don't need to alter this.
     */
    get blendCutoff(): number;
    /**
     * Sets the SAO blend cutoff.
     *
     * Default value is ````0.3````.
     *
     * Normally you don't need to alter this.
     */
    set blendCutoff(value: number);
    /**
     * Gets the SAO blend scale.
     *
     * Default value is ````1.0````.
     *
     * Normally you don't need to alter this.
     */
    get blendFactor(): number;
    /**
     * Sets the SAO blend factor.
     *
     * Default value is ````1.0````.
     *
     * Normally you don't need to alter this.
     */
    set blendFactor(value: number);
    /**
     * @private
     */
    destroy(): void;
}
