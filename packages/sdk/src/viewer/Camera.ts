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
} from "../matrix";
import {SDKErrorType, SDKResult} from "../core";
import {
  CustomProjectionType,
  FrustumProjectionType,
  OrthoProjectionType,
  PerspectiveProjectionType
} from "../constants";
import {DEGTORAD, type FloatArrayParam} from "../math";
import {Frustum3, setFrustum3} from "../boundaries";
import type {CameraParams} from "./CameraParams";
import {CustomProjection} from './CustomProjection';
import {FrustumProjection} from './FrustumProjection';
import {OrthoProjection} from './OrthoProjection';
import {PerspectiveProjection} from './PerspectiveProjection';
import type {Projection} from "./Projection";
import type {View} from "./View";
import {SDKTask} from "../core/SDKTask";
import {PerspectiveProjectionParams} from "./PerspectiveProjectionParams";
import {OrthoProjectionParams} from "./OrthoProjectionParams";
import {FrustumProjectionParams} from "./FrustumProjectionParams";
import {CustomProjectionParams} from "./CustomProjectionParams";


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
 * Controls the viewpoint and projection for a {@link View}.
 *
 * * Located at {@link View.camera | View.camera}
 * * Provides methods to pan, zoom and orbit
 * * Orbit and first-person modes
 * * Dynamically configurable World-space axis
 * * Has {@link PerspectiveProjection}, {@link OrthoProjection} and {@link FrustumProjection} and {@link CustomProjection}, which you can dynamically switch between
 * * Switchable gimbal lock
 *
 * ## Getting a View's Camera
 *
 * Let's create a {@link Viewer | Viewer} with a single {@link View}, from which we'll get a Camera:
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
 * {@link ViewerEvents.onCameraViewMatrixUpdated} fires whenever {@link Camera.viewMatrix} updates:
 *
 * ````javascript
 * camera.onViewMatrix.subscribe((camera, matrix) => { ... });
 * ````
 *
 * ## Rotating the Camera
 *
 * Orbiting the {@link Camera.look | Camera.look} position:
 *
 * ````javascript
 * camera.orbitYaw(20.0);
 * camera.orbitPitch(10.0);
 * ````
 *
 * Perform a *first-person* rotation, in which we rotate {@link Camera.look | Camera.look} and {@link Camera.up | Camera.up} about {@link Camera.eye | Camera.eye}:
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
 * Zoom to vary distance between {@link Camera.eye | Camera.eye} and {@link Camera.look | Camera.look}:
 *
 * ````javascript
 * camera.zoom(-5); // Move five units closer
 * ````
 *
 * Get the current distance between {@link Camera.eye | Camera.eye} and {@link Camera.look | Camera.look}:
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
class Camera {

  /**
   * The View to which this Camera belongs.
   *
   * @property view
   * @type {View}
   *
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
   * The Camera uses this while {@link Camera.projectionType} equals {@link constants!OrthoProjectionType}.
   */
  public readonly orthoProjection: OrthoProjection;

  /**
   * The frustum projection.
   *
   * The Camera uses this while {@link Camera.projectionType} equals {@link constants!FrustumProjectionType}.
   */
  public readonly frustumProjection: FrustumProjection;

  /**
   * The custom projection.
   *
   * The Camera uses this while {@link Camera.projectionType} equals {@link constants!CustomProjectionType}.
   */
  public readonly customProjection: CustomProjection;

  private _destroyed: boolean = false;
  private _deviceMatrix: FloatArrayParam;
  private _viewNormalMatrix: FloatArrayParam;
  private _hasDeviceMatrix: boolean;
  private _viewMatrix: FloatArrayParam;
  private _inverseViewMatrix: FloatArrayParam;
  private _eye: FloatArrayParam;
  private _look: FloatArrayParam;
  private _up: FloatArrayParam;
  private _gimbalLock: boolean;
  private _constrainPitch: boolean;
  private _projectionType: number;
  private _frustum: Frustum3;
  private _activeProjection: PerspectiveProjection | OrthoProjection | FrustumProjection | CustomProjection;
  private _task: SDKTask;

  /**
   * @private
   */
  constructor(view: View, cfg: CameraParams = {}) {

    this.view = view;
    this.perspectiveProjection = new PerspectiveProjection(this);
    this.orthoProjection = new OrthoProjection(this);
    this.frustumProjection = new FrustumProjection(this);
    this.customProjection = new CustomProjection(this);

    this._eye = createVec3(cfg.eye || [0, -10, 0]);
    this._look = createVec3(cfg.look || [0, 0, 0]);
    this._up = createVec3(cfg.up || [0, 0, 1]);
    this._gimbalLock = cfg.gimbalLock !== false;
    this._constrainPitch = cfg.constrainPitch === true;
    this._projectionType = cfg.projectionType || PerspectiveProjectionType;
    this._deviceMatrix = cfg.deviceMatrix ? createMat4(cfg.deviceMatrix) : identityMat4();
    this._hasDeviceMatrix = !!cfg.deviceMatrix;
    this._viewMatrix = createMat4();
    this._viewNormalMatrix = createMat4();
    this._inverseViewMatrix = createMat4();
    this._frustum = new Frustum3();
    this._activeProjection = this.perspectiveProjection;

    this.perspectiveProjection.onProjMatrix.subscribe(() => {
      if (this._projectionType === PerspectiveProjectionType) {
        this.view.needsRender();
        this.view.viewer.events.onCameraProjMatrixUpdated.dispatch(this.view, this);
      }
    });

    this.orthoProjection.onProjMatrix.subscribe(() => {
      if (this._projectionType === OrthoProjectionType) {
        this.view.needsRender();
        this.view.viewer.events.onCameraProjMatrixUpdated.dispatch(this.view, this);
      }
    });

    this.frustumProjection.onProjMatrix.subscribe(() => {
      if (this._projectionType === FrustumProjectionType) {
        this.view.needsRender();
        this.view.viewer.events.onCameraProjMatrixUpdated.dispatch(this.view, this);
      }
    });

    this.customProjection.onProjMatrix.subscribe(() => {
      if (this._projectionType === CustomProjectionType) {
        this.view.needsRender();
        this.view.viewer.events.onCameraProjMatrixUpdated.dispatch(this.view, this);
      }
    });

    this._task = new SDKTask(() => {

      // In ortho mode, build the view matrix with an eye position that's translated
      // well back from look, so that the front sectionPlane plane doesn't unexpectedly cut
      // the front off the view (not a problem with perspective, since objects close enough
      // to be clipped by the front plane are usually too big to see anything of their cross-sections).

      let eye;

      if (this.projectionType === OrthoProjectionType) {
        subVec3(this._eye, this._look, eyeLookVec);
        normalizeVec3(eyeLookVec, eyeLookVecNorm);
        mulVec3Scalar(eyeLookVecNorm, 1000.0, eyeLookOffset);
        addVec3(this._look, eyeLookOffset, offsetEye);
        eye = offsetEye;
      } else {
        eye = this._eye;
      }

      if (this._hasDeviceMatrix) {
        lookAtMat4v(eye, this._look, this._up, tempMatb);
        mulMat4(this._deviceMatrix, tempMatb, this._viewMatrix);
      } else {
        lookAtMat4v(eye, this._look, this._up, this._viewMatrix);
      }

      inverseMat4(this._viewMatrix, this._inverseViewMatrix);
      transposeMat4(this._inverseViewMatrix, this._viewNormalMatrix);
      setFrustum3(this._viewMatrix, this._activeProjection.projMatrix, this._frustum);

      const events = this.view.viewer.events;

      events.onCameraViewMatrixUpdated.dispatch(this.view, this);
      events.onCameraFrustumUpdated.dispatch(this, this._frustum);

      this.view.needsRender();
    }, SDKTask.PHASE_0);
  }

  /**
   * Gets the currently active projection for this Camera.
   *
   * The currently active project is selected with {@link Camera.projectionType}.
   *
   * @returns {PerspectiveProjection|OrthoProjection|FrustumProjection|CustomProjection} The currently active projection is active.
   */
  get projection(): Projection {
    return this._activeProjection;
  }

  /**
   * Gets the position of the Camera's eye.
   *
   * Default vale is ````[0,-10,0]````.
   *
   * @type {Number[]} New eye position.
   */
  get eye(): FloatArrayParam {
    return this._eye;
  }

  /**
   * Sets the position of the Camera's eye.
   *
   * Default value is ````[0,-10,0]````.
   *
   * @type {Number[]} New eye position.
   */
  set eye(eye: FloatArrayParam) {
    // @ts-ignore
    this._eye.set(eye);
    this._task.schedule(); // Ensure matrix built on next "tick"
  }

  /**
   * Gets the position of this Camera's point-of-interest.
   *
   * Default value is ````[0,0,0]````.
   *
   * @returns {Number[]} Camera look position.
   */
  get look(): FloatArrayParam {
    return this._look;
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
    this._look.set(look);
    this._task.schedule(); // Ensure matrix built on next "tick"
  }

  /**
   * Gets the direction of this Camera's {@link Camera.up | Camera.up} vector.
   *
   * @returns {Number[]} Direction of "up".
   */
  get up(): FloatArrayParam {
    return this._up;
  }

  /**
   * Sets the direction of this Camera's {@link Camera.up | Camera.up} vector.
   *
   * @param up Direction of "up".
   */
  set up(up: FloatArrayParam) {
    // @ts-ignore
    this._up.set(up);
    this._task.schedule();
  }

  /**
   * Gets whether to prevent camera from being pitched upside down.
   *
   * The camera is upside down when the angle between {@link Camera.up | Camera.up} and {@link Camera.worldUp} is less than one degree.
   *
   * Default value is ````false````.
   *
   * @returns {Boolean} ````true```` if pitch rotation is currently constrained.
   */
  get constrainPitch(): boolean {
    return this._constrainPitch;
  }

  /**
   * Sets whether to prevent camera from being pitched upside down.
   *
   * The camera is upside down when the angle between {@link Camera.up | Camera.up} and {@link Camera.worldUp} is less than one degree.
   *
   * Default value is ````false````.
   *
   * @param value Set ````true```` to contrain pitch rotation.
   */
  set constrainPitch(value: boolean) {
    this._constrainPitch = value;
  }

  /**
   * Gets whether to lock yaw rotation to pivot about the World-space "up" axis.
   *
   * @returns {Boolean} Returns ````true```` if gimbal is locked.
   */
  get gimbalLock(): boolean {
    return this._gimbalLock;
  }

  /**
   * Sets whether to lock yaw rotation to pivot about the World-space "up" axis.
   *
   * @param {Boolean} value Set true to lock gimbal.
   */
  set gimbalLock(value: boolean) {
    this._gimbalLock = value;
  }

  /**
   * Gets an optional matrix to premultiply into {@link Camera.projMatrix} matrix.
   *
   * @returns {Number[]} The matrix.
   */
  get deviceMatrix(): FloatArrayParam {
    return this._deviceMatrix;
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
    this._deviceMatrix.set(matrix || [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
    this._hasDeviceMatrix = !!matrix;
    this._task.schedule();
  }

  /**
   * Gets distance from {@link Camera.look | Camera.look} to {@link Camera.eye | Camera.eye}.
   *
   * @returns {Number} The distance.
   */
  get eyeLookDist(): number {
    return lenVec3(subVec3(this._look, this._eye, tempVec3));
  }

  /**
   * Gets the Camera's viewing transformation matrix.
   *
   * @returns {Number[]} The viewing transform matrix.
   */
  get viewMatrix(): FloatArrayParam {
    if (this._task.scheduled) {
      this._task.runIfScheduled();
    }
    return this._viewMatrix;
  }

  /**
   * Gets the inverse of the Camera's viewing transform matrix.
   *
   * @returns {Number[]} The inverse viewing transform matrix.
   */
  get inverseViewMatrix(): FloatArrayParam {
    if (this._task.scheduled) {
      this._task.runIfScheduled();
    }
    return this._inverseViewMatrix;
  }

  /**
   * Gets the Camera's projection transformation projMatrix.
   *
   * @returns {Number[]} The projection matrix.
   */
  get projMatrix(): FloatArrayParam {
    // @ts-ignore
    return this._activeProjection.projMatrix;
  }

  /**
   * Gets the Camera's 3D World-space viewing frustum.
   *
   * @returns {Frustum3} The frustum.
   */
  get frustum() {
    if (this._task.scheduled) {
      this._task.runIfScheduled();
    }
    return this._frustum;
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
    return this._projectionType;
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
    if (this._projectionType === value) {
      return;
    }
    if (value === PerspectiveProjectionType) {
      this._activeProjection = this.perspectiveProjection;
    } else if (value === OrthoProjectionType) {
      this._activeProjection = this.orthoProjection;
    } else if (value === FrustumProjectionType) {
      this._activeProjection = this.frustumProjection;
    } else if (value === CustomProjectionType) {
      this._activeProjection = this.customProjection;
    } else {
      this.view.viewer.logError({
        ok: false,
        type: SDKErrorType.InvalidInput,
        error: `[Camera.projectionType] Unsupported value for 'projection': ${value} defaulting to PerspectiveProjectionType.`
      });
      this._activeProjection = this.perspectiveProjection;
      value = PerspectiveProjectionType;
    }
    // @ts-ignore
    this._activeProjection.clean();
    this._projectionType = value;
    this._task.clean();
    const events = this.view.viewer.events;
    events.onCameraProjectionTypeChanged.dispatch(this.view, this);
    events.onCameraProjMatrixUpdated.dispatch(this.view, this);
  }

  /**
   * Rotates {@link Camera.eye | Camera.eye} about {@link Camera.look | Camera.look}, around the {@link Camera.up | Camera.up} vector
   *
   * @param angleInc Angle of rotation in degrees
   */
  orbitYaw(angleInc: number) {
    let lookEyeVec = subVec3(this._eye, this._look, tempVec3);
    rotationMat4v(angleInc * 0.0174532925, this._gimbalLock ? this.view.viewer.scene.coordinateSystem.worldUp : this._up, tempMat);
    lookEyeVec = transformPoint3(tempMat, lookEyeVec, tempVec3b);
    this.eye = addVec3(this._look, lookEyeVec, tempVec3c); // Set eye position as 'look' plus 'eye' vector
    this.up = transformPoint3(tempMat, this._up, tempVec3d); // Rotate 'up' vector
  }

  /**
   * Rotates {@link Camera.eye | Camera.eye} about {@link Camera.look | Camera.look} around the right axis (orthogonal to {@link Camera.up | Camera.up} and "look").
   *
   * @param angleInc Angle of rotation in degrees
   */
  orbitPitch(angleInc: number) {
    if (this._constrainPitch) {
      angleInc = dotVec3(this._up, this.view.viewer.scene.coordinateSystem.worldUp) / DEGTORAD;
      if (angleInc < 1) {
        return;
      }
    }
    let eye2 = subVec3(this._eye, this._look, tempVec3);
    const left = cross3Vec3(normalizeVec3(eye2, tempVec3b), normalizeVec3(this._up, tempVec3c));
    rotationMat4v(angleInc * 0.0174532925, left, tempMat);
    eye2 = transformPoint3(tempMat, eye2, tempVec3d);
    this.up = transformPoint3(tempMat, this._up, tempVec3e);
    this.eye = addVec3(eye2, this._look, tempVec3f);
  }

  /**
   * Rotates {@link Camera.look | Camera.look} about {@link Camera.eye | Camera.eye}, around the {@link Camera.up | Camera.up} vector.
   *
   * @param angleInc Angle of rotation in degrees
   */
  yaw(angleInc: number) {
    let look2 = subVec3(this._look, this._eye, tempVec3);
    rotationMat4v(angleInc * 0.0174532925, this._gimbalLock ? this.view.viewer.scene.coordinateSystem.worldUp : this._up, tempMat);
    look2 = transformPoint3(tempMat, look2, tempVec3b);
    this.look = addVec3(look2, this._eye, tempVec3c);
    if (this._gimbalLock) {
      this.up = transformPoint3(tempMat, this._up, tempVec3d);
    }
  }

  /**
   * Rotates {@link Camera.look | Camera.look} about {@link Camera.eye | Camera.eye}, around the right axis (orthogonal to {@link Camera.up | Camera.up} and "look").

   * @param angleInc Angle of rotation in degrees
   */
  pitch(angleInc: number) {
    if (this._constrainPitch) {
      angleInc = dotVec3(this._up, this.view.viewer.scene.coordinateSystem.worldUp) / DEGTORAD;
      if (angleInc < 1) {
        return;
      }
    }
    let look2 = subVec3(this._look, this._eye, tempVec3);
    const left = cross3Vec3(normalizeVec3(look2, tempVec3b), normalizeVec3(this._up, tempVec3c));
    rotationMat4v(angleInc * 0.0174532925, left, tempMat);
    this.up = transformPoint3(tempMat, this._up, tempVec3f);
    look2 = transformPoint3(tempMat, look2, tempVec3d);
    this.look = addVec3(look2, this._eye, tempVec3e);
  }

  /**
   * Pans the Camera along its local X, Y and Z axis.
   *
   * @param pan The pan vector
   */
  pan(pan: FloatArrayParam) {
    const eye2 = subVec3(this._eye, this._look, tempVec3);
    const vec = [0, 0, 0];
    let v;
    if (pan[0] !== 0) {
      const left = cross3Vec3(normalizeVec3(eye2, []), normalizeVec3(this._up, tempVec3b));
      v = mulVec3Scalar(left, pan[0]);
      vec[0] += v[0];
      vec[1] += v[1];
      vec[2] += v[2];
    }
    if (pan[1] !== 0) {
      v = mulVec3Scalar(normalizeVec3(this._up, tempVec3c), pan[1]);
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
    this.eye = addVec3(this._eye, vec, tempVec3e);
    this.look = addVec3(this._look, vec, tempVec3f);
  }

  /**
   * Increments/decrements the Camera's zoom factor, which is the distance between {@link Camera.eye | Camera.eye} and {@link Camera.look | Camera.look}.
   *
   * @param delta Zoom factor increment.
   */
  zoom(delta: number) {
    const vec = subVec3(this._eye, this._look, tempVec3);
    const lenLook = Math.abs(lenVec3(vec));
    const newLenLook = Math.abs(lenLook + delta);
    if (newLenLook < 0.5) {
      return;
    }
    const dir = normalizeVec3(vec, tempVec3c);
    this.eye = addVec3(this._look, mulVec3Scalar(dir, newLenLook), tempVec3d);
  }

  /**
   * Gets the configuration of this Camera.
   */
  toParams(): SDKResult<CameraParams, string> {
    if (this._destroyed) {
      return this.view.viewer.logError({
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: "[Camera.toParams] Camera already destroyed"
      });
    }
    const cameraParams: CameraParams = {
      eye: Array.from(this._eye),
      look: Array.from(this._look),
      up: Array.from(this._up),
      gimbalLock: this.gimbalLock,
      constrainPitch: this.constrainPitch,
      projectionType: this.projectionType,
      perspectiveProjection: (<{value:PerspectiveProjectionParams}>this.perspectiveProjection.toParams()).value,
      orthoProjection:  (<{value:OrthoProjectionParams}>this.orthoProjection.toParams()).value,
      frustumProjection:  (<{value:FrustumProjectionParams}>this.frustumProjection.toParams()).value,
      customProjection:  (<{value:CustomProjectionParams}>this.customProjection.toParams()).value,
    }
    return {
      ok: true,
      value: cameraParams
    };
  }

  /**
   * Configures this Camera.
   * @param cameraParams
   */
  fromParams(cameraParams: CameraParams): SDKResult<any, string> {
    if (this._destroyed) {
      return this.view.viewer.logError({
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: "[Camera.fromParams] Camera already destroyed"
      });
    }
    if (cameraParams.eye) {
      this.eye = cameraParams.eye;
    }
    if (cameraParams.look) {
      this.look = cameraParams.look;
    }
    if (cameraParams.up) {
      this.up = cameraParams.up;
    }
    if (cameraParams.constrainPitch !== undefined) {
      this.constrainPitch = cameraParams.constrainPitch;
    }
    if (cameraParams.gimbalLock !== undefined) {
      this.gimbalLock = cameraParams.gimbalLock;
    }
    if (cameraParams.perspectiveProjection) {
      this.perspectiveProjection.fromParams(cameraParams.perspectiveProjection);
    }
    if (cameraParams.orthoProjection) {
      this.orthoProjection.fromParams(cameraParams.orthoProjection);
    }
    if (cameraParams.frustumProjection) {
      this.frustumProjection.fromParams(cameraParams.frustumProjection);
    }
    if (cameraParams.projectionType !== undefined) {
      this.projectionType = cameraParams.projectionType;
    }
    return {
      ok: true,
      value: null
    };
  }

  /**
   * @private
   */
  destroy() {
    this._destroyed = true;
    this._task.destroy();
  }
}

export {Camera};
