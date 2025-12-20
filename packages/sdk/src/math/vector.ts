
import type {IntTypedArray} from "./misc";
import type {FloatArrayParam} from "./index";

/**
 * ============================================================
 * Generic fixed-length tuple primitives
 * ============================================================
 */

/**
 * Generic 2-element vector tuple.
 */
export type Vec2Generic<T = number> = [T, T];

/**
 * Generic 3-element vector tuple.
 */
export type Vec3Generic<T = number> = [T, T, T];

/**
 * Generic 4-element vector tuple.
 */
export type Vec4Generic<T = number> = [T, T, T, T];

/**
 * Generic 9-element vector tuple.
 */
export type Vec9Generic<T = number> = [
  T, T, T,
  T, T, T,
  T, T, T
];

/**
 * 2-element integer vector.
 */
export type Vec2Int =
  | IntTypedArray
  | Vec2Generic;

/**
 * 3-element integer vector.
 */
export type Vec3Int =
  | IntTypedArray
  | Vec3Generic;

/**
 * 4-element integer vector.
 */
export type Vec4Int =
  | IntTypedArray
  | Vec4Generic;

/**
 * ============================================================
 * Floating-point vectors (explicit precision)
 * ============================================================
 */

/**
 * 2-element single-precision float vector.
 */
export type Vec2Float32 =
  | Float32Array<number>
  | Vec2Generic;

/**
 * 2-element double-precision float vector.
 */
export type Vec2Float64 =
  | Float64Array<number>
  | Vec2Generic;

/**
 * 3-element single-precision float vector.
 */
export type Vec3Float32 =
  | Float32Array<number>
  | Vec3Generic;

/**
 * 3-element double-precision float vector.
 */
export type Vec3Float64 =
  | Float64Array<number>
  | Vec3Generic;

/**
 * 4-element single-precision float vector.
 */
export type Vec4Float32 =
  | Float32Array<number>
  | Vec4Generic;

/**
 * 4-element double-precision float vector.
 */
export type Vec4Float64 =
  | Float64Array<number>
  | Vec4Generic;

/**
 * 9-element single-precision float vector.
 */
export type Vec9Float32 =
  | Float32Array<number>
  | Vec9Generic;

/**
 * 9-element double-precision float vector.
 */
export type Vec9Float64 =
  | Float64Array<number>
  | Vec9Generic;

/**
 * ============================================================
 * Floating-point vectors (either precision)
 * ============================================================
 */

/**
 * 2-element float vector (Float32 or Float64).
 */
export type Vec2Float = Vec2Float32 | Vec2Float64;

/**
 * 3-element float vector (Float32 or Float64).
 */
export type Vec3Float = Vec3Float32 | Vec3Float64;

/**
 * 4-element float vector (Float32 or Float64).
 */
export type Vec4Float = Vec4Float32 | Vec4Float64;

/**
 * 9-element float vector (Float32 or Float64).
 */
export type Vec9Float = Vec9Float32 | Vec9Float64;

/**
 * ============================================================
 * General vectors (integer or float)
 * ============================================================
 */

/**
 * 2-element numeric vector.
 */
export type Vec2 = Vec2Int | Vec2Float;

/**
 * 3-element numeric vector.
 */
export type Vec3 = Vec3Int | Vec3Float;

/**
 * 4-element numeric vector.
 */
export type Vec4 = Vec4Int | Vec4Float;

/**
 * 9-element numeric vector.
 */
export type Vec9 = Vec9Float32 | Vec9Float64;


/**
 * Creates a new 2D double-precision float vector.
 * @param values
 */
export function createVec2Float64(values?: Vec2): Vec2 {
  // @ts-ignore
  return new Float64Array(values || 2);
}

/**
 * Creates a new 2D single-precision float vector.
 * @param values
 */
export function createVec2Int32(values?: Vec2): Vec2Int {
  // @ts-ignore
  return new Int32Array(values || 2);
}

/**
 * Creates a new 3D double-precision float vector.
 * @param values
 */
export function createVec3Float64(values?: Vec3): Vec3Float64 {
  // @ts-ignore
  return new Float64Array(values || 3);
}

export function createVec3Float32(values?: Vec3): Vec3Float32 {
  // @ts-ignore
  return new Float32Array(values || 3);
}

export function createVec3Int32(values?: Vec3): Vec3Int {
  // @ts-ignore
  return new Int32Array(values || 3);
}

export function createVec2Int16(values?: Vec2): Vec2Int {
  // @ts-ignore
  return new Int16Array(values || 2);
}

/**
 * Creates a new 4D double-precision float vector.
 */
export function createVec4Float64(values?: Vec4): Vec4Float {
  // @ts-ignore
  return new Float64Array(values || 4);
}

/**
 * Creates a new 4D single-precision float vector.
 * @param values
 */
export function createVec4Float32(values?: Vec4): Vec4Float32 {
  // @ts-ignore
  return new Float32Array(values || 4);
}

/**
 * Creates a new 4D integer vector.
 * @param values
 */
export function createVec4Int32(values?: Vec4): Vec4Int {
  // @ts-ignore
  return new Int32Array(values || 4);
}

/**
 * Creates a new 4D integer vector.
 * @param values
 */
export function createVec4Int16(values?: Vec4): Vec4Int {
  // @ts-ignore
  return new Int16Array(values || 4);
}

/**
 * Creates a new 9-element vector.
 * @param values Optional initial values for the vector.
 * @returns The new 9-element vector.
 */
export function createVec9(values?: Vec9): Vec9 {
  // @ts-ignore
  return new Float64Array(values || 9);
}


/**
 * Calculates and returns the dot product of two 3D vectors.
 *
 * The dot product is a scalar value computed as the sum of the products of the corresponding elements
 * of the two vectors. This operation is widely used in many algorithms, including determining angles between vectors.
 *
 * @param u The first 3D vector.
 * @param v The second 3D vector.
 * @returns The dot product of the two vectors.
 */
export function dotVec3(u: Vec3, v: Vec3): number {
  return (u[0] * v[0] + u[1] * v[1] + u[2] * v[2]);
}

/**
 * Negates a 3D vector.
 *
 * This function computes the negative of the provided 3D vector by multiplying each of its components by -1.
 * The result is stored in the provided destination vector or in the original vector if no destination is provided.
 *
 * @param v The 3D vector to negate.
 * @param dest Optional destination vector to store the result. If not provided, the result is stored in the input vector.
 * @returns The negated 3D vector.
 */
export function negateVec3(v: Vec3, dest?: Vec3): Vec3 {
  if (!dest) {
    dest = v;
  }
  dest[0] = -v[0];
  dest[1] = -v[1];
  dest[2] = -v[2];
  return dest;
}

/**
 * Negates a 4D vector.
 *
 * This function negates each element of the provided 4D vector and stores the result in the destination vector.
 * If no destination is provided, the original vector is modified.
 *
 * @param v The 4D vector to negate.
 * @param dest Optional destination vector to store the result. If not provided, the result is stored in the input vector.
 * @returns The negated 4D vector.
 */
export function negateVec4(v: Vec4, dest?: Vec4): Vec4 {
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
 * Adds two 4D vectors element-wise.
 *
 * This function adds the corresponding elements of the two input vectors and stores the result in the destination
 * vector. If no destination is provided, the first input vector is modified and returned.
 *
 * @param u The first 4D vector.
 * @param v The second 4D vector.
 * @param dest Optional destination vector to store the result. If not provided, the result is stored in the first vector.
 * @returns The resulting 4D vector after addition.
 */
export function addVec4(u: Vec4, v: Vec4, dest?: Vec4): Vec4 {
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
 * @param  v The four-element vector
 * @param  s The scalar value to add
 * @param  [dest] The destination vector, optional
 * @return  The resulting vector after addition
 */
export function addVec4Scalar(v: Vec4, s: number, dest?: Vec4) {
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
 * @param  v The four-element vector
 * @param  s The scalar value to multiply
 * @param  [dest] The destination vector, optional
 * @return  The resulting vector after multiplication
 */
export function mulVec4Scalar(v: Vec4, s: number, dest: Vec4) {
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
 * @param {Vec3} v The three-element vector
 * @param  s The scalar value to multiply
 * @param {Vec3} [dest] The destination vector, optional
 * @return {Vec3} The resulting vector after multiplication
 */
export function mulVec3Scalar(v: Vec3, s: number, dest?: Vec3): Vec3 {
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
 * @param  v The two-element vector
 * @param  s The scalar value to multiply
 * @param  [dest] The destination vector, optional
 * @return  The resulting vector after multiplication
 */
export function mulVec2Scalar(v: Vec2, s: number, dest?: Vec2): Vec2 {
  if (!dest) {
    dest = v;
  }
  dest[0] = v[0] * s;
  dest[1] = v[1] * s;
  return dest;
}

/**
 * Adds one three-element vector to another.
 * @param {Vec3} u The first three-element vector
 * @param {Vec3} v The second three-element vector
 * @param {Vec3} [dest] The destination vector, optional
 * @return {Vec3} The resulting vector after addition
 */
export function addVec3(u: Vec3, v: Vec3, dest?: Vec3): Vec3 {
  if (!dest) {
    dest = u;
  }
  dest[0] = u[0] + v[0];
  dest[1] = u[1] + v[1];
  dest[2] = u[2] + v[2];
  return dest;
}

/**
 * Adds a scalar value to each element of a three-element vector.
 * @param {Vec3} v The three-element vector
 * @param  s The scalar value to add
 * @param {Vec3} [dest] The destination vector, optional
 * @return {Vec3} The resulting vector after addition
 */
export function addVec3Scalar(v: Vec3, s: number, dest?: Vec3) {
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
 * @param  u The first four-element vector
 * @param  v The second four-element vector
 * @param  [dest] The destination vector, optional
 * @return  The resulting vector after subtraction
 */
export function subVec4(u: Vec4, v: Vec4, dest?: Vec4) {
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
 * @param {Vec3} v1 The first three-element vector
 * @param {Vec3} v2 The second three-element vector
 * @return {boolean} True if the vectors are the same, otherwise false
 */
export function compareVec3(v1: Vec3, v2: Vec3): boolean {
  return (v1[0] === v2[0] && v1[1] === v2[1] && v1[2] === v2[2]);
}

/**
 * Subtracts one three-element vector from another.
 * @param {Vec3} u The first three-element vector
 * @param {Vec3} v The second three-element vector
 * @param {Vec3} [dest] The destination vector, optional
 * @return {Vec3} The resulting vector after subtraction
 */
export function subVec3(u: Vec3, v: Vec3, dest?: Vec3) {
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
 * @param  u The first two-element vector
 * @param  v The second two-element vector
 * @param  [dest] The destination vector, optional
 * @return  The resulting vector after subtraction
 */
export function subVec2(u: Vec2, v: Vec2, dest?: Vec2) {
  if (!dest) {
    dest = u;
  }
  dest[0] = u[0] - v[0];
  dest[1] = u[1] - v[1];
  return dest;
}

/**
 * Get the geometric mean of the vectors.
 * @param {...any} vectors The vectors to compute the geometric mean of
 * @param {Vec2} geometricMean The vector to store the geometric mean in
 * @return {Vec2}  The geometric mean of the vectors
 */
export function geometricMeanVec2(vectors: any, geometricMean: Vec2): Vec2 {
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
 * @param  v The four-element vector
 * @param  s The scalar value to subtract
 * @param  [dest] The destination vector, optional
 * @return  The resulting vector after subtraction
 */
export function subVec4Scalar(v: Vec4, s: number, dest?: Vec4) {
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
 * @param  v The four-element vector
 * @param  s The scalar value
 * @param  [dest] The destination vector, optional
 * @return  The resulting vector after subtraction
 */
export function subScalarVec4(v: Vec4, s: number, dest?: Vec4) {
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
 * @param {Vec3} u The first three-element vector
 * @param {Vec3} v The second three-element vector
 * @param {Vec3} [dest] The destination vector, optional
 * @return {Vec3} The resulting vector after multiplication
 */
export function mulVec4(u: Vec3, v: Vec3, dest?: Vec3) {
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
 * @param {Vec3} u The first three-element vector
 * @param {Vec3} v The second three-element vector
 * @param {Vec3} [dest] The destination vector, optional
 * @return {Vec3} The resulting vector after division
 */
export function divVec3(u: Vec3, v: Vec3, dest?: Vec3) {
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
 * @param  u The first four-element vector
 * @param  v The second four-element vector
 * @param  [dest] The destination vector, optional
 * @return  The resulting vector after division
 */
export function divVec4(u: Vec4, v: Vec4, dest?: Vec4) {
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
 * @param s - The scalar value.
 * @param v - The input vector (3 elements).
 * @param dest - The destination vector to store the result (optional).
 * @returns The resulting vector.
 */
export function divScalarVec3(s: number, v: Vec3, dest?: Vec3) {
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
 * @param v - The input vector (3 elements).
 * @param s - The scalar value.
 * @param dest - The destination vector to store the result (optional).
 * @returns The resulting vector.
 */
export function divVec3Scalar(v: Vec3, s: number, dest?: Vec3) {
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
 * @param v - The input vector (4 elements).
 * @param s - The scalar value.
 * @param dest - The destination vector to store the result (optional).
 * @returns The resulting vector.
 */
export function divVec4Scalar(v: Vec4, s: number, dest?: Vec4) {
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
 * @param s - The scalar value.
 * @param v - The input vector (4 elements).
 * @param dest - The destination vector to store the result (optional).
 * @returns The resulting vector.
 */
export function divScalarVec4(s: number, v: Vec4, dest?: Vec4) {
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
 * @param u - The first vector (4 elements).
 * @param v - The second vector (4 elements).
 * @returns The dot product of the vectors.
 */
export function dotVec4(u: Vec4, v: Vec4) {
  return (u[0] * v[0] + u[1] * v[1] + u[2] * v[2] + u[3] * v[3]);
}

/**
 * Returns the cross product of two four-element vectors (ignores the w component).
 * @param u - The first vector (4 elements).
 * @param v - The second vector (4 elements).
 * @returns The resulting cross product (4 elements with w set to 0).
 */
export function cross3Vec4(u: Vec4, v: Vec4) {
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
 * @param u - The first vector (3 elements).
 * @param v - The second vector (3 elements).
 * @param dest - The destination vector to store the result (optional).
 * @returns The resulting cross product (3 elements).
 */
export function cross3Vec3(u: Vec3, v: Vec3, dest?: Vec3) {
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

/**
 * Returns the squared length of a four-element vector.
 * @param v - The input vector (4 elements).
 * @returns The squared length of the vector.
 */
export function sqLenVec4(v: Vec4) {
  return dotVec4(v, v);
}

/**
 * Returns the length of a four-element vector.
 * @param v - The input vector (4 elements).
 * @returns The length of the vector.
 */
export function lenVec4(v: Vec4) {
  return Math.sqrt(sqLenVec4(v));
}

/**
 * Returns the dot product of two two-element vectors.
 * @param u - The first vector (2 elements).
 * @param v - The second vector (2 elements).
 * @returns The dot product of the vectors.
 */
export function dotVec2(u: Vec2, v: Vec2) {
  return (u[0] * v[0] + u[1] * v[1]);
}

/**
 * Returns the squared length of a three-element vector.
 * @param v - The input vector (3 elements).
 * @returns The squared length of the vector.
 */
export function sqLenVec3(v: Vec3) {
  return dotVec3(v, v);
}

/**
 * Returns the squared length of a two-element vector.
 * @param v - The input vector (2 elements).
 * @returns The squared length of the vector.
 */
export function sqLenVec2(v: Vec2) {
  return dotVec2(v, v);
}

/**
 * Returns the length of a three-element vector.
 * @param v - The input vector (3 elements).
 * @returns The length of the vector.
 */
export function lenVec3(v: Vec3): number {
  return Math.sqrt(sqLenVec3(v));
}

/**
 * Returns the distance between two three-element vectors.
 * @param v - The first vector (3 elements).
 * @param w - The second vector (3 elements).
 * @returns The distance between the vectors.
 */
export const distVec3 = ((() => {
  const vec = createVec3Float64();
  return (v: Vec3, w: Vec3) => lenVec3(subVec3(v, w, vec));
}))();

/**
 * Returns the length of a two-element vector.
 * @param v - The input vector (2 elements).
 * @returns The length of the vector.
 */
export function lenVec2(v: Vec2): number {
  return Math.sqrt(sqLenVec2(v));
}

/**
 * Linearly interpolates between two 3D vectors.
 * @param t - The interpolation value.
 * @param t1 - The start of the interpolation range.
 * @param t2 - The end of the interpolation range.
 * @param p1 - The start vector (3 elements).
 * @param p2 - The end vector (3 elements).
 * @param dest - The destination vector to store the result (optional).
 * @returns The interpolated vector.
 */
export function lerpVec3(t: number, t1: number, t2: number, p1: Vec3, p2: Vec3, dest: Vec3) {
  const result = dest || createVec3Float64();
  const f = (t - t1) / (t2 - t1);
  result[0] = p1[0] + (f * (p2[0] - p1[0]));
  result[1] = p1[1] + (f * (p2[1] - p1[1]));
  result[2] = p1[2] + (f * (p2[2] - p1[2]));
  return result;
}

/**
 * Returns the distance between two two-element vectors.
 * @param v - The first vector (2 elements).
 * @param w - The second vector (2 elements).
 * @returns The distance between the vectors.
 */
export const distVec2 = ((() => {
  const vec = createVec2Float64();
  return (v: Vec2, w: Vec2) => lenVec2(subVec2(v, w, vec));
}))();

/**
 * Returns the reciprocal of a three-element vector.
 * @param v - The input vector (3 elements).
 * @param dest - The destination vector to store the result (optional).
 * @returns The reciprocal of the vector.
 */
export function rcpVec3(v: Vec3, dest: Vec3) {
  return divScalarVec3(1.0, v, dest);
}


/**
 * Normalizes a four-element vector.
 * @param v - The input vector (4 elements).
 * @param dest - The destination vector to store the result.
 * @returns The normalized vector.
 */
export function normalizeVec4(v: Vec4, dest: Vec4) {
  const f = 1.0 / lenVec4(v);
  return mulVec4Scalar(v, f, dest);
}

/**
 * Normalizes a three-element vector.
 * @param v - The input vector (3 elements).
 * @param dest - The destination vector to store the result (optional).
 * @returns The normalized vector.
 */
export function normalizeVec3(v: Vec3, dest?: Vec3): Vec3 {
  const f = 1.0 / lenVec3(v);
  return mulVec3Scalar(v, f, dest);
}

/**
 * Normalizes a two-element vector.
 * @param v - The input vector (2 elements).
 * @param dest - The destination vector to store the result.
 * @returns The normalized vector.
 */
export function normalizeVec2(v: Vec2, dest: Vec2) {
  const f = 1.0 / lenVec2(v);
  return mulVec2Scalar(v, f, dest);
}

/**
 * Gets the angle between two vectors in radians.
 * @param v - The first vector (3 elements).
 * @param w - The second vector (3 elements).
 * @returns The angle between the vectors in radians.
 */
export function angleVec3(v: Vec3, w: Vec3) {
  let theta = dotVec3(v, w) / (Math.sqrt(sqLenVec3(v) * sqLenVec3(w)));
  theta = theta < -1 ? -1 : (theta > 1 ? 1 : theta); // Clamp to handle numerical problems
  return Math.acos(theta);
}

/**
 * Converts an n-element vector to a JSON-serializable array with values rounded to two decimal places.
 * @param v - The input vector.
 * @returns The vector as a serializable array with rounded values.
 */
export function vecToArray(v: FloatArrayParam): FloatArrayParam {
  v = Array.prototype.slice.call(v);
  for (let i = 0, len = v.length; i < len; i++) {
    v[i] = trunc(v[i]);
  }
  return v;
}

/**
 * Helper function to round a number to 5 decimal places.
 * @param v - The input number.
 * @returns The rounded number.
 */
function trunc(v: number) {
  return Math.round(v * 100000) / 100000;
}

/**
 * Calculates the normal vector of a triangle defined by three points.
 * @param a - The first point of the triangle (3 elements).
 * @param b - The second point of the triangle (3 elements).
 * @param c - The third point of the triangle (3 elements).
 * @param normal - The destination vector to store the result (optional).
 * @returns The normal vector of the triangle.
 */
export function triangleNormal(a: Vec3, b: Vec3, c: Vec3, normal: Vec3 = createVec3Float64()): Vec3 {
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

  return normal;
}

