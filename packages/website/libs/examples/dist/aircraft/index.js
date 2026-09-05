// libs/examples/src/aircraft/AircraftAudio.ts
function createAircraftNoiseBuffer(context, { durationSeconds = 2, seed = 2654435769 } = {}) {
  const sampleCount = Math.max(1, Math.floor(context.sampleRate * durationSeconds));
  const buffer = context.createBuffer(1, sampleCount, context.sampleRate);
  const data = buffer.getChannelData(0);
  let value = seed >>> 0;
  for (let i = 0; i < sampleCount; i++) {
    value = 1664525 * value + 1013904223 >>> 0;
    data[i] = value / 4294967295 * 2 - 1;
  }
  return buffer;
}

// libs/examples/src/aircraft/AircraftMath.ts
function toVec3(value, fallback = [0, 0, 0]) {
  if (!value) {
    return [fallback[0], fallback[1], fallback[2]];
  }
  return [
    Number(value[0] || 0),
    Number(value[1] || 0),
    Number(value[2] || 0)
  ];
}
function add3(a, b) {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}
function sub3(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}
function mul3(v, scalar) {
  return [v[0] * scalar, v[1] * scalar, v[2] * scalar];
}
function cross3(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0]
  ];
}
function length3(v) {
  return Math.hypot(v[0], v[1], v[2]);
}
function dot3(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}
function normalize(v) {
  const len = length3(v);
  if (len === 0) {
    return [0, 0, 0];
  }
  return [v[0] / len, v[1] / len, v[2] / len];
}
function safeNormalize(v, fallback) {
  return length3(v) > 1e-5 ? normalize(v) : fallback;
}
function lerp3(a, b, t) {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t
  ];
}
function flatDirection3(direction, worldUp) {
  const flat = sub3(direction, mul3(worldUp, dot3(direction, worldUp)));
  return safeNormalize(flat, [1, 0, 0]);
}
function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
function basisFromForward(forward, worldUp, fallbackRight = [1, 0, 0]) {
  const normalizedForward = safeNormalize(forward, [0, 1, 0]);
  const flatForward = flatDirection3(normalizedForward, worldUp);
  const right = safeNormalize(cross3(flatForward, worldUp), fallbackRight);
  const up = safeNormalize(cross3(right, normalizedForward), worldUp);
  return {
    position: [0, 0, 0],
    forward: normalizedForward,
    right,
    up
  };
}
function vehicleLocalAxes(right, up, forward, forwardAxis) {
  let localX = right;
  let localY = up;
  let localZ = mul3(forward, -1);
  if (forwardAxis === "Z" || forwardAxis === "+Z") {
    localZ = forward;
    localX = mul3(right, -1);
  } else if (forwardAxis === "X" || forwardAxis === "+X") {
    localX = forward;
    localZ = right;
  } else if (forwardAxis === "-X") {
    localX = mul3(forward, -1);
    localZ = mul3(right, -1);
  } else if (forwardAxis === "Y" || forwardAxis === "+Y") {
    localY = forward;
    localZ = up;
  } else if (forwardAxis === "-Y") {
    localY = mul3(forward, -1);
    localZ = mul3(up, -1);
  }
  return { localX, localY, localZ };
}
function buildVehicleMatrix({ position, right, up, forward, forwardAxis }) {
  const { localX, localY, localZ } = vehicleLocalAxes(right, up, forward, forwardAxis);
  return [
    localX[0],
    localX[1],
    localX[2],
    0,
    localY[0],
    localY[1],
    localY[2],
    0,
    localZ[0],
    localZ[1],
    localZ[2],
    0,
    position[0],
    position[1],
    position[2],
    1
  ];
}
function aircraftLocalPointToWorld(localPoint, state, forwardAxis) {
  const axes = vehicleLocalAxes(state.right, state.up, state.forward, forwardAxis);
  return add3(
    add3(
      add3(state.position, mul3(axes.localX, localPoint[0])),
      mul3(axes.localY, localPoint[1])
    ),
    mul3(axes.localZ, localPoint[2])
  );
}
function segmentMatrixBetween(start, end, radius, fallbackUp, fallbackRight) {
  const axis = sub3(end, start);
  const length = Math.max(1e-3, length3(axis));
  const yAxis = safeNormalize(axis, [0, 1, 0]);
  let xAxis = cross3(yAxis, fallbackUp);
  if (length3(xAxis) < 1e-4) {
    xAxis = cross3(yAxis, fallbackRight);
  }
  xAxis = safeNormalize(xAxis, [1, 0, 0]);
  const zAxis = safeNormalize(cross3(xAxis, yAxis), [0, 0, 1]);
  return [
    xAxis[0] * radius,
    xAxis[1] * radius,
    xAxis[2] * radius,
    0,
    yAxis[0] * length,
    yAxis[1] * length,
    yAxis[2] * length,
    0,
    zAxis[0] * radius,
    zAxis[1] * radius,
    zAxis[2] * radius,
    0,
    start[0],
    start[1],
    start[2],
    1
  ];
}

// libs/examples/src/aircraft/AircraftController.ts
var VEHICLE_CAMERA_PRESET_KEYS = {
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
var VEHICLE_EXTERIOR_CAMERA_PRESETS = /* @__PURE__ */ new Set([
  "trailing",
  "left",
  "right",
  "front",
  "top",
  "topTrailing",
  "rearWide"
]);
var AircraftController = class {
  /** Stable controller type string for diagnostics and app-level routing. */
  type = "vehicle-navigation-aircraft";
  /** Mutable physical, visual and camera state. */
  state;
  /** Underlying SDK vehicle navigation controller. */
  sdkController;
  /** Proxy View passed to {@link VehicleNavigationController}. */
  vehicleView;
  /** Update loop implementation. Currently always `"sdk-task"`. */
  updateMode;
  view;
  params;
  config;
  vehicleCamera;
  unbindCameraPresetKeys;
  animationFrame = 0;
  task = null;
  destroyed = false;
  /**
   * Creates an aircraft controller for a View.
   *
   * @param view View whose camera will track the aircraft.
   * @param params Root transform, optional exhaust trail, input binding and
   * flight/camera configuration.
   */
  constructor(view, params) {
    this.view = view;
    this.params = params;
    this.config = params.config || {};
    const worldUp = this.getWorldUp();
    const initialEye = toVec3(view.camera.eye);
    const initialLook = toVec3(view.camera.look);
    const initialForward = safeNormalize(sub3(initialLook, initialEye), [0, 1, 0]);
    const initialBasis = basisFromForward(initialForward, worldUp);
    const cameraDistance = Number(this.config.cameraDistance ?? 64);
    const cameraHeight = Number(this.config.cameraHeight ?? 18);
    const initialPosition = Array.isArray(this.config.initialShipPosition) ? toVec3(this.config.initialShipPosition) : sub3(add3(initialEye, mul3(initialForward, cameraDistance)), mul3(worldUp, cameraHeight));
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
      camera: this.vehicleCamera,
      objects: view.objects,
      viewer: view.viewer
    };
    const maxForwardSpeed = Number(this.config.maxForwardSpeed ?? 135);
    const objectFilter = params.objectFilter || ((objectId) => !isAircraftObjectId(objectId, this.config.modelId));
    const VehicleNavigationController = params.VehicleNavigationController;
    if (!VehicleNavigationController) {
      throw new Error("[AircraftController] VehicleNavigationController dependency is required");
    }
    this.sdkController = new VehicleNavigationController(this.vehicleView, {
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
      flightAirDrag: Number(this.config.flightAirDrag ?? Number(this.config.coastDeceleration ?? 2.8) / Math.max(maxForwardSpeed, 1)),
      flightGravity: Number(this.config.flightGravity ?? 0),
      flightSoftLandingRange: Number(this.config.flightSoftLandingRange ?? 0.75),
      flightPitchRateDegreesPerSecond: Number(this.config.shipPitchRateDegreesPerSecond ?? this.config.flightPitchRateDegreesPerSecond ?? 54),
      flightSteeringResponse: Number(this.config.flightSteeringResponse ?? 4.6),
      aircraftControlSurfaces: this.config.aircraftControlSurfaces !== false,
      controlSurfaceResponse: Number(this.config.controlSurfaceResponse ?? 5.5),
      controlSurfaceReturnResponse: Number(this.config.controlSurfaceReturnResponse ?? 3.5),
      mouseDragYawSensitivity: Number(this.config.shipMouseDragYawSensitivity ?? this.config.mouseDragYawSensitivity ?? this.config.shipMouseDragSensitivity ?? 28e-4),
      mouseDragPitchSensitivity: Number(this.config.shipMouseDragPitchSensitivity ?? this.config.mouseDragPitchSensitivity ?? this.config.shipMouseDragSensitivity ?? 28e-4),
      mouseDragResponse: Number(this.config.shipMouseDragResponse ?? this.config.mouseDragResponse ?? 7.5),
      maxMouseDragInputPerFrame: Number(this.config.maxShipMouseDragInputPerFrame ?? this.config.maxMouseDragInputPerFrame ?? 0.65),
      obstacleFilter: objectFilter,
      driveSurfaceFilter: objectFilter
    });
    this.sdkController.speed = clamp(Number(this.config.startSpeed ?? 34), 0, maxForwardSpeed);
    if (this.config.startFlying !== false) {
      this.sdkController.flying = true;
    }
    this.unbindCameraPresetKeys = params.bindKeyboard === false ? () => void 0 : this.bindCameraPresetKeys();
    this.updateMode = "raf";
    this.animationFrame = window.requestAnimationFrame(this.animate);
  }
  /**
   * Advances the aircraft one frame.
   *
   * This is normally called by the controller's internal repeating SDKTask.
   * Call it manually only when integrating with a custom task lifecycle.
   */
  update() {
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
  setCameraPreset(preset) {
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
  adjustExteriorCameraDistance(direction) {
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
  destroy() {
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
  animate = () => {
    if (this.destroyed) {
      return;
    }
    this.update();
    this.animationFrame = window.requestAnimationFrame(this.animate);
  };
  bindCameraPresetKeys() {
    const onKeyDown = (event) => {
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
    document.addEventListener("keydown", onKeyDown, { capture: true });
    return () => document.removeEventListener("keydown", onKeyDown, { capture: true });
  }
  handleCameraDistanceKey(event) {
    if (event.ctrlKey || event.metaKey || event.altKey || !VEHICLE_EXTERIOR_CAMERA_PRESETS.has(this.state.cameraPreset)) {
      return false;
    }
    let direction = 0;
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
  snapCameraToPreset() {
    const camera = this.computeCameraPreset(this.getWorldUp());
    this.state.cameraEye = camera.eye;
    this.state.cameraLook = camera.look;
    this.view.camera.eye = camera.eye;
    this.view.camera.look = camera.look;
    this.view.camera.up = camera.up;
  }
  updateAircraftFromVehicleNavigation() {
    const now = performance.now();
    const dt = Math.max(1e-3, Math.min(0.1, (now - this.state.lastTime) / 1e3));
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
  updateVisualState(dt) {
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
  updateCamera(worldUp, dt) {
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
  keepFrontCameraAhead(worldUp, eye) {
    const target = visualAircraftState(this.state);
    const axes = stableAircraftCameraAxes(target, worldUp);
    const desiredDistance = Number(this.config.cameraDistance ?? 64) * Number(this.config.cameraFrontDistanceScale ?? 0.95) * this.exteriorCameraDistanceScale();
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
  computeCameraPreset(worldUp) {
    switch (this.state.cameraPreset) {
      case "left":
        return this.computeExteriorCamera(worldUp, {
          right: -1,
          distanceScale: Number(this.config.cameraSideDistanceScale ?? 0.82),
          heightScale: Number(this.config.cameraSideHeightScale ?? 0.42),
          lookAheadScale: Number(this.config.cameraSideLookAheadScale ?? 0.12)
        });
      case "right":
        return this.computeExteriorCamera(worldUp, {
          right: 1,
          distanceScale: Number(this.config.cameraSideDistanceScale ?? 0.82),
          heightScale: Number(this.config.cameraSideHeightScale ?? 0.42),
          lookAheadScale: Number(this.config.cameraSideLookAheadScale ?? 0.12)
        });
      case "front":
        return this.computeExteriorCamera(worldUp, {
          forward: 1,
          distanceScale: Number(this.config.cameraFrontDistanceScale ?? 0.95),
          heightScale: Number(this.config.cameraFrontHeightScale ?? 0.35),
          lookAheadScale: Number(this.config.cameraFrontLookAheadScale ?? 0)
        });
      case "top":
        return this.computeTopCamera(worldUp, false);
      case "topTrailing":
        return this.computeTopCamera(worldUp, true);
      case "rearWide":
        return this.computeExteriorCamera(worldUp, {
          forward: -1,
          distanceScale: Number(this.config.cameraRearWideDistanceScale ?? 1.65),
          heightScale: Number(this.config.cameraRearWideHeightScale ?? 0.95),
          lookAheadScale: Number(this.config.cameraRearWideLookAheadScale ?? 0.35)
        });
      case "cockpit":
        return this.computeCockpitCamera();
      default:
        return this.computeTrailingCamera(worldUp);
    }
  }
  computeCockpitCamera() {
    const target = visualAircraftState(this.state);
    const forwardAxis = this.config.forwardAxis || "-Z";
    const eyeOffset = Array.isArray(this.config.cameraCockpitEyeOffset) ? toVec3(this.config.cameraCockpitEyeOffset) : [0, -1.45, -0.35];
    const lookOffset = Array.isArray(this.config.cameraCockpitLookOffset) ? toVec3(this.config.cameraCockpitLookOffset) : [0, -14, -0.25];
    return {
      eye: aircraftLocalPointToWorld(eyeOffset, target, forwardAxis),
      look: aircraftLocalPointToWorld(lookOffset, target, forwardAxis),
      up: target.up
    };
  }
  computeExteriorCamera(worldUp, preset) {
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
  computeTopCamera(worldUp, trailing) {
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
  computeTrailingCamera(worldUp) {
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
      const exhaustConfig = typeof this.config.exhaustPlume === "object" && this.config.exhaustPlume ? this.config.exhaustPlume : this.config.exhaust || null;
      const exhaustOffset = Array.isArray(exhaustConfig?.offset) ? toVec3(exhaustConfig.offset) : [0, 0, 0];
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
  cameraUpForAircraft(worldUp, target) {
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
  exteriorCameraDistanceScale() {
    return clamp(
      Number(this.state.exteriorCameraDistanceScale ?? this.config.cameraExteriorDistanceScale ?? 1),
      Number(this.config.cameraExteriorMinDistanceScale ?? 0.35),
      Number(this.config.cameraExteriorMaxDistanceScale ?? 2.5)
    );
  }
  getWorldUp() {
    return normalize(Array.from(this.view.viewer.scene.coordinateSystem.worldUp || [0, 0, 1]));
  }
};
function isAircraftObjectId(objectId, modelId) {
  if (!objectId || !modelId) {
    return false;
  }
  const id = String(objectId);
  const model = String(modelId);
  return id === model || id.startsWith(`${model}__`) || id.startsWith(`${model}/`) || id.startsWith("vehicleExhaust") || id.startsWith("vehicleAfterburner") || id.includes("__vehicleExhaust") || id.includes(".vehicleExhaust") || id.includes("__vehicleAfterburner") || id.includes(".vehicleAfterburner");
}
function isTextInputEvent(event) {
  const target = event.target;
  if (!target || !(target instanceof HTMLElement)) {
    return false;
  }
  return target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName);
}
function maxAbsolutePitchDegrees(config) {
  return Math.max(
    Math.abs(Number(config.minShipPitchDegrees ?? -42)),
    Math.abs(Number(config.maxShipPitchDegrees ?? 54))
  );
}
function visualAircraftState(state) {
  return {
    position: state.visualPosition || state.position,
    forward: state.visualForward || state.forward,
    right: state.visualRight || state.right,
    up: state.visualUp || state.up
  };
}
function stableAircraftCameraAxes(state, worldUp) {
  const forward = flatDirection3(state.forward, worldUp);
  const right = safeNormalize(cross3(forward, worldUp), state.right);
  return { forward, right };
}

// libs/examples/src/aircraft/AircraftExhaustTrail.ts
var DEFAULT_TRIANGLES_PRIMITIVE = 20002;
var AircraftExhaustTrail = class {
  /** Generated dynamic SceneModel containing trail and flame geometry. */
  sceneModel;
  /** All generated SceneObject IDs. */
  objectIds = [];
  /** Generated trail SceneObject IDs. */
  trailObjectIds = [];
  /** Generated afterburner SceneObject IDs. */
  afterburnerObjectIds = [];
  /** Mutable transforms for trail segments. */
  trailTransforms = [];
  /** Aircraft-local exhaust emitter offset. */
  offset;
  /** Local aircraft axis used as the forward direction. */
  axis;
  /** Number of trail segments. */
  trailSegments;
  /** Target spacing between generated trail samples. */
  segmentSpacing;
  /** Fraction of emitter movement carried by existing samples. */
  trailAdvection;
  /** Tether strength pulling samples back toward the emitter path. */
  trailTether;
  /** Base trail radius. */
  radius;
  /** Radius growth along the trail. */
  trailExpansion;
  /** Sideways trail curl amount. */
  wander;
  /** Speed used to normalize trail/afterburner intensity. */
  maxForwardSpeed;
  /** Resolved afterburner config, or `null` when disabled. */
  afterburner;
  afterburnerLayers = [];
  history = [];
  lastEmitter = null;
  lastEmissionPosition = null;
  pulsePhase = 0;
  sampleSerial = 0;
  /**
   * Creates generated trail geometry and materials.
   */
  constructor({
    scene,
    modelId,
    coordinateSystem,
    config = {},
    trianglesPrimitive = DEFAULT_TRIANGLES_PRIMITIVE,
    compressGeometryParams = (params) => params
  }) {
    const exhaustConfig = typeof config.exhaustPlume === "object" && config.exhaustPlume ? config.exhaustPlume : config.exhaust || {};
    const exhaustModelId = exhaustConfig?.modelId || `${modelId}Exhaust`;
    this.sceneModel = unwrapResult(scene.createModel({
      id: exhaustModelId,
      updateHint: "dynamic",
      coordinateSystem
    }));
    this.axis = config.forwardAxis || "-Z";
    this.offset = Array.isArray(exhaustConfig?.offset) ? toVec3(exhaustConfig.offset) : [0, 0, 0];
    const radialSegments = Math.max(5, Math.floor(Number(exhaustConfig?.radialSegments ?? 8)));
    this.radius = Number(exhaustConfig?.radius ?? 1.2);
    this.wander = Number(exhaustConfig?.wander ?? 1.4);
    this.trailSegments = Math.max(10, Math.floor(Number(exhaustConfig?.trailSegments ?? 22)));
    const trailLength = Number(exhaustConfig?.trailLength ?? 36);
    const trailOpacity = Number(exhaustConfig?.trailOpacity ?? 0.16);
    this.trailExpansion = Number(exhaustConfig?.trailExpansion ?? 1.35);
    this.trailAdvection = clamp(Number(exhaustConfig?.trailAdvection ?? 0.68), 0, 0.98);
    this.trailTether = Math.max(0, Number(exhaustConfig?.trailTether ?? 1.35));
    this.segmentSpacing = trailLength / this.trailSegments;
    this.maxForwardSpeed = Number(config.maxForwardSpeed ?? 135);
    this.afterburner = resolveAfterburnerConfig(config, exhaustConfig);
    const trailGeometry = compressGeometryParams({
      id: "vehicleExhaustTrailGeometry",
      primitive: trianglesPrimitive,
      ...createTrailSegmentGeometry(radialSegments)
    });
    trailGeometry.edgeIndices = void 0;
    unwrapResult(this.sceneModel.createGeometryCompressed(trailGeometry));
    for (let i = 0; i < this.trailSegments; i++) {
      const t = this.trailSegments <= 1 ? 0 : i / (this.trailSegments - 1);
      const materialId = `vehicleExhaustTrailMaterial_${i}`;
      const transformId = `vehicleExhaustTrailTransform_${i}`;
      const meshId = `vehicleExhaustTrailMesh_${i}`;
      const objectId = `vehicleExhaustTrail_${i}`;
      const warm = Math.max(0, 1 - t * 1.35);
      const cool = 1 - warm;
      unwrapResult(this.sceneModel.createMaterial({
        id: materialId,
        color: [
          1 * warm + 0.5 * cool,
          0.34 * warm + 0.72 * cool,
          0.08 * warm + 0.96 * cool
        ],
        emissiveColor: [
          0.64 * warm + 0.04 * cool,
          0.18 * warm + 0.08 * cool,
          0.02 * warm + 0.16 * cool
        ],
        opacity: Math.max(0.015, trailOpacity * Math.pow(1 - t, 1.25)),
        alphaMode: "BLEND",
        roughness: 0.32,
        metallic: 0
      }));
      const transform = unwrapResult(this.sceneModel.createTransform({
        id: transformId,
        matrix: hiddenExhaustMatrix()
      }));
      unwrapResult(this.sceneModel.createMesh({
        id: meshId,
        geometryId: "vehicleExhaustTrailGeometry",
        materialId,
        parentTransformId: transformId
      }));
      unwrapResult(this.sceneModel.createObject({
        id: objectId,
        meshIds: [meshId],
        clippable: false
      }));
      this.trailTransforms.push(transform);
      this.trailObjectIds.push(objectId);
      this.objectIds.push(objectId);
    }
    if (this.afterburner) {
      this.createAfterburner(this.afterburner, trianglesPrimitive, compressGeometryParams);
    }
  }
  /**
   * Updates trail and afterburner transforms from the aircraft controller state.
   *
   * @param config Current aircraft config.
   * @param speed Current forward speed.
   * @param state Current aircraft pose/state.
   * @param dt Elapsed seconds since the previous update.
   */
  update(config, speed, state, dt) {
    const maxForwardSpeed = Math.max(1, Number(config.maxForwardSpeed ?? this.maxForwardSpeed ?? 135));
    const speedRatio = clamp(Math.max(0, speed) / maxForwardSpeed, 0, 1);
    this.pulsePhase += dt * (0.75 + speedRatio * 1.35);
    this.updateTrail(state, speedRatio, dt);
    this.updateAfterburner(state, speedRatio);
  }
  updateTrail(state, speedRatio, dt) {
    if (!this.trailTransforms.length || !state) {
      return;
    }
    const exhaustState = visualAircraftState2(state);
    const emitter = aircraftLocalPointToWorld(this.offset, exhaustState, this.axis);
    const emitterDelta = this.lastEmitter ? sub3(emitter, this.lastEmitter) : [0, 0, 0];
    if (this.history.length === 0) {
      this.seedTrail(exhaustState, emitter);
    } else {
      const carried = mul3(emitterDelta, this.trailAdvection);
      const tetherT = 1 - Math.exp(-this.trailTether * dt);
      for (const sample of this.history) {
        sample.position = add3(sample.position, carried);
        const target = add3(emitter, mul3(exhaustState.forward, -this.segmentSpacing * (this.history.indexOf(sample) + 1)));
        sample.position = lerp3(sample.position, target, tetherT);
      }
      let emissionCursor = this.lastEmissionPosition || this.lastEmitter || emitter;
      let pending = sub3(emitter, emissionCursor);
      let pendingDistance = length3(pending);
      let emitted = 0;
      while (pendingDistance >= this.segmentSpacing && emitted < this.trailSegments) {
        const direction = mul3(pending, 1 / pendingDistance);
        emissionCursor = add3(emissionCursor, mul3(direction, this.segmentSpacing));
        this.history.unshift(this.createSample(emissionCursor, exhaustState, this.sampleSerial++, direction));
        pending = sub3(emitter, emissionCursor);
        pendingDistance = length3(pending);
        emitted++;
      }
      if (emitted > 0) {
        this.history.length = Math.min(this.history.length, this.trailSegments);
        this.lastEmissionPosition = emissionCursor;
      }
    }
    this.lastEmitter = emitter;
    for (const sample of this.history) {
      sample.age += dt;
    }
    const samples = [this.createSample(emitter, exhaustState, this.sampleSerial), ...this.history];
    while (samples.length <= this.trailSegments) {
      const lastSample = samples[samples.length - 1] || samples[0];
      const nextForward = lastSample.forward || exhaustState.forward;
      const nextPosition = add3(lastSample.position, mul3(nextForward, -this.segmentSpacing));
      samples.push({
        position: nextPosition,
        side: lastSample.side,
        lift: lastSample.lift,
        forward: nextForward,
        phase: lastSample.phase + 0.83,
        age: lastSample.age + 0.08
      });
    }
    const displayPoints = samples.map((sample, index) => this.sampleDisplayPosition(sample, index, speedRatio));
    const radiusBoost = 0.84 + speedRatio * 0.55;
    for (let i = 0; i < this.trailTransforms.length; i++) {
      const start = displayPoints[i];
      const end = displayPoints[i + 1];
      const t = this.trailTransforms.length <= 1 ? 0 : i / (this.trailTransforms.length - 1);
      const radius = this.radius * radiusBoost * (0.34 + Math.pow(t, 0.82) * this.trailExpansion);
      this.trailTransforms[i].matrix = segmentMatrixBetween(start, end, radius, samples[i]?.lift || exhaustState.up, samples[i]?.side || exhaustState.right);
    }
  }
  seedTrail(state, emitter) {
    this.history.length = 0;
    for (let i = 1; i <= this.trailSegments; i++) {
      const position = add3(emitter, mul3(state.forward, -this.segmentSpacing * i));
      const sample = this.createSample(position, state, this.sampleSerial++);
      sample.age = i * 0.045;
      this.history.push(sample);
    }
    this.lastEmissionPosition = emitter;
  }
  createSample(position, state, serial, forwardOverride = null) {
    const basis = forwardOverride ? basisFromForward(forwardOverride, state.up, state.right) : state;
    return {
      position,
      side: basis.right,
      lift: basis.up,
      forward: basis.forward,
      phase: serial * 0.73,
      age: 0
    };
  }
  sampleDisplayPosition(sample, index, speedRatio) {
    const t = this.trailSegments <= 0 ? 0 : index / this.trailSegments;
    const curl = this.wander * Math.pow(t, 1.15) * (0.035 + speedRatio * 0.13);
    const phase = sample.phase + sample.age * 0.62 + this.pulsePhase * 0.16;
    return add3(
      add3(sample.position, mul3(sample.side, Math.sin(phase + t * 3.8) * curl)),
      mul3(sample.lift, Math.sin(phase * 1.22 + t * 4.2) * curl * 0.08)
    );
  }
  createAfterburner(afterburner, trianglesPrimitive, compressGeometryParams) {
    const radialSegments = Math.max(5, Math.floor(Number(afterburner.radialSegments ?? 12)));
    const geometry = compressGeometryParams({
      id: "vehicleAfterburnerFlameGeometry",
      primitive: trianglesPrimitive,
      ...createAfterburnerGeometry(radialSegments)
    });
    geometry.edgeIndices = void 0;
    unwrapResult(this.sceneModel.createGeometryCompressed(geometry));
    const layers = [
      {
        id: "core",
        color: [0.72, 0.92, 1],
        emissiveColor: [1, 1, 1],
        opacity: 0.74,
        lengthScale: 0.62,
        radiusScale: Number(afterburner.coreRadiusScale ?? 0.44),
        phase: 0.3
      },
      {
        id: "flame",
        color: [1, 0.42, 0.08],
        emissiveColor: [1, 0.33, 0.04],
        opacity: 0.58,
        lengthScale: 1,
        radiusScale: 1,
        phase: 1.8
      },
      {
        id: "halo",
        color: [1, 0.12, 0.02],
        emissiveColor: [0.8, 0.08, 0.02],
        opacity: 0.28,
        lengthScale: 1.16,
        radiusScale: Number(afterburner.haloRadiusScale ?? 1.46),
        phase: 2.7
      }
    ];
    for (const layer of layers) {
      const materialId = `vehicleAfterburnerMaterial_${layer.id}`;
      const transformId = `vehicleAfterburnerTransform_${layer.id}`;
      const meshId = `vehicleAfterburnerMesh_${layer.id}`;
      const objectId = `vehicleAfterburner_${layer.id}`;
      unwrapResult(this.sceneModel.createMaterial({
        id: materialId,
        color: layer.color,
        emissiveColor: layer.emissiveColor,
        opacity: layer.opacity,
        alphaMode: "BLEND",
        roughness: 0.12,
        metallic: 0
      }));
      const transform = unwrapResult(this.sceneModel.createTransform({
        id: transformId,
        matrix: hiddenExhaustMatrix()
      }));
      unwrapResult(this.sceneModel.createMesh({
        id: meshId,
        geometryId: "vehicleAfterburnerFlameGeometry",
        materialId,
        parentTransformId: transformId
      }));
      unwrapResult(this.sceneModel.createObject({
        id: objectId,
        meshIds: [meshId],
        clippable: false
      }));
      this.afterburnerLayers.push({
        transform,
        lengthScale: layer.lengthScale,
        radiusScale: layer.radiusScale,
        phase: layer.phase
      });
      this.afterburnerObjectIds.push(objectId);
      this.objectIds.push(objectId);
    }
  }
  updateAfterburner(state, speedRatio) {
    if (!this.afterburner || this.afterburnerLayers.length === 0) {
      return;
    }
    const threshold = clamp(Number(this.afterburner.threshold ?? 0.62), 0, 0.98);
    const intensity = clamp((speedRatio - threshold) / Math.max(0.01, 1 - threshold), 0, 1);
    if (intensity <= 0.01) {
      for (const layer of this.afterburnerLayers) {
        layer.transform.matrix = hiddenExhaustMatrix();
      }
      return;
    }
    const aircraftState = visualAircraftState2(state);
    const emitter = aircraftLocalPointToWorld(this.offset, aircraftState, this.axis);
    const baseLength = Number(this.afterburner.length ?? this.segmentSpacing * 2.2);
    const minLength = Number(this.afterburner.minLength ?? baseLength * 0.36);
    const baseRadius = Number(this.afterburner.radius ?? this.radius * 0.82);
    const flicker = Number(this.afterburner.flicker ?? 0.16);
    const pulse = 1 + Math.sin(this.pulsePhase * 7.5) * flicker + Math.sin(this.pulsePhase * 12.8 + 1.2) * flicker * 0.42;
    const length = (minLength + (baseLength - minLength) * intensity) * Math.max(0.25, pulse);
    const radius = baseRadius * (0.42 + intensity * 0.78);
    const start = add3(emitter, mul3(aircraftState.forward, -0.08 * length));
    for (const layer of this.afterburnerLayers) {
      const layerPulse = 1 + Math.sin(this.pulsePhase * 9 + layer.phase) * flicker * 0.55;
      const end = add3(emitter, mul3(aircraftState.forward, -length * layer.lengthScale * layerPulse));
      layer.transform.matrix = segmentMatrixBetween(
        start,
        end,
        radius * layer.radiusScale * Math.max(0.18, layerPulse),
        aircraftState.up,
        aircraftState.right
      );
    }
  }
};
function visualAircraftState2(state) {
  return {
    position: state.visualPosition || state.position,
    forward: state.visualForward || state.forward,
    right: state.visualRight || state.right,
    up: state.visualUp || state.up
  };
}
function createTrailSegmentGeometry(radialSegments) {
  const positions = [];
  const normals = [];
  const indices = [];
  const rings = [
    { y: 0, radius: 0.88 },
    { y: 1, radius: 1 }
  ];
  for (const ring of rings) {
    for (let j = 0; j < radialSegments; j++) {
      const angle = j / radialSegments * Math.PI * 2;
      const x = Math.cos(angle);
      const z = Math.sin(angle);
      positions.push(x * ring.radius, ring.y, z * ring.radius);
      normals.push(x, 0, z);
    }
  }
  for (let i = 0; i < rings.length - 1; i++) {
    const ring = i * radialSegments;
    const nextRing = (i + 1) * radialSegments;
    for (let j = 0; j < radialSegments; j++) {
      const nextJ = (j + 1) % radialSegments;
      const a = ring + j;
      const b = ring + nextJ;
      const c = nextRing + j;
      const d = nextRing + nextJ;
      indices.push(a, c, b, b, c, d);
    }
  }
  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    indices: new Uint32Array(indices)
  };
}
function createAfterburnerGeometry(radialSegments) {
  const positions = [];
  const normals = [];
  const indices = [];
  const rings = [
    { y: 0, radius: 0.7 },
    { y: 0.34, radius: 1 },
    { y: 0.78, radius: 0.44 },
    { y: 1, radius: 0.04 }
  ];
  for (const ring of rings) {
    for (let j = 0; j < radialSegments; j++) {
      const angle = j / radialSegments * Math.PI * 2;
      const x = Math.cos(angle);
      const z = Math.sin(angle);
      positions.push(x * ring.radius, ring.y, z * ring.radius);
      normals.push(x, 0.2, z);
    }
  }
  for (let i = 0; i < rings.length - 1; i++) {
    const ring = i * radialSegments;
    const nextRing = (i + 1) * radialSegments;
    for (let j = 0; j < radialSegments; j++) {
      const nextJ = (j + 1) % radialSegments;
      const a = ring + j;
      const b = ring + nextJ;
      const c = nextRing + j;
      const d = nextRing + nextJ;
      indices.push(a, c, b, b, c, d);
    }
  }
  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    indices: new Uint32Array(indices)
  };
}
function resolveAfterburnerConfig(config, exhaustConfig) {
  const afterburner = config.afterburner ?? exhaustConfig?.afterburner;
  if (!afterburner) {
    return null;
  }
  if (afterburner === true) {
    return {};
  }
  if (typeof afterburner === "object" && afterburner.enabled !== false) {
    return afterburner;
  }
  return null;
}
function hiddenExhaustMatrix() {
  return [
    1e-4,
    0,
    0,
    0,
    0,
    1e-4,
    0,
    0,
    0,
    0,
    1e-4,
    0,
    0,
    0,
    -1e5,
    1
  ];
}
function unwrapResult(result) {
  if (!result.ok) {
    throw result.error;
  }
  return result.value;
}
export {
  AircraftController,
  AircraftExhaustTrail,
  createAircraftNoiseBuffer
};
//# sourceMappingURL=index.js.map
