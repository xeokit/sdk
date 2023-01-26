/**
 * An array of floating-point numbers.
 */
export type FloatArrayParam = (Uint8Array | Int8Array | Uint16Array | Uint32Array | Int16Array | Float32Array | Float64Array | number[]);
/**
 * An array of integer numbers.
 */
export type IntArrayParam = (Uint32Array | Uint8Array | Int8Array | Uint16Array | Int16Array | number[]);
export declare const FloatArrayClass: Float64ArrayConstructor | Float32ArrayConstructor;
/**
 * Minimum safe double-precision value.
 */
export declare const MIN_DOUBLE: number;
/**
 * Maximum safe double-precision value.
 */
export declare const MAX_DOUBLE: number;
/**
 * The number of radiians in a degree (0.0174532925).
 */
export declare const DEGTORAD: number;
/**
 * The number of degrees in a radian.
 */
export declare const RADTODEG: number;
/**
 * Clamps a value to the given range.
 * @param value Value to clamp.
 * @param  min Lower bound.
 * @param max Upper bound.
 * @returns  Clamped result.
 */
export declare function clamp(value: number, min: number, max: number): number;
/**
 * Creates a new {@link FloatArrayParam}.
 */
export declare function newFloatArray(values?: number | FloatArrayParam): FloatArrayParam;
