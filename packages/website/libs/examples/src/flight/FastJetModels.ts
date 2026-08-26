import {lenVec3, type Mat3Tuple, type Vec3} from "./FlightMath";
import {DirectActuatorModel, SimpleBodyAxisEngineModel} from "./FlightModels";
import type {
  ActuatorModel,
  ActuatorState,
  AeroSampleInput,
  AerodynamicsModel,
  AircraftDefinition,
  ControlLawOutput,
  FlightControlLaw,
  FlightControlLawInput,
  ForceMomentBody
} from "./FlightTypes";

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export interface RateLimitedActuatorConfig {
  limits?: Record<string, {min: number; max: number; rate: number}>;
}

export class RateLimitedActuatorModel implements ActuatorModel {
  constructor(private readonly config: RateLimitedActuatorConfig = {}) {
  }

  update(commands: Record<string, number>, current: ActuatorState, dt: number): ActuatorState {
    const positions: Record<string, number> = {...current.positions};
    const rates: Record<string, number> = {};
    for (const name of Object.keys(commands)) {
      const limit = this.config.limits?.[name] || {min: -1, max: 1, rate: 8};
      const target = clamp(Number(commands[name] || 0), limit.min, limit.max);
      const previous = Number(positions[name] || 0);
      const maxDelta = Math.max(0, limit.rate) * dt;
      const next = previous + clamp(target - previous, -maxDelta, maxDelta);
      positions[name] = next;
      rates[name] = dt > 0 ? (next - previous) / dt : 0;
    }
    return {positions, rates};
  }
}

export interface FastJetControlLawConfig {
  rollActuator?: string;
  pitchActuator?: string;
  yawActuator?: string;
  maxRollRate?: number;
  maxPitchRate?: number;
  maxYawRate?: number;
  rollRateGain?: number;
  pitchRateGain?: number;
  yawRateGain?: number;
  maxAngleOfAttack?: number;
  maxPositiveG?: number;
}

export class FastJetControlLaw implements FlightControlLaw {
  constructor(private readonly config: FastJetControlLawConfig = {}) {
  }

  update(input: FlightControlLawInput): ControlLawOutput {
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
    if (aoaLimit !== undefined && input.derived.alpha > aoaLimit && targetQ > 0) {
      targetQ *= Math.max(0, 1 - (input.derived.alpha - aoaLimit) / Math.max(aoaLimit * 0.25, 0.01));
      aoaLimited = true;
    }
    if (gLimit !== undefined && input.instrumentation.normalAcceleration > gLimit && targetQ > 0) {
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
}

export interface SimpleCoefficientAerodynamicsConfig {
  rollActuator?: string;
  pitchActuator?: string;
  yawActuator?: string;
  liftCurveSlope?: number;
  zeroLiftAlpha?: number;
  maxLiftCoefficient?: number;
  dragCoefficientZero?: number;
  inducedDragFactor?: number;
  sideForceBeta?: number;
  rollMomentPerRollCommand?: number;
  pitchMomentPerPitchCommand?: number;
  yawMomentPerYawCommand?: number;
  yawMomentPerSideslip?: number;
  rollDamping?: number;
  pitchDamping?: number;
  yawDamping?: number;
}

export class SimpleCoefficientAerodynamicsModel implements AerodynamicsModel {
  constructor(private readonly config: SimpleCoefficientAerodynamicsConfig = {}) {
  }

  sample(input: AeroSampleInput): ForceMomentBody {
    const cfg = this.config;
    const q = input.derived.dynamicPressure;
    const speed = lenVec3(input.derived.velocityAirBody);
    if (speed <= 0.001 || q <= 0.001) {
      return {forceBody: [0, 0, 0], momentBody: [0, 0, 0]};
    }
    const area = input.aircraft.referenceArea;
    const span = input.aircraft.referenceSpan;
    const chord = input.aircraft.referenceChord;
    const alpha = input.derived.alpha - (cfg.zeroLiftAlpha ?? -0.008);
    const cl = clamp((cfg.liftCurveSlope ?? 4.6) * alpha, -(cfg.maxLiftCoefficient ?? 1.25), cfg.maxLiftCoefficient ?? 1.25);
    const cd = (cfg.dragCoefficientZero ?? 0.026) + (cfg.inducedDragFactor ?? 0.08) * cl * cl;
    const cy = clamp(-(cfg.sideForceBeta ?? 0.9) * input.derived.beta, -1, 1);
    const roll = Number(input.actuators.positions[cfg.rollActuator || "roll"] || 0);
    const pitch = Number(input.actuators.positions[cfg.pitchActuator || "pitch"] || 0);
    const yaw = Number(input.actuators.positions[cfg.yawActuator || "yaw"] || 0);
    const rates = input.state.angularVelocityBody;
    const forceBody: Vec3 = [
      -cd * q * area,
      cy * q * area,
      -cl * q * area
    ];
    const momentBody: Vec3 = [
      roll * (cfg.rollMomentPerRollCommand ?? 0.09) * q * area * span - rates[0] * (cfg.rollDamping ?? 0.018) * q * area * span,
      pitch * (cfg.pitchMomentPerPitchCommand ?? -0.12) * q * area * chord - rates[1] * (cfg.pitchDamping ?? 0.026) * q * area * chord,
      (yaw * (cfg.yawMomentPerYawCommand ?? 0.04) + input.derived.beta * (cfg.yawMomentPerSideslip ?? 0.055)) * q * area * span - rates[2] * (cfg.yawDamping ?? 0.022) * q * area * span
    ];
    return {forceBody, momentBody};
  }
}

export interface FictionalFastJetDefinitionParams {
  id?: string;
  mass?: number;
  inertiaBody?: Mat3Tuple;
  referenceArea?: number;
  referenceSpan?: number;
  referenceChord?: number;
  maxThrust?: number;
  aerodynamics?: SimpleCoefficientAerodynamicsConfig;
}

export function createFictionalFastJetDefinition(params: FictionalFastJetDefinitionParams = {}): AircraftDefinition {
  return {
    id: params.id || "fictional-fast-jet",
    mass: params.mass ?? 12000,
    inertiaBody: params.inertiaBody || [
      18000, 0, 0,
      0, 84000, 0,
      0, 0, 92000
    ],
    referenceArea: params.referenceArea ?? 38,
    referenceSpan: params.referenceSpan ?? 9.5,
    referenceChord: params.referenceChord ?? 4.0,
    limits: {
      maxAngleOfAttack: 24 * Math.PI / 180,
      maxPositiveG: 8.5,
      maxNegativeG: -3,
      maxRollRate: 4.5,
      maxPitchRate: 1.9,
      maxYawRate: 0.8
    },
    aerodynamics: new SimpleCoefficientAerodynamicsModel(params.aerodynamics),
    engine: new SimpleBodyAxisEngineModel(params.maxThrust ?? 125000),
    controlLaw: new FastJetControlLaw(),
    actuators: new RateLimitedActuatorModel()
  };
}
