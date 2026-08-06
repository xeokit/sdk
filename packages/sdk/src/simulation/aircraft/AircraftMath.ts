import type {Mat4} from "../../base/math/matrix";
import type {Vec3} from "../../base/math/vector";

/**
 * Local aircraft axis that points forward in model space.
 *
 * `"-Z"` matches many glTF-style aircraft assets and is the controller
 * default.
 */
export type AircraftForwardAxis = "X" | "+X" | "-X" | "Y" | "+Y" | "-Y" | "Z" | "+Z" | "-Z" | string;

/** @internal */
export interface AircraftPose {
  /** World-space origin/position. */
  position: Vec3;
  /** World-space forward direction. */
  forward: Vec3;
  /** World-space right direction. */
  right: Vec3;
  /** World-space up direction. */
  up: Vec3;
}

/** @internal */
export function toVec3(value: ArrayLike<number> | undefined | null, fallback: Vec3 = [0, 0, 0] as Vec3): Vec3 {
  if (!value) {
    return [fallback[0], fallback[1], fallback[2]] as Vec3;
  }
  return [
    Number(value[0] || 0),
    Number(value[1] || 0),
    Number(value[2] || 0)
  ] as Vec3;
}

/** @internal */
export function add3(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]] as Vec3;
}

/** @internal */
export function sub3(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]] as Vec3;
}

/** @internal */
export function mul3(v: Vec3, scalar: number): Vec3 {
  return [v[0] * scalar, v[1] * scalar, v[2] * scalar] as Vec3;
}

/** @internal */
export function cross3(a: Vec3, b: Vec3): Vec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0]
  ] as Vec3;
}

/** @internal */
export function length3(v: Vec3): number {
  return Math.hypot(v[0], v[1], v[2]);
}

/** @internal */
export function dot3(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

/** @internal */
export function normalize(v: Vec3): Vec3 {
  const len = length3(v);
  if (len === 0) {
    return [0, 0, 0] as Vec3;
  }
  return [v[0] / len, v[1] / len, v[2] / len] as Vec3;
}

/** @internal */
export function safeNormalize(v: Vec3, fallback: Vec3): Vec3 {
  return length3(v) > 0.00001 ? normalize(v) : fallback;
}

/** @internal */
export function lerp3(a: Vec3, b: Vec3, t: number): Vec3 {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t
  ] as Vec3;
}

/** @internal */
export function flatDirection3(direction: Vec3, worldUp: Vec3): Vec3 {
  const flat = sub3(direction, mul3(worldUp, dot3(direction, worldUp)));
  return safeNormalize(flat, [1, 0, 0] as Vec3);
}

/** @internal */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** @internal */
export function basisFromForward(forward: Vec3, worldUp: Vec3, fallbackRight: Vec3 = [1, 0, 0] as Vec3): AircraftPose {
  const normalizedForward = safeNormalize(forward, [0, 1, 0] as Vec3);
  const flatForward = flatDirection3(normalizedForward, worldUp);
  const right = safeNormalize(cross3(flatForward, worldUp), fallbackRight);
  const up = safeNormalize(cross3(right, normalizedForward), worldUp);
  return {
    position: [0, 0, 0] as Vec3,
    forward: normalizedForward,
    right,
    up
  };
}

/** @internal */
export function vehicleLocalAxes(right: Vec3, up: Vec3, forward: Vec3, forwardAxis: AircraftForwardAxis) {
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
  return {localX, localY, localZ};
}

/** @internal */
export function buildVehicleMatrix({position, right, up, forward, forwardAxis}: AircraftPose & {forwardAxis: AircraftForwardAxis}): Mat4 {
  const {localX, localY, localZ} = vehicleLocalAxes(right, up, forward, forwardAxis);
  return [
    localX[0], localX[1], localX[2], 0,
    localY[0], localY[1], localY[2], 0,
    localZ[0], localZ[1], localZ[2], 0,
    position[0], position[1], position[2], 1
  ] as Mat4;
}

/** @internal */
export function aircraftLocalPointToWorld(localPoint: Vec3, state: AircraftPose, forwardAxis: AircraftForwardAxis): Vec3 {
  const axes = vehicleLocalAxes(state.right, state.up, state.forward, forwardAxis);
  return add3(
    add3(
      add3(state.position, mul3(axes.localX, localPoint[0])),
      mul3(axes.localY, localPoint[1])
    ),
    mul3(axes.localZ, localPoint[2])
  );
}

/** @internal */
export function segmentMatrixBetween(start: Vec3, end: Vec3, radius: number, fallbackUp: Vec3, fallbackRight: Vec3): Mat4 {
  const axis = sub3(end, start);
  const length = Math.max(0.001, length3(axis));
  const yAxis = safeNormalize(axis, [0, 1, 0] as Vec3);
  let xAxis = cross3(yAxis, fallbackUp);
  if (length3(xAxis) < 0.0001) {
    xAxis = cross3(yAxis, fallbackRight);
  }
  xAxis = safeNormalize(xAxis, [1, 0, 0] as Vec3);
  const zAxis = safeNormalize(cross3(xAxis, yAxis), [0, 0, 1] as Vec3);
  return [
    xAxis[0] * radius, xAxis[1] * radius, xAxis[2] * radius, 0,
    yAxis[0] * length, yAxis[1] * length, yAxis[2] * length, 0,
    zAxis[0] * radius, zAxis[1] * radius, zAxis[2] * radius, 0,
    start[0], start[1], start[2], 1
  ] as Mat4;
}
