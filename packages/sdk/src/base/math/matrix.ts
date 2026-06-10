/**
 *
 * <img style="padding:0px; padding-top:20px; padding-bottom:20px;  height:270px" src="../../assets/3D-Cart.svg"/>
 *
 * # xeokit Matrix Math Utilities
 *
 * ---
 *
 * ***Mathematical functions and types for working with matrices***
 *
 * ---
 *
 * Helpers for building and manipulating **3×3** and **4×4** matrices used throughout the
 * SDK for camera projection, object transforms, and coordinate conversion.
 *
 * Matrices are represented as either typed arrays (`Float32Array` / `Float64Array`) or
 * plain JS numeric tuples. All functions accept either form and (where supported) can
 * write results into an optional destination array to reduce allocations.
 *
 * ## Matrix types
 *
 * - {@link Mat3Float32}, {@link Mat3Float64} and {@link Mat3} represent 3×3 matrices.
 * - {@link Mat4Float32}, {@link Mat4Float64} and {@link Mat4} represent 4×4 matrices.
 *
 * ## Coordinate conventions
 *
 * This module assumes an affine transform layout where translation occupies the last
 * column (`m[12]`, `m[13]`, `m[14]`) and the homogeneous component is `m[15]`.
 * Many functions treat the matrix as an affine transform (rotation/scale + translation),
 * while projection helpers (perspective/frustum/ortho) create full projective matrices.
 *
 * ## Common workflows
 *
 * - **Projection matrices**: {@link perspectiveMat4}, {@link frustumMat4}, {@link frustumMat4v},
 *   {@link orthoMat4c}
 * - **View matrix**: {@link lookAtMat4v}
 * - **Transform composition**: {@link composeMat4}, {@link composeMat4Euler}
 * - **Transform decomposition**: {@link decomposeMat4}, {@link mat4ToEuler}
 * - **Applying transforms**: {@link transformPoint3}, {@link transformVec3}, {@link transformVec4},
 *   {@link transformPositions3}, {@link transformPositions4}
 *
 * ## Performance notes
 *
 * Several helpers (eg. {@link decomposeMat4}, some closures like {@link scalingMat4c})
 * keep internal scratch vectors/matrices to avoid repeated allocations. These are not
 * thread-safe/re-entrant, but are safe for typical single-threaded JS execution.
 *
 * @module matrix
 */

import {
  createVec3Float64,
  createVec4Float64,
  lenVec3,
  normalizeVec4,
  type Vec3,
  type Vec4
} from "./vector";
import {clamp, type FloatArrayParam, newFloatArray} from "./index";
import {eulerToQuat, identityQuat, mat4ToQuat, type Quat, quatToRotationMat4} from "./quat";

/**
 * 3×3 single-precision float matrix.
 */
export type Mat3Float32 =
  | Float32Array<any>
  | [number, number, number, number, number, number, number, number, number];

/**
 * 3×3 double-precision float matrix.
 */
export type Mat3Float64 =
  | Float64Array<any>
  | [number, number, number, number, number, number, number, number, number];

/**
 * 4×4 single-precision float matrix.
 */
export type Mat4Float32 =
  | Float32Array<any>
  | [
    number, number, number, number,
  number, number, number, number,
  number, number, number, number,
  number, number, number, number];

/**
 * 3×3 floating-point matrix.
 */
export type Mat3 = Mat3Float32 | Mat3Float64;

export type Mat4Float64 =
  | Float64Array<any>
  | [
  number, number, number, number,
  number, number, number, number,
  number, number, number, number,
  number, number, number, number];

/**
 * Returns a 4x4 perspective projection matrix based on the given field of view, aspect ratio, and near/far clipping planes.
 *
 * This function generates a perspective projection matrix, which transforms 3D coordinates into 2D space. The matrix
 * maps the frustum defined by the near and far planes and the field of view into the canonical view volume.
 *
 * @param  fovyrad - The vertical field of view (in radians).
 * @param  aspectratio - The aspect ratio (width / height) of the viewport.
 * @param  znear - The distance to the near clipping plane.
 * @param  zfar - The distance to the far clipping plane.
 * @param {Mat4} [m] - An optional destination matrix to store the result. If not provided, a new matrix is created.
 *
 * @returns {Mat4} The resulting 4x4 perspective projection matrix. If `m` is provided, it will be modified; otherwise, a new matrix is returned.
 *
 * @example
 * const fov = Math.PI / 4; // 45 degrees in radians
 * const aspect = 16 / 9;
 * const znear = 0.1;
 * const zfar = 1000;
 * const matrix = perspectiveMat4(fov, aspect, znear, zfar);
 * console.log(matrix);
 */
export function perspectiveMat4(
  fovyrad: number,
  aspectratio: number,
  znear: number,
  zfar: number,
  m?: Mat4
): Mat4 {
  const pmin = createVec3Float64();
  const pmax = createVec3Float64();
  pmin[2] = znear;
  pmax[2] = zfar;
  pmax[1] = pmin[2] * Math.tan(fovyrad / 2.0);
  pmin[1] = -pmax[1];
  pmax[0] = pmax[1] * aspectratio;
  pmin[0] = -pmax[0];
  return frustumMat4v(pmin, pmax, m);
}

/**
 * Returns a new 4x4 matrix with 32-bit float values.
 * @param values - Optional initial values for the matrix (defaults to an empty 4x4 matrix).
 * @returns A new 4x4 matrix.
 */
export function createMat4Float32(values?: Mat4): Mat4 {
  return values ? new Float32Array(values) : new Float32Array(16);
}

/**
 * 4×4 floating-point matrix.
 */
export type Mat4 = Mat4Float32 | Mat4Float64;

const tempMat4a = createMat4Float64();
const tempMat4b = createVec3Float64();
const tempVec4a = createVec4Float64();
const tempVec4b = createVec4Float64();

/**
 * Returns a new 3x3 matrix.
 * @param values - Optional initial values for the matrix (defaults to an empty 3x3 matrix).
 * @returns A new 3x3 matrix.
 */
export function createMat3(values?: Mat3): Mat3 {
  return newFloatArray(values || 9) as Mat3;
}


/**
 * Returns a new 4x4 matrix with 64-bit float values.
 * @param values - Optional initial values for the matrix (defaults to an empty 4x4 matrix).
 * @returns A new 4x4 matrix.
 */
export function createMat4Float64(values?: Mat4): Mat4 {
  return values ? new Float64Array(values) : new Float64Array(16);
}


/**
 * Converts a 3x3 matrix to a 4x4 matrix.
 * @param mat3 - The input 3x3 matrix.
 * @param mat4 - The destination 4x4 matrix (optional).
 * @returns The converted 4x4 matrix.
 */
export function mat3ToMat4(mat3: Mat3, mat4?: Mat4): Mat4 {
  if (!mat4) {
    mat4 = createMat4Float64();
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
 * Compares two 4x4 matrices for equality.
 * @param m1 - The first matrix.
 * @param m2 - The second matrix.
 * @returns `true` if the matrices are the same, `false` otherwise.
 */
export function compareMat4(m1: Mat4, m2: Mat4): boolean {
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
 * Returns a 4x4 perspective frustum projection matrix, defined by the given near and far planes and the frustum bounds.
 *
 * This function generates a perspective frustum matrix, which is useful for 3D transformations that map coordinates
 * within a frustum defined by the near and far planes, and the left, right, bottom, and top frustum bounds.
 *
 * @param {Vec3} fmin - The minimum bounds of the frustum, represented as [left, bottom, near].
 * @param {Vec3} fmax - The maximum bounds of the frustum, represented as [right, top, far].
 * @param {Mat4} [m] - An optional destination matrix to store the result. If not provided, a new matrix is created.
 *
 * @returns {Mat4} The resulting 4x4 frustum projection matrix. If `m` is provided, it will be modified; otherwise, a new matrix is returned.
 *
 * @example
 * const fmin = [-1, -1, 0.1];
 * const fmax = [1, 1, 100];
 * const matrix = frustumMat4v(fmin, fmax);
 * console.log(matrix);
 */
export function frustumMat4v(
  fmin: Vec3,
  fmax: Vec3,
  m?: Mat4
): Mat4 {
  if (!m) {
    m = createMat4Float64();
  }
  const left = fmin[0], right = fmax[0];
  const bottom = fmin[1], top = fmax[1];
  const near = fmin[2], far = fmax[2];
  const rl = right - left;
  const tb = top - bottom;
  const fn = far - near;

  m[0] = (2 * near) / rl;
  m[1] = 0.0;
  m[2] = 0.0;
  m[3] = 0.0;

  m[4] = 0.0;
  m[5] = (2 * near) / tb;
  m[6] = 0.0;
  m[7] = 0.0;

  m[8] = (right + left) / rl;
  m[9] = (top + bottom) / tb;
  m[10] = -(far + near) / fn;
  m[11] = -1.0;

  m[12] = 0.0;
  m[13] = 0.0;
  m[14] = -(2 * near * far) / fn;
  m[15] = 0.0;

  return m;
}

/**
 * Returns a 4x4 orthographic projection matrix based on the given left, right, bottom, top, near, and far planes.
 *
 * This function creates an orthographic projection matrix, which maps 3D coordinates into a 2D plane while maintaining
 * the relative sizes of objects, unlike a perspective projection. It's commonly used for 2D rendering or for parallel projections.
 *
 * @param  left - The left boundary of the viewing volume.
 * @param  right - The right boundary of the viewing volume.
 * @param  bottom - The bottom boundary of the viewing volume.
 * @param  top - The top boundary of the viewing volume.
 * @param  near - The distance to the near clipping plane.
 * @param  far - The distance to the far clipping plane.
 * @param {Mat4} [dest] - An optional destination matrix to store the result. If not provided, a new matrix is created.
 *
 * @returns {Mat4} The resulting 4x4 orthographic projection matrix. If `dest` is provided, it will be modified; otherwise, a new matrix is returned.
 *
 * @example
 * const matrix = orthoMat4c(-1, 1, -1, 1, 0.1, 100);
 * console.log(matrix);
 */
export function orthoMat4c(
  left: number,
  right: number,
  bottom: number,
  top: number,
  near: number,
  far: number,
  dest?: Mat4
): Mat4 {
  if (!dest) {
    dest = createMat4Float64();
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
 * Returns a 4x4 perspective projection matrix based on the given frustum bounds.
 *
 * This function creates a perspective projection matrix from the left, right, bottom, top, near, and far frustum planes.
 * It is commonly used for 3D rendering where the perspective effect is required.
 *
 * @param  left - The left boundary of the frustum.
 * @param  right - The right boundary of the frustum.
 * @param  bottom - The bottom boundary of the frustum.
 * @param  top - The top boundary of the frustum.
 * @param  near - The distance to the near clipping plane.
 * @param  far - The distance to the far clipping plane.
 * @param {Mat4} [dest] - An optional destination matrix to store the result. If not provided, a new matrix is created.
 *
 * @returns {Mat4} The resulting 4x4 frustum projection matrix. If `dest` is provided, it will be modified; otherwise, a new matrix is returned.
 *
 * @example
 * const matrix = frustumMat4(-1, 1, -1, 1, 0.1, 100);
 * console.log(matrix);
 */
export function frustumMat4(
  left: number,
  right: number,
  bottom: number,
  top: number,
  near: number,
  far: number,
  dest?: Mat4
): Mat4 {
  if (!dest) {
    dest = createMat4Float64();
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
export function identityMat4(dest?: Mat4): Mat4 {
  if (!dest) {
    dest = createMat4Float64();
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
export function identityMat3(dest?: Mat3): Mat3 {
  if (!dest) {
    dest = createMat3();
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
export function isIdentityMat4(m: Mat4): boolean {
  if (m[0] !== 1.0 || m[1] !== 0.0 || m[2] !== 0.0 || m[3] !== 0.0 ||
    m[4] !== 0.0 || m[5] !== 1.0 || m[6] !== 0.0 || m[7] !== 0.0 ||
    m[8] !== 0.0 || m[9] !== 0.0 || m[10] !== 1.0 || m[11] !== 0.0 ||
    m[12] !== 0.0 || m[13] !== 0.0 || m[14] !== 0.0 || m[15] !== 1.0) {
    return false;
  }
  return true;
}

/**
 * Creates a 4x4 rotation matrix that rotates a given vector around an arbitrary axis by a specified angle.
 *
 * This function generates a rotation matrix for 3D transformations. The matrix will rotate vectors by
 * an angle (`anglerad`) around a specified axis (`axis`). The resulting matrix is typically used in 3D
 * rendering to rotate objects in space.
 *
 * @param  anglerad - The angle of rotation in radians.
 * @param {Vec3} axis - The axis of rotation, represented as a 3D vector (x, y, z).
 * @param {Mat4} [m] - An optional destination matrix to store the result. If not provided, a new matrix will be created.
 *
 * @returns {Mat4} The resulting 4x4 rotation matrix. If `m` is provided, it will be modified; otherwise, a new matrix is returned.
 *
 * @example
 * const axis = [0, 1, 0];  // Rotate around the y-axis
 * const angle = Math.PI / 4;  // 45 degrees in radians
 * const matrix = rotationMat4v(angle, axis);
 * console.log(matrix);
 */
export function rotationMat4v(
  anglerad: number,
  axis: Vec3,
  m?: Mat4
): Mat4 {
  if (!m) {
    m = createMat4Float64();
  }

  // Normalize the axis to ensure it's a unit vector
  const ax = normalizeVec4([axis[0], axis[1], axis[2], 0.0], createVec4Float64());
  const s = Math.sin(anglerad);
  const c = Math.cos(anglerad);
  const q = 1.0 - c;

  // Extract axis components
  const x = ax[0];
  const y = ax[1];
  const z = ax[2];

  // Pre-compute terms to avoid redundant calculations
  const xy = x * y;
  const yz = y * z;
  const zx = z * x;
  const xs = x * s;
  const ys = y * s;
  const zs = z * s;

  // Set the rotation matrix
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
 * Creates a 4x4 'lookAt' viewing transformation matrix.
 *
 * This function generates a look-at matrix that transforms objects from world space to camera space,
 * where the camera is positioned at `pos`, looks at `target`, and the `up` vector defines the camera's up direction.
 * The resulting matrix is commonly used in 3D rendering for setting the camera's view transformation.
 *
 * @param {Vec3} pos - The position of the camera in world space (x, y, z).
 * @param {Vec3} target - The target position the camera is looking at in world space (x, y, z).
 * @param {Vec3} up - The up vector of the camera in world space (x, y, z).
 * @param {Mat4} [dest] - An optional destination matrix to store the result. If not provided, a new matrix will be created.
 *
 * @returns {Mat4} The resulting 4x4 look-at matrix. If `dest` is provided, it will be modified; otherwise, a new matrix is returned.
 *
 * @example
 * const cameraPosition = [0, 0, 5];
 * const targetPosition = [0, 0, 0];
 * const upVector = [0, 1, 0];
 * const matrix = lookAtMat4v(cameraPosition, targetPosition, upVector);
 * console.log(matrix);
 */
export function lookAtMat4v(
  pos: Vec3,
  target: Vec3,
  up: Vec3,
  dest?: Mat4
): Mat4 {
  if (!dest) {
    dest = createMat4Float64();
  }

  const [posx, posy, posz] = pos;
  const [upx, upy, upz] = up;
  const [targetx, targety, targetz] = target;

  // Return identity matrix if the position and target are the same
  if (posx === targetx && posy === targety && posz === targetz) {
    return identityMat4();
  }

  // Calculate the forward (z) direction
  let z0 = posx - targetx;
  let z1 = posy - targety;
  let z2 = posz - targetz;

  // Normalize the forward vector
  let len = 1 / Math.sqrt(z0 * z0 + z1 * z1 + z2 * z2);
  z0 *= len;
  z1 *= len;
  z2 *= len;

  // Calculate the right (x) direction
  let x0 = upy * z2 - upz * z1;
  let x1 = upz * z0 - upx * z2;
  let x2 = upx * z1 - upy * z0;

  // Normalize the right vector
  len = Math.sqrt(x0 * x0 + x1 * x1 + x2 * x2);
  if (len) {
    len = 1 / len;
    x0 *= len;
    x1 *= len;
    x2 *= len;
  } else {
    x0 = x1 = x2 = 0;
  }

  // Calculate the up (y) direction
  let y0 = z1 * x2 - z2 * x1;
  let y1 = z2 * x0 - z0 * x2;
  let y2 = z0 * x1 - z1 * x0;

  // Normalize the up vector
  len = Math.sqrt(y0 * y0 + y1 * y1 + y2 * y2);
  if (len) {
    len = 1 / len;
    y0 *= len;
    y1 *= len;
    y2 *= len;
  } else {
    y0 = y1 = y2 = 0;
  }

  // Set the matrix values
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
export function inverseMat4(mat: Mat4, dest?: Mat4): Mat4 {
  if (!dest) {
    dest = mat;
  }

  const [
    a00, a01, a02, a03,
    a10, a11, a12, a13,
    a20, a21, a22, a23,
    a30, a31, a32, a33
  ] = mat;

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

  const invDet = 1 / (
    b00 * b11 - b01 * b10 + b02 * b09 +
    b03 * b08 - b04 * b07 + b05 * b06
  );

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
export function transposeMat4(mat: Mat4, dest?: Mat4): Mat4 {
  const [
    m00, m01, m02, m03,
    m10, m11, m12, m13,
    m20, m21, m22, m23,
    m30, m31, m32, m33
  ] = mat;

  if (!dest || mat === dest) {
    mat[1] = m10;
    mat[2] = m20;
    mat[3] = m30;
    mat[4] = m01;
    mat[6] = m21;
    mat[7] = m31;
    mat[8] = m02;
    mat[9] = m12;
    mat[11] = m32;
    mat[12] = m03;
    mat[13] = m13;
    mat[14] = m23;
    return mat;
  }

  dest[0] = m00;
  dest[1] = m10;
  dest[2] = m20;
  dest[3] = m30;
  dest[4] = m01;
  dest[5] = m11;
  dest[6] = m21;
  dest[7] = m31;
  dest[8] = m02;
  dest[9] = m12;
  dest[10] = m22;
  dest[11] = m32;
  dest[12] = m03;
  dest[13] = m13;
  dest[14] = m23;
  dest[15] = m33;

  return dest;
}

/**
 * Multiplies a 4x4 matrix by a four-element vector.
 */
export function mulMat4v4(m: Mat4, v: Vec4, dest?: Mat4): Mat4 {
  dest = dest || m;
  const [v0, v1, v2, v3] = v;

  dest[0] = m[0] * v0 + m[4] * v1 + m[8] * v2 + m[12] * v3;
  dest[1] = m[1] * v0 + m[5] * v1 + m[9] * v2 + m[13] * v3;
  dest[2] = m[2] * v0 + m[6] * v1 + m[10] * v2 + m[14] * v3;
  dest[3] = m[3] * v0 + m[7] * v1 + m[11] * v2 + m[15] * v3;

  return dest;
}

/**
 * Multiplies two 4x4 matrices and stores the result in a destination matrix.
 */
export function mulMat4(a: Mat4, b: Mat4, dest?: Mat4): Mat4 {
  dest = dest || a;

  const [a00, a01, a02, a03, a10, a11, a12, a13, a20, a21, a22, a23, a30, a31, a32, a33] = a;
  const [b00, b01, b02, b03, b10, b11, b12, b13, b20, b21, b22, b23, b30, b31, b32, b33] = b;

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
 * Multiplies two 3x3 matrices and stores the result in a destination matrix.
 */
export function mulMat3(a: Mat3, b: Mat3, dest: Mat3 = createMat3()) {
  const [a11, a12, a13, a21, a22, a23, a31, a32, a33] = a;
  const [b11, b12, b13, b21, b22, b23, b31, b32, b33] = b;

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
 * Transforms a 3D point by a 4x4 matrix.
 */
export function transformPoint3(m: Mat4, p: Vec3, dest?: Vec3) {
  dest = dest || p;
  const [x, y, z] = p;

  dest[0] = m[0] * x + m[4] * y + m[8] * z + m[12];
  dest[1] = m[1] * x + m[5] * y + m[9] * z + m[13];
  dest[2] = m[2] * x + m[6] * y + m[10] * z + m[14];

  return dest;
}

/**
 * Transforms a homogeneous coordinate by a 4x4 matrix.
 */
export function transformPoint4(m: Mat4, v: Vec4, dest: Vec4): Vec4 {
  const [v0, v1, v2, v3] = v;

  dest[0] = m[0] * v0 + m[4] * v1 + m[8] * v2 + m[12] * v3;
  dest[1] = m[1] * v0 + m[5] * v1 + m[9] * v2 + m[13] * v3;
  dest[2] = m[2] * v0 + m[6] * v1 + m[10] * v2 + m[14] * v3;
  dest[3] = m[3] * v0 + m[7] * v1 + m[11] * v2 + m[15] * v3;

  return dest;
}

/**
 * Transforms an array of 3D positions by a 4x4 matrix.
 */
export function transformPoints3(m: Mat4, points: number[][], result: number[][] = []) {
  const len = points.length;

  const [m0, m1, m2, m3, m4, m5, m6, m7, m8, m9, m10, m11, m12, m13, m14, m15] = m;

  for (let i = 0; i < len; ++i) {
    const [p0, p1, p2] = points[i];
    const r = result[i] || (result[i] = [0, 0, 0]);

    r[0] = m0 * p0 + m4 * p1 + m8 * p2 + m12;
    r[1] = m1 * p0 + m5 * p1 + m9 * p2 + m13;
    r[2] = m2 * p0 + m6 * p1 + m10 * p2 + m14;
    r[3] = m3 * p0 + m7 * p1 + m11 * p2 + m15;
  }

  result.length = len;
  return result;
}

/**
 * Transforms an array of 3D positions by a 4x4 matrix.
 */
export function transformPositions3(m: Mat4, p: FloatArrayParam, p2: FloatArrayParam = p) {
  const len = p.length;

  const [m0, m1, m2, m3, m4, m5, m6, m7, m8, m9, m10, m11, m12, m13, m14, m15] = m;

  for (let i = 0; i < len; i += 3) {
    const x = p[i];
    const y = p[i + 1];
    const z = p[i + 2];

    p2[i] = m0 * x + m4 * y + m8 * z + m12;
    p2[i + 1] = m1 * x + m5 * y + m9 * z + m13;
    p2[i + 2] = m2 * x + m6 * y + m10 * z + m14;
    p2[i + 3] = m3 * x + m7 * y + m11 * z + m15;
  }

  return p2;
}


/**
 * Transforms an array of 3D positions by a 4x4 matrix.
 * @param m - The 4x4 transformation matrix.
 * @param p - The array of positions to transform. Each position is a set of 4 values (x, y, z, w).
 * @param p2 - An optional array to store the result. Defaults to `p` if not provided.
 * @returns The transformed positions.
 */
export function transformPositions4(m: Mat4, p: FloatArrayParam, p2: FloatArrayParam = p): FloatArrayParam {
  const len = p.length;
  const m0 = m[0], m1 = m[1], m2 = m[2], m3 = m[3];
  const m4 = m[4], m5 = m[5], m6 = m[6], m7 = m[7];
  const m8 = m[8], m9 = m[9], m10 = m[10], m11 = m[11];
  const m12 = m[12], m13 = m[13], m14 = m[14], m15 = m[15];

  // Iterate over positions, applying the transformation for each set of 4 values (x, y, z, w)
  for (let i = 0; i < len; i += 4) {
    const x = p[i], y = p[i + 1], z = p[i + 2];

    p2[i] = (m0 * x) + (m4 * y) + (m8 * z) + m12;
    p2[i + 1] = (m1 * x) + (m5 * y) + (m9 * z) + m13;
    p2[i + 2] = (m2 * x) + (m6 * y) + (m10 * z) + m14;
    p2[i + 3] = (m3 * x) + (m7 * y) + (m11 * z) + m15;
  }
  return p2;
}

/**
 * Transforms a 3D vector by a 4x4 matrix.
 * @param m - The 4x4 transformation matrix.
 * @param v - The 3D vector to transform (x, y, z).
 * @param dest - An optional array to store the result. If not provided, a new vector is created.
 * @returns The transformed vector.
 */
export function transformVec3(m: Mat4, v: Vec3, dest: Vec3 = createVec3Float64()): Vec3 {
  const v0 = v[0], v1 = v[1], v2 = v[2];

  dest[0] = (m[0] * v0) + (m[4] * v1) + (m[8] * v2);
  dest[1] = (m[1] * v0) + (m[5] * v1) + (m[9] * v2);
  dest[2] = (m[2] * v0) + (m[6] * v1) + (m[10] * v2);

  return dest;
}

/**
 * Transforms a 4D vector by a 4x4 matrix.
 * @param m - The 4x4 transformation matrix.
 * @param v - The 4D vector to transform (x, y, z, w).
 * @param dest - An optional array to store the result. If not provided, a new vector is created.
 * @returns The transformed 4D vector.
 */
export function transformVec4(m: Mat4, v: Vec4, dest: Vec4 = createVec4Float64()): Vec4 {
  const v0 = v[0], v1 = v[1], v2 = v[2], v3 = v[3];

  dest[0] = m[0] * v0 + m[4] * v1 + m[8] * v2 + m[12] * v3;
  dest[1] = m[1] * v0 + m[5] * v1 + m[9] * v2 + m[13] * v3;
  dest[2] = m[2] * v0 + m[6] * v1 + m[10] * v2 + m[14] * v3;
  dest[3] = m[3] * v0 + m[7] * v1 + m[11] * v2 + m[15] * v3;

  return dest;
}

/**
 * Efficiently applies scaling to a 4x4 matrix.
 * @param xyz - The scaling vector (x, y, z).
 * @param m - The matrix to apply the scaling to. Defaults to the identity matrix if not provided.
 * @returns The matrix with the scaling applied.
 */
export function scaleMat4v(xyz: Vec3, m: Mat4 = identityMat4()): Mat4 {
  const [x, y, z] = xyz;

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
 * Sets a 4x4 matrix to represent a scaling transformation.
 * @param v - The scaling vector (x, y, z).
 * @param m - The matrix to store the result. Defaults to the identity matrix.
 * @returns The matrix representing the scaling.
 */
export function scalingMat4v(v: Vec3, m: Mat4 = identityMat4()): Mat4 {
  m[0] = v[0];
  m[5] = v[1];
  m[10] = v[2];
  return m;
}

/**
 * Returns a 3x3 scaling matrix based on the given vector.
 * @param v - The scaling vector (x, y).
 * @param m - The matrix to store the result. Defaults to the identity matrix.
 * @returns The resulting 3x3 scaling matrix.
 */
export function scalingMat3v(v: Vec3, m: Mat3 = identityMat3()): Mat3 {
  m[0] = v[0];
  m[4] = v[1];
  return m;
}

/**
 * Returns a 4x4 scale matrix.
 * @param x - The scale factor along the x-axis.
 * @param y - The scale factor along the y-axis.
 * @param z - The scale factor along the z-axis.
 * @param dest - An optional matrix to store the result. Defaults to a new matrix.
 * @returns The resulting 4x4 scale matrix.
 */
export const scalingMat4c = (() => {
  const xyz: Vec3 = createVec3Float64();
  return (x: number, y: number, z: number, dest?: Mat4) => {
    xyz[0] = x;
    xyz[1] = y;
    xyz[2] = z;
    return scalingMat4v(xyz, dest);
  };
})();

/**
 * Efficiently applies scaling to a 4x4 matrix using individual scale factors.
 * @param x - The scale factor along the x-axis.
 * @param y - The scale factor along the y-axis.
 * @param z - The scale factor along the z-axis.
 * @param m - The matrix to apply the scaling to.
 * @returns The matrix with the scaling applied.
 */
export function scaleMat4c(x: number, y: number, z: number, m: Mat4): Mat4 {
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
 * Returns a 4x4 scaling matrix with uniform scaling.
 * @param s - The scale factor applied to all axes.
 * @returns The resulting scaling matrix.
 */
export function scalingMat4s(s: number): Mat4 {
  return scalingMat4c(s, s, s);
}

/**
 * Composes a 4x4 matrix from position, quaternion, and scale.
 * This matrix transformation is applied in the order of rotation -> scale -> translation.
 * @param position - The position vector to translate by.
 * @param quaternion - The quaternion representing rotation.
 * @param scale - The scaling factor for each axis.
 * @param mat - An optional pre-allocated matrix for the result. Defaults to an identity matrix.
 * @returns The resulting composed matrix.
 */
export function composeMat4(
  position: Vec3,
  quaternion: Quat,
  scale: Vec3,
  mat: Mat4 = createMat4Float64()
): Mat4 {
  quatToRotationMat4(quaternion, mat); // Apply rotation first
  scaleMat4v(scale, mat); // Apply scale
  translateMat4v(position, mat); // Apply translation last
  return mat;
}

/**
 * Composes a 4x4 matrix from position, Euler rotation angles, and scale.
 * The Euler angles are converted to a quaternion for rotation.
 * @param position - The position vector to translate by.
 * @param rotation - The Euler angles for rotation (in radians).
 * @param scale - The scaling factor for each axis.
 * @param mat - An optional pre-allocated matrix for the result. Defaults to an identity matrix.
 * @returns The resulting composed matrix.
 */
export function composeMat4Euler(
  position: Vec3,
  rotation: Vec3,
  scale: Vec3,
  mat: Mat4 = createMat4Float64()
): Mat4 {
  quatToRotationMat4(eulerToQuat(rotation, "XYZ", identityQuat()), mat); // Convert Euler to quaternion and apply rotation
  scaleMat4v(scale, mat); // Apply scale
  translateMat4v(position, mat); // Apply translation
  return mat;
}

/**
 * Decomposes a 4x4 matrix into position, quaternion, and scale components.
 * @param mat - The matrix to decompose.
 * @param position - The resulting position vector.
 * @param quaternion - The resulting quaternion representing rotation.
 * @param scale - The resulting scale vector.
 */
export const decomposeMat4 = (() => {
  const vec = createVec3Float64(); // Temporary vector
  const matrix: Float64Array = createMat4Float64() as Float64Array; // Temporary matrix
  return function decompose(
    mat: Mat4,
    position: Vec3,
    quaternion: Quat,
    scale: Vec3
  ) {
    // Extract scale factors
    vec[0] = mat[0];
    vec[1] = mat[1];
    vec[2] = mat[2];
    let sx = lenVec3(vec); // Scale factor for x-axis
    vec[0] = mat[4];
    vec[1] = mat[5];
    vec[2] = mat[6];
    const sy = lenVec3(vec); // Scale factor for y-axis
    vec[8] = mat[8];
    vec[9] = mat[9];
    vec[10] = mat[10];
    const sz = lenVec3(vec); // Scale factor for z-axis

    const det = determinantMat4(mat);
    if (det < 0) {
      sx = -sx; // Adjust scale if determinant is negative (reflection case)
    }

    // Extract position (translation)
    position[0] = mat[12];
    position[1] = mat[13];
    position[2] = mat[14];

    // Scale the rotation part of the matrix
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

    mat4ToQuat(matrix, quaternion); // Extract rotation as quaternion
    scale[0] = sx; // Store scale factors
    scale[1] = sy;
    scale[2] = sz;
  };
})();

/**
 * Efficiently applies a translation to the given matrix.
 * This translation is post-concatenated to the existing matrix.
 * @param xyz - The translation vector to apply.
 * @param m - The matrix to apply the translation to. Defaults to the identity matrix.
 * @returns The resulting matrix after applying the translation.
 */
export function translateMat4v(xyz: Vec3, m: Mat4 = identityMat4()): Mat4 {
  return translateMat4c(xyz[0], xyz[1], xyz[2], m);
}

/**
 * Efficiently applies a translation to the given matrix using separate components.
 * This translation is post-concatenated to the existing matrix.
 * @param x - The translation along the x-axis.
 * @param y - The translation along the y-axis.
 * @param z - The translation along the z-axis.
 * @param m - The matrix to apply the translation to. Defaults to the identity matrix.
 * @returns The resulting matrix after applying the translation.
 */
export function translateMat4c(x: number, y: number, z: number, m: Mat4 = identityMat4()): Mat4 {
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
 * affine matrix with the provided translation vector.
 * @param m - The matrix to modify.
 * @param translation - The new translation vector.
 * @param dest - The matrix to store the result.
 * @returns The resulting matrix with the updated translation.
 */
export function setMat4Translation(m: Mat4, translation: Vec3, dest: Mat4): Mat4 {

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
  dest[15] = m[15]; // Copy homogeneous coordinate (bottom-right value)
  return dest;
}


/**
 * Returns a 4x4 translation matrix.
 * @param v The translation vector [x, y, z].
 * @param dest Optional destination matrix, if not provided a new matrix will be created.
 * @returns The translation matrix.
 */
export function translationMat4v(v: Vec3, dest?: Mat4): Mat4 {
  const m = dest || identityMat4();
  m[12] = v[0];
  m[13] = v[1];
  m[14] = v[2];
  return m;
}

/**
 * Returns a 3x3 translation matrix.
 * @param v The translation vector [x, y].
 * @param dest Optional destination matrix, if not provided a new matrix will be created.
 * @returns The translation matrix.
 */
export function translationMat3v(v: Vec3, dest?: Mat3): Mat3 {
  const m = dest || identityMat3();
  m[6] = v[0];
  m[7] = v[1];
  return m;
}

/**
 * Returns a 4x4 translation matrix from x, y, and z components.
 * @param x The translation on the x-axis.
 * @param y The translation on the y-axis.
 * @param z The translation on the z-axis.
 * @param dest Optional destination matrix, if not provided a new matrix will be created.
 * @returns The translation matrix.
 */
export const translationMat4c = ((() => {
  const xyz = createVec3Float64();
  return (x: number, y: number, z: number, dest: Mat4): Mat4 => {
    xyz[0] = x;
    xyz[1] = y;
    xyz[2] = z;
    return translationMat4v(xyz, dest);
  };
}))();

/**
 * Returns a 4x4 translation matrix with uniform scaling.
 * @param s The scale value for all axes.
 * @param dest The destination matrix.
 * @returns The scaled translation matrix.
 */
export function translationMat4s(s: number, dest: Mat4) {
  return translationMat4c(s, s, s, dest);
}

/**
 * Computes the determinant of a 4x4 matrix.
 * @param mat The 4x4 matrix.
 * @returns The determinant of the matrix.
 */
export function determinantMat4(mat: Mat4): number {
  const [a00, a01, a02, a03, a10, a11, a12, a13, a20, a21, a22, a23, a30, a31, a32, a33] = mat;
  return a30 * a21 * a12 * a03 - a20 * a31 * a12 * a03 - a30 * a11 * a22 * a03 + a10 * a31 * a22 * a03 +
    a20 * a11 * a32 * a03 - a10 * a21 * a32 * a03 - a30 * a21 * a02 * a13 + a20 * a31 * a02 * a13 +
    a30 * a01 * a22 * a13 - a00 * a31 * a22 * a13 - a20 * a01 * a32 * a13 + a00 * a21 * a32 * a13 +
    a30 * a11 * a02 * a23 - a10 * a31 * a02 * a23 - a30 * a01 * a12 * a23 + a00 * a31 * a12 * a23 +
    a10 * a01 * a32 * a23 - a00 * a11 * a32 * a23 - a20 * a11 * a02 * a33 + a10 * a21 * a02 * a33 +
    a20 * a01 * a12 * a33 - a00 * a21 * a12 * a33 - a10 * a01 * a22 * a33 + a00 * a11 * a22 * a33;
}

/**
 * Converts a 4x4 matrix to Euler angles.
 * @param mat The 4x4 matrix.
 * @param order The Euler angle order (e.g., "XYZ", "YXZ", "ZXY").
 * @param dest Optional destination for Euler angles, if not provided a new vector will be created.
 * @returns The Euler angles in the specified order.
 */
export function mat4ToEuler(mat: Mat4, order: string, dest: Vec3 = createVec3Float64()) {
  const [m11, m12, m13, m21, m22, m23, m31, m32, m33] = mat;

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
 * @param t The interpolation factor.
 * @param t1 The start of the interpolation range.
 * @param t2 The end of the interpolation range.
 * @param m1 The first matrix.
 * @param m2 The second matrix.
 * @param dest Optional destination matrix, if not provided a new matrix will be created.
 * @returns The interpolated matrix.
 */
export function lerpMat4(t: number, t1: number, t2: number, m1: Mat4, m2: Mat4, dest?: Mat4) {
  const result = dest || createMat4Float64();
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
 * Creates a three-element vector from the rotation part of a 16-element matrix.
 * @param m - The 4x4 matrix.
 * @param dest - The destination vector to store the result.
 * @returns The vector representing the scale part of the matrix.
 */
export const vec3FromMat4Scale: Function = ((() => {
  const tempVec3 = createVec3Float64();
  return function (m: Mat4, dest: Vec3) {
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
