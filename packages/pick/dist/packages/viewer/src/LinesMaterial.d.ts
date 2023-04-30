import { Component } from "@xeokit/core";
import type { View } from "./View";
/**
 * Configures the shape of "lines" geometry primitives.
 *
 * * Located at {@link View#linesMaterial}.
 */
declare class LinesMaterial extends Component {
    #private;
    /**
     * The View to which this LinesMaterial belongs.
     */
    readonly view: View;
    /**
     * @private
     */
    constructor(view: View, options?: {
        lineWidth: number;
    });
    /**
     * Sets line width.
     *
     * Default value is ````1```` pixels.
     */
    set lineWidth(value: number);
    /**
     * Gets the line width.
     *
     * Default value is ````1```` pixels.
     */
    get lineWidth(): number;
}
export { LinesMaterial };
