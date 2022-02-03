import {Component} from "../../Component"
import {CameraFlightAnimation} from "./CameraFlightAnimation.js"
import {CameraPath} from "./CameraPath";
import {Camera} from "./Camera";
import {View} from "../View";

/**
 * @desc Animates the {@link Scene}'s's {@link Camera} along a {@link CameraPath}.
 *
 * ## Usage
 *
 * In the example below, we'll load a model using a {@link XKTLoaderPlugin}, then animate a {@link Camera}
 * through the frames in a {@link CameraPath}.
 *
 *  * [[Run this example](http://xeokit.github.io/xeokit-sdk/examples/#camera_CameraPathAnimation)]
 *
 * ````Javascript
 * import {Viewer, XKTLoaderPlugin, CameraPath, CameraPathAnimation} from "xeokit-webgpu-sdk.es.js";
 *
 * // Create a Viewer and arrange camera
 *
 * const viewer = new Viewer();
 *
 * const view = new View(viewer, {
 *      canvasId: "myCanvas1"
 * });
 *
 * view.camera.eye = [124.86756896972656, -93.50288391113281, 173.2632598876953];
 * view.camera.look = [102.14186096191406, -90.24193572998047, 173.4224395751953];
 * view.camera.up = [0.23516440391540527, 0.9719591736793518, -0.0016466031083837152];
 *
 * // Load model
 *
 * const xktLoader = new XKTLoaderPlugin(viewer);
 *
 * const model = xktLoader.load({
 *     id: "myModel",
 *     src: "../assets/models/xkt/v8/ifc/OTCConferenceCenter.ifc.xkt",
 *     edges: true,
 *     edgeThreshold: 20,
 *     xrayed: false
 * });
 *
 * // Create a CameraPath
 *
 * var cameraPath = new CameraPath(view.scene, {
 *     frames: [
 *         {
 *             t:    0,
 *             eye:  [124.86, -93.50, 173.26],
 *             look: [102.14, -90.24, 173.42],
 *             up:   [0.23, 0.97, -0.00]
 *         },
 *         {
 *             t:    1,
 *             eye:  [79.75, -85.98, 226.57],
 *             look: [99.24, -84.11, 238.56],
 *             up:   [-0.14, 0.98, -0.09]
 *         },
 *         // Rest of the frames omitted for brevity
 *     ]
 * });
 *
 * // Create a CameraPathAnimation to play our CameraPath
 *
 * var cameraPathAnimation = new CameraPathAnimation(view.scene, {
 *     cameraPath: cameraPath,
 *     playingRate: 0.2 // Playing 0.2 time units per second
 * });
 *
 * // Once model loaded, start playing after a couple of seconds delay
 *
 * model.on("loaded", function () {
 *     setTimeout(function () {
 *         cameraPathAnimation.play(0); // Play from the beginning of the CameraPath
 *     }, 2000);
 * });
 * ````
 */
class CameraPathAnimation extends Component {
     #cameraFlightAnimation: CameraFlightAnimation;
     #t: number;
     state: any;
     static SCRUBBING: any;
     #playingFromT: number;
     #playingToT: number;
     #playingRate: any;
     #playingDir: number;
     #lastTime: number;
     #cameraPath: CameraPath;
     #tick:number;

    public static PLAYING: any;


    /**
     * @constructor
     * @param {Component} [owner]  Owner component. When destroyed, the owner will destroy this CameraPathAnimation as well.
     * @param view
     * @param cfg Configuration
     * @param [cfg.id]  Optional ID, unique among all components in the parent {@link Scene}, generated automatically when omitted.
     * @param {CameraPath} [cfg.eyeCurve] A {@link CameraPath} that defines the path of a {@link Camera}.
     */
    constructor(owner:Component, view:View,cfg:any = {}) {

        super(owner, cfg);

        this.#cameraFlightAnimation = new CameraFlightAnimation(view);
        this.#t = 0;
        this.state = CameraPathAnimation.SCRUBBING;
        this.#playingFromT = 0;
        this.#playingToT = 0;
        this.#playingRate = cfg.playingRate || 1.0;
        this.#playingDir = 1.0;
        this.#lastTime = null;

        this.cameraPath = cfg.cameraPath;

        this.#tick = view.viewer.events.on("tick", this.#updateT, this);
    }

    #updateT() {
        const cameraPath = this.#cameraPath;
        if (!cameraPath) {
            return;
        }
        const f = 0.002;
        let numFrames;
        let t;
        const time = performance.now();
        const elapsedSecs = (this.#lastTime) ? (time - this.#lastTime) * 0.001 : 0;
        this.#lastTime = time;
        if (elapsedSecs === 0) {
            return;
        }
        switch (this.state) {
            case CameraPathAnimation.SCRUBBING:
                return;
            case CameraPathAnimation.PLAYING:
                this.#t += this.#playingRate * elapsedSecs;
                numFrames = this.#cameraPath.frames.length;
                if (numFrames === 0 || (this.#playingDir < 0 && this.#t <= 0) || (this.#playingDir > 0 && this.#t >= this.#cameraPath.frames[numFrames - 1].t)) {
                    this.state = CameraPathAnimation.SCRUBBING;
                    this.#t = this.#cameraPath.frames[numFrames - 1].t;
                    this.events.fire("stopped", true);
                    return;
                }
                cameraPath.loadFrame(this.#t);
                break;
            case CameraPathAnimation.PLAYING_TO:
                t = this.#t + (this.#playingRate * elapsedSecs * this.#playingDir);
                if ((this.#playingDir < 0 && t <= this.#playingToT) || (this.#playingDir > 0 && t >= this.#playingToT)) {
                    t = this.#playingToT;
                    this.state = CameraPathAnimation.SCRUBBING;
                    this.events.fire("stopped", {});
                }
                this.#t = t;
                cameraPath.loadFrame(this.#t);
                break;
        }
    }

    /*
    * @private
     */
    #ease(t, b, c, d) {
        t /= d;
        return -c * t * (t - 2) + b;
    }

    /**
     * Sets the {@link CameraPath} animated by this CameraPathAnimation.
     *
     @param {CameraPath} value The new CameraPath.
     */
    set cameraPath(value) {
        this.#cameraPath = value;
    }

    /**
     * Gets the {@link CameraPath} animated by this CameraPathAnimation.
     *
     @returns {CameraPath} The CameraPath.
     */
    get cameraPath() {
        return this.#cameraPath;
    }

    /**
     * Sets the rate at which the CameraPathAnimation animates the {@link Camera} along the {@link CameraPath}.
     *
     *  @param value The amount of progress per second.
     */
    set rate(value) {
        this.#playingRate = value;
    }

    /**
     * Gets the rate at which the CameraPathAnimation animates the {@link Camera} along the {@link CameraPath}.
     *
     * @returns {*|number} The current playing rate.
     */
    get rate() {
        return this.#playingRate;
    }

    /**
     * Begins animating the {@link Camera} along CameraPathAnimation's {@link CameraPath} from the beginning.
     */
    play() {
        if (!this.#cameraPath) {
            return;
        }
        this.#lastTime = null;
        this.state = CameraPathAnimation.PLAYING;
    }

    /**
     * Begins animating the {@link Camera} along CameraPathAnimation's {@link CameraPath} from the given time.
     *
     * @param t Time instant.
     */
    playToT(t) {
        const cameraPath = this.#cameraPath;
        if (!cameraPath) {
            return;
        }
        this.#playingFromT = this.#t;
        this.#playingToT = t;
        this.#playingDir = (this.#playingToT - this.#playingFromT) < 0 ? -1 : 1;
        this.#lastTime = null;
        this.state = CameraPathAnimation.PLAYING_TO;
    }

    /**
     * Animates the {@link Camera} along CameraPathAnimation's {@link CameraPath} to the given frame.
     *
     * @param frameIdx Index of the frame to play to.
     */
    playToFrame(frameIdx) {
        const cameraPath = this.#cameraPath;
        if (!cameraPath) {
            return;
        }
        const frame = cameraPath.frames[frameIdx];
        if (!frame) {
            this.error("playToFrame - frame index out of range: " + frameIdx);
            return;
        }
        this.playToT(frame.t);
    }

    /**
     * Flies the {@link Camera} directly to the given frame on the CameraPathAnimation's {@link CameraPath}.
     *
     * @param frameIdx Index of the frame to play to.
     * @param {Function} [ok] Callback to fire when playing is complete.
     */
    flyToFrame(frameIdx:number, ok: { (): void; call: (arg0: any) => void; }) {
        const cameraPath = this.#cameraPath;
        if (!cameraPath) {
            return;
        }
        const frame = cameraPath.frames[frameIdx];
        if (!frame) {
            this.error("flyToFrame - frame index out of range: " + frameIdx);
            return;
        }
        this.state = CameraPathAnimation.SCRUBBING;
        this.#cameraFlightAnimation.flyTo(frame, ok);
    }

    /**
     * Scrubs the {@link Camera} to the given time on the CameraPathAnimation's {@link CameraPath}.
     *
     * @param t Time instant.
     */
    scrubToT(t) {
        const cameraPath = this.#cameraPath;
        if (!cameraPath) {
            return;
        }
        const camera = this.scene.camera;
        if (!camera) {
            return;
        }
        this.#t = t;
        cameraPath.loadFrame(this.#t, this.#view.camera);
        this.state = CameraPathAnimation.SCRUBBING;
    }

    /**
     * Scrubs the {@link Camera} to the given frame on the CameraPathAnimation's {@link CameraPath}.
     *
     * @param frameIdx Index of the frame to scrub to.
     */
    scrubToFrame(frameIdx) {
        const cameraPath = this.#cameraPath;
        if (!cameraPath) {
            return;
        }
        const camera = this.scene.camera;
        if (!camera) {
            return;
        }
        const frame = cameraPath.frames[frameIdx];
        if (!frame) {
            this.error("playToFrame - frame index out of range: " + frameIdx);
            return;
        }
        cameraPath.loadFrame(this.#t);
        this.state = CameraPathAnimation.SCRUBBING;
    }

    /**
     * Stops playing this CameraPathAnimation.
     */
    stop() {
        this.state = CameraPathAnimation.SCRUBBING;
        this.events.fire("stopped");
    }

    destroy() {
        super.destroy();
        this.scene.off(this.#tick);
    }
}

CameraPathAnimation.STOPPED = 0;
CameraPathAnimation.SCRUBBING = 1;
CameraPathAnimation.PLAYING = 2;
CameraPathAnimation.PLAYING_TO = 3;

export {CameraPathAnimation}