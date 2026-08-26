import {
  addVec3,
  cloneVec3,
  crossVec3,
  dotVec3,
  EPSILON,
  integrateBodyToWorldQuat,
  invertMat3,
  lenVec3,
  mat3MulVec3,
  mulVec3Scalar,
  normalizeQuat,
  rotateVec3ByQuat,
  rotateWorldToBody,
  slerpQuat,
  subVec3,
  type Mat3Tuple,
  type QuatTuple,
  type Vec3,
  type Vec3Tuple,
  vec3
} from "./FlightMath";
import {
  AmsterdamFlightCoordinateSystem,
  normalizeFlightCoordinateSystem,
  type NormalizedFlightCoordinateSystem
} from "./FlightConventions";
import {ForceMomentAccumulator} from "./ForceMomentAccumulator";
import {
  ConstantWindModel,
  DirectActuatorModel,
  emptyActuatorState,
  NO_LIMITS,
  StandardAtmosphereModel
} from "./FlightModels";
import type {
  ActuatorState,
  AtmosphereSample,
  ControlLawOutput,
  FixedStepFlightSimulationParams,
  FlightDerivedState,
  FlightInstrumentationState,
  FlightState,
  FlightStateSnapshot,
  PilotControls
} from "./FlightTypes";

const DEFAULT_FIXED_DT = 1 / 120;
const DEFAULT_GRAVITY = 9.80665;
const ZERO_CONTROLS: PilotControls = {throttle: 0, stickPitch: 0, stickRoll: 0, rudder: 0};

export class FixedStepFlightSimulation {
  readonly fixedDt: number;
  readonly coordinateSystem: NormalizedFlightCoordinateSystem;
  readonly accumulatorMaxSeconds = 0.25;

  previous: FlightStateSnapshot;
  current: FlightStateSnapshot;
  accumulator = 0;

  private readonly params: FixedStepFlightSimulationParams;
  private readonly inverseInertiaBody: Mat3Tuple;
  private readonly forceMomentAccumulator = new ForceMomentAccumulator();
  private actuatorState: ActuatorState = emptyActuatorState();
  private controlOutput: ControlLawOutput = {actuatorCommands: {}, limitState: {...NO_LIMITS}};
  private simulationTime = 0;

  constructor(params: FixedStepFlightSimulationParams) {
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
    const instrumentation = this.computeInstrumentation(initial, derived, ZERO_CONTROLS, {...NO_LIMITS});
    this.previous = {time: 0, state: cloneFlightState(initial), derived, instrumentation};
    this.current = {time: 0, state: cloneFlightState(initial), derived, instrumentation};
  }

  update(elapsedSeconds: number, controls: PilotControls = ZERO_CONTROLS): void {
    this.accumulator = Math.min(this.accumulator + Math.max(0, elapsedSeconds), this.accumulatorMaxSeconds);
    while (this.accumulator + EPSILON >= this.fixedDt) {
      this.stepFixed(this.fixedDt, controls);
      this.accumulator -= this.fixedDt;
    }
  }

  stepFixed(dt: number = this.fixedDt, controls: PilotControls = ZERO_CONTROLS): void {
    this.previous = cloneSnapshot(this.current);
    const state = cloneFlightState(this.current.state);
    const atmosphere = this.params.atmosphere!.sample(state.positionWorld);
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
    const gravityAccelerationWorld = mulVec3Scalar(this.coordinateSystem.worldUp, -this.params.gravity!);
    const specificForceWorld = subVec3(accelerationWorld, gravityAccelerationWorld);
    const nextVelocity = addVec3(state.velocityWorld, mulVec3Scalar(accelerationWorld, dt));
    const nextPosition = addVec3(state.positionWorld, mulVec3Scalar(nextVelocity, dt));
    const inertiaOmega = mat3MulVec3(this.params.aircraft.inertiaBody, state.angularVelocityBody);
    const gyroscopic = crossVec3(state.angularVelocityBody, inertiaOmega);
    const angularAccelerationBody = mat3MulVec3(this.inverseInertiaBody, subVec3(resolved.momentBody, gyroscopic));
    const nextAngularVelocityBody = addVec3(state.angularVelocityBody, mulVec3Scalar(angularAccelerationBody, dt));
    const nextOrientation = integrateBodyToWorldQuat(state.orientationBodyToWorld, nextAngularVelocityBody, dt);

    const nextState: FlightState = {
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

  sampleRenderState(alpha = this.accumulator / this.fixedDt): FlightStateSnapshot {
    const t = Math.max(0, Math.min(1, alpha));
    const state: FlightState = {
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

  private resolveForces(
    state: FlightState,
    derived: FlightDerivedState,
    atmosphere: AtmosphereSample,
    controls: PilotControls
  ) {
    const accumulator = this.forceMomentAccumulator;
    accumulator.clear();
    accumulator.addWorldForce(mulVec3Scalar(this.coordinateSystem.worldUp, -this.params.aircraft.mass * this.params.gravity!));
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
      const sample = provider.sample({state, derived, atmosphere, aircraft: this.params.aircraft, controls, actuators: this.actuatorState});
      accumulator.addBodyForce(sample.forceBody, state);
      accumulator.addBodyMoment(sample.momentBody);
    }
    const contact = this.params.contactProvider?.sample?.({state, derived, atmosphere, aircraft: this.params.aircraft, controls, actuators: this.actuatorState});
    if (contact) {
      accumulator.addBodyForce(contact.forceBody, state);
      accumulator.addBodyMoment(contact.momentBody);
    }
    return accumulator.resolve();
  }

  private computeDerivedState(state: FlightState, accelerationWorld: Vec3, specificForceWorld: Vec3): FlightDerivedState {
    const windWorld = cloneVec3(this.params.wind!.sample(state.positionWorld, this.simulationTime));
    const velocityAirWorld = subVec3(state.velocityWorld, windWorld);
    const velocityAirBody = rotateWorldToBody(state.orientationBodyToWorld, velocityAirWorld);
    const atmosphere = this.params.atmosphere!.sample(state.positionWorld);
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

  private computeInstrumentation(
    state: FlightState,
    derived: FlightDerivedState,
    controls: PilotControls,
    limitState: FlightInstrumentationState["limitState"]
  ): FlightInstrumentationState {
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
      limitState: {...limitState}
    };
  }
}

export function cloneFlightState(state: FlightState): FlightState {
  return {
    positionWorld: cloneVec3(state.positionWorld),
    velocityWorld: cloneVec3(state.velocityWorld),
    orientationBodyToWorld: normalizeQuat(state.orientationBodyToWorld),
    angularVelocityBody: cloneVec3(state.angularVelocityBody)
  };
}

function cloneSnapshot(snapshot: FlightStateSnapshot): FlightStateSnapshot {
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
      limitState: {...snapshot.instrumentation.limitState}
    }
  };
}

function lerpVec3(a: Vec3, b: Vec3, t: number): Vec3Tuple {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t
  ];
}

function interpolateInstrumentation(a: FlightInstrumentationState, b: FlightInstrumentationState, t: number): FlightInstrumentationState {
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
    limitState: {...b.limitState}
  };
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function finiteVec3(value: Vec3, fallback: Vec3): Vec3Tuple {
  if (Number.isFinite(value[0]) && Number.isFinite(value[1]) && Number.isFinite(value[2])) {
    return cloneVec3(value);
  }
  return cloneVec3(fallback);
}

function finiteQuat(value: QuatTuple, fallback: FlightState["orientationBodyToWorld"]): QuatTuple {
  if (Number.isFinite(value[0]) && Number.isFinite(value[1]) && Number.isFinite(value[2]) && Number.isFinite(value[3])) {
    return normalizeQuat(value);
  }
  return normalizeQuat(fallback);
}
