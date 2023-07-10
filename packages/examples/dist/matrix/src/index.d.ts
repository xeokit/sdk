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
import { type FloatArrayParam } from "@xeokit/math";
/**
 * Returns the dot product of two three-element vectors.
 */
export declare function dotVec3(u: FloatArrayParam, v: FloatArrayParam): number;
/**
 * Returns a new, uninitialized two-element vector.
 */
export declare function createVec2(values?: FloatArrayParam): FloatArrayParam;
/**
 * Returns a new, uninitialized three-element vector.
 */
export declare function createVec3(values?: FloatArrayParam): Float64Array;
/**
 * Returns a new, uninitialized four-element vector.
 */
export declare function createVec4(values?: FloatArrayParam): FloatArrayParam;
/**
 * Negates a three-element vector.
 */
export declare function negateVec3(v: FloatArrayParam, dest?: FloatArrayParam): FloatArrayParam;
/**
 * Negates a four-element vector.
 */
export declare function negateVec4(v: FloatArrayParam, dest?: FloatArrayParam): FloatArrayParam;
/**
 * Adds one four-element vector to another.
 */
export declare function addVec4(u: FloatArrayParam, v: FloatArrayParam, dest?: FloatArrayParam): FloatArrayParam;
/**
 * Adds a scalar value to each element of a four-element vector.
 */
export declare function addVec4Scalar(v: FloatArrayParam, s: number, dest?: FloatArrayParam): FloatArrayParam;
/**
 * Multiplies each element of a four-element vector by a scalar.
 */
export declare function mulVec4Scalar(v: FloatArrayParam, s: number, dest?: FloatArrayParam): FloatArrayParam;
/**
 * Multiplies each element of a three-element vector by a scalar.
 */
export declare function mulVec3Scalar(v: FloatArrayParam, s: number, dest?: FloatArrayParam): FloatArrayParam;
/**
 * Multiplies each element of a two-element vector by a scalar.
 */
export declare function mulVec2Scalar(v: FloatArrayParam, s: number, dest?: FloatArrayParam): FloatArrayParam;
/**
 * Adds one three-element vector to another.
 */
export declare function addVec3(u: FloatArrayParam, v: FloatArrayParam, dest?: FloatArrayParam): FloatArrayParam;
/**
 */
export declare function addVec3Scalar(v: FloatArrayParam, s: number, dest?: FloatArrayParam): FloatArrayParam;
/**
 * Subtracts one four-element vector from another.
 */
export declare function subVec4(u: FloatArrayParam, v: FloatArrayParam, dest?: FloatArrayParam): FloatArrayParam;
/**
 * Returns true if the two 3-element vectors are the same.
 */
export declare function compareVec3(v1: FloatArrayParam, v2: FloatArrayParam): boolean;
/**
 * Subtracts one three-element vector from another.
 */
export declare function subVec3(u: FloatArrayParam, v: FloatArrayParam, dest?: FloatArrayParam): FloatArrayParam;
/**
 * Subtracts one two-element vector from another.
 */
export declare function subVec2(u: FloatArrayParam, v: FloatArrayParam, dest?: FloatArrayParam): FloatArrayParam;
/**
 * Get the geometric mean of the vectors.
 */
export declare function geometricMeanVec2(...vectors: any): Float32Array;
/**
 * Subtracts a scalar value from each element of a four-element vector.
 */
export declare function subVec4Scalar(v: FloatArrayParam, s: number, dest?: FloatArrayParam): FloatArrayParam;
/**
 * Sets each element of a 4-element vector to a scalar value minus the value of that element.
 * @method subScalarVec4
 * @static
 * @param {Array(Number)} v The vector
 * @param s The scalar
 * @param  {Array(Number)} [dest] Destination vector
 * @return {Array(Number)} dest if specified, v otherwise
 */
export declare function subScalarVec4(v: FloatArrayParam, s: number, dest?: FloatArrayParam): FloatArrayParam;
/**
 * Multiplies one three-element vector by another.
 */
export declare function mulVec4(u: FloatArrayParam, v: FloatArrayParam, dest?: FloatArrayParam): FloatArrayParam;
/**
 * Divides one three-element vector by another.
 */
export declare function divVec3(u: FloatArrayParam, v: FloatArrayParam, dest?: FloatArrayParam): FloatArrayParam;
/**
 * Divides one four-element vector by another.
 */
export declare function divVec4(u: FloatArrayParam, v: FloatArrayParam, dest?: FloatArrayParam): FloatArrayParam;
/**
 * Divides a scalar by a three-element vector, returning a new vector.
 */
export declare function divScalarVec3(s: number, v: FloatArrayParam, dest?: FloatArrayParam): FloatArrayParam;
/**
 * Divides a three-element vector by a scalar.
 */
export declare function divVec3Scalar(v: FloatArrayParam, s: number, dest?: FloatArrayParam): FloatArrayParam;
/**
 * Divides a four-element vector by a scalar.
 */
export declare function divVec4Scalar(v: FloatArrayParam, s: number, dest?: FloatArrayParam): FloatArrayParam;
/**
 * Divides a scalar by a four-element vector, returning a new vector.
 */
export declare function divScalarVec4(s: number, v: FloatArrayParam, dest?: FloatArrayParam): FloatArrayParam;
/**
 * Returns the dot product of two four-element vectors.
 */
export declare function dotVec4(u: FloatArrayParam, v: FloatArrayParam): number;
/**
 * Returns the cross product of two four-element vectors.
 */
export declare function cross3Vec4(u: FloatArrayParam, v: FloatArrayParam): number[];
/**
 * Returns the cross product of two three-element vectors.
 */
export declare function cross3Vec3(u: FloatArrayParam, v: FloatArrayParam, dest?: FloatArrayParam): FloatArrayParam;
export declare function sqLenVec4(v: FloatArrayParam): number;
/**
 * Returns the length of a four-element vector.
 * @method lenVec4
 * @static
 * @param {Array(Number)} v The vector
 * @return The length
 */
export declare function lenVec4(v: FloatArrayParam): number;
/**
 * Returns the dot product of two two-element vectors.
 */
export declare function dotVec2(u: FloatArrayParam, v: FloatArrayParam): number;
export declare function sqLenVec3(v: FloatArrayParam): number;
export declare function sqLenVec2(v: FloatArrayParam): number;
/**
 * Returns the length of a three-element vector.
 */
export declare function lenVec3(v: FloatArrayParam): number;
export declare const distVec3: (v: FloatArrayParam, w: FloatArrayParam) => number;
/**
 * Returns the length of a two-element vector.
 */
export declare function lenVec2(v: FloatArrayParam): number;
/**
 * Linearly interpolates between two 3D vectors.
 */
export declare function lerpVec3(t: number, t1: number, t2: number, p1: FloatArrayParam, p2: FloatArrayParam, dest: any): any;
export declare const distVec2: (v: FloatArrayParam, w: FloatArrayParam) => number;
/**
 * @method rcpVec3
 * @static
 * @param v createVec3
 * @param dest createVec3 - optional destination
 * @return [] dest if specified, v otherwise
 *
 */
export declare function rcpVec3(v: FloatArrayParam, dest: FloatArrayParam): FloatArrayParam;
/**
 * Normalizes a four-element vector
 *
 */
export declare function normalizeVec4(v: FloatArrayParam, dest: FloatArrayParam): FloatArrayParam;
/**
 * Normalizes a three-element vector
 * @method normalizeVec4
 * @static
 */
export declare function normalizeVec3(v: FloatArrayParam, dest?: FloatArrayParam): FloatArrayParam;
/**
 * Normalizes a two-element vector
 */
export declare function normalizeVec2(v: FloatArrayParam, dest: FloatArrayParam): FloatArrayParam;
/**
 * Gets the angle between two vectors
 */
export declare function angleVec3(v: FloatArrayParam, w: FloatArrayParam): number;
/**
 * Creates a three-element vector from the rotation part of a sixteen-element matrix.
 */
export declare const vec3FromMat4Scale: Function;
/**
 * Converts an n-element vector to a JSON-serializable
 * array with values rounded to two decimal places.
 */
export declare function vecToArray(v: FloatArrayParam): FloatArrayParam;
/**
 * Calculates the normal vector of a triangle.
 */
export declare function triangleNormal(a: FloatArrayParam, b: FloatArrayParam, c: FloatArrayParam, normal?: FloatArrayParam): FloatArrayParam;
/**
 * Returns a new, uninitialized 3x3 matrix.
 */
export declare function createMat3(values?: FloatArrayParam): FloatArrayParam;
/**
 * Converts a 3x3 matrix to 4x4.
 */
export declare function mat3ToMat4(mat3: FloatArrayParam, mat4?: FloatArrayParam): FloatArrayParam;
/**
 * Returns a new, uninitialized 4x4 matrix.
 */
export declare function createMat4(values?: FloatArrayParam): FloatArrayParam;
/**
 * Returns true if the two 4x4 matrices are the same.
 * @param m1
 * @param m2
 * @returns {boolean}
 */
export declare function compareMat4(m1: FloatArrayParam, m2: FloatArrayParam): boolean;
/**
 * Returns a 4x4 perspective projection matrix.
 */
export declare function perspectiveMat4(fovyrad: number, aspectratio: number, znear: number, zfar: number, m?: FloatArrayParam): FloatArrayParam;
/**
 * Returns a 4x4 perspective frustum projection matrix.
 */
export declare function frustumMat4v(fmin: FloatArrayParam, fmax: FloatArrayParam, m?: FloatArrayParam): FloatArrayParam;
/**
 * Returns a 4x4 orthographic projection matrix.
 */
export declare function orthoMat4c(left: number, right: number, bottom: number, top: number, near: number, far: number, dest?: FloatArrayParam): FloatArrayParam;
/**
 * Returns a 4x4 perspective projection matrix.
 */
export declare function frustumMat4(left: number, right: number, bottom: number, top: number, near: number, far: number, dest?: FloatArrayParam): FloatArrayParam;
/**
 * Returns a 4x4 identity matrix.
 */
export declare function identityMat4(dest?: FloatArrayParam): FloatArrayParam;
/**
 * Returns a 3x3 identity matrix.
 */
export declare function identityMat3(dest?: FloatArrayParam): FloatArrayParam;
/**
 * Tests if the given 4x4 matrix is the identity matrix.
 */
export declare function isIdentityMat4(m: FloatArrayParam): boolean;
/**
 * Creates a 4x4 rotation matrix.
 */
export declare function rotationMat4v(anglerad: number, axis: FloatArrayParam, m?: FloatArrayParam): FloatArrayParam;
/**
 * Creates a 4x4 'lookat' viewing transform matrix.
 */
export declare function lookAtMat4v(pos: FloatArrayParam, target: FloatArrayParam, up: FloatArrayParam, dest?: FloatArrayParam): FloatArrayParam;
/**
 * Returns the inverse of the given 4x4 matrix.
 */
export declare function inverseMat4(mat: FloatArrayParam, dest?: FloatArrayParam): FloatArrayParam;
/**
 * Transposes the given 4x4 matrix.
 */
export declare function transposeMat4(mat: FloatArrayParam, dest?: FloatArrayParam): FloatArrayParam;
/**
 * Multiplies the given 4x4 matrix by the given four-element vector.
 */
export declare function mulMat4v4(m: FloatArrayParam, v: FloatArrayParam, dest?: FloatArrayParam): FloatArrayParam;
/**
 * Multiplies the two given 4x4 matrix by each other.
 * @method mulMat4
 * @static
 */
export declare function mulMat4(a: FloatArrayParam, b: FloatArrayParam, dest?: FloatArrayParam): FloatArrayParam;
/**
 * Multiplies the two given 3x3 matrices by each other.
 */
export declare function mulMat3(a: FloatArrayParam, b: FloatArrayParam, dest?: FloatArrayParam): FloatArrayParam;
/**
 * Transforms a three-element position by a 4x4 matrix.
 * @method transformPoint3
 * @static
 */
export declare function transformPoint3(m: FloatArrayParam, p: FloatArrayParam, dest?: FloatArrayParam): FloatArrayParam;
/**
 * Transforms a homogeneous coordinate by a 4x4 matrix.
 * @method transformPoint3
 * @static
 */
export declare function transformPoint4(m: FloatArrayParam, v: FloatArrayParam, dest: FloatArrayParam): FloatArrayParam;
/**
 * Transforms an array of three-element positions by a 4x4 matrix.
 * @method transformPoints3
 * @static
 */
export declare function transformPoints3(m: FloatArrayParam, points: number[][], points2: number[][]): number[][];
/**
 * Transforms an array of positions by a 4x4 matrix.
 */
export declare function transformPositions3(m: FloatArrayParam, p: FloatArrayParam, p2?: FloatArrayParam): FloatArrayParam;
/**
 * Transforms an array of positions by a 4x4 matrix.
 */
export declare function transformPositions4(m: FloatArrayParam, p: FloatArrayParam, p2?: FloatArrayParam): FloatArrayParam;
/**
 * Transforms a three-element vector by a 4x4 matrix.
 */
export declare function transformVec3(m: FloatArrayParam, v: FloatArrayParam, dest?: FloatArrayParam): FloatArrayParam;
/**
 * Transforms a four-element vector by a 4x4 matrix.
 * @method transformVec4
 * @static
 */
export declare function transformVec4(m: FloatArrayParam, v: FloatArrayParam, dest?: FloatArrayParam): FloatArrayParam;
/**
 * Efficiently post-concatenates a scaling to the given matrix.
 */
export declare function scaleMat4v(xyz: FloatArrayParam, m?: FloatArrayParam): FloatArrayParam;
/**
 */
export declare function scalingMat4v(v: FloatArrayParam, m?: FloatArrayParam): FloatArrayParam;
/**
 * Returns a 3x3 scale matrix.
 */
export declare function scalingMat3v(v: FloatArrayParam, m?: FloatArrayParam): FloatArrayParam;
/**
 * Returns a 4x4 scale matrix.
 */
export declare const scalingMat4c: (x: number, y: number, z: number, dest?: FloatArrayParam) => FloatArrayParam;
/**
 * Efficiently post-concatenates a scaling to the given matrix.
 * @method scaleMat4c
 * @param x
 * @param y
 * @param z
 * @param m
 */
export declare function scaleMat4c(x: number, y: number, z: number, m: FloatArrayParam): FloatArrayParam;
/**
 * Returns 4x4 scale matrix.
 */
export declare function scalingMat4s(s: number): FloatArrayParam;
/**
 * Composes a 4x4 matrix from the given position, quaternion and scale.
 * @param position
 * @param quaternion
 * @param scale
 * @param mat
 */
export declare function composeMat4(position: FloatArrayParam, quaternion: FloatArrayParam, scale: FloatArrayParam, mat?: FloatArrayParam): FloatArrayParam;
/**
 * Decomposes a 4x4 matrix into position, quaternion and scale.
 */
export declare const decomposeMat4: (mat: FloatArrayParam, position: FloatArrayParam, quaternion: FloatArrayParam, scale: FloatArrayParam) => void;
/**
 * Efficiently post-concatenates a translation to the given matrix.
 */
export declare function translateMat4v(xyz: FloatArrayParam, m?: FloatArrayParam): FloatArrayParam;
/**
 * Efficiently post-concatenates a translation, given as separate components, to the given matrix.
 */
export declare function translateMat4c(x: number, y: number, z: number, m?: FloatArrayParam): FloatArrayParam;
/**
 * Creates a new matrix that replaces the translation in the rightmost column of the given
 * affine matrix with the given translation.
 */
export declare function setMat4Translation(m: FloatArrayParam, translation: FloatArrayParam, dest: FloatArrayParam): FloatArrayParam;
/**
 * Returns 4x4 translation matrix.
 */
export declare function translationMat4v(v: FloatArrayParam, dest?: FloatArrayParam): FloatArrayParam;
/**
 * Returns 3x3 translation matrix.
 */
export declare function translationMat3v(v: FloatArrayParam, dest?: FloatArrayParam): FloatArrayParam;
/**
 * Returns 4x4 translation matrix.
 */
export declare const translationMat4c: (x: number, y: number, z: number, dest: FloatArrayParam) => FloatArrayParam;
/**
 * Returns 4x4 translation matrix.
 */
export declare function translationMat4s(s: number, dest: FloatArrayParam): FloatArrayParam;
/**
 * Returns the determinant of the given 4x4 matrix.
 */
export declare function determinantMat4(mat: FloatArrayParam): number;
/**
 * Gets Euler angles from a 4x4 matrix.
 *
 * @param {mat The 4x4 matrix.
 * @param order Desired Euler angle order: "XYZ", "YXZ", "ZXY" etc.
 * @param [dest] Destination Euler angles, created by default.
 * @returns  The Euler angles.
 */
export declare function mat4ToEuler(mat: FloatArrayParam, order: string, dest?: FloatArrayParam): FloatArrayParam;
/**
 * Linearly interpolates between two 4x4 matrices.
 */
export declare function lerpMat4(t: number, t1: number, t2: number, m1: FloatArrayParam, m2: FloatArrayParam, dest?: FloatArrayParam): FloatArrayParam;
/**
 * Craetes an identity quaternion.
 * @param dest Optional quaternion to initialize
 * @returns New quaternion
 */
export declare function identityQuat(dest?: FloatArrayParam): FloatArrayParam;
/**
 * Initializes a quaternion from Euler angles.
 *
 * @param  euler The Euler angles.
 * @param  order Euler angle order: "XYZ", "YXZ", "ZXY" etc.
 * @param  [dest] Destination quaternion, created by default.
 * @returns  The quaternion.
 */
export declare function eulerToQuat(euler: FloatArrayParam, order: string, dest?: FloatArrayParam): FloatArrayParam;
/**
 * Encodes rotation from a matrix into a quaternion.
 * @param m The matrix
 * @param dest The quaternion
 */
export declare function mat4ToQuat(m: FloatArrayParam, dest?: FloatArrayParam): FloatArrayParam;
/**
 *
 * @param u
 * @param v
 * @param dest
 */
export declare function vec3PairToQuat(u: FloatArrayParam, v: FloatArrayParam, dest?: FloatArrayParam): FloatArrayParam;
/**
 * Converts an angle-axis rotation representation into a quaternion
 * @param angleAxis
 * @param dest
 */
export declare function angleAxisToQuaternion(angleAxis: FloatArrayParam, dest?: FloatArrayParam): FloatArrayParam;
/**
 * Converts a quaternion to Euler angles
 * @param q
 * @param order
 * @param dest
 */
export declare function quatToEuler(q: FloatArrayParam, order: string, dest?: FloatArrayParam): FloatArrayParam;
/**
 * Multiples a pair of quaternions
 * @param p
 * @param q
 * @param dest
 */
export declare function mulQuats(p: FloatArrayParam, q: FloatArrayParam, dest?: FloatArrayParam): FloatArrayParam;
/**
 *
 * @param q
 * @param vec
 * @param dest
 */
export declare function vec3ApplyQuat(q: FloatArrayParam, vec: FloatArrayParam, dest?: FloatArrayParam): FloatArrayParam;
/**
 * Converts a quaternion into a matrix.
 * @param q
 * @param dest
 */
export declare function quatToMat4(q: FloatArrayParam, dest?: FloatArrayParam): FloatArrayParam;
/**
 * Converts a quaternion into a rotation matrix.
 * @param q
 * @param m
 */
export declare function quatToRotationMat4(q: FloatArrayParam, m: FloatArrayParam): FloatArrayParam;
/**
 * Normalizes a quaternion
 * @param q
 * @param dest
 * @returns The normalized quaternion
 */
export declare function normalizeQuat(q: FloatArrayParam, dest?: FloatArrayParam): FloatArrayParam;
/**
 * Gets the conjugate of a quaternion.
 * @param q
 * @param dest
 * @returns The conjugate of the quaternion
 */
export declare function conjugateQuat(q: FloatArrayParam, dest?: FloatArrayParam): FloatArrayParam;
/**
 * Gets the inverse of a quaternion.
 * @param q
 * @param dest
 * @returns The inverse quaternion
 */
export declare function inverseQuat(q: FloatArrayParam, dest: FloatArrayParam): FloatArrayParam;
/**
 * Converts a quaternion to angle-axis representation.
 * @param q
 * @param angleAxis
 * @returns The angle-axis rotation
 */
export declare function quatToAngleAxis(q: FloatArrayParam, angleAxis?: FloatArrayParam): FloatArrayParam;
/**
 * Finds the intersection of a 3D ray with a 3D triangle.
 */
export declare function rayTriangleIntersect(origin: FloatArrayParam, dir: FloatArrayParam, a: FloatArrayParam, b: FloatArrayParam, c: FloatArrayParam, isect: FloatArrayParam): FloatArrayParam | null;
/**
 Transforms a ray by a matrix.
 @param matrix 4x4 matrix
 @param rayOrigin The ray origin
 @param rayDir The ray direction
 @param rayOriginDest The transformed ray origin
 @param rayDirDest The transformed ray direction
 */
export declare function transformRay(matrix: FloatArrayParam, rayOrigin: FloatArrayParam, rayDir: FloatArrayParam, rayOriginDest: FloatArrayParam, rayDirDest: FloatArrayParam): void;
