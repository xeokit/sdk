import type { FloatArrayParam } from "./math";
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
