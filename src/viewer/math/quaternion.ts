import { DEGTORAD, FloatArrayType } from "./math";
import { cross3Vec3, dotVec3, lenVec4, vec3, vec4 } from "./vector";
import { identityMat4, mat4, mat4ToEuler } from "./matrix";

const tempMat4a: FloatArrayType = mat4();
const tempVec4a: FloatArrayType = vec4();

/**
 * Craetes an identity quaternion.
 * @param dest Optional quaternion to initialize
 * @returns New quaternion
 */
export function identityQuaternion(
    dest: FloatArrayType = vec4()
): FloatArrayType {
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
export function eulerToQuaternion(
    euler: FloatArrayType,
    order: string,
    dest: FloatArrayType = vec4()
): FloatArrayType {
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
export function mat4ToQuaternion(
    m: FloatArrayType,
    dest: FloatArrayType = vec4()
): FloatArrayType {
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
export function vec3PairToQuaternion(
    u: FloatArrayType,
    v: FloatArrayType,
    dest: FloatArrayType = vec4()
): FloatArrayType {
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

    return normalizeQuaternion(dest);
}

/**
 * Converts an angle-axis rotation representation into a quaternion
 * @param angleAxis
 * @param dest
 */
export function angleAxisToQuaternion(
    angleAxis: FloatArrayType,
    dest: FloatArrayType = vec4()
): FloatArrayType {
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
export function quaternionToEuler(
    q: FloatArrayType,
    order: string,
    dest: FloatArrayType = vec3()
) {
    quaternionToRotationMat4(q, tempMat4a);
    mat4ToEuler(tempMat4a, order, dest);
    return dest;
}

/**
 * Multiples a pair of quaternions
 * @param p
 * @param q
 * @param dest
 */
export function mulQuaternions(
    p: FloatArrayType,
    q: FloatArrayType,
    dest: FloatArrayType = vec4()
): FloatArrayType {
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
export function vec3ApplyQuaternion(
    q: FloatArrayType,
    vec: FloatArrayType,
    dest: FloatArrayType = vec3()
): FloatArrayType {
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
export function quaternionToMat4(
    q: FloatArrayType,
    dest: FloatArrayType
): FloatArrayType {
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
export function quaternionToRotationMat4(
    q: FloatArrayType,
    m: FloatArrayType
): FloatArrayType {
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
export function normalizeQuaternion(
    q: FloatArrayType,
    dest: FloatArrayType = q
): FloatArrayType {
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
export function conjugateQuaternion(
    q: FloatArrayType,
    dest: FloatArrayType = q
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
export function inverseQuaternion(q: FloatArrayType, dest: FloatArrayType) {
    return normalizeQuaternion(conjugateQuaternion(q, dest));
}

/**
 * Converts a quaternion to angle-axis representation.
 * @param q
 * @param angleAxis
 * @returns The angle-axis rotation
 */
export function quaternionToAngleAxis(
    q: FloatArrayType,
    angleAxis: FloatArrayType = vec4()
) {
    q = normalizeQuaternion(q, tempVec4a);
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
