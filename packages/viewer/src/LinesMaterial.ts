import {Component} from "@xeokit/core";
import type {View} from "./View";


/**
 * Configures the appearance of "lines" geometry primitives.
 *
 * * Located at {@link View#linesMaterial}.
 */
class LinesMaterial extends Component {

    /**
     * The View to which this LinesMaterial belongs.
     */
    public readonly view: View;

    #state: {
        lineWidth: number
    };

    /**
     * @private
     */
    constructor(view: View, options: { lineWidth: number } = {lineWidth: 1}) {

        super(view, options);

        this.view = view;

        this.#state = {
            lineWidth: (options.lineWidth !== undefined && options.lineWidth !== null) ? options.lineWidth : 1
        };
    }

    /**
     * Sets line width.
     *
     * Default value is ````1```` pixels.
     */
    set lineWidth(value: number) {
        this.#state.lineWidth = value || 1;
        this.view.redraw();
    }

    /**
     * Gets the line width.
     *
     * Default value is ````1```` pixels.
     */
    get lineWidth(): number {
        return this.#state.lineWidth;
    }
}

export {LinesMaterial};