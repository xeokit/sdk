import {createFictionalFastJetDefinition} from "./FastJetModels";
import {AmsterdamFlightCoordinateSystem, createLevelBodyToWorldOrientation} from "./FlightConventions";
import {FixedStepFlightSimulation} from "./FixedStepFlightSimulation";
import {rotateVec3ByQuat} from "./FlightMath";

export interface FastJetExampleRuntimeParams {
  view: any;
  rootTransform: any;
  exhaust?: any;
  config: any;
  record?: any;
}

export function createFastJetExampleRuntime({view, rootTransform, exhaust, config, record}: FastJetExampleRuntimeParams) {
  const worldUp = normalize3(Array.from(view.viewer.scene.coordinateSystem.worldUp || [0, 0, 1]));
  const coordinateSystem = {
    ...AmsterdamFlightCoordinateSystem,
    worldUp
  };
  const simConfig = config.flightSimulation || {};
  const initialPosition = Array.isArray(config.initialShipPosition) ? toVec3(config.initialShipPosition) : [0, 0, Number(config.minAltitude ?? 20)];
  const startSpeed = Number(simConfig.startSpeed ?? config.startSpeed ?? 44);
  const initialOrientation = createLevelBodyToWorldOrientation(coordinateSystem);
  const aircraft = createFictionalFastJetDefinition({
    mass: Number(simConfig.mass ?? 850),
    referenceArea: Number(simConfig.referenceArea ?? 4),
    referenceSpan: Number(simConfig.referenceSpan ?? 5.5),
    referenceChord: Number(simConfig.referenceChord ?? 1.8),
    inertiaBody: Array.isArray(simConfig.inertiaBody) ? simConfig.inertiaBody : [
      800, 0, 0,
      0, 2400, 0,
      0, 0, 3000
    ],
    maxThrust: Number(simConfig.maxThrust ?? 2600),
    aerodynamics: simConfig.aerodynamics
  });
  const simulation = new FixedStepFlightSimulation({
    aircraft,
    initialState: {
      positionWorld: initialPosition,
      velocityWorld: scale3([0, 1, 0], startSpeed),
      orientationBodyToWorld: initialOrientation,
      angularVelocityBody: [0, 0, 0]
    },
    coordinateSystem,
    fixedDt: Number(simConfig.fixedDt ?? 1 / 120),
    gravity: Number(simConfig.gravity ?? 9.80665),
    wind: {
      sample: () => Array.isArray(simConfig.windWorld) ? simConfig.windWorld : [0, 0, 0]
    }
  });
  const keysDown = new Set<string>();
  const state: any = {
    position: initialPosition.slice(),
    forward: [0, 1, 0],
    right: [1, 0, 0],
    up: worldUp,
    visualPosition: initialPosition.slice(),
    visualForward: [0, 1, 0],
    visualRight: [1, 0, 0],
    visualUp: worldUp,
    cameraEye: Array.from(view.camera.eye || initialPosition),
    cameraLook: Array.from(view.camera.look || add3(initialPosition, [0, 1, 0])),
    cameraPreset: simConfig.cameraPreset || "trailing",
    exteriorCameraDistanceScale: clamp(Number(config.cameraExteriorDistanceScale ?? 1), 0.35, 2.5),
    lastTime: performance.now()
  };
  const vehicleCamera = {
    eye: state.position,
    look: add3(state.position, state.forward),
    up: state.up
  };
  let destroyed = false;
  let animationFrame = 0;
  let pointerId: number | null = null;
  let pointerLastX = 0;
  let pointerLastY = 0;
  let mouseYaw = 0;
  let mousePitch = 0;
  const modelNavigation = record?.modelNavigation;
  const previousModelNavigationControllerActive = modelNavigation && "active" in modelNavigation ? modelNavigation.active : undefined;
  if (modelNavigation && "active" in modelNavigation) {
    modelNavigation.active = false;
  }
  const runtime: any = {
    type: "example-fast-jet-flight-simulation",
    simulation,
    state,
    vehicleCamera,
    rootTransform,
    sdkController: {
      get speed() {
        return simulation.current.instrumentation.trueAirspeed;
      },
      get flying() {
        return true;
      },
      set flying(_value) {
      },
      destroy() {
        runtime.destroy();
      }
    },
    levelOrientation: initialOrientation,
    visualForwardAxis: simConfig.visualForwardAxis || config.forwardAxis || "-Z",
    setCameraPreset(preset) {
      state.cameraPreset = preset;
      updateCameraFromFlightState(runtime, view, config, worldUp, 1);
    },
    update() {
      if (destroyed) {
        return;
      }
      const now = performance.now();
      const dt = Math.max(0.001, Math.min(0.1, (now - state.lastTime) / 1000));
      state.lastTime = now;
      const controls = readFlightPilotControls(keysDown, {
        mouseYaw,
        mousePitch,
        currentBank: simulation.current.instrumentation.bank,
        cruiseThrottle: Number(simConfig.cruiseThrottle ?? 0.72),
        pitchInputScale: Number(simConfig.pitchInputScale ?? 1),
        rollInputScale: Number(simConfig.rollInputScale ?? 1),
        bankPitchCompensation: Number(simConfig.bankPitchCompensation ?? 0),
        bankThrottleCompensation: Number(simConfig.bankThrottleCompensation ?? 0)
      });
      mouseYaw *= Math.exp(-Number(config.shipMouseDragResponse ?? 5.2) * dt);
      mousePitch *= Math.exp(-Number(config.shipMouseDragResponse ?? 5.2) * dt);
      simulation.update(dt, controls);
      enforceFlightEnvelope(simulation, {
        minAltitude: Number(config.minAltitude ?? 0),
        maxAltitude: Number(simConfig.maxAltitude ?? 260),
        maxVerticalSpeed: Number(simConfig.maxVerticalSpeed ?? 32),
        minSpeed: Number(simConfig.minSpeed ?? 72),
        maxSpeed: Number(simConfig.maxSpeed ?? 150),
        maxAngularRate: Number(simConfig.maxAngularRate ?? 1.35),
        levelOrientation: runtime.levelOrientation
      }, worldUp);
      applyFlightSnapshot(runtime, simulation.sampleRenderState(), config, worldUp, dt);
      updateCameraFromFlightState(runtime, view, config, worldUp, dt);
      exhaust?.update(config, runtime.sdkController.speed, state, dt);
    },
    applyWorldOffset(offset) {
      translateFlightSimulation(simulation, offset);
    },
    destroy() {
      destroyed = true;
      if (animationFrame) {
        window.cancelAnimationFrame(animationFrame);
        animationFrame = 0;
      }
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      view.htmlElement.removeEventListener("pointerdown", onPointerDown);
      view.htmlElement.removeEventListener("pointermove", onPointerMove);
      view.htmlElement.removeEventListener("pointerup", onPointerUp);
      view.htmlElement.removeEventListener("pointercancel", onPointerUp);
      if (modelNavigation && previousModelNavigationControllerActive !== undefined) {
        modelNavigation.active = previousModelNavigationControllerActive;
      }
    }
  };
  const cameraPresetsByKey: Record<string, string> = {
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
  const onKeyDown = (event) => {
    if (isTextInputEvent(event)) {
      return;
    }
    const preset = cameraPresetsByKey[event.code];
    if (preset) {
      runtime.setCameraPreset(preset);
      event.preventDefault();
      return;
    }
    keysDown.add(event.code);
  };
  const onKeyUp = (event) => {
    keysDown.delete(event.code);
  };
  const onPointerDown = (event) => {
    if (event.button !== 0) {
      return;
    }
    pointerId = event.pointerId;
    pointerLastX = event.clientX;
    pointerLastY = event.clientY;
    view.htmlElement.setPointerCapture?.(event.pointerId);
    focusViewSurface(view);
  };
  const onPointerMove = (event) => {
    if (pointerId !== event.pointerId) {
      return;
    }
    const movementX = Number.isFinite(event.movementX) && event.movementX !== 0 ? event.movementX : event.clientX - pointerLastX;
    const movementY = Number.isFinite(event.movementY) && event.movementY !== 0 ? event.movementY : event.clientY - pointerLastY;
    pointerLastX = event.clientX;
    pointerLastY = event.clientY;
    mouseYaw = clamp(mouseYaw + movementX * Number(config.shipMouseDragYawSensitivity ?? 0.0095), -1, 1);
    mousePitch = clamp(mousePitch - movementY * Number(config.shipMouseDragPitchSensitivity ?? 0.0068), -1, 1);
    event.preventDefault();
  };
  const onPointerUp = (event) => {
    if (pointerId === event.pointerId) {
      pointerId = null;
      view.htmlElement.releasePointerCapture?.(event.pointerId);
    }
  };
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  view.htmlElement.addEventListener("pointerdown", onPointerDown);
  view.htmlElement.addEventListener("pointermove", onPointerMove);
  view.htmlElement.addEventListener("pointerup", onPointerUp);
  view.htmlElement.addEventListener("pointercancel", onPointerUp);
  const animate = () => {
    animationFrame = 0;
    runtime.update();
    if (!destroyed) {
      animationFrame = window.requestAnimationFrame(animate);
    }
  };
  applyFlightSnapshot(runtime, simulation.current, config, worldUp, 1);
  updateCameraFromFlightState(runtime, view, config, worldUp, 1);
  animationFrame = window.requestAnimationFrame(animate);
  return runtime;
}

function readFlightPilotControls(keysDown, {mouseYaw, mousePitch, currentBank = 0, cruiseThrottle, pitchInputScale = 1, rollInputScale = 1, bankPitchCompensation = 0, bankThrottleCompensation = 0}) {
  const throttleUp = keyPressed(keysDown, ["KeyW"]);
  const throttleDown = keyPressed(keysDown, ["KeyS"]);
  const pitchInput = clamp(keyPressed(keysDown, ["ArrowUp"]) - keyPressed(keysDown, ["ArrowDown"]) + mousePitch, -1, 1);
  const rollInput = clamp(keyPressed(keysDown, ["KeyD", "ArrowRight"]) - keyPressed(keysDown, ["KeyA", "ArrowLeft"]) + mouseYaw, -1, 1);
  const bankMagnitude = clamp(Math.abs(currentBank) / (Math.PI * 0.5), 0, 1);
  const bankLoadMagnitude = Math.max(Math.abs(rollInput), bankMagnitude);
  const pitchCompensation = Math.max(0, pitchInput) * bankLoadMagnitude * bankPitchCompensation;
  return {
    throttle: clamp(cruiseThrottle + throttleUp * 0.28 - throttleDown * 0.72 + bankLoadMagnitude * bankThrottleCompensation, 0, 1),
    stickPitch: clamp(pitchInput * pitchInputScale + pitchCompensation, -1, 1),
    stickRoll: clamp(rollInput * rollInputScale, -1, 1),
    rudder: clamp(keyPressed(keysDown, ["KeyE"]) - keyPressed(keysDown, ["KeyQ"]), -1, 1)
  };
}

function keyPressed(keysDown, codes) {
  return codes.some((code) => keysDown.has(code)) ? 1 : 0;
}

function applyFlightSnapshot(runtime, snapshot, config, worldUp, dt) {
  const state = runtime.state;
  const pose = flightPoseFromState(snapshot.state);
  const smoothing = Math.max(0, Number(config.vehicleVisualSmoothing ?? 16));
  const t = smoothing === 0 ? 1 : 1 - Math.exp(-smoothing * Math.max(0.001, dt));
  state.position = pose.position;
  state.forward = pose.forward;
  state.right = pose.right;
  state.up = pose.up;
  state.visualPosition = lerp3(state.visualPosition, pose.position, t);
  state.visualForward = normalize3(lerp3(state.visualForward, pose.forward, t), pose.forward);
  state.visualUp = normalize3(lerp3(state.visualUp, pose.up, t), pose.up);
  state.visualRight = normalize3(cross3(state.visualForward, state.visualUp), pose.right);
  state.visualUp = normalize3(cross3(state.visualRight, state.visualForward), pose.up);
  runtime.vehicleCamera.eye = state.position;
  runtime.vehicleCamera.look = add3(state.position, state.forward);
  runtime.vehicleCamera.up = state.up;
  runtime.rootTransform.matrix = buildFlightVehicleMatrix({
    position: state.visualPosition,
    forward: state.visualForward,
    right: state.visualRight,
    up: state.visualUp,
    forwardAxis: runtime.visualForwardAxis || config.forwardAxis || "-Z"
  });
}

function updateCameraFromFlightState(runtime, view, config, worldUp, dt) {
  const desired = computeFlightCamera(runtime.state, config, worldUp);
  const state = runtime.state;
  if (state.cameraPreset === "cockpit") {
    state.cameraEye = desired.eye;
    state.cameraLook = desired.look;
  } else {
    const eyeT = 1 - Math.exp(-Math.max(0, Number(config.cameraFollowSmoothing ?? 4.8)) * Math.max(0.001, dt));
    const lookT = 1 - Math.exp(-Math.max(0, Number(config.cameraLookSmoothing ?? 9)) * Math.max(0.001, dt));
    state.cameraEye = lerp3(state.cameraEye, desired.eye, eyeT);
    state.cameraLook = lerp3(state.cameraLook, desired.look, lookT);
  }
  view.camera.eye = state.cameraEye;
  view.camera.look = state.cameraLook;
  view.camera.up = desired.up;
}

function computeFlightCamera(state, config, worldUp) {
  switch (state.cameraPreset) {
    case "left":
      return computeFlightExteriorCamera(state, config, worldUp, {right: -1, distanceScale: 0.82, heightScale: 0.42, lookAheadScale: 0.12});
    case "right":
      return computeFlightExteriorCamera(state, config, worldUp, {right: 1, distanceScale: 0.82, heightScale: 0.42, lookAheadScale: 0.12});
    case "front":
      return computeFlightExteriorCamera(state, config, worldUp, {forward: 1, distanceScale: 0.95, heightScale: 0.35, lookAheadScale: 0});
    case "top":
      return computeFlightTopCamera(state, config, worldUp, false);
    case "topTrailing":
      return computeFlightTopCamera(state, config, worldUp, true);
    case "rearWide":
      return computeFlightExteriorCamera(state, config, worldUp, {forward: -1, distanceScale: 1.65, heightScale: 0.95, lookAheadScale: 0.35});
    case "cockpit":
      return computeFlightCockpitCamera(state, config);
    default:
      return computeFlightTrailingCamera(state, config, worldUp);
  }
}

function computeFlightCockpitCamera(state, config) {
  const target = visualFlightPose(state);
  const forwardAxis = config.forwardAxis || "-Z";
  const eyeOffset = Array.isArray(config.cameraCockpitEyeOffset) ? toVec3(config.cameraCockpitEyeOffset) : [0, -1.45, -0.35];
  const lookOffset = Array.isArray(config.cameraCockpitLookOffset) ? toVec3(config.cameraCockpitLookOffset) : [0, -14, -0.25];
  return {
    eye: flightLocalPointToWorld(eyeOffset, target, forwardAxis),
    look: flightLocalPointToWorld(lookOffset, target, forwardAxis),
    up: target.up
  };
}

function computeFlightTrailingCamera(state, config, worldUp) {
  const target = visualFlightPose(state);
  const distance = Number(config.cameraDistance ?? 64) * Number(state.exteriorCameraDistanceScale ?? 1);
  const height = Number(config.cameraHeight ?? 18);
  const heightUp = flightCameraHeightUp(config, worldUp, target);
  const lateralOffset = Number(config.cameraLateralOffset ?? 0);
  const lookAhead = Number(config.cameraLookAhead ?? 28);
  const lookHeight = Number(config.cameraLookHeight ?? 4);
  return {
    eye: add3(add3(add3(target.position, scale3(target.forward, -distance)), scale3(heightUp, height)), scale3(target.right, lateralOffset)),
    look: add3(add3(target.position, scale3(target.forward, lookAhead)), scale3(heightUp, lookHeight)),
    up: flightCameraUp(config, worldUp, target)
  };
}

function computeFlightExteriorCamera(state, config, worldUp, preset) {
  const target = visualFlightPose(state);
  const distance = Number(config.cameraDistance ?? 64) * Number(preset.distanceScale ?? 1) * Number(state.exteriorCameraDistanceScale ?? 1);
  const height = Number(config.cameraHeight ?? 18) * Number(preset.heightScale ?? 1);
  const lookAhead = Number(config.cameraLookAhead ?? 28) * Number(preset.lookAheadScale ?? 0);
  const lookHeight = Number(config.cameraLookHeight ?? 4);
  let eye = add3(target.position, scale3(worldUp, height));
  if (preset.forward) {
    eye = add3(eye, scale3(target.forward, distance * preset.forward));
  }
  if (preset.right) {
    eye = add3(eye, scale3(target.right, distance * preset.right));
  }
  return {
    eye,
    look: add3(add3(target.position, scale3(target.forward, lookAhead)), scale3(worldUp, lookHeight)),
    up: flightCameraUp(config, worldUp, target)
  };
}

function computeFlightTopCamera(state, config, worldUp, trailing) {
  const target = visualFlightPose(state);
  const distance = Number(config.cameraDistance ?? 64);
  const topHeight = Number(config.cameraTopHeight ?? Math.max(distance * 1.35, Number(config.cameraHeight ?? 18) * 3.5));
  const trailingDistance = trailing ? Number(config.cameraTopTrailingDistance ?? distance * 0.55) : 0;
  return {
    eye: add3(add3(target.position, scale3(worldUp, topHeight)), scale3(target.forward, -trailingDistance)),
    look: add3(target.position, scale3(worldUp, Number(config.cameraLookHeight ?? 4))),
    up: target.forward
  };
}

function flightCameraUp(config, worldUp, target) {
  if (config.cameraRollWithAircraft !== true) {
    return worldUp;
  }
  const scale = clamp(Number(config.cameraRollWithAircraftScale ?? 1), 0, 1);
  return normalize3(lerp3(worldUp, target.up, scale), worldUp);
}

function flightCameraHeightUp(config, worldUp, target) {
  if (config.cameraRollWithAircraft !== true) {
    return worldUp;
  }
  const scale = clamp(Number(config.cameraRollWithAircraftPositionScale ?? config.cameraRollWithAircraftScale ?? 1), 0, 1);
  return normalize3(lerp3(worldUp, target.up, scale), worldUp);
}

function enforceFlightEnvelope(simulation, {minAltitude, maxAltitude, maxVerticalSpeed, minSpeed, maxSpeed, maxAngularRate, levelOrientation}, worldUp) {
  for (const snapshot of [simulation.previous, simulation.current]) {
    if (!isFiniteFlightSnapshot(snapshot)) {
      resetFlightSnapshot(snapshot, minAltitude, worldUp, levelOrientation);
      continue;
    }
    if (Number.isFinite(maxAngularRate) && maxAngularRate > 0) {
      snapshot.state.angularVelocityBody = snapshot.state.angularVelocityBody.map((rate) => clamp(rate, -maxAngularRate, maxAngularRate));
    }
    const speed = Math.hypot(snapshot.state.velocityWorld[0], snapshot.state.velocityWorld[1], snapshot.state.velocityWorld[2]);
    if (speed > 0.0001) {
      const targetSpeed = clamp(speed, Number.isFinite(minSpeed) ? minSpeed : 0, Number.isFinite(maxSpeed) ? maxSpeed : speed);
      if (targetSpeed !== speed) {
        snapshot.state.velocityWorld = scale3(snapshot.state.velocityWorld, targetSpeed / speed);
      }
    }
    let altitude = dot3(snapshot.state.positionWorld, worldUp);
    let verticalSpeed = dot3(snapshot.state.velocityWorld, worldUp);
    if (Number.isFinite(maxVerticalSpeed) && maxVerticalSpeed > 0) {
      const clampedVerticalSpeed = clamp(verticalSpeed, -maxVerticalSpeed, maxVerticalSpeed);
      if (clampedVerticalSpeed !== verticalSpeed) {
        snapshot.state.velocityWorld = add3(snapshot.state.velocityWorld, scale3(worldUp, clampedVerticalSpeed - verticalSpeed));
        verticalSpeed = clampedVerticalSpeed;
      }
    }
    if (Number.isFinite(minAltitude) && altitude < minAltitude) {
      const offset = scale3(worldUp, minAltitude - altitude);
      snapshot.state.positionWorld = add3(snapshot.state.positionWorld, offset);
      altitude = minAltitude;
      if (verticalSpeed < 0) {
        snapshot.state.velocityWorld = add3(snapshot.state.velocityWorld, scale3(worldUp, -verticalSpeed));
        verticalSpeed = 0;
      }
    }
    if (Number.isFinite(maxAltitude) && altitude > maxAltitude) {
      const offset = scale3(worldUp, maxAltitude - altitude);
      snapshot.state.positionWorld = add3(snapshot.state.positionWorld, offset);
      if (verticalSpeed > 0) {
        snapshot.state.velocityWorld = add3(snapshot.state.velocityWorld, scale3(worldUp, -verticalSpeed));
      }
    }
  }
}

function isFiniteFlightSnapshot(snapshot) {
  const state = snapshot?.state;
  return state &&
    finiteArray(state.positionWorld, 3) &&
    finiteArray(state.velocityWorld, 3) &&
    finiteArray(state.angularVelocityBody, 3) &&
    finiteArray(state.orientationBodyToWorld, 4);
}

function finiteArray(value, length) {
  if (!value || value.length < length) {
    return false;
  }
  for (let i = 0; i < length; i++) {
    if (!Number.isFinite(value[i])) {
      return false;
    }
  }
  return true;
}

function resetFlightSnapshot(snapshot, minAltitude, worldUp, levelOrientation) {
  const altitude = Number.isFinite(minAltitude) ? minAltitude : 10;
  snapshot.state.positionWorld = scale3(worldUp, altitude);
  snapshot.state.velocityWorld = [0, 90, 0];
  snapshot.state.orientationBodyToWorld = Array.isArray(levelOrientation) ? levelOrientation.slice() : [0, 0, 0, 1];
  snapshot.state.angularVelocityBody = [0, 0, 0];
}

function translateFlightSimulation(simulation, offset) {
  for (const snapshot of [simulation.previous, simulation.current]) {
    snapshot.state.positionWorld = add3(snapshot.state.positionWorld, offset);
  }
}

function flightPoseFromState(state) {
  const forward = rotateVec3ByQuat(state.orientationBodyToWorld, [1, 0, 0]);
  const right = rotateVec3ByQuat(state.orientationBodyToWorld, [0, 1, 0]);
  const down = rotateVec3ByQuat(state.orientationBodyToWorld, [0, 0, 1]);
  return {
    position: Array.from(state.positionWorld),
    forward: normalize3(forward, [0, 1, 0]),
    right: normalize3(right, [1, 0, 0]),
    up: normalize3(scale3(down, -1), [0, 0, 1])
  };
}

function visualFlightPose(state) {
  return {
    position: state.visualPosition,
    forward: state.visualForward,
    right: state.visualRight,
    up: state.visualUp
  };
}

function buildFlightVehicleMatrix({position, right, up, forward, forwardAxis}) {
  const axes = flightVehicleLocalAxes(right, up, forward, forwardAxis);
  return [
    axes.localX[0], axes.localX[1], axes.localX[2], 0,
    axes.localY[0], axes.localY[1], axes.localY[2], 0,
    axes.localZ[0], axes.localZ[1], axes.localZ[2], 0,
    position[0], position[1], position[2], 1
  ];
}

function flightLocalPointToWorld(localPoint, pose, forwardAxis) {
  const axes = flightVehicleLocalAxes(pose.right, pose.up, pose.forward, forwardAxis);
  return add3(add3(add3(pose.position, scale3(axes.localX, localPoint[0])), scale3(axes.localY, localPoint[1])), scale3(axes.localZ, localPoint[2]));
}

function flightVehicleLocalAxes(right, up, forward, forwardAxis) {
  let localX = right;
  let localY = up;
  let localZ = scale3(forward, -1);
  if (forwardAxis === "Z" || forwardAxis === "+Z") {
    localZ = forward;
    localX = scale3(right, -1);
  } else if (forwardAxis === "X" || forwardAxis === "+X") {
    localX = forward;
    localZ = right;
  } else if (forwardAxis === "-X") {
    localX = scale3(forward, -1);
    localZ = scale3(right, -1);
  } else if (forwardAxis === "Y" || forwardAxis === "+Y") {
    localY = forward;
    localZ = up;
  } else if (forwardAxis === "-Y") {
    localY = scale3(forward, -1);
    localZ = scale3(up, -1);
  }
  return {localX, localY, localZ};
}

function toVec3(value) {
  return [
    Number(value?.[0] || 0),
    Number(value?.[1] || 0),
    Number(value?.[2] || 0)
  ];
}

function add3(a, b) {
  return [
    Number(a[0] || 0) + Number(b[0] || 0),
    Number(a[1] || 0) + Number(b[1] || 0),
    Number(a[2] || 0) + Number(b[2] || 0)
  ];
}

function scale3(v, s) {
  return [
    Number(v[0] || 0) * s,
    Number(v[1] || 0) * s,
    Number(v[2] || 0) * s
  ];
}

function dot3(a, b) {
  return Number(a[0] || 0) * Number(b[0] || 0) + Number(a[1] || 0) * Number(b[1] || 0) + Number(a[2] || 0) * Number(b[2] || 0);
}

function cross3(a, b) {
  return [
    Number(a[1] || 0) * Number(b[2] || 0) - Number(a[2] || 0) * Number(b[1] || 0),
    Number(a[2] || 0) * Number(b[0] || 0) - Number(a[0] || 0) * Number(b[2] || 0),
    Number(a[0] || 0) * Number(b[1] || 0) - Number(a[1] || 0) * Number(b[0] || 0)
  ];
}

function len3(v) {
  return Math.hypot(Number(v[0] || 0), Number(v[1] || 0), Number(v[2] || 0));
}

function normalize3(v, fallback = [0, 0, 1]) {
  const length = len3(v);
  if (length <= 0.000001) {
    return Array.from(fallback);
  }
  return [v[0] / length, v[1] / length, v[2] / length];
}

function lerp3(a, b, t) {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t
  ];
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function focusViewSurface(view) {
  const element = view?.htmlElement;
  if (!element) {
    return;
  }
  try {
    element.focus({preventScroll: true});
  } catch {
    element.focus?.();
  }
}

function isTextInputEvent(event) {
  const target = event.target;
  return target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));
}
