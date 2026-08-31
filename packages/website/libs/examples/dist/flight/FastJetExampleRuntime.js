var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => {
  __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
  return value;
};

// libs/examples/src/flight/FlightMath.ts
var EPSILON = 1e-9;
function vec3(x = 0, y = 0, z = 0) {
  return [x, y, z];
}
function cloneVec3(v) {
  return [Number(v[0] || 0), Number(v[1] || 0), Number(v[2] || 0)];
}
function addVec3(a, b) {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}
function subVec3(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}
function mulVec3Scalar(v, s) {
  return [v[0] * s, v[1] * s, v[2] * s];
}
function dotVec3(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}
function crossVec3(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0]
  ];
}
function lenVec3(v) {
  return Math.hypot(v[0], v[1], v[2]);
}
function normalizeVec3(v, fallback = [1, 0, 0]) {
  const len = lenVec3(v);
  if (len <= EPSILON) {
    return cloneVec3(fallback);
  }
  return [v[0] / len, v[1] / len, v[2] / len];
}
function mat3MulVec3(m, v) {
  return [
    m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
    m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
    m[6] * v[0] + m[7] * v[1] + m[8] * v[2]
  ];
}
function invertMat3(m) {
  const a00 = m[0], a01 = m[1], a02 = m[2];
  const a10 = m[3], a11 = m[4], a12 = m[5];
  const a20 = m[6], a21 = m[7], a22 = m[8];
  const b01 = a22 * a11 - a12 * a21;
  const b11 = -a22 * a10 + a12 * a20;
  const b21 = a21 * a10 - a11 * a20;
  const det = a00 * b01 + a01 * b11 + a02 * b21;
  if (Math.abs(det) <= EPSILON) {
    throw new Error("Cannot invert singular Mat3");
  }
  const invDet = 1 / det;
  return [
    b01 * invDet,
    (-a22 * a01 + a02 * a21) * invDet,
    (a12 * a01 - a02 * a11) * invDet,
    b11 * invDet,
    (a22 * a00 - a02 * a20) * invDet,
    (-a12 * a00 + a02 * a10) * invDet,
    b21 * invDet,
    (-a21 * a00 + a01 * a20) * invDet,
    (a11 * a00 - a01 * a10) * invDet
  ];
}
function normalizeQuat(q) {
  const len = Math.hypot(q[0], q[1], q[2], q[3]);
  if (len <= EPSILON) {
    return [0, 0, 0, 1];
  }
  return [q[0] / len, q[1] / len, q[2] / len, q[3] / len];
}
function conjugateQuat(q) {
  return [-q[0], -q[1], -q[2], q[3]];
}
function mulQuat(a, b) {
  return [
    a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
    a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
    a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
    a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]
  ];
}
function rotateVec3ByQuat(q, v) {
  const x = v[0], y = v[1], z = v[2];
  const qx = q[0], qy = q[1], qz = q[2], qw = q[3];
  const ix = qw * x + qy * z - qz * y;
  const iy = qw * y + qz * x - qx * z;
  const iz = qw * z + qx * y - qy * x;
  const iw = -qx * x - qy * y - qz * z;
  return [
    ix * qw + iw * -qx + iy * -qz - iz * -qy,
    iy * qw + iw * -qy + iz * -qx - ix * -qz,
    iz * qw + iw * -qz + ix * -qy - iy * -qx
  ];
}
function rotateWorldToBody(qBodyToWorld, vWorld) {
  return rotateVec3ByQuat(conjugateQuat(qBodyToWorld), vWorld);
}
function integrateBodyToWorldQuat(q, angularVelocityBody, dt) {
  const omega = [angularVelocityBody[0], -angularVelocityBody[1], angularVelocityBody[2], 0];
  const qDot = mulQuat(q, omega);
  return normalizeQuat([
    q[0] + 0.5 * qDot[0] * dt,
    q[1] + 0.5 * qDot[1] * dt,
    q[2] + 0.5 * qDot[2] * dt,
    q[3] + 0.5 * qDot[3] * dt
  ]);
}
function slerpQuat(a, b, t) {
  let bx = b[0], by = b[1], bz = b[2], bw = b[3];
  let cos = a[0] * bx + a[1] * by + a[2] * bz + a[3] * bw;
  if (cos < 0) {
    cos = -cos;
    bx = -bx;
    by = -by;
    bz = -bz;
    bw = -bw;
  }
  if (cos > 0.9995) {
    return normalizeQuat([
      a[0] + (bx - a[0]) * t,
      a[1] + (by - a[1]) * t,
      a[2] + (bz - a[2]) * t,
      a[3] + (bw - a[3]) * t
    ]);
  }
  const theta = Math.acos(Math.max(-1, Math.min(1, cos)));
  const sinTheta = Math.sin(theta);
  const wa = Math.sin((1 - t) * theta) / sinTheta;
  const wb = Math.sin(t * theta) / sinTheta;
  return [
    a[0] * wa + bx * wb,
    a[1] * wa + by * wb,
    a[2] * wa + bz * wb,
    a[3] * wa + bw * wb
  ];
}
function quatFromBodyAxes(forwardWorld, rightWorld, downWorld) {
  const m00 = forwardWorld[0], m01 = rightWorld[0], m02 = downWorld[0];
  const m10 = forwardWorld[1], m11 = rightWorld[1], m12 = downWorld[1];
  const m20 = forwardWorld[2], m21 = rightWorld[2], m22 = downWorld[2];
  const trace = m00 + m11 + m22;
  let x, y, z, w;
  if (trace > 0) {
    const s = Math.sqrt(trace + 1) * 2;
    w = 0.25 * s;
    x = (m21 - m12) / s;
    y = (m02 - m20) / s;
    z = (m10 - m01) / s;
  } else if (m00 > m11 && m00 > m22) {
    const s = Math.sqrt(1 + m00 - m11 - m22) * 2;
    w = (m21 - m12) / s;
    x = 0.25 * s;
    y = (m01 + m10) / s;
    z = (m02 + m20) / s;
  } else if (m11 > m22) {
    const s = Math.sqrt(1 + m11 - m00 - m22) * 2;
    w = (m02 - m20) / s;
    x = (m01 + m10) / s;
    y = 0.25 * s;
    z = (m12 + m21) / s;
  } else {
    const s = Math.sqrt(1 + m22 - m00 - m11) * 2;
    w = (m10 - m01) / s;
    x = (m02 + m20) / s;
    y = (m12 + m21) / s;
    z = 0.25 * s;
  }
  return normalizeQuat([x, y, z, w]);
}

// libs/examples/src/flight/FlightModels.ts
var NO_LIMITS = Object.freeze({
  aoaLimited: false,
  gLimited: false,
  rateLimited: false
});
var StandardAtmosphereModel = class {
  sample(positionWorld) {
    const altitude = Math.max(0, positionWorld[2] || 0);
    const temperature = Math.max(216.65, 288.15 - 65e-4 * altitude);
    const pressure = 101325 * Math.pow(temperature / 288.15, 5.25588);
    const density = pressure / (287.05 * temperature);
    const speedOfSound = Math.sqrt(1.4 * 287.05 * temperature);
    return { density, pressure, temperature, speedOfSound };
  }
};
var ConstantWindModel = class {
  constructor(windWorld = [0, 0, 0]) {
    this.windWorld = windWorld;
  }
  sample() {
    return this.windWorld;
  }
};
var SimpleBodyAxisEngineModel = class {
  constructor(maxThrust = 0) {
    this.maxThrust = maxThrust;
  }
  sample({ throttle }) {
    return {
      forceBody: [Math.max(0, Math.min(1, throttle)) * this.maxThrust, 0, 0],
      momentBody: [0, 0, 0]
    };
  }
};
var DirectActuatorModel = class {
  update(commands) {
    return {
      positions: { ...commands },
      rates: {}
    };
  }
};
function emptyActuatorState() {
  return {
    positions: {},
    rates: {}
  };
}

// libs/examples/src/flight/FastJetModels.ts
function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
var RateLimitedActuatorModel = class {
  constructor(config = {}) {
    this.config = config;
  }
  update(commands, current, dt) {
    const positions = { ...current.positions };
    const rates = {};
    for (const name of Object.keys(commands)) {
      const limit = this.config.limits?.[name] || { min: -1, max: 1, rate: 8 };
      const target = clamp(Number(commands[name] || 0), limit.min, limit.max);
      const previous = Number(positions[name] || 0);
      const maxDelta = Math.max(0, limit.rate) * dt;
      const next = previous + clamp(target - previous, -maxDelta, maxDelta);
      positions[name] = next;
      rates[name] = dt > 0 ? (next - previous) / dt : 0;
    }
    return { positions, rates };
  }
};
var FastJetControlLaw = class {
  constructor(config = {}) {
    this.config = config;
  }
  update(input) {
    const cfg = this.config;
    const p = input.state.angularVelocityBody[0];
    const q = input.state.angularVelocityBody[1];
    const r = input.state.angularVelocityBody[2];
    const maxRollRate = cfg.maxRollRate ?? input.aircraft.limits?.maxRollRate ?? 4.2;
    const maxPitchRate = cfg.maxPitchRate ?? input.aircraft.limits?.maxPitchRate ?? 1.8;
    const maxYawRate = cfg.maxYawRate ?? input.aircraft.limits?.maxYawRate ?? 0.9;
    const targetP = clamp(input.controls.stickRoll, -1, 1) * maxRollRate;
    let targetQ = clamp(input.controls.stickPitch, -1, 1) * maxPitchRate;
    const targetR = clamp(input.controls.rudder, -1, 1) * maxYawRate;
    const aoaLimit = cfg.maxAngleOfAttack ?? input.aircraft.limits?.maxAngleOfAttack;
    const gLimit = cfg.maxPositiveG ?? input.aircraft.limits?.maxPositiveG;
    let aoaLimited = false;
    let gLimited = false;
    if (aoaLimit !== void 0 && input.derived.alpha > aoaLimit && targetQ > 0) {
      targetQ *= Math.max(0, 1 - (input.derived.alpha - aoaLimit) / Math.max(aoaLimit * 0.25, 0.01));
      aoaLimited = true;
    }
    if (gLimit !== void 0 && input.instrumentation.normalAcceleration > gLimit && targetQ > 0) {
      targetQ = Math.min(0, targetQ);
      gLimited = true;
    }
    const rollCommand = clamp((targetP - p) * (cfg.rollRateGain ?? 0.9), -1, 1);
    const pitchCommand = clamp((targetQ - q) * (cfg.pitchRateGain ?? 1.1), -1, 1);
    const yawCommand = clamp((targetR - r) * (cfg.yawRateGain ?? 0.8), -1, 1);
    return {
      actuatorCommands: {
        [cfg.rollActuator || "roll"]: rollCommand,
        [cfg.pitchActuator || "pitch"]: pitchCommand,
        [cfg.yawActuator || "yaw"]: yawCommand
      },
      limitState: {
        aoaLimited,
        gLimited,
        rateLimited: Math.abs(rollCommand) >= 1 || Math.abs(pitchCommand) >= 1 || Math.abs(yawCommand) >= 1
      }
    };
  }
};
var SimpleCoefficientAerodynamicsModel = class {
  constructor(config = {}) {
    this.config = config;
  }
  sample(input) {
    const cfg = this.config;
    const q = input.derived.dynamicPressure;
    const speed = lenVec3(input.derived.velocityAirBody);
    if (speed <= 1e-3 || q <= 1e-3) {
      return { forceBody: [0, 0, 0], momentBody: [0, 0, 0] };
    }
    const area = input.aircraft.referenceArea;
    const span = input.aircraft.referenceSpan;
    const chord = input.aircraft.referenceChord;
    const alpha = input.derived.alpha - (cfg.zeroLiftAlpha ?? -8e-3);
    const cl = clamp((cfg.liftCurveSlope ?? 4.6) * alpha, -(cfg.maxLiftCoefficient ?? 1.25), cfg.maxLiftCoefficient ?? 1.25);
    const cd = (cfg.dragCoefficientZero ?? 0.026) + (cfg.inducedDragFactor ?? 0.08) * cl * cl;
    const cy = clamp(-(cfg.sideForceBeta ?? 0.9) * input.derived.beta, -1, 1);
    const roll = Number(input.actuators.positions[cfg.rollActuator || "roll"] || 0);
    const pitch = Number(input.actuators.positions[cfg.pitchActuator || "pitch"] || 0);
    const yaw = Number(input.actuators.positions[cfg.yawActuator || "yaw"] || 0);
    const rates = input.state.angularVelocityBody;
    const forceBody = [
      -cd * q * area,
      cy * q * area,
      -cl * q * area
    ];
    const momentBody = [
      roll * (cfg.rollMomentPerRollCommand ?? 0.09) * q * area * span - rates[0] * (cfg.rollDamping ?? 0.018) * q * area * span,
      pitch * (cfg.pitchMomentPerPitchCommand ?? -0.12) * q * area * chord - rates[1] * (cfg.pitchDamping ?? 0.026) * q * area * chord,
      (yaw * (cfg.yawMomentPerYawCommand ?? 0.04) + input.derived.beta * (cfg.yawMomentPerSideslip ?? 0.055)) * q * area * span - rates[2] * (cfg.yawDamping ?? 0.022) * q * area * span
    ];
    return { forceBody, momentBody };
  }
};
function createFictionalFastJetDefinition(params = {}) {
  return {
    id: params.id || "fictional-fast-jet",
    mass: params.mass ?? 12e3,
    inertiaBody: params.inertiaBody || [
      18e3,
      0,
      0,
      0,
      84e3,
      0,
      0,
      0,
      92e3
    ],
    referenceArea: params.referenceArea ?? 38,
    referenceSpan: params.referenceSpan ?? 9.5,
    referenceChord: params.referenceChord ?? 4,
    limits: {
      maxAngleOfAttack: 24 * Math.PI / 180,
      maxPositiveG: 8.5,
      maxNegativeG: -3,
      maxRollRate: 4.5,
      maxPitchRate: 1.9,
      maxYawRate: 0.8
    },
    aerodynamics: new SimpleCoefficientAerodynamicsModel(params.aerodynamics),
    engine: new SimpleBodyAxisEngineModel(params.maxThrust ?? 125e3),
    controlLaw: new FastJetControlLaw(),
    actuators: new RateLimitedActuatorModel()
  };
}

// libs/examples/src/flight/FlightConventions.ts
var AmsterdamFlightCoordinateSystem = {
  worldForward: [0, 1, 0],
  worldRight: [1, 0, 0],
  worldUp: [0, 0, 1]
};
function normalizeFlightCoordinateSystem(coordinateSystem) {
  const worldUp = normalizeVec3(coordinateSystem.worldUp, [0, 0, 1]);
  const worldForward = normalizeVec3(coordinateSystem.worldForward, [1, 0, 0]);
  const worldRight = normalizeVec3(coordinateSystem.worldRight, [0, 1, 0]);
  return { worldForward, worldRight, worldUp };
}
function createLevelBodyToWorldOrientation(coordinateSystem) {
  const normalized = normalizeFlightCoordinateSystem(coordinateSystem);
  return quatFromBodyAxes(
    normalized.worldForward,
    normalized.worldRight,
    mulVec3Scalar(normalized.worldUp, -1)
  );
}
var FlightUnits = Object.freeze({
  distance: "meter",
  time: "second",
  mass: "kilogram",
  force: "newton",
  moment: "newton-meter",
  angle: "radian",
  angularRate: "radian/second",
  velocity: "meter/second",
  acceleration: "meter/second^2"
});

// libs/examples/src/flight/ForceMomentAccumulator.ts
var ForceMomentAccumulator = class {
  constructor() {
    __publicField(this, "forceWorld", vec3());
    __publicField(this, "momentBody", vec3());
  }
  clear() {
    this.forceWorld = vec3();
    this.momentBody = vec3();
  }
  addWorldForce(forceWorld, applicationPointWorld, state) {
    this.forceWorld = addVec3(this.forceWorld, forceWorld);
    if (applicationPointWorld && state) {
      const armWorld = subVec3(applicationPointWorld, state.positionWorld);
      const momentWorld = crossVec3(armWorld, forceWorld);
      this.momentBody = addVec3(this.momentBody, rotateWorldToBody(state.orientationBodyToWorld, momentWorld));
    }
  }
  addBodyForce(forceBody, state, applicationPointBody) {
    this.forceWorld = addVec3(this.forceWorld, rotateVec3ByQuat(state.orientationBodyToWorld, forceBody));
    if (applicationPointBody) {
      this.momentBody = addVec3(this.momentBody, crossVec3(applicationPointBody, forceBody));
    }
  }
  addBodyMoment(momentBody) {
    this.momentBody = addVec3(this.momentBody, momentBody);
  }
  resolve() {
    return {
      forceWorld: this.forceWorld,
      momentBody: this.momentBody
    };
  }
};

// libs/examples/src/flight/FixedStepFlightSimulation.ts
var DEFAULT_FIXED_DT = 1 / 120;
var DEFAULT_GRAVITY = 9.80665;
var ZERO_CONTROLS = { throttle: 0, stickPitch: 0, stickRoll: 0, rudder: 0 };
var FixedStepFlightSimulation = class {
  constructor(params) {
    __publicField(this, "fixedDt");
    __publicField(this, "coordinateSystem");
    __publicField(this, "accumulatorMaxSeconds", 0.25);
    __publicField(this, "previous");
    __publicField(this, "current");
    __publicField(this, "accumulator", 0);
    __publicField(this, "params");
    __publicField(this, "inverseInertiaBody");
    __publicField(this, "forceMomentAccumulator", new ForceMomentAccumulator());
    __publicField(this, "actuatorState", emptyActuatorState());
    __publicField(this, "controlOutput", { actuatorCommands: {}, limitState: { ...NO_LIMITS } });
    __publicField(this, "simulationTime", 0);
    this.params = {
      atmosphere: new StandardAtmosphereModel(),
      wind: new ConstantWindModel(),
      fixedDt: DEFAULT_FIXED_DT,
      gravity: DEFAULT_GRAVITY,
      ...params
    };
    this.fixedDt = Number(this.params.fixedDt || DEFAULT_FIXED_DT);
    this.coordinateSystem = normalizeFlightCoordinateSystem(this.params.coordinateSystem || AmsterdamFlightCoordinateSystem);
    this.inverseInertiaBody = invertMat3(this.params.aircraft.inertiaBody);
    const initial = cloneFlightState(this.params.initialState);
    const derived = this.computeDerivedState(initial, vec3(), vec3());
    const instrumentation = this.computeInstrumentation(initial, derived, ZERO_CONTROLS, { ...NO_LIMITS });
    this.previous = { time: 0, state: cloneFlightState(initial), derived, instrumentation };
    this.current = { time: 0, state: cloneFlightState(initial), derived, instrumentation };
  }
  update(elapsedSeconds, controls = ZERO_CONTROLS) {
    this.accumulator = Math.min(this.accumulator + Math.max(0, elapsedSeconds), this.accumulatorMaxSeconds);
    while (this.accumulator + EPSILON >= this.fixedDt) {
      this.stepFixed(this.fixedDt, controls);
      this.accumulator -= this.fixedDt;
    }
  }
  stepFixed(dt = this.fixedDt, controls = ZERO_CONTROLS) {
    this.previous = cloneSnapshot(this.current);
    const state = cloneFlightState(this.current.state);
    const atmosphere = this.params.atmosphere.sample(state.positionWorld);
    const derivedBefore = this.computeDerivedState(state, this.current.derived.accelerationWorld, this.current.derived.specificForceWorld);
    const instrumentationBefore = this.computeInstrumentation(state, derivedBefore, controls, this.controlOutput.limitState);
    this.controlOutput = this.params.aircraft.controlLaw.update({
      state,
      derived: derivedBefore,
      instrumentation: instrumentationBefore,
      controls,
      aircraft: this.params.aircraft
    }, dt);
    const actuatorModel = this.params.aircraft.actuators || new DirectActuatorModel();
    this.actuatorState = actuatorModel.update(this.controlOutput.actuatorCommands, this.actuatorState, dt);
    const resolved = this.resolveForces(state, derivedBefore, atmosphere, controls);
    const accelerationWorld = mulVec3Scalar(resolved.forceWorld, 1 / this.params.aircraft.mass);
    const gravityAccelerationWorld = mulVec3Scalar(this.coordinateSystem.worldUp, -this.params.gravity);
    const specificForceWorld = subVec3(accelerationWorld, gravityAccelerationWorld);
    const nextVelocity = addVec3(state.velocityWorld, mulVec3Scalar(accelerationWorld, dt));
    const nextPosition = addVec3(state.positionWorld, mulVec3Scalar(nextVelocity, dt));
    const inertiaOmega = mat3MulVec3(this.params.aircraft.inertiaBody, state.angularVelocityBody);
    const gyroscopic = crossVec3(state.angularVelocityBody, inertiaOmega);
    const angularAccelerationBody = mat3MulVec3(this.inverseInertiaBody, subVec3(resolved.momentBody, gyroscopic));
    const nextAngularVelocityBody = addVec3(state.angularVelocityBody, mulVec3Scalar(angularAccelerationBody, dt));
    const nextOrientation = integrateBodyToWorldQuat(state.orientationBodyToWorld, nextAngularVelocityBody, dt);
    const nextState = {
      positionWorld: finiteVec3(nextPosition, state.positionWorld),
      velocityWorld: finiteVec3(nextVelocity, state.velocityWorld),
      orientationBodyToWorld: finiteQuat(nextOrientation, state.orientationBodyToWorld),
      angularVelocityBody: finiteVec3(nextAngularVelocityBody, state.angularVelocityBody)
    };
    this.simulationTime += dt;
    const derived = this.computeDerivedState(nextState, accelerationWorld, specificForceWorld);
    const instrumentation = this.computeInstrumentation(nextState, derived, controls, this.controlOutput.limitState);
    this.current = {
      time: this.simulationTime,
      state: nextState,
      derived,
      instrumentation
    };
  }
  sampleRenderState(alpha = this.accumulator / this.fixedDt) {
    const t = Math.max(0, Math.min(1, alpha));
    const state = {
      positionWorld: lerpVec3(this.previous.state.positionWorld, this.current.state.positionWorld, t),
      velocityWorld: lerpVec3(this.previous.state.velocityWorld, this.current.state.velocityWorld, t),
      orientationBodyToWorld: slerpQuat(this.previous.state.orientationBodyToWorld, this.current.state.orientationBodyToWorld, t),
      angularVelocityBody: lerpVec3(this.previous.state.angularVelocityBody, this.current.state.angularVelocityBody, t)
    };
    const derived = this.computeDerivedState(
      state,
      lerpVec3(this.previous.derived.accelerationWorld, this.current.derived.accelerationWorld, t),
      lerpVec3(this.previous.derived.specificForceWorld, this.current.derived.specificForceWorld, t)
    );
    const instrumentation = interpolateInstrumentation(this.previous.instrumentation, this.current.instrumentation, t);
    return {
      time: this.previous.time + (this.current.time - this.previous.time) * t,
      state,
      derived,
      instrumentation
    };
  }
  resolveForces(state, derived, atmosphere, controls) {
    const accumulator = this.forceMomentAccumulator;
    accumulator.clear();
    accumulator.addWorldForce(mulVec3Scalar(this.coordinateSystem.worldUp, -this.params.aircraft.mass * this.params.gravity));
    const aero = this.params.aircraft.aerodynamics.sample({
      state,
      derived,
      atmosphere,
      actuators: this.actuatorState,
      aircraft: this.params.aircraft
    });
    accumulator.addBodyForce(aero.forceBody, state);
    accumulator.addBodyMoment(aero.momentBody);
    const engine = this.params.aircraft.engine.sample({
      state,
      derived,
      atmosphere,
      throttle: controls.throttle
    });
    accumulator.addBodyForce(engine.forceBody, state);
    accumulator.addBodyMoment(engine.momentBody);
    for (const provider of this.params.externalForces || []) {
      const sample = provider.sample({ state, derived, atmosphere, aircraft: this.params.aircraft, controls, actuators: this.actuatorState });
      accumulator.addBodyForce(sample.forceBody, state);
      accumulator.addBodyMoment(sample.momentBody);
    }
    const contact = this.params.contactProvider?.sample?.({ state, derived, atmosphere, aircraft: this.params.aircraft, controls, actuators: this.actuatorState });
    if (contact) {
      accumulator.addBodyForce(contact.forceBody, state);
      accumulator.addBodyMoment(contact.momentBody);
    }
    return accumulator.resolve();
  }
  computeDerivedState(state, accelerationWorld, specificForceWorld) {
    const windWorld = cloneVec3(this.params.wind.sample(state.positionWorld, this.simulationTime));
    const velocityAirWorld = subVec3(state.velocityWorld, windWorld);
    const velocityAirBody = rotateWorldToBody(state.orientationBodyToWorld, velocityAirWorld);
    const atmosphere = this.params.atmosphere.sample(state.positionWorld);
    const trueAirspeed = lenVec3(velocityAirWorld);
    const u = velocityAirBody[0];
    const v = velocityAirBody[1];
    const w = velocityAirBody[2];
    return {
      windWorld,
      velocityAirWorld,
      velocityAirBody,
      dynamicPressure: 0.5 * atmosphere.density * trueAirspeed * trueAirspeed,
      alpha: Math.atan2(w, Math.max(Math.abs(u), EPSILON) * Math.sign(u || 1)),
      beta: trueAirspeed > EPSILON ? Math.asin(Math.max(-1, Math.min(1, v / trueAirspeed))) : 0,
      mach: atmosphere.speedOfSound > EPSILON ? trueAirspeed / atmosphere.speedOfSound : 0,
      accelerationWorld: cloneVec3(accelerationWorld),
      specificForceWorld: cloneVec3(specificForceWorld)
    };
  }
  computeInstrumentation(state, derived, controls, limitState) {
    const forward = rotateVec3ByQuat(state.orientationBodyToWorld, [1, 0, 0]);
    const right = rotateVec3ByQuat(state.orientationBodyToWorld, [0, 1, 0]);
    const down = rotateVec3ByQuat(state.orientationBodyToWorld, [0, 0, 1]);
    const aircraftUp = mulVec3Scalar(down, -1);
    const horizontalForward = subVec3(forward, mulVec3Scalar(this.coordinateSystem.worldUp, dotVec3(forward, this.coordinateSystem.worldUp)));
    const heading = Math.atan2(
      dotVec3(horizontalForward, this.coordinateSystem.worldRight),
      dotVec3(horizontalForward, this.coordinateSystem.worldForward)
    );
    return {
      altitude: dotVec3(state.positionWorld, this.coordinateSystem.worldUp),
      indicatedAirspeed: lenVec3(derived.velocityAirWorld),
      trueAirspeed: lenVec3(derived.velocityAirWorld),
      groundSpeed: lenVec3(state.velocityWorld),
      verticalSpeed: dotVec3(state.velocityWorld, this.coordinateSystem.worldUp),
      pitch: Math.asin(Math.max(-1, Math.min(1, dotVec3(forward, this.coordinateSystem.worldUp)))),
      bank: Math.atan2(-dotVec3(right, this.coordinateSystem.worldUp), -dotVec3(down, this.coordinateSystem.worldUp)),
      heading: heading < 0 ? heading + Math.PI * 2 : heading,
      angleOfAttack: derived.alpha,
      sideslip: derived.beta,
      normalAcceleration: dotVec3(derived.specificForceWorld, aircraftUp) / DEFAULT_GRAVITY,
      mach: derived.mach,
      throttle: controls.throttle,
      limitState: { ...limitState }
    };
  }
};
function cloneFlightState(state) {
  return {
    positionWorld: cloneVec3(state.positionWorld),
    velocityWorld: cloneVec3(state.velocityWorld),
    orientationBodyToWorld: normalizeQuat(state.orientationBodyToWorld),
    angularVelocityBody: cloneVec3(state.angularVelocityBody)
  };
}
function cloneSnapshot(snapshot) {
  return {
    time: snapshot.time,
    state: cloneFlightState(snapshot.state),
    derived: {
      windWorld: cloneVec3(snapshot.derived.windWorld),
      velocityAirWorld: cloneVec3(snapshot.derived.velocityAirWorld),
      velocityAirBody: cloneVec3(snapshot.derived.velocityAirBody),
      dynamicPressure: snapshot.derived.dynamicPressure,
      alpha: snapshot.derived.alpha,
      beta: snapshot.derived.beta,
      mach: snapshot.derived.mach,
      accelerationWorld: cloneVec3(snapshot.derived.accelerationWorld),
      specificForceWorld: cloneVec3(snapshot.derived.specificForceWorld)
    },
    instrumentation: {
      ...snapshot.instrumentation,
      limitState: { ...snapshot.instrumentation.limitState }
    }
  };
}
function lerpVec3(a, b, t) {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t
  ];
}
function interpolateInstrumentation(a, b, t) {
  return {
    altitude: lerp(a.altitude, b.altitude, t),
    indicatedAirspeed: lerp(a.indicatedAirspeed, b.indicatedAirspeed, t),
    trueAirspeed: lerp(a.trueAirspeed, b.trueAirspeed, t),
    groundSpeed: lerp(a.groundSpeed, b.groundSpeed, t),
    verticalSpeed: lerp(a.verticalSpeed, b.verticalSpeed, t),
    pitch: lerp(a.pitch, b.pitch, t),
    bank: lerp(a.bank, b.bank, t),
    heading: lerp(a.heading, b.heading, t),
    angleOfAttack: lerp(a.angleOfAttack, b.angleOfAttack, t),
    sideslip: lerp(a.sideslip, b.sideslip, t),
    normalAcceleration: lerp(a.normalAcceleration, b.normalAcceleration, t),
    mach: lerp(a.mach, b.mach, t),
    throttle: lerp(a.throttle, b.throttle, t),
    limitState: { ...b.limitState }
  };
}
function lerp(a, b, t) {
  return a + (b - a) * t;
}
function finiteVec3(value, fallback) {
  if (Number.isFinite(value[0]) && Number.isFinite(value[1]) && Number.isFinite(value[2])) {
    return cloneVec3(value);
  }
  return cloneVec3(fallback);
}
function finiteQuat(value, fallback) {
  if (Number.isFinite(value[0]) && Number.isFinite(value[1]) && Number.isFinite(value[2]) && Number.isFinite(value[3])) {
    return normalizeQuat(value);
  }
  return normalizeQuat(fallback);
}

// libs/examples/src/flight/FastJetExampleRuntime.ts
function createFastJetExampleRuntime({ view, rootTransform, exhaust, config, record }) {
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
      800,
      0,
      0,
      0,
      2400,
      0,
      0,
      0,
      3e3
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
  const keysDown = /* @__PURE__ */ new Set();
  const state = {
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
    exteriorCameraDistanceScale: clamp2(Number(config.cameraExteriorDistanceScale ?? 1), 0.35, 2.5),
    lastTime: performance.now()
  };
  const vehicleCamera = {
    eye: state.position,
    look: add3(state.position, state.forward),
    up: state.up
  };
  let destroyed = false;
  let animationFrame = 0;
  let pointerId = null;
  let pointerLastX = 0;
  let pointerLastY = 0;
  let mouseYaw = 0;
  let mousePitch = 0;
  const modelNavigation = record?.modelNavigation;
  const previousModelNavigationControllerActive = modelNavigation && "active" in modelNavigation ? modelNavigation.active : void 0;
  if (modelNavigation && "active" in modelNavigation) {
    modelNavigation.active = false;
  }
  const runtime = {
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
      const dt = Math.max(1e-3, Math.min(0.1, (now - state.lastTime) / 1e3));
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
      view.needsRender?.();
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
      if (modelNavigation && previousModelNavigationControllerActive !== void 0) {
        modelNavigation.active = previousModelNavigationControllerActive;
      }
    }
  };
  const cameraPresetsByKey = {
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
    mouseYaw = clamp2(mouseYaw + movementX * Number(config.shipMouseDragYawSensitivity ?? 95e-4), -1, 1);
    mousePitch = clamp2(mousePitch - movementY * Number(config.shipMouseDragPitchSensitivity ?? 68e-4), -1, 1);
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
function readFlightPilotControls(keysDown, { mouseYaw, mousePitch, currentBank = 0, cruiseThrottle, pitchInputScale = 1, rollInputScale = 1, bankPitchCompensation = 0, bankThrottleCompensation = 0 }) {
  const throttleUp = keyPressed(keysDown, ["KeyW"]);
  const throttleDown = keyPressed(keysDown, ["KeyS"]);
  const pitchInput = clamp2(keyPressed(keysDown, ["ArrowUp"]) - keyPressed(keysDown, ["ArrowDown"]) + mousePitch, -1, 1);
  const rollInput = clamp2(keyPressed(keysDown, ["KeyD", "ArrowRight"]) - keyPressed(keysDown, ["KeyA", "ArrowLeft"]) + mouseYaw, -1, 1);
  const bankMagnitude = clamp2(Math.abs(currentBank) / (Math.PI * 0.5), 0, 1);
  const bankLoadMagnitude = Math.max(Math.abs(rollInput), bankMagnitude);
  const pitchCompensation = Math.max(0, pitchInput) * bankLoadMagnitude * bankPitchCompensation;
  return {
    throttle: clamp2(cruiseThrottle + throttleUp * 0.28 - throttleDown * 0.72 + bankLoadMagnitude * bankThrottleCompensation, 0, 1),
    stickPitch: clamp2(pitchInput * pitchInputScale + pitchCompensation, -1, 1),
    stickRoll: clamp2(rollInput * rollInputScale, -1, 1),
    rudder: clamp2(keyPressed(keysDown, ["KeyE"]) - keyPressed(keysDown, ["KeyQ"]), -1, 1)
  };
}
function keyPressed(keysDown, codes) {
  return codes.some((code) => keysDown.has(code)) ? 1 : 0;
}
function applyFlightSnapshot(runtime, snapshot, config, worldUp, dt) {
  const state = runtime.state;
  const pose = flightPoseFromState(snapshot.state);
  const smoothing = Math.max(0, Number(config.vehicleVisualSmoothing ?? 16));
  const t = smoothing === 0 ? 1 : 1 - Math.exp(-smoothing * Math.max(1e-3, dt));
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
    const eyeT = 1 - Math.exp(-Math.max(0, Number(config.cameraFollowSmoothing ?? 4.8)) * Math.max(1e-3, dt));
    const lookT = 1 - Math.exp(-Math.max(0, Number(config.cameraLookSmoothing ?? 9)) * Math.max(1e-3, dt));
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
      return computeFlightExteriorCamera(state, config, worldUp, { right: -1, distanceScale: 0.82, heightScale: 0.42, lookAheadScale: 0.12 });
    case "right":
      return computeFlightExteriorCamera(state, config, worldUp, { right: 1, distanceScale: 0.82, heightScale: 0.42, lookAheadScale: 0.12 });
    case "front":
      return computeFlightExteriorCamera(state, config, worldUp, { forward: 1, distanceScale: 0.95, heightScale: 0.35, lookAheadScale: 0 });
    case "top":
      return computeFlightTopCamera(state, config, worldUp, false);
    case "topTrailing":
      return computeFlightTopCamera(state, config, worldUp, true);
    case "rearWide":
      return computeFlightExteriorCamera(state, config, worldUp, { forward: -1, distanceScale: 1.65, heightScale: 0.95, lookAheadScale: 0.35 });
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
  const scale = clamp2(Number(config.cameraRollWithAircraftScale ?? 1), 0, 1);
  return normalize3(lerp3(worldUp, target.up, scale), worldUp);
}
function flightCameraHeightUp(config, worldUp, target) {
  if (config.cameraRollWithAircraft !== true) {
    return worldUp;
  }
  const scale = clamp2(Number(config.cameraRollWithAircraftPositionScale ?? config.cameraRollWithAircraftScale ?? 1), 0, 1);
  return normalize3(lerp3(worldUp, target.up, scale), worldUp);
}
function enforceFlightEnvelope(simulation, { minAltitude, maxAltitude, maxVerticalSpeed, minSpeed, maxSpeed, maxAngularRate, levelOrientation }, worldUp) {
  for (const snapshot of [simulation.previous, simulation.current]) {
    if (!isFiniteFlightSnapshot(snapshot)) {
      resetFlightSnapshot(snapshot, minAltitude, worldUp, levelOrientation);
      continue;
    }
    if (Number.isFinite(maxAngularRate) && maxAngularRate > 0) {
      snapshot.state.angularVelocityBody = snapshot.state.angularVelocityBody.map((rate) => clamp2(rate, -maxAngularRate, maxAngularRate));
    }
    const speed = Math.hypot(snapshot.state.velocityWorld[0], snapshot.state.velocityWorld[1], snapshot.state.velocityWorld[2]);
    if (speed > 1e-4) {
      const targetSpeed = clamp2(speed, Number.isFinite(minSpeed) ? minSpeed : 0, Number.isFinite(maxSpeed) ? maxSpeed : speed);
      if (targetSpeed !== speed) {
        snapshot.state.velocityWorld = scale3(snapshot.state.velocityWorld, targetSpeed / speed);
      }
    }
    let altitude = dot3(snapshot.state.positionWorld, worldUp);
    let verticalSpeed = dot3(snapshot.state.velocityWorld, worldUp);
    if (Number.isFinite(maxVerticalSpeed) && maxVerticalSpeed > 0) {
      const clampedVerticalSpeed = clamp2(verticalSpeed, -maxVerticalSpeed, maxVerticalSpeed);
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
  return state && finiteArray(state.positionWorld, 3) && finiteArray(state.velocityWorld, 3) && finiteArray(state.angularVelocityBody, 3) && finiteArray(state.orientationBodyToWorld, 4);
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
function buildFlightVehicleMatrix({ position, right, up, forward, forwardAxis }) {
  const axes = flightVehicleLocalAxes(right, up, forward, forwardAxis);
  return [
    axes.localX[0],
    axes.localX[1],
    axes.localX[2],
    0,
    axes.localY[0],
    axes.localY[1],
    axes.localY[2],
    0,
    axes.localZ[0],
    axes.localZ[1],
    axes.localZ[2],
    0,
    position[0],
    position[1],
    position[2],
    1
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
  return { localX, localY, localZ };
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
  if (length <= 1e-6) {
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
function clamp2(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
function focusViewSurface(view) {
  const element = view?.htmlElement;
  if (!element) {
    return;
  }
  try {
    element.focus({ preventScroll: true });
  } catch {
    element.focus?.();
  }
}
function isTextInputEvent(event) {
  const target = event.target;
  return target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));
}
export {
  createFastJetExampleRuntime
};
//# sourceMappingURL=FastJetExampleRuntime.js.map
