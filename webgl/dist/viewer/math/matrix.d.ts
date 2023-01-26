import { FloatArrayParam } from "./math";
/**
 * Returns a new, uninitialized 3x3 matrix.
 */
export declare function createMat3(values?: FloatArrayParam): FloatArrayParam;
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
export declare function identityQuaternion(dest?: FloatArrayParam): FloatArrayParam;
/**
 * Initializes a quaternion from Euler angles.
 *
 * @param  euler The Euler angles.
 * @param  order Euler angle order: "XYZ", "YXZ", "ZXY" etc.
 * @param  [dest] Destination quaternion, created by default.
 * @returns  The quaternion.
 */
export declare function eulerToQuaternion(euler: FloatArrayParam, order: string, dest?: FloatArrayParam): FloatArrayParam;
/**
 * Encodes rotation from a matrix into a quaternion.
 * @param m The matrix
 * @param dest The quaternion
 */
export declare function mat4ToQuaternion(m: FloatArrayParam, dest?: FloatArrayParam): FloatArrayParam;
/**
 *
 * @param u
 * @param v
 * @param dest
 */
export declare function vec3PairToQuaternion(u: FloatArrayParam, v: FloatArrayParam, dest?: FloatArrayParam): FloatArrayParam;
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
export declare function quaternionToEuler(q: FloatArrayParam, order: string, dest?: FloatArrayParam): FloatArrayParam;
/**
 * Multiples a pair of quaternions
 * @param p
 * @param q
 * @param dest
 */
export declare function mulQuaternions(p: FloatArrayParam, q: FloatArrayParam, dest?: FloatArrayParam): FloatArrayParam;
/**
 *
 * @param q
 * @param vec
 * @param dest
 */
export declare function vec3ApplyQuaternion(q: FloatArrayParam, vec: FloatArrayParam, dest?: FloatArrayParam): FloatArrayParam;
/**
 * Converts a quaternion into a matrix.
 * @param q
 * @param dest
 */
export declare function quaternionToMat4(q: FloatArrayParam, dest: FloatArrayParam): FloatArrayParam;
/**
 * Converts a quaternion into a rotation matrix.
 * @param q
 * @param m
 */
export declare function quaternionToRotationMat4(q: FloatArrayParam, m: FloatArrayParam): FloatArrayParam;
/**
 * Normalizes a quaternion
 * @param q
 * @param dest
 * @returns The normalized quaternion
 */
export declare function normalizeQuaternion(q: FloatArrayParam, dest?: FloatArrayParam): FloatArrayParam;
/**
 * Gets the conjugate of a quaternion.
 * @param q
 * @param dest
 * @returns The conjugate of the quaternion
 */
export declare function conjugateQuaternion(q: FloatArrayParam, dest?: FloatArrayParam): FloatArrayParam;
/**
 * Gets the inverse of a quaternion.
 * @param q
 * @param dest
 * @returns The inverse quaternion
 */
export declare function inverseQuaternion(q: FloatArrayParam, dest: FloatArrayParam): FloatArrayParam;
/**
 * Converts a quaternion to angle-axis representation.
 * @param q
 * @param angleAxis
 * @returns The angle-axis rotation
 */
export declare function quaternionToAngleAxis(q: FloatArrayParam, angleAxis?: FloatArrayParam): FloatArrayParam;
