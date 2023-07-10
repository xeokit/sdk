/**
 * [![npm version](https://badge.fury.io/js/%40xeokit%2Fmath.svg)](https://badge.fury.io/js/%40xeokit%2Fmath)
 * [![](https://data.jsdelivr.com/v1/package/npm/@xeokit/badge)](https://www.jsdelivr.com/package/npm/@xeokit/math)
 *
 * # xeokit Curves Math Library
 *
 * ---
 *
 * ### *Spline curve math functions*
 *
 * ---
 *
 * ## Installation
 *
 * ````bash
 * npm install @xeokit/curves
 * ````
 *
 * ````javascript
 * import * as curves from "@xeokit/curves";
 *
 * //..
 * ````
 *
 * @module @xeokit/curves
 */
/**
 * Finds a tangent to a quadratic Bézier curve.
 *
 * @param t
 * @param p0
 * @param p1
 * @param p2
 */
export declare function tangentQuadraticBézier(t: number, p0: number, p1: number, p2: number): number;
/**
 * Finds a tangent to a quadratic Bézier curve.
 *
 * @param t
 * @param p0
 * @param p1
 * @param p2
 */
export declare function tangentQuadraticBézier3(t: number, p0: number, p1: number, p2: number, p3: number): number;
/**
 * Finds a tangent to a spline.
 * @param t
 */
export declare function tangentSpline(t: number): number;
/**
 * Catmull-Rom interpolation on a curve.
 * @param p0
 * @param p1
 * @param p2
 * @param p3
 * @param t
 */
export declare function catmullRomInterpolate(p0: number, p1: number, p2: number, p3: number, t: number): number;
/**
 * Quad Bézier curve function b2p0
 *
 * @param t
 * @param p
 */
export declare function b2p0(t: number, p: number): number;
/**
 * Quad Bézier curve function b2p1
 * @param t
 * @param p
 */
export declare function b2p1(t: number, p: number): number;
/**
 * Quad Bézier curve function b2p2
 * @param t
 * @param p
 */
export declare function b2p2(t: number, p: number): number;
/**
 * Quad Bézier curve function b2
 * @param t
 * @param p0
 * @param p1
 * @param p2
 */
export declare function b2(this: any, t: number, p0: number, p1: number, p2: number): number;
/**
 * Cubic Bézier curve function b3p0
 * @param t
 * @param p
 */
export declare function b3p0(t: number, p: number): number;
/**
 * Cubic Bézier curve function b3p1
 * @param t
 * @param p
 */
export declare function b3p1(t: number, p: number): number;
/**
 * Cubic Bézier curve function b3p2
 * @param t
 * @param p
 */
export declare function b3p2(t: number, p: number): number;
/**
 * Cubic Bézier curve function b3p3
 * @param t
 * @param p
 */
export declare function b3p3(t: number, p: number): number;
/**
 * Cubic Bézier curve function b3
 * @param t
 * @param p0
 * @param p1
 * @param p2
 * @param p3
 */
export declare function b3(this: any, t: number, p0: number, p1: number, p2: number, p3: number): any;
