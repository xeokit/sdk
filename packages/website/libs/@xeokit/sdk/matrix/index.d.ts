/**
 * <img style="padding:0px; padding-top:20px; padding-bottom:30px; height:140px;" src="https://xeokit.github.io/sdk/docs/assets/math_icon.png"/>
 *
 * # xeokit Matrix and Vector Math Library
 *
 * ---
 *
 * ***Mathematical functions for 2D/3D matrices, quaternions, and vectors***
 *
 * This library provides a set of utilities for working with mathematical operations commonly used in 3D graphics,
 * including vector and matrix operations such as dot products, vector negation, addition, and more.
 *
 * ---
 *
 * # Installation
 *
 * To install the xeokit SDK, use the following npm command:
 *
 * ````bash
 * npm install @xeokit/sdk
 * ````
 *
 * # Usage
 *
 * You can import and use functions from the matrix module as follows:
 *
 * ````javascript
 * import { dotVec3, createVec3 } from "@xeokit/sdk/matrix";
 *
 * const a = createVec3([0.1, 1, 2.1]);
 * const b = createVec3([0.5, 2.1, -1.3]);
 *
 * const c = dotVec3(a, b); // Computes the dot product of vectors a and b
 * ````
 *
 * @module matrix
 */
import { FloatArrayParam } from "../math";
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
export declare function dotVec3(u: FloatArrayParam, v: FloatArrayParam): number;
/**
 * Creates a new 2D vector, uninitialized.
 *
 * This function returns a new vector with two elements. If an array of values is provided, the vector is initialized
 * with those values. Otherwise, the vector will be initialized with default values (e.g., 2).
 *
 * @param values Optional array of values to initialize the vector. If not provided, the vector is initialized with default values.
 * @returns A new, uninitialized 2D vector.
 */
export declare function createVec2(values?: FloatArrayParam): FloatArrayParam;
/**
 * Creates a new 3D vector, uninitialized.
 *
 * Similar to `createVec2`, this function creates a new vector with three elements. If no values are provided,
 * the vector is initialized with default values (e.g., 3).
 *
 * @param values Optional array of values to initialize the vector. If not provided, the vector will be initialized with default values.
 * @returns A new, uninitialized 3D vector.
 */
export declare function createVec3(values?: FloatArrayParam): Float64Array<any>;
/**
 * Creates a new 4D vector, uninitialized.
 *
 * This function creates a new vector with four elements. It can be initialized with the provided values or left
 * uninitialized (i.e., filled with default values).
 *
 * @param values Optional array of values to initialize the vector. If not provided, the vector will be initialized with default values.
 * @returns A new, uninitialized 4D vector.
 */
export declare function createVec4(values?: FloatArrayParam): Float64Array<any>;
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
export declare function negateVec3(v: FloatArrayParam, dest?: FloatArrayParam): FloatArrayParam;
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
export declare function negateVec4(v: FloatArrayParam, dest?: FloatArrayParam): FloatArrayParam;
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
export declare function addVec4(u: FloatArrayParam, v: FloatArrayParam, dest?: FloatArrayParam): FloatArrayParam;
/**
 * Adds a scalar value to each element of a four-element vector.
 * @param {FloatArrayParam} v The four-element vector
 * @param {number} s The scalar value to add
 * @param {FloatArrayParam} [dest] The destination vector, optional
 * @return {FloatArrayParam} The resulting vector after addition
 */
export declare function addVec4Scalar(v: FloatArrayParam, s: number, dest?: FloatArrayParam): FloatArrayParam;
/**
 * Multiplies each element of a four-element vector by a scalar.
 * @param {FloatArrayParam} v The four-element vector
 * @param {number} s The scalar value to multiply
 * @param {FloatArrayParam} [dest] The destination vector, optional
 * @return {FloatArrayParam} The resulting vector after multiplication
 */
export declare function mulVec4Scalar(v: FloatArrayParam, s: number, dest?: FloatArrayParam): FloatArrayParam;
/**
 * Multiplies each element of a three-element vector by a scalar.
 * @param {FloatArrayParam} v The three-element vector
 * @param {number} s The scalar value to multiply
 * @param {FloatArrayParam} [dest] The destination vector, optional
 * @return {FloatArrayParam} The resulting vector after multiplication
 */
export declare function mulVec3Scalar(v: FloatArrayParam, s: number, dest?: FloatArrayParam): FloatArrayParam;
/**
 * Multiplies each element of a two-element vector by a scalar.
 * @param {FloatArrayParam} v The two-element vector
 * @param {number} s The scalar value to multiply
 * @param {FloatArrayParam} [dest] The destination vector, optional
 * @return {FloatArrayParam} The resulting vector after multiplication
 */
export declare function mulVec2Scalar(v: FloatArrayParam, s: number, dest?: FloatArrayParam): FloatArrayParam;
/**
 * Adds one three-element vector to another.
 * @param {FloatArrayParam} u The first three-element vector
 * @param {FloatArrayParam} v The second three-element vector
 * @param {FloatArrayParam} [dest] The destination vector, optional
 * @return {FloatArrayParam} The resulting vector after addition
 */
export declare function addVec3(u: FloatArrayParam, v: FloatArrayParam, dest?: FloatArrayParam): FloatArrayParam;
/**
 * Adds a scalar value to each element of a three-element vector.
 * @param {FloatArrayParam} v The three-element vector
 * @param {number} s The scalar value to add
 * @param {FloatArrayParam} [dest] The destination vector, optional
 * @return {FloatArrayParam} The resulting vector after addition
 */
export declare function addVec3Scalar(v: FloatArrayParam, s: number, dest?: FloatArrayParam): FloatArrayParam;
/**
 * Subtracts one four-element vector from another.
 * @param {FloatArrayParam} u The first four-element vector
 * @param {FloatArrayParam} v The second four-element vector
 * @param {FloatArrayParam} [dest] The destination vector, optional
 * @return {FloatArrayParam} The resulting vector after subtraction
 */
export declare function subVec4(u: FloatArrayParam, v: FloatArrayParam, dest?: FloatArrayParam): FloatArrayParam;
/**
 * Returns true if the two 3-element vectors are the same.
 * @param {FloatArrayParam} v1 The first three-element vector
 * @param {FloatArrayParam} v2 The second three-element vector
 * @return {boolean} True if the vectors are the same, otherwise false
 */
export declare function compareVec3(v1: FloatArrayParam, v2: FloatArrayParam): boolean;
/**
 * Subtracts one three-element vector from another.
 * @param {FloatArrayParam} u The first three-element vector
 * @param {FloatArrayParam} v The second three-element vector
 * @param {FloatArrayParam} [dest] The destination vector, optional
 * @return {FloatArrayParam} The resulting vector after subtraction
 */
export declare function subVec3(u: FloatArrayParam, v: FloatArrayParam, dest?: FloatArrayParam): FloatArrayParam;
/**
 * Subtracts one two-element vector from another.
 * @param {FloatArrayParam} u The first two-element vector
 * @param {FloatArrayParam} v The second two-element vector
 * @param {FloatArrayParam} [dest] The destination vector, optional
 * @return {FloatArrayParam} The resulting vector after subtraction
 */
export declare function subVec2(u: FloatArrayParam, v: FloatArrayParam, dest?: FloatArrayParam): FloatArrayParam;
/**
 * Get the geometric mean of the vectors.
 * @param {...any} vectors The vectors to compute the geometric mean of
 * @return {Float32Array} The geometric mean of the vectors
 */
export declare function geometricMeanVec2(...vectors: any): Float32Array<any>;
/**
 * Subtracts a scalar value from each element of a four-element vector.
 * @param {FloatArrayParam} v The four-element vector
 * @param {number} s The scalar value to subtract
 * @param {FloatArrayParam} [dest] The destination vector, optional
 * @return {FloatArrayParam} The resulting vector after subtraction
 */
export declare function subVec4Scalar(v: FloatArrayParam, s: number, dest?: FloatArrayParam): FloatArrayParam;
/**
 * Sets each element of a 4-element vector to a scalar value minus the value of that element.
 * @param {FloatArrayParam} v The four-element vector
 * @param {number} s The scalar value
 * @param {FloatArrayParam} [dest] The destination vector, optional
 * @return {FloatArrayParam} The resulting vector after subtraction
 */
export declare function subScalarVec4(v: FloatArrayParam, s: number, dest?: FloatArrayParam): FloatArrayParam;
/**
 * Multiplies one three-element vector by another.
 * @param {FloatArrayParam} u The first three-element vector
 * @param {FloatArrayParam} v The second three-element vector
 * @param {FloatArrayParam} [dest] The destination vector, optional
 * @return {FloatArrayParam} The resulting vector after multiplication
 */
export declare function mulVec4(u: FloatArrayParam, v: FloatArrayParam, dest?: FloatArrayParam): FloatArrayParam;
/**
 * Divides one three-element vector by another.
 * @param {FloatArrayParam} u The first three-element vector
 * @param {FloatArrayParam} v The second three-element vector
 * @param {FloatArrayParam} [dest] The destination vector, optional
 * @return {FloatArrayParam} The resulting vector after division
 */
export declare function divVec3(u: FloatArrayParam, v: FloatArrayParam, dest?: FloatArrayParam): FloatArrayParam;
/**
 * Divides one four-element vector by another.
 * @param {FloatArrayParam} u The first four-element vector
 * @param {FloatArrayParam} v The second four-element vector
 * @param {FloatArrayParam} [dest] The destination vector, optional
 * @return {FloatArrayParam} The resulting vector after division
 */
export declare function divVec4(u: FloatArrayParam, v: FloatArrayParam, dest?: FloatArrayParam): FloatArrayParam;
/**
 * Divides a scalar by a three-element vector, returning a new vector.
 * @param s - The scalar value.
 * @param v - The input vector (3 elements).
 * @param dest - The destination vector to store the result (optional).
 * @returns The resulting vector.
 */
export declare function divScalarVec3(s: number, v: FloatArrayParam, dest?: FloatArrayParam): FloatArrayParam;
/**
 * Divides a three-element vector by a scalar.
 * @param v - The input vector (3 elements).
 * @param s - The scalar value.
 * @param dest - The destination vector to store the result (optional).
 * @returns The resulting vector.
 */
export declare function divVec3Scalar(v: FloatArrayParam, s: number, dest?: FloatArrayParam): FloatArrayParam;
/**
 * Divides a four-element vector by a scalar.
 * @param v - The input vector (4 elements).
 * @param s - The scalar value.
 * @param dest - The destination vector to store the result (optional).
 * @returns The resulting vector.
 */
export declare function divVec4Scalar(v: FloatArrayParam, s: number, dest?: FloatArrayParam): FloatArrayParam;
/**
 * Divides a scalar by a four-element vector, returning a new vector.
 * @param s - The scalar value.
 * @param v - The input vector (4 elements).
 * @param dest - The destination vector to store the result (optional).
 * @returns The resulting vector.
 */
export declare function divScalarVec4(s: number, v: FloatArrayParam, dest?: FloatArrayParam): FloatArrayParam;
/**
 * Returns the dot product of two four-element vectors.
 * @param u - The first vector (4 elements).
 * @param v - The second vector (4 elements).
 * @returns The dot product of the vectors.
 */
export declare function dotVec4(u: FloatArrayParam, v: FloatArrayParam): number;
/**
 * Returns the cross product of two four-element vectors (ignores the w component).
 * @param u - The first vector (4 elements).
 * @param v - The second vector (4 elements).
 * @returns The resulting cross product (4 elements with w set to 0).
 */
export declare function cross3Vec4(u: FloatArrayParam, v: FloatArrayParam): number[];
/**
 * Returns the cross product of two three-element vectors.
 * @param u - The first vector (3 elements).
 * @param v - The second vector (3 elements).
 * @param dest - The destination vector to store the result (optional).
 * @returns The resulting cross product (3 elements).
 */
export declare function cross3Vec3(u: FloatArrayParam, v: FloatArrayParam, dest?: FloatArrayParam): FloatArrayParam;
/**
 * Returns the squared length of a four-element vector.
 * @param v - The input vector (4 elements).
 * @returns The squared length of the vector.
 */
export declare function sqLenVec4(v: FloatArrayParam): number;
/**
 * Returns the length of a four-element vector.
 * @param v - The input vector (4 elements).
 * @returns The length of the vector.
 */
export declare function lenVec4(v: FloatArrayParam): number;
/**
 * Returns the dot product of two two-element vectors.
 * @param u - The first vector (2 elements).
 * @param v - The second vector (2 elements).
 * @returns The dot product of the vectors.
 */
export declare function dotVec2(u: FloatArrayParam, v: FloatArrayParam): number;
/**
 * Returns the squared length of a three-element vector.
 * @param v - The input vector (3 elements).
 * @returns The squared length of the vector.
 */
export declare function sqLenVec3(v: FloatArrayParam): number;
/**
 * Returns the squared length of a two-element vector.
 * @param v - The input vector (2 elements).
 * @returns The squared length of the vector.
 */
export declare function sqLenVec2(v: FloatArrayParam): number;
/**
 * Returns the length of a three-element vector.
 * @param v - The input vector (3 elements).
 * @returns The length of the vector.
 */
export declare function lenVec3(v: FloatArrayParam): number;
/**
 * Returns the distance between two three-element vectors.
 * @param v - The first vector (3 elements).
 * @param w - The second vector (3 elements).
 * @returns The distance between the vectors.
 */
export declare const distVec3: (v: FloatArrayParam, w: FloatArrayParam) => number;
/**
 * Returns the length of a two-element vector.
 * @param v - The input vector (2 elements).
 * @returns The length of the vector.
 */
export declare function lenVec2(v: FloatArrayParam): number;
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
export declare function lerpVec3(t: number, t1: number, t2: number, p1: FloatArrayParam, p2: FloatArrayParam, dest: any): any;
/**
 * Returns the distance between two two-element vectors.
 * @param v - The first vector (2 elements).
 * @param w - The second vector (2 elements).
 * @returns The distance between the vectors.
 */
export declare const distVec2: (v: FloatArrayParam, w: FloatArrayParam) => number;
/**
 * Returns the reciprocal of a three-element vector.
 * @param v - The input vector (3 elements).
 * @param dest - The destination vector to store the result (optional).
 * @returns The reciprocal of the vector.
 */
export declare function rcpVec3(v: FloatArrayParam, dest: FloatArrayParam): FloatArrayParam;
/**
 * Normalizes a four-element vector.
 * @param v - The input vector (4 elements).
 * @param dest - The destination vector to store the result.
 * @returns The normalized vector.
 */
export declare function normalizeVec4(v: FloatArrayParam, dest: FloatArrayParam): FloatArrayParam;
/**
 * Normalizes a three-element vector.
 * @param v - The input vector (3 elements).
 * @param dest - The destination vector to store the result (optional).
 * @returns The normalized vector.
 */
export declare function normalizeVec3(v: FloatArrayParam, dest?: FloatArrayParam): FloatArrayParam;
/**
 * Normalizes a two-element vector.
 * @param v - The input vector (2 elements).
 * @param dest - The destination vector to store the result.
 * @returns The normalized vector.
 */
export declare function normalizeVec2(v: FloatArrayParam, dest: FloatArrayParam): FloatArrayParam;
/**
 * Gets the angle between two vectors in radians.
 * @param v - The first vector (3 elements).
 * @param w - The second vector (3 elements).
 * @returns The angle between the vectors in radians.
 */
export declare function angleVec3(v: FloatArrayParam, w: FloatArrayParam): number;
/**
 * Creates a three-element vector from the rotation part of a 16-element matrix.
 * @param m - The 4x4 matrix.
 * @param dest - The destination vector to store the result.
 * @returns The vector representing the scale part of the matrix.
 */
export declare const vec3FromMat4Scale: Function;
/**
 * Converts an n-element vector to a JSON-serializable array with values rounded to two decimal places.
 * @param v - The input vector.
 * @returns The vector as a serializable array with rounded values.
 */
export declare function vecToArray(v: FloatArrayParam): FloatArrayParam;
/**
 * Calculates the normal vector of a triangle defined by three points.
 * @param a - The first point of the triangle (3 elements).
 * @param b - The second point of the triangle (3 elements).
 * @param c - The third point of the triangle (3 elements).
 * @param normal - The destination vector to store the result (optional).
 * @returns The normal vector of the triangle.
 */
export declare function triangleNormal(a: FloatArrayParam, b: FloatArrayParam, c: FloatArrayParam, normal?: FloatArrayParam): FloatArrayParam;
/**
 * Returns a new, uninitialized 3x3 matrix.
 * @param values - Optional initial values for the matrix (defaults to an empty 3x3 matrix).
 * @returns A new 3x3 matrix.
 */
export declare function createMat3(values?: FloatArrayParam): FloatArrayParam;
/**
 * Converts a 3x3 matrix to a 4x4 matrix.
 * @param mat3 - The input 3x3 matrix.
 * @param mat4 - The destination 4x4 matrix (optional).
 * @returns The converted 4x4 matrix.
 */
export declare function mat3ToMat4(mat3: FloatArrayParam, mat4?: FloatArrayParam): FloatArrayParam;
/**
 * Returns a new, uninitialized 4x4 matrix.
 * @param values - Optional initial values for the matrix (defaults to an empty 4x4 matrix).
 * @returns A new 4x4 matrix.
 */
export declare function createMat4(values?: FloatArrayParam): Float64Array<any>;
/**
 * Compares two 4x4 matrices for equality.
 * @param m1 - The first matrix.
 * @param m2 - The second matrix.
 * @returns `true` if the matrices are the same, `false` otherwise.
 */
export declare function compareMat4(m1: FloatArrayParam, m2: FloatArrayParam): boolean;
/**
 * Returns a 4x4 perspective projection matrix based on the given field of view, aspect ratio, and near/far clipping planes.
 *
 * This function generates a perspective projection matrix, which transforms 3D coordinates into 2D space. The matrix
 * maps the frustum defined by the near and far planes and the field of view into the canonical view volume.
 *
 * @param {number} fovyrad - The vertical field of view (in radians).
 * @param {number} aspectratio - The aspect ratio (width / height) of the viewport.
 * @param {number} znear - The distance to the near clipping plane.
 * @param {number} zfar - The distance to the far clipping plane.
 * @param {FloatArrayParam} [m] - An optional destination matrix to store the result. If not provided, a new matrix is created.
 *
 * @returns {FloatArrayParam} The resulting 4x4 perspective projection matrix. If `m` is provided, it will be modified; otherwise, a new matrix is returned.
 *
 * @example
 * const fov = Math.PI / 4; // 45 degrees in radians
 * const aspect = 16 / 9;
 * const znear = 0.1;
 * const zfar = 1000;
 * const matrix = perspectiveMat4(fov, aspect, znear, zfar);
 * console.log(matrix);
 */
export declare function perspectiveMat4(fovyrad: number, aspectratio: number, znear: number, zfar: number, m?: FloatArrayParam): FloatArrayParam;
/**
 * Returns a 4x4 perspective frustum projection matrix, defined by the given near and far planes and the frustum bounds.
 *
 * This function generates a perspective frustum matrix, which is useful for 3D transformations that map coordinates
 * within a frustum defined by the near and far planes, and the left, right, bottom, and top frustum bounds.
 *
 * @param {FloatArrayParam} fmin - The minimum bounds of the frustum, represented as [left, bottom, near].
 * @param {FloatArrayParam} fmax - The maximum bounds of the frustum, represented as [right, top, far].
 * @param {FloatArrayParam} [m] - An optional destination matrix to store the result. If not provided, a new matrix is created.
 *
 * @returns {FloatArrayParam} The resulting 4x4 frustum projection matrix. If `m` is provided, it will be modified; otherwise, a new matrix is returned.
 *
 * @example
 * const fmin = [-1, -1, 0.1];
 * const fmax = [1, 1, 100];
 * const matrix = frustumMat4v(fmin, fmax);
 * console.log(matrix);
 */
export declare function frustumMat4v(fmin: FloatArrayParam, fmax: FloatArrayParam, m?: FloatArrayParam): FloatArrayParam;
/**
 * Returns a 4x4 orthographic projection matrix based on the given left, right, bottom, top, near, and far planes.
 *
 * This function creates an orthographic projection matrix, which maps 3D coordinates into a 2D plane while maintaining
 * the relative sizes of objects, unlike a perspective projection. It's commonly used for 2D rendering or for parallel projections.
 *
 * @param {number} left - The left boundary of the viewing volume.
 * @param {number} right - The right boundary of the viewing volume.
 * @param {number} bottom - The bottom boundary of the viewing volume.
 * @param {number} top - The top boundary of the viewing volume.
 * @param {number} near - The distance to the near clipping plane.
 * @param {number} far - The distance to the far clipping plane.
 * @param {FloatArrayParam} [dest] - An optional destination matrix to store the result. If not provided, a new matrix is created.
 *
 * @returns {FloatArrayParam} The resulting 4x4 orthographic projection matrix. If `dest` is provided, it will be modified; otherwise, a new matrix is returned.
 *
 * @example
 * const matrix = orthoMat4c(-1, 1, -1, 1, 0.1, 100);
 * console.log(matrix);
 */
export declare function orthoMat4c(left: number, right: number, bottom: number, top: number, near: number, far: number, dest?: FloatArrayParam): FloatArrayParam;
/**
 * Returns a 4x4 perspective projection matrix based on the given frustum bounds.
 *
 * This function creates a perspective projection matrix from the left, right, bottom, top, near, and far frustum planes.
 * It is commonly used for 3D rendering where the perspective effect is required.
 *
 * @param {number} left - The left boundary of the frustum.
 * @param {number} right - The right boundary of the frustum.
 * @param {number} bottom - The bottom boundary of the frustum.
 * @param {number} top - The top boundary of the frustum.
 * @param {number} near - The distance to the near clipping plane.
 * @param {number} far - The distance to the far clipping plane.
 * @param {FloatArrayParam} [dest] - An optional destination matrix to store the result. If not provided, a new matrix is created.
 *
 * @returns {FloatArrayParam} The resulting 4x4 frustum projection matrix. If `dest` is provided, it will be modified; otherwise, a new matrix is returned.
 *
 * @example
 * const matrix = frustumMat4(-1, 1, -1, 1, 0.1, 100);
 * console.log(matrix);
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
 * Creates a 4x4 rotation matrix that rotates a given vector around an arbitrary axis by a specified angle.
 *
 * This function generates a rotation matrix for 3D transformations. The matrix will rotate vectors by
 * an angle (`anglerad`) around a specified axis (`axis`). The resulting matrix is typically used in 3D
 * rendering to rotate objects in space.
 *
 * @param {number} anglerad - The angle of rotation in radians.
 * @param {FloatArrayParam} axis - The axis of rotation, represented as a 3D vector (x, y, z).
 * @param {FloatArrayParam} [m] - An optional destination matrix to store the result. If not provided, a new matrix will be created.
 *
 * @returns {FloatArrayParam} The resulting 4x4 rotation matrix. If `m` is provided, it will be modified; otherwise, a new matrix is returned.
 *
 * @example
 * const axis = [0, 1, 0];  // Rotate around the y-axis
 * const angle = Math.PI / 4;  // 45 degrees in radians
 * const matrix = rotationMat4v(angle, axis);
 * console.log(matrix);
 */
export declare function rotationMat4v(anglerad: number, axis: FloatArrayParam, m?: FloatArrayParam): FloatArrayParam;
/**
 * Creates a 4x4 'lookAt' viewing transformation matrix.
 *
 * This function generates a look-at matrix that transforms objects from world space to camera space,
 * where the camera is positioned at `pos`, looks at `target`, and the `up` vector defines the camera's up direction.
 * The resulting matrix is commonly used in 3D rendering for setting the camera's view transformation.
 *
 * @param {FloatArrayParam} pos - The position of the camera in world space (x, y, z).
 * @param {FloatArrayParam} target - The target position the camera is looking at in world space (x, y, z).
 * @param {FloatArrayParam} up - The up vector of the camera in world space (x, y, z).
 * @param {FloatArrayParam} [dest] - An optional destination matrix to store the result. If not provided, a new matrix will be created.
 *
 * @returns {FloatArrayParam} The resulting 4x4 look-at matrix. If `dest` is provided, it will be modified; otherwise, a new matrix is returned.
 *
 * @example
 * const cameraPosition = [0, 0, 5];
 * const targetPosition = [0, 0, 0];
 * const upVector = [0, 1, 0];
 * const matrix = lookAtMat4v(cameraPosition, targetPosition, upVector);
 * console.log(matrix);
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
 * Multiplies a 4x4 matrix by a four-element vector.
 */
export declare function mulMat4v4(m: FloatArrayParam, v: FloatArrayParam, dest?: FloatArrayParam): FloatArrayParam;
/**
 * Multiplies two 4x4 matrices and stores the result in a destination matrix.
 */
export declare function mulMat4(a: FloatArrayParam, b: FloatArrayParam, dest?: FloatArrayParam): FloatArrayParam;
/**
 * Multiplies two 3x3 matrices and stores the result in a destination matrix.
 */
export declare function mulMat3(a: FloatArrayParam, b: FloatArrayParam, dest?: FloatArrayParam): FloatArrayParam;
/**
 * Transforms a 3D point by a 4x4 matrix.
 */
export declare function transformPoint3(m: FloatArrayParam, p: FloatArrayParam, dest?: FloatArrayParam): FloatArrayParam;
/**
 * Transforms a homogeneous coordinate by a 4x4 matrix.
 */
export declare function transformPoint4(m: FloatArrayParam, v: FloatArrayParam, dest: FloatArrayParam): FloatArrayParam;
/**
 * Transforms an array of 3D positions by a 4x4 matrix.
 */
export declare function transformPoints3(m: FloatArrayParam, points: number[][], result?: number[][]): number[][];
/**
 * Transforms an array of 3D positions by a 4x4 matrix.
 */
export declare function transformPositions3(m: FloatArrayParam, p: FloatArrayParam, p2?: FloatArrayParam): FloatArrayParam;
/**
 * Transforms an array of 3D positions by a 4x4 matrix.
 * @param m - The 4x4 transformation matrix.
 * @param p - The array of positions to transform. Each position is a set of 4 values (x, y, z, w).
 * @param p2 - An optional array to store the result. Defaults to `p` if not provided.
 * @returns The transformed positions.
 */
export declare function transformPositions4(m: FloatArrayParam, p: FloatArrayParam, p2?: FloatArrayParam): FloatArrayParam;
/**
 * Transforms a 3D vector by a 4x4 matrix.
 * @param m - The 4x4 transformation matrix.
 * @param v - The 3D vector to transform (x, y, z).
 * @param dest - An optional array to store the result. If not provided, a new vector is created.
 * @returns The transformed vector.
 */
export declare function transformVec3(m: FloatArrayParam, v: FloatArrayParam, dest?: FloatArrayParam): FloatArrayParam;
/**
 * Transforms a 4D vector by a 4x4 matrix.
 * @param m - The 4x4 transformation matrix.
 * @param v - The 4D vector to transform (x, y, z, w).
 * @param dest - An optional array to store the result. If not provided, a new vector is created.
 * @returns The transformed 4D vector.
 */
export declare function transformVec4(m: FloatArrayParam, v: FloatArrayParam, dest?: FloatArrayParam): FloatArrayParam;
/**
 * Efficiently applies scaling to a 4x4 matrix.
 * @param xyz - The scaling vector (x, y, z).
 * @param m - The matrix to apply the scaling to. Defaults to the identity matrix if not provided.
 * @returns The matrix with the scaling applied.
 */
export declare function scaleMat4v(xyz: FloatArrayParam, m?: FloatArrayParam): FloatArrayParam;
/**
 * Sets a 4x4 matrix to represent a scaling transformation.
 * @param v - The scaling vector (x, y, z).
 * @param m - The matrix to store the result. Defaults to the identity matrix.
 * @returns The matrix representing the scaling.
 */
export declare function scalingMat4v(v: FloatArrayParam, m?: FloatArrayParam): FloatArrayParam;
/**
 * Returns a 3x3 scaling matrix based on the given vector.
 * @param v - The scaling vector (x, y).
 * @param m - The matrix to store the result. Defaults to the identity matrix.
 * @returns The resulting 3x3 scaling matrix.
 */
export declare function scalingMat3v(v: FloatArrayParam, m?: FloatArrayParam): FloatArrayParam;
/**
 * Returns a 4x4 scale matrix.
 * @param x - The scale factor along the x-axis.
 * @param y - The scale factor along the y-axis.
 * @param z - The scale factor along the z-axis.
 * @param dest - An optional matrix to store the result. Defaults to a new matrix.
 * @returns The resulting 4x4 scale matrix.
 */
export declare const scalingMat4c: (x: number, y: number, z: number, dest?: FloatArrayParam) => FloatArrayParam;
/**
 * Efficiently applies scaling to a 4x4 matrix using individual scale factors.
 * @param x - The scale factor along the x-axis.
 * @param y - The scale factor along the y-axis.
 * @param z - The scale factor along the z-axis.
 * @param m - The matrix to apply the scaling to.
 * @returns The matrix with the scaling applied.
 */
export declare function scaleMat4c(x: number, y: number, z: number, m: FloatArrayParam): FloatArrayParam;
/**
 * Returns a 4x4 scaling matrix with uniform scaling.
 * @param s - The scale factor applied to all axes.
 * @returns The resulting scaling matrix.
 */
export declare function scalingMat4s(s: number): FloatArrayParam;
/**
 * Composes a 4x4 matrix from position, quaternion, and scale.
 * This matrix transformation is applied in the order of rotation -> scale -> translation.
 * @param position - The position vector to translate by.
 * @param quaternion - The quaternion representing rotation.
 * @param scale - The scaling factor for each axis.
 * @param mat - An optional pre-allocated matrix for the result. Defaults to an identity matrix.
 * @returns The resulting composed matrix.
 */
export declare function composeMat4(position: FloatArrayParam, quaternion: FloatArrayParam, scale: FloatArrayParam, mat?: FloatArrayParam): FloatArrayParam;
/**
 * Composes a 4x4 matrix from position, Euler rotation angles, and scale.
 * The Euler angles are converted to a quaternion for rotation.
 * @param position - The position vector to translate by.
 * @param rotation - The Euler angles for rotation (in radians).
 * @param scale - The scaling factor for each axis.
 * @param mat - An optional pre-allocated matrix for the result. Defaults to an identity matrix.
 * @returns The resulting composed matrix.
 */
export declare function composeMat4Euler(position: FloatArrayParam, rotation: FloatArrayParam, scale: FloatArrayParam, mat?: FloatArrayParam): FloatArrayParam;
/**
 * Decomposes a 4x4 matrix into position, quaternion, and scale components.
 * @param mat - The matrix to decompose.
 * @param position - The resulting position vector.
 * @param quaternion - The resulting quaternion representing rotation.
 * @param scale - The resulting scale vector.
 */
export declare const decomposeMat4: (mat: FloatArrayParam, position: FloatArrayParam, quaternion: FloatArrayParam, scale: FloatArrayParam) => void;
/**
 * Efficiently applies a translation to the given matrix.
 * This translation is post-concatenated to the existing matrix.
 * @param xyz - The translation vector to apply.
 * @param m - The matrix to apply the translation to. Defaults to the identity matrix.
 * @returns The resulting matrix after applying the translation.
 */
export declare function translateMat4v(xyz: FloatArrayParam, m?: FloatArrayParam): FloatArrayParam;
/**
 * Efficiently applies a translation to the given matrix using separate components.
 * This translation is post-concatenated to the existing matrix.
 * @param x - The translation along the x-axis.
 * @param y - The translation along the y-axis.
 * @param z - The translation along the z-axis.
 * @param m - The matrix to apply the translation to. Defaults to the identity matrix.
 * @returns The resulting matrix after applying the translation.
 */
export declare function translateMat4c(x: number, y: number, z: number, m?: FloatArrayParam): FloatArrayParam;
/**
 * Creates a new matrix that replaces the translation in the rightmost column of the given
 * affine matrix with the provided translation vector.
 * @param m - The matrix to modify.
 * @param translation - The new translation vector.
 * @param dest - The matrix to store the result.
 * @returns The resulting matrix with the updated translation.
 */
export declare function setMat4Translation(m: FloatArrayParam, translation: FloatArrayParam, dest: FloatArrayParam): FloatArrayParam;
/**
 * Returns a 4x4 translation matrix.
 * @param v The translation vector [x, y, z].
 * @param dest Optional destination matrix, if not provided a new matrix will be created.
 * @returns The translation matrix.
 */
export declare function translationMat4v(v: FloatArrayParam, dest?: FloatArrayParam): FloatArrayParam;
/**
 * Returns a 3x3 translation matrix.
 * @param v The translation vector [x, y].
 * @param dest Optional destination matrix, if not provided a new matrix will be created.
 * @returns The translation matrix.
 */
export declare function translationMat3v(v: FloatArrayParam, dest?: FloatArrayParam): FloatArrayParam;
/**
 * Returns a 4x4 translation matrix from x, y, and z components.
 * @param x The translation on the x-axis.
 * @param y The translation on the y-axis.
 * @param z The translation on the z-axis.
 * @param dest Optional destination matrix, if not provided a new matrix will be created.
 * @returns The translation matrix.
 */
export declare const translationMat4c: (x: number, y: number, z: number, dest: FloatArrayParam) => FloatArrayParam;
/**
 * Returns a 4x4 translation matrix with uniform scaling.
 * @param s The scale value for all axes.
 * @param dest The destination matrix.
 * @returns The scaled translation matrix.
 */
export declare function translationMat4s(s: number, dest: FloatArrayParam): FloatArrayParam;
/**
 * Computes the determinant of a 4x4 matrix.
 * @param mat The 4x4 matrix.
 * @returns The determinant of the matrix.
 */
export declare function determinantMat4(mat: FloatArrayParam): number;
/**
 * Converts a 4x4 matrix to Euler angles.
 * @param mat The 4x4 matrix.
 * @param order The Euler angle order (e.g., "XYZ", "YXZ", "ZXY").
 * @param dest Optional destination for Euler angles, if not provided a new vector will be created.
 * @returns The Euler angles in the specified order.
 */
export declare function mat4ToEuler(mat: FloatArrayParam, order: string, dest?: FloatArrayParam): FloatArrayParam;
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
export declare function lerpMat4(t: number, t1: number, t2: number, m1: FloatArrayParam, m2: FloatArrayParam, dest?: FloatArrayParam): Uint8Array<ArrayBufferLike> | Int8Array<ArrayBufferLike> | Uint16Array<ArrayBufferLike> | Uint32Array<ArrayBufferLike> | Int16Array<ArrayBufferLike> | Float32Array<ArrayBufferLike> | number[] | Float64Array<any>;
/**
 * Creates an identity quaternion.
 * @param dest Optional quaternion to initialize, if not provided a new quaternion will be created.
 * @returns The identity quaternion.
 */
export declare function identityQuat(dest?: FloatArrayParam): FloatArrayParam;
/**
 * Initializes a quaternion from Euler angles.
 *
 * @param euler - The Euler angles in degrees.
 * @param order - The Euler angle order, such as "XYZ", "YXZ", "ZXY", etc.
 * @param [dest] - The destination quaternion (default is created if not provided).
 * @returns The resulting quaternion.
 */
export declare function eulerToQuat(euler: FloatArrayParam, order: string, dest?: FloatArrayParam): FloatArrayParam;
/**
 * Encodes rotation from a matrix into a quaternion.
 *
 * @param m - The 4x4 rotation matrix.
 * @param dest - The resulting quaternion (default is created if not provided).
 * @returns The quaternion representing the matrix's rotation.
 */
export declare function mat4ToQuat(m: FloatArrayParam, dest?: FloatArrayParam): FloatArrayParam;
/**
 * Creates a quaternion from two vectors (u and v).
 * The quaternion represents the rotation from u to v.
 *
 * @param u - The first vector.
 * @param v - The second vector.
 * @param dest - The resulting quaternion (default is created if not provided).
 * @returns The quaternion representing the rotation from u to v.
 */
export declare function vec3PairToQuat(u: FloatArrayParam, v: FloatArrayParam, dest?: FloatArrayParam): FloatArrayParam;
/**
 * Converts an angle-axis rotation representation into a quaternion.
 *
 * @param angleAxis - The angle-axis representation, where angle is in radians.
 * @param dest - The resulting quaternion (default is created if not provided).
 * @returns The quaternion representing the angle-axis rotation.
 */
export declare function angleAxisToQuaternion(angleAxis: FloatArrayParam, dest?: FloatArrayParam): FloatArrayParam;
/**
 * Converts a quaternion into Euler angles.
 *
 * @param q - The quaternion to convert.
 * @param order - The desired Euler angle order (e.g., "XYZ").
 * @param dest - The resulting Euler angles (default is created if not provided).
 * @returns The Euler angles representing the quaternion's rotation.
 */
export declare function quatToEuler(q: FloatArrayParam, order: string, dest?: FloatArrayParam): FloatArrayParam;
/**
 * Multiplies two quaternions.
 *
 * @param p - The first quaternion.
 * @param q - The second quaternion.
 * @param dest - The resulting quaternion (default is created if not provided).
 * @returns The product of the two quaternions.
 */
export declare function mulQuats(p: FloatArrayParam, q: FloatArrayParam, dest?: FloatArrayParam): FloatArrayParam;
/**
 * Applies a quaternion rotation to a 3D vector.
 *
 * @param q - The quaternion representing the rotation.
 * @param vec - The vector to apply the quaternion rotation to.
 * @param dest - The resulting rotated vector (default is created if not provided).
 * @returns The rotated vector.
 */
export declare function vec3ApplyQuat(q: FloatArrayParam, vec: FloatArrayParam, dest?: FloatArrayParam): FloatArrayParam;
/**
 * Converts a quaternion into a 4x4 rotation matrix.
 *
 * @param q - The quaternion to convert.
 * @param dest - The resulting 4x4 rotation matrix (default is created if not provided).
 * @returns The resulting rotation matrix.
 */
export declare function quatToMat4(q: FloatArrayParam, dest?: FloatArrayParam): FloatArrayParam;
/**
 * Converts a quaternion to a 4x4 rotation matrix.
 * The resulting matrix is stored in the provided matrix array.
 *
 * @param q The quaternion to convert, represented as a 4-element array [x, y, z, w].
 * @param m The matrix to store the result. It will be modified in place.
 * @returns The matrix representing the quaternion rotation.
 */
export declare function quatToRotationMat4(q: FloatArrayParam, m: FloatArrayParam): FloatArrayParam;
/**
 * Normalizes a quaternion.
 * The resulting normalized quaternion is stored in the destination array.
 *
 * @param q The quaternion to normalize, represented as a 4-element array [x, y, z, w].
 * @param dest The array to store the normalized quaternion. If not provided, the input quaternion will be normalized in place.
 * @returns The normalized quaternion.
 */
export declare function normalizeQuat(q: FloatArrayParam, dest?: FloatArrayParam): FloatArrayParam;
/**
 * Computes the conjugate of a quaternion.
 * The resulting conjugated quaternion is stored in the destination array.
 *
 * @param q The quaternion to conjugate, represented as a 4-element array [x, y, z, w].
 * @param dest The array to store the conjugated quaternion. If not provided, the input quaternion will be conjugated in place.
 * @returns The conjugate of the quaternion.
 */
export declare function conjugateQuat(q: FloatArrayParam, dest?: FloatArrayParam): FloatArrayParam;
/**
 * Computes the inverse of a quaternion.
 * The resulting inverse quaternion is stored in the destination array.
 *
 * @param q The quaternion to invert, represented as a 4-element array [x, y, z, w].
 * @param dest The array to store the inverse quaternion.
 * @returns The inverse of the quaternion.
 */
export declare function inverseQuat(q: FloatArrayParam, dest: FloatArrayParam): FloatArrayParam;
/**
 * Converts a quaternion to angle-axis representation.
 * The resulting angle-axis representation is stored in the provided array.
 *
 * @param q The quaternion to convert, represented as a 4-element array [x, y, z, w].
 * @param angleAxis The array to store the angle-axis representation. If not provided, a new array will be created.
 * @returns The angle-axis representation as a 4-element array [x, y, z, angle].
 */
export declare function quatToAngleAxis(q: FloatArrayParam, angleAxis?: FloatArrayParam): FloatArrayParam;
/**
 * Computes the intersection of a 3D ray with a 3D triangle.
 *
 * @param origin The ray origin.
 * @param dir The ray direction.
 * @param a First vertex of the triangle.
 * @param b Second vertex of the triangle.
 * @param c Third vertex of the triangle.
 * @param isect The intersection point (output).
 * @returns The intersection point if an intersection occurs, otherwise `null`.
 */
export declare function rayTriangleIntersect(origin: FloatArrayParam, dir: FloatArrayParam, a: FloatArrayParam, b: FloatArrayParam, c: FloatArrayParam, isect: FloatArrayParam): FloatArrayParam | null;
/**
 * Transforms a ray by a 4x4 transformation matrix.
 *
 * @param matrix The 4x4 transformation matrix.
 * @param rayOrigin The ray origin.
 * @param rayDir The ray direction.
 * @param rayOriginDest The transformed ray origin (output).
 * @param rayDirDest The transformed ray direction (output).
 */
export declare function transformRay(matrix: FloatArrayParam, rayOrigin: FloatArrayParam, rayDir: FloatArrayParam, rayOriginDest: FloatArrayParam, rayDirDest: FloatArrayParam): void;
/**
 * Converts a Canvas-space position into a World-space ray in the context of a Camera.
 *
 * @param viewMatrix The view matrix.
 * @param projMatrix The projection matrix.
 * @param projection The projection type (e.g., `"ortho"` for orthographic projection).
 * @param canvasPos The Canvas-space position.
 * @param worldRayOrigin The computed World-space ray origin (output).
 * @param worldRayDir The computed World-space ray direction (output).
 */
export declare const canvasPosToWorldRay: (canvas: any, viewMatrix: any, projMatrix: any, projection: any, canvasPos: any, worldRayOrigin: any, worldRayDir: any) => void;
//# sourceMappingURL=index.d.ts.map
