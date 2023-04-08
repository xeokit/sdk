import {EventDispatcher} from "strongly-typed-events";


import {scheduler} from './scheduler';
import type {View} from "./View";
import type {Camera} from "./Camera";
import {addVec3, lenVec3, lerpMat4, lerpVec3, mulVec3Scalar, normalizeVec3, subVec3, createVec3} from "@xeokit/math/matrix";
import {Component, EventEmitter} from "@xeokit/core/components";
import {DEGTORAD, FloatArrayParam} from "@xeokit/math/math";
import {getAABB3Center, getAABB3Diag, getAABB3DiagPoint} from "@xeokit/math/boundaries";
import {CustomProjectionType, OrthoProjectionType, PerspectiveProjectionType} from "@xeokit/core/constants";

const tempVec3 = createVec3();
const newLook = createVec3();
const newEye = createVec3();
const newUp = createVec3();
const newLookEyeVec = createVec3();

/**
 * Animates its {@link View |View's} {@link @xeokit/viewer!Camera}  to look at specified objects, boundaries or locations.
 *
 * ## Summary
 *
 * * Belongs to a {@link @xeokit/viewer!View}, and is located at {@link View.cameraFlight}
 * * Controls the View's {@link @xeokit/viewer!Camera} , which is located at {@link View.camera}
 * * Navigates the Camera to look at a {@link ViewerObject} or boundary
 * * Navigates the Camera to an explicit position given as ````eye````, ````look```` and ````up```` vectors
 * * Jumps or flies the Camera
 * * Smoothly transitions between projections
 */
class CameraFlightAnimation extends Component {

    /**
     * The View that owns this CameraFlightAnimation.
     */
    public readonly view: View;

    /**
     * The Camera controlled by this CameraFlightAnimation.
     */
    public readonly camera: Camera;

    #duration: number;
    #look1: FloatArrayParam;
    #eye1: FloatArrayParam;
    #up1: FloatArrayParam;
    #look2: FloatArrayParam;
    #eye2: FloatArrayParam;
    #up2: FloatArrayParam;
    #orthoScale1: number;
    #orthoScale2: number;
    #fit: boolean;
    #trail: boolean;
    #flying: boolean;
    #flyEyeLookUp: boolean;
    #flyingEye: boolean;
    #flyingLook: boolean;
    #callback: any;
    #callbackScope: any;
    #time1: number | null;
    #time2: number | null;
    easing: boolean;
    #flyingEyeLookUp: boolean;
    #fitFOV: number;
    #projection2: number;
    #projMatrix1: FloatArrayParam;
    #projMatrix2: FloatArrayParam;


    /**
     * Emits an event each time the animation starts.
     *
     * @event
     */
    readonly onStarted: EventEmitter<CameraFlightAnimation, null>;

    /**
     * Emits an event each time the animation stops.
     *
     * @event
     */
    readonly onStopped: EventEmitter<CameraFlightAnimation, null>;

    /**
     * Emits an event each time the animation stops.
     *
     * @event
     */
    readonly onCancelled: EventEmitter<CameraFlightAnimation, null>;

    /**
     @private
     */
    constructor(view: View, cfg?: {
        duration: number
    }) {

        super(view, cfg);

        this.view = view;
        this.camera = view.camera;

        this.#look1 = createVec3();
        this.#eye1 = createVec3();
        this.#up1 = createVec3();
        this.#look2 = createVec3();
        this.#eye2 = createVec3();
        this.#up2 = createVec3();
        this.#orthoScale1 = 1;
        this.#orthoScale2 = 1;
        this.#flying = false;
        this.#flyEyeLookUp = false;
        this.#flyingEye = false;
        this.#flyingLook = false;
        this.#callback = null;
        this.#callbackScope = null;
        this.#time1 = null;
        this.#time2 = null;
        this.easing = true;
        this.#trail = false;
        this.#fit = true;
        this.#duration = 500;

        this.onStarted = new EventEmitter(new EventDispatcher<CameraFlightAnimation, null>());
        this.onStopped = new EventEmitter(new EventDispatcher<CameraFlightAnimation, null>());
        this.onCancelled = new EventEmitter(new EventDispatcher<CameraFlightAnimation, null>());
    }

    /**
     * Flies the {@link @xeokit/viewer!Camera}  to a target.
     *
     *  * When the target is a boundary, the {@link @xeokit/viewer!Camera}  will fly towards the target and stop when the target fills most of the canvas.
     *  * When the target is an explicit {@link @xeokit/viewer!Camera}  position, given as ````eye````, ````look```` and ````up````, then CameraFlightAnimation will interpolate the {@link @xeokit/viewer!Camera}  to that target and stop there.
     *
     * @param {Object|Component} [params=Scene] Either a parameters object or a {@link @xeokit/core/components!Component} subtype that has
     * an AABB. Defaults to the {@link Scene}, which causes the {@link @xeokit/viewer!Camera}  to fit the Scene in view.
     * @param [params.arc=0] Factor in range ````[0..1]```` indicating how much the {@link Camera.eye} position
     * will swing away from its {@link Camera.look} position as it flies to the target.
     * @param {Number|String|Component} [params.component] ID or instance of a component to fly to. Defaults to the entire {@link Scene}.
     * @param [params.aabb] World-space axis-aligned bounding box (AABB) target to fly to.
     * @param [params.eye] Position to fly the eye position to.
     * @param [params.look] Position to fly the look position to.
     * @param [params.up] Position to fly the up vector to.
     * @param [params.projection] Projection type to transition into as we fly. Can be any of the values of {@link Camera.projectionType}.
     * @param [params.fit=true] Whether to fit the target to the view volume. Overrides {@link CameraFlightAnimation.fit}.
     * @param [params.fitFOV] How much of field-of-view, in degrees, that a target {@link ViewerObject} or its AABB should
     * fill the canvas on arrival. Overrides {@link CameraFlightAnimation.fitFOV}.
     * @param [params.duration] Flight duration in seconds.  Overrides {@link CameraFlightAnimation.duration}.
     * @param [params.orthoScale] Animate the Camera's orthographic scale to this target value. See {@link Ortho.scale}.
     * @param {Function} [callback] Callback fired on arrival.
     * @param {Object} [scope] Optional scope for callback.
     */
    flyTo(params: {
              projection?: number;
              orthoScale?: number;
              aabb?: FloatArrayParam;
              length?: number;
              eye?: FloatArrayParam;
              look?: FloatArrayParam;
              up?: FloatArrayParam;
              poi?: FloatArrayParam;
              fitFOV?: number;
              duration?: number;
          } = {},
          callback: {
              (): void; call: (arg0: any) => void;
          }) {

        if (this.#flying) {
            this.stop();
        }

        this.#flying = false;
        this.#flyingEye = false;
        this.#flyingLook = false;
        this.#flyingEyeLookUp = false;

        this.#callback = callback;

        const camera = this.camera;
        const flyToProjection = (!!params.projection) && (params.projection !== camera.projectionType);

        this.#eye1[0] = camera.eye[0];
        this.#eye1[1] = camera.eye[1];
        this.#eye1[2] = camera.eye[2];

        this.#look1[0] = camera.look[0];
        this.#look1[1] = camera.look[1];
        this.#look1[2] = camera.look[2];

        this.#up1[0] = camera.up[0];
        this.#up1[1] = camera.up[1];
        this.#up1[2] = camera.up[2];

        this.#orthoScale1 = camera.orthoProjection.scale;
        this.#orthoScale2 = params.orthoScale || this.#orthoScale1;

        let aabb: FloatArrayParam;
        let eye: FloatArrayParam;
        let look: FloatArrayParam;
        let up: FloatArrayParam;

        if (params.aabb) {
            aabb = params.aabb;

        } else if ((params.eye && params.look) || params.up) {
            // @ts-ignore
            eye = params.eye;
            // @ts-ignore
            look = params.look;
            // @ts-ignore
            up = params.up;

        } else if (params.eye) {
            eye = params.eye;

        } else if (params.look) {
            look = params.look;

        } else {
            if (!flyToProjection) {
                aabb = this.view.aabb;
            }
        }

        const poi = params.poi;
        // @ts-ignore
        if (aabb) {

            if (aabb[3] < aabb[0] || aabb[4] < aabb[1] || aabb[5] < aabb[2]) { // Don't fly to an inverted boundary
                return;
            }

            if (aabb[3] === aabb[0] && aabb[4] === aabb[1] && aabb[5] === aabb[2]) { // Don't fly to an empty boundary
                return;
            }

            aabb = aabb.slice();
            const aabbCenter = getAABB3Center(aabb);

            this.#look2 = poi || aabbCenter;

            const eyeLookVec = subVec3(this.#eye1, this.#look1, tempVec3);
            const eyeLookVecNorm = normalizeVec3(eyeLookVec);
            const diag = poi ? getAABB3DiagPoint(aabb, poi) : getAABB3Diag(aabb);
            const fitFOV = params.fitFOV || this.#fitFOV;
            const sca = Math.abs(diag / Math.tan(fitFOV * DEGTORAD));

            this.#orthoScale2 = diag * 1.1;

            this.#eye2[0] = this.#look2[0] + (eyeLookVecNorm[0] * sca);
            this.#eye2[1] = this.#look2[1] + (eyeLookVecNorm[1] * sca);
            this.#eye2[2] = this.#look2[2] + (eyeLookVecNorm[2] * sca);

            this.#up2[0] = this.#up1[0];
            this.#up2[1] = this.#up1[1];
            this.#up2[2] = this.#up1[2];

            this.#flyingEyeLookUp = true;

            // @ts-ignore
        } else if (eye || look || up) {
            // @ts-ignore
            this.#flyingEyeLookUp = !!eye && !!look && !!up;
            // @ts-ignore
            this.#flyingEye = !!eye && !look;
            // @ts-ignore
            this.#flyingLook = !!look && !eye;
            // @ts-ignore
            if (eye) {
                this.#eye2[0] = eye[0];
                this.#eye2[1] = eye[1];
                this.#eye2[2] = eye[2];
            }
            // @ts-ignore
            if (look) {
                this.#look2[0] = look[0];
                this.#look2[1] = look[1];
                this.#look2[2] = look[2];
            }
            // @ts-ignore
            if (up) {
                this.#up2[0] = up[0];
                this.#up2[1] = up[1];
                this.#up2[2] = up[2];
            }
        }

        if (flyToProjection) {

            if (params.projection === OrthoProjectionType && camera.projectionType !== OrthoProjectionType) {
                this.#projection2 = OrthoProjectionType;
                this.#projMatrix1 = camera.projMatrix.slice();
                this.#projMatrix2 = camera.orthoProjection.projMatrix.slice();
                camera.projectionType = CustomProjectionType;
            }

            if (params.projection === PerspectiveProjectionType && camera.projectionType !== PerspectiveProjectionType) {
                this.#projection2 = PerspectiveProjectionType;
                this.#projMatrix1 = camera.projMatrix.slice();
                this.#projMatrix2 = camera.perspectiveProjection.projMatrix.slice();
                camera.projectionType = CustomProjectionType;
            }
        } else {
            // @ts-ignore
            this.#projection2 = null;
        }

        this.onStarted.dispatch(this, null);

        this.#time1 = Date.now();
        this.#time2 = this.#time1 + (params.duration ? params.duration * 1000 : this.#duration);

        this.#flying = true; // False as soon as we stop

        scheduler.scheduleTask(this.#update, this);
    }

    /**
     * Jumps the {@link @xeokit/viewer!View}'s {@link @xeokit/viewer!Camera}  to the given target.
     *
     * * When the target is a boundary, this CameraFlightAnimation will position the {@link @xeokit/viewer!Camera}  at where the target fills most of the canvas.
     * * When the target is an explicit {@link @xeokit/viewer!Camera}  position, given as ````eye````, ````look```` and ````up```` vectors, then this CameraFlightAnimation will jump the {@link @xeokit/viewer!Camera}  to that target.
     *
     * @param {*|Component} params  Either a parameters object or a {@link @xeokit/core/components!Component} subtype that has a World-space AABB.
     * @param [params.arc=0]  Factor in range [0..1] indicating how much the {@link Camera.eye} will swing away from its {@link Camera.look} as it flies to the target.
     * @param {Number|String|Component} [params.component] ID or instance of a component to fly to.
     * @param [params.aabb]  World-space axis-aligned bounding box (AABB) target to fly to.
     * @param [params.eye] Position to fly the eye position to.
     * @param [params.look]  Position to fly the look position to.
     * @param [params.up] Position to fly the up vector to.
     * @param [params.projection] Projection type to transition into. Can be any of the values of {@link Camera.projectionType}.
     * @param [params.fitFOV] How much of field-of-view, in degrees, that a target {@link ViewerObject} or its AABB should fill the canvas on arrival. Overrides {@link CameraFlightAnimation.fitFOV}.
     * @param [params.fit] Whether to fit the target to the view volume. Overrides {@link CameraFlightAnimation.fit}.
     */
    jumpTo(params: any) {
        this.#jumpTo(params);
    }

    #jumpTo(params: any) {

        if (this.#flying) {
            this.stop();
        }

        const camera = this.camera;

        let aabb: FloatArrayParam;
        let newEye: FloatArrayParam;
        let newLook: FloatArrayParam;
        let newUp: FloatArrayParam;

        if (params.aabb) { // Boundary3D
            aabb = params.aabb;
        } else if (params.eye || params.look || params.up) { // Camera pose
            newEye = params.eye;
            newLook = params.look;
            newUp = params.up;
        } else {
            aabb = this.view.aabb;
        }

        const poi = params.poi;
        // @ts-ignore
        if (aabb) {

            if (aabb[3] <= aabb[0] || aabb[4] <= aabb[1] || aabb[5] <= aabb[2]) { // Don't fly to an empty boundary
                return;
            }

            const diag = poi ? getAABB3DiagPoint(aabb, poi) : getAABB3Diag(aabb);
            // @ts-ignore
            newLook = poi || getAABB3Center(aabb, newLook);

            if (this.#trail) {
                subVec3(camera.look, newLook, newLookEyeVec);
            } else {
                subVec3(camera.eye, camera.look, newLookEyeVec);
            }

            normalizeVec3(newLookEyeVec);
            let dist;
            const fit = (params.fit !== undefined) ? params.fit : this.#fit;

            if (fit) {
                dist = Math.abs((diag) / Math.tan((params.fitFOV || this.#fitFOV) * DEGTORAD));

            } else {
                dist = lenVec3(subVec3(camera.eye, camera.look, tempVec3));
            }

            mulVec3Scalar(newLookEyeVec, dist);

            camera.eye = addVec3(newLook, newLookEyeVec, tempVec3);
            camera.look = newLook;

            this.camera.orthoProjection.scale = diag * 1.1;
            // @ts-ignore
        } else if (newEye || newLook || newUp) {
            // @ts-ignore
            if (newEye) {
                camera.eye = newEye;
            } // @ts-ignore
            if (newLook) {
                camera.look = newLook;
            } // @ts-ignore
            if (newUp) {
                camera.up = newUp;
            }
        }

        if (params.projection) {
            camera.projectionType = params.projection;
        }
    }

    #update() {
        if (!this.#flying) {
            return;
        }
        const time = Date.now();
        // @ts-ignore
        let t = (time - this.#time1) / (this.#time2 - this.#time1);
        const stopping = (t >= 1);

        if (t > 1) {
            t = 1;
        }

        const tFlight = this.easing ? CameraFlightAnimation.#ease(t, 0, 1, 1) : t;
        const camera = this.camera;

        if (this.#flyingEye || this.#flyingLook) {

            if (this.#flyingEye) {
                subVec3(camera.eye, camera.look, newLookEyeVec);
                camera.eye = lerpVec3(tFlight, 0, 1, this.#eye1, this.#eye2, newEye);
                camera.look = subVec3(newEye, newLookEyeVec, newLook);
            } else if (this.#flyingLook) {
                camera.look = lerpVec3(tFlight, 0, 1, this.#look1, this.#look2, newLook);
                camera.up = lerpVec3(tFlight, 0, 1, this.#up1, this.#up2, newUp);
            }

        } else if (this.#flyingEyeLookUp) {

            camera.eye = lerpVec3(tFlight, 0, 1, this.#eye1, this.#eye2, newEye);
            camera.look = lerpVec3(tFlight, 0, 1, this.#look1, this.#look2, newLook);
            camera.up = lerpVec3(tFlight, 0, 1, this.#up1, this.#up2, newUp);
        }

        if (this.#projection2) {
            const tProj = (this.#projection2 === OrthoProjectionType) ? CameraFlightAnimation.#easeOutExpo(t, 0, 1, 1) : CameraFlightAnimation.#easeInCubic(t, 0, 1, 1);
            camera.customProjection.projMatrix = lerpMat4(tProj, 0, 1, this.#projMatrix1, this.#projMatrix2);

        } else {
            camera.orthoProjection.scale = this.#orthoScale1 + (t * (this.#orthoScale2 - this.#orthoScale1));
        }

        if (stopping) {
            camera.orthoProjection.scale = this.#orthoScale2;
            this.stop();
            return;
        }
        scheduler.scheduleTask(this.#update, this); // Keep flying
    }

    static #ease(t: number, b: number, c: number, d: number) { // Quadratic easing out - decelerating to zero velocity http://gizma.com/easing
        t /= d;
        return -c * t * (t - 2) + b;
    }

    static #easeInCubic(t: number, b: number, c: number, d: number) {
        t /= d;
        return c * t * t * t + b;
    }

    static #easeOutExpo(t: number, b: number, c: number, d: number) {
        return c * (-Math.pow(2, -10 * t / d) + 1) + b;
    }

    /**
     * Stops an earlier {@link CameraFlightAnimation.flyTo}, fires arrival callback, then "stopped" event.
     */
    stop() {
        if (!this.#flying) {
            return;
        }
        this.#flying = false;
        this.#time1 = null;
        this.#time2 = null;
        if (this.#projection2) {
            this.camera.projectionType = this.#projection2;
        }
        const callback = this.#callback;
        if (callback) {
            this.#callback = null;
            callback();
        }
        this.onStopped.dispatch(this, null);
    }

    /**
     * Cancels a flight in progress, without calling the arrival callback.
     */
    cancel() {
        if (!this.#flying) {
            return;
        }
        this.#flying = false;
        this.#time1 = null;
        this.#time2 = null;
        if (this.#callback) {
            this.#callback = null;
        }
        this.onCancelled.dispatch(this, null);
    }

    /**
     * Sets the flight duration in seconds.
     *
     * Stops any flight currently in progress.
     *
     * Default value is ````0.5````.
     */
    set duration(value: number) {
        this.#duration = value ? (value * 1000.0) : 500;
        this.stop();
    }

    /**
     * Gets the flight duration in seconds.
     *
     * Default value is ````0.5````.
     */
    get duration(): number {
        return this.#duration / 1000.0;
    }

    /**
     * When flying to a {@link @xeokit/scene!SceneModel | SceneModel}, {@link ViewerObject} or boundary, indicates if the CameraFlightAnimation always adjusts
     * the distance of {@link Camera.eye} from {@link Camera.look} to ensure that the target always fits in view.
     *
     * When false, the eye will remain fixed at its current distance from the look position.
     *
     * Default value is ````true````.
     */
    set fit(value: boolean) {
        this.#fit = value;
    }

    /**
     * When flying to a {@link @xeokit/scene!SceneModel | SceneModel}, {@link ViewerObject} or boundary, indicates if the CameraFlightAnimation always adjusts
     * the distance of {@link Camera.eye} from {@link Camera.look} to ensure that the target always fits in view.
     *
     * When false, the eye will remain fixed at its current distance from the look position.
     *
     * Default value is ````true````.
     */
    get fit(): boolean {
        return this.#fit;
    }

    /**
     * Sets how much of the perspective field-of-view, in degrees, that a target {@link ViewerObject.aabb} should
     * fill the canvas when calling {@link CameraFlightAnimation.flyTo} or {@link CameraFlightAnimation.jumpTo}.
     *
     * Default value is ````45````.
     */
    set fitFOV(value: number) {
        this.#fitFOV = value;
    }

    /**
     * Gets how much of the perspective field-of-view, in degrees, that a target {@link ViewerObject.aabb} should
     * fill the canvas when calling {@link CameraFlightAnimation.flyTo} or {@link CameraFlightAnimation.jumpTo}.
     *
     * Default value is ````45````.
     */
    get fitFOV(): number {
        return this.#fitFOV;
    }

    /**
     * Indicates if this CameraFlightAnimation will orient the {@link @xeokit/viewer!Camera} 
     * in the direction that it is flying.
     *
     * Default value is ````false````.
     */
    set trail(value: boolean) {
        this.#trail = value;
    }

    /**
     * Indicates if this CameraFlightAnimation will orient the {@link @xeokit/viewer!Camera} 
     * in the direction that it is flying.
     *
     * Default value is ````false````.
     */
    get trail(): boolean {
        return this.#trail;
    }

    /**
     * @private
     */
    destroy() {
        this.stop();
        super.destroy();
        this.onStarted.clear();
        this.onStopped.clear();
        this.onCancelled.clear();
    }
}

export {CameraFlightAnimation};
