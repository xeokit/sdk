/**
 * [![npm version](https://badge.fury.io/js/%40xeokit%2Fmath.svg)](https://badge.fury.io/js/%40xeokit%2Fmath)
 * [![](https://data.jsdelivr.com/v1/package/npm/@xeokit/badge)](https://www.jsdelivr.com/package/npm/@xeokit/math)
 *
 * <img style="padding:0px; padding-top:20px; padding-bottom:30px; height:140px;" src="media://images/math_icon.png"/>
 *
 * # xeokit Core Math Utilities
 *
 * ---
 *
 * ### *Basic math types and constants*
 *
 * ---
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
 * import * as math from "@xeokit/math";
 *
 * //..
 * ````
 *
 * @module @xeokit/math
 */

/**
 * An array of floating-point numbers.
 */
export type FloatArrayParam = (Uint8Array | Int8Array | Uint16Array | Uint32Array | Int16Array | Float32Array | Float64Array | number[]);

/**
 * An array of integer numbers.
 */
export type IntArrayParam = (Uint32Array | Uint8Array | Int8Array | Uint16Array | Int16Array | number[]);

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
    return new Float64Array(values);
}


export const MAX_INT= 10000000;

/**
 * Maximum safe inverse.
 *
 * Returns:
 * - x != 0 => 1/x,
 * - x == 1 => 1
 *
 * @param {number} x
 */
export function safeInv(x:number) {
    const retVal = 1 / x;
    if (isNaN(retVal) || !isFinite(retVal)) {
        return 1;
    }
    return retVal;
}
