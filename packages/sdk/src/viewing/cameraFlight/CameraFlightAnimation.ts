import {
  type Mat4,
  lerpMat4,
} from "../../base/math/matrix";

import {
  addVec3,
  createVec3Float64,
  lenVec3,
  lerpVec3,
  mulVec3Scalar,
  normalizeVec3,
  subVec3,
  type Vec3,
} from "../../base/math/vector";
import type {Camera} from "../viewer";
import { View} from "../viewer";
import {EventEmitter, SDKTask} from "../../base/core";
import {CustomProjectionType, OrthoProjectionType, PerspectiveProjectionType} from "../../base/constants";
import {DEGTORAD, } from "../../base/math";
import {createAABB3Float64,getAABB3Center, getAABB3Diag, getAABB3DiagPoint, type AABB3} from "../../base/math/boundaries";
import {EventDispatcher} from "strongly-typed-events";
import {getSceneCollisionIndex} from "../../spatial/collision";

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

  /**
   * When `true`, the camera follows an arc from `eye1` to `eye2`
   * instead of a straight line — rising at the midpoint of the flight
   * to give a sense of travelling over the scene. The apex height is
   * controlled by `arcHeight` (or auto-derived from the eye distance).
   * The look point still interpolates linearly so the focus tracks
   * naturally; only the eye position picks up the parabolic offset.
   *
   * Only takes effect on flights that move the eye — i.e. AABB-fit
   * flights and `{eye, look, up}` flights. Pure `look`-only or
   * `eye`-only rotations ignore it.
   */
  arc?: boolean;

  /**
   * When `arc` is set, the apex height in metres along the arc-up
   * axis (the world-up component perpendicular to the chord
   * `eye2 - eye1`). Defaults to `0.25` × the eye-to-eye distance,
   * so flights of any scale produce a visually similar arc.
   */
  arcHeight?: number;

  /**
   * Easing curve for this flight, overriding the per-instance
   * {@link CameraFlightAnimation.easing} field for the duration of
   * this call:
   *
   * - `true` (or omitted) — the default quadratic ease-out: starts
   *   at full velocity and decelerates to a stop on arrival.
   * - `"inThenOut"` — piecewise quadratic ease-in then ease-out
   *   (`2t²` on [0, 0.5], `1 − 2(1−t)²` on [0.5, 1]). The camera
   *   leaves and arrives at zero velocity, accelerating at a
   *   constant rate up to the midpoint and decelerating at a
   *   constant rate down to the target — i.e. a triangular speed
   *   profile peaking at t=0.5.
   * - `false` — no easing; constant velocity along the path.
   */
  easing?: boolean | "inThenOut";
}

/**
 * Animates a {@link viewing!viewer.View | View}'s {@link viewing!viewer.Camera | Camera}
 * to smoothly transition to a specified target, such as a component, bounding box, or viewpoint.
 *
 * Use {@link cameraFlight | @xeokit/sdk/viewing/cameraFlight} to create cinematic camera motions.
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

  private _duration: number;
  private _look1: Vec3;
  private _eye1: Vec3;
  private _up1: Vec3;
  private _look2: Vec3;
  private _eye2: Vec3;
  private _up2: Vec3;
  private _orthoScale1: number;
  private _orthoScale2: number;
  private _fit: boolean;
  private _trail: boolean;
  private _flying: boolean;
  private _flyEyeLookUp: boolean;
  private _flyingEye: boolean;
  private _flyingLook: boolean;
  private _callback: any;
  private _callbackScope: any;
  private _time1: number | null;
  private _time2: number | null;
  easing: boolean;
  private _flyingEyeLookUp: boolean;
  private _fitFOV: number;
  private _projection2: number | null;
  private _projMatrix1: Mat4;
  private _projMatrix2: Mat4;

  // Arc-flight state. `_arcAmount` is the apex height in metres along
  // `_arcDir`; both are recomputed per-flight in flyTo() once the
  // start/end eye positions are known. `_arcAmount = 0` disables the
  // bulge, so a non-arc flight pays only a single zero-check per tick.
  private _arc: boolean;
  private _arcAmount: number;
  private _arcDir: Vec3;

  // Per-flight easing curve, resolved from `FlyToParams.easing` (or
  // falling back to the class-level `easing` flag) at flyTo time.
  // The tick reads this each frame to pick the time-warp function.
  private _easingMode: "default" | "inThenOut" | "none";

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
  private _aabbIndex: any;

  /**
   * Creates a new CameraFlightAnimation instance.
   *
   * @param view The {@link viewing!viewer.View | View} whose {@link viewing!viewer.Camera | Camera} will be animated.
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
    this._aabbIndex = getSceneCollisionIndex(view.viewer.scene);
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
    this._arc = false;
    this._arcAmount = 0;
    this._arcDir = createVec3Float64();
    this._easingMode = "default";

    this.onStarted = new EventEmitter(new EventDispatcher<CameraFlightAnimation, null>());
    this.onStopped = new EventEmitter(new EventDispatcher<CameraFlightAnimation, null>());
    this.onCancelled = new EventEmitter(new EventDispatcher<CameraFlightAnimation, null>());

    // Repeating task on the AnimateStage — the SDKTaskRunner drives
    // it every frame via requestAnimationFrame. Non-repeating tasks
    // are deleted from the runner the same frame they execute (even
    // if they reschedule themselves from inside their callback —
    // SDKTaskRunner.runTasks unconditionally `tasks.delete(task)` for
    // non-repeating tasks after running them), so the previous
    // pattern of "schedule on flyTo, reschedule from inside the
    // task" only ran for a single frame and the animation never
    // reached its target. Gating on `this._flying` keeps the
    // per-frame overhead trivial when no flight is in progress; the
    // pivot/keyboard controllers use the same pattern.
    this._animationTask = new SDKTask({
      name: "CameraFlightAnimation._update",
      task: () => {
        if (!this._flying) {
          return;
        }
        const time = Date.now();
        let t = (time - this._time1!) / (this._time2! - this._time1!);
        const stopping = (t >= 1);
        if (t > 1) {
          t = 1;
        }
        const tFlight =
          this._easingMode === "inThenOut" ? CameraFlightAnimation._easeInThenOut(t)
          : this._easingMode === "default" ? CameraFlightAnimation._ease(t, 0, 1, 1)
          : t;
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
          lerpVec3(tFlight, 0, 1, this._eye1, this._eye2, newEye);
          if (this._arcAmount > 0) {
            // Parabolic apex: 4·tFlight·(1−tFlight) is zero at the
            // endpoints and 1 at tFlight=0.5, so the bulge starts
            // and ends at the straight-line eye lerp and rises to
            // `_arcAmount` at the midpoint along `_arcDir`. We use
            // `tFlight` here (not raw `t`) so the arc and the chord
            // share the same time warp — that's what makes the
            // total camera speed inherit the easing curve's bell
            // shape instead of summing a bell (lerp) with a
            // triangular bulge (whose derivative w.r.t. raw t is
            // ±arcAmount · 4 at the endpoints).
            const bulge = 4 * tFlight * (1 - tFlight) * this._arcAmount;
            newEye[0] += bulge * this._arcDir[0];
            newEye[1] += bulge * this._arcDir[1];
            newEye[2] += bulge * this._arcDir[2];
          }
          camera.eye = newEye;
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
        }
      },
      stage: SDKTask.AnimateStage,
      repeat: true
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

    // Resolve the easing curve for this flight. `FlyToParams.easing`
    // wins over the class-level `this.easing`, which is consulted only
    // when the per-flight param is absent.
    if (params.easing === "inThenOut") {
      this._easingMode = "inThenOut";
    } else if (params.easing === false) {
      this._easingMode = "none";
    } else if (params.easing === true) {
      this._easingMode = "default";
    } else {
      this._easingMode = this.easing ? "default" : "none";
    }

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

    let aabb: AABB3 | undefined;
    let eye: Vec3 | undefined;
    let look: Vec3 | undefined;
    let up: Vec3 | undefined;

    if (params.aabb) {
      aabb = params.aabb;

    } else if ((params.eye && params.look) || params.up) {
      eye = params.eye;
      look = params.look;
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

    } else if (eye || look || up) {
      this._flyingEyeLookUp = !!eye && !!look && !!up;
      this._flyingEye = !!eye && !look;
      this._flyingLook = !!look && !eye;
      if (eye) {
        this._eye2[0] = eye[0];
        this._eye2[1] = eye[1];
        this._eye2[2] = eye[2];
      }
      if (look) {
        this._look2[0] = look[0];
        this._look2[1] = look[1];
        this._look2[2] = look[2];
      }
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
      this._projection2 = null;
    }

    // Arc setup: only meaningful for flights whose eye actually moves
    // (AABB-fit or eye/look/up branches). Pure look-only / eye-only
    // partial flights would either leave eye fixed or rotate the look
    // ray, neither of which mixes well with a parabolic apex.
    this._arc = !!params.arc && (this._flyingEyeLookUp || (this._flyingEye === false && this._flyingLook === false));
    this._arcAmount = 0;
    if (this._arc) {
      // Chord vector from current eye to target eye — sets the default
      // apex height for callers that don't override it.
      const chord = subVec3(this._eye2, this._eye1, tempVec3);
      const chordLen = lenVec3(chord);
      if (chordLen > 1e-6) {
        // Apex direction = the look→eye vector at the flight midpoint
        // (mid-eye − mid-look). Pulling the camera along this axis at
        // t=0.5 dollies straight back along its viewing direction, so
        // the scene "zooms out and then back in" through the flight —
        // a sense-of-traversal cue that doesn't depend on the world
        // having a meaningful up axis. Using the mid-point of start
        // and end keeps the direction stable even when the camera
        // pivots significantly during the flight.
        this._arcDir[0] = (this._eye1[0] + this._eye2[0] - this._look1[0] - this._look2[0]) * 0.5;
        this._arcDir[1] = (this._eye1[1] + this._eye2[1] - this._look1[1] - this._look2[1]) * 0.5;
        this._arcDir[2] = (this._eye1[2] + this._eye2[2] - this._look1[2] - this._look2[2]) * 0.5;
        const arcDirLen = lenVec3(this._arcDir);
        if (arcDirLen > 1e-6) {
          this._arcDir[0] /= arcDirLen;
          this._arcDir[1] /= arcDirLen;
          this._arcDir[2] /= arcDirLen;
          this._arcAmount = params.arcHeight !== undefined
            ? params.arcHeight
            : chordLen * 0.25;
        }
      }
    }

    this.onStarted.dispatch(this, null);

    this._time1 = Date.now();
    this._time2 = this._time1 + (params.duration ? params.duration * 1000 : this._duration);

    this._flying = true; // The repeating _animationTask picks this
                         // up on the next AnimateStage tick; flips
                         // back to false in stop() / cancel().
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

  private _jumpTo(params: any) {

    if (this._flying) {
      this.stop();
    }

    const camera = this.camera;

    let aabb: AABB3 | undefined;
    let newEye: Vec3 | undefined;
    let newLook: Vec3 | undefined;
    let newUp: Vec3 | undefined;

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
    if (aabb) {

      if (aabb[3] <= aabb[0] || aabb[4] <= aabb[1] || aabb[5] <= aabb[2]) { // Don't fly to an empty boundary
        return;
      }

      const diag = poi ? getAABB3DiagPoint(aabb, poi) : getAABB3Diag(aabb);
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
    } else if (newEye || newLook || newUp) {
      if (newEye) {
        camera.eye = newEye;
      }
      if (newLook) {
        camera.look = newLook;
      }
      if (newUp) {
        camera.up = newUp;
      }
    }

    if (params.projection) {
      camera.projectionType = params.projection;
    }
  }

  private static _ease(t: number, b: number, c: number, d: number) { // Quadratic easing out - decelerating to zero velocity http://gizma.com/easing
    t /= d;
    return -c * t * (t - 2) + b;
  }

  // Piecewise quadratic ease-in-then-out:
  //   first half  → 2t²            (quadratic ease-in,  accelerates)
  //   second half → 1 − 2(1−t)²    (quadratic ease-out, decelerates)
  //
  // Position is C¹-continuous at the seam (both branches hit 0.5 at
  // t=0.5, and the derivative matches: f′(0.5⁻) = 4·0.5 = 2,
  // f′(0.5⁺) = 4·0.5 = 2). Velocity is a triangle peaking at t=0.5
  // — linear ramp up from rest, linear ramp down to rest — so the
  // camera leaves and arrives at zero velocity but accelerates and
  // decelerates at a constant rate inside each half.
  private static _easeInThenOut(t: number): number {
    if (t < 0.5) {
      return 2 * t * t;                      // ease-in,  [0, 0.5] → [0, 0.5]
    }
    const u = 1 - t;
    return 1 - 2 * u * u;                    // ease-out, [0.5, 1] → [0.5, 1]
  }

  private static _easeInCubic(t: number, b: number, c: number, d: number) {
    t /= d;
    return c * t * t * t + b;
  }

  private static _easeOutExpo(t: number, b: number, c: number, d: number) {
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
   * When flying to a {@link model!scene.SceneModel | SceneModel}, {@link viewing!viewer.ViewObject | ViewObject} or boundary, indicates if the CameraFlightAnimation always adjusts
   * the distance of {@link viewing!viewer.Camera.eye | Camera.eye} from {@link viewing!viewer.Camera.look | Camera.look} to ensure that the target always fits in view.
   *
   * When false, the eye will remain fixed at its current distance from the look position.
   *
   * Default value is ````true````.
   */
  set fit(value: boolean) {
    this._fit = value;
  }

  /**
   * When flying to a {@link model!scene.SceneModel | SceneModel}, {@link viewing!viewer.ViewObject | ViewObject} or boundary, indicates if the CameraFlightAnimation always adjusts
   * the distance of {@link viewing!viewer.Camera.eye | Camera.eye} from {@link viewing!viewer.Camera.look | Camera.look} to ensure that the target always fits in view.
   *
   * When false, the eye will remain fixed at its current distance from the look position.
   *
   * Default value is ````true````.
   */
  get fit(): boolean {
    return this._fit;
  }

  /**
   * Sets how much of the perspective field-of-view, in degrees, that a target {@link viewing!viewer.ViewObject | ViewObject} should
   * fill the canvas when calling {@link CameraFlightAnimation.flyTo | CameraFlightAnimation.flyTo} or {@link CameraFlightAnimation.jumpTo | CameraFlightAnimation.jumpTo}.
   *
   * Default value is ````45````.
   */
  set fitFOV(value: number) {
    this._fitFOV = value;
  }

  /**
   * Gets how much of the perspective field-of-view, in degrees, that a target {@link viewing!viewer.ViewObject | ViewObject} should
   * fill the canvas when calling {@link CameraFlightAnimation.flyTo | CameraFlightAnimation.flyTo} or {@link CameraFlightAnimation.jumpTo | CameraFlightAnimation.jumpTo}.
   *
   * Default value is ````45````.
   */
  get fitFOV(): number {
    return this._fitFOV;
  }

  /**
   * Indicates if this CameraFlightAnimation will orient the {@link viewing!viewer.Camera | Camera}
   * in the direction that it is flying.
   *
   * Default value is ````false````.
   */
  set trail(value: boolean) {
    this._trail = value;
  }

  /**
   * Indicates if this CameraFlightAnimation will orient the {@link viewing!viewer.Camera | Camera}
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
