import {core} from "../core.js";
import {math} from '../math/';
import {Component} from '../Component.js';
import {Spinner} from './Spinner.js';

/**
 * @desc Manages its {@link Scene}'s HTML canvas.
 *
 * * Provides the HTML canvas element in {@link Canvas#canvas}.
 * * Has a {@link Spinner}, provided at {@link Canvas#spinner}, which manages the loading progress indicator.
 */
class Canvas extends Component {

    /**
     @private
     */
    get type() {
        return "Canvas";
    }

    /**
     * @constructor
     * @private
     */
    constructor(owner, cfg = {}) {

        super(owner, cfg);

        this._backgroundColor = math.vec3([
            cfg.backgroundColor ? cfg.backgroundColor[0] : 1,
            cfg.backgroundColor ? cfg.backgroundColor[1] : 1,
            cfg.backgroundColor ? cfg.backgroundColor[2] : 1]);
        this._backgroundColorFromAmbientLight = !!cfg.backgroundColorFromAmbientLight;

        /**
         * The HTML canvas.
         *
         * @property canvas
         * @type {HTMLCanvasElement}
         * @final
         */
        this.canvas = cfg.canvas;

        /**
         * Indicates if this Canvas is transparent.
         *
         * @property transparent
         * @type {Boolean}
         * @default {false}
         * @final
         */
        this.transparent = !!cfg.transparent;

        // /**
        //  * Attributes for the WebGL context
        //  *
        //  * @type {{}|*}
        //  */
        // this.contextAttr = cfg.contextAttr || {};
        // this.contextAttr.alpha = this.transparent;
        //
        // this.contextAttr.preserveDrawingBuffer = !!this.contextAttr.preserveDrawingBuffer;
        // this.contextAttr.stencil = false;
        // this.contextAttr.premultipliedAlpha = (!!this.contextAttr.premultipliedAlpha);  // False by default: https://github.com/xeokit/xeokit-sdk/issues/251
        // this.contextAttr.antialias = (this.contextAttr.antialias !== false);

        // If the canvas uses css styles to specify the sizes make sure the basic
        // width and height attributes match or the WebGL context will use 300 x 150

        this.canvas.width = this.canvas.clientWidth;
        this.canvas.height = this.canvas.clientHeight;

        /**
         * Boundary of the Canvas in absolute browser window coordinates.
         *
         * ### Usage:
         *
         * ````javascript
         * var boundary = myScene.canvas.boundary;
         *
         * var xmin = boundary[0];
         * var ymin = boundary[1];
         * var width = boundary[2];
         * var height = boundary[3];
         * ````
         *
         * @property boundary
         * @type {{Number[]}}
         * @final
         */
        this.boundary = [
            this.canvas.offsetLeft, this.canvas.offsetTop,
            this.canvas.clientWidth, this.canvas.clientHeight
        ];

        this._initWebGPU(cfg);

        // Publish canvas size and position changes on each scene tick

        let lastWindowWidth = null;
        let lastWindowHeight = null;

        let lastCanvasWidth = null;
        let lastCanvasHeight = null;

        let lastCanvasOffsetLeft = null;
        let lastCanvasOffsetTop = null;

        let lastParent = null;

        this._tick = this.scene.on("tick", () =>{

            const canvas = self.canvas;

            const newWindowSize = (window.innerWidth !== lastWindowWidth || window.innerHeight !== lastWindowHeight);
            const newCanvasSize = (canvas.clientWidth !== lastCanvasWidth || canvas.clientHeight !== lastCanvasHeight);
            const newCanvasPos = (canvas.offsetLeft !== lastCanvasOffsetLeft || canvas.offsetTop !== lastCanvasOffsetTop);

            const parent = canvas.parentElement;
            const newParent = (parent !== lastParent);

            if (newWindowSize || newCanvasSize || newCanvasPos || newParent) {

                this._spinner._adjustPosition();

                if (newCanvasSize || newCanvasPos) {

                    const newWidth = canvas.clientWidth;
                    const newHeight = canvas.clientHeight;

                    // TODO: Wasteful to re-count pixel size of each canvas on each canvas' resize
                    if (newCanvasSize) {
                        let countPixels = 0;
                        let scene;
                        for (const sceneId in core.scenes) {
                            if (core.scenes.hasOwnProperty(sceneId)) {
                                scene = core.scenes[sceneId];
                                countPixels += scene.canvas.canvas.clientWidth * scene.canvas.canvas.clientHeight;
                            }
                        }

                        canvas.width = canvas.clientWidth;
                        canvas.height = canvas.clientHeight;
                    }

                    const boundary = self.boundary;

                    boundary[0] = canvas.offsetLeft;
                    boundary[1] = canvas.offsetTop;
                    boundary[2] = newWidth;
                    boundary[3] = newHeight;

                    /**
                     * Fired whenever this Canvas's {@link Canvas/boundary} property changes.
                     *
                     * @event boundary
                     * @param value The property's new value
                     */
                    this.fire("boundary", boundary);

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

        this._spinner = new Spinner(this.scene, {
            canvas: this.canvas,
            elementId: cfg.spinnerElementId
        });
    }

    /**
     * Creates a default canvas in the DOM.
     * @private
     */
    _createCanvas() {

        const canvasId = "xeokit-canvas-" + math.createUUID();
        const body = document.getElementsByTagName("body")[0];
        const div = document.createElement('div');

        const style = div.style;
        style.height = "100%";
        style.width = "100%";
        style.padding = "0";
        style.margin = "0";
        style.background = "rgba(0,0,0,0);";
        style.float = "left";
        style.left = "0";
        style.top = "0";
        style.position = "absolute";
        style.opacity = "1.0";
        style["z-index"] = "-10000";

        div.innerHTML += '<canvas id="' + canvasId + '" style="width: 100%; height: 100%; float: left; margin: 0; padding: 0;"></canvas>';

        body.appendChild(div);

        this.canvas = document.getElementById(canvasId);
    }

    _getElementXY(e) {
        let x = 0, y = 0;
        while (e) {
            x += (e.offsetLeft - e.scrollLeft);
            y += (e.offsetTop - e.scrollTop);
            e = e.offsetParent;
        }
        return {x: x, y: y};
    }

    /**
     * Initialises the WebGPU context
     * @private
     */
    _initWebGPU() {

    }

    /**
     * Sets if the canvas background color is derived from an {@link AmbientLight}.
     *
     * This only has effect when the canvas is not transparent. When not enabled, the background color
     * will be the canvas element's HTML/CSS background color.
     *
     * Default value is ````true````.
     *
     * @type {Boolean}
     */
    set backgroundColorFromAmbientLight(backgroundColorFromAmbientLight) {
        this._backgroundColorFromAmbientLight = (backgroundColorFromAmbientLight !== false);
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
     *
     * @type {Boolean}
     */
    get backgroundColorFromAmbientLight() {
        return this._backgroundColorFromAmbientLight;
    }

    /**
     * Sets the canvas clear color.
     *
     * Default value is ````[1, 1, 1]````.
     *
     * @type {Number[]}
     */
    set backgroundColor(value) {
        if (value) {
            this._backgroundColor[0] = value[0];
            this._backgroundColor[1] = value[1];
            this._backgroundColor[2] = value[2];
        } else {
            this._backgroundColor[0] = 1.0;
            this._backgroundColor[1] = 1.0;
            this._backgroundColor[2] = 1.0;
        }
        this.redraw();
    }

    /**
     * Gets the canvas clear color.
     *
     * Default value is ````[1, 1, 1]````.
     *
     * @type {Number[]}
     */
    get backgroundColor() {
        return this._backgroundColor;
    }

    /**
     * @private
     * @deprecated
     */
    getSnapshot(params) {
        throw "Canvas#getSnapshot() has been replaced by Viewer#getSnapshot() - use that method instead.";
    }

    /**
     * Reads colors of pixels from the last rendered frame.
     *
     * Call this method like this:
     *
     * ````JavaScript
     *
     * // Ignore transparent pixels (default is false)
     * var opaqueOnly = true;
     *
     * var colors = new Float32Array(8);
     *
     * viewer.scene.canvas.readPixels([ 100, 22, 12, 33 ], colors, 2, opaqueOnly);
     * ````
     *
     * Then the r,g,b components of the colors will be set to the colors at those pixels.
     *
     * @param {Number[]} pixels
     * @param {Number[]} colors
     * @param {Number} size
     * @param {Boolean} opaqueOnly
     */
    readPixels(pixels, colors, size, opaqueOnly) {
        return this.scene._renderer.readPixels(pixels, colors, size, opaqueOnly);
    }

    /**
     * The busy {@link Spinner} for this Canvas.
     *
     * @property spinner
     * @type Spinner
     * @final
     */
    get spinner() {
        return this._spinner;
    }

    destroy() {
        this.scene.off(this._tick);
        this._spinner._destroy();
        super.destroy();
    }
}

export {Canvas};