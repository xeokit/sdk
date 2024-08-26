import {EventDispatcher} from "strongly-typed-events";
import {
    addVec3,
    createMat4,
    createVec3,
    cross3Vec3,
    dotVec3,
    identityMat4,
    inverseMat4,
    lenVec3,
    lookAtMat4v,
    mulMat4,
    mulVec3Scalar,
    normalizeVec3,
    rotationMat4v,
    subVec3,
    transformPoint3,
    transposeMat4
} from "@xeokit/matrix";

import {PerspectiveProjection} from './PerspectiveProjection';
import {OrthoProjection} from './OrthoProjection';
import {FrustumProjection} from './FrustumProjection';
import {CustomProjection} from './CustomProjection';
import type {View} from "./View";
import {Component, EventEmitter} from "@xeokit/core";
import {DEGTORAD, type FloatArrayParam} from "@xeokit/math";
import {
    CustomProjectionType,
    FrustumProjectionType,
    OrthoProjectionType,
    PerspectiveProjectionType
} from "@xeokit/constants";
import {Frustum3, setFrustum3} from "@xeokit/boundaries";
import {Projection} from "./Projection";


const tempVec3 = createVec3();
const tempVec3b = createVec3();
const tempVec3c = createVec3();
const tempVec3d = createVec3();
const tempVec3e = createVec3();
const tempVec3f = createVec3();
const tempMat = createMat4();
const tempMatb = createMat4();
const eyeLookVec = createVec3();
const eyeLookVecNorm = createVec3();
const eyeLookOffset = createVec3();
const offsetEye = createVec3();


/**
 * Controls the viewpoint and projection for a {@link @xeokit/viewer!View}.
 *
 * ## Summary
 *
 * * Located at {@link View.camera}
 * * Views are located at {@link Viewer.views}
 * * Controls camera viewing and projection transforms
 * * Provides methods to pan, zoom and orbit
 * * Dynamically configurable World-space axis
 * * Has {@link PerspectiveProjection}, {@link OrthoProjection} and {@link FrustumProjection} and {@link CustomProjection}, which you can dynamically switch between
 * * Switchable gimbal lock
 *
 * ## Getting a View's Camera
 *
 * Let's create a {@link @xeokit/viewer!Viewer | Viewer} with a single {@link @xeokit/viewer!View}, from which we'll get a Camera:
 *
 * ````javascript
 * const viewer = new Viewer();
 *
 * const view = new View(viewer, {
 *      elementId: "myCanvas1"
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
 * ````
 *
 * {@link Camera.onViewMatrix} fires whenever {@link Camera.viewMatrix} updates:
 *
 * ````javascript
 * camera.onViewMatrix.subscribe((camera, matrix) => { ... });
 * ````
 *
 * ## Rotating the Camera
 *
 * Orbiting the {@link @xeokit/viewer!Camera.look | Camera.look} position:
 *
 * ````javascript
 * camera.orbitYaw(20.0);
 * camera.orbitPitch(10.0);
 * ````
 *
 * Perform a *first-person* rotation, in which we rotate {@link @xeokit/viewer!Camera.look | Camera.look} and {@link @xeokit/viewer!Camera.up | Camera.up} about {@link @xeokit/viewer!Camera.eye | Camera.eye}:
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
 * Zoom to vary distance between {@link @xeokit/viewer!Camera.eye | Camera.eye} and {@link @xeokit/viewer!Camera.look | Camera.look}:
 *
 * ````javascript
 * camera.zoom(-5); // Move five units closer
 * ````
 *
 * Get the current distance between {@link @xeokit/viewer!Camera.eye | Camera.eye} and {@link @xeokit/viewer!Camera.look | Camera.look}:
 *
 * ````javascript
 * var distance = camera.eyeLookDist;
 * ````
 *
 * ## Projection
 *
 * The Camera has a Component to manage each projection type, which are: {@link PerspectiveProjection}, {@link OrthoProjection}
 * and {@link FrustumProjection} and {@link CustomProjection}.
 *
 * You can configure those components at any time, regardless of which is currently active:
 *
 * The Camera has a {@link PerspectiveProjection} to manage perspective
 * ````javascript
 *
 * // Set some properties on PerspectiveProjection
 * camera.perspectiveProjection.near = 0.4;
 * camera.perspectiveProjection.fov = 45;
 *
 * // Set some properties on OrthoProjection
 * camera.orthoProjection.near = 0.8;
 * camera.orthoProjection.far = 1000;
 *
 * // Set some properties on FrustumProjection
 * camera.frustumProjection.left = -1.0;
 * camera.frustumProjection.right = 1.0;
 * camera.frustumProjection.far = 1000.0;
 *
 * // Set the matrix property on CustomProjection
 * camera.customProjection.projMatrix = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
 *
 * // Switch between the projection types
 * Camera.projectionType = PerspectiveProjectionType; // Switch to perspective
 * Camera.projectionType = FrustumProjectiontype; // Switch to frustum
 * Camera.projectionType = OrthoProjectionType; // Switch to ortho
 * Camera.projectionType = CustomProjectionType; // Switch to custom
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

    /**
     * The perspective projection.
     *
     * The Camera uses this while {@link Camera.projectionType} equals {@link PerspectiveProjectionType}.
     */
    public readonly perspectiveProjection: PerspectiveProjection;

    /**
     * The orthographic projection.
     *
     * The Camera uses this while {@link Camera.projectionType} equals {@link @xeokit/constants!OrthoProjectionType}.
     */
    public readonly orthoProjection: OrthoProjection;

    /**
     * The frustum projection.
     *
     * The Camera uses this while {@link Camera.projectionType} equals {@link @xeokit/constants!FrustumProjectionType}.
     */
    public readonly frustumProjection: FrustumProjection;

    /**
     * The custom projection.
     *
     * The Camera uses this while {@link Camera.projectionType} equals {@link @xeokit/constants!CustomProjectionType}.
     */
    public readonly customProjection: CustomProjection;

    /**
     * Emits an event each time {@link Camera.projectionType} updates.
     *
     * ````javascript
     * myView.camera.onProjectionType.subscribe((camera, projType) => { ... });
     * ````
     *
     * @event
     */
    readonly onProjectionType: EventEmitter<Camera, number>;

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
     * Emits an event each time {@link Camera.frustum} updates.
     *
     * ````javascript
     * myView.camera.onFrustum.subscribe((camera, frustum) => { ... });
     * ````
     *
     * @event
     */
    readonly onFrustum: EventEmitter<Camera, Frustum3>;

    readonly #state: {
        deviceMatrix: FloatArrayParam,
        viewNormalMatrix: FloatArrayParam,
        hasDeviceMatrix: boolean,
        viewMatrix: FloatArrayParam,
        inverseViewMatrix: FloatArrayParam,
        eye: FloatArrayParam,
        look: FloatArrayParam,
        up: FloatArrayParam,
        worldAxis: FloatArrayParam,
        worldUp: FloatArrayParam,
        worldRight: FloatArrayParam,
        worldForward: FloatArrayParam,
        gimbalLock: boolean,
        constrainPitch: boolean,
        projectionType: number
    };

    /**
     * The viewing frustum.
     */
    #frustum: Frustum3;
    #activeProjection: PerspectiveProjection | OrthoProjection | FrustumProjection | CustomProjection;

    /**
     * @private
     */
    constructor(view: View, cfg: {
        eye?: FloatArrayParam;
        look?: FloatArrayParam,
        up?: FloatArrayParam;
        deviceMatrix?: FloatArrayParam;
        gimbalLock?: boolean;
        worldAxis?: FloatArrayParam;
        constrainPitch?: boolean;
        projectionType?: number
    } = {}) {

        super(view, cfg);

        this.onProjectionType = new EventEmitter(new EventDispatcher<Camera, number>());
        this.onViewMatrix = new EventEmitter(new EventDispatcher<Camera, FloatArrayParam>());
        this.onProjMatrix = new EventEmitter(new EventDispatcher<Camera, FloatArrayParam>());
        this.onWorldAxis = new EventEmitter(new EventDispatcher<Camera, FloatArrayParam>());
        this.onFrustum = new EventEmitter(new EventDispatcher<Camera, Frustum3>());

        this.view = view;

        this.#state = {
            eye: createVec3(cfg.eye || [0, 0, 10]),
            look: createVec3(cfg.look || [0, 0, 0]),
            up: createVec3(cfg.up || [0, 1, 0]),
            worldUp: createVec3([0, 1, 0]),
            worldRight: createVec3([1, 0, 0]),
            worldForward: createVec3([0, 0, -1]),
            worldAxis: new Float32Array(cfg.worldAxis || [1, 0, 0, 0, 1, 0, 0, 0, 1]),
            gimbalLock: cfg.gimbalLock !== false,
            constrainPitch: cfg.constrainPitch === true,
            projectionType: cfg.projectionType || PerspectiveProjectionType,
            deviceMatrix: cfg.deviceMatrix ? createMat4(cfg.deviceMatrix) : identityMat4(),
            hasDeviceMatrix: !!cfg.deviceMatrix,
            viewMatrix: createMat4(),
            viewNormalMatrix: createMat4(),
            inverseViewMatrix: createMat4()
        };

        this.#frustum = new Frustum3();

        this.perspectiveProjection = new PerspectiveProjection(this);
        this.orthoProjection = new OrthoProjection(this);
        this.frustumProjection = new FrustumProjection(this);
        this.customProjection = new CustomProjection(this);

        this.#activeProjection = this.perspectiveProjection;

        this.perspectiveProjection.onProjMatrix.subscribe(() => {
            if (this.#state.projectionType === PerspectiveProjectionType) {
                this.onProjMatrix.dispatch(this, this.perspectiveProjection.projMatrix);
            }
        });

        this.orthoProjection.onProjMatrix.subscribe(() => {
            if (this.#state.projectionType === OrthoProjectionType) {
                this.onProjMatrix.dispatch(this, this.orthoProjection.projMatrix);
            }
        });

        this.frustumProjection.onProjMatrix.subscribe(() => {
            if (this.#state.projectionType === FrustumProjectionType) {
                this.onProjMatrix.dispatch(this, this.frustumProjection.projMatrix);
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
     * The currently active project is selected with {@link Camera.projectionType}.
     *
     * @returns {PerspectiveProjection|OrthoProjection|FrustumProjection|CustomProjection} The currently active projection is active.
     */
    get projection(): Projection {
        return this.#activeProjection;
    }

    /**
     * Gets the position of the Camera's eye.
     *
     * Default vale is ````[0,0,10]````.
     *
     * @type {Number[]} New eye position.
     */
    get eye(): FloatArrayParam {
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
    set eye(eye: FloatArrayParam) {
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
    get look(): FloatArrayParam {
        return this.#state.look;
    }

    /**
     * Sets the position of this Camera's point-of-interest.
     *
     * Default value is ````[0,0,0]````.
     *
     * @param look Camera look position.
     */
    set look(look: FloatArrayParam) {
        // @ts-ignore
        this.#state.look.set(look);
        this.setDirty(); // Ensure matrix built on next "tick"
    }

    /**
     * Gets the direction of this Camera's {@link @xeokit/viewer!Camera.up | Camera.up} vector.
     *
     * @returns {Number[]} Direction of "up".
     */
    get up(): FloatArrayParam {
        return this.#state.up;
    }

    /**
     * Sets the direction of this Camera's {@link @xeokit/viewer!Camera.up | Camera.up} vector.
     *
     * @param up Direction of "up".
     */
    set up(up: FloatArrayParam) {
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
    get worldUp(): FloatArrayParam {
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
    get worldRight(): FloatArrayParam {
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
    get worldForward(): FloatArrayParam {
        return this.#state.worldForward;
    }

    /**
     * Gets whether to prevent camera from being pitched upside down.
     *
     * The camera is upside down when the angle between {@link @xeokit/viewer!Camera.up | Camera.up} and {@link Camera.worldUp} is less than one degree.
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
     * The camera is upside down when the angle between {@link @xeokit/viewer!Camera.up | Camera.up} and {@link Camera.worldUp} is less than one degree.
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
    get worldAxis(): FloatArrayParam {
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
    set worldAxis(axis: FloatArrayParam) {
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
    get deviceMatrix(): FloatArrayParam {
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
    set deviceMatrix(matrix: FloatArrayParam) {
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
     * Gets distance from {@link @xeokit/viewer!Camera.look | Camera.look} to {@link @xeokit/viewer!Camera.eye | Camera.eye}.
     *
     * @returns {Number} The distance.
     */
    get eyeLookDist(): number {
        return lenVec3(subVec3(this.#state.look, this.#state.eye, tempVec3));
    }

    /**
     * Gets the Camera's viewing transformation matrix.
     *
     * @returns {Number[]} The viewing transform matrix.
     */
    get viewMatrix(): FloatArrayParam {
        if (this.dirty) {
            this.cleanIfDirty();
        }
        return this.#state.viewMatrix;
    }

    /**
     * Gets the inverse of the Camera's viewing transform matrix.
     *
     * @returns {Number[]} The inverse viewing transform matrix.
     */
    get inverseViewMatrix(): FloatArrayParam {
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
    get projMatrix(): FloatArrayParam {
        // @ts-ignore
        return this.#activeProjection.projMatrix;
    }

    /**
     * Gets the Camera's 3D World-space viewing frustum.
     *
     * @returns {Frustum3} The frustum.
     */
    get frustum() {
        if (this.dirty) {
            this.cleanIfDirty();
        }
        return this.#frustum;
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
    get projectionType(): number {
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
    set projectionType(value: number | undefined) {
        value = value || PerspectiveProjectionType;
        if (this.#state.projectionType === value) {
            return;
        }
        if (value === PerspectiveProjectionType) {
            this.#activeProjection = this.perspectiveProjection;
        } else if (value === OrthoProjectionType) {
            this.#activeProjection = this.orthoProjection;
        } else if (value === FrustumProjectionType) {
            this.#activeProjection = this.frustumProjection;
        } else if (value === CustomProjectionType) {
            this.#activeProjection = this.customProjection;
        } else {
            this.error("Unsupported value for 'projection': " + value + " defaulting to PerspectiveProjectionType");
            this.#activeProjection = this.perspectiveProjection;
            value = PerspectiveProjectionType;
        }
        // @ts-ignore
        this.#activeProjection.clean();
        this.#state.projectionType = value;
        this.clean();
        this.onProjectionType.dispatch(this, this.#state.projectionType);
        this.onProjMatrix.dispatch(this, this.#activeProjection.projMatrix);
    }

    setDirty() {
        super.setDirty();
        this.view.redraw();
    }

    clean() {
        const state = this.#state;
        // In ortho mode, build the view matrix with an eye position that's translated
        // well back from look, so that the front sectionPlane plane doesn't unexpectedly cut
        // the front off the view (not a problem with perspective, since objects close enough
        // to be clipped by the front plane are usually too big to see anything of their cross-sections).
        let eye;
        if (this.projectionType === OrthoProjectionType) {
            subVec3(this.#state.eye, this.#state.look, eyeLookVec);
            normalizeVec3(eyeLookVec, eyeLookVecNorm);
            mulVec3Scalar(eyeLookVecNorm, 1000.0, eyeLookOffset);
            addVec3(this.#state.look, eyeLookOffset, offsetEye);
            eye = offsetEye;
        } else {
            eye = this.#state.eye;
        }
        if (state.hasDeviceMatrix) {
            lookAtMat4v(eye, this.#state.look, this.#state.up, tempMatb);
            mulMat4(state.deviceMatrix, tempMatb, state.viewMatrix);
        } else {
            lookAtMat4v(eye, this.#state.look, this.#state.up, state.viewMatrix);
        }
        inverseMat4(this.#state.viewMatrix, this.#state.inverseViewMatrix);
        transposeMat4(this.#state.inverseViewMatrix, this.#state.viewNormalMatrix);
        this.view.redraw();
        setFrustum3(this.#state.viewMatrix, this.#activeProjection.projMatrix, this.#frustum);
        this.onViewMatrix.dispatch(this, this.#state.viewMatrix);
        this.onFrustum.dispatch(this, this.#frustum);
    }

    /**
     * Rotates {@link @xeokit/viewer!Camera.eye | Camera.eye} about {@link @xeokit/viewer!Camera.look | Camera.look}, around the {@link @xeokit/viewer!Camera.up | Camera.up} vector
     *
     * @param angleInc Angle of rotation in degrees
     */
    orbitYaw(angleInc: number) {
        let lookEyeVec = subVec3(this.#state.eye, this.#state.look, tempVec3);
        rotationMat4v(angleInc * 0.0174532925, this.#state.gimbalLock ? this.#state.worldUp : this.#state.up, tempMat);
        lookEyeVec = transformPoint3(tempMat, lookEyeVec, tempVec3b);
        this.eye = addVec3(this.#state.look, lookEyeVec, tempVec3c); // Set eye position as 'look' plus 'eye' vector
        this.up = transformPoint3(tempMat, this.#state.up, tempVec3d); // Rotate 'up' vector
    }

    /**
     * Rotates {@link @xeokit/viewer!Camera.eye | Camera.eye} about {@link @xeokit/viewer!Camera.look | Camera.look} around the right axis (orthogonal to {@link @xeokit/viewer!Camera.up | Camera.up} and "look").
     *
     * @param angleInc Angle of rotation in degrees
     */
    orbitPitch(angleInc: number) {
        if (this.#state.constrainPitch) {
            angleInc = dotVec3(this.#state.up, this.#state.worldUp) / DEGTORAD;
            if (angleInc < 1) {
                return;
            }
        }
        let eye2 = subVec3(this.#state.eye, this.#state.look, tempVec3);
        const left = cross3Vec3(normalizeVec3(eye2, tempVec3b), normalizeVec3(this.#state.up, tempVec3c));
        rotationMat4v(angleInc * 0.0174532925, left, tempMat);
        eye2 = transformPoint3(tempMat, eye2, tempVec3d);
        this.up = transformPoint3(tempMat, this.#state.up, tempVec3e);
        this.eye = addVec3(eye2, this.#state.look, tempVec3f);
    }

    /**
     * Rotates {@link @xeokit/viewer!Camera.look | Camera.look} about {@link @xeokit/viewer!Camera.eye | Camera.eye}, around the {@link @xeokit/viewer!Camera.up | Camera.up} vector.
     *
     * @param angleInc Angle of rotation in degrees
     */
    yaw(angleInc: number) {
        let look2 = subVec3(this.#state.look, this.#state.eye, tempVec3);
        rotationMat4v(angleInc * 0.0174532925, this.#state.gimbalLock ? this.#state.worldUp : this.#state.up, tempMat);
        look2 = transformPoint3(tempMat, look2, tempVec3b);
        this.look = addVec3(look2, this.#state.eye, tempVec3c);
        if (this.#state.gimbalLock) {
            this.up = transformPoint3(tempMat, this.#state.up, tempVec3d);
        }
    }

    /**
     * Rotates {@link @xeokit/viewer!Camera.look | Camera.look} about {@link @xeokit/viewer!Camera.eye | Camera.eye}, around the right axis (orthogonal to {@link @xeokit/viewer!Camera.up | Camera.up} and "look").

     * @param angleInc Angle of rotation in degrees
     */
    pitch(angleInc: number) {
        if (this.#state.constrainPitch) {
            angleInc = dotVec3(this.#state.up, this.#state.worldUp) / DEGTORAD;
            if (angleInc < 1) {
                return;
            }
        }
        let look2 = subVec3(this.#state.look, this.#state.eye, tempVec3);
        const left = cross3Vec3(normalizeVec3(look2, tempVec3b), normalizeVec3(this.#state.up, tempVec3c));
        rotationMat4v(angleInc * 0.0174532925, left, tempMat);
        this.up = transformPoint3(tempMat, this.#state.up, tempVec3f);
        look2 = transformPoint3(tempMat, look2, tempVec3d);
        this.look = addVec3(look2, this.#state.eye, tempVec3e);
    }

    /**
     * Pans the Camera along its local X, Y and Z axis.
     *
     * @param pan The pan vector
     */
    pan(pan: FloatArrayParam) {
        const eye2 = subVec3(this.#state.eye, this.#state.look, tempVec3);
        const vec = [0, 0, 0];
        let v;
        if (pan[0] !== 0) {
            const left = cross3Vec3(normalizeVec3(eye2, []), normalizeVec3(this.#state.up, tempVec3b));
            v = mulVec3Scalar(left, pan[0]);
            vec[0] += v[0];
            vec[1] += v[1];
            vec[2] += v[2];
        }
        if (pan[1] !== 0) {
            v = mulVec3Scalar(normalizeVec3(this.#state.up, tempVec3c), pan[1]);
            vec[0] += v[0];
            vec[1] += v[1];
            vec[2] += v[2];
        }
        if (pan[2] !== 0) {
            v = mulVec3Scalar(normalizeVec3(eye2, tempVec3d), pan[2]);
            vec[0] += v[0];
            vec[1] += v[1];
            vec[2] += v[2];
        }
        this.eye = addVec3(this.#state.eye, vec, tempVec3e);
        this.look = addVec3(this.#state.look, vec, tempVec3f);
    }

    /**
     * Increments/decrements the Camera's zoom factor, which is the distance between {@link @xeokit/viewer!Camera.eye | Camera.eye} and {@link @xeokit/viewer!Camera.look | Camera.look}.
     *
     * @param delta Zoom factor increment.
     */
    zoom(delta: number) {
        const vec = subVec3(this.#state.eye, this.#state.look, tempVec3);
        const lenLook = Math.abs(lenVec3(vec));
        const newLenLook = Math.abs(lenLook + delta);
        if (newLenLook < 0.5) {
            return;
        }
        const dir = normalizeVec3(vec, tempVec3c);
        this.eye = addVec3(this.#state.look, mulVec3Scalar(dir, newLenLook), tempVec3d);
    }

    // /**
    //  * Gets this Camera as JSON.
    //  */
    // getJSON(): CameraParams {
    //     const cameraParams = <CameraParams>{
    //         eye: Array.from(this.#state.eye),
    //         look: Array.from(this.#state.look),
    //         up: Array.from(this.#state.up),
    //         worldUp: Array.from(this.#state.worldUp),
    //         worldRight: Array.from(this.#state.worldRight),
    //         worldForward: Array.from(this.#state.worldForward),
    //         projectionType: this.projectionType
    //     };
    //     return cameraParams;
    // }

    /**
     * @private
     */
    destroy() {
        super.destroy();
        this.onProjectionType.clear();
        this.onViewMatrix.clear();
        this.onProjMatrix.clear();
        this.onWorldAxis.clear();
    }


}

export {Camera};
