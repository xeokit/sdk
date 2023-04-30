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
export function tangentQuadraticBézier(t: number, p0: number, p1: number, p2: number): number {
    return 2 * (1 - t) * (p1 - p0) + 2 * t * (p2 - p1);
}

/**
 * Finds a tangent to a quadratic Bézier curve.
 *
 * @param t
 * @param p0
 * @param p1
 * @param p2
 */
export function tangentQuadraticBézier3(t: number, p0: number, p1: number, p2: number, p3: number): number {
    return -3 * p0 * (1 - t) * (1 - t) +
        3 * p1 * (1 - t) * (1 - t) - 6 * t * p1 * (1 - t) +
        6 * t * p2 * (1 - t) - 3 * t * t * p2 +
        3 * t * t * p3;
}

/**
 * Finds a tangent to a spline.
 * @param t
 */
export function tangentSpline(t: number) {
    const h00 = 6 * t * t - 6 * t;
    const h10 = 3 * t * t - 4 * t + 1;
    const h01 = -6 * t * t + 6 * t;
    const h11 = 3 * t * t - 2 * t;
    return h00 + h10 + h01 + h11;
}

/**
 * Catmull-Rom interpolation on a curve.
 * @param p0
 * @param p1
 * @param p2
 * @param p3
 * @param t
 */
export function catmullRomInterpolate(p0: number, p1: number, p2: number, p3: number, t: number): number {
    const v0 = (p2 - p0) * 0.5;
    const v1 = (p3 - p1) * 0.5;
    const t2 = t * t;
    const t3 = t * t2;
    return (2 * p1 - 2 * p2 + v0 + v1) * t3 + (-3 * p1 + 3 * p2 - 2 * v0 - v1) * t2 + v0 * t + p1;
}

// Bézier Curve formulii from http://en.wikipedia.org/wiki/B%C3%A9zier_curve

// Quad Bézier Functions

/**
 * Quad Bézier curve function b2p0
 *
 * @param t
 * @param p
 */
export function b2p0(t: number, p: number): number {
    const k = 1 - t;
    return k * k * p;

}

/**
 * Quad Bézier curve function b2p1
 * @param t
 * @param p
 */
export function b2p1(t: number, p: number): number {
    return 2 * (1 - t) * t * p;
}

/**
 * Quad Bézier curve function b2p2
 * @param t
 * @param p
 */
export function b2p2(t: number, p: number): number {
    return t * t * p;
}

/**
 * Quad Bézier curve function b2
 * @param t
 * @param p0
 * @param p1
 * @param p2
 */
export function b2(this: any, t: number, p0: number, p1: number, p2: number): number {
    return this.b2p0(t, p0) + this.b2p1(t, p1) + this.b2p2(t, p2);
}

// Cubic Bézier Functions

/**
 * Cubic Bézier curve function b3p0
 * @param t
 * @param p
 */
export function b3p0(t: number, p: number): number {
    const k = 1 - t;
    return k * k * k * p;
}

/**
 * Cubic Bézier curve function b3p1
 * @param t
 * @param p
 */
export function b3p1(t: number, p: number): number {
    const k = 1 - t;
    return 3 * k * k * t * p;
}

/**
 * Cubic Bézier curve function b3p2
 * @param t
 * @param p
 */
export function b3p2(t: number, p: number): number {
    const k = 1 - t;
    return 3 * k * t * t * p;
}

/**
 * Cubic Bézier curve function b3p3
 * @param t
 * @param p
 */
export function b3p3(t: number, p: number) {
    return t * t * t * p;
}

/**
 * Cubic Bézier curve function b3
 * @param t
 * @param p0
 * @param p1
 * @param p2
 * @param p3
 */
export function b3(this: any, t: number, p0: number, p1: number, p2: number, p3: number) {
    return this.b3p0(t, p0) + this.b3p1(t, p1) + this.b3p2(t, p2) + this.b3p3(t, p3);
}
