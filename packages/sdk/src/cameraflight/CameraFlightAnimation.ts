import {
  addVec3,
  createVec3Float64,
  type Mat4, type Vec3,
  lenVec3,
  lerpMat4,
  lerpVec3,
  mulVec3Scalar,
  normalizeVec3,
  subVec3
} from "../math";
import type {Camera} from "../viewer";
import { View} from "../viewer";
import {EventEmitter, SDKTask} from "../core";
import {CustomProjectionType, OrthoProjectionType, PerspectiveProjectionType} from "../constants";
import {DEGTORAD, } from "../math";
import {createAABB3Float64,getAABB3Center, getAABB3Diag, getAABB3DiagPoint, type AABB3} from "../math/boundaries";
import {EventDispatcher} from "strongly-typed-events";
import {getSceneAABBIndex} from "../aabb";

const tempVec3 = createVec3Float64();
const newLook = createVec3Float64();
const newEye = createVec3Float64();
const newUp = createVec3Float64();
const newLookEyeVec = createVec3Float64();

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
  aabb?: AABB3;

  /**
   * Target distance between the camera and its point-of-interest.
   */
  length?: number;

  /**
   * Target position for the camera eye.
   */
  eye?: Vec3;

  /**
   * Target position for the camera to look at.
   */
  look?: Vec3;

  /**
   * Target "up" vector for the camera orientation.
   */
  up?: Vec3;

  /**
   * Optional point-of-interest in world coordinates for the camera to focus on.
   */
  poi?: Vec3;

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
export class CameraFlightAnimation {

  /**
   * The View that owns this CameraFlightAnimation.
   */
  public readonly view: View;

  /**
   * The Camera controlled by this CameraFlightAnimation.
   */
  public readonly camera: Camera;

  _duration: number;
  _look1: Vec3;
  _eye1: Vec3;
  _up1: Vec3;
  _look2: Vec3;
  _eye2: Vec3;
  _up2: Vec3;
  _orthoScale1: number;
  _orthoScale2: number;
  _fit: boolean;
  _trail: boolean;
  _flying: boolean;
  _flyEyeLookUp: boolean;
  _flyingEye: boolean;
  _flyingLook: boolean;
  _callback: any;
  _callbackScope: any;
  _time1: number | null;
  _time2: number | null;
  easing: boolean;
  _flyingEyeLookUp: boolean;
  _fitFOV: number;
  _projection2: number;
  _projMatrix1: Mat4;
  _projMatrix2: Mat4;

  private _animationTask: SDKTask;

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
  _aabbIndex: any;

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

    if (!(view instanceof View)) {
      throw "[CameraFlightAnimation] Expected instance of View";
    }

    this.view = view;
    this._aabbIndex = getSceneAABBIndex(view.viewer.scene);
    this.camera = view.camera;

    this._look1 = createVec3Float64();
    this._eye1 = createVec3Float64();
    this._up1 = createVec3Float64();
    this._look2 = createVec3Float64();
    this._eye2 = createVec3Float64();
    this._up2 = createVec3Float64();
    this._orthoScale1 = 1;
    this._orthoScale2 = 1;
    this._flying = false;
    this._flyEyeLookUp = false;
    this._flyingEye = false;
    this._flyingLook = false;
    this._callback = null;
    this._callbackScope = null;
    this._time1 = null;
    this._time2 = null;
    this.easing = true;
    this._trail = false;
    this._fit = true;
    this._duration = 500;
    this._fitFOV = 60;

    this.onStarted = new EventEmitter(new EventDispatcher<CameraFlightAnimation, null>());
    this.onStopped = new EventEmitter(new EventDispatcher<CameraFlightAnimation, null>());
    this.onCancelled = new EventEmitter(new EventDispatcher<CameraFlightAnimation, null>());

    this._animationTask = new SDKTask({
      name: "CameraFlightAnimation._update",
      task: () => {
          if (!this._flying) {
            return;
          }
          const time = Date.now();
          // @ts-ignore
          let t = (time - this._time1) / (this._time2 - this._time1);
          const stopping = (t >= 1);
          if (t > 1) {
            t = 1;
          }
          const tFlight = this.easing ? CameraFlightAnimation._ease(t, 0, 1, 1) : t;
          const camera = this.camera;
          if (this._flyingEye || this._flyingLook) {
            if (this._flyingEye) {
              subVec3(camera.eye, camera.look, newLookEyeVec);
              camera.eye = lerpVec3(tFlight, 0, 1, this._eye1, this._eye2, newEye);
              camera.look = subVec3(newEye, newLookEyeVec, newLook);
            } else if (this._flyingLook) {
              camera.look = lerpVec3(tFlight, 0, 1, this._look1, this._look2, newLook);
              camera.up = lerpVec3(tFlight, 0, 1, this._up1, this._up2, newUp);
            }
          } else if (this._flyingEyeLookUp) {
            camera.eye = lerpVec3(tFlight, 0, 1, this._eye1, this._eye2, newEye);
            camera.look = lerpVec3(tFlight, 0, 1, this._look1, this._look2, newLook);
            camera.up = lerpVec3(tFlight, 0, 1, this._up1, this._up2, newUp);
          }
          if (this._projection2) {
            const tProj = (this._projection2 === OrthoProjectionType) ? CameraFlightAnimation._easeOutExpo(t, 0, 1, 1) : CameraFlightAnimation._easeInCubic(t, 0, 1, 1);
            camera.customProjection.projMatrix = lerpMat4(tProj, 0, 1, this._projMatrix1, this._projMatrix2);

          } else {
            camera.orthoProjection.scale = this._orthoScale1 + (t * (this._orthoScale2 - this._orthoScale1));
          }
          if (stopping) {
            camera.orthoProjection.scale = this._orthoScale2;
            this.stop();
            return;
          }
          this._animationTask.schedule();
      },
      stage: SDKTask.CollectInputStage
    });
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

    if (this._flying) {
      this.stop();
    }

    this._flying = false;
    this._flyingEye = false;
    this._flyingLook = false;
    this._flyingEyeLookUp = false;

    this._callback = callback || function () {
    };

    const camera = this.camera;
    const flyToProjection = (!!params.projection) && (params.projection !== camera.projectionType);

    this._eye1[0] = camera.eye[0];
    this._eye1[1] = camera.eye[1];
    this._eye1[2] = camera.eye[2];

    this._look1[0] = camera.look[0];
    this._look1[1] = camera.look[1];
    this._look1[2] = camera.look[2];

    this._up1[0] = camera.up[0];
    this._up1[1] = camera.up[1];
    this._up1[2] = camera.up[2];

    this._orthoScale1 = camera.orthoProjection.scale;
    this._orthoScale2 = params.orthoScale || this._orthoScale1;

    let aabb: AABB3;
    let eye: Vec3;
    let look: Vec3;
    let up: Vec3;

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
        aabb = this._aabbIndex.getSceneAABB();
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

      aabb = createAABB3Float64(aabb);
      const aabbCenter = getAABB3Center(aabb);

      this._look2 = poi || aabbCenter;

      const eyeLookVec = subVec3(this._eye1, this._look1, tempVec3);
      const eyeLookVecNorm = normalizeVec3(eyeLookVec);
      const diag = poi ? getAABB3DiagPoint(aabb, poi) : getAABB3Diag(aabb);
      const fitFOV = params.fitFOV || this._fitFOV;
      const sca = Math.abs(diag / Math.tan(fitFOV * DEGTORAD));

      this._orthoScale2 = diag * 1.1;

      this._eye2[0] = this._look2[0] + (eyeLookVecNorm[0] * sca);
      this._eye2[1] = this._look2[1] + (eyeLookVecNorm[1] * sca);
      this._eye2[2] = this._look2[2] + (eyeLookVecNorm[2] * sca);

      this._up2[0] = this._up1[0];
      this._up2[1] = this._up1[1];
      this._up2[2] = this._up1[2];

      this._flyingEyeLookUp = true;

      // @ts-ignore
    } else if (eye || look || up) {
      // @ts-ignore
      this._flyingEyeLookUp = !!eye && !!look && !!up;
      // @ts-ignore
      this._flyingEye = !!eye && !look;
      // @ts-ignore
      this._flyingLook = !!look && !eye;
      // @ts-ignore
      if (eye) {
        this._eye2[0] = eye[0];
        this._eye2[1] = eye[1];
        this._eye2[2] = eye[2];
      }
      // @ts-ignore
      if (look) {
        this._look2[0] = look[0];
        this._look2[1] = look[1];
        this._look2[2] = look[2];
      }
      // @ts-ignore
      if (up) {
        this._up2[0] = up[0];
        this._up2[1] = up[1];
        this._up2[2] = up[2];
      }
    }

    if (flyToProjection) {

      if (params.projection === OrthoProjectionType && camera.projectionType !== OrthoProjectionType) {
        this._projection2 = OrthoProjectionType;
        this._projMatrix1 = <Mat4>camera.projMatrix.slice();
        this._projMatrix2 = <Mat4>camera.orthoProjection.projMatrix.slice();
        camera.projectionType = CustomProjectionType;
      }

      if (params.projection === PerspectiveProjectionType && camera.projectionType !== PerspectiveProjectionType) {
        this._projection2 = PerspectiveProjectionType;
        this._projMatrix1 = <Mat4>camera.projMatrix.slice();
        this._projMatrix2 = <Mat4>camera.perspectiveProjection.projMatrix.slice();
        camera.projectionType = CustomProjectionType;
      }
    } else {
      // @ts-ignore
      this._projection2 = null;
    }

    this.onStarted.dispatch(this, null);

    this._time1 = Date.now();
    this._time2 = this._time1 + (params.duration ? params.duration * 1000 : this._duration);

    this._flying = true; // False as soon as we stop

    this._animationTask.schedule();
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
    this._jumpTo(params);
  }

  _jumpTo(params: any) {

    if (this._flying) {
      this.stop();
    }

    const camera = this.camera;

    let aabb: AABB3;
    let newEye: Vec3;
    let newLook: Vec3;
    let newUp: Vec3;

    if (params.aabb) { // Boundary3D
      aabb = params.aabb;
    } else if (params.eye || params.look || params.up) { // Camera pose
      newEye = params.eye;
      newLook = params.look;
      newUp = params.up;
    } else {
      aabb = this._aabbIndex.getSceneAABB();
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

      if (this._trail) {
        subVec3(camera.look, newLook, newLookEyeVec);
      } else {
        subVec3(camera.eye, camera.look, newLookEyeVec);
      }

      normalizeVec3(newLookEyeVec);
      let dist;
      const fit = (params.fit !== undefined) ? params.fit : this._fit;

      if (fit) {
        dist = Math.abs((diag) / Math.tan((params.fitFOV || this._fitFOV) * DEGTORAD));

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

  static _ease(t: number, b: number, c: number, d: number) { // Quadratic easing out - decelerating to zero velocity http://gizma.com/easing
    t /= d;
    return -c * t * (t - 2) + b;
  }

  static _easeInCubic(t: number, b: number, c: number, d: number) {
    t /= d;
    return c * t * t * t + b;
  }

  static _easeOutExpo(t: number, b: number, c: number, d: number) {
    return c * (-Math.pow(2, -10 * t / d) + 1) + b;
  }

  /**
   * Stops an earlier {@link CameraFlightAnimation.flyTo | CameraFlightAnimation.flyTo}, fires arrival callback, then "stopped" event.
   */
  stop() {
    if (!this._flying) {
      return;
    }
    this._animationTask.unschedule();
    this._flying = false;
    this._time1 = null;
    this._time2 = null;
    if (this._projection2) {
      this.camera.projectionType = this._projection2;
    }
    const callback = this._callback;
    if (callback) {
      this._callback = null;
      callback();
    }
    this.onStopped.dispatch(this, null);
  }

  /**
   * Cancels a flight in progress, without calling the arrival callback.
   */
  cancel() {
    if (!this._flying) {
      return;
    }
    this._animationTask.unschedule();
    this._flying = false;
    this._time1 = null;
    this._time2 = null;
    if (this._callback) {
      this._callback = null;
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
    this._duration = value ? (value * 1000.0) : 500;
    this.stop();
  }

  /**
   * Gets the flight duration in seconds.
   *
   * Default value is ````0.5````.
   */
  get duration(): number {
    return this._duration / 1000.0;
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
    this._fit = value;
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
    return this._fit;
  }

  /**
   * Sets how much of the perspective field-of-view, in degrees, that a target {@link viewer!ViewObject | ViewObject} should
   * fill the canvas when calling {@link CameraFlightAnimation.flyTo | CameraFlightAnimation.flyTo} or {@link CameraFlightAnimation.jumpTo | CameraFlightAnimation.jumpTo}.
   *
   * Default value is ````45````.
   */
  set fitFOV(value: number) {
    this._fitFOV = value;
  }

  /**
   * Gets how much of the perspective field-of-view, in degrees, that a target {@link viewer!ViewObject | ViewObject} should
   * fill the canvas when calling {@link CameraFlightAnimation.flyTo | CameraFlightAnimation.flyTo} or {@link CameraFlightAnimation.jumpTo | CameraFlightAnimation.jumpTo}.
   *
   * Default value is ````45````.
   */
  get fitFOV(): number {
    return this._fitFOV;
  }

  /**
   * Indicates if this CameraFlightAnimation will orient the {@link viewer!Camera | Camera}
   * in the direction that it is flying.
   *
   * Default value is ````false````.
   */
  set trail(value: boolean) {
    this._trail = value;
  }

  /**
   * Indicates if this CameraFlightAnimation will orient the {@link viewer!Camera | Camera}
   * in the direction that it is flying.
   *
   * Default value is ````false````.
   */
  get trail(): boolean {
    return this._trail;
  }

  /**
   * @private
   */
  destroy() {
    this.stop();
    this._animationTask.destroy();
    this.onStarted.clear();
    this.onStopped.clear();
    this.onCancelled.clear();
  }
}
