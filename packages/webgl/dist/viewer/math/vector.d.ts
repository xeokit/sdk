import { FloatArrayParam } from "./math";
/**
 * Returns the dot product of two three-element vectors.
 */
export declare function dotVec3(u: FloatArrayParam, v: FloatArrayParam): number;
/**
 * Returns a new, uninitialized two-element vector.
 */
export declare function vec2(values?: FloatArrayParam): FloatArrayParam;
/**
 * Returns a new, uninitialized three-element vector.
 */
export declare function vec3(values?: FloatArrayParam): Float64Array;
/**
 * Returns a new, uninitialized four-element vector.
 */
export declare function vec4(values?: FloatArrayParam): FloatArrayParam;
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
 * @param v vec3
 * @param dest vec3 - optional destination
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
