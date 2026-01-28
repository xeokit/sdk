/**
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
 * ## Usage
 *
 * ````javascript
 * import * as math from "@xeokit/sdk/math";
 *
 * //..
 * ````
 *
 * @module math
 */
/**
 * Minimum safe double-precision value.
 */
export const MIN_DOUBLE = -Number.MAX_SAFE_INTEGER;
/**
 * Maximum safe double-precision value.
 */
export const MAX_DOUBLE = Number.MAX_SAFE_INTEGER;
/**
 * The number of radiians in a degree (0.0174532925).
 */
export const DEGTORAD = 0.0174532925;
/**
 * The number of degrees in a radian.
 */
export const RADTODEG = 57.295779513;
/**
 * Clamps a value to the given range.
 * @param value Value to clamp.
 * @param  min Lower bound.
 * @param max Upper bound.
 * @returns  Clamped result.
 */
export function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}
/**
 * Creates a new {@link FloatArrayParam}.
 */
export function newFloatArray(values) {
    // @ts-ignore
    return new Float64Array(values);
}
export const MAX_INT = 10000000;
/**
 * Maximum safe inverse.
 *
 * Returns:
 * - x != 0 => 1/x,
 * - x == 1 => 1
 *
 * @param {number} x
 */
export function safeInv(x) {
    const retVal = 1 / x;
    if (isNaN(retVal) || !isFinite(retVal)) {
        return 1;
    }
    return retVal;
}
//# sourceMappingURL=index.js.map
