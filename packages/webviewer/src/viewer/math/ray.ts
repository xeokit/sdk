import type {FloatArrayParam} from "./math";
import {cross3Vec3, dotVec3, normalizeVec3, subVec3, vec3, vec4} from "./vector";
import {transformVec3, transformVec4} from "./matrix";

const tempVec3 = vec3();
const tempVec3b = vec3();
const tempVec3c = vec3();
const tempVec3d = vec3();
const tempVec3e = vec3();

const tempVec4a = vec4();
const tempVec4b = vec4();

/**
 * Finds the intersection of a 3D ray with a 3D triangle.
 */
export function rayTriangleIntersect(origin: FloatArrayParam, dir: FloatArrayParam, a: FloatArrayParam, b: FloatArrayParam, c: FloatArrayParam, isect: FloatArrayParam): FloatArrayParam|null {
    isect = isect || vec3();
    const EPSILON = 0.000001;
    const edge1 = subVec3(b, a, tempVec3);
    const edge2 = subVec3(c, a, tempVec3b);
    const pvec = cross3Vec3(dir, edge2, tempVec3c);
    const det = dotVec3(edge1, pvec);
    if (det < EPSILON) {
        return null;
    }
    const tvec = subVec3(origin, a, tempVec3d);
    const u = dotVec3(tvec, pvec);
    if (u < 0 || u > det) {
        return null;
    }
    const qvec = cross3Vec3(tvec, edge1, tempVec3e);
    const v = dotVec3(dir, qvec);
    if (v < 0 || u + v > det) {
        return null;
    }
    const t = dotVec3(edge2, qvec) / det;
    isect[0] = origin[0] + t * dir[0];
    isect[1] = origin[1] + t * dir[1];
    isect[2] = origin[2] + t * dir[2];
    return isect;
}

/**
 Transforms a ray by a matrix.
 @param matrix 4x4 matrix
 @param rayOrigin The ray origin
 @param rayDir The ray direction
 @param rayOriginDest The transformed ray origin
 @param rayDirDest The transformed ray direction
 */
export function transformRay(matrix: FloatArrayParam, rayOrigin: FloatArrayParam, rayDir: FloatArrayParam, rayOriginDest: FloatArrayParam, rayDirDest: FloatArrayParam) {
    tempVec4a[0] = rayOrigin[0];
    tempVec4a[1] = rayOrigin[1];
    tempVec4a[2] = rayOrigin[2];
    tempVec4a[3] = 1;
    transformVec4(matrix, tempVec4a, tempVec4b);
    rayOriginDest[0] = tempVec4b[0];
    rayOriginDest[1] = tempVec4b[1];
    rayOriginDest[2] = tempVec4b[2];
    tempVec4a[0] = rayDir[0];
    tempVec4a[1] = rayDir[1];
    tempVec4a[2] = rayDir[2];
    transformVec3(matrix, tempVec4a, tempVec4b);
    normalizeVec3(tempVec4b);
    rayDirDest[0] = tempVec4b[0];
    rayDirDest[1] = tempVec4b[1];
    rayDirDest[2] = tempVec4b[2];
}