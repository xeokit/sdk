import {addVec3, createVec3, lenVec3, lerpMat4, lerpVec3, mulVec3Scalar, normalizeVec3, subVec3} from "../matrix";
import type {Camera} from "../viewer";
import {scheduler, View} from "../viewer";
import {Component, EventEmitter} from "../core";
import {CustomProjectionType, OrthoProjectionType, PerspectiveProjectionType} from "../constants";
import {DEGTORAD, type FloatArrayParam} from "../math";
import {getAABB3Center, getAABB3Diag, getAABB3DiagPoint} from "../boundaries";
import {EventDispatcher} from "strongly-typed-events";
import {getSceneAABBIndex} from "../aabb";

const tempVec3 = createVec3();
const newLook = createVec3();
const newEye = createVec3();
const newUp = createVec3();
const newLookEyeVec = createVec3();

/**
 * Parameters for {@link CameraFlightAnimation.flyTo} and {@link CameraFlightAnimation.jumpTo}.
 */
export interface FlyToParams {

  /**
   * Specifies the projection type to transition to.
   * Use either `PerspectiveProjectionType` or `OrthoProjectionType`.
   */
  projection?: number;

  /**
   * Target orthographic scale, used when transitioning to an orthographic projection.
   */
  orthoScale?: number;

  /**
   * Target axis-aligned bounding box (AABB) in world coordinates for the camera to focus on.
   */
  aabb?: FloatArrayParam;

  /**
   * Target distance between the camera and its point-of-interest.
   */
  length?: number;

  /**
   * Target position for the camera eye.
   */
  eye?: FloatArrayParam;

  /**
   * Target position for the camera to look at.
   */
  look?: FloatArrayParam;

  /**
   * Target "up" vector for the camera orientation.
   */
  up?: FloatArrayParam;

  /**
   * Optional point-of-interest in world coordinates for the camera to focus on.
   */
  poi?: FloatArrayParam;

  /**
   * In perspective projection mode, defines how much of the field-of-view
   * the bounding volume should occupy upon arrival. Expressed in degrees.
   */
  fitFOV?: number;

  /**
   * Duration of the animation in seconds.
   */
  duration?: number;
}

/**
 * Animates a {@link viewer!View | View}'s {@link viewer!Camera | Camera}
 * to smoothly transition to a specified target, such as a component, bounding box, or viewpoint.
 *
 * Use {@link cameraflight | @xeokit/sdk/cameraflight} to create cinematic camera motions.
 */
export class CameraFlightAnimation extends Component {

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
   * Fires when the camera animation starts.
   */
  readonly onStarted: EventEmitter<CameraFlightAnimation, null>;

  /**
   * Fires when the camera animation completes.
   */
  readonly onStopped: EventEmitter<CameraFlightAnimation, null>;

  /**
   * Fires when the camera animation is cancelled.
   */
  readonly onCancelled: EventEmitter<CameraFlightAnimation, null>;
  #aabbIndex: any;

  /**
   * Creates a new CameraFlightAnimation instance.
   *
   * @param view The {@link viewer!View | View} whose {@link viewer!Camera | Camera} will be animated.
   * @param cfg Optional configuration.
   * @param cfg.duration Default animation duration in seconds for {@link CameraFlightAnimation.flyTo}.
   */
  constructor(view: View, cfg?: {
    duration: number
  }) {

    super(view, cfg);

    if (!(view instanceof View)) {
      throw "[CameraFlightAnimation] Expected instance of View";
    }

    this.view = view;
    this.#aabbIndex = getSceneAABBIndex(view.viewer.scene);
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
    this.#fitFOV = 60;

    this.onStarted = new EventEmitter(new EventDispatcher<CameraFlightAnimation, null>());
    this.onStopped = new EventEmitter(new EventDispatcher<CameraFlightAnimation, null>());
    this.onCancelled = new EventEmitter(new EventDispatcher<CameraFlightAnimation, null>());
  }

  /**
   * Animates the camera to a target viewpoint or bounding volume.
   *
   * - If a bounding box is provided, the camera will fly to frame the box within the view.
   * - If `eye`, `look`, and `up` are provided, the camera will interpolate to that exact pose.
   *
   * @param params Parameters defining the flight target and behavior.
   * @param callback Optional callback invoked after the flight completes.
   */

  flyTo(params: FlyToParams = {},
        callback?: (arg0: any) => void) {

    if (this.#flying) {
      this.stop();
    }

    this.#flying = false;
    this.#flyingEye = false;
    this.#flyingLook = false;
    this.#flyingEyeLookUp = false;

    this.#callback = callback || function () {
    };

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
        aabb = this.#aabbIndex.getSceneAABB();
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
   * Instantly moves the camera to a specified viewpoint or bounding volume, without animation.
   *
   * - If a bounding box is provided, the camera will immediately frame it in the view.
   * - If `eye`, `look`, and `up` are provided, the camera will immediately assume that pose.
   *
   * @param params Target camera state or bounding box.
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
      aabb = this.#aabbIndex.getSceneAABB();
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
   * Stops an earlier {@link CameraFlightAnimation.flyTo | CameraFlightAnimation.flyTo}, fires arrival callback, then "stopped" event.
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
   * When flying to a {@link scene!SceneModel | SceneModel}, {@link viewer!ViewObject | ViewObject} or boundary, indicates if the CameraFlightAnimation always adjusts
   * the distance of {@link viewer!Camera.eye | Camera.eye} from {@link viewer!Camera.look | Camera.look} to ensure that the target always fits in view.
   *
   * When false, the eye will remain fixed at its current distance from the look position.
   *
   * Default value is ````true````.
   */
  set fit(value: boolean) {
    this.#fit = value;
  }

  /**
   * When flying to a {@link scene!SceneModel | SceneModel}, {@link viewer!ViewObject | ViewObject} or boundary, indicates if the CameraFlightAnimation always adjusts
   * the distance of {@link viewer!Camera.eye | Camera.eye} from {@link viewer!Camera.look | Camera.look} to ensure that the target always fits in view.
   *
   * When false, the eye will remain fixed at its current distance from the look position.
   *
   * Default value is ````true````.
   */
  get fit(): boolean {
    return this.#fit;
  }

  /**
   * Sets how much of the perspective field-of-view, in degrees, that a target {@link viewer!ViewObject | ViewObject} should
   * fill the canvas when calling {@link CameraFlightAnimation.flyTo | CameraFlightAnimation.flyTo} or {@link CameraFlightAnimation.jumpTo | CameraFlightAnimation.jumpTo}.
   *
   * Default value is ````45````.
   */
  set fitFOV(value: number) {
    this.#fitFOV = value;
  }

  /**
   * Gets how much of the perspective field-of-view, in degrees, that a target {@link viewer!ViewObject | ViewObject} should
   * fill the canvas when calling {@link CameraFlightAnimation.flyTo | CameraFlightAnimation.flyTo} or {@link CameraFlightAnimation.jumpTo | CameraFlightAnimation.jumpTo}.
   *
   * Default value is ````45````.
   */
  get fitFOV(): number {
    return this.#fitFOV;
  }

  /**
   * Indicates if this CameraFlightAnimation will orient the {@link viewer!Camera | Camera}
   * in the direction that it is flying.
   *
   * Default value is ````false````.
   */
  set trail(value: boolean) {
    this.#trail = value;
  }

  /**
   * Indicates if this CameraFlightAnimation will orient the {@link viewer!Camera | Camera}
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
