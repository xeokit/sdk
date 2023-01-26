import * as math from '../math/index';
import { Component } from '../Component';
import type { View } from "./View";
import { EventEmitter } from "../EventEmitter";
import type { IntArrayParam } from "../math/index";
/**
 * Manages the HTML canvas belonging to a {@link View}.
 */
declare class View extends Component {
    #private;
    /**
     * The View to which this View belongs.
     */
    readonly view: View;
    /**
     * The HTML canvas.
     */
    canvas: HTMLCanvasElement;
    /**
     * Indicates if this View is transparent.
     */
    readonly transparent: boolean;
    /**
     * Boundary of the View in absolute browser window coordinates.
     * Format is ````[xmin, ymin, xwidth, ywidth]````.
     */
    readonly boundary: number[];
    /**
     * Emits an event each time the canvas boundary changes.
     *
     * @event
     */
    readonly onBoundary: EventEmitter<View, IntArrayParam>;
    /**
     * @private
     */
    constructor(view: View, cfg: {
        canvas: HTMLCanvasElement;
        backgroundColor: any[] | undefined;
        backgroundColorFromAmbientLight: boolean;
        premultipliedAlpha: boolean;
        transparent: boolean;
    });
    /**
     * Gets the canvas clear color.
     *
     * Default value is ````[1, 1, 1]````.
     */
    get backgroundColor(): math.FloatArrayParam;
    /**
     * Sets the canvas clear color.
     *
     * Default value is ````[1, 1, 1]````.
     */
    set backgroundColor(value: math.FloatArrayParam);
    /**
     * Gets whether the canvas clear color will be derived from {@link AmbientLight} or {@link View#backgroundColor}
     * when {@link View#transparent} is ```true```.
     *
     * When {@link View#transparent} is ```true``` and this is ````true````, then the canvas clear color will
     * be taken from the {@link Scene}'s ambient light color.
     *
     * When {@link View#transparent} is ```true``` and this is ````false````, then the canvas clear color will
     * be taken from {@link View#backgroundColor}.
     *
     * Default value is ````true````.
     */
    get backgroundColorFromAmbientLight(): boolean;
    /**
     * Sets if the canvas background color is derived from an {@link AmbientLight}.
     *
     * This only has effect when the canvas is not transparent. When not enabled, the background color
     * will be the canvas element's HTML/CSS background color.
     *
     * Default value is ````true````.
     */
    set backgroundColorFromAmbientLight(backgroundColorFromAmbientLight: boolean);
    /**
     * Gets the scale of the canvas back buffer relative to the CSS-defined size of the canvas.
     *
     * This is a common way to trade off rendering quality for speed. If the canvas size is defined in CSS, then
     * setting this to a value between ````[0..1]```` (eg ````0.5````) will render into a smaller back buffer, giving
     * a performance boost.
     *
     * @returns  The resolution scale.
     */
    get resolutionScale(): number;
    /**
     * Sets the scale of the canvas back buffer relative to the CSS-defined size of the canvas.
     *
     * This is a common way to trade off rendering quality for speed. If the canvas size is defined in CSS, then
     * setting this to a value between ````[0..1]```` (eg ````0.5````) will render into a smaller back buffer, giving
     * a performance boost.
     *
     * @param resolutionScale The resolution scale.
     */
    set resolutionScale(resolutionScale: number);
    /**
     * @private
     */
    destroy(): void;
}
export { View };
