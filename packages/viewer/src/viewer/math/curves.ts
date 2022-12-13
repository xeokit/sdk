export function tangentQuadraticBezier(t: number, p0: number, p1: number, p2: number): number {
    return 2 * (1 - t) * (p1 - p0) + 2 * t * (p2 - p1);
}

export function tangentQuadraticBezier3(t: number, p0: number, p1: number, p2: number, p3: number): number {
    return -3 * p0 * (1 - t) * (1 - t) +
        3 * p1 * (1 - t) * (1 - t) - 6 * t * p1 * (1 - t) +
        6 * t * p2 * (1 - t) - 3 * t * t * p2 +
        3 * t * t * p3;
}

export function tangentSpline(t: number) {
    const h00 = 6 * t * t - 6 * t;
    const h10 = 3 * t * t - 4 * t + 1;
    const h01 = -6 * t * t + 6 * t;
    const h11 = 3 * t * t - 2 * t;
    return h00 + h10 + h01 + h11;
}

export function catmullRomInterpolate(p0: number, p1: number, p2: number, p3: number, t: number): number {
    const v0 = (p2 - p0) * 0.5;
    const v1 = (p3 - p1) * 0.5;
    const t2 = t * t;
    const t3 = t * t2;
    return (2 * p1 - 2 * p2 + v0 + v1) * t3 + (-3 * p1 + 3 * p2 - 2 * v0 - v1) * t2 + v0 * t + p1;
}

// Bezier Curve formulii from http://en.wikipedia.org/wiki/B%C3%A9zier_curve

// Quad Bezier Functions

export function b2p0(t: number, p: number): number {
    const k = 1 - t;
    return k * k * p;

}

export function b2p1(t: number, p: number): number {
    return 2 * (1 - t) * t * p;
}

export function b2p2(t: number, p: number): number {
    return t * t * p;
}

export function b2(this: any, t: number, p0: number, p1: number, p2: number): number {
    return this.b2p0(t, p0) + this.b2p1(t, p1) + this.b2p2(t, p2);
}

// Cubic Bezier Functions

export function b3p0(t: number, p: number): number {
    const k = 1 - t;
    return k * k * k * p;
}

export function b3p1(t: number, p: number): number {
    const k = 1 - t;
    return 3 * k * k * t * p;
}

export function b3p2(t: number, p: number): number {
    const k = 1 - t;
    return 3 * k * t * t * p;
}

export function b3p3(t: number, p: number) {
    return t * t * t * p;
}

export function b3(this: any, t: number, p0: number, p1: number, p2: number, p3: number) {
    return this.b3p0(t, p0) + this.b3p1(t, p1) + this.b3p2(t, p2) + this.b3p3(t, p3);
}