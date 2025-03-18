import { Component } from "../core";
import type { View } from "./View";
/**
 * Configures whether a {@link View} shows textures on its {@link ViewObject | ViewObjects}.
 *
 * * Located at {@link View.texturing}.
 *
 * See {@link viewer | @xeokit/sdk/viewer} for usage info.
 */
declare class Texturing extends Component {
    #private;
    /**
     * The View to which this Texturing belongs.
     */
    readonly view: View;
    /**
     * @private
     */
    constructor(view: View, options?: {
        enabled?: boolean;
        renderModes?: number[];
    });
    /**
     * Sets which rendering modes in which to render textures.
     *
     * Accepted modes are {@link constants!QualityRender} and {@link constants!FastRender}.
     *
     * Default value is [{@link constants!QualityRender}].
     */
    set renderModes(value: number[]);
    /**
     * Gets which rendering modes in which to render textures.
     *
     * Accepted modes are {@link constants!QualityRender} and {@link constants!FastRender}.
     *
     * Default value is [{@link constants!QualityRender}].
     */
    get renderModes(): number[];
    /**
     * Sets if textures on {@link ViewObject | ViewObjects} are visible.
     *
     * Default is ````true````.
     */
    set enabled(value: boolean);
    /**
     * Gets if textures on {@link ViewObject | ViewObjects} are visible.
     *
     * Default is ````true````.
     */
    get enabled(): boolean;
    /**
     * Gets if textures are currently applied.
     *
     * This is `true` when {@link Texturing.enabled | Texturing.enabled} is `true`
     * and {@link View.renderMode | View.renderMode} is
     * in {@link Texturing.renderModes | Texturing.renderModes}.
     */
    get applied(): boolean;
    /**
     * @private
     */
    destroy(): void;
}
export { Texturing };
//# sourceMappingURL=Texturing.d.ts.map