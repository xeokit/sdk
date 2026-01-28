/**
 * <img style="padding:0px; padding-top:20px; padding-bottom:20px;  height:270px" src="https://xeokit.github.io/sdk/docs/assets/3D-Cart.svg"/>
 *
 * # xeokit Spline Curve Math Utilities
 *
 * ---
 *
 * ***Math helpers for working with spline curves.***
 *
 * ---
 *
 * This module contains lightweight curve utilities for evaluating common spline types,
 * currently focused on **Bézier** (quadratic/cubic) and **Catmull–Rom** interpolation.
 * These functions are handy when you need smooth parametric motion, easing-like blends,
 * or curve-based sampling in 1D, 2D, or 3D workflows (for example: camera rails, animated
 * values, or generating polyline samples).
 *
 * All evaluators use a normalized parameter **`t` in the range [0..1]**.
 *
 * ## Installation
 *
 * ```bash
 * npm install @xeokit/sdk
 * ```
 *
 * ## Usage
 *
 * Below are examples of a few commonly used helpers.
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
 * } from "@xeokit/sdk/math/curves";
 * ```
 *
 * ### Quadratic Bézier tangent at `t`
 *
 * ```javascript
 * const t = 0.5; // 0 ≤ t ≤ 1
 * const p0 = 0, p1 = 10, p2 = 20; // Control points
 * const tangentQuad = tangentQuadraticBezier(t, p0, p1, p2);
 * console.log("Quadratic Bézier tangent:", tangentQuad);
 * ```
 *
 * ### Cubic Bézier tangent at `t`
 *
 * ```javascript
 * const p3 = 30; // Fourth control point
 * const tangentCubic = tangentQuadraticBezier3(t, p0, p1, p2, p3);
 * console.log("Cubic Bézier tangent:", tangentCubic);
 * ```
 *
 * ### Spline tangent basis at `t`
 *
 * ```javascript
 * const tangentSplineValue = tangentSpline(t);
 * console.log("Spline tangent basis:", tangentSplineValue);
 * ```
 *
 * ### Catmull–Rom interpolation at `t`
 *
 * ```javascript
 * const interpolatedValue = catmullRomInterpolate(p0, p1, p2, p3, t);
 * console.log("Catmull–Rom interpolation:", interpolatedValue);
 * ```
 *
 * ### Quadratic Bézier value at `t`
 *
 * ```javascript
 * const quadBezierResult = b2(t, p0, p1, p2);
 * console.log("Quadratic Bézier value:", quadBezierResult);
 * ```
 *
 * ### Cubic Bézier value at `t`
 *
 * ```javascript
 * const cubicBezierResult = b3(t, p0, p1, p2, p3);
 * console.log("Cubic Bézier value:", cubicBezierResult);
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
export function tangentQuadraticBezier(t: number, p0: number, p1: number, p2: number): number {
  return 2 * (1 - t) * (p1 - p0) + 2 * t * (p2 - p1);
}

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
export function tangentQuadraticBezier3(t: number, p0: number, p1: number, p2: number, p3: number): number {
  return -3 * p0 * (1 - t) ** 2 +
    3 * p1 * (1 - t) ** 2 -
    6 * t * p1 * (1 - t) +
    6 * t * p2 * (1 - t) -
    3 * t ** 2 * p2 +
    3 * t ** 2 * p3;
}

/**
 * Computes the tangent to a spline.
 *
 * @param t The parameter (0 ≤ t ≤ 1) to evaluate the tangent at.
 * @returns The tangent vector at the given parameter t.
 */
export function tangentSpline(t: number) {
  const h00 = 6 * t ** 2 - 6 * t;
  const h10 = 3 * t ** 2 - 4 * t + 1;
  const h01 = -6 * t ** 2 + 6 * t;
  const h11 = 3 * t ** 2 - 2 * t;
  return h00 + h10 + h01 + h11;
}

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
export function catmullRomInterpolate(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const v0 = (p2 - p0) * 0.5;
  const v1 = (p3 - p1) * 0.5;
  const t2 = t ** 2;
  const t3 = t * t2;
  return (2 * p1 - 2 * p2 + v0 + v1) * t3 + (-3 * p1 + 3 * p2 - 2 * v0 - v1) * t2 + v0 * t + p1;
}

// Bézier Curve Formulas from http://en.wikipedia.org/wiki/B%C3%A9zier_curve

// Quad Bézier Functions

/**
 * Computes the quadratic Bézier curve function b2p0.
 *
 * @param t The parameter (0 ≤ t ≤ 1).
 * @param p The control point.
 * @returns The result of the quadratic Bézier function b2p0.
 */
export function b2p0(t: number, p: number): number {
  const k = 1 - t;
  return k * k * p;
}

/**
 * Computes the quadratic Bézier curve function b2p1.
 *
 * @param t The parameter (0 ≤ t ≤ 1).
 * @param p The control point.
 * @returns The result of the quadratic Bézier function b2p1.
 */
export function b2p1(t: number, p: number): number {
  return 2 * (1 - t) * t * p;
}

/**
 * Computes the quadratic Bézier curve function b2p2.
 *
 * @param t The parameter (0 ≤ t ≤ 1).
 * @param p The control point.
 * @returns The result of the quadratic Bézier function b2p2.
 */
export function b2p2(t: number, p: number): number {
  return t * t * p;
}

/**
 * Computes the full quadratic Bézier curve using the control points p0, p1, and p2.
 *
 * @param t The parameter (0 ≤ t ≤ 1).
 * @param p0 The first control point.
 * @param p1 The second control point.
 * @param p2 The third control point.
 * @returns The value of the quadratic Bézier curve at the given parameter t.
 */
export function b2(t: number, p0: number, p1: number, p2: number): number {
  return b2p0(t, p0) + b2p1(t, p1) + b2p2(t, p2);
}

// Cubic Bézier Functions

/**
 * Computes the cubic Bézier curve function b3p0.
 *
 * @param t The parameter (0 ≤ t ≤ 1).
 * @param p The control point.
 * @returns The result of the cubic Bézier function b3p0.
 */
export function b3p0(t: number, p: number): number {
  const k = 1 - t;
  return k * k * k * p;
}

/**
 * Computes the cubic Bézier curve function b3p1.
 *
 * @param t The parameter (0 ≤ t ≤ 1).
 * @param p The control point.
 * @returns The result of the cubic Bézier function b3p1.
 */
export function b3p1(t: number, p: number): number {
  const k = 1 - t;
  return 3 * k * k * t * p;
}

/**
 * Computes the cubic Bézier curve function b3p2.
 *
 * @param t The parameter (0 ≤ t ≤ 1).
 * @param p The control point.
 * @returns The result of the cubic Bézier function b3p2.
 */
export function b3p2(t: number, p: number): number {
  const k = 1 - t;
  return 3 * k * t * t * p;
}

/**
 * Computes the cubic Bézier curve function b3p3.
 *
 * @param t The parameter (0 ≤ t ≤ 1).
 * @param p The control point.
 * @returns The result of the cubic Bézier function b3p3.
 */
export function b3p3(t: number, p: number): number {
  return t * t * t * p;
}

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
export function b3(t: number, p0: number, p1: number, p2: number, p3: number) {
  return b3p0(t, p0) + b3p1(t, p1) + b3p2(t, p2) + b3p3(t, p3);
}
