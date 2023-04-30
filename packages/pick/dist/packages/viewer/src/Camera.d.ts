import { PerspectiveProjection } from './PerspectiveProjection';
import { OrthoProjection } from './OrthoProjection';
import type { FrustumProjection } from './FrustumProjection';
import { CustomProjection } from './CustomProjection';
import type { View } from "./View";
import { Component, EventEmitter } from "@xeokit/core";
import { FloatArrayParam } from "@xeokit/math";
import { Frustum3 } from "@xeokit/boundaries";
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
 * * Can be flown to look at targets using the View's {@link CameraFlightAnimation}
 * * Can be animated along a path using a {@link CameraPathAnimation}
 *
 * ## Getting a View's Camera
 *
 * Let's create a {@link @xeokit/viewer!Viewer} with a single {@link @xeokit/viewer!View}, from which we'll get a Camera:
 *
 * ````javascript
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
declare class Camera extends Component {
    #private;
    /**
     * The View to which this Camera belongs.
     *
     * @property view
     * @type {View}
     * @final
     */
    readonly view: View;
    /**
     * The perspective projection.
     *
     * The Camera uses this while {@link Camera.projectionType} equals {@link PerspectiveProjectionType}.
     */
    readonly perspectiveProjection: PerspectiveProjection;
    /**
     * The orthographic projection.
     *
     * The Camera uses this while {@link Camera.projectionType} equals {@link OrthoProjectionType}.
     */
    readonly orthoProjection: OrthoProjection;
    /**
     * The frustum projection.
     *
     * The Camera uses this while {@link Camera.projectionType} equals {@link FrustumProjectionType}.
     */
    readonly frustumProjection: FrustumProjection;
    /**
     * The custom projection.
     *
     * The Camera uses this while {@link Camera.projectionType} equals {@link CustomProjectionType}.
     */
    readonly customProjection: CustomProjection;
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
    /**
     * @private
     */
    constructor(view: View, cfg?: {
        eye?: FloatArrayParam;
        look?: FloatArrayParam;
        up?: FloatArrayParam;
        deviceMatrix?: FloatArrayParam;
        gimbalLock?: boolean;
        worldAxis?: FloatArrayParam;
        constrainPitch?: boolean;
        projectionType?: number;
    });
    /**
     * Gets the currently active projection for this Camera.
     *
     * The currently active project is selected with {@link Camera.projectionType}.
     *
     * @returns {PerspectiveProjection|OrthoProjection|FrustumProjection|CustomProjection} The currently active projection is active.
     */
    get project(): PerspectiveProjection | OrthoProjection | FrustumProjection | CustomProjection;
    /**
     * Gets the position of the Camera's eye.
     *
     * Default vale is ````[0,0,10]````.
     *
     * @type {Number[]} New eye position.
     */
    get eye(): FloatArrayParam;
    /**
     * Sets the position of the Camera's eye.
     *
     * Default value is ````[0,0,10]````.
     *
     * @emits "eye" event on change, with the value of this property.
     * @type {Number[]} New eye position.
     */
    set eye(eye: FloatArrayParam);
    /**
     * Gets the position of this Camera's point-of-interest.
     *
     * Default value is ````[0,0,0]````.
     *
     * @returns {Number[]} Camera look position.
     */
    get look(): FloatArrayParam;
    /**
     * Sets the position of this Camera's point-of-interest.
     *
     * Default value is ````[0,0,0]````.
     *
     * @param look Camera look position.
     */
    set look(look: FloatArrayParam);
    /**
     * Gets the direction of this Camera's {@link Camera.up} vector.
     *
     * @returns {Number[]} Direction of "up".
     */
    get up(): FloatArrayParam;
    /**
     * Sets the direction of this Camera's {@link Camera.up} vector.
     *
     * @param up Direction of "up".
     */
    set up(up: FloatArrayParam);
    /**
     * Gets the direction of World-space "up".
     *
     * This is set by {@link Camera.worldAxis}.
     *
     * Default value is ````[0,1,0]````.
     *
     * @returns {Number[]} The "up" vector.
     */
    get worldUp(): FloatArrayParam;
    /**
     * Gets the direction of World-space "right".
     *
     * This is set by {@link Camera.worldAxis}.
     *
     * Default value is ````[1,0,0]````.
     *
     * @returns {Number[]} The "up" vector.
     */
    get worldRight(): FloatArrayParam;
    /**
     * Gets the direction of World-space "forwards".
     *
     * This is set by {@link Camera.worldAxis}.
     *
     * Default value is ````[0,0,1]````.
     *
     * @returns {Number[]} The "up" vector.
     */
    get worldForward(): FloatArrayParam;
    /**
     * Gets whether to prevent camera from being pitched upside down.
     *
     * The camera is upside down when the angle between {@link Camera.up} and {@link Camera.worldUp} is less than one degree.
     *
     * Default value is ````false````.
     *
     * @returns {Boolean} ````true```` if pitch rotation is currently constrained.
     */
    get constrainPitch(): boolean;
    /**
     * Sets whether to prevent camera from being pitched upside down.
     *
     * The camera is upside down when the angle between {@link Camera.up} and {@link Camera.worldUp} is less than one degree.
     *
     * Default value is ````false````.
     *
     * @param value Set ````true```` to contrain pitch rotation.
     */
    set constrainPitch(value: boolean);
    /**
     * Gets whether to lock yaw rotation to pivot about the World-space "up" axis.
     *
     * @returns {Boolean} Returns ````true```` if gimbal is locked.
     */
    get gimbalLock(): boolean;
    /**
     * Sets whether to lock yaw rotation to pivot about the World-space "up" axis.
     *
     * @params {Boolean} gimbalLock Set true to lock gimbal.
     */
    set gimbalLock(value: boolean);
    /**
     * Gets the up, right and forward axis of the World coordinate system.
     *
     * Has format: ````[rightX, rightY, rightZ, upX, upY, upZ, forwardX, forwardY, forwardZ]````
     *
     * Default axis is ````[1, 0, 0, 0, 1, 0, 0, 0, 1]````
     *
     * @returns {Number[]} The current World coordinate axis.
     */
    get worldAxis(): FloatArrayParam;
    /**
     * Sets the up, right and forward axis of the World coordinate system.
     *
     * Has format: ````[rightX, rightY, rightZ, upX, upY, upZ, forwardX, forwardY, forwardZ]````
     *
     * Default axis is ````[1, 0, 0, 0, 1, 0, 0, 0, 1]````
     *
     * @param axis The new Wworld coordinate axis.
     */
    set worldAxis(axis: FloatArrayParam);
    /**
     * Gets an optional matrix to premultiply into {@link Camera.projMatrix} matrix.
     *
     * @returns {Number[]} The matrix.
     */
    get deviceMatrix(): FloatArrayParam;
    /**
     * Sets an optional matrix to premultiply into {@link Camera.projMatrix} matrix.
     *
     * This is intended to be used for stereo rendering with WebVR etc.
     *
     * @param matrix The matrix.
     */
    set deviceMatrix(matrix: FloatArrayParam);
    /**
     * Gets if the World-space X-axis is "up".
     * @returns {boolean}
     */
    get xUp(): boolean;
    /**
     * Gets if the World-space Y-axis is "up".
     * @returns {boolean}
     */
    get yUp(): boolean;
    /**
     * Gets if the World-space Z-axis is "up".
     * @returns {boolean}
     */
    get zUp(): boolean;
    /**
     * Gets distance from {@link Camera.look} to {@link Camera.eye}.
     *
     * @returns {Number} The distance.
     */
    get eyeLookDist(): number;
    /**
     * Gets the Camera's viewing transformation matrix.
     *
     * @returns {Number[]} The viewing transform matrix.
     */
    get viewMatrix(): FloatArrayParam;
    /**
     * Gets the inverse of the Camera's viewing transform matrix.
     *
     * @returns {Number[]} The inverse viewing transform matrix.
     */
    get inverseViewMatrix(): FloatArrayParam;
    /**
     * Gets the Camera's projection transformation projMatrix.
     *
     * @returns {Number[]} The projection matrix.
     */
    get projMatrix(): FloatArrayParam;
    /**
     * Gets the Camera's 3D World-space viewing frustum.
     *
     * @returns {Frustum3} The frustum.
     */
    get frustum(): Frustum3;
    /**
     * Gets the active projection type.
     *
     * Possible values are ````PerspectiveProjectionType````, ````OrthoProjectionType````, ````"frustum"```` and ````"customProjection"````.
     *
     * Default value is ````PerspectiveProjectionType````.
     *
     * @returns {number} Identifies the active projection type.
     */
    get projectionType(): number;
    /**
     * Sets the active projection type.
     *
     * Accepted values are ````PerspectiveProjectionType````, ````OrthoProjectionType````, ````"frustum"```` and ````"customProjection"````.
     *
     * Default value is ````PerspectiveProjectionType````.
     *
     * @param value Identifies the active projection type.
     */
    set projectionType(value: number | undefined);
    clean(): void;
    /**
     * Rotates {@link Camera.eye} about {@link Camera.look}, around the {@link Camera.up} vector
     *
     * @param angleInc Angle of rotation in degrees
     */
    orbitYaw(angleInc: number): void;
    /**
     * Rotates {@link Camera.eye} about {@link Camera.look} around the right axis (orthogonal to {@link Camera.up} and "look").
     *
     * @param angleInc Angle of rotation in degrees
     */
    orbitPitch(angleInc: number): void;
    /**
     * Rotates {@link Camera.look} about {@link Camera.eye}, around the {@link Camera.up} vector.
     *
     * @param angleInc Angle of rotation in degrees
     */
    yaw(angleInc: number): void;
    /**
     * Rotates {@link Camera.look} about {@link Camera.eye}, around the right axis (orthogonal to {@link Camera.up} and "look").

     * @param angleInc Angle of rotation in degrees
     */
    pitch(angleInc: number): void;
    /**
     * Pans the Camera along its local X, Y and Z axis.
     *
     * @param pan The pan vector
     */
    pan(pan: FloatArrayParam): void;
    /**
     * Increments/decrements the Camera's zoom factor, which is the distance between {@link Camera.eye} and {@link Camera.look}.
     *
     * @param delta Zoom factor increment.
     */
    zoom(delta: number): void;
    /**
     * @private
     */
    destroy(): void;
}
export { Camera };
