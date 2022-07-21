import {FloatArrayType, FloatArrayClass} from "./math";

/**
 * Returns the dot product of two three-element vectors.
 */
export function dotVec3(u: FloatArrayType, v: FloatArrayType): number {
    return (u[0] * v[0] + u[1] * v[1] + u[2] * v[2]);
}

/**
 * Returns a new, uninitialized two-element vector.
 */
export function vec2(values?: FloatArrayType): FloatArrayType {
    // @ts-ignore
    return new FloatArrayClass(values || 2);
}

/**
 * Returns a new, uninitialized three-element vector.
 */
export function vec3(values?: FloatArrayType): FloatArrayType {
    // @ts-ignore
    return new Float64Array(values || 3);
}

/**
 * Returns a new, uninitialized four-element vector.
 */
export function vec4(values?: FloatArrayType): FloatArrayType {
    // @ts-ignore
    return new FloatArrayClass(values || 4);
}

/**
 * Negates a three-element vector.
 */
export function negateVec3(v: FloatArrayType, dest?: FloatArrayType): FloatArrayType {
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
export function negateVec4(v: FloatArrayType, dest?: FloatArrayType): FloatArrayType {
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
export function addVec4(u: FloatArrayType, v: FloatArrayType, dest?: FloatArrayType): FloatArrayType {
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
export function addVec4Scalar(v: FloatArrayType, s: number, dest?: FloatArrayType) {
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
export function mulVec4Scalar(v: FloatArrayType, s: number, dest?: FloatArrayType) {
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
export function mulVec3Scalar(v: FloatArrayType, s: number, dest?: FloatArrayType): FloatArrayType {
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
export function mulVec2Scalar(v: FloatArrayType, s: number, dest?: FloatArrayType): FloatArrayType {
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
export function addVec3(u: FloatArrayType, v: FloatArrayType, dest?: FloatArrayType): FloatArrayType {
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
export function addVec3Scalar(v: FloatArrayType, s: number, dest?: FloatArrayType) {
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
export function subVec4(u: FloatArrayType, v: FloatArrayType, dest?: FloatArrayType) {
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
export function compareVec3(v1: FloatArrayType, v2: FloatArrayType): boolean {
    return (v1[0] === v2[0] && v1[1] === v2[1] && v1[2] === v2[2]);
}

/**
 * Subtracts one three-element vector from another.
 */
export function subVec3(u: FloatArrayType, v: FloatArrayType, dest?: FloatArrayType) {
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
export function subVec2(u: FloatArrayType, v: FloatArrayType, dest?: FloatArrayType) {
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
export function subVec4Scalar(v: FloatArrayType, s: number, dest?: FloatArrayType) {
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
export function subScalarVec4(v: FloatArrayType, s: number, dest?: FloatArrayType) {
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
export function mulVec4(u: FloatArrayType, v: FloatArrayType, dest?: FloatArrayType) {
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
export function divVec3(u: FloatArrayType, v: FloatArrayType, dest?: FloatArrayType) {
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
export function divVec4(u: FloatArrayType, v: FloatArrayType, dest?: FloatArrayType) {
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
export function divScalarVec3(s: number, v: FloatArrayType, dest?: FloatArrayType) {
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
export function divVec3Scalar(v: FloatArrayType, s: number, dest?: FloatArrayType) {
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
export function divVec4Scalar(v: FloatArrayType, s: number, dest?: FloatArrayType) {
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
export function divScalarVec4(s: number, v: FloatArrayType, dest?: FloatArrayType) {
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
export function dotVec4(u: FloatArrayType, v: FloatArrayType) {
    return (u[0] * v[0] + u[1] * v[1] + u[2] * v[2] + u[3] * v[3]);
}

/**
 * Returns the cross product of two four-element vectors.
 */
export function cross3Vec4(u: FloatArrayType, v: FloatArrayType) {
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
export function cross3Vec3(u: FloatArrayType, v: FloatArrayType, dest?: FloatArrayType) {
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


export function sqLenVec4(v: FloatArrayType) { // TODO
    return dotVec4(v, v);
}

/**
 * Returns the length of a four-element vector.
 * @method lenVec4
 * @static
 * @param {Array(Number)} v The vector
 * @return The length
 */
export function lenVec4(v: FloatArrayType) {
    return Math.sqrt(sqLenVec4(v));
}


/**
 * Returns the dot product of two two-element vectors.
 */
export function dotVec2(u: FloatArrayType, v: FloatArrayType) {
    return (u[0] * v[0] + u[1] * v[1]);
}


export function sqLenVec3(v: FloatArrayType) {
    return dotVec3(v, v);
}


export function sqLenVec2(v: FloatArrayType) {
    return dotVec2(v, v);
}

/**
 * Returns the length of a three-element vector.
 */
export function lenVec3(v: FloatArrayType): number {
    return Math.sqrt(sqLenVec3(v));
}

export const distVec3 = ((() => {
    const vec = vec3();
    return (v: FloatArrayType, w: FloatArrayType) => lenVec3(subVec3(v, w, vec));
}))()

/**
 * Returns the length of a two-element vector.
 */
export function lenVec2(v: FloatArrayType): number {
    return Math.sqrt(sqLenVec2(v));
}

/**
 * Linearly interpolates between two 3D vectors.
 */
export function lerpVec3(t: number, t1: number, t2: number, p1: FloatArrayType, p2: FloatArrayType, dest: any) {
    const result = dest || vec3();
    const f = (t - t1) / (t2 - t1);
    result[0] = p1[0] + (f * (p2[0] - p1[0]));
    result[1] = p1[1] + (f * (p2[1] - p1[1]));
    result[2] = p1[2] + (f * (p2[2] - p1[2]));
    return result;
}

export const distVec2 = ((() => {
    const vec = vec2();
    return (v: FloatArrayType, w: FloatArrayType) => lenVec2(subVec2(v, w, vec));
}))();

/**
 * @method rcpVec3
 * @static
 * @param v vec3
 * @param dest vec3 - optional destination
 * @return [] dest if specified, v otherwise
 *
 */
export function rcpVec3(v: FloatArrayType, dest: FloatArrayType) {
    return divScalarVec3(1.0, v, dest);
}

/**
 * Normalizes a four-element vector
 *
 */
export function normalizeVec4(v: FloatArrayType, dest: FloatArrayType) {
    const f = 1.0 / lenVec4(v);
    return mulVec4Scalar(v, f, dest);
}

/**
 * Normalizes a three-element vector
 * @method normalizeVec4
 * @static
 */
export function normalizeVec3(v: FloatArrayType, dest?: FloatArrayType) {
    const f = 1.0 / lenVec3(v);
    return mulVec3Scalar(v, f, dest);
}

/**
 * Normalizes a two-element vector
 */
export function normalizeVec2(v: FloatArrayType, dest: FloatArrayType) {
    const f = 1.0 / lenVec2(v);
    return mulVec2Scalar(v, f, dest);
}

/**
 * Gets the angle between two vectors
 */
export function angleVec3(v: FloatArrayType, w: FloatArrayType) {
    let theta = dotVec3(v, w) / (Math.sqrt(sqLenVec3(v) * sqLenVec3(w)));
    theta = theta < -1 ? -1 : (theta > 1 ? 1 : theta);  // Clamp to handle numerical problems
    return Math.acos(theta);
}

/**
 * Creates a three-element vector from the rotation part of a sixteen-element matrix.
 */
export const vec3FromMat4Scale: Function = ((() => {

    const tempVec3 = vec3();

    return function (m: FloatArrayType, dest: FloatArrayType) {

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
export function vecToArray(v: FloatArrayType): FloatArrayType {
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
export function triangleNormal(a: FloatArrayType, b: FloatArrayType, c: FloatArrayType, normal: FloatArrayType = vec3()): FloatArrayType {
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