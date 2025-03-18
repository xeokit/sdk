/**
 * <img style="padding:10px" src="https://xeokit.github.io/sdk/docs/assets/xeokit_components_icon.png"/>
 *
 * # Spline Curve Math Functions
 *
 * This module provides various mathematical functions for spline curves, including Bézier and Catmull-Rom interpolation methods.
 * These functions are useful for generating and manipulating smooth curves in 3D and 2D space.
 *
 * ## Installation
 *
 * To install the module, run the following command:
 *
 * ```bash
 * npm install @xeokit/sdk
 * ```
 *
 * ## Usage
 *
 * We'll demonstrate a selection of curve functions provided by this module.
 *
 * Import the functions:
 *
 * ```javascript
 * import {
 *   tangentQuadraticBezier,
 *   tangentQuadraticBezier3,
 *   tangentSpline,
 *   catmullRomInterpolate,
 *   b2,
 *   b3
 * } from "@xeokit/sdk/curves";
 * ```
 *
 * ### Quadratic Bézier curve tangent at a given parameter
 *
 * ```javascript
 * const t = 0.5; // Parameter t (0 ≤ t ≤ 1)
 * const p0 = 0, p1 = 10, p2 = 20; // Control points
 * const tangentQuad = tangentQuadraticBezier(t, p0, p1, p2);
 * console.log("Quadratic Bézier curve tangent:", tangentQuad);
 * ```
 *
 * ### Cubic Bézier curve tangent at a given parameter
 *
 * ```javascript
 * const p3 = 30; // Fourth control point
 * const tangentCubic = tangentQuadraticBezier3(t, p0, p1, p2, p3);
 * console.log("Cubic Bézier curve tangent:", tangentCubic);
 * ```
 *
* ### Spline curve tangent at a given parameter
*
 * ````javascript
 * const tangentSplineValue = tangentSpline(t);
 * console.log("Spline curve tangent:", tangentSplineValue);
 * ````
 *
 * ### Catmull-Rom interpolation at a given parameter
 *
 * ```javascript
 * const p4 = 40; // Additional control point for Catmull-Rom
 * const interpolatedValue = catmullRomInterpolate(p0, p1, p2, p3, t);
 * console.log("Catmull-Rom interpolation result:", interpolatedValue);
 * ```
 *
 * ### Quadratic Bézier curve result at a given parameter
 *
 * ```javascript
 * const quadBezierResult = b2(t, p0, p1, p2);
 * console.log("Quadratic Bézier curve result:", quadBezierResult);
 * ```
 *
 * ### Cubic Bézier curve result at a given parameter
 *
 * ```javascript
 * const cubicBezierResult = b3(t, p0, p1, p2, p3);
 * console.log("Cubic Bézier curve result:", cubicBezierResult);
 * ```
 *
 * @module curves
 */
/**
 * Computes the tangent to a quadratic Bézier curve.
 *
 * @param t The parameter (0 ≤ t ≤ 1) to evaluate the tangent at.
 * @param p0 The first control point.
 * @param p1 The second control point.
 * @param p2 The third control point.
 * @returns The tangent vector at the given parameter t.
 */
export declare function tangentQuadraticBezier(t: number, p0: number, p1: number, p2: number): number;
/**
 * Computes the tangent to a cubic Bézier curve.
 *
 * @param t The parameter (0 ≤ t ≤ 1) to evaluate the tangent at.
 * @param p0 The first control point.
 * @param p1 The second control point.
 * @param p2 The third control point.
 * @param p3 The fourth control point.
 * @returns The tangent vector at the given parameter t.
 */
export declare function tangentQuadraticBezier3(t: number, p0: number, p1: number, p2: number, p3: number): number;
/**
 * Computes the tangent to a spline.
 *
 * @param t The parameter (0 ≤ t ≤ 1) to evaluate the tangent at.
 * @returns The tangent vector at the given parameter t.
 */
export declare function tangentSpline(t: number): number;
/**
 * Performs Catmull-Rom interpolation on a curve.
 *
 * @param p0 The first control point.
 * @param p1 The second control point.
 * @param p2 The third control point.
 * @param p3 The fourth control point.
 * @param t The parameter (0 ≤ t ≤ 1) to evaluate the interpolation at.
 * @returns The interpolated value at the given parameter t.
 */
export declare function catmullRomInterpolate(p0: number, p1: number, p2: number, p3: number, t: number): number;
/**
 * Computes the quadratic Bézier curve function b2p0.
 *
 * @param t The parameter (0 ≤ t ≤ 1).
 * @param p The control point.
 * @returns The result of the quadratic Bézier function b2p0.
 */
export declare function b2p0(t: number, p: number): number;
/**
 * Computes the quadratic Bézier curve function b2p1.
 *
 * @param t The parameter (0 ≤ t ≤ 1).
 * @param p The control point.
 * @returns The result of the quadratic Bézier function b2p1.
 */
export declare function b2p1(t: number, p: number): number;
/**
 * Computes the quadratic Bézier curve function b2p2.
 *
 * @param t The parameter (0 ≤ t ≤ 1).
 * @param p The control point.
 * @returns The result of the quadratic Bézier function b2p2.
 */
export declare function b2p2(t: number, p: number): number;
/**
 * Computes the full quadratic Bézier curve using the control points p0, p1, and p2.
 *
 * @param t The parameter (0 ≤ t ≤ 1).
 * @param p0 The first control point.
 * @param p1 The second control point.
 * @param p2 The third control point.
 * @returns The value of the quadratic Bézier curve at the given parameter t.
 */
export declare function b2(t: number, p0: number, p1: number, p2: number): number;
/**
 * Computes the cubic Bézier curve function b3p0.
 *
 * @param t The parameter (0 ≤ t ≤ 1).
 * @param p The control point.
 * @returns The result of the cubic Bézier function b3p0.
 */
export declare function b3p0(t: number, p: number): number;
/**
 * Computes the cubic Bézier curve function b3p1.
 *
 * @param t The parameter (0 ≤ t ≤ 1).
 * @param p The control point.
 * @returns The result of the cubic Bézier function b3p1.
 */
export declare function b3p1(t: number, p: number): number;
/**
 * Computes the cubic Bézier curve function b3p2.
 *
 * @param t The parameter (0 ≤ t ≤ 1).
 * @param p The control point.
 * @returns The result of the cubic Bézier function b3p2.
 */
export declare function b3p2(t: number, p: number): number;
/**
 * Computes the cubic Bézier curve function b3p3.
 *
 * @param t The parameter (0 ≤ t ≤ 1).
 * @param p The control point.
 * @returns The result of the cubic Bézier function b3p3.
 */
export declare function b3p3(t: number, p: number): number;
/**
 * Computes the full cubic Bézier curve using the control points p0, p1, p2, and p3.
 *
 * @param t The parameter (0 ≤ t ≤ 1).
 * @param p0 The first control point.
 * @param p1 The second control point.
 * @param p2 The third control point.
 * @param p3 The fourth control point.
 * @returns The value of the cubic Bézier curve at the given parameter t.
 */
export declare function b3(t: number, p0: number, p1: number, p2: number, p3: number): number;
//# sourceMappingURL=index.d.ts.map
