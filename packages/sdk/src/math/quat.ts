
import {createVec3Float64, createVec4Float64, cross3Vec3, dotVec3, lenVec4, type Vec3, type Vec4} from "./vector";
import {DEGTORAD} from "./index";
import {createMat4Float64, identityMat4, type Mat4, mat4ToEuler} from "./matrix";

/**
 * Generic quaternion tuple: [x, y, z, w].
 */
export type QuatGeneric<T = number> = [T, T, T, T];

const tempMat4a: Mat4 = createMat4Float64();
const tempQuat: Quat = createQuat();

/**
 * Single-precision float quaternion.
 */
export type QuatFloat32 =
  | Float32Array<any>
  | QuatGeneric<number>;

/**
 * Double-precision float quaternion.
 */
export type QuatFloat64 =
  | Float64Array<any>
  | QuatGeneric<number>;

/**
 * Floating-point quaternion.
 */
export type Quat = QuatFloat32 | QuatFloat64;

/**
 * Creates a new quaternion.
 */
export function createQuat(): Quat {
  return identityQuat();
}

/**
 * Creates an identity quaternion.
 * @param dest Optional quaternion to initialize, if not provided a new quaternion will be created.
 * @returns The identity quaternion.
 */
export function identityQuat(dest: Quat = createVec4Float64()): Quat {
  dest[0] = 0.0;
  dest[1] = 0.0;
  dest[2] = 0.0;
  dest[3] = 1.0;
  return dest;
}


/**
 * Initializes a quaternion from Euler angles.
 *
 * @param euler - The Euler angles in degrees.
 * @param order - The Euler angle order, such as "XYZ", "YXZ", "ZXY", etc.
 * @param [dest] - The destination quaternion (default is created if not provided).
 * @returns The resulting quaternion.
 */
export function eulerToQuat(
  euler: Vec3,
  order: string,
  dest: Quat = createQuat()
): Quat {
  const a = (euler[0] * DEGTORAD) / 2;
  const b = (euler[1] * DEGTORAD) / 2;
  const c = (euler[2] * DEGTORAD) / 2;

  const c1 = Math.cos(a);
  const c2 = Math.cos(b);
  const c3 = Math.cos(c);
  const s1 = Math.sin(a);
  const s2 = Math.sin(b);
  const s3 = Math.sin(c);

  switch (order) {
    case "XYZ":
      dest[0] = s1 * c2 * c3 + c1 * s2 * s3;
      dest[1] = c1 * s2 * c3 - s1 * c2 * s3;
      dest[2] = c1 * c2 * s3 + s1 * s2 * c3;
      dest[3] = c1 * c2 * c3 - s1 * s2 * s3;
      break;
    case "YXZ":
      dest[0] = s1 * c2 * c3 + c1 * s2 * s3;
      dest[1] = c1 * s2 * c3 - s1 * c2 * s3;
      dest[2] = c1 * c2 * s3 - s1 * s2 * c3;
      dest[3] = c1 * c2 * c3 + s1 * s2 * s3;
      break;
    case "ZXY":
      dest[0] = s1 * c2 * c3 - c1 * s2 * s3;
      dest[1] = c1 * s2 * c3 + s1 * c2 * s3;
      dest[2] = c1 * c2 * s3 + s1 * s2 * c3;
      dest[3] = c1 * c2 * c3 - s1 * s2 * s3;
      break;
    case "ZYX":
      dest[0] = s1 * c2 * c3 - c1 * s2 * s3;
      dest[1] = c1 * s2 * c3 + s1 * c2 * s3;
      dest[2] = c1 * c2 * s3 - s1 * s2 * c3;
      dest[3] = c1 * c2 * c3 + s1 * s2 * s3;
      break;
    case "YZX":
      dest[0] = s1 * c2 * c3 + c1 * s2 * s3;
      dest[1] = c1 * s2 * c3 + s1 * c2 * s3;
      dest[2] = c1 * c2 * s3 - s1 * s2 * c3;
      dest[3] = c1 * c2 * c3 - s1 * s2 * s3;
      break;
    case "XZY":
      dest[0] = s1 * c2 * c3 - c1 * s2 * s3;
      dest[1] = c1 * s2 * c3 - s1 * c2 * s3;
      dest[2] = c1 * c2 * s3 + s1 * s2 * c3;
      dest[3] = c1 * c2 * c3 + s1 * s2 * s3;
      break;
    default:
      throw new Error(`Unsupported Euler angle order: ${order}`);
  }

  return dest;
}

/**
 * Encodes rotation from a matrix into a quaternion.
 *
 * @param m - The 4x4 rotation matrix.
 * @param dest - The resulting quaternion (default is created if not provided).
 * @returns The quaternion representing the matrix's rotation.
 */
export function mat4ToQuat(
  m: Mat4,
  dest: Quat = createQuat()
): Quat {
  const m11 = m[0], m12 = m[4], m13 = m[8];
  const m21 = m[1], m22 = m[5], m23 = m[9];
  const m31 = m[2], m32 = m[6], m33 = m[10];

  const trace = m11 + m22 + m33;
  let s: number;

  if (trace > 0) {
    s = 0.5 / Math.sqrt(trace + 1.0);
    dest[3] = 0.25 / s;
    dest[0] = (m32 - m23) * s;
    dest[1] = (m13 - m31) * s;
    dest[2] = (m21 - m12) * s;
  } else {
    if (m11 > m22 && m11 > m33) {
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
  }

  return dest;
}

/**
 * Creates a quaternion from two vectors (u and v).
 * The quaternion represents the rotation from u to v.
 *
 * @param u - The first vector.
 * @param v - The second vector.
 * @param dest - The resulting quaternion (default is created if not provided).
 * @returns The quaternion representing the rotation from u to v.
 */
export function vec3PairToQuat(
  u: Vec3,
  v: Vec3,
  dest: Quat = createQuat()
): Quat {
  const norm_u_norm_v = Math.sqrt(dotVec3(u, u) * dotVec3(v, v));
  let real_part = norm_u_norm_v + dotVec3(u, v);

  if (real_part < 0.00000001 * norm_u_norm_v) {
    // If u and v are exactly opposite, rotate 180 degrees around an arbitrary orthogonal axis.
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
    // Build quaternion using cross product.
    cross3Vec3(u, v, <Vec3>dest);
  }

  dest[3] = real_part;
  return normalizeQuat(dest);
}

/**
 * Converts an angle-axis rotation representation into a quaternion.
 *
 * @param angleAxis - The angle-axis representation, where angle is in radians.
 * @param dest - The resulting quaternion (default is created if not provided).
 * @returns The quaternion representing the angle-axis rotation.
 */
export function angleAxisToQuaternion(
  angleAxis: Vec4,
  dest: Quat = createVec4Float64()
): Quat {
  const halfAngle = angleAxis[3] / 2.0;
  const fsin = Math.sin(halfAngle);
  dest[0] = fsin * angleAxis[0];
  dest[1] = fsin * angleAxis[1];
  dest[2] = fsin * angleAxis[2];
  dest[3] = Math.cos(halfAngle);
  return dest;
}

/**
 * Converts a quaternion into Euler angles.
 *
 * @param q - The quaternion to convert.
 * @param order - The desired Euler angle order (e.g., "XYZ").
 * @param dest - The resulting Euler angles (default is created if not provided).
 * @returns The Euler angles representing the quaternion's rotation.
 */
export function quatToEuler(
  q: Quat,
  order: string,
  dest: Vec3 = createVec3Float64()
): Vec3 {
  quatToRotationMat4(q, tempMat4a);
  mat4ToEuler(tempMat4a, order, dest);
  return dest;
}

/**
 * Multiplies two quaternions.
 *
 * @param p - The first quaternion.
 * @param q - The second quaternion.
 * @param dest - The resulting quaternion (default is created if not provided).
 * @returns The product of the two quaternions.
 */
export function mulQuats(
  p: Quat,
  q: Quat,
  dest: Quat = createVec4Float64()
): Quat {
  const p0 = p[0], p1 = p[1], p2 = p[2], p3 = p[3];
  const q0 = q[0], q1 = q[1], q2 = q[2], q3 = q[3];
  dest[0] = p3 * q0 + p0 * q3 + p1 * q2 - p2 * q1;
  dest[1] = p3 * q1 + p1 * q3 + p2 * q0 - p0 * q2;
  dest[2] = p3 * q2 + p2 * q3 + p0 * q1 - p1 * q0;
  dest[3] = p3 * q3 - p0 * q0 - p1 * q1 - p2 * q2;
  return dest;
}

/**
 * Applies a quaternion rotation to a 3D vector.
 *
 * @param q - The quaternion representing the rotation.
 * @param vec - The vector to apply the quaternion rotation to.
 * @param dest - The resulting rotated vector (default is created if not provided).
 * @returns The rotated vector.
 */
export function vec3ApplyQuat(
  q: Quat,
  vec: Vec3,
  dest: Vec3 = createVec3Float64()
): Vec3 {
  const x = vec[0], y = vec[1], z = vec[2];
  const qx = q[0], qy = q[1], qz = q[2], qw = q[3];

  // Calculate quat * vector
  const ix = qw * x + qy * z - qz * y;
  const iy = qw * y + qz * x - qx * z;
  const iz = qw * z + qx * y - qy * x;
  const iw = -qx * x - qy * y - qz * z;

  // Calculate result * inverse quat
  dest[0] = ix * qw + iw * -qx + iy * -qz - iz * -qy;
  dest[1] = iy * qw + iw * -qy + iz * -qx - ix * -qz;
  dest[2] = iz * qw + iw * -qz + ix * -qy - iy * -qx;

  return dest;
}

/**
 * Converts a quaternion into a 4x4 rotation matrix.
 *
 * @param q - The quaternion to convert.
 * @param dest - The resulting 4x4 rotation matrix (default is created if not provided).
 * @returns The resulting rotation matrix.
 */
export function quatToMat4(
  q: Quat,
  dest: Mat4 = identityMat4(createMat4Float64())
): Mat4 {
  const q0 = q[0], q1 = q[1], q2 = q[2], q3 = q[3];
  const tx = 2.0 * q0, ty = 2.0 * q1, tz = 2.0 * q2;
  const twx = tx * q3, twy = ty * q3, twz = tz * q3;
  const txx = tx * q0, txy = ty * q0, txz = tz * q0;
  const tyy = ty * q1, tyz = tz * q1, tzz = tz * q2;

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
 * Converts a quaternion to a 4x4 rotation matrix.
 * The resulting matrix is stored in the provided matrix array.
 *
 * @param q The quaternion to convert, represented as a 4-element array [x, y, z, w].
 * @param m The matrix to store the result. It will be modified in place.
 * @returns The matrix representing the quaternion rotation.
 */
export function quatToRotationMat4(
  q: Quat,
  m: Mat4
): Mat4 {
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
 * Normalizes a quaternion.
 * The resulting normalized quaternion is stored in the destination array.
 *
 * @param q The quaternion to normalize, represented as a 4-element array [x, y, z, w].
 * @param dest The array to store the normalized quaternion. If not provided, the input quaternion will be normalized in place.
 * @returns The normalized quaternion.
 */
export function normalizeQuat(
  q: Quat,
  dest: Quat = q
): Quat {
  const len = lenVec4([q[0], q[1], q[2], q[3]]);
  dest[0] = q[0] / len;
  dest[1] = q[1] / len;
  dest[2] = q[2] / len;
  dest[3] = q[3] / len;
  return dest;
}

/**
 * Computes the conjugate of a quaternion.
 * The resulting conjugated quaternion is stored in the destination array.
 *
 * @param q The quaternion to conjugate, represented as a 4-element array [x, y, z, w].
 * @param dest The array to store the conjugated quaternion. If not provided, the input quaternion will be conjugated in place.
 * @returns The conjugate of the quaternion.
 */
export function conjugateQuat(
  q: Quat,
  dest: Quat = q
) {
  dest[0] = -q[0];
  dest[1] = -q[1];
  dest[2] = -q[2];
  dest[3] = q[3];
  return dest;
}

/**
 * Computes the inverse of a quaternion.
 * The resulting inverse quaternion is stored in the destination array.
 *
 * @param q The quaternion to invert, represented as a 4-element array [x, y, z, w].
 * @param dest The array to store the inverse quaternion.
 * @returns The inverse of the quaternion.
 */
export function inverseQuat(q: Quat, dest: Quat) {
  return normalizeQuat(conjugateQuat(q, dest));
}

/**
 * Converts a quaternion to angle-axis representation.
 * The resulting angle-axis representation is stored in the provided array.
 *
 * @param q The quaternion to convert, represented as a 4-element array [x, y, z, w].
 * @param angleAxis The array to store the angle-axis representation. If not provided, a new array will be created.
 * @returns The angle-axis representation as a 4-element array [x, y, z, angle].
 */
export function quatToAngleAxis(
  q: Quat,
  angleAxis: Vec4 = createVec4Float64()
) {
  q = normalizeQuat(q, tempQuat);
  const q3 = q[3];
  const angle = 2 * Math.acos(q3);
  const s = Math.sqrt(1 - q3 * q3);
  if (s < 0.001) {
    // Avoid division by zero by using the quaternion components directly when s is very small
    angleAxis[0] = q[0];
    angleAxis[1] = q[1];
    angleAxis[2] = q[2];
  } else {
    angleAxis[0] = q[0] / s;
    angleAxis[1] = q[1] / s;
    angleAxis[2] = q[2] / s;
  }
  angleAxis[3] = angle; // angle in radians
  return angleAxis;
}

