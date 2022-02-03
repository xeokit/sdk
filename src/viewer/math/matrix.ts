import {clamp, FloatArrayType, newFloatArray} from "./math";
import {addVec4, lenVec3, normalizeVec4, subVec4, vec3, vec4} from "./vector";
import {mat4ToQuaternion, quaternionToRotationMat4} from "./quaternion";


/**
 * Returns a new, uninitialized 3x3 matrix.
 */
export function mat3(values?: FloatArrayType): FloatArrayType {
    // @ts-ignore
    return new newFloatArray(values || 9);
}

/**
 * Returns a new, uninitialized 4x4 matrix.
 */
export function mat4(values?: FloatArrayType): FloatArrayType {
    // @ts-ignore
    return newFloatArray(values || 16);
}

const tempMat4a = mat4();
const tempMat4b = mat4();

/**
 * Returns a 4x4 perspective projection matrix.
 */
export function perspectiveMat4(fovyrad: number, aspectratio: number, znear: number, zfar: number, m?: FloatArrayType): FloatArrayType {
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
export function frustumMat4v(fmin: FloatArrayType, fmax: FloatArrayType, m?: FloatArrayType): FloatArrayType {
    if (!m) {
        m = mat4();
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
    dest?: FloatArrayType): FloatArrayType {
    if (!dest) {
        dest = mat4();
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
    dest?: FloatArrayType): FloatArrayType {
    if (!dest) {
        dest = mat4();
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
export function identityMat4(dest?: FloatArrayType) {
    if (!dest) {
        dest = mat4();
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
export function identityMat3(dest?: FloatArrayType) {
    if (!dest) {
        dest = mat4();
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
export function isIdentityMat4(m: FloatArrayType): boolean {
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
export function rotationMat4v(anglerad: number, axis: FloatArrayType, m?: FloatArrayType): FloatArrayType {
    if (!m) {
        m = mat4();
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
export function lookAtMat4v(pos: FloatArrayType, target: FloatArrayType, up: FloatArrayType, dest?: FloatArrayType): FloatArrayType {
    if (!dest) {
        dest = mat4();
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
    //vec3.direction(eye, center, z);
    z0 = posx - targetx;
    z1 = posy - targety;
    z2 = posz - targetz;
    // normalize (no check needed for 0 because of early return)
    len = 1 / Math.sqrt(z0 * z0 + z1 * z1 + z2 * z2);
    z0 *= len;
    z1 *= len;
    z2 *= len;
    //vec3.normalize(vec3.cross(up, z, x));
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
    //vec3.normalize(vec3.cross(z, x, y));
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
export function inverseMat4(mat: FloatArrayType, dest?: FloatArrayType): FloatArrayType {
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
export function transposeMat4(mat: FloatArrayType, dest?: FloatArrayType): FloatArrayType {
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
export function mulMat4v4(m: FloatArrayType, v: FloatArrayType, dest?: FloatArrayType): FloatArrayType {
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
export function mulMat4(a: FloatArrayType, b: FloatArrayType, dest?: FloatArrayType): FloatArrayType {
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
export function mulMat3(a:FloatArrayType, b:FloatArrayType, dest:FloatArrayType=newFloatArray(9)) {

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
export function transformPoint3(m: FloatArrayType, p: FloatArrayType, dest?: FloatArrayType) {
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
export function transformPoint4(m: FloatArrayType, v: FloatArrayType, dest?: FloatArrayType) {
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
export function transformPoints3(m: FloatArrayType, points: number[][], points2: number[][]) {
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
export function transformPositions3(m: FloatArrayType, p: FloatArrayType, p2?: FloatArrayType) {
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
export function transformPositions4(m: FloatArrayType, p: FloatArrayType, p2?: FloatArrayType) {
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
export function transformVec3(m: FloatArrayType, v: FloatArrayType, dest?: FloatArrayType) {
    const v0 = v[0];
    const v1 = v[1];
    const v2 = v[2];
    dest = dest || this.vec3();
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
export function transformVec4(m: FloatArrayType, v: FloatArrayType, dest?: FloatArrayType) {
    const v0 = v[0];
    const v1 = v[1];
    const v2 = v[2];
    const v3 = v[3];
    dest = dest || vec4();
    dest[0] = m[0] * v0 + m[4] * v1 + m[8] * v2 + m[12] * v3;
    dest[1] = m[1] * v0 + m[5] * v1 + m[9] * v2 + m[13] * v3;
    dest[2] = m[2] * v0 + m[6] * v1 + m[10] * v2 + m[14] * v3;
    dest[3] = m[3] * v0 + m[7] * v1 + m[11] * v2 + m[15] * v3;
    return dest;
}


/**
 * Efficiently post-concatenates a scaling to the given matrix.
 */
export function scaleMat4v(xyz: FloatArrayType, m: FloatArrayType = identityMat4()) {
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
export function scalingMat4v(v: FloatArrayType, m: FloatArrayType = identityMat4()): FloatArrayType {
    m[0] = v[0];
    m[5] = v[1];
    m[10] = v[2];
    return m;
}

/**
 * Returns a 3x3 scale matrix.
 */
export function scalingMat3v(v: FloatArrayType, m: FloatArrayType = identityMat3()): FloatArrayType {
    m[0] = v[0];
    m[4] = v[1];
    return m;
}

/**
 * Returns a 4x4 scale matrix.
 */
export const scalingMat4c = ((() => {
    const xyz: FloatArrayType = newFloatArray(3);
    return (x: number, y: number, z: number, dest?: FloatArrayType) => {
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
export function scaleMat4c(x: number, y: number, z: number, m: FloatArrayType): FloatArrayType {

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
export function scalingMat4s(s: number): FloatArrayType {
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
    position: FloatArrayType,
    quaternion: FloatArrayType,
    scale: FloatArrayType,
    mat: FloatArrayType = mat4()): FloatArrayType {
    quaternionToRotationMat4(quaternion, mat);
    scaleMat4v(scale, mat);
    translateMat4v(position, mat);
    return mat;
}

/**
 * Decomposes a 4x4 matrix into position, quaternion and scale.
 */
export const decomposeMat4 = (() => {
    const vec = vec3();
    const matrix = mat4();
    return function decompose(mat: FloatArrayType, position: FloatArrayType, quaternion: FloatArrayType, scale: FloatArrayType) {
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
        mat4ToQuaternion(matrix, quaternion);
        scale[0] = sx;
        scale[1] = sy;
        scale[2] = sz;
        return this;
    };
})();

/**
 * Efficiently post-concatenates a translation to the given matrix.
 */
export function translateMat4v(xyz: FloatArrayType, m: FloatArrayType = identityMat4()) {
    return translateMat4c(xyz[0], xyz[1], xyz[2], m);
}

/**
 * Efficiently post-concatenates a translation, given as separate components, to the given matrix.
 */
export function translateMat4c(x: number, y: number, z: number, m: FloatArrayType = identityMat4()) {
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
export function setMat4Translation(m: FloatArrayType, translation: FloatArrayType, dest: FloatArrayType): FloatArrayType {

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
export function translationMat4v(v: FloatArrayType, dest?: FloatArrayType): FloatArrayType {
    const m = dest || identityMat4();
    m[12] = v[0];
    m[13] = v[1];
    m[14] = v[2];
    return m;
}

/**
 * Returns 3x3 translation matrix.
 */
export function translationMat3v(v: FloatArrayType, dest?: FloatArrayType): FloatArrayType {
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
    return (x: number, y: number, z: number, dest: FloatArrayType): FloatArrayType => {
        xyz[0] = x;
        xyz[1] = y;
        xyz[2] = z;
        return translationMat4v(xyz, dest);
    };
}))();

/**
 * Returns 4x4 translation matrix.
 */
export function translationMat4s(s: number, dest?: FloatArrayType) {
    return translationMat4c(s, s, s, dest);
}


/**
 * Returns the determinant of the given 4x4 matrix.
 */
export function determinantMat4(mat: FloatArrayType): number {
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
export function mat4ToEuler(mat: FloatArrayType, order: string, dest: FloatArrayType = vec3()) {
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
export function lerpMat4(t: number, t1: number, t2: number, m1: FloatArrayType, m2: FloatArrayType, dest?:FloatArrayType) {
    const result = dest || mat4();
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

