import type {FlightCoordinateSystem} from "./FlightConventions";
import type {Mat3Tuple, Quat, Vec3} from "./FlightMath";

/**
 * Canonical rigid-body state. Derived values such as air-relative velocity,
 * angle of attack, Mach and HUD values are intentionally not stored here.
 */
export interface FlightState {
  positionWorld: Vec3;
  velocityWorld: Vec3;
  orientationBodyToWorld: Quat;
  /** Body rates [p, q, r] in radians/second. Positive q raises the nose. */
  angularVelocityBody: Vec3;
}

export interface FlightDerivedState {
  windWorld: Vec3;
  velocityAirWorld: Vec3;
  velocityAirBody: Vec3;
  dynamicPressure: number;
  alpha: number;
  beta: number;
  mach: number;
  accelerationWorld: Vec3;
  specificForceWorld: Vec3;
}

export interface FlightControlLimitState {
  aoaLimited: boolean;
  gLimited: boolean;
  rateLimited: boolean;
}

export interface FlightInstrumentationState {
  altitude: number;
  indicatedAirspeed: number;
  trueAirspeed: number;
  groundSpeed: number;
  verticalSpeed: number;
  pitch: number;
  bank: number;
  heading: number;
  angleOfAttack: number;
  sideslip: number;
  normalAcceleration: number;
  mach: number;
  throttle: number;
  limitState: FlightControlLimitState;
}

export interface FlightStateSnapshot {
  time: number;
  state: FlightState;
  derived: FlightDerivedState;
  instrumentation: FlightInstrumentationState;
}

export interface PilotControls {
  throttle: number;
  stickPitch: number;
  stickRoll: number;
  rudder: number;
}

export interface FlightControlLawInput {
  state: FlightState;
  derived: FlightDerivedState;
  instrumentation: FlightInstrumentationState;
  controls: PilotControls;
  aircraft: AircraftDefinition;
}

export interface ControlLawOutput {
  actuatorCommands: Record<string, number>;
  limitState: FlightControlLimitState;
}

export interface ActuatorState {
  positions: Record<string, number>;
  rates: Record<string, number>;
}

export interface ActuatorModel {
  update(commands: Record<string, number>, current: ActuatorState, dt: number): ActuatorState;
}

export interface FlightControlLaw {
  update(input: FlightControlLawInput, dt: number): ControlLawOutput;
}

export interface FlightEnvelopeLimits {
  maxAngleOfAttack?: number;
  maxPositiveG?: number;
  maxNegativeG?: number;
  maxRollRate?: number;
  maxPitchRate?: number;
  maxYawRate?: number;
}

export interface AircraftDefinition {
  id: string;
  mass: number;
  inertiaBody: Mat3Tuple;
  referenceArea: number;
  referenceSpan: number;
  referenceChord: number;
  limits?: FlightEnvelopeLimits;
  aerodynamics: AerodynamicsModel;
  engine: EngineModel;
  controlLaw: FlightControlLaw;
  actuators?: ActuatorModel;
}

export interface AtmosphereSample {
  density: number;
  pressure: number;
  temperature: number;
  speedOfSound: number;
}

export interface AtmosphereModel {
  sample(positionWorld: Vec3): AtmosphereSample;
}

export interface WindModel {
  sample(positionWorld: Vec3, time: number): Vec3;
}

export interface ForceMomentBody {
  forceBody: Vec3;
  momentBody: Vec3;
}

export interface AeroSampleInput {
  state: FlightState;
  derived: FlightDerivedState;
  atmosphere: AtmosphereSample;
  actuators: ActuatorState;
  aircraft: AircraftDefinition;
}

export interface AerodynamicsModel {
  sample(input: AeroSampleInput): ForceMomentBody;
}

export interface EngineSampleInput {
  state: FlightState;
  derived: FlightDerivedState;
  atmosphere: AtmosphereSample;
  throttle: number;
}

export interface EngineModel {
  sample(input: EngineSampleInput): ForceMomentBody;
}

export interface ExternalForceInput {
  state: FlightState;
  derived: FlightDerivedState;
  atmosphere: AtmosphereSample;
  aircraft: AircraftDefinition;
  controls: PilotControls;
  actuators: ActuatorState;
}

export interface ExternalForceProvider {
  sample(input: ExternalForceInput): ForceMomentBody;
}

export interface EnvironmentContactProvider {
  sample?(input: ExternalForceInput): ForceMomentBody;
}

export interface FixedStepFlightSimulationParams {
  aircraft: AircraftDefinition;
  initialState: FlightState;
  coordinateSystem?: FlightCoordinateSystem;
  atmosphere?: AtmosphereModel;
  wind?: WindModel;
  fixedDt?: number;
  gravity?: number;
  externalForces?: ExternalForceProvider[];
  contactProvider?: EnvironmentContactProvider;
}
