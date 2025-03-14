/**
 * <img style="padding: 20px 0 30px; height: 140px;" src="https://xeokit.github.io/sdk/docs/assets/math_icon.png"/>
 *
 * # xeokit Core Math Utilities
 *
 * ---
 *
 * **Basic math types and constants**
 *
 * ---
 *
 * ## Installation
 *
 * ```bash
 * npm install @xeokit/sdk
 * ```
 *
 * ## Usage
 *
 * ```javascript
 * import { MIN_DOUBLE, MAX_DOUBLE, DEGTORAD } from "@xeokit/sdk/math";
 *
 * //...
 * ```
 *
 * @module math
 */

/**
 * Represents an array of floating-point numbers.
 */
export type FloatArrayParam = Uint8Array | Int8Array | Uint16Array | Uint32Array | Int16Array | Float32Array | Float64Array | number[];

/**
 * Represents an array of integer numbers.
 */
export type IntArrayParam = Uint32Array | Uint8Array | Int8Array | Uint16Array | Int16Array | number[];

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
