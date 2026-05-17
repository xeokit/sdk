/**
 * <img style="padding:0px; padding-top:30px; padding-bottom:10px; height:130px;" src="https://xeokit.github.io/sdk/docs/assets/xeokit_logo_mesh.png"/>
 *
 * # xeokit SDK Math Libraries
 *
 * ---
 *
 * ***Mathematical functions for 2D/3D matrices, quaternions, and vectors***
 *
 * ---
 *
 * This library provides a set of utilities for working with
 * mathematical operations commonly used in 3D graphics, including
 * vector and matrix operations such as dot products, vector
 * negation, addition, and more.
 *
 * <br>
 *
 * ## Features
 *
 * - **Allocation-aware** — typed `Vec`/`Mat` constructors return
 *   raw `Float32Array` / `Float64Array` typed-array views so they
 *   round-trip cleanly through GPU upload paths.
 * - **In-place + out-of-place variants** — most ops accept an
 *   optional `dest` so hot-paths can reuse pre-allocated scratch.
 * - **Double-precision throughout** — every transform / boundary
 *   math op exists in both Float32 and Float64 flavours; the
 *   Float64 path is used by the scene-graph for accurate world-scale
 *   transforms.
 * - **Compression helpers** — quantise / dequantise positions
 *   against an AABB, oct-encode / decode normals, pack UVs against
 *   a `[uMin, uMax, vMin, vMax]` rect. Used by the
 *   {@link model!scene.SceneModel | SceneModel} builder and XGF
 *   format I/O.
 * - **RTC (Relative-To-Centre)** — tile-based world ↔ local
 *   conversions that keep GPU positions near the origin for
 *   real-world-scale models.
 * - **Curves** — Catmull-Rom / cubic / quadratic Bézier
 *   evaluation primitives for camera-path animation.
 *
 * <br>
 *
 * # Installation
 *
 * To install the xeokit SDK, use the following npm command:
 *
 * ````bash
 * npm install @xeokit/sdk
 * ````
 *
 * # Usage
 *
 * You can import and use functions from the math module as follows:
 *
 * ````javascript
 * import { dotVec3, createVec3Float64 } from "@xeokit/sdk/base/math";
 *
 * const a = createVec3Float64([0.1, 1, 2.1]);
 * const b = createVec3Float64([0.5, 2.1, -1.3]);
 *
 * const c = dotVec3(a, b); // Computes the dot product of vectors a and b
 * ````
 *
 * @module math
 */


/**
 * Represents an array of floating-point numbers.
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
 * Represents an array of integer numbers.
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
 * Creates a new {@link FloatArrayParam} instance.
 *
 * @param values Optional initial values.
 * @returns A new `Float64Array` containing the provided values.
 */
export function newFloatArray(values?: number | FloatArrayParam): FloatArrayParam {
  // @ts-ignore
  return new Float64Array(values);
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
