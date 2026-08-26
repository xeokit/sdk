import {
  addVec3,
  crossVec3,
  rotateVec3ByQuat,
  rotateWorldToBody,
  subVec3,
  type Vec3,
  type Vec3Tuple,
  vec3
} from "./FlightMath";
import type {FlightState} from "./FlightTypes";

export interface ResolvedForceMoment {
  forceWorld: Vec3Tuple;
  momentBody: Vec3Tuple;
}

export class ForceMomentAccumulator {
  private forceWorld: Vec3Tuple = vec3();
  private momentBody: Vec3Tuple = vec3();

  clear(): void {
    this.forceWorld = vec3();
    this.momentBody = vec3();
  }

  addWorldForce(forceWorld: Vec3, applicationPointWorld?: Vec3, state?: FlightState): void {
    this.forceWorld = addVec3(this.forceWorld, forceWorld);
    if (applicationPointWorld && state) {
      const armWorld = subVec3(applicationPointWorld, state.positionWorld);
      const momentWorld = crossVec3(armWorld, forceWorld);
      this.momentBody = addVec3(this.momentBody, rotateWorldToBody(state.orientationBodyToWorld, momentWorld));
    }
  }

  addBodyForce(forceBody: Vec3, state: FlightState, applicationPointBody?: Vec3): void {
    this.forceWorld = addVec3(this.forceWorld, rotateVec3ByQuat(state.orientationBodyToWorld, forceBody));
    if (applicationPointBody) {
      this.momentBody = addVec3(this.momentBody, crossVec3(applicationPointBody, forceBody));
    }
  }

  addBodyMoment(momentBody: Vec3): void {
    this.momentBody = addVec3(this.momentBody, momentBody);
  }

  resolve(): ResolvedForceMoment {
    return {
      forceWorld: this.forceWorld,
      momentBody: this.momentBody
    };
  }
}
