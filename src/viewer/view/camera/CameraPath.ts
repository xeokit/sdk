import {Component} from "../../Component"
import {SplineCurve} from "../../paths/"
import * as math from "../../math";
import {Camera} from "./Camera";

const tempVec3a = math.vec3();

/**
 * Defines a sequence of frames along which a {@link CameraPathAnimation} can animate a {@link Camera}.
 */
class CameraPath extends Component {

    #frames: { t: number, eye: math.FloatArrayType, look: math.FloatArrayType, up: math.FloatArrayType }[];
    #eyeCurve: SplineCurve;
    #lookCurve: SplineCurve;
    #upCurve: SplineCurve;


    /**
     * @constructor
     * @param {Component} [view]  Owner component. When destroyed, the owner will destroy this CameraPath as well.
     * @param cfg {*} Configuration
     * @param [cfg.id]  Optional ID, unique among all components in the parent {@link Scene}, generated automatically when omitted.
     * @param {{t:Number, eye:Object, look:Object, up: Object}[]} [cfg.frames] Initial sequence of frames.
     */
    constructor(owner:Component, cfg: {
        frames: { t: number, eye: math.FloatArrayType, look: math.FloatArrayType, up: math.FloatArrayType }[]
    } = {
        frames: []
    }) {

        super(owner, cfg);

        this.#frames = [];

        this.#eyeCurve = new SplineCurve(this);
        this.#lookCurve = new SplineCurve(this);
        this.#upCurve = new SplineCurve(this);

        if (cfg.frames) {
            this.addFrames(cfg.frames);
            this.smoothFrameTimes(1);
        }
    }

    /**
     * Gets the camera frames in this CameraPath.
     *
     * @returns {{t:Number, eye:Object, look:Object, up: Object}[]} The frames on this CameraPath.
     */
    get frames(): { t: number, eye: math.FloatArrayType, look: math.FloatArrayType, up: math.FloatArrayType }[] {
        return this.#frames;
    }

    /**
     * Gets the {@link SplineCurve} along which {@link Camera.eye} travels.
     * @returns {SplineCurve} The SplineCurve for {@link Camera.eye}.
     */
    get eyeCurve(): SplineCurve {
        return this.#eyeCurve;
    }

    /**
     * Gets the {@link SplineCurve} along which {@link Camera.look} travels.
     * @returns {SplineCurve} The SplineCurve for {@link Camera#look}.
     */
    get lookCurve(): SplineCurve {
        return this.#lookCurve;
    }

    /**
     * Gets the {@link SplineCurve} along which {@link Camera#up} travels.
     * @returns {SplineCurve} The SplineCurve for {@link Camera#up}.
     */
    get upCurve(): SplineCurve {
        return this.#upCurve;
    }

    /**
     * Adds a frame to this CameraPath, given as the current position of the {@link Camera}.
     *
     * @param t Time instant for the new frame.
     * @param {Camera} camera
     */
    saveFrame(t: number, camera: Camera): void {
        this.addFrame(t, camera.eye, camera.look, camera.up);
    }

    /**
     * Adds a frame to this CameraPath, specified as values for eye, look and up vectors at a given time instant.
     *
     * @param t Time instant for the new frame.
     * @param eye A three-element vector specifying the eye position for the new frame.
     * @param look A three-element vector specifying the look position for the new frame.
     * @param up A three-element vector specifying the up vector for the new frame.
     */
    addFrame(t: number, eye: math.FloatArrayType, look: math.FloatArrayType, up: math.FloatArrayType): void {
        const frame = {
            t: t,
            eye: eye.slice(0),
            look: look.slice(0),
            up: up.slice(0)
        };
        this.#frames.push(frame);
        this.#eyeCurve.points.push(frame.eye);
        this.#lookCurve.points.push(frame.look);
        this.#upCurve.points.push(frame.up);
    }

    /**
     * Adds multiple frames to this CameraPath, each frame specified as a set of values for eye, look and up vectors at a given time instant.
     *
     * @param {{t:Number, eye:Object, look:Object, up: Object}[]} frames Frames to add to this CameraPath.
     */
    addFrames(frames: { t: number, eye: math.FloatArrayType, look: math.FloatArrayType, up: math.FloatArrayType }[]): void {
        let frame;
        for (let i = 0, len = frames.length; i < len; i++) {
            frame = frames[i];
            this.addFrame(frame.t || 0, frame.eye, frame.look, frame.up);
        }
    }

    /**
     * Sets the position of the {@link Camera} to a position interpolated within this CameraPath at the given time instant.
     *
     * @param t Time instant.
     * @param {Camera} camera
     */
    loadFrame(t: number, camera: Camera): void {

        t = t / (this.#frames[this.#frames.length - 1].t - this.#frames[0].t);
        t = t < 0.0 ? 0.0 : (t > 1.0 ? 1.0 : t);

        camera.eye = this.#eyeCurve.getPoint(t, tempVec3a);
        camera.look = this.#lookCurve.getPoint(t, tempVec3a);
        camera.up = this.#upCurve.getPoint(t, tempVec3a);
    }

    /**
     * Gets eye, look and up vectors on this CameraPath at a given instant.
     *
     * @param t Time instant.
     * @param eye The eye position to update.
     * @param look The look position to update.
     * @param up The up vector to update.
     */
    sampleFrame(t: number, eye: math.FloatArrayType, look: math.FloatArrayType, up: math.FloatArrayType): void {
        t = t < 0.0 ? 0.0 : (t > 1.0 ? 1.0 : t);
        this.#eyeCurve.getPoint(t, eye);
        this.#lookCurve.getPoint(t, look);
        this.#upCurve.getPoint(t, up);
    }

    /**
     * Given a total duration (in seconds) for this CameraPath, recomputes the time instant at each frame so that,
     * when animated by {@link CameraPathAnimation}, the {@link Camera} will move along the path at a constant rate.
     *
     * @param duration The total duration for this CameraPath.
     */
    smoothFrameTimes(duration: number): void {
        const numFrames = this.#frames.length;
        if (numFrames === 0) {
            return;
        }
        const vec = math.vec3();
        var totalLen = 0;
        this.#frames[0].t = 0;
        const lens = [];
        for (let i = 1, len = this.#frames.length; i < len; i++) {
            var lenVec = math.lenVec3(math.subVec3(this.#frames[i].eye, this.#frames[i - 1].eye, vec));
            lens[i] = lenVec;
            totalLen += lenVec;
        }
        for (let i = 1, len = this.#frames.length; i < len; i++) {
            const interFrameRate = (lens[i] / totalLen) * duration;
            this.#frames[i].t = this.#frames[i - 1].t + interFrameRate;
        }
    }

    /**
     * Removes all frames from this CameraPath.
     */
    clearFrames(): void {
        this.#frames = [];
        this.#eyeCurve.points = [];
        this.#lookCurve.points = [];
        this.#upCurve.points = [];
    }
}

export {CameraPath}