/**
 * [![npm version](https://badge.fury.io/js/%40xeokit%2Fmath.svg)](https://badge.fury.io/js/%40xeokit%2Fmath)
 * [![](https://data.jsdelivr.com/v1/package/npm/@xeokit/badge)](https://www.jsdelivr.com/package/npm/@xeokit/math)
 *
 * <img style="padding:0px; padding-top:20px; padding-bottom:30px; height:140px;" src="media://images/matrix_icon.png"/>
 *
 * # xeokit Matrix and Vector Math Library
 *
 * ---
 *
 * ### *Math functions for 3D/2D matrices, quaternions and vectors*
 *
 * ---
 *
 * ## Installation
 *
 * ````bash
 * npm install @xeokit/matrix
 * ````
 *
 * ## Usage
 *
 * ````javascript
 * import * as matrix from "@xeokit/matrix";
 *
 * //..
 * ````
 *
 * @module @xeokit/matrix
 */
import {clamp, DEGTORAD, type FloatArrayParam, newFloatArray} from "@xeokit/math";


const tempVec4a: FloatArrayParam = createVec4();
const tempVec3 = createVec3();
const tempVec3b = createVec3();
const tempVec3c = createVec3();
const tempVec3d = createVec3();
const tempVec3e = createVec3();
const tempVec4b = createVec4();

/**
 * Returns the dot product of two three-element vectors.
 */
export function dotVec3(u: FloatArrayParam, v: FloatArrayParam): number {
    return (u[0] * v[0] + u[1] * v[1] + u[2] * v[2]);
}

/**
 * Returns a new, uninitialized two-element vector.
 */
export function createVec2(values?: FloatArrayParam): FloatArrayParam {
    // @ts-ignore
    return new Float64Array(values || 2);
}

/**
 * Returns a new, uninitialized three-element vector.
 */
export function createVec3(values?: FloatArrayParam): Float64Array {
    // @ts-ignore
    return new Float64Array(values || 3);
}

/**
 * Returns a new, uninitialized four-element vector.
 */
export function createVec4(values?: FloatArrayParam): FloatArrayParam {
    // @ts-ignore
    return new Float64Array(values || 4);
}

/**
 * Negates a three-element vector.
 */
export function negateVec3(v: FloatArrayParam, dest?: FloatArrayParam): FloatArrayParam {
    if (!dest) {
        dest = v;
    }
    dest[0] = -v[0];
    dest[1] = -v[1];
    dest[2] = -v[2];
    return dest;
}

/**
 * Negates a four-element vector.
 */
export function negateVec4(v: FloatArrayParam, dest?: FloatArrayParam): FloatArrayParam {
    if (!dest) {
        dest = v;
    }
    dest[0] = -v[0];
    dest[1] = -v[1];
    dest[2] = -v[2];
    dest[3] = -v[3];
    return dest;
}

/**
 * Adds one four-element vector to another.
 */
export function addVec4(u: FloatArrayParam, v: FloatArrayParam, dest?: FloatArrayParam): FloatArrayParam {
    if (!dest) {
        dest = u;
    }
    dest[0] = u[0] + v[0];
    dest[1] = u[1] + v[1];
    dest[2] = u[2] + v[2];
    dest[3] = u[3] + v[3];
    return dest;
}

/**
 * Adds a scalar value to each element of a four-element vector.
 */
export function addVec4Scalar(v: FloatArrayParam, s: number, dest?: FloatArrayParam) {
    if (!dest) {
        dest = v;
    }
    dest[0] = v[0] + s;
    dest[1] = v[1] + s;
    dest[2] = v[2] + s;
    dest[3] = v[3] + s;
    return dest;
}

/**
 * Multiplies each element of a four-element vector by a scalar.
 */
export function mulVec4Scalar(v: FloatArrayParam, s: number, dest?: FloatArrayParam) {
    if (!dest) {
        dest = v;
    }
    dest[0] = v[0] * s;
    dest[1] = v[1] * s;
    dest[2] = v[2] * s;
    dest[3] = v[3] * s;
    return dest;
}

/**
 * Multiplies each element of a three-element vector by a scalar.
 */
export function mulVec3Scalar(v: FloatArrayParam, s: number, dest?: FloatArrayParam): FloatArrayParam {
    if (!dest) {
        dest = v;
    }
    dest[0] = v[0] * s;
    dest[1] = v[1] * s;
    dest[2] = v[2] * s;
    return dest;
}

/**
 * Multiplies each element of a two-element vector by a scalar.
 */
export function mulVec2Scalar(v: FloatArrayParam, s: number, dest?: FloatArrayParam): FloatArrayParam {
    if (!dest) {
        dest = v;
    }
    dest[0] = v[0] * s;
    dest[1] = v[1] * s;
    return dest;
}

/**
 * Adds one three-element vector to another.
 */
export function addVec3(u: FloatArrayParam, v: FloatArrayParam, dest?: FloatArrayParam): FloatArrayParam {
    if (!dest) {
        dest = u;
    }
    dest[0] = u[0] + v[0];
    dest[1] = u[1] + v[1];
    dest[2] = u[2] + v[2];
    return dest;
}

/**
 */
export function addVec3Scalar(v: FloatArrayParam, s: number, dest?: FloatArrayParam) {
    if (!dest) {
        dest = v;
    }
    dest[0] = v[0] + s;
    dest[1] = v[1] + s;
    dest[2] = v[2] + s;
    return dest;
}

/**
 * Subtracts one four-element vector from another.
 */
export function subVec4(u: FloatArrayParam, v: FloatArrayParam, dest?: FloatArrayParam) {
    if (!dest) {
        dest = u;
    }
    dest[0] = u[0] - v[0];
    dest[1] = u[1] - v[1];
    dest[2] = u[2] - v[2];
    dest[3] = u[3] - v[3];
    return dest;
}

/**
 * Returns true if the two 3-element vectors are the same.
 */
export function compareVec3(v1: FloatArrayParam, v2: FloatArrayParam): boolean {
    return (v1[0] === v2[0] && v1[1] === v2[1] && v1[2] === v2[2]);
}

/**
 * Subtracts one three-element vector from another.
 */
export function subVec3(u: FloatArrayParam, v: FloatArrayParam, dest?: FloatArrayParam) {
    if (!dest) {
        dest = u;
    }
    dest[0] = u[0] - v[0];
    dest[1] = u[1] - v[1];
    dest[2] = u[2] - v[2];
    return dest;
}

/**
 * Subtracts one two-element vector from another.
 */
export function subVec2(u: FloatArrayParam, v: FloatArrayParam, dest?: FloatArrayParam) {
    if (!dest) {
        dest = u;
    }
    dest[0] = u[0] - v[0];
    dest[1] = u[1] - v[1];
    return dest;
}

/**
 * Get the geometric mean of the vectors.
 */
export function geometricMeanVec2(...vectors: any) {
    const geometricMean = new Float32Array(vectors[0]);
    for (let i = 1; i < vectors.length; i++) {
        geometricMean[0] += vectors[i][0];
        geometricMean[1] += vectors[i][1];
    }
    geometricMean[0] /= vectors.length;
    geometricMean[1] /= vectors.length;
    return geometricMean;
}

/**
 * Subtracts a scalar value from each element of a four-element vector.
 */
export function subVec4Scalar(v: FloatArrayParam, s: number, dest?: FloatArrayParam) {
    if (!dest) {
        dest = v;
    }
    dest[0] = v[0] - s;
    dest[1] = v[1] - s;
    dest[2] = v[2] - s;
    dest[3] = v[3] - s;
    return dest;
}

/**
 * Sets each element of a 4-element vector to a scalar value minus the value of that element.
 * @method subScalarVec4
 * @static
 * @param {Array(Number)} v The vector
 * @param s The scalar
 * @param  {Array(Number)} [dest] Destination vector
 * @return {Array(Number)} dest if specified, v otherwise
 */
export function subScalarVec4(v: FloatArrayParam, s: number, dest?: FloatArrayParam) {
    if (!dest) {
        dest = v;
    }
    dest[0] = s - v[0];
    dest[1] = s - v[1];
    dest[2] = s - v[2];
    dest[3] = s - v[3];
    return dest;
}

/**
 * Multiplies one three-element vector by another.
 */
export function mulVec4(u: FloatArrayParam, v: FloatArrayParam, dest?: FloatArrayParam) {
    if (!dest) {
        dest = u;
    }
    dest[0] = u[0] * v[0];
    dest[1] = u[1] * v[1];
    dest[2] = u[2] * v[2];
    dest[3] = u[3] * v[3];
    return dest;
}


/**
 * Divides one three-element vector by another.
 */
export function divVec3(u: FloatArrayParam, v: FloatArrayParam, dest?: FloatArrayParam) {
    if (!dest) {
        dest = u;
    }
    dest[0] = u[0] / v[0];
    dest[1] = u[1] / v[1];
    dest[2] = u[2] / v[2];
    return dest;
}

/**
 * Divides one four-element vector by another.
 */
export function divVec4(u: FloatArrayParam, v: FloatArrayParam, dest?: FloatArrayParam) {
    if (!dest) {
        dest = u;
    }
    dest[0] = u[0] / v[0];
    dest[1] = u[1] / v[1];
    dest[2] = u[2] / v[2];
    dest[3] = u[3] / v[3];
    return dest;
}

/**
 * Divides a scalar by a three-element vector, returning a new vector.
 */
export function divScalarVec3(s: number, v: FloatArrayParam, dest?: FloatArrayParam) {
    if (!dest) {
        dest = v;
    }
    dest[0] = s / v[0];
    dest[1] = s / v[1];
    dest[2] = s / v[2];
    return dest;
}

/**
 * Divides a three-element vector by a scalar.
 */
export function divVec3Scalar(v: FloatArrayParam, s: number, dest?: FloatArrayParam) {
    if (!dest) {
        dest = v;
    }
    dest[0] = v[0] / s;
    dest[1] = v[1] / s;
    dest[2] = v[2] / s;
    return dest;
}

/**
 * Divides a four-element vector by a scalar.
 */
export function divVec4Scalar(v: FloatArrayParam, s: number, dest?: FloatArrayParam) {
    if (!dest) {
        dest = v;
    }
    dest[0] = v[0] / s;
    dest[1] = v[1] / s;
    dest[2] = v[2] / s;
    dest[3] = v[3] / s;
    return dest;
}

/**
 * Divides a scalar by a four-element vector, returning a new vector.
 */
export function divScalarVec4(s: number, v: FloatArrayParam, dest?: FloatArrayParam) {
    if (!dest) {
        dest = v;
    }
    dest[0] = s / v[0];
    dest[1] = s / v[1];
    dest[2] = s / v[2];
    dest[3] = s / v[3];
    return dest;
}

/**
 * Returns the dot product of two four-element vectors.
 */
export function dotVec4(u: FloatArrayParam, v: FloatArrayParam) {
    return (u[0] * v[0] + u[1] * v[1] + u[2] * v[2] + u[3] * v[3]);
}

/**
 * Returns the cross product of two four-element vectors.
 */
export function cross3Vec4(u: FloatArrayParam, v: FloatArrayParam) {
    const u0 = u[0];
    const u1 = u[1];
    const u2 = u[2];
    const v0 = v[0];
    const v1 = v[1];
    const v2 = v[2];
    return [
        u1 * v2 - u2 * v1,
        u2 * v0 - u0 * v2,
        u0 * v1 - u1 * v0,
        0.0];
}

/**
 * Returns the cross product of two three-element vectors.
 */
export function cross3Vec3(u: FloatArrayParam, v: FloatArrayParam, dest?: FloatArrayParam) {
    if (!dest) {
        dest = u;
    }
    const x = u[0];
    const y = u[1];
    const z = u[2];
    const x2 = v[0];
    const y2 = v[1];
    const z2 = v[2];
    dest[0] = y * z2 - z * y2;
    dest[1] = z * x2 - x * z2;
    dest[2] = x * y2 - y * x2;
    return dest;
}

export function sqLenVec4(v: FloatArrayParam) { // TODO
    return dotVec4(v, v);
}

/**
 * Returns the length of a four-element vector.
 * @method lenVec4
 * @static
 * @param {Array(Number)} v The vector
 * @return The length
 */
export function lenVec4(v: FloatArrayParam) {
    return Math.sqrt(sqLenVec4(v));
}


/**
 * Returns the dot product of two two-element vectors.
 */
export function dotVec2(u: FloatArrayParam, v: FloatArrayParam) {
    return (u[0] * v[0] + u[1] * v[1]);
}


export function sqLenVec3(v: FloatArrayParam) {
    return dotVec3(v, v);
}


export function sqLenVec2(v: FloatArrayParam) {
    return dotVec2(v, v);
}

/**
 * Returns the length of a three-element vector.
 */
export function lenVec3(v: FloatArrayParam): number {
    return Math.sqrt(sqLenVec3(v));
}

export const distVec3 = ((() => {
    const vec = createVec3();
    return (v: FloatArrayParam, w: FloatArrayParam) => lenVec3(subVec3(v, w, vec));
}))()

/**
 * Returns the length of a two-element vector.
 */
export function lenVec2(v: FloatArrayParam): number {
    return Math.sqrt(sqLenVec2(v));
}

/**
 * Linearly interpolates between two 3D vectors.
 */
export function lerpVec3(t: number, t1: number, t2: number, p1: FloatArrayParam, p2: FloatArrayParam, dest: any) {
    const result = dest || createVec3();
    const f = (t - t1) / (t2 - t1);
    result[0] = p1[0] + (f * (p2[0] - p1[0]));
    result[1] = p1[1] + (f * (p2[1] - p1[1]));
    result[2] = p1[2] + (f * (p2[2] - p1[2]));
    return result;
}

export const distVec2 = ((() => {
    const vec = createVec2();
    return (v: FloatArrayParam, w: FloatArrayParam) => lenVec2(subVec2(v, w, vec));
}))();

/**
 * @method rcpVec3
 * @static
 * @param v createVec3
 * @param dest createVec3 - optional destination
 * @return [] dest if specified, v otherwise
 *
 */
export function rcpVec3(v: FloatArrayParam, dest: FloatArrayParam) {
    return divScalarVec3(1.0, v, dest);
}

/**
 * Normalizes a four-element vector
 *
 */
export function normalizeVec4(v: FloatArrayParam, dest: FloatArrayParam) {
    const f = 1.0 / lenVec4(v);
    return mulVec4Scalar(v, f, dest);
}

/**
 * Normalizes a three-element vector
 * @method normalizeVec4
 * @static
 */
export function normalizeVec3(v: FloatArrayParam, dest?: FloatArrayParam) {
    const f = 1.0 / lenVec3(v);
    return mulVec3Scalar(v, f, dest);
}

/**
 * Normalizes a two-element vector
 */
export function normalizeVec2(v: FloatArrayParam, dest: FloatArrayParam) {
    const f = 1.0 / lenVec2(v);
    return mulVec2Scalar(v, f, dest);
}

/**
 * Gets the angle between two vectors
 */
export function angleVec3(v: FloatArrayParam, w: FloatArrayParam) {
    let theta = dotVec3(v, w) / (Math.sqrt(sqLenVec3(v) * sqLenVec3(w)));
    theta = theta < -1 ? -1 : (theta > 1 ? 1 : theta);  // Clamp to handle numerical problems
    return Math.acos(theta);
}

/**
 * Creates a three-element vector from the rotation part of a sixteen-element matrix.
 */
export const vec3FromMat4Scale: Function = ((() => {

    const tempVec3 = createVec3();

    return function (m: FloatArrayParam, dest: FloatArrayParam) {

        tempVec3[0] = m[0];
        tempVec3[1] = m[1];
        tempVec3[2] = m[2];

        dest[0] = lenVec3(tempVec3);

        tempVec3[0] = m[4];
        tempVec3[1] = m[5];
        tempVec3[2] = m[6];

        dest[1] = lenVec3(tempVec3);

        tempVec3[0] = m[8];
        tempVec3[1] = m[9];
        tempVec3[2] = m[10];

        dest[2] = lenVec3(tempVec3);

        return dest;
    };
}))();

/**
 * Converts an n-element vector to a JSON-serializable
 * array with values rounded to two decimal places.
 */
export function vecToArray(v: FloatArrayParam): FloatArrayParam {
    v = Array.prototype.slice.call(v);
    for (let i = 0, len = v.length; i < len; i++) {
        v[i] = trunc(v[i]);
    }
    return v;
}

function trunc(v: number) {
    return Math.round(v * 100000) / 100000
}


/**
 * Calculates the normal vector of a triangle.
 */
export function triangleNormal(a: FloatArrayParam, b: FloatArrayParam, c: FloatArrayParam, normal: FloatArrayParam = createVec3()): FloatArrayParam {
    const p1x = b[0] - a[0];
    const p1y = b[1] - a[1];
    const p1z = b[2] - a[2];

    const p2x = c[0] - a[0];
    const p2y = c[1] - a[1];
    const p2z = c[2] - a[2];

    const p3x = p1y * p2z - p1z * p2y;
    const p3y = p1z * p2x - p1x * p2z;
    const p3z = p1x * p2y - p1y * p2x;

    const mag = Math.sqrt(p3x * p3x + p3y * p3y + p3z * p3z);
    if (mag === 0) {
        normal[0] = 0;
        normal[1] = 0;
        normal[2] = 0;
    } else {
        normal[0] = p3x / mag;
        normal[1] = p3y / mag;
        normal[2] = p3z / mag;
    }

    return normal
}


/**
 * Returns a new, uninitialized 3x3 matrix.
 */
export function createMat3(values?: FloatArrayParam): FloatArrayParam {
    // @ts-ignore
    return new newFloatArray(values || 9);
}

/**
 * Converts a 3x3 matrix to 4x4.
 */
export function mat3ToMat4(mat3: FloatArrayParam, mat4?: FloatArrayParam): FloatArrayParam {
    if (!mat4) {
        mat4 = createMat4();
    }
    mat4[0] = mat3[0];
    mat4[1] = mat3[1];
    mat4[2] = mat3[2];
    mat4[3] = 0;
    mat4[4] = mat3[3];
    mat4[5] = mat3[4];
    mat4[6] = mat3[5];
    mat4[7] = 0;
    mat4[8] = mat3[6];
    mat4[9] = mat3[7];
    mat4[10] = mat3[8];
    mat4[11] = 0;
    mat4[12] = 0;
    mat4[13] = 0;
    mat4[14] = 0;
    mat4[15] = 1;
    return mat4;
}

/**
 * Returns a new, uninitialized 4x4 matrix.
 */
export function createMat4(values?: FloatArrayParam): FloatArrayParam {
    // @ts-ignore
    return new Float64Array(values || 16);
}

const tempMat4a = createMat4();
const tempMat4b = createMat4();

/**
 * Returns true if the two 4x4 matrices are the same.
 * @param m1
 * @param m2
 * @returns {boolean}
 */
export function compareMat4(m1: FloatArrayParam, m2: FloatArrayParam): boolean {
    return m1[0] === m2[0] &&
        m1[1] === m2[1] &&
        m1[2] === m2[2] &&
        m1[3] === m2[3] &&
        m1[4] === m2[4] &&
        m1[5] === m2[5] &&
        m1[6] === m2[6] &&
        m1[7] === m2[7] &&
        m1[8] === m2[8] &&
        m1[9] === m2[9] &&
        m1[10] === m2[10] &&
        m1[11] === m2[11] &&
        m1[12] === m2[12] &&
        m1[13] === m2[13] &&
        m1[14] === m2[14] &&
        m1[15] === m2[15];
}

/**
 * Returns a 4x4 perspective projection matrix.
 */
export function perspectiveMat4(fovyrad: number, aspectratio: number, znear: number, zfar: number, m?: FloatArrayParam): FloatArrayParam {
    const pmin = [];
    const pmax = [];
    pmin[2] = znear;
    pmax[2] = zfar;
    pmax[1] = pmin[2] * Math.tan(fovyrad / 2.0);
    pmin[1] = -pmax[1];
    pmax[0] = pmax[1] * aspectratio;
    pmin[0] = -pmax[0];
    return frustumMat4v(pmin, pmax, m);
}

/**
 * Returns a 4x4 perspective frustum projection matrix.
 */
export function frustumMat4v(fmin: FloatArrayParam, fmax: FloatArrayParam, m?: FloatArrayParam): FloatArrayParam {
    if (!m) {
        m = createMat4();
    }
    const fmin4 = [fmin[0], fmin[1], fmin[2], 0.0];
    const fmax4 = [fmax[0], fmax[1], fmax[2], 0.0];
    addVec4(fmax4, fmin4, tempMat4a);
    subVec4(fmax4, fmin4, tempMat4b);
    const t = 2.0 * fmin4[2];
    const tempMat4b0 = tempMat4b[0];
    const tempMat4b1 = tempMat4b[1];
    const tempMat4b2 = tempMat4b[2];
    m[0] = t / tempMat4b0;
    m[1] = 0.0;
    m[2] = 0.0;
    m[3] = 0.0;
    m[4] = 0.0;
    m[5] = t / tempMat4b1;
    m[6] = 0.0;
    m[7] = 0.0;
    m[8] = tempMat4a[0] / tempMat4b0;
    m[9] = tempMat4a[1] / tempMat4b1;
    m[10] = -tempMat4a[2] / tempMat4b2;
    m[11] = -1.0;
    m[12] = 0.0;
    m[13] = 0.0;
    m[14] = -t * fmax4[2] / tempMat4b2;
    m[15] = 0.0;
    return m;
}

/**
 * Returns a 4x4 orthographic projection matrix.
 */
export function orthoMat4c(
    left: number,
    right: number,
    bottom: number,
    top: number,
    near: number,
    far: number,
    dest?: FloatArrayParam): FloatArrayParam {
    if (!dest) {
        dest = createMat4();
    }
    const rl = (right - left);
    const tb = (top - bottom);
    const fn = (far - near);
    dest[0] = 2.0 / rl;
    dest[1] = 0.0;
    dest[2] = 0.0;
    dest[3] = 0.0;
    dest[4] = 0.0;
    dest[5] = 2.0 / tb;
    dest[6] = 0.0;
    dest[7] = 0.0;
    dest[8] = 0.0;
    dest[9] = 0.0;
    dest[10] = -2.0 / fn;
    dest[11] = 0.0;
    dest[12] = -(left + right) / rl;
    dest[13] = -(top + bottom) / tb;
    dest[14] = -(far + near) / fn;
    dest[15] = 1.0;
    return dest;
}

/**
 * Returns a 4x4 perspective projection matrix.
 */
export function frustumMat4(
    left: number,
    right: number,
    bottom: number,
    top: number,
    near: number,
    far: number,
    dest?: FloatArrayParam): FloatArrayParam {
    if (!dest) {
        dest = createMat4();
    }
    const rl = (right - left);
    const tb = (top - bottom);
    const fn = (far - near);
    dest[0] = (near * 2) / rl;
    dest[1] = 0;
    dest[2] = 0;
    dest[3] = 0;
    dest[4] = 0;
    dest[5] = (near * 2) / tb;
    dest[6] = 0;
    dest[7] = 0;
    dest[8] = (right + left) / rl;
    dest[9] = (top + bottom) / tb;
    dest[10] = -(far + near) / fn;
    dest[11] = -1;
    dest[12] = 0;
    dest[13] = 0;
    dest[14] = -(far * near * 2) / fn;
    dest[15] = 0;
    return dest;
}


/**
 * Returns a 4x4 identity matrix.
 */
export function identityMat4(dest?: FloatArrayParam): FloatArrayParam {
    if (!dest) {
        dest = createMat4();
    }
    dest[0] = 1.0;
    dest[1] = 0.0;
    dest[2] = 0.0;
    dest[3] = 0.0;
    dest[4] = 0.0;
    dest[5] = 1.0;
    dest[6] = 0.0;
    dest[7] = 0.0;
    dest[8] = 0.0;
    dest[9] = 0.0;
    dest[10] = 1.0;
    dest[11] = 0.0;
    dest[12] = 0.0;
    dest[13] = 0.0;
    dest[14] = 0.0;
    dest[15] = 1.0;
    return dest;
}

/**
 * Returns a 3x3 identity matrix.
 */
export function identityMat3(dest?: FloatArrayParam): FloatArrayParam {
    if (!dest) {
        dest = createMat4();
    }
    dest[0] = 1.0;
    dest[1] = 0.0;
    dest[2] = 0.0;
    dest[3] = 0.0;
    dest[4] = 1.0;
    dest[5] = 0.0;
    dest[6] = 0.0;
    dest[7] = 0.0;
    dest[8] = 1.0;
    return dest;
}

/**
 * Tests if the given 4x4 matrix is the identity matrix.
 */
export function isIdentityMat4(m: FloatArrayParam): boolean {
    if (m[0] !== 1.0 || m[1] !== 0.0 || m[2] !== 0.0 || m[3] !== 0.0 ||
        m[4] !== 0.0 || m[5] !== 1.0 || m[6] !== 0.0 || m[7] !== 0.0 ||
        m[8] !== 0.0 || m[9] !== 0.0 || m[10] !== 1.0 || m[11] !== 0.0 ||
        m[12] !== 0.0 || m[13] !== 0.0 || m[14] !== 0.0 || m[15] !== 1.0) {
        return false;
    }
    return true;
}

/**
 * Creates a 4x4 rotation matrix.
 */
export function rotationMat4v(anglerad: number, axis: FloatArrayParam, m?: FloatArrayParam): FloatArrayParam {
    if (!m) {
        m = createMat4();
    }
    const ax = normalizeVec4([axis[0], axis[1], axis[2], 0.0], []);
    const s = Math.sin(anglerad);
    const c = Math.cos(anglerad);
    const q = 1.0 - c;
    const x = ax[0];
    const y = ax[1];
    const z = ax[2];
    let xy;
    let yz;
    let zx;
    let xs;
    let ys;
    let zs;
    xy = x * y;
    yz = y * z;
    zx = z * x;
    xs = x * s;
    ys = y * s;
    zs = z * s;
    m[0] = (q * x * x) + c;
    m[1] = (q * xy) + zs;
    m[2] = (q * zx) - ys;
    m[3] = 0.0;
    m[4] = (q * xy) - zs;
    m[5] = (q * y * y) + c;
    m[6] = (q * yz) + xs;
    m[7] = 0.0;
    m[8] = (q * zx) + ys;
    m[9] = (q * yz) - xs;
    m[10] = (q * z * z) + c;
    m[11] = 0.0;
    m[12] = 0.0;
    m[13] = 0.0;
    m[14] = 0.0;
    m[15] = 1.0;
    return m;
}

/**
 * Creates a 4x4 'lookat' viewing transform matrix.
 */
export function lookAtMat4v(pos: FloatArrayParam, target: FloatArrayParam, up: FloatArrayParam, dest?: FloatArrayParam): FloatArrayParam {
    if (!dest) {
        dest = createMat4();
    }
    const posx = pos[0];
    const posy = pos[1];
    const posz = pos[2];
    const upx = up[0];
    const upy = up[1];
    const upz = up[2];
    const targetx = target[0];
    const targety = target[1];
    const targetz = target[2];
    if (posx === targetx && posy === targety && posz === targetz) {
        return identityMat4();
    }
    let z0;
    let z1;
    let z2;
    let x0;
    let x1;
    let x2;
    let y0;
    let y1;
    let y2;
    let len;
    //createVec3.direction(eye, center, z);
    z0 = posx - targetx;
    z1 = posy - targety;
    z2 = posz - targetz;
    // normalize (no check needed for 0 because of early return)
    len = 1 / Math.sqrt(z0 * z0 + z1 * z1 + z2 * z2);
    z0 *= len;
    z1 *= len;
    z2 *= len;
    //createVec3.normalize(createVec3.cross(up, z, x));
    x0 = upy * z2 - upz * z1;
    x1 = upz * z0 - upx * z2;
    x2 = upx * z1 - upy * z0;
    len = Math.sqrt(x0 * x0 + x1 * x1 + x2 * x2);
    if (!len) {
        x0 = 0;
        x1 = 0;
        x2 = 0;
    } else {
        len = 1 / len;
        x0 *= len;
        x1 *= len;
        x2 *= len;
    }
    //createVec3.normalize(createVec3.cross(z, x, y));
    y0 = z1 * x2 - z2 * x1;
    y1 = z2 * x0 - z0 * x2;
    y2 = z0 * x1 - z1 * x0;
    len = Math.sqrt(y0 * y0 + y1 * y1 + y2 * y2);
    if (!len) {
        y0 = 0;
        y1 = 0;
        y2 = 0;
    } else {
        len = 1 / len;
        y0 *= len;
        y1 *= len;
        y2 *= len;
    }
    dest[0] = x0;
    dest[1] = y0;
    dest[2] = z0;
    dest[3] = 0;
    dest[4] = x1;
    dest[5] = y1;
    dest[6] = z1;
    dest[7] = 0;
    dest[8] = x2;
    dest[9] = y2;
    dest[10] = z2;
    dest[11] = 0;
    dest[12] = -(x0 * posx + x1 * posy + x2 * posz);
    dest[13] = -(y0 * posx + y1 * posy + y2 * posz);
    dest[14] = -(z0 * posx + z1 * posy + z2 * posz);
    dest[15] = 1;
    return dest;
}

/**
 * Returns the inverse of the given 4x4 matrix.
 */
export function inverseMat4(mat: FloatArrayParam, dest?: FloatArrayParam): FloatArrayParam {
    if (!dest) {
        dest = mat;
    }
    const a00 = mat[0];
    const a01 = mat[1];
    const a02 = mat[2];
    const a03 = mat[3];
    const a10 = mat[4];
    const a11 = mat[5];
    const a12 = mat[6];
    const a13 = mat[7];
    const a20 = mat[8];
    const a21 = mat[9];
    const a22 = mat[10];
    const a23 = mat[11];
    const a30 = mat[12];
    const a31 = mat[13];
    const a32 = mat[14];
    const a33 = mat[15];
    const b00 = a00 * a11 - a01 * a10;
    const b01 = a00 * a12 - a02 * a10;
    const b02 = a00 * a13 - a03 * a10;
    const b03 = a01 * a12 - a02 * a11;
    const b04 = a01 * a13 - a03 * a11;
    const b05 = a02 * a13 - a03 * a12;
    const b06 = a20 * a31 - a21 * a30;
    const b07 = a20 * a32 - a22 * a30;
    const b08 = a20 * a33 - a23 * a30;
    const b09 = a21 * a32 - a22 * a31;
    const b10 = a21 * a33 - a23 * a31;
    const b11 = a22 * a33 - a23 * a32;
    const invDet = 1 / (b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06);
    dest[0] = (a11 * b11 - a12 * b10 + a13 * b09) * invDet;
    dest[1] = (-a01 * b11 + a02 * b10 - a03 * b09) * invDet;
    dest[2] = (a31 * b05 - a32 * b04 + a33 * b03) * invDet;
    dest[3] = (-a21 * b05 + a22 * b04 - a23 * b03) * invDet;
    dest[4] = (-a10 * b11 + a12 * b08 - a13 * b07) * invDet;
    dest[5] = (a00 * b11 - a02 * b08 + a03 * b07) * invDet;
    dest[6] = (-a30 * b05 + a32 * b02 - a33 * b01) * invDet;
    dest[7] = (a20 * b05 - a22 * b02 + a23 * b01) * invDet;
    dest[8] = (a10 * b10 - a11 * b08 + a13 * b06) * invDet;
    dest[9] = (-a00 * b10 + a01 * b08 - a03 * b06) * invDet;
    dest[10] = (a30 * b04 - a31 * b02 + a33 * b00) * invDet;
    dest[11] = (-a20 * b04 + a21 * b02 - a23 * b00) * invDet;
    dest[12] = (-a10 * b09 + a11 * b07 - a12 * b06) * invDet;
    dest[13] = (a00 * b09 - a01 * b07 + a02 * b06) * invDet;
    dest[14] = (-a30 * b03 + a31 * b01 - a32 * b00) * invDet;
    dest[15] = (a20 * b03 - a21 * b01 + a22 * b00) * invDet;
    return dest;
}

/**
 * Transposes the given 4x4 matrix.
 */
export function transposeMat4(mat: FloatArrayParam, dest?: FloatArrayParam): FloatArrayParam {
    const m4 = mat[4];
    const m14 = mat[14];
    const m8 = mat[8];
    const m13 = mat[13];
    const m12 = mat[12];
    const m9 = mat[9];
    if (!dest || mat === dest) {
        const a01 = mat[1];
        const a02 = mat[2];
        const a03 = mat[3];
        const a12 = mat[6];
        const a13 = mat[7];
        const a23 = mat[11];
        mat[1] = m4;
        mat[2] = m8;
        mat[3] = m12;
        mat[4] = a01;
        mat[6] = m9;
        mat[7] = m13;
        mat[8] = a02;
        mat[9] = a12;
        mat[11] = m14;
        mat[12] = a03;
        mat[13] = a13;
        mat[14] = a23;
        return mat;
    }
    dest[0] = mat[0];
    dest[1] = m4;
    dest[2] = m8;
    dest[3] = m12;
    dest[4] = mat[1];
    dest[5] = mat[5];
    dest[6] = m9;
    dest[7] = m13;
    dest[8] = mat[2];
    dest[9] = mat[6];
    dest[10] = mat[10];
    dest[11] = m14;
    dest[12] = mat[3];
    dest[13] = mat[7];
    dest[14] = mat[11];
    dest[15] = mat[15];
    return dest;
}

/**
 * Multiplies the given 4x4 matrix by the given four-element vector.
 */
export function mulMat4v4(m: FloatArrayParam, v: FloatArrayParam, dest?: FloatArrayParam): FloatArrayParam {
    if (!dest) {
        dest = m;
    }
    const v0 = v[0];
    const v1 = v[1];
    const v2 = v[2];
    const v3 = v[3];
    dest[0] = m[0] * v0 + m[4] * v1 + m[8] * v2 + m[12] * v3;
    dest[1] = m[1] * v0 + m[5] * v1 + m[9] * v2 + m[13] * v3;
    dest[2] = m[2] * v0 + m[6] * v1 + m[10] * v2 + m[14] * v3;
    dest[3] = m[3] * v0 + m[7] * v1 + m[11] * v2 + m[15] * v3;
    return dest;
}

/**
 * Multiplies the two given 4x4 matrix by each other.
 * @method mulMat4
 * @static
 */
export function mulMat4(a: FloatArrayParam, b: FloatArrayParam, dest?: FloatArrayParam): FloatArrayParam {
    if (!dest) {
        dest = a;
    }
    const a00 = a[0];
    const a01 = a[1];
    const a02 = a[2];
    const a03 = a[3];
    const a10 = a[4];
    const a11 = a[5];
    const a12 = a[6];
    const a13 = a[7];
    const a20 = a[8];
    const a21 = a[9];
    const a22 = a[10];
    const a23 = a[11];
    const a30 = a[12];
    const a31 = a[13];
    const a32 = a[14];
    const a33 = a[15];
    const b00 = b[0];
    const b01 = b[1];
    const b02 = b[2];
    const b03 = b[3];
    const b10 = b[4];
    const b11 = b[5];
    const b12 = b[6];
    const b13 = b[7];
    const b20 = b[8];
    const b21 = b[9];
    const b22 = b[10];
    const b23 = b[11];
    const b30 = b[12];
    const b31 = b[13];
    const b32 = b[14];
    const b33 = b[15];
    dest[0] = b00 * a00 + b01 * a10 + b02 * a20 + b03 * a30;
    dest[1] = b00 * a01 + b01 * a11 + b02 * a21 + b03 * a31;
    dest[2] = b00 * a02 + b01 * a12 + b02 * a22 + b03 * a32;
    dest[3] = b00 * a03 + b01 * a13 + b02 * a23 + b03 * a33;
    dest[4] = b10 * a00 + b11 * a10 + b12 * a20 + b13 * a30;
    dest[5] = b10 * a01 + b11 * a11 + b12 * a21 + b13 * a31;
    dest[6] = b10 * a02 + b11 * a12 + b12 * a22 + b13 * a32;
    dest[7] = b10 * a03 + b11 * a13 + b12 * a23 + b13 * a33;
    dest[8] = b20 * a00 + b21 * a10 + b22 * a20 + b23 * a30;
    dest[9] = b20 * a01 + b21 * a11 + b22 * a21 + b23 * a31;
    dest[10] = b20 * a02 + b21 * a12 + b22 * a22 + b23 * a32;
    dest[11] = b20 * a03 + b21 * a13 + b22 * a23 + b23 * a33;
    dest[12] = b30 * a00 + b31 * a10 + b32 * a20 + b33 * a30;
    dest[13] = b30 * a01 + b31 * a11 + b32 * a21 + b33 * a31;
    dest[14] = b30 * a02 + b31 * a12 + b32 * a22 + b33 * a32;
    dest[15] = b30 * a03 + b31 * a13 + b32 * a23 + b33 * a33;
    return dest;
}

/**
 * Multiplies the two given 3x3 matrices by each other.
 */
export function mulMat3(a: FloatArrayParam, b: FloatArrayParam, dest: FloatArrayParam = newFloatArray(9)) {

    const a11 = a[0];
    const a12 = a[3];
    const a13 = a[6];
    const a21 = a[1];
    const a22 = a[4];
    const a23 = a[7];
    const a31 = a[2];
    const a32 = a[5];
    const a33 = a[8];
    const b11 = b[0];
    const b12 = b[3];
    const b13 = b[6];
    const b21 = b[1];
    const b22 = b[4];
    const b23 = b[7];
    const b31 = b[2];
    const b32 = b[5];
    const b33 = b[8];

    dest[0] = a11 * b11 + a12 * b21 + a13 * b31;
    dest[3] = a11 * b12 + a12 * b22 + a13 * b32;
    dest[6] = a11 * b13 + a12 * b23 + a13 * b33;

    dest[1] = a21 * b11 + a22 * b21 + a23 * b31;
    dest[4] = a21 * b12 + a22 * b22 + a23 * b32;
    dest[7] = a21 * b13 + a22 * b23 + a23 * b33;

    dest[2] = a31 * b11 + a32 * b21 + a33 * b31;
    dest[5] = a31 * b12 + a32 * b22 + a33 * b32;
    dest[8] = a31 * b13 + a32 * b23 + a33 * b33;

    return dest;
}

/**
 * Transforms a three-element position by a 4x4 matrix.
 * @method transformPoint3
 * @static
 */
export function transformPoint3(m: FloatArrayParam, p: FloatArrayParam, dest?: FloatArrayParam) {
    if (!dest) {
        dest = p;
    }
    const x = p[0];
    const y = p[1];
    const z = p[2];
    dest[0] = (m[0] * x) + (m[4] * y) + (m[8] * z) + m[12];
    dest[1] = (m[1] * x) + (m[5] * y) + (m[9] * z) + m[13];
    dest[2] = (m[2] * x) + (m[6] * y) + (m[10] * z) + m[14];
    return dest;
}

/**
 * Transforms a homogeneous coordinate by a 4x4 matrix.
 * @method transformPoint3
 * @static
 */
export function transformPoint4(m: FloatArrayParam, v: FloatArrayParam, dest: FloatArrayParam) {
    dest[0] = m[0] * v[0] + m[4] * v[1] + m[8] * v[2] + m[12] * v[3];
    dest[1] = m[1] * v[0] + m[5] * v[1] + m[9] * v[2] + m[13] * v[3];
    dest[2] = m[2] * v[0] + m[6] * v[1] + m[10] * v[2] + m[14] * v[3];
    dest[3] = m[3] * v[0] + m[7] * v[1] + m[11] * v[2] + m[15] * v[3];
    return dest;
}


/**
 * Transforms an array of three-element positions by a 4x4 matrix.
 * @method transformPoints3
 * @static
 */
export function transformPoints3(m: FloatArrayParam, points: number[][], points2: number[][]) {
    const result = points2 || [];
    const len = points.length;
    let p0;
    let p1;
    let p2;
    let pi;

    // cache values
    const m0 = m[0];

    const m1 = m[1];
    const m2 = m[2];
    const m3 = m[3];
    const m4 = m[4];
    const m5 = m[5];
    const m6 = m[6];
    const m7 = m[7];
    const m8 = m[8];
    const m9 = m[9];
    const m10 = m[10];
    const m11 = m[11];
    const m12 = m[12];
    const m13 = m[13];
    const m14 = m[14];
    const m15 = m[15];

    let r;

    for (let i = 0; i < len; ++i) {

        // cache values
        pi = points[i];

        p0 = pi[0];
        p1 = pi[1];
        p2 = pi[2];

        r = result[i] || (result[i] = [0, 0, 0]);

        r[0] = (m0 * p0) + (m4 * p1) + (m8 * p2) + m12;
        r[1] = (m1 * p0) + (m5 * p1) + (m9 * p2) + m13;
        r[2] = (m2 * p0) + (m6 * p1) + (m10 * p2) + m14;
        r[3] = (m3 * p0) + (m7 * p1) + (m11 * p2) + m15;
    }

    result.length = len;

    return result;
}

/**
 * Transforms an array of positions by a 4x4 matrix.
 */
export function transformPositions3(m: FloatArrayParam, p: FloatArrayParam, p2?: FloatArrayParam) {
    if (!p2) {
        p2 = p;
    }
    let i;
    const len = p.length;

    let x;
    let y;
    let z;

    const m0 = m[0];
    const m1 = m[1];
    const m2 = m[2];
    const m3 = m[3];
    const m4 = m[4];
    const m5 = m[5];
    const m6 = m[6];
    const m7 = m[7];
    const m8 = m[8];
    const m9 = m[9];
    const m10 = m[10];
    const m11 = m[11];
    const m12 = m[12];
    const m13 = m[13];
    const m14 = m[14];
    const m15 = m[15];

    for (i = 0; i < len; i += 3) {

        x = p[i + 0];
        y = p[i + 1];
        z = p[i + 2];

        p2[i + 0] = (m0 * x) + (m4 * y) + (m8 * z) + m12;
        p2[i + 1] = (m1 * x) + (m5 * y) + (m9 * z) + m13;
        p2[i + 2] = (m2 * x) + (m6 * y) + (m10 * z) + m14;
        p2[i + 3] = (m3 * x) + (m7 * y) + (m11 * z) + m15;
    }

    return p2;
}

/**
 * Transforms an array of positions by a 4x4 matrix.
 */
export function transformPositions4(m: FloatArrayParam, p: FloatArrayParam, p2?: FloatArrayParam) {
    if (!p2) {
        p2 = p;
    }
    let i;
    const len = p.length;
    let x;
    let y;
    let z;
    const m0 = m[0];
    const m1 = m[1];
    const m2 = m[2];
    const m3 = m[3];
    const m4 = m[4];
    const m5 = m[5];
    const m6 = m[6];
    const m7 = m[7];
    const m8 = m[8];
    const m9 = m[9];
    const m10 = m[10];
    const m11 = m[11];
    const m12 = m[12];
    const m13 = m[13];
    const m14 = m[14];
    const m15 = m[15];
    for (i = 0; i < len; i += 4) {
        x = p[i + 0];
        y = p[i + 1];
        z = p[i + 2];
        p2[i + 0] = (m0 * x) + (m4 * y) + (m8 * z) + m12;
        p2[i + 1] = (m1 * x) + (m5 * y) + (m9 * z) + m13;
        p2[i + 2] = (m2 * x) + (m6 * y) + (m10 * z) + m14;
        p2[i + 3] = (m3 * x) + (m7 * y) + (m11 * z) + m15;
    }
    return p2;
}

/**
 * Transforms a three-element vector by a 4x4 matrix.
 */
export function transformVec3(m: FloatArrayParam, v: FloatArrayParam, dest?: FloatArrayParam) {
    const v0 = v[0];
    const v1 = v[1];
    const v2 = v[2];
    dest = dest || createVec3();
    dest[0] = (m[0] * v0) + (m[4] * v1) + (m[8] * v2);
    dest[1] = (m[1] * v0) + (m[5] * v1) + (m[9] * v2);
    dest[2] = (m[2] * v0) + (m[6] * v1) + (m[10] * v2);
    return dest;
}

/**
 * Transforms a four-element vector by a 4x4 matrix.
 * @method transformVec4
 * @static
 */
export function transformVec4(m: FloatArrayParam, v: FloatArrayParam, dest?: FloatArrayParam) {
    const v0 = v[0];
    const v1 = v[1];
    const v2 = v[2];
    const v3 = v[3];
    dest = dest || createVec4();
    dest[0] = m[0] * v0 + m[4] * v1 + m[8] * v2 + m[12] * v3;
    dest[1] = m[1] * v0 + m[5] * v1 + m[9] * v2 + m[13] * v3;
    dest[2] = m[2] * v0 + m[6] * v1 + m[10] * v2 + m[14] * v3;
    dest[3] = m[3] * v0 + m[7] * v1 + m[11] * v2 + m[15] * v3;
    return dest;
}


/**
 * Efficiently post-concatenates a scaling to the given matrix.
 */
export function scaleMat4v(xyz: FloatArrayParam, m: FloatArrayParam = identityMat4()) {
    const x = xyz[0];
    const y = xyz[1];
    const z = xyz[2];
    m[0] *= x;
    m[4] *= y;
    m[8] *= z;
    m[1] *= x;
    m[5] *= y;
    m[9] *= z;
    m[2] *= x;
    m[6] *= y;
    m[10] *= z;
    m[3] *= x;
    m[7] *= y;
    m[11] *= z;
    return m;
}

/**
 */
export function scalingMat4v(v: FloatArrayParam, m: FloatArrayParam = identityMat4()): FloatArrayParam {
    m[0] = v[0];
    m[5] = v[1];
    m[10] = v[2];
    return m;
}

/**
 * Returns a 3x3 scale matrix.
 */
export function scalingMat3v(v: FloatArrayParam, m: FloatArrayParam = identityMat3()): FloatArrayParam {
    m[0] = v[0];
    m[4] = v[1];
    return m;
}

/**
 * Returns a 4x4 scale matrix.
 */
export const scalingMat4c = ((() => {
    const xyz: FloatArrayParam = newFloatArray(3);
    return (x: number, y: number, z: number, dest?: FloatArrayParam) => {
        xyz[0] = x;
        xyz[1] = y;
        xyz[2] = z;
        return scalingMat4v(xyz, dest);
    };
}))()

/**
 * Efficiently post-concatenates a scaling to the given matrix.
 * @method scaleMat4c
 * @param x
 * @param y
 * @param z
 * @param m
 */
export function scaleMat4c(x: number, y: number, z: number, m: FloatArrayParam): FloatArrayParam {

    m[0] *= x;
    m[4] *= y;
    m[8] *= z;

    m[1] *= x;
    m[5] *= y;
    m[9] *= z;

    m[2] *= x;
    m[6] *= y;
    m[10] *= z;

    m[3] *= x;
    m[7] *= y;
    m[11] *= z;
    return m;
}

/**
 * Returns 4x4 scale matrix.
 */
export function scalingMat4s(s: number): FloatArrayParam {
    return scalingMat4c(s, s, s);
}

/**
 * Composes a 4x4 matrix from the given position, quaternion and scale.
 * @param position
 * @param quaternion
 * @param scale
 * @param mat
 */
export function composeMat4(
    position: FloatArrayParam,
    quaternion: FloatArrayParam,
    scale: FloatArrayParam,
    mat: FloatArrayParam = createMat4()): FloatArrayParam {
    quatToRotationMat4(quaternion, mat);
    scaleMat4v(scale, mat);
    translateMat4v(position, mat);
    return mat;
}

/**
 * Composes a 4x4 matrix from the given position, euler rotation angles and scale.
 * @param position
 * @param rotation
 * @param scale
 * @param mat
 */
export function composeMat4Euler(
    position: FloatArrayParam,
    rotation: FloatArrayParam,
    scale: FloatArrayParam,
    mat: FloatArrayParam = createMat4()): FloatArrayParam {
    quatToRotationMat4(eulerToQuat(rotation, "XYZ", identityQuat()), mat);
    scaleMat4v(scale, mat);
    translateMat4v(position, mat);
    return mat;
}

/**
 * Decomposes a 4x4 matrix into position, quaternion and scale.
 */
export const decomposeMat4 = (() => {
    const vec = createVec3();
    const matrix = createMat4();
    return function decompose(mat: FloatArrayParam, position: FloatArrayParam, quaternion: FloatArrayParam, scale: FloatArrayParam) {
        vec[0] = mat[0];
        vec[1] = mat[1];
        vec[2] = mat[2];
        let sx = lenVec3(vec);
        vec[0] = mat[4];
        vec[1] = mat[5];
        vec[2] = mat[6];
        const sy = lenVec3(vec);
        vec[8] = mat[8];
        vec[9] = mat[9];
        vec[10] = mat[10];
        const sz = lenVec3(vec);
        const det = determinantMat4(mat);
        if (det < 0) {
            sx = -sx;
        }
        position[0] = mat[12];
        position[1] = mat[13];
        position[2] = mat[14];
        // scale the rotation part
        // @ts-ignore
        matrix.set(mat);
        const invSX = 1 / sx;
        const invSY = 1 / sy;
        const invSZ = 1 / sz;
        matrix[0] *= invSX;
        matrix[1] *= invSX;
        matrix[2] *= invSX;
        matrix[4] *= invSY;
        matrix[5] *= invSY;
        matrix[6] *= invSY;
        matrix[8] *= invSZ;
        matrix[9] *= invSZ;
        matrix[10] *= invSZ;
        mat4ToQuat(matrix, quaternion);
        scale[0] = sx;
        scale[1] = sy;
        scale[2] = sz;

    };
})();

/**
 * Efficiently post-concatenates a translation to the given matrix.
 */
export function translateMat4v(xyz: FloatArrayParam, m: FloatArrayParam = identityMat4()) {
    return translateMat4c(xyz[0], xyz[1], xyz[2], m);
}

/**
 * Efficiently post-concatenates a translation, given as separate components, to the given matrix.
 */
export function translateMat4c(x: number, y: number, z: number, m: FloatArrayParam = identityMat4()) {
    const m3 = m[3];
    m[0] += m3 * x;
    m[1] += m3 * y;
    m[2] += m3 * z;
    const m7 = m[7];
    m[4] += m7 * x;
    m[5] += m7 * y;
    m[6] += m7 * z;
    const m11 = m[11];
    m[8] += m11 * x;
    m[9] += m11 * y;
    m[10] += m11 * z;
    const m15 = m[15];
    m[12] += m15 * x;
    m[13] += m15 * y;
    m[14] += m15 * z;
    return m;
}

/**
 * Creates a new matrix that replaces the translation in the rightmost column of the given
 * affine matrix with the given translation.
 */
export function setMat4Translation(m: FloatArrayParam, translation: FloatArrayParam, dest: FloatArrayParam): FloatArrayParam {

    dest[0] = m[0];
    dest[1] = m[1];
    dest[2] = m[2];
    dest[3] = m[3];

    dest[4] = m[4];
    dest[5] = m[5];
    dest[6] = m[6];
    dest[7] = m[7];

    dest[8] = m[8];
    dest[9] = m[9];
    dest[10] = m[10];
    dest[11] = m[11];

    dest[12] = translation[0];
    dest[13] = translation[1];
    dest[14] = translation[2];
    dest[15] = m[15];

    return dest;
}

/**
 * Returns 4x4 translation matrix.
 */
export function translationMat4v(v: FloatArrayParam, dest?: FloatArrayParam): FloatArrayParam {
    const m = dest || identityMat4();
    m[12] = v[0];
    m[13] = v[1];
    m[14] = v[2];
    return m;
}

/**
 * Returns 3x3 translation matrix.
 */
export function translationMat3v(v: FloatArrayParam, dest?: FloatArrayParam): FloatArrayParam {
    const m = dest || identityMat3();
    m[6] = v[0];
    m[7] = v[1];
    return m;
}

/**
 * Returns 4x4 translation matrix.
 */
export const translationMat4c = ((() => {
    const xyz = newFloatArray(3);
    return (x: number, y: number, z: number, dest: FloatArrayParam): FloatArrayParam => {
        xyz[0] = x;
        xyz[1] = y;
        xyz[2] = z;
        return translationMat4v(xyz, dest);
    };
}))();

/**
 * Returns 4x4 translation matrix.
 */
export function translationMat4s(s: number, dest: FloatArrayParam) {
    return translationMat4c(s, s, s, dest);
}


/**
 * Returns the determinant of the given 4x4 matrix.
 */
export function determinantMat4(mat: FloatArrayParam): number {
    const a00 = mat[0];
    const a01 = mat[1];
    const a02 = mat[2];
    const a03 = mat[3];
    const a10 = mat[4];
    const a11 = mat[5];
    const a12 = mat[6];
    const a13 = mat[7];
    const a20 = mat[8];
    const a21 = mat[9];
    const a22 = mat[10];
    const a23 = mat[11];
    const a30 = mat[12];
    const a31 = mat[13];
    const a32 = mat[14];
    const a33 = mat[15];
    return a30 * a21 * a12 * a03 - a20 * a31 * a12 * a03 - a30 * a11 * a22 * a03 + a10 * a31 * a22 * a03 +
        a20 * a11 * a32 * a03 - a10 * a21 * a32 * a03 - a30 * a21 * a02 * a13 + a20 * a31 * a02 * a13 +
        a30 * a01 * a22 * a13 - a00 * a31 * a22 * a13 - a20 * a01 * a32 * a13 + a00 * a21 * a32 * a13 +
        a30 * a11 * a02 * a23 - a10 * a31 * a02 * a23 - a30 * a01 * a12 * a23 + a00 * a31 * a12 * a23 +
        a10 * a01 * a32 * a23 - a00 * a11 * a32 * a23 - a20 * a11 * a02 * a33 + a10 * a21 * a02 * a33 +
        a20 * a01 * a12 * a33 - a00 * a21 * a12 * a33 - a10 * a01 * a22 * a33 + a00 * a11 * a22 * a33;
}

/**
 * Gets Euler angles from a 4x4 matrix.
 *
 * @param {mat The 4x4 matrix.
 * @param order Desired Euler angle order: "XYZ", "YXZ", "ZXY" etc.
 * @param [dest] Destination Euler angles, created by default.
 * @returns  The Euler angles.
 */
export function mat4ToEuler(mat: FloatArrayParam, order: string, dest: FloatArrayParam = createVec3()) {
    // Assumes the upper 3x3 of m is a pure rotation matrix (i.e, unscaled)
    const m11 = mat[0];
    const m12 = mat[4];
    const m13 = mat[8];
    const m21 = mat[1];
    const m22 = mat[5];
    const m23 = mat[9];
    const m31 = mat[2];
    const m32 = mat[6];
    const m33 = mat[10];
    if (order === 'XYZ') {
        dest[1] = Math.asin(clamp(m13, -1, 1));
        if (Math.abs(m13) < 0.99999) {
            dest[0] = Math.atan2(-m23, m33);
            dest[2] = Math.atan2(-m12, m11);
        } else {
            dest[0] = Math.atan2(m32, m22);
            dest[2] = 0;
        }
    } else if (order === 'YXZ') {
        dest[0] = Math.asin(-clamp(m23, -1, 1));
        if (Math.abs(m23) < 0.99999) {
            dest[1] = Math.atan2(m13, m33);
            dest[2] = Math.atan2(m21, m22);
        } else {
            dest[1] = Math.atan2(-m31, m11);
            dest[2] = 0;
        }
    } else if (order === 'ZXY') {
        dest[0] = Math.asin(clamp(m32, -1, 1));
        if (Math.abs(m32) < 0.99999) {
            dest[1] = Math.atan2(-m31, m33);
            dest[2] = Math.atan2(-m12, m22);
        } else {
            dest[1] = 0;
            dest[2] = Math.atan2(m21, m11);
        }
    } else if (order === 'ZYX') {
        dest[1] = Math.asin(-clamp(m31, -1, 1));
        if (Math.abs(m31) < 0.99999) {
            dest[0] = Math.atan2(m32, m33);
            dest[2] = Math.atan2(m21, m11);
        } else {
            dest[0] = 0;
            dest[2] = Math.atan2(-m12, m22);
        }
    } else if (order === 'YZX') {
        dest[2] = Math.asin(clamp(m21, -1, 1));
        if (Math.abs(m21) < 0.99999) {
            dest[0] = Math.atan2(-m23, m22);
            dest[1] = Math.atan2(-m31, m11);
        } else {
            dest[0] = 0;
            dest[1] = Math.atan2(m13, m33);
        }
    } else if (order === 'XZY') {
        dest[2] = Math.asin(-clamp(m12, -1, 1));
        if (Math.abs(m12) < 0.99999) {
            dest[0] = Math.atan2(m32, m22);
            dest[1] = Math.atan2(m13, m11);
        } else {
            dest[0] = Math.atan2(-m23, m33);
            dest[1] = 0;
        }
    }
    return dest;
}

/**
 * Linearly interpolates between two 4x4 matrices.
 */
export function lerpMat4(t: number, t1: number, t2: number, m1: FloatArrayParam, m2: FloatArrayParam, dest?: FloatArrayParam) {
    const result = dest || createMat4();
    const f = (t - t1) / (t2 - t1);
    result[0] = m1[0] + (f * (m2[0] - m1[0]));
    result[1] = m1[1] + (f * (m2[1] - m1[1]));
    result[2] = m1[2] + (f * (m2[2] - m1[2]));
    result[3] = m1[3] + (f * (m2[3] - m1[3]));
    result[4] = m1[4] + (f * (m2[4] - m1[4]));
    result[5] = m1[5] + (f * (m2[5] - m1[5]));
    result[6] = m1[6] + (f * (m2[6] - m1[6]));
    result[7] = m1[7] + (f * (m2[7] - m1[7]));
    result[8] = m1[8] + (f * (m2[8] - m1[8]));
    result[9] = m1[9] + (f * (m2[9] - m1[9]));
    result[10] = m1[10] + (f * (m2[10] - m1[10]));
    result[11] = m1[11] + (f * (m2[11] - m1[11]));
    result[12] = m1[12] + (f * (m2[12] - m1[12]));
    result[13] = m1[13] + (f * (m2[13] - m1[13]));
    result[14] = m1[14] + (f * (m2[14] - m1[14]));
    result[15] = m1[15] + (f * (m2[15] - m1[15]));
    return result;
}


/**
 * Craetes an identity quaternion.
 * @param dest Optional quaternion to initialize
 * @returns New quaternion
 */
export function identityQuat(
    dest: FloatArrayParam = createVec4()
): FloatArrayParam {
    dest[0] = 0.0;
    dest[1] = 0.0;
    dest[2] = 0.0;
    dest[3] = 1.0;
    return dest;
}

/**
 * Initializes a quaternion from Euler angles.
 *
 * @param  euler The Euler angles.
 * @param  order Euler angle order: "XYZ", "YXZ", "ZXY" etc.
 * @param  [dest] Destination quaternion, created by default.
 * @returns  The quaternion.
 */
export function eulerToQuat(
    euler: FloatArrayParam,
    order: string,
    dest: FloatArrayParam = createVec4()
): FloatArrayParam {
    // http://www.mathworks.com/matlabcentral/fileexchange/20696-function-to-convert-between-dcm-euler-angles-quaternions-and-euler-vectors/content/SpinCalc.m

    const a = (euler[0] * DEGTORAD) / 2;
    const b = (euler[1] * DEGTORAD) / 2;
    const c = (euler[2] * DEGTORAD) / 2;

    const c1 = Math.cos(a);
    const c2 = Math.cos(b);
    const c3 = Math.cos(c);
    const s1 = Math.sin(a);
    const s2 = Math.sin(b);
    const s3 = Math.sin(c);

    if (order === "XYZ") {
        dest[0] = s1 * c2 * c3 + c1 * s2 * s3;
        dest[1] = c1 * s2 * c3 - s1 * c2 * s3;
        dest[2] = c1 * c2 * s3 + s1 * s2 * c3;
        dest[3] = c1 * c2 * c3 - s1 * s2 * s3;
    } else if (order === "YXZ") {
        dest[0] = s1 * c2 * c3 + c1 * s2 * s3;
        dest[1] = c1 * s2 * c3 - s1 * c2 * s3;
        dest[2] = c1 * c2 * s3 - s1 * s2 * c3;
        dest[3] = c1 * c2 * c3 + s1 * s2 * s3;
    } else if (order === "ZXY") {
        dest[0] = s1 * c2 * c3 - c1 * s2 * s3;
        dest[1] = c1 * s2 * c3 + s1 * c2 * s3;
        dest[2] = c1 * c2 * s3 + s1 * s2 * c3;
        dest[3] = c1 * c2 * c3 - s1 * s2 * s3;
    } else if (order === "ZYX") {
        dest[0] = s1 * c2 * c3 - c1 * s2 * s3;
        dest[1] = c1 * s2 * c3 + s1 * c2 * s3;
        dest[2] = c1 * c2 * s3 - s1 * s2 * c3;
        dest[3] = c1 * c2 * c3 + s1 * s2 * s3;
    } else if (order === "YZX") {
        dest[0] = s1 * c2 * c3 + c1 * s2 * s3;
        dest[1] = c1 * s2 * c3 + s1 * c2 * s3;
        dest[2] = c1 * c2 * s3 - s1 * s2 * c3;
        dest[3] = c1 * c2 * c3 - s1 * s2 * s3;
    } else if (order === "XZY") {
        dest[0] = s1 * c2 * c3 - c1 * s2 * s3;
        dest[1] = c1 * s2 * c3 - s1 * c2 * s3;
        dest[2] = c1 * c2 * s3 + s1 * s2 * c3;
        dest[3] = c1 * c2 * c3 + s1 * s2 * s3;
    }

    return dest;
}

/**
 * Encodes rotation from a matrix into a quaternion.
 * @param m The matrix
 * @param dest The quaternion
 */
export function mat4ToQuat(
    m: FloatArrayParam,
    dest: FloatArrayParam = createVec4()
): FloatArrayParam {
    // http://www.euclideanspace.com/maths/geometry/rotations/conversions/matrixToQuaternion/index.htm

    // Assumes the upper 3x3 of m is a pure rotation matrix (i.e, unscaled)

    const m11 = m[0];
    const m12 = m[4];
    const m13 = m[8];
    const m21 = m[1];
    const m22 = m[5];
    const m23 = m[9];
    const m31 = m[2];
    const m32 = m[6];
    const m33 = m[10];
    let s;

    const trace = m11 + m22 + m33;

    if (trace > 0) {
        s = 0.5 / Math.sqrt(trace + 1.0);

        dest[3] = 0.25 / s;
        dest[0] = (m32 - m23) * s;
        dest[1] = (m13 - m31) * s;
        dest[2] = (m21 - m12) * s;
    } else if (m11 > m22 && m11 > m33) {
        s = 2.0 * Math.sqrt(1.0 + m11 - m22 - m33);

        dest[3] = (m32 - m23) / s;
        dest[0] = 0.25 * s;
        dest[1] = (m12 + m21) / s;
        dest[2] = (m13 + m31) / s;
    } else if (m22 > m33) {
        s = 2.0 * Math.sqrt(1.0 + m22 - m11 - m33);

        dest[3] = (m13 - m31) / s;
        dest[0] = (m12 + m21) / s;
        dest[1] = 0.25 * s;
        dest[2] = (m23 + m32) / s;
    } else {
        s = 2.0 * Math.sqrt(1.0 + m33 - m11 - m22);

        dest[3] = (m21 - m12) / s;
        dest[0] = (m13 + m31) / s;
        dest[1] = (m23 + m32) / s;
        dest[2] = 0.25 * s;
    }

    return dest;
}

/**
 *
 * @param u
 * @param v
 * @param dest
 */
export function vec3PairToQuat(
    u: FloatArrayParam,
    v: FloatArrayParam,
    dest: FloatArrayParam = createVec4()
): FloatArrayParam {
    const norm_u_norm_v = Math.sqrt(dotVec3(u, u) * dotVec3(v, v));
    let real_part = norm_u_norm_v + dotVec3(u, v);

    if (real_part < 0.00000001 * norm_u_norm_v) {
        // If u and v are exactly opposite, rotate 180 degrees
        // around an arbitrary orthogonal axis. Axis normalisation
        // can happen later, when we normalise the quaternion.

        real_part = 0.0;

        if (Math.abs(u[0]) > Math.abs(u[2])) {
            dest[0] = -u[1];
            dest[1] = u[0];
            dest[2] = 0;
        } else {
            dest[0] = 0;
            dest[1] = -u[2];
            dest[2] = u[1];
        }
    } else {
        // Otherwise, build quaternion the standard way.
        cross3Vec3(u, v, dest);
    }

    dest[3] = real_part;

    return normalizeQuat(dest);
}

/**
 * Converts an angle-axis rotation representation into a quaternion
 * @param angleAxis
 * @param dest
 */
export function angleAxisToQuaternion(
    angleAxis: FloatArrayParam,
    dest: FloatArrayParam = createVec4()
): FloatArrayParam {
    const halfAngle = angleAxis[3] / 2.0;
    const fsin = Math.sin(halfAngle);
    dest[0] = fsin * angleAxis[0];
    dest[1] = fsin * angleAxis[1];
    dest[2] = fsin * angleAxis[2];
    dest[3] = Math.cos(halfAngle);
    return dest;
}

/**
 * Converts a quaternion to Euler angles
 * @param q
 * @param order
 * @param dest
 */
export function quatToEuler(
    q: FloatArrayParam,
    order: string,
    dest: FloatArrayParam = createVec3()
) {
    quatToRotationMat4(q, tempMat4a);
    mat4ToEuler(tempMat4a, order, dest);
    return dest;
}

/**
 * Multiples a pair of quaternions
 * @param p
 * @param q
 * @param dest
 */
export function mulQuats(
    p: FloatArrayParam,
    q: FloatArrayParam,
    dest: FloatArrayParam = createVec4()
): FloatArrayParam {
    const p0 = p[0];
    const p1 = p[1];
    const p2 = p[2];
    const p3 = p[3];
    const q0 = q[0];
    const q1 = q[1];
    const q2 = q[2];
    const q3 = q[3];
    dest[0] = p3 * q0 + p0 * q3 + p1 * q2 - p2 * q1;
    dest[1] = p3 * q1 + p1 * q3 + p2 * q0 - p0 * q2;
    dest[2] = p3 * q2 + p2 * q3 + p0 * q1 - p1 * q0;
    dest[3] = p3 * q3 - p0 * q0 - p1 * q1 - p2 * q2;
    return dest;
}

/**
 *
 * @param q
 * @param vec
 * @param dest
 */
export function vec3ApplyQuat(
    q: FloatArrayParam,
    vec: FloatArrayParam,
    dest: FloatArrayParam = createVec3()
): FloatArrayParam {
    const x = vec[0];
    const y = vec[1];
    const z = vec[2];

    const qx = q[0];
    const qy = q[1];
    const qz = q[2];
    const qw = q[3];

    // calculate quat * vector

    const ix = qw * x + qy * z - qz * y;
    const iy = qw * y + qz * x - qx * z;
    const iz = qw * z + qx * y - qy * x;
    const iw = -qx * x - qy * y - qz * z;

    // calculate result * inverse quat

    dest[0] = ix * qw + iw * -qx + iy * -qz - iz * -qy;
    dest[1] = iy * qw + iw * -qy + iz * -qx - ix * -qz;
    dest[2] = iz * qw + iw * -qz + ix * -qy - iy * -qx;

    return dest;
}

/**
 * Converts a quaternion into a matrix.
 * @param q
 * @param dest
 */
export function quatToMat4(
    q: FloatArrayParam,
    dest?: FloatArrayParam
): FloatArrayParam {
    dest = identityMat4(dest);

    const q0 = q[0]; //x
    const q1 = q[1]; //y
    const q2 = q[2]; //z
    const q3 = q[3]; //w

    const tx = 2.0 * q0;
    const ty = 2.0 * q1;
    const tz = 2.0 * q2;

    const twx = tx * q3;
    const twy = ty * q3;
    const twz = tz * q3;

    const txx = tx * q0;
    const txy = ty * q0;
    const txz = tz * q0;

    const tyy = ty * q1;
    const tyz = tz * q1;
    const tzz = tz * q2;

    dest[0] = 1.0 - (tyy + tzz);
    dest[1] = txy + twz;
    dest[2] = txz - twy;

    dest[4] = txy - twz;
    dest[5] = 1.0 - (txx + tzz);
    dest[6] = tyz + twx;

    dest[8] = txz + twy;
    dest[9] = tyz - twx;

    dest[10] = 1.0 - (txx + tyy);

    return dest;
}

/**
 * Converts a quaternion into a rotation matrix.
 * @param q
 * @param m
 */
export function quatToRotationMat4(
    q: FloatArrayParam,
    m: FloatArrayParam
): FloatArrayParam {
    const x = q[0];
    const y = q[1];
    const z = q[2];
    const w = q[3];

    const x2 = x + x;
    const y2 = y + y;
    const z2 = z + z;
    const xx = x * x2;
    const xy = x * y2;
    const xz = x * z2;
    const yy = y * y2;
    const yz = y * z2;
    const zz = z * z2;
    const wx = w * x2;
    const wy = w * y2;
    const wz = w * z2;

    m[0] = 1 - (yy + zz);
    m[4] = xy - wz;
    m[8] = xz + wy;

    m[1] = xy + wz;
    m[5] = 1 - (xx + zz);
    m[9] = yz - wx;

    m[2] = xz - wy;
    m[6] = yz + wx;
    m[10] = 1 - (xx + yy);

    // last column
    m[3] = 0;
    m[7] = 0;
    m[11] = 0;

    // bottom row
    m[12] = 0;
    m[13] = 0;
    m[14] = 0;
    m[15] = 1;

    return m;
}

/**
 * Normalizes a quaternion
 * @param q
 * @param dest
 * @returns The normalized quaternion
 */
export function normalizeQuat(
    q: FloatArrayParam,
    dest: FloatArrayParam = q
): FloatArrayParam {
    const len = lenVec4([q[0], q[1], q[2], q[3]]);
    dest[0] = q[0] / len;
    dest[1] = q[1] / len;
    dest[2] = q[2] / len;
    dest[3] = q[3] / len;
    return dest;
}

/**
 * Gets the conjugate of a quaternion.
 * @param q
 * @param dest
 * @returns The conjugate of the quaternion
 */
export function conjugateQuat(
    q: FloatArrayParam,
    dest: FloatArrayParam = q
) {
    dest[0] = -q[0];
    dest[1] = -q[1];
    dest[2] = -q[2];
    dest[3] = q[3];
    return dest;
}

/**
 * Gets the inverse of a quaternion.
 * @param q
 * @param dest
 * @returns The inverse quaternion
 */
export function inverseQuat(q: FloatArrayParam, dest: FloatArrayParam) {
    return normalizeQuat(conjugateQuat(q, dest));
}

/**
 * Converts a quaternion to angle-axis representation.
 * @param q
 * @param angleAxis
 * @returns The angle-axis rotation
 */
export function quatToAngleAxis(
    q: FloatArrayParam,
    angleAxis: FloatArrayParam = createVec4()
) {
    q = normalizeQuat(q, tempVec4a);
    const q3 = q[3];
    const angle = 2 * Math.acos(q3);
    const s = Math.sqrt(1 - q3 * q3);
    if (s < 0.001) {
        // test to avoid divide by zero, s is always positive due to sqrt
        angleAxis[0] = q[0];
        angleAxis[1] = q[1];
        angleAxis[2] = q[2];
    } else {
        angleAxis[0] = q[0] / s;
        angleAxis[1] = q[1] / s;
        angleAxis[2] = q[2] / s;
    }
    angleAxis[3] = angle; // * 57.295779579;
    return angleAxis;
}


/**
 * Finds the intersection of a 3D ray with a 3D triangle.
 */
export function rayTriangleIntersect(origin: FloatArrayParam, dir: FloatArrayParam, a: FloatArrayParam, b: FloatArrayParam, c: FloatArrayParam, isect: FloatArrayParam): FloatArrayParam | null {
    isect = isect || createVec3();
    const EPSILON = 0.000001;
    const edge1 = subVec3(b, a, tempVec3);
    const edge2 = subVec3(c, a, tempVec3b);
    const pvec = cross3Vec3(dir, edge2, tempVec3c);
    const det = dotVec3(edge1, pvec);
    if (det < EPSILON) {
        return null;
    }
    const tvec = subVec3(origin, a, tempVec3d);
    const u = dotVec3(tvec, pvec);
    if (u < 0 || u > det) {
        return null;
    }
    const qvec = cross3Vec3(tvec, edge1, tempVec3e);
    const v = dotVec3(dir, qvec);
    if (v < 0 || u + v > det) {
        return null;
    }
    const t = dotVec3(edge2, qvec) / det;
    isect[0] = origin[0] + t * dir[0];
    isect[1] = origin[1] + t * dir[1];
    isect[2] = origin[2] + t * dir[2];
    return isect;
}

/**
 Transforms a ray by a matrix.
 @param matrix 4x4 matrix
 @param rayOrigin The ray origin
 @param rayDir The ray direction
 @param rayOriginDest The transformed ray origin
 @param rayDirDest The transformed ray direction
 */
export function transformRay(matrix: FloatArrayParam, rayOrigin: FloatArrayParam, rayDir: FloatArrayParam, rayOriginDest: FloatArrayParam, rayDirDest: FloatArrayParam) {
    tempVec4a[0] = rayOrigin[0];
    tempVec4a[1] = rayOrigin[1];
    tempVec4a[2] = rayOrigin[2];
    tempVec4a[3] = 1;
    transformVec4(matrix, tempVec4a, tempVec4b);
    rayOriginDest[0] = tempVec4b[0];
    rayOriginDest[1] = tempVec4b[1];
    rayOriginDest[2] = tempVec4b[2];
    tempVec4a[0] = rayDir[0];
    tempVec4a[1] = rayDir[1];
    tempVec4a[2] = rayDir[2];
    transformVec3(matrix, tempVec4a, tempVec4b);
    normalizeVec3(tempVec4b);
    rayDirDest[0] = tempVec4b[0];
    rayDirDest[1] = tempVec4b[1];
    rayDirDest[2] = tempVec4b[2];
}

/**
 Transforms a Canvas-space position into a World-space ray, in the context of a Camera.
 @method canvasPosToWorldRay
 @static
 @param {Number[]} viewMatrix View matrix
 @param {Number[]} projMatrix Projection matrix
 @param {String} projection Projection type (e.g. "ortho")
 @param {Number[]} canvasPos The Canvas-space position.
 @param {Number[]} worldRayOrigin The World-space ray origin.
 @param {Number[]} worldRayDir The World-space ray direction.
 */
export const canvasPosToWorldRay = ((() => {

    const pvMatInv = new Float64Array(16);
    const vec4Near = new Float64Array(4);
    const vec4Far = new Float64Array(4);

    const clipToWorld = (clipX, clipY, clipZ, isOrtho, outVec4) => {
        outVec4[0] = clipX;
        outVec4[1] = clipY;
        outVec4[2] = clipZ;
        outVec4[3] = 1;

        transformVec4(pvMatInv, outVec4, outVec4);
        if (!isOrtho)
            mulVec4Scalar(outVec4, 1 / outVec4[3]);
    };

    return (canvas, viewMatrix, projMatrix, projection, canvasPos, worldRayOrigin, worldRayDir) => {
        const isOrtho = projection === "ortho";

        mulMat4(projMatrix, viewMatrix, pvMatInv);
        inverseMat4(pvMatInv, pvMatInv);

        // Calculate clip space coordinates, which will be in range
        // of x=[-1..1] and y=[-1..1], with y=(+1) at top

        const clipX = 2 * canvasPos[0] / canvas.width - 1;  // Calculate clip space coordinates
        const clipY = 1 - 2 * canvasPos[1] / canvas.height;

        clipToWorld(clipX, clipY, -1, isOrtho, vec4Near);

        clipToWorld(clipX, clipY, 1, isOrtho, vec4Far);

        worldRayOrigin[0] = vec4Near[0];
        worldRayOrigin[1] = vec4Near[1];
        worldRayOrigin[2] = vec4Near[2];

        subVec3(vec4Far, vec4Near, worldRayDir);

        normalizeVec3(worldRayDir);
    };
}))();
