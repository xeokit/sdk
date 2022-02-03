import * as math from '../math';
import {Component} from '../Component';
import {View} from "./View";

/**
 * @desc Manages the HTML canvas belonging to a {@link View}.
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

    #onTick: number;
    #backgroundColor: math.FloatArrayType;
    #backgroundColorFromAmbientLight: boolean;

    /**
     * @private
     */
    constructor(view: View, cfg: {
        canvas: HTMLCanvasElement;
        transparent: boolean;
        backgroundColorFromAmbientLight: boolean;
        backgroundColor: number[],
        premultipliedAlpha: boolean
    }) {

        super(view, cfg);

        this.#backgroundColor = math.vec3([
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

        this.#initWebGPU();

        // Publish canvas size and position changes on each scene tick

        let lastWindowWidth = 0;
        let lastWindowHeight = 0;
        let lastCanvasWidth = 0;
        let lastCanvasHeight = 0;
        let lastCanvasOffsetLeft = 0;
        let lastCanvasOffsetTop = 0;
        let lastParent: HTMLElement = null;

        this.#onTick = this.viewer.events.on("tick", () => {
            const canvas = this.canvas;
            const newWindowSize = (window.innerWidth !== lastWindowWidth || window.innerHeight !== lastWindowHeight);
            const newCanvasSize = (canvas.clientWidth !== lastCanvasWidth || canvas.clientHeight !== lastCanvasHeight);
            const newCanvasPos = (canvas.offsetLeft !== lastCanvasOffsetLeft || canvas.offsetTop !== lastCanvasOffsetTop);
            const parent = canvas.parentElement;
            const newParent = (parent !== lastParent);
            if (newWindowSize || newCanvasSize || newCanvasPos || newParent) {
                if (newCanvasSize || newCanvasPos) {
                    const newWidth = canvas.clientWidth;
                    const newHeight = canvas.clientHeight;
                    if (newCanvasSize) {
                        canvas.width = canvas.clientWidth;
                        canvas.height = canvas.clientHeight;
                    }
                    const boundary = this.boundary;
                    boundary[0] = canvas.offsetLeft;
                    boundary[1] = canvas.offsetTop;
                    boundary[2] = newWidth;
                    boundary[3] = newHeight;
                    this.events.fire("boundary", boundary);
                    lastCanvasWidth = newWidth;
                    lastCanvasHeight = newHeight;
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
    get backgroundColor(): math.FloatArrayType {
        return this.#backgroundColor;
    }

    /**
     * Sets the canvas clear color.
     *
     * Default value is ````[1, 1, 1]````.
     */
    set backgroundColor(value: math.FloatArrayType) {
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

    #initWebGPU() {
    }

    /**
     * @private
     */
    destroy() {
        this.viewer.events.off(this.#onTick);
        super.destroy();
    }
}

export {Canvas};