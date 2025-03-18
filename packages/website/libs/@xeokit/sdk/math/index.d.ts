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
export declare const MIN_DOUBLE: number;
/**
 * Maximum safe double-precision value.
 */
export declare const MAX_DOUBLE: number;
/**
 * Converts degrees to radians.
 *
 * **Value:** `0.0174532925`
 */
export declare const DEGTORAD: number;
/**
 * Converts radians to degrees.
 *
 * **Value:** `57.295779513`
 */
export declare const RADTODEG: number;
/**
 * Clamps a value to the given range.
 *
 * @param value The value to clamp.
 * @param min The lower bound.
 * @param max The upper bound.
 * @returns The clamped value.
 */
export declare function clamp(value: number, min: number, max: number): number;
/**
 * Creates a new {@link FloatArrayParam} instance.
 *
 * @param values Optional initial values.
 * @returns A new `Float64Array` containing the provided values.
 */
export declare function newFloatArray(values?: number | FloatArrayParam): FloatArrayParam;
/**
 * Maximum safe integer value.
 */
export declare const MAX_INT = 10000000;
/**
 * Computes a safe inverse of a number.
 *
 * @param x The number to invert.
 * @returns `1/x` if `x` is nonzero, otherwise returns `1`.
 */
export declare function safeInv(x: number): number;
//# sourceMappingURL=index.d.ts.map
