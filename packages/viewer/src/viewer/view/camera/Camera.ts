import * as math from '../../math/index';
import {Component} from '../../Component';
import {Perspective} from './Perspective';
import {Ortho} from './Ortho';
import {Frustum} from './Frustum';
import {CustomProjection} from './CustomProjection';
import type {View} from "../View";
import type {FloatArrayParam} from "../../math/index";
import {RTCViewMat} from "./RTCViewMat";
import {EventEmitter} from "../../EventEmitter";
import {EventDispatcher} from "strongly-typed-events";
import {
    CustomProjectionType,
    FrustumProjectionType,
    OrthoProjectionType,
    PerspectiveProjectionType
} from "../../constants";


const tempVec3 = math.vec3();
const tempVec3b = math.vec3();
const tempVec3c = math.vec3();
const tempVec3d = math.vec3();
const tempVec3e = math.vec3();
const tempVec3f = math.vec3();
const tempMat = math.mat4();
const tempMatb = math.mat4();
const eyeLookVec = math.vec3();
const eyeLookVecNorm = math.vec3();
const eyeLookOffset = math.vec3();
const offsetEye = math.vec3();


/**
 * Controls the viewpoint and projection for a {@link View}.
 *
 * ## Summary
 *
 * * Located at {@link View.camera}
 * * Views are located at {@link Viewer.views}
 * * Controls camera viewing and projection transforms
 * * Provides methods to pan, zoom and orbit
 * * Dynamically configurable World-space axis
 * * Has {@link Perspective}, {@link Ortho} and {@link Frustum} and {@link CustomProjection}, which you can dynamically switch between
 * * Switchable gimbal lock
 * * Can be flown to look at targets using the View's {@link CameraFlightAnimation}
 * * Can be animated along a path using a {@link CameraPathAnimation}
 *
 * ## Getting a View's Camera
 *
 * Let's create a {@link Viewer} with a single {@link View}, from which we'll get a Camera:
 *
 * ````javascript
 * import {Viewer} from "xeokit-viewer.es.js";
 *
 * const viewer = new Viewer();
 *
 * const view = new View(viewer, {
 *      canvasId: "myCanvas1"
 * });
 *
 * const camera = view.camera;
 * ````
 *
 * ## Setting the Camera Position
 *
 * Get and set the Camera's absolute position:
 *
 * ````javascript
 * camera.eye = [-10,0,0];
 * camera.look = [-10,0,0];
 * camera.up = [0,1,0];
 * ````
 *
 * ## Camera View and Projection Matrices
 *
 * The Camera's *view matrix* transforms coordinates from World-space to View-space:
 *
 * ````javascript
 * var viewMatrix = camera.viewMatrix;
 * var viewNormalMatrix = camera.normalMatrix;
 * ````
 *
 * The Camera's *view normal matrix* transforms normal vectors from World-space to View-space:
 *
 * ````javascript
 * var viewNormalMatrix = camera.normalMatrix;
 * ````
 *
 * {@link Camera.onViewMatrix} fires whenever {@link Camera.viewMatrix} and {@link Camera.viewNormalMatrix} update:
 *
 * ````javascript
 * camera.onViewMatrix.subscribe((camera, matrix) => { ... });
 * ````
 *
 * ## Rotating the Camera
 *
 * Orbiting the {@link Camera.look} position:
 *
 * ````javascript
 * camera.orbitYaw(20.0);
 * camera.orbitPitch(10.0);
 * ````
 *
 * Perform a *first-person* rotation, in which we rotate {@link Camera.look} and {@link Camera.up} about {@link Camera.eye}:
 *
 * ````javascript
 * camera.yaw(5.0);
 * camera.pitch(-10.0);
 * ````
 *
 * ## Panning the Camera
 *
 * Pan along the Camera's local axis (ie. left/right, up/down, forward/backward):
 *
 * ````javascript
 * camera.pan([-20, 0, 10]);
 * ````
 *
 * ## Zooming the Camera
 *
 * Zoom to vary distance between {@link Camera.eye} and {@link Camera.look}:
 *
 * ````javascript
 * camera.zoom(-5); // Move five units closer
 * ````
 *
 * Get the current distance between {@link Camera.eye} and {@link Camera.look}:
 *
 * ````javascript
 * var distance = camera.eyeLookDist;
 * ````
 *
 * ## Projection
 *
 * The Camera has a Component to manage each projection type, which are: {@link Perspective}, {@link Ortho}
 * and {@link Frustum} and {@link CustomProjection}.
 *
 * You can configure those components at any time, regardless of which is currently active:
 *
 * The Camera has a {@link Perspective} to manage perspective
 * ````javascript
 *
 * // Set some properties on Perspective
 * camera.perspective.near = 0.4;
 * camera.perspective.fov = 45;
 *
 * // Set some properties on Ortho
 * camera.ortho.near = 0.8;
 * camera.ortho.far = 1000;
 *
 * // Set some properties on Frustum
 * camera.frustum.left = -1.0;
 * camera.frustum.right = 1.0;
 * camera.frustum.far = 1000.0;
 *
 * // Set the matrix property on CustomProjection
 * camera.customProjection.projMatrix = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
 *
 * // Switch between the projection types
 * camera.projection = PerspectiveProjectionType; // Switch to perspective
 * camera.projection = "frustum"; // Switch to frustum
 * camera.projection = OrthoProjectionType; // Switch to ortho
 * camera.projection = "customProjection"; // Switch to custom
 * ````
 *
 * Camera provides the projection matrix for the currently active projection in {@link Camera.projMatrix}.
 *
 * Get the projection matrix:
 *
 * ````javascript
 * var projMatrix = camera.projMatrix;
 * ````
 *
 * Listen for projection matrix updates:
 *
 * ````javascript
 * camera.onProjMatrix((camera, matrix) => { ... });
 * ````
 *
 * ## Configuring World up direction
 *
 * We can dynamically configure the directions of the World-space coordinate system.
 *
 * Setting the +Y axis as World "up", +X as right and -Z as forwards (convention in some modeling software):
 *
 * ````javascript
 * camera.worldAxis = [
 *     1, 0, 0,    // Right
 *     0, 1, 0,    // Up
 *     0, 0,-1     // Forward
 * ];
 * ````
 *
 * Setting the +Z axis as World "up", +X as right and -Y as "up" (convention in most CAD and BIM viewers):
 *
 * ````javascript
 * camera.worldAxis = [
 *     1, 0, 0, // Right
 *     0, 0, 1, // Up
 *     0,-1, 0  // Forward
 * ];
 * ````
 *
 * The Camera has read-only convenience properties that provide each axis individually:
 *
 * ````javascript
 * var worldRight = camera.worldRight;
 * var worldForward = camera.worldForward;
 * var worldUp = camera.worldUp;
 * ````
 *
 * ## Gimbal locking
 *
 * By default, the Camera locks yaw rotation to pivot about the World-space "up" axis. We can dynamically lock and unlock that at any time:
 *
 * ````javascript
 * camera.gimbalLock = false; // Yaw rotation now happens about Camera's local Y-axis
 * camera.gimbalLock = true; // Yaw rotation now happens about World's "up" axis
 * ````
 *
 * See: <a href="https://en.wikipedia.org/wiki/Gimbal_lock">https://en.wikipedia.org/wiki/Gimbal_lock</a>
 */
class Camera extends Component {

    /**
     * The View to which this Camera belongs.
     *
     * @property view
     * @type {View}
     * @final
     */
    public readonly view: View;

    readonly #state: {
        deviceMatrix: math.FloatArrayParam,
        viewNormalMatrix: math.FloatArrayParam,
        hasDeviceMatrix: boolean,
        viewMatrix: math.FloatArrayParam,
        inverseViewMatrix: math.FloatArrayParam,
        eye: math.FloatArrayParam,
        look: math.FloatArrayParam,
        up: math.FloatArrayParam,
        worldAxis: math.FloatArrayParam,
        worldUp: math.FloatArrayParam,
        worldRight: math.FloatArrayParam,
        worldForward: math.FloatArrayParam,
        gimbalLock: boolean,
        constrainPitch: boolean,
        projectionType: number
    };

    /**
     * The perspective projection.
     *
     * The Camera uses this while {@link Camera.projection} equals {@link PerspectiveProjectionType}.
     */
    public readonly perspective: Perspective;

    /**
     * The orthographic projection.
     *
     * The Camera uses this while {@link Camera.projection} equals {@link OrthoProjectionType}.
     */
    public readonly ortho: Ortho;

    /**
     * The frustum projection.
     *
     * The Camera uses this while {@link Camera.projection} equals {@link FrustumProjectionType}.
     */
    public readonly frustum: Frustum;

    /**
     * The custom projection.
     *
     * The Camera uses this while {@link Camera.projection} equals {@link CustomProjectionType}.
     */
    public readonly customProjection: CustomProjection;

    #activeProjection: Perspective | Ortho | Frustum | CustomProjection;

    /**
     * View matrices for relative-to-center (RTC) coordinate system origins.
     *
     * Created and destroyed with {@link Camera.getRTCViewMat} and {@link Camera.putRTCViewMat}.
     */
    public readonly rtcViewMats: { [key: string]: RTCViewMat };

    /**
     * Emits an event each time {@link Camera.projection} updates.
     *
     * ````javascript
     * myView.camera.onProjType.subscribe((camera, projType) => { ... });
     * ````
     *
     * @event
     */
    readonly onProjType: EventEmitter<Camera, number>;

    /**
     * Emits an event each time {@link Camera.viewMatrix} updates.
     *
     * ````javascript
     * myView.camera.onViewMatrix.subscribe((camera, viewMatrix) => { ... });
     * ````
     *
     * @event
     */
    readonly onViewMatrix: EventEmitter<Camera, FloatArrayParam>;

    /**
     * Emits an event each time {@link Camera.projMatrix} updates.
     *
     * ````javascript
     * myView.camera.onProjMatrix.subscribe((camera, projMatrix) => { ... });
     * ````
     *
     * @event
     */
    readonly onProjMatrix: EventEmitter<Camera, FloatArrayParam>;

    /**
     * Emits an event each time {@link Camera.worldAxis} updates.
     *
     * ````javascript
     * myView.camera.onWorldAxis.subscribe((camera, worldAxis) => { ... });
     * ````
     *
     * @event
     */
    readonly onWorldAxis: EventEmitter<Camera, FloatArrayParam>;

    /**
     * @private
     */
    constructor(view: View, cfg: {
        eye?: math.FloatArrayParam;
        look?: math.FloatArrayParam,
        up?: math.FloatArrayParam;
        deviceMatrix?: math.FloatArrayParam;
        gimbalLock?: boolean;
        worldAxis?: math.FloatArrayParam;
        constrainPitch?: boolean;
        projectionType?: number
    } = {}) {

        super(view, cfg);

        this.onProjType = new EventEmitter(new EventDispatcher<Camera, number>());
        this.onViewMatrix = new EventEmitter(new EventDispatcher<Camera, FloatArrayParam>());
        this.onProjMatrix = new EventEmitter(new EventDispatcher<Camera, FloatArrayParam>());
        this.onWorldAxis = new EventEmitter(new EventDispatcher<Camera, FloatArrayParam>());

        this.view = view;

        this.#state = {
            eye: math.vec3(cfg.eye || [0, 0, 10]),
            look: math.vec3(cfg.look || [0, 0, 0]),
            up: math.vec3(cfg.up || [0, 1, 0]),
            worldUp: math.vec3([0, 1, 0]),
            worldRight: math.vec3([1, 0, 0]),
            worldForward: math.vec3([0, 0, -1]),
            worldAxis: new Float32Array(cfg.worldAxis || [1, 0, 0, 0, 1, 0, 0, 0, 1]),
            gimbalLock: cfg.gimbalLock !== false,
            constrainPitch: cfg.constrainPitch === true,
            projectionType: cfg.projectionType || PerspectiveProjectionType,
            deviceMatrix: cfg.deviceMatrix ? math.mat4(cfg.deviceMatrix) : math.identityMat4(),
            hasDeviceMatrix: !!cfg.deviceMatrix,
            viewMatrix: math.mat4(),
            viewNormalMatrix: math.mat4(),
            inverseViewMatrix: math.mat4()
        };

        this.rtcViewMats = {};

        this.perspective = new Perspective(this);
        this.ortho = new Ortho(this);
        this.frustum = new Frustum(this);
        this.customProjection = new CustomProjection(this);

        this.#activeProjection = this.perspective;

        this.perspective.onProjMatrix.subscribe(() => {
            if (this.#state.projectionType === PerspectiveProjectionType) {
                this.onProjMatrix.dispatch(this, this.perspective.projMatrix);
            }
        });

        this.ortho.onProjMatrix.subscribe(() => {
            if (this.#state.projectionType === OrthoProjectionType) {
                this.onProjMatrix.dispatch(this, this.ortho.projMatrix);
            }
        });

        this.frustum.onProjMatrix.subscribe(() => {
            if (this.#state.projectionType === FrustumProjectionType) {
                this.onProjMatrix.dispatch(this, this.frustum.projMatrix);
            }
        });

        this.customProjection.onProjMatrix.subscribe(() => {
            if (this.#state.projectionType === CustomProjectionType) {
                this.onProjMatrix.dispatch(this, this.customProjection.projMatrix);
            }
        });
    }


    /**
     * Gets the currently active projection for this Camera.
     *
     * The currently active project is selected with {@link Camera.projection}.
     *
     * @returns {Perspective|Ortho|Frustum|CustomProjection} The currently active projection is active.
     */
    get project(): Perspective | Ortho | Frustum | CustomProjection {
        return this.#activeProjection;
    }

    /**
     * Gets the position of the Camera's eye.
     *
     * Default vale is ````[0,0,10]````.
     *
     * @type {Number[]} New eye position.
     */
    get eye(): math.FloatArrayParam {
        return this.#state.eye;
    }

    /**
     * Sets the position of the Camera's eye.
     *
     * Default value is ````[0,0,10]````.
     *
     * @emits "eye" event on change, with the value of this property.
     * @type {Number[]} New eye position.
     */
    set eye(eye: math.FloatArrayParam) {
        // @ts-ignore
        this.#state.eye.set(eye);
        this.setDirty(); // Ensure matrix built on next "tick"
    }

    /**
     * Gets the position of this Camera's point-of-interest.
     *
     * Default value is ````[0,0,0]````.
     *
     * @returns {Number[]} Camera look position.
     */
    get look(): math.FloatArrayParam {
        return this.#state.look;
    }

    /**
     * Sets the position of this Camera's point-of-interest.
     *
     * Default value is ````[0,0,0]````.
     *
     * @param look Camera look position.
     */
    set look(look: math.FloatArrayParam) {
        // @ts-ignore
        this.#state.look.set(look);
        this.setDirty(); // Ensure matrix built on next "tick"
    }

    /**
     * Gets the direction of this Camera's {@link Camera.up} vector.
     *
     * @returns {Number[]} Direction of "up".
     */
    get up(): math.FloatArrayParam {
        return this.#state.up;
    }

    /**
     * Sets the direction of this Camera's {@link Camera.up} vector.
     *
     * @param up Direction of "up".
     */
    set up(up: math.FloatArrayParam) {
        // @ts-ignore
        this.#state.up.set(up);
        this.setDirty();
    }

    /**
     * Gets the direction of World-space "up".
     *
     * This is set by {@link Camera.worldAxis}.
     *
     * Default value is ````[0,1,0]````.
     *
     * @returns {Number[]} The "up" vector.
     */
    get worldUp(): math.FloatArrayParam {
        return this.#state.worldUp;
    }

    /**
     * Gets the direction of World-space "right".
     *
     * This is set by {@link Camera.worldAxis}.
     *
     * Default value is ````[1,0,0]````.
     *
     * @returns {Number[]} The "up" vector.
     */
    get worldRight(): math.FloatArrayParam {
        return this.#state.worldRight;
    }

    /**
     * Gets the direction of World-space "forwards".
     *
     * This is set by {@link Camera.worldAxis}.
     *
     * Default value is ````[0,0,1]````.
     *
     * @returns {Number[]} The "up" vector.
     */
    get worldForward(): math.FloatArrayParam {
        return this.#state.worldForward;
    }

    /**
     * Gets whether to prevent camera from being pitched upside down.
     *
     * The camera is upside down when the angle between {@link Camera.up} and {@link Camera.worldUp} is less than one degree.
     *
     * Default value is ````false````.
     *
     * @returns {Boolean} ````true```` if pitch rotation is currently constrained.
     */
    get constrainPitch(): boolean {
        return this.#state.constrainPitch;
    }

    /**
     * Sets whether to prevent camera from being pitched upside down.
     *
     * The camera is upside down when the angle between {@link Camera.up} and {@link Camera.worldUp} is less than one degree.
     *
     * Default value is ````false````.
     *
     * @param value Set ````true```` to contrain pitch rotation.
     */
    set constrainPitch(value: boolean) {
        this.#state.constrainPitch = value;
    }

    /**
     * Gets whether to lock yaw rotation to pivot about the World-space "up" axis.
     *
     * @returns {Boolean} Returns ````true```` if gimbal is locked.
     */
    get gimbalLock(): boolean {
        return this.#state.gimbalLock;
    }

    /**
     * Sets whether to lock yaw rotation to pivot about the World-space "up" axis.
     *
     * @params {Boolean} gimbalLock Set true to lock gimbal.
     */
    set gimbalLock(value: boolean) {
        this.#state.gimbalLock = value;
    }

    /**
     * Gets the up, right and forward axis of the World coordinate system.
     *
     * Has format: ````[rightX, rightY, rightZ, upX, upY, upZ, forwardX, forwardY, forwardZ]````
     *
     * Default axis is ````[1, 0, 0, 0, 1, 0, 0, 0, 1]````
     *
     * @returns {Number[]} The current World coordinate axis.
     */
    get worldAxis(): math.FloatArrayParam {
        return this.#state.worldAxis;
    }

    /**
     * Sets the up, right and forward axis of the World coordinate system.
     *
     * Has format: ````[rightX, rightY, rightZ, upX, upY, upZ, forwardX, forwardY, forwardZ]````
     *
     * Default axis is ````[1, 0, 0, 0, 1, 0, 0, 0, 1]````
     *
     * @param axis The new Wworld coordinate axis.
     */
    set worldAxis(axis: math.FloatArrayParam) {
        const state = this.#state;
        // @ts-ignore
        state.worldAxis.set(axis);
        state.worldRight[0] = state.worldAxis[0];
        state.worldRight[1] = state.worldAxis[1];
        state.worldRight[2] = state.worldAxis[2];
        state.worldUp[0] = state.worldAxis[3];
        state.worldUp[1] = state.worldAxis[4];
        state.worldUp[2] = state.worldAxis[5];
        state.worldForward[0] = state.worldAxis[6];
        state.worldForward[1] = state.worldAxis[7];
        state.worldForward[2] = state.worldAxis[8];
        this.onWorldAxis.dispatch(this, state.worldAxis);
    }

    /**
     * Gets an optional matrix to premultiply into {@link Camera.projMatrix} matrix.
     *
     * @returns {Number[]} The matrix.
     */
    get deviceMatrix(): math.FloatArrayParam {
        // @ts-ignore
        return this.#state.deviceMatrix;
    }

    /**
     * Sets an optional matrix to premultiply into {@link Camera.projMatrix} matrix.
     *
     * This is intended to be used for stereo rendering with WebVR etc.
     *
     * @param matrix The matrix.
     */
    set deviceMatrix(matrix: math.FloatArrayParam) {
        // @ts-ignore
        this.#state.deviceMatrix.set(matrix || [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
        this.#state.hasDeviceMatrix = !!matrix;
        this.setDirty();
    }

    /**
     * Gets if the World-space X-axis is "up".
     * @returns {boolean}
     */
    get xUp(): boolean {
        return this.#state.worldUp[0] > this.#state.worldUp[1] && this.#state.worldUp[0] > this.#state.worldUp[2];
    }

    /**
     * Gets if the World-space Y-axis is "up".
     * @returns {boolean}
     */
    get yUp(): boolean {
        return this.#state.worldUp[1] > this.#state.worldUp[0] && this.#state.worldUp[1] > this.#state.worldUp[2];
    }

    /**
     * Gets if the World-space Z-axis is "up".
     * @returns {boolean}
     */
    get zUp(): boolean {
        return this.#state.worldUp[2] > this.#state.worldUp[0] && this.#state.worldUp[2] > this.#state.worldUp[1];
    }

    /**
     * Gets distance from {@link Camera.look} to {@link Camera.eye}.
     *
     * @returns {Number} The distance.
     */
    get eyeLookDist(): number {
        return math.lenVec3(math.subVec3(this.#state.look, this.#state.eye, tempVec3));
    }

    /**
     * Gets the Camera's viewing transformation matrix.
     *
     * @returns {Number[]} The viewing transform matrix.
     */
    get viewMatrix(): math.FloatArrayParam {
        if (this.dirty) {
            this.cleanIfDirty();
        }
        return this.#state.viewMatrix;
    }

    /**
     * The Camera's viewing normal transformation matrix.
     *
     * @returns {Number[]} The viewing normal transform matrix.
     */
    get viewNormalMatrix(): math.FloatArrayParam {
        if (this.dirty) {
            this.cleanIfDirty();
        }
        return this.#state.viewNormalMatrix;
    }

    /**
     * Gets the inverse of the Camera's viewing transform matrix.
     *
     * This has the same value as {@link Camera.viewNormalMatrix}.
     *
     * @returns {Number[]} The inverse viewing transform matrix.
     */
    get inverseViewMatrix(): math.FloatArrayParam {
        if (this.dirty) {
            this.cleanIfDirty();
        }
        return this.#state.inverseViewMatrix;
    }

    /**
     * Gets the Camera's projection transformation projMatrix.
     *
     * @returns {Number[]} The projection matrix.
     */
    get projMatrix(): math.FloatArrayParam {
        // @ts-ignore
        return this[this.projection].projMatrix;
    }

    /**
     * Gets the active projection type.
     *
     * Possible values are ````PerspectiveProjectionType````, ````OrthoProjectionType````, ````"frustum"```` and ````"customProjection"````.
     *
     * Default value is ````PerspectiveProjectionType````.
     *
     * @returns {number} Identifies the active projection type.
     */
    get projection(): number {
        return this.#state.projectionType;
    }

    /**
     * Sets the active projection type.
     *
     * Accepted values are ````PerspectiveProjectionType````, ````OrthoProjectionType````, ````"frustum"```` and ````"customProjection"````.
     *
     * Default value is ````PerspectiveProjectionType````.
     *
     * @param value Identifies the active projection type.
     */
    set projection(value: number | undefined) {
        value = value || PerspectiveProjectionType;
        if (this.#state.projectionType === value) {
            return;
        }
        if (value === PerspectiveProjectionType) {
            this.#activeProjection = this.perspective;
        } else if (value === OrthoProjectionType) {
            this.#activeProjection = this.ortho;
        } else if (value === FrustumProjectionType) {
            this.#activeProjection = this.frustum;
        } else if (value === CustomProjectionType) {
            this.#activeProjection = this.customProjection;
        } else {
            this.error("Unsupported value for 'projection': " + value + " defaulting to PerspectiveProjectionType");
            this.#activeProjection = this.perspective;
            value = PerspectiveProjectionType;
        }
        this.#activeProjection.clean();
        this.#state.projectionType = value;
        this.view.redraw();
        this.clean(); // Need to rebuild lookat matrix with full eye, look & up
        this.onProjType.dispatch(this, this.#state.projectionType);
        this.onProjMatrix.dispatch(this, this.#activeProjection.projMatrix);
    }

    clean() {
        const state = this.#state;
        // In ortho mode, build the view matrix with an eye position that's translated
        // well back from look, so that the front sectionPlane plane doesn't unexpectedly cut
        // the front off the view (not a problem with perspective, since objects close enough
        // to be clipped by the front plane are usually too big to see anything of their cross-sections).
        let eye;
        if (this.projection === OrthoProjectionType) {
            math.subVec3(this.#state.eye, this.#state.look, eyeLookVec);
            math.normalizeVec3(eyeLookVec, eyeLookVecNorm);
            math.mulVec3Scalar(eyeLookVecNorm, 1000.0, eyeLookOffset);
            math.addVec3(this.#state.look, eyeLookOffset, offsetEye);
            eye = offsetEye;
        } else {
            eye = this.#state.eye;
        }
        if (state.hasDeviceMatrix) {
            math.lookAtMat4v(eye, this.#state.look, this.#state.up, tempMatb);
            math.mulMat4(state.deviceMatrix, tempMatb, state.viewMatrix);
        } else {
            math.lookAtMat4v(eye, this.#state.look, this.#state.up, state.viewMatrix);
        }
        math.inverseMat4(this.#state.viewMatrix, this.#state.inverseViewMatrix);
        math.transposeMat4(this.#state.inverseViewMatrix, this.#state.viewNormalMatrix);
        this.#invalidateRTCViewMatrices();
        this.view.redraw();
        this.onViewMatrix.dispatch(this, this.#state.viewMatrix);
    }

    /**
     * Rotates {@link Camera.eye} about {@link Camera.look}, around the {@link Camera.up} vector
     *
     * @param angleInc Angle of rotation in degrees
     */
    orbitYaw(angleInc: number) {
        let lookEyeVec = math.subVec3(this.#state.eye, this.#state.look, tempVec3);
        math.rotationMat4v(angleInc * 0.0174532925, this.#state.gimbalLock ? this.#state.worldUp : this.#state.up, tempMat);
        lookEyeVec = math.transformPoint3(tempMat, lookEyeVec, tempVec3b);
        this.eye = math.addVec3(this.#state.look, lookEyeVec, tempVec3c); // Set eye position as 'look' plus 'eye' vector
        this.up = math.transformPoint3(tempMat, this.#state.up, tempVec3d); // Rotate 'up' vector
    }

    /**
     * Rotates {@link Camera.eye} about {@link Camera.look} around the right axis (orthogonal to {@link Camera.up} and "look").
     *
     * @param angleInc Angle of rotation in degrees
     */
    orbitPitch(angleInc: number) {
        if (this.#state.constrainPitch) {
            angleInc = math.dotVec3(this.#state.up, this.#state.worldUp) / math.DEGTORAD;
            if (angleInc < 1) {
                return;
            }
        }
        let eye2 = math.subVec3(this.#state.eye, this.#state.look, tempVec3);
        const left = math.cross3Vec3(math.normalizeVec3(eye2, tempVec3b), math.normalizeVec3(this.#state.up, tempVec3c));
        math.rotationMat4v(angleInc * 0.0174532925, left, tempMat);
        eye2 = math.transformPoint3(tempMat, eye2, tempVec3d);
        this.up = math.transformPoint3(tempMat, this.#state.up, tempVec3e);
        this.eye = math.addVec3(eye2, this.#state.look, tempVec3f);
    }

    /**
     * Rotates {@link Camera.look} about {@link Camera.eye}, around the {@link Camera.up} vector.
     *
     * @param angleInc Angle of rotation in degrees
     */
    yaw(angleInc: number) {
        let look2 = math.subVec3(this.#state.look, this.#state.eye, tempVec3);
        math.rotationMat4v(angleInc * 0.0174532925, this.#state.gimbalLock ? this.#state.worldUp : this.#state.up, tempMat);
        look2 = math.transformPoint3(tempMat, look2, tempVec3b);
        this.look = math.addVec3(look2, this.#state.eye, tempVec3c);
        if (this.#state.gimbalLock) {
            this.up = math.transformPoint3(tempMat, this.#state.up, tempVec3d);
        }
    }

    /**
     * Rotates {@link Camera.look} about {@link Camera.eye}, around the right axis (orthogonal to {@link Camera.up} and "look").

     * @param angleInc Angle of rotation in degrees
     */
    pitch(angleInc: number) {
        if (this.#state.constrainPitch) {
            angleInc = math.dotVec3(this.#state.up, this.#state.worldUp) / math.DEGTORAD;
            if (angleInc < 1) {
                return;
            }
        }
        let look2 = math.subVec3(this.#state.look, this.#state.eye, tempVec3);
        const left = math.cross3Vec3(math.normalizeVec3(look2, tempVec3b), math.normalizeVec3(this.#state.up, tempVec3c));
        math.rotationMat4v(angleInc * 0.0174532925, left, tempMat);
        this.up = math.transformPoint3(tempMat, this.#state.up, tempVec3f);
        look2 = math.transformPoint3(tempMat, look2, tempVec3d);
        this.look = math.addVec3(look2, this.#state.eye, tempVec3e);
    }

    /**
     * Pans the Camera along its local X, Y and Z axis.
     *
     * @param pan The pan vector
     */
    pan(pan: math.FloatArrayParam) {
        const eye2 = math.subVec3(this.#state.eye, this.#state.look, tempVec3);
        const vec = [0, 0, 0];
        let v;
        if (pan[0] !== 0) {
            const left = math.cross3Vec3(math.normalizeVec3(eye2, []), math.normalizeVec3(this.#state.up, tempVec3b));
            v = math.mulVec3Scalar(left, pan[0]);
            vec[0] += v[0];
            vec[1] += v[1];
            vec[2] += v[2];
        }
        if (pan[1] !== 0) {
            v = math.mulVec3Scalar(math.normalizeVec3(this.#state.up, tempVec3c), pan[1]);
            vec[0] += v[0];
            vec[1] += v[1];
            vec[2] += v[2];
        }
        if (pan[2] !== 0) {
            v = math.mulVec3Scalar(math.normalizeVec3(eye2, tempVec3d), pan[2]);
            vec[0] += v[0];
            vec[1] += v[1];
            vec[2] += v[2];
        }
        this.eye = math.addVec3(this.#state.eye, vec, tempVec3e);
        this.look = math.addVec3(this.#state.look, vec, tempVec3f);
    }

    /**
     * Increments/decrements the Camera's zoom factor, which is the distance between {@link Camera.eye} and {@link Camera.look}.
     *
     * @param delta Zoom factor increment.
     */
    zoom(delta: number) {
        const vec = math.subVec3(this.#state.eye, this.#state.look, tempVec3);
        const lenLook = Math.abs(math.lenVec3(vec));
        const newLenLook = Math.abs(lenLook + delta);
        if (newLenLook < 0.5) {
            return;
        }
        const dir = math.normalizeVec3(vec, tempVec3c);
        this.eye = math.addVec3(this.#state.look, math.mulVec3Scalar(dir, newLenLook), tempVec3d);
    }

    #invalidateRTCViewMatrices(): void {
        Object.values(this.rtcViewMats).forEach((rtcViewMat) => {
            rtcViewMat.dirty = true;
        });
    }

    /**
     * Gets an RTC view matrix for the given relative-to-center (RTC) coordinate system origin.
     *
     * The RTCViewMat returned by this method will provide a dynamically-synchronized
     * version of {@link Camera.viewMatrix} for the given RTC origin. Whenever {@link Camera.viewMatrix}
     * updates, {@link RTCViewMat.viewMatrix} will update also.
     *
     * Make sure to release it with {@link putRTCViewMat} or {@link RTCViewMat.release} when you no longer need it.
     *
     * @param origin The RTC coordinate origin.
     * @returns An RTC view matrix for the given RTC coordinate origin.
     */
    getRTCViewMat(origin: FloatArrayParam): RTCViewMat {
        const id = `${origin[0]}_${origin[1]}_${origin[2]}`;
        let rtcViewMat = this.rtcViewMats[id];
        if (!rtcViewMat) {
            rtcViewMat = new RTCViewMat(this, id, origin);
            this.rtcViewMats[id] = rtcViewMat;
        }
        rtcViewMat.useCount++;
        return rtcViewMat;
    }

    /**
     * Releases an RTC view matrix.
     *
     * @param rtcViewMat The RTC view matrix.
     */
    putRTCViewMat(rtcViewMat: RTCViewMat): void {
        rtcViewMat.useCount--;
        if (rtcViewMat.useCount <= 0) {
            delete this.rtcViewMats[rtcViewMat.id];
        }
    }

    /**
     * @private
     */
    destroy() {
        super.destroy();
        this.onProjType.clear();
        this.onViewMatrix.clear();
        this.onProjMatrix.clear();
        this.onWorldAxis.clear();
    }
}

export {Camera};