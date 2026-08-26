import {lenVec3, mulVec3Scalar, type Vec3, vec3} from "./FlightMath";
import type {
  ActuatorModel,
  ActuatorState,
  AerodynamicsModel,
  AtmosphereModel,
  ControlLawOutput,
  EngineModel,
  FlightControlLaw,
  FlightControlLawInput,
  ForceMomentBody,
  WindModel
} from "./FlightTypes";

export const NO_LIMITS = Object.freeze({
  aoaLimited: false,
  gLimited: false,
  rateLimited: false
});

export class StandardAtmosphereModel implements AtmosphereModel {
  sample(positionWorld: Vec3) {
    const altitude = Math.max(0, positionWorld[2] || 0);
    const temperature = Math.max(216.65, 288.15 - 0.0065 * altitude);
    const pressure = 101325 * Math.pow(temperature / 288.15, 5.25588);
    const density = pressure / (287.05 * temperature);
    const speedOfSound = Math.sqrt(1.4 * 287.05 * temperature);
    return {density, pressure, temperature, speedOfSound};
  }
}

export class ConstantWindModel implements WindModel {
  constructor(private readonly windWorld: Vec3 = [0, 0, 0]) {
  }

  sample(): Vec3 {
    return this.windWorld;
  }
}

export class NullAerodynamicsModel implements AerodynamicsModel {
  sample(): ForceMomentBody {
    return {
      forceBody: [0, 0, 0],
      momentBody: [0, 0, 0]
    };
  }
}

export class SimpleBodyAxisEngineModel implements EngineModel {
  constructor(private readonly maxThrust = 0) {
  }

  sample({throttle}: {throttle: number}): ForceMomentBody {
    return {
      forceBody: [Math.max(0, Math.min(1, throttle)) * this.maxThrust, 0, 0],
      momentBody: [0, 0, 0]
    };
  }
}

export class DirectActuatorModel implements ActuatorModel {
  update(commands: Record<string, number>): ActuatorState {
    return {
      positions: {...commands},
      rates: {}
    };
  }
}

export class PassThroughFlightControlLaw implements FlightControlLaw {
  update(input: FlightControlLawInput): ControlLawOutput {
    return {
      actuatorCommands: {
        throttle: input.controls.throttle,
        stickPitch: input.controls.stickPitch,
        stickRoll: input.controls.stickRoll,
        rudder: input.controls.rudder
      },
      limitState: {...NO_LIMITS}
    };
  }
}

export function emptyActuatorState(): ActuatorState {
  return {
    positions: {},
    rates: {}
  };
}

export function zeroForceMoment(): ForceMomentBody {
  return {
    forceBody: vec3(),
    momentBody: vec3()
  };
}

export function speedFromVelocity(velocity: Vec3): number {
  return lenVec3(velocity);
}

export function scaleForceMoment(sample: ForceMomentBody, scale: number): ForceMomentBody {
  return {
    forceBody: mulVec3Scalar(sample.forceBody, scale),
    momentBody: mulVec3Scalar(sample.momentBody, scale)
  };
}
