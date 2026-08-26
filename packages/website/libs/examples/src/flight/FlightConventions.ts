import {mulVec3Scalar, normalizeVec3, quatFromBodyAxes, type QuatTuple, type Vec3, type Vec3Tuple} from "./FlightMath";

/**
 * Coordinate frame used by the flight module.
 *
 * The aircraft body frame is always right-handed:
 *
 * - body +X: nose/forward
 * - body +Y: right wing
 * - body +Z: down
 *
 * World axes are supplied by the host so the simulation can run in xeokit
 * coordinate systems without baking Amsterdam's city axes into the SDK core.
 */
export interface FlightCoordinateSystem {
  /** World-space forward/north reference used for heading zero. */
  worldForward: Vec3;
  /** World-space right/east reference used for heading and level attitude. */
  worldRight: Vec3;
  /** World-space up direction. */
  worldUp: Vec3;
}

/**
 * Amsterdam's current local world convention: +X right/east, +Y north/forward,
 * +Z up.
 */
export const AmsterdamFlightCoordinateSystem: FlightCoordinateSystem = {
  worldForward: [0, 1, 0],
  worldRight: [1, 0, 0],
  worldUp: [0, 0, 1]
};

/**
 * Generic Z-up convention with +X forward, +Y right and +Z up.
 */
export const ZUpForwardXCoordinateSystem: FlightCoordinateSystem = {
  worldForward: [1, 0, 0],
  worldRight: [0, 1, 0],
  worldUp: [0, 0, 1]
};

export interface NormalizedFlightCoordinateSystem {
  worldForward: Vec3Tuple;
  worldRight: Vec3Tuple;
  worldUp: Vec3Tuple;
}

export function normalizeFlightCoordinateSystem(coordinateSystem: FlightCoordinateSystem): NormalizedFlightCoordinateSystem {
  const worldUp = normalizeVec3(coordinateSystem.worldUp, [0, 0, 1]);
  const worldForward = normalizeVec3(coordinateSystem.worldForward, [1, 0, 0]);
  const worldRight = normalizeVec3(coordinateSystem.worldRight, [0, 1, 0]);
  return {worldForward, worldRight, worldUp};
}

/**
 * Creates a level body-to-world orientation. Body +X maps to world forward,
 * body +Y maps to world right and body +Z maps to world down.
 */
export function createLevelBodyToWorldOrientation(coordinateSystem: FlightCoordinateSystem): QuatTuple {
  const normalized = normalizeFlightCoordinateSystem(coordinateSystem);
  return quatFromBodyAxes(
    normalized.worldForward,
    normalized.worldRight,
    mulVec3Scalar(normalized.worldUp, -1)
  );
}

/**
 * Internal simulation units are SI:
 *
 * - meters, seconds, kilograms
 * - newtons and newton-meters
 * - radians and radians/second
 * - meters/second and meters/second^2
 */
export const FlightUnits = Object.freeze({
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
