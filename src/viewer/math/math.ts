type FloatArrayType = (Float32Array | Float64Array | number[]);

const doublePrecision = true;
const FloatArrayClass = doublePrecision ? Float64Array : Float32Array;

/**
 *
 */
export const MIN_DOUBLE: number = -Number.MAX_SAFE_INTEGER;

/**
 *
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
 *
 */
export {FloatArrayType};

/**
 *
 */
export function newFloatArray(values?: number | FloatArrayType): FloatArrayType {
    // @ts-ignore
    return new FloatArrayClass(values);
}

