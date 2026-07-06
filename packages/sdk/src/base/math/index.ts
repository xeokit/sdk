/**
 * <img style="padding:0px; padding-top:30px; padding-bottom:10px; height:130px;" src="https://xeokit.github.io/sdk/docs/assets/xeokit_logo_mesh.png"/>
 *
 * # Math
 *
 * Functions and types for vectors, matrices, quaternions, curves,
 * bounds, compression, and RTC coordinate conversion.
 *
 * Most operations work with `Float32Array` or `Float64Array` data.
 * Many functions accept an optional destination array for callers
 * that want to reuse scratch buffers.
 *
 * ## Installation
 *
 * ````bash
 * npm install @xeokit/sdk
 * ````
 *
 * ## Usage
 *
 * ````javascript
 * import { dotVec3, createVec3Float64 } from "@xeokit/sdk/base/math";
 *
 * const a = createVec3Float64([0.1, 1, 2.1]);
 * const b = createVec3Float64([0.5, 2.1, -1.3]);
 *
 * const c = dotVec3(a, b);
 * ````
 *
 * @module math
 */


/**
 * Array input accepted by floating-point math functions.
 */
export type FloatArrayParam =
  Uint8Array<any>
  | Int8Array<any>
  | Uint16Array<any>
  | Uint32Array<any>
  | Int16Array<any>
  | Float32Array<any>
  | Float64Array<any>
  | number[];

/**
 * Array input accepted by integer math functions.
 */
export type IntArrayParam =
  Uint32Array<any>
  | Uint8Array<any>
  | Int8Array<any>
  | Uint16Array<any>
  | Int16Array<any>
  | number[];

/**
 * Minimum safe double-precision value.
 */
export const MIN_DOUBLE: number = -Number.MAX_SAFE_INTEGER;

/**
 * Maximum safe double-precision value.
 */
export const MAX_DOUBLE: number = Number.MAX_SAFE_INTEGER;

/**
 * Converts degrees to radians.
 *
 * **Value:** `0.0174532925`
 */
export const DEGTORAD: number = 0.0174532925;

/**
 * Converts radians to degrees.
 *
 * **Value:** `57.295779513`
 */
export const RADTODEG: number = 57.295779513;

/**
 * Clamps a value to the given range.
 *
 * @param value The value to clamp.
 * @param min The lower bound.
 * @param max The upper bound.
 * @returns The clamped value.
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Clamps a value to the unit range `[0, 1]`.
 */
export function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

/**
 * Creates a new {@link FloatArrayParam} instance.
 *
 * @param values Optional initial values.
 * @returns A new `Float64Array` containing the provided values.
 */
export function newFloatArray(values?: number | FloatArrayParam): FloatArrayParam {
  // Split the union so each call hits a single Float64Array constructor
  // overload (length vs array-copy); undefined preserves the original
  // zero-length-array behaviour.
  if (values === undefined) {
    return new Float64Array(0);
  }
  return typeof values === "number" ? new Float64Array(values) : new Float64Array(values);
}

/**
 * Maximum safe integer value.
 */
export const MAX_INT = 10_000_000;

/**
 * Computes a safe inverse of a number.
 *
 * @param x The number to invert.
 * @returns `1/x` if `x` is nonzero, otherwise returns `1`.
 */
export function safeInv(x: number): number {
  const result = 1 / x;
  return isFinite(result) ? result : 1;
}

export * as vector from "./vector";
export * as matrix from "./matrix";
export * as quat from "./quat";
export * from "./misc";

export * as boundaries from "./boundaries";
export * as rtc from "./rtc";
export * as compression from "./compression";
export * as curves from "./curves";
export * as polygon2D from "./polygon2D";
