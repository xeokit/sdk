/**
 * @desc A **View** defines XXX.
 */
import {Component} from '../Component.js';
import {Camera} from "../camera/Camera.js";
import {Viewport} from "../viewport/Viewport.js";
import {Canvas} from "../canvas/Canvas.js";
import {CameraControl} from "../CameraControl/CameraControl.js";
import {Input} from "../input/Input.js";
import {CameraFlightAnimation} from "../camera/CameraFlightAnimation.js";

class View extends Component {

    /**
     * @private
     */
    constructor(owner, cfg = {}) {

        super(owner, cfg);

        const canvas = cfg.canvasElement || document.getElementById(cfg.canvasId);

        if (!(canvas instanceof HTMLCanvasElement)) {
            throw "Mandatory View config expected: valid canvasId or canvasElement";
        }

        this._transparent = (!!cfg.transparent);
        this._alphaDepthMask = (!!cfg.alphaDepthMask);

        /**
         * Manages the 2D viewpoint for this View.
         * @property viewport
         * @type {Viewport}
         * @final
         */
        this.viewport = new Viewport(this, {
            autoBoundary: true
        });

        /**
         * Manages the Camera for this View.
         * @property camera
         * @type {Camera}
         * @final
         */
        this.camera = new Camera(this, {});

        /**
         * Manages the HTML5 canvas for this View.
         * @property canvas
         * @type {Canvas}
         * @final
         */
        this.canvas = new Canvas(this, {
            canvas: cfg.canvas,
            spinnerElementId: cfg.spinnerElementId,
            transparent: cfg.transparent,
            contextAttr: cfg.contextAttr || {},
            backgroundColor: cfg.backgroundColor,
            backgroundColorFromAmbientLight: cfg.backgroundColorFromAmbientLight,
            premultipliedAlpha: cfg.premultipliedAlpha
        });

        this.canvas.on("boundary", () => {
            this.redraw();
        });

        /**
         * The {@link CameraControl} which controls the View's {@link Camera} with mouse, touch and keyboard input.
         * @property cameraControl
         * @type {CameraControl}
         * @final
         */
        this.cameraControl = new CameraControl(this.scene, {
            doublePickFlyTo: true
        });

        /**
         * Publishes input events that occur on this View.
         *
         * @property input
         * @type {Input}
         * @final
         */
        this.input = new Input(this, {
            dontClear: true,
            element: this.canvas.canvas
        });

        /**
         * The View's {@link CameraFlightAnimation}, which is used to fly the {@link Camera} to given targets.
         * @property cameraFlight
         * @type {CameraFlightAnimation}
         */
        this.cameraFlight = new CameraFlightAnimation(this.scene, {
            duration: 0.5
        });

        const device = this.scene._renderer.device;
        const adapter = this.scene._renderer.adapter;

        this._context = this._canvas.getContext('webgpu');

        const devicePixelRatio = window.devicePixelRatio || 1;
        const presentationSize = [cfg.canvas.clientWidth * devicePixelRatio, cfg.canvas.clientHeight * devicePixelRatio];
        const presentationFormat = this._context.getPreferredFormat(adapter);

        this._context.configure({device, format: presentationFormat, size: presentationSize});

        this._swapChainFormat = 'bgra8unorm';

        this._swapChain = this._context.configureSwapChain({device, format: this._swapChainFormat});

        this.scene._renderer.addView(this.id, this);
    }

    /**
     * @private
     */
    destroy() {
        super.destroy();
        this.scene._renderer.removeView(this.id);
    }
}

export {View};
