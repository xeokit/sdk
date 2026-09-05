import {
  add3,
  aircraftLocalPointToWorld,
  basisFromForward,
  buildVehicleMatrix,
  clamp,
  cross3,
  dot3,
  flatDirection3,
  lerp3,
  mul3,
  normalize,
  safeNormalize,
  sub3,
  toVec3,
  type AircraftPose,
  type Vec3
} from "./AircraftMath";
import type {
  AircraftCameraPreset,
  AircraftCameraSnapshot,
  AircraftControllerConfig,
  AircraftControllerParams,
  AircraftControllerState,
  AircraftControllerViewProxy,
  View
} from "./AircraftControllerParams";

const VEHICLE_CAMERA_PRESET_KEYS: Record<string, AircraftCameraPreset> = {
  Digit0: "trailing",
  Numpad0: "trailing",
  Digit1: "left",
  Numpad1: "left",
  Digit2: "right",
  Numpad2: "right",
  Digit3: "front",
  Numpad3: "front",
  Digit4: "top",
  Numpad4: "top",
  Digit5: "topTrailing",
  Numpad5: "topTrailing",
  Digit6: "rearWide",
  Numpad6: "rearWide",
  Digit7: "cockpit",
  Numpad7: "cockpit"
};

const VEHICLE_EXTERIOR_CAMERA_PRESETS = new Set<AircraftCameraPreset>([
  "trailing",
  "left",
  "right",
  "front",
  "top",
  "topTrailing",
  "rearWide"
]);

/**
 * Drives a SceneModel transform as an aircraft and keeps a View camera attached
 * to the aircraft.
 *
 * The controller adapts {@link VehicleNavigationController} to aircraft-style
 * flight. It owns a lightweight proxy View for the SDK vehicle controller, then
 * maps that proxy camera state into:
 *
 * - the caller-provided aircraft root transform,
 * - a smoothed visual aircraft pose,
 * - optional {@link AircraftExhaustTrail} updates, and
 * - the real View camera preset.
 *
 * A repeating {@link SDKTask} is created during construction. Call
 * {@link AircraftController.destroy} when the aircraft should stop updating.
 *
 * @example Basic controller
 * ```ts
 * const controller = new AircraftController(view, {
 *   rootTransform,
 *   config: {
 *     modelId: "aircraft",
 *     forwardAxis: "-Z",
 *     startSpeed: 40,
 *     startFlying: true
 *   }
 * });
 * ```
 *
 * @example Switch camera presets
 * ```ts
 * controller.setCameraPreset("front");
 * controller.adjustExteriorCameraDistance(-1);
 * ```
 */
export class AircraftController {
  /** Stable controller type string for diagnostics and app-level routing. */
  readonly type = "vehicle-navigation-aircraft";
  /** Mutable physical, visual and camera state. */
  readonly state: AircraftControllerState;
  /** Underlying SDK vehicle navigation controller. */
  readonly sdkController: any;
  /** Proxy View passed to {@link VehicleNavigationController}. */
  readonly vehicleView: AircraftControllerViewProxy;
  /** Update loop implementation. Currently always `"sdk-task"`. */
  readonly updateMode: "sdk-task" | "raf";

  private readonly view: View;
  private readonly params: AircraftControllerParams;
  private readonly config: AircraftControllerConfig;
  private readonly vehicleCamera: AircraftCameraSnapshot & {perspectiveProjection?: unknown};
  private readonly unbindCameraPresetKeys: () => void;
  private animationFrame = 0;
  private task: null = null;
  private destroyed = false;

  /**
   * Creates an aircraft controller for a View.
   *
   * @param view View whose camera will track the aircraft.
   * @param params Root transform, optional exhaust trail, input binding and
   * flight/camera configuration.
   */
  constructor(view: View, params: AircraftControllerParams) {
    this.view = view;
    this.params = params;
    this.config = params.config || {};

    const worldUp = this.getWorldUp();
    const initialEye = toVec3(view.camera.eye);
    const initialLook = toVec3(view.camera.look);
    const initialForward = safeNormalize(sub3(initialLook, initialEye), [0, 1, 0] as Vec3);
    const initialBasis = basisFromForward(initialForward, worldUp);
    const cameraDistance = Number(this.config.cameraDistance ?? 64);
    const cameraHeight = Number(this.config.cameraHeight ?? 18);
    const initialPosition = Array.isArray(this.config.initialShipPosition)
      ? toVec3(this.config.initialShipPosition)
      : sub3(add3(initialEye, mul3(initialForward, cameraDistance)), mul3(worldUp, cameraHeight));

    this.state = {
      position: initialPosition,
      forward: initialBasis.forward,
      right: initialBasis.right,
      up: initialBasis.up,
      visualPosition: initialPosition,
      visualForward: initialBasis.forward,
      visualRight: initialBasis.right,
      visualUp: initialBasis.up,
      cameraEye: initialEye,
      cameraLook: initialLook,
      cameraPreset: "trailing",
      exteriorCameraDistanceScale: clamp(Number(this.config.cameraExteriorDistanceScale ?? 1), 0.35, 2.5),
      lastTime: performance.now()
    };

    this.vehicleCamera = {
      eye: initialPosition,
      look: add3(initialPosition, this.state.forward),
      up: worldUp,
      perspectiveProjection: view.camera.perspectiveProjection
    };
    this.vehicleView = {
      id: `${view.id}:vehicle-proxy`,
      htmlElement: view.htmlElement,
      camera: this.vehicleCamera as never,
      objects: view.objects,
      viewer: view.viewer
    };

    const maxForwardSpeed = Number(this.config.maxForwardSpeed ?? 135);
    const objectFilter = params.objectFilter || ((objectId: string) => !isAircraftObjectId(objectId, this.config.modelId));
    const VehicleNavigationController = params.VehicleNavigationController;
    if (!VehicleNavigationController) {
      throw new Error("[AircraftController] VehicleNavigationController dependency is required");
    }
    this.sdkController = new VehicleNavigationController(this.vehicleView as never, {
      active: true,
      keyboardEnabledOnlyOnMouseover: false,
      suspendModelNavigationController: params.suspendModelNavigationController,
      collision: this.config.collision ?? true,
      gravity: this.config.gravity ?? false,
      cameraHeight: 0.01,
      bodyRadius: Number(this.config.bodyRadius ?? 0.45),
      maxForwardSpeed,
      maxReverseSpeed: Number(this.config.maxReverseSpeed ?? 10),
      acceleration: Number(this.config.acceleration ?? 46),
      brakeDeceleration: Number(this.config.brakeDeceleration ?? 42),
      coastDeceleration: Number(this.config.coastDeceleration ?? 2.8),
      turnRateDegreesPerSecond: Number(this.config.shipYawRateDegreesPerSecond ?? this.config.turnRateDegreesPerSecond ?? 82),
      keySteerInitialScale: Number(this.config.shipKeyYawInitialScale ?? this.config.keySteerInitialScale ?? 0.28),
      keySteerRampSeconds: Number(this.config.shipKeyYawRampSeconds ?? this.config.keySteerRampSeconds ?? 1.45),
      leanDegrees: Number(this.config.maxVisualRollDegrees ?? this.config.leanDegrees ?? 58),
      leanSmoothing: Number(this.config.rollSmoothing ?? this.config.leanSmoothing ?? 10),
      maxPitchDegrees: maxAbsolutePitchDegrees(this.config),
      maxFlightPitchDegrees: maxAbsolutePitchDegrees(this.config),
      flightTakeoffHeight: Number(this.config.flightTakeoffHeight ?? 0),
      flightTakeoffSpeed: Number(this.config.flightTakeoffSpeed ?? 12),
      flightLandingFallSpeed: Number(this.config.flightLandingFallSpeed ?? 12),
      flightAcceleration: Number(this.config.flightAcceleration ?? this.config.acceleration ?? 46),
      flightBrakeDeceleration: Number(this.config.flightBrakeDeceleration ?? this.config.brakeDeceleration ?? 42),
      flightMinGlideSpeed: Number(this.config.flightMinGlideSpeed ?? this.config.minForwardSpeed ?? 18),
      flightAirDrag: Number(this.config.flightAirDrag ?? (Number(this.config.coastDeceleration ?? 2.8) / Math.max(maxForwardSpeed, 1))),
      flightGravity: Number(this.config.flightGravity ?? 0),
      flightSoftLandingRange: Number(this.config.flightSoftLandingRange ?? 0.75),
      flightPitchRateDegreesPerSecond: Number(this.config.shipPitchRateDegreesPerSecond ?? this.config.flightPitchRateDegreesPerSecond ?? 54),
      flightSteeringResponse: Number(this.config.flightSteeringResponse ?? 4.6),
      aircraftControlSurfaces: this.config.aircraftControlSurfaces !== false,
      controlSurfaceResponse: Number(this.config.controlSurfaceResponse ?? 5.5),
      controlSurfaceReturnResponse: Number(this.config.controlSurfaceReturnResponse ?? 3.5),
      mouseDragYawSensitivity: Number(this.config.shipMouseDragYawSensitivity ?? this.config.mouseDragYawSensitivity ?? this.config.shipMouseDragSensitivity ?? 0.0028),
      mouseDragPitchSensitivity: Number(this.config.shipMouseDragPitchSensitivity ?? this.config.mouseDragPitchSensitivity ?? this.config.shipMouseDragSensitivity ?? 0.0028),
      mouseDragResponse: Number(this.config.shipMouseDragResponse ?? this.config.mouseDragResponse ?? 7.5),
      maxMouseDragInputPerFrame: Number(this.config.maxShipMouseDragInputPerFrame ?? this.config.maxMouseDragInputPerFrame ?? 0.65),
      obstacleFilter: objectFilter,
      driveSurfaceFilter: objectFilter
    });
    this.sdkController.speed = clamp(Number(this.config.startSpeed ?? 34), 0, maxForwardSpeed);
    if (this.config.startFlying !== false) {
      this.sdkController.flying = true;
    }

    this.unbindCameraPresetKeys = params.bindKeyboard === false ? () => undefined : this.bindCameraPresetKeys();
    this.updateMode = "raf";
    this.animationFrame = window.requestAnimationFrame(this.animate);
  }

  /**
   * Advances the aircraft one frame.
   *
   * This is normally called by the controller's internal repeating SDKTask.
   * Call it manually only when integrating with a custom task lifecycle.
   */
  update(): void {
    if (this.destroyed) {
      return;
    }
    const dt = this.updateAircraftFromVehicleNavigation();
    this.params.exhaust?.update(this.config, Number(this.sdkController.speed || 0), this.state, dt);
  }

  /**
   * Switches the View camera to one of the built-in aircraft presets.
   *
   * @param preset Camera preset to activate.
   */
  setCameraPreset(preset: AircraftCameraPreset): void {
    this.state.cameraPreset = preset;
    this.snapCameraToPreset();
  }

  /**
   * Moves the active exterior camera closer or farther from the aircraft.
   *
   * No-op while the cockpit preset is active. Keyboard bindings call this for
   * `-` and `+`.
   *
   * @param direction `-1` to move closer, `1` to move farther.
   */
  adjustExteriorCameraDistance(direction: -1 | 1): void {
    if (!VEHICLE_EXTERIOR_CAMERA_PRESETS.has(this.state.cameraPreset)) {
      return;
    }
    const step = Math.max(1.01, Number(this.config.cameraExteriorDistanceStep ?? 1.12));
    const current = this.exteriorCameraDistanceScale();
    this.state.exteriorCameraDistanceScale = clamp(
      current * (direction > 0 ? step : 1 / step),
      Number(this.config.cameraExteriorMinDistanceScale ?? 0.35),
      Number(this.config.cameraExteriorMaxDistanceScale ?? 2.5)
    );
    this.snapCameraToPreset();
  }

  /**
   * Stops updates, unbinds keyboard handlers and destroys the underlying
   * vehicle navigation controller.
   */
  destroy(): void {
    if (this.destroyed) {
      return;
    }
    this.destroyed = true;
    if (this.animationFrame) {
      window.cancelAnimationFrame(this.animationFrame);
      this.animationFrame = 0;
    }
    this.task = null;
    this.unbindCameraPresetKeys();
    this.sdkController.destroy();
  }

  private readonly animate = (): void => {
    if (this.destroyed) {
      return;
    }
    this.update();
    this.animationFrame = window.requestAnimationFrame(this.animate);
  };

  private bindCameraPresetKeys(): () => void {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || isTextInputEvent(event)) {
        return;
      }
      if (this.handleCameraDistanceKey(event)) {
        return;
      }
      if (event.repeat) {
        return;
      }
      const preset = VEHICLE_CAMERA_PRESET_KEYS[event.code];
      if (!preset) {
        return;
      }
      this.setCameraPreset(preset);
      event.preventDefault();
    };
    document.addEventListener("keydown", onKeyDown, {capture: true});
    return () => document.removeEventListener("keydown", onKeyDown, {capture: true});
  }

  private handleCameraDistanceKey(event: KeyboardEvent): boolean {
    if (event.ctrlKey || event.metaKey || event.altKey || !VEHICLE_EXTERIOR_CAMERA_PRESETS.has(this.state.cameraPreset)) {
      return false;
    }
    let direction: -1 | 0 | 1 = 0;
    if (event.code === "Minus" || event.code === "NumpadSubtract" || event.key === "-") {
      direction = -1;
    } else if (event.code === "Equal" || event.code === "NumpadAdd" || event.key === "+") {
      direction = 1;
    }
    if (direction === 0) {
      return false;
    }
    this.adjustExteriorCameraDistance(direction);
    event.preventDefault();
    return true;
  }

  private snapCameraToPreset(): void {
    const camera = this.computeCameraPreset(this.getWorldUp());
    this.state.cameraEye = camera.eye;
    this.state.cameraLook = camera.look;
    this.view.camera.eye = camera.eye;
    this.view.camera.look = camera.look;
    this.view.camera.up = camera.up;
  }

  private updateAircraftFromVehicleNavigation(): number {
    const now = performance.now();
    const dt = Math.max(0.001, Math.min(0.1, (now - this.state.lastTime) / 1000));
    this.state.lastTime = now;
    const worldUp = this.getWorldUp();

    let position = toVec3(this.vehicleCamera.eye);
    let forward = safeNormalize(sub3(toVec3(this.vehicleCamera.look), position), this.state.forward);
    const minAltitude = Number(this.config.minAltitude ?? 0);
    if (Number.isFinite(minAltitude)) {
      const altitude = dot3(position, worldUp);
      if (altitude < minAltitude) {
        position = add3(position, mul3(worldUp, minAltitude - altitude));
        if (dot3(forward, worldUp) < 0) {
          forward = flatDirection3(forward, worldUp);
        }
        this.vehicleCamera.eye = position;
        this.vehicleCamera.look = add3(position, forward);
      }
    }

    const cameraUp = safeNormalize(toVec3(this.vehicleCamera.up), worldUp);
    const right = safeNormalize(cross3(forward, cameraUp), this.state.right);
    const aircraftUp = safeNormalize(cross3(right, forward), cameraUp);
    this.state.position = position;
    this.state.forward = forward;
    this.state.right = right;
    this.state.up = aircraftUp;
    this.updateVisualState(dt);

    this.params.rootTransform.matrix = buildVehicleMatrix({
      position: this.state.visualPosition,
      right: this.state.visualRight,
      up: this.state.visualUp,
      forward: this.state.visualForward,
      forwardAxis: this.config.forwardAxis || "-Z"
    });

    this.updateCamera(worldUp, dt);
    return dt;
  }

  private updateVisualState(dt: number): void {
    const defaultSmoothing = this.state.cameraPreset === "trailing" ? 0 : 18;
    const smoothing = Math.max(0, Number(this.config.vehicleVisualSmoothing ?? defaultSmoothing));
    if (smoothing === 0) {
      this.state.visualPosition = this.state.position;
      this.state.visualForward = this.state.forward;
      this.state.visualRight = this.state.right;
      this.state.visualUp = this.state.up;
      return;
    }
    const t = 1 - Math.exp(-smoothing * dt);
    this.state.visualPosition = lerp3(this.state.visualPosition, this.state.position, t);
    const forward = safeNormalize(lerp3(this.state.visualForward, this.state.forward, t), this.state.forward);
    let up = safeNormalize(lerp3(this.state.visualUp, this.state.up, t), this.state.up);
    const right = safeNormalize(cross3(forward, up), this.state.right);
    up = safeNormalize(cross3(right, forward), this.state.up);
    this.state.visualForward = forward;
    this.state.visualRight = right;
    this.state.visualUp = up;
  }

  private updateCamera(worldUp: Vec3, dt: number): void {
    const desired = this.computeCameraPreset(worldUp);
    if (this.state.cameraPreset === "cockpit") {
      this.state.cameraEye = desired.eye;
      this.state.cameraLook = desired.look;
      this.view.camera.eye = desired.eye;
      this.view.camera.look = desired.look;
      this.view.camera.up = desired.up;
      return;
    }
    const eyeT = 1 - Math.exp(-Math.max(0, Number(this.config.cameraFollowSmoothing ?? 4.2)) * dt);
    const lookT = 1 - Math.exp(-Math.max(0, Number(this.config.cameraLookSmoothing ?? 7.5)) * dt);
    this.state.cameraEye = lerp3(this.state.cameraEye, desired.eye, eyeT);
    this.state.cameraLook = lerp3(this.state.cameraLook, desired.look, lookT);
    if (this.state.cameraPreset === "front") {
      this.state.cameraEye = this.keepFrontCameraAhead(worldUp, this.state.cameraEye);
    }
    this.view.camera.eye = this.state.cameraEye;
    this.view.camera.look = this.state.cameraLook;
    this.view.camera.up = desired.up;
  }

  private keepFrontCameraAhead(worldUp: Vec3, eye: Vec3): Vec3 {
    const target = visualAircraftState(this.state);
    const axes = stableAircraftCameraAxes(target, worldUp);
    const desiredDistance = Number(this.config.cameraDistance ?? 64) *
      Number(this.config.cameraFrontDistanceScale ?? 0.95) *
      this.exteriorCameraDistanceScale();
    const minDistance = Math.max(
      Number(this.config.cameraFrontMinDistance ?? 8),
      desiredDistance * Number(this.config.cameraFrontMinDistanceScale ?? 0.58)
    );
    const offset = sub3(eye, target.position);
    const frontDistance = dot3(offset, axes.forward);
    if (frontDistance >= minDistance) {
      return eye;
    }
    return add3(eye, mul3(axes.forward, minDistance - frontDistance));
  }

  private computeCameraPreset(worldUp: Vec3): AircraftCameraSnapshot {
    switch (this.state.cameraPreset) {
      case "left": return this.computeExteriorCamera(worldUp, {
        right: -1,
        distanceScale: Number(this.config.cameraSideDistanceScale ?? 0.82),
        heightScale: Number(this.config.cameraSideHeightScale ?? 0.42),
        lookAheadScale: Number(this.config.cameraSideLookAheadScale ?? 0.12)
      });
      case "right": return this.computeExteriorCamera(worldUp, {
        right: 1,
        distanceScale: Number(this.config.cameraSideDistanceScale ?? 0.82),
        heightScale: Number(this.config.cameraSideHeightScale ?? 0.42),
        lookAheadScale: Number(this.config.cameraSideLookAheadScale ?? 0.12)
      });
      case "front": return this.computeExteriorCamera(worldUp, {
        forward: 1,
        distanceScale: Number(this.config.cameraFrontDistanceScale ?? 0.95),
        heightScale: Number(this.config.cameraFrontHeightScale ?? 0.35),
        lookAheadScale: Number(this.config.cameraFrontLookAheadScale ?? 0)
      });
      case "top": return this.computeTopCamera(worldUp, false);
      case "topTrailing": return this.computeTopCamera(worldUp, true);
      case "rearWide": return this.computeExteriorCamera(worldUp, {
        forward: -1,
        distanceScale: Number(this.config.cameraRearWideDistanceScale ?? 1.65),
        heightScale: Number(this.config.cameraRearWideHeightScale ?? 0.95),
        lookAheadScale: Number(this.config.cameraRearWideLookAheadScale ?? 0.35)
      });
      case "cockpit": return this.computeCockpitCamera();
      default: return this.computeTrailingCamera(worldUp);
    }
  }

  private computeCockpitCamera(): AircraftCameraSnapshot {
    const target = visualAircraftState(this.state);
    const forwardAxis = this.config.forwardAxis || "-Z";
    const eyeOffset = Array.isArray(this.config.cameraCockpitEyeOffset)
      ? toVec3(this.config.cameraCockpitEyeOffset)
      : [0, -1.45, -0.35] as Vec3;
    const lookOffset = Array.isArray(this.config.cameraCockpitLookOffset)
      ? toVec3(this.config.cameraCockpitLookOffset)
      : [0, -14, -0.25] as Vec3;
    return {
      eye: aircraftLocalPointToWorld(eyeOffset, target, forwardAxis),
      look: aircraftLocalPointToWorld(lookOffset, target, forwardAxis),
      up: target.up
    };
  }

  private computeExteriorCamera(worldUp: Vec3, preset: {forward?: number; right?: number; distanceScale?: number; heightScale?: number; lookAheadScale?: number}): AircraftCameraSnapshot {
    const distance = Number(this.config.cameraDistance ?? 64) * Number(preset.distanceScale ?? 1) * this.exteriorCameraDistanceScale();
    const height = Number(this.config.cameraHeight ?? 18) * Number(preset.heightScale ?? 1);
    const lookAhead = Number(this.config.cameraLookAhead ?? 28) * Number(preset.lookAheadScale ?? 0);
    const lookHeight = Number(this.config.cameraLookHeight ?? 4);
    const target = visualAircraftState(this.state);
    const axes = stableAircraftCameraAxes(target, worldUp);
    let eye = add3(target.position, mul3(worldUp, height));
    if (preset.forward) {
      eye = add3(eye, mul3(axes.forward, distance * preset.forward));
    }
    if (preset.right) {
      eye = add3(eye, mul3(axes.right, distance * preset.right));
    }
    return {
      eye,
      look: add3(add3(target.position, mul3(axes.forward, lookAhead)), mul3(worldUp, lookHeight)),
      up: this.cameraUpForAircraft(worldUp, target)
    };
  }

  private computeTopCamera(worldUp: Vec3, trailing: boolean): AircraftCameraSnapshot {
    const distance = Number(this.config.cameraDistance ?? 64);
    const lookHeight = Number(this.config.cameraLookHeight ?? 4);
    const distanceScale = this.exteriorCameraDistanceScale();
    const topHeight = Number(this.config.cameraTopHeight ?? Math.max(distance * 1.35, Number(this.config.cameraHeight ?? 18) * 3.5)) * distanceScale;
    const trailingDistance = trailing ? Number(this.config.cameraTopTrailingDistance ?? distance * 0.55) * distanceScale : 0;
    const target = visualAircraftState(this.state);
    const axes = stableAircraftCameraAxes(target, worldUp);
    return {
      eye: add3(add3(target.position, mul3(worldUp, topHeight)), mul3(axes.forward, -trailingDistance)),
      look: add3(target.position, mul3(worldUp, lookHeight)),
      up: axes.forward
    };
  }

  private computeTrailingCamera(worldUp: Vec3): AircraftCameraSnapshot {
    const distance = Number(this.config.cameraDistance ?? 64) * this.exteriorCameraDistanceScale();
    const height = Number(this.config.cameraHeight ?? 18);
    const lateralOffset = Number(this.config.cameraLateralOffset ?? 0);
    const lookAhead = Number(this.config.cameraLookAhead ?? 28);
    const lookHeight = Number(this.config.cameraLookHeight ?? 4);
    let desiredEye = add3(
      add3(
        add3(this.state.position, mul3(this.state.forward, -distance)),
        mul3(worldUp, height)
      ),
      mul3(this.state.right, lateralOffset)
    );
    const cameraTrailFollow = clamp(Number(this.config.cameraTrailFollow ?? 0), 0, 1);
    if (cameraTrailFollow > 0) {
      const exhaustConfig = typeof this.config.exhaustPlume === "object" && this.config.exhaustPlume
        ? this.config.exhaustPlume
        : (this.config.exhaust || null);
      const exhaustOffset = Array.isArray(exhaustConfig?.offset)
        ? toVec3(exhaustConfig.offset)
        : [0, 0, 0] as Vec3;
      const trailHeight = Number(this.config.cameraTrailHeight ?? Math.max(0, height * 0.25));
      const exhaustPoint = aircraftLocalPointToWorld(exhaustOffset, this.state, this.config.forwardAxis || "-Z");
      const trailEye = add3(
        add3(
          add3(exhaustPoint, mul3(this.state.forward, -distance)),
          mul3(this.state.up, trailHeight)
        ),
        mul3(this.state.right, lateralOffset)
      );
      desiredEye = lerp3(desiredEye, trailEye, cameraTrailFollow);
    }
    const desiredLook = add3(
      add3(this.state.position, mul3(this.state.forward, lookAhead)),
      mul3(worldUp, lookHeight)
    );
    const target = visualAircraftState(this.state);
    return {
      eye: desiredEye,
      look: desiredLook,
      up: this.cameraUpForAircraft(worldUp, target)
    };
  }

  private cameraUpForAircraft(worldUp: Vec3, target: AircraftPose): Vec3 {
    if (this.config.cameraRollWithAircraft !== true) {
      return worldUp;
    }
    const scale = clamp(Number(this.config.cameraRollWithAircraftScale ?? 1), 0, 1);
    if (scale === 0) {
      return worldUp;
    }
    if (scale === 1) {
      return target.up;
    }
    return safeNormalize(lerp3(worldUp, target.up, scale), worldUp);
  }

  private exteriorCameraDistanceScale(): number {
    return clamp(
      Number(this.state.exteriorCameraDistanceScale ?? this.config.cameraExteriorDistanceScale ?? 1),
      Number(this.config.cameraExteriorMinDistanceScale ?? 0.35),
      Number(this.config.cameraExteriorMaxDistanceScale ?? 2.5)
    );
  }

  private getWorldUp(): Vec3 {
    return normalize(Array.from(this.view.viewer.scene.coordinateSystem.worldUp || [0, 0, 1]) as Vec3);
  }
}

/** @internal */
function isAircraftObjectId(objectId: string, modelId?: string): boolean {
  if (!objectId || !modelId) {
    return false;
  }
  const id = String(objectId);
  const model = String(modelId);
  return id === model ||
    id.startsWith(`${model}__`) ||
    id.startsWith(`${model}/`) ||
    id.startsWith("vehicleExhaust") ||
    id.startsWith("vehicleAfterburner") ||
    id.includes("__vehicleExhaust") ||
    id.includes(".vehicleExhaust") ||
    id.includes("__vehicleAfterburner") ||
    id.includes(".vehicleAfterburner");
}

function isTextInputEvent(event: KeyboardEvent): boolean {
  const target = event.target;
  if (!target || !(target instanceof HTMLElement)) {
    return false;
  }
  return target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName);
}

function maxAbsolutePitchDegrees(config: AircraftControllerConfig): number {
  return Math.max(
    Math.abs(Number(config.minShipPitchDegrees ?? -42)),
    Math.abs(Number(config.maxShipPitchDegrees ?? 54))
  );
}

function visualAircraftState(state: AircraftControllerState): AircraftPose {
  return {
    position: state.visualPosition || state.position,
    forward: state.visualForward || state.forward,
    right: state.visualRight || state.right,
    up: state.visualUp || state.up
  };
}

function stableAircraftCameraAxes(state: AircraftPose, worldUp: Vec3) {
  const forward = flatDirection3(state.forward, worldUp);
  const right = safeNormalize(cross3(forward, worldUp), state.right);
  return {forward, right};
}
