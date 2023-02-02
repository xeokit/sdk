/**
 * ## Core Math Utilities
 *
 * ## Installation
 *
 * ````bash
 * npm install @xeokit/math
 * ````
 *
 * ## Usage
 *
 * ````javascript
 * import * as math from "@xeokit/math/math";
 *
 * //..
 * ````
 *
 * @module @xeokit/math/math
 */

/**
 * An array of floating-point numbers.
 */
export type FloatArrayParam = (Uint8Array | Int8Array | Uint16Array | Uint32Array | Int16Array | Float32Array | Float64Array | number[]);

/**
 * An array of integer numbers.
 */
export type IntArrayParam = (Uint32Array | Uint8Array | Int8Array | Uint16Array | Int16Array | number[]);

const doublePrecision = true;

export const FloatArrayClass = doublePrecision ? Float64Array : Float32Array;

/**
 * Minimum safe double-precision value.
 */
export const MIN_DOUBLE: number = -Number.MAX_SAFE_INTEGER;

/**
 * Maximum safe double-precision value.
 */
export const MAX_DOUBLE: number = Number.MAX_SAFE_INTEGER;

/**
 * The number of radiians in a degree (0.0174532925).
 */
export const DEGTORAD: number = 0.0174532925;

/**
 * The number of degrees in a radian.
 */
export const RADTODEG: number = 57.295779513;

/**
 * Clamps a value to the given range.
 * @param value Value to clamp.
 * @param  min Lower bound.
 * @param max Upper bound.
 * @returns  Clamped result.
 */
export function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

/**
 * Creates a new {@link FloatArrayParam}.
 */
export function newFloatArray(values?: number | FloatArrayParam): FloatArrayParam {
    // @ts-ignore
    return new FloatArrayClass(values);
}

