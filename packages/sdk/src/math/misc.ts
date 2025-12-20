

/**
 * ============================================================
 * Primitive typed-array groupings
 * ============================================================
 */

import {
  createVec3Float64,
  createVec4Float64,
  cross3Vec3,
  dotVec3,
  mulVec4Scalar,
  normalizeVec3,
  subVec3,
  Vec3,
  Vec9
} from "./vector";
import {createMat4Float64, inverseMat4, Mat4, mulMat4, transformVec3, transformVec4} from "./matrix";

/**
 * Any numeric TypedArray.
 */
export type NumericTypedArray =
  | Int8Array<any>
  | Uint8Array<any>
  | Int16Array<any>
  | Uint16Array<any>
  | Int32Array<any>
  | Uint32Array<any>
  | Float32Array<any>
  | Float64Array<any>;

/**
 * Integer-only TypedArrays.
 */
export type IntTypedArray =
  | Int8Array<any>
  | Uint8Array<any>
  | Int16Array<any>
  | Uint16Array<any>
  | Int32Array<any>
  | Uint32Array<any>;

/**
 * Floating-point TypedArrays.
 */
export type FloatTypedArray =
  | Float32Array<any>
  | Float64Array<any>;


// Temporary vectors for computations
const tempVec3 = createVec3Float64();
const tempVec3b = createVec3Float64();
const tempVec3c = createVec3Float64();
const tempVec3d = createVec3Float64();
const tempVec3e = createVec3Float64();
const tempVec4a = createVec4Float64();
const tempVec4b = createVec4Float64();

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
export function rayTriangleIntersect(
  origin: Vec3,
  dir: Vec3,
  a: Vec3,
  b: Vec3,
  c: Vec3,
  isect: Vec3
): Vec3 | null {
  isect = isect || createVec3Float64();
  const EPSILON = 1e-6;

  const edge1 = subVec3(b, a, tempVec3);
  const edge2 = subVec3(c, a, tempVec3b);
  const pvec = cross3Vec3(dir, edge2, tempVec3c);
  const det = dotVec3(edge1, pvec);

  if (det < EPSILON) return null;

  const tvec = subVec3(origin, a, tempVec3d);
  const u = dotVec3(tvec, pvec);
  if (u < 0 || u > det) return null;

  const qvec = cross3Vec3(tvec, edge1, tempVec3e);
  const v = dotVec3(dir, qvec);
  if (v < 0 || u + v > det) return null;

  const t = dotVec3(edge2, qvec) / det;
  isect[0] = origin[0] + t * dir[0];
  isect[1] = origin[1] + t * dir[1];
  isect[2] = origin[2] + t * dir[2];

  return isect;
}

/**
 * Transforms a ray by a 4x4 transformation matrix.
 *
 * @param matrix The 4x4 transformation matrix.
 * @param rayOrigin The ray origin.
 * @param rayDir The ray direction.
 * @param rayOriginDest The transformed ray origin (output).
 * @param rayDirDest The transformed ray direction (output).
 */
export function transformRay(
  matrix: Mat4,
  rayOrigin: Vec3,
  rayDir: Vec3,
  rayOriginDest: Vec3,
  rayDirDest: Vec3
) {
  tempVec4a[0] = rayOrigin[0];
  tempVec4a[1] = rayOrigin[1];
  tempVec4a[2] = rayOrigin[2];
  tempVec4a[3] = 1;

  transformVec4(matrix, tempVec4a, tempVec4b);
  rayOriginDest[0] = tempVec4b[0];
  rayOriginDest[1] = tempVec4b[1];
  rayOriginDest[2] = tempVec4b[2];

  tempVec3[0] = rayDir[0];
  tempVec3[1] = rayDir[1];
  tempVec3[2] = rayDir[2];

  transformVec3(matrix, tempVec3, tempVec3b);
  normalizeVec3(tempVec3b);

  rayDirDest[0] = tempVec3b[0];
  rayDirDest[1] = tempVec3b[1];
  rayDirDest[2] = tempVec3b[2];
}

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
export const canvasPosToWorldRay = (() => {
  const pvMatInv = createMat4Float64();
  const vec4Near = createVec4Float64();
  const vec4Far = createVec4Float64();

  /**
   * Converts clip-space coordinates to world-space coordinates.
   *
   * @param clipX The X coordinate in clip space.
   * @param clipY The Y coordinate in clip space.
   * @param clipZ The Z coordinate in clip space.
   * @param isOrtho Whether the projection is orthographic.
   * @param outVec4 The output world-space coordinates.
   */
  const clipToWorld = (clipX, clipY, clipZ, isOrtho, outVec4) => {
    outVec4[0] = clipX;
    outVec4[1] = clipY;
    outVec4[2] = clipZ;
    outVec4[3] = 1;

    transformVec4(pvMatInv, outVec4, outVec4);
    if (!isOrtho) {
      mulVec4Scalar(outVec4, 1 / outVec4[3], outVec4);
    }
  };

  return (canvas, viewMatrix, projMatrix, projection, canvasPos, worldRayOrigin, worldRayDir) => {
    const isOrtho = projection === "ortho";

    mulMat4(projMatrix, viewMatrix, pvMatInv);
    inverseMat4(pvMatInv, pvMatInv);

    // Compute clip space coordinates, which range from [-1,1] in both X and Y,
    // with Y = +1 at the top of the viewport.

    const clipX = (2 * canvasPos[0]) / canvas.width - 1;
    const clipY = 1 - (2 * canvasPos[1]) / canvas.height;

    clipToWorld(clipX, clipY, -1, isOrtho, vec4Near);
    clipToWorld(clipX, clipY, 1, isOrtho, vec4Far);

    worldRayOrigin[0] = vec4Near[0];
    worldRayOrigin[1] = vec4Near[1];
    worldRayOrigin[2] = vec4Near[2];

    subVec3(<Vec3>vec4Far, <Vec3>vec4Near, worldRayDir);
    normalizeVec3(worldRayDir);
  };
})();


/**
 * Validates that three 3D axes are mutually orthogonal.
 *
 * @param axes - flat array of 9 numbers (3 axes)
 * @param epsilon - floating-point tolerance
 */
export function testOrthogonalAxis(
  axes: Vec9,
  epsilon = 1e-6
): boolean {

  const x = <Vec3>axes.slice(0, 3);
  const y = <Vec3>axes.slice(3, 6);
  const z = <Vec3>axes.slice(6, 9);

  return (
    Math.abs(dotVec3(x, y)) < epsilon &&
    Math.abs(dotVec3(x, z)) < epsilon &&
    Math.abs(dotVec3(y, z)) < epsilon
  );
}



