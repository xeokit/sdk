import {EventDispatcher} from "strongly-typed-events";

import type {View} from "./View";
import {Component, EventEmitter} from "@xeokit/core/components";
import {FloatArrayParam, IntArrayParam} from "@xeokit/math/math";
import {vec3} from "@xeokit/math/matrix";

/**
 * Manages the HTML canvas belonging to a {@link View}.
 */
class Canvas extends Component {

    /**
     * The View to which this Canvas belongs.
     */
    public readonly view: View;

    /**
     * The HTML canvas.
     */
    public canvas: HTMLCanvasElement;

    /**
     * Indicates if this Canvas is transparent.
     */
    public readonly transparent: boolean;

    /**
     * Boundary of the Canvas in absolute browser window coordinates.
     * Format is ````[xmin, ymin, xwidth, ywidth]````.
     */
    public readonly boundary: number[];

    #onTick: () => void;

    #backgroundColor: FloatArrayParam;
    #backgroundColorFromAmbientLight: boolean;
    #resolutionScale: number;

    /**
     * Emits an event each time the canvas boundary changes.
     *
     * @event
     */
    readonly onBoundary: EventEmitter<Canvas, IntArrayParam>;

    /**
     * @private
     */
    constructor(view: View, cfg: { canvas: HTMLCanvasElement; backgroundColor: any[] | undefined; backgroundColorFromAmbientLight: boolean; premultipliedAlpha: boolean; transparent: boolean }) {

        super(view, cfg);

        this.onBoundary = new EventEmitter(new EventDispatcher<Canvas, IntArrayParam>());

        this.#resolutionScale = 1;
        this.#backgroundColor = vec3([
            cfg.backgroundColor ? cfg.backgroundColor[0] : 1,
            cfg.backgroundColor ? cfg.backgroundColor[1] : 1,
            cfg.backgroundColor ? cfg.backgroundColor[2] : 1]);
        this.#backgroundColorFromAmbientLight = !!cfg.backgroundColorFromAmbientLight;

        this.view = view;
        this.canvas = cfg.canvas;
        this.transparent = !!cfg.transparent;
        this.canvas.width = this.canvas.clientWidth;
        this.canvas.height = this.canvas.clientHeight;
        this.boundary = [
            this.canvas.offsetLeft, this.canvas.offsetTop,
            this.canvas.clientWidth, this.canvas.clientHeight
        ];

        // Publish canvas size and position changes on each scene tick

        let lastWindowWidth = 0;
        let lastWindowHeight = 0;
        let lastCanvasWidth = 0;
        let lastCanvasHeight = 0;
        let lastCanvasOffsetLeft = 0;
        let lastCanvasOffsetTop = 0;
        let lastParent: null | HTMLElement = null;

        let lastResolutionScale: null | number = null;

        this.#onTick = view.viewer.onTick.subscribe(() => {

            const canvas = this.canvas;
            const newResolutionScale = (this.#resolutionScale !== lastResolutionScale);
            const newWindowSize = (window.innerWidth !== lastWindowWidth || window.innerHeight !== lastWindowHeight);
            const newCanvasSize = (canvas.clientWidth !== lastCanvasWidth || canvas.clientHeight !== lastCanvasHeight);
            const newCanvasPos = (canvas.offsetLeft !== lastCanvasOffsetLeft || canvas.offsetTop !== lastCanvasOffsetTop);
            const parent = canvas.parentElement;
            const newParent = (parent !== lastParent);

            if (newResolutionScale || newWindowSize || newCanvasSize || newCanvasPos || newParent) {
                //   this._spinner._adjustPosition();
                if (newResolutionScale || newCanvasSize || newCanvasPos) {
                    const newWidth = canvas.clientWidth;
                    const newHeight = canvas.clientHeight;
                    if (newResolutionScale || newCanvasSize) {
                        canvas.width = Math.round(canvas.clientWidth * this.#resolutionScale);
                        canvas.height = Math.round(canvas.clientHeight * this.#resolutionScale);
                    }
                    const boundary = this.boundary;
                    boundary[0] = canvas.offsetLeft;
                    boundary[1] = canvas.offsetTop;
                    boundary[2] = newWidth;
                    boundary[3] = newHeight;
                    if (!newResolutionScale || newCanvasSize) {
                        this.onBoundary.dispatch(this, boundary);
                    }
                    lastCanvasWidth = newWidth;
                    lastCanvasHeight = newHeight;
                }

                if (newResolutionScale) {
                    lastResolutionScale = this.#resolutionScale;
                }
                if (newWindowSize) {
                    lastWindowWidth = window.innerWidth;
                    lastWindowHeight = window.innerHeight;
                }
                if (newCanvasPos) {
                    lastCanvasOffsetLeft = canvas.offsetLeft;
                    lastCanvasOffsetTop = canvas.offsetTop;
                }
                lastParent = parent;
            }
        });
    }

    /**
     * Gets the canvas clear color.
     *
     * Default value is ````[1, 1, 1]````.
     */
    get backgroundColor(): FloatArrayParam {
        return this.#backgroundColor;
    }

    /**
     * Sets the canvas clear color.
     *
     * Default value is ````[1, 1, 1]````.
     */
    set backgroundColor(value: FloatArrayParam) {
        if (value) {
            this.#backgroundColor[0] = value[0];
            this.#backgroundColor[1] = value[1];
            this.#backgroundColor[2] = value[2];
        } else {
            this.#backgroundColor[0] = 1.0;
            this.#backgroundColor[1] = 1.0;
            this.#backgroundColor[2] = 1.0;
        }
        this.view.redraw();
    }

    /**
     * Gets whether the canvas clear color will be derived from {@link AmbientLight} or {@link Canvas#backgroundColor}
     * when {@link Canvas#transparent} is ```true```.
     *
     * When {@link Canvas#transparent} is ```true``` and this is ````true````, then the canvas clear color will
     * be taken from the {@link Scene}'s ambient light color.
     *
     * When {@link Canvas#transparent} is ```true``` and this is ````false````, then the canvas clear color will
     * be taken from {@link Canvas#backgroundColor}.
     *
     * Default value is ````true````.
     */
    get backgroundColorFromAmbientLight(): boolean {
        return this.#backgroundColorFromAmbientLight;
    }

    /**
     * Sets if the canvas background color is derived from an {@link AmbientLight}.
     *
     * This only has effect when the canvas is not transparent. When not enabled, the background color
     * will be the canvas element's HTML/CSS background color.
     *
     * Default value is ````true````.
     */
    set backgroundColorFromAmbientLight(backgroundColorFromAmbientLight: boolean) {
        this.#backgroundColorFromAmbientLight = (backgroundColorFromAmbientLight !== false);
    }

    /**
     * Gets the scale of the canvas back buffer relative to the CSS-defined size of the canvas.
     *
     * This is a common way to trade off rendering quality for speed. If the canvas size is defined in CSS, then
     * setting this to a value between ````[0..1]```` (eg ````0.5````) will render into a smaller back buffer, giving
     * a performance boost.
     *
     * @returns  The resolution scale.
     */
    get resolutionScale(): number {
        return this.#resolutionScale;
    }

    /**
     * Sets the scale of the canvas back buffer relative to the CSS-defined size of the canvas.
     *
     * This is a common way to trade off rendering quality for speed. If the canvas size is defined in CSS, then
     * setting this to a value between ````[0..1]```` (eg ````0.5````) will render into a smaller back buffer, giving
     * a performance boost.
     *
     * @param resolutionScale The resolution scale.
     */
    set resolutionScale(resolutionScale: number) {
        resolutionScale = resolutionScale || 1.0;
        if (resolutionScale === this.#resolutionScale) {
            return;
        }
        this.#resolutionScale = resolutionScale;
        const canvas = this.canvas;
        canvas.width = Math.round(canvas.clientWidth * this.#resolutionScale);
        canvas.height = Math.round(canvas.clientHeight * this.#resolutionScale);
        this.view.redraw();
    }

    /**
     * @private
     */
    destroy() {
        this.view.viewer.onTick.unsubscribe(this.#onTick);
        super.destroy();
    }
}

export {Canvas};