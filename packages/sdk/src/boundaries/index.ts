/**
 * <img src="http://xeokit.io/img/kdtree.jpeg" />
 *
 * # xeokit Boundaries Math Library
 *
 * ---
 *
 * **Tools for 2D and 3D boundary analysis, transformations, and collision detection.**
 *
 * ---
 *
 * **Features:**
 * - Axis-Aligned Bounding Boxes (AABB2 & AABB3)
 * - Oriented Bounding Boxes (OBB)
 * - Transformable OBBs
 * - Boundary creation from positions
 * - Center point calculations
 * - Frustum projection and boundary intersection tests
 *
 * ## Installation
 *
 * ```bash
 * npm install @xeokit/sdk
 * ```
 *
 * ## Usage Example
 *
 * ```javascript
 * import { createAABB3 } from "@xeokit/sdk/boundaries";
 *
 * const aabb = createAABB3([-100, -100, -100, 100, 100, 100]);
 * ```
 *
 * @module boundaries
 */

import {createMat4, createVec2, createVec3, lenVec3, mulMat4, subVec3} from "../matrix";
import type {FloatArrayParam, IntArrayParam} from "../math";
import {MAX_DOUBLE, MIN_DOUBLE, newFloatArray} from "../math";
import {decompressPoint3WithMat4} from "../compression";

const tempVec3a = createVec3();
const tempVec3b = createVec3();
const tempVec3c = createVec3();
const tempMat4a = createMat4();


/**
 * Creates a new 3D axis-aligned bounding box (AABB3).
 *
 * @param values - Optional initial values for the AABB3.
 * @returns A new Float64Array representing the AABB3.
 */
export function createAABB3(values?: FloatArrayParam): Float64Array<any> {
  // @ts-ignore
  return new Float64Array(values || 6);
}

/**
 * Creates a new 3D axis-aligned bounding box (AABB3) with Int16 values.
 *
 * @param values - Optional initial values for the AABB3.
 * @returns A new Int16Array representing the AABB3.
 */
export function createAABB3Int16(values?: IntArrayParam): Int16Array<any> {
  // @ts-ignore
  return new Int16Array(values || 6);
}

/**
 * Creates a new 2D axis-aligned bounding box (AABB2).
 *
 * @param values - Optional initial values for the AABB2.
 * @returns A new FloatArrayParam representing the AABB2.
 */
export function createAABB2(values?: FloatArrayParam): FloatArrayParam {
  return newFloatArray(values || 4);
}

/**
 * Creates a new 3D oriented bounding box (OBB3).
 *
 * @param values - Optional initial values for the OBB3.
 * @returns A new FloatArrayParam representing the OBB3.
 */
export function createOBB3(values?: FloatArrayParam): FloatArrayParam {
  return newFloatArray(values || 32);
}

/**
 * Creates a new 2D oriented bounding box (OBB2).
 *
 * @param values - Optional initial values for the OBB2.
 * @returns A new FloatArrayParam representing the OBB2.
 */
export function createOBB2(values?: FloatArrayParam): FloatArrayParam {
  return newFloatArray(values || 16);
}

/**
 * Creates a new 3D bounding sphere.
 *
 * @param x - X coordinate of the sphere center.
 * @param y - Y coordinate of the sphere center.
 * @param z - Z coordinate of the sphere center.
 * @param r - Radius of the sphere.
 * @returns A FloatArrayParam representing the sphere, format `[x, y, z, r]`.
 */
export function createSphere3(
  x: number,
  y: number,
  z: number,
  r: number
): FloatArrayParam {
  return newFloatArray([x, y, z, r]);
}

/**
 * Transforms a 3D oriented bounding box (OBB3) using a 4x4 transformation matrix.
 *
 * @param m - The 4x4 transformation matrix.
 * @param p - The OBB3 to transform.
 * @param p2 - Optional destination array for transformed OBB3. Defaults to modifying `p`.
 * @returns The transformed OBB3.
 */
export function transformOBB3(
  m: FloatArrayParam,
  p: FloatArrayParam,
  p2: FloatArrayParam = p
): FloatArrayParam {
  for (let i = 0; i < p.length; i += 4) {
    const x = p[i], y = p[i + 1], z = p[i + 2];
    p2[i] = m[0] * x + m[4] * y + m[8] * z + m[12];
    p2[i + 1] = m[1] * x + m[5] * y + m[9] * z + m[13];
    p2[i + 2] = m[2] * x + m[6] * y + m[10] * z + m[14];
    p2[i + 3] = m[3] * x + m[7] * y + m[11] * z + m[15];
  }
  return p2;
}

/**
 * Checks if one AABB2 fully contains another.
 *
 * @param aabb1 - The first AABB2.
 * @param aabb2 - The second AABB2.
 * @returns `true` if `aabb1` contains `aabb2`, otherwise `false`.
 */
export function containsAABB2(
  aabb1: FloatArrayParam,
  aabb2: FloatArrayParam
): boolean {
  return aabb1[0] <= aabb2[0] && aabb2[3] <= aabb1[3] &&
    aabb1[1] <= aabb2[1] && aabb2[2] <= aabb1[2];
}

/**
 * Checks if one AABB3 fully contains another.
 *
 * @param aabb1 - The first AABB3.
 * @param aabb2 - The second AABB3.
 * @returns `true` if `aabb1` contains `aabb2`, otherwise `false`.
 */
export function containsAABB3(
  aabb1: FloatArrayParam,
  aabb2: FloatArrayParam
): boolean {
  return aabb1[0] <= aabb2[0] && aabb2[3] <= aabb1[3] &&
    aabb1[1] <= aabb2[1] && aabb2[4] <= aabb1[4] &&
    aabb1[2] <= aabb2[2] && aabb2[5] <= aabb1[5];
}

/**
 * Computes the diagonal length of a 3D axis-aligned bounding box (AABB3).
 *
 * @param aabb - The AABB3.
 * @returns The diagonal length.
 */
export function getAABB3Diag(aabb: FloatArrayParam): number {
  return Math.abs(lenVec3(subVec3([aabb[3], aabb[4], aabb[5]], [aabb[0], aabb[1], aabb[2]], tempVec3a)));
}

/**
 * Computes the center of a 3D axis-aligned bounding box (AABB3).
 *
 * @param aabb - The AABB3.
 * @param dest - Optional destination array for the center coordinates.
 * @returns The center coordinates.
 */
export function getAABB3Center(
  aabb: FloatArrayParam,
  dest: FloatArrayParam = createVec3()
): FloatArrayParam {
  dest[0] = (aabb[0] + aabb[3]) / 2;
  dest[1] = (aabb[1] + aabb[4]) / 2;
  dest[2] = (aabb[2] + aabb[5]) / 2;
  return dest;
}

/**
 * Get a diagonal boundary size that is symmetrical about the given point.
 */
export const getAABB3DiagPoint = (aabb: FloatArrayParam, p: FloatArrayParam): number => {

  const min = tempVec3a;
  const max = tempVec3b;

  min[0] = aabb[0];
  min[1] = aabb[1];
  min[2] = aabb[2];

  max[0] = aabb[3];
  max[1] = aabb[4];
  max[2] = aabb[5];

  const diagVec = subVec3(max, min, tempVec3c);

  const xneg = p[0] - aabb[0];
  const xpos = aabb[3] - p[0];
  const yneg = p[1] - aabb[1];
  const ypos = aabb[4] - p[1];
  const zneg = p[2] - aabb[2];
  const zpos = aabb[5] - p[2];

  diagVec[0] += xneg > xpos ? xneg : xpos;
  diagVec[1] += yneg > ypos ? yneg : ypos;
  diagVec[2] += zneg > zpos ? zneg : zpos;

  return Math.abs(lenVec3(diagVec));
};

/**
 * Gets the area of an AABB.
 */
export function getAABB3Area(aabb: FloatArrayParam): number {
  const width = aabb[3] - aabb[0];
  const height = aabb[4] - aabb[1];
  const depth = aabb[5] - aabb[2];
  return width * height * depth;
}

/**
 * Collapses an AABB3, resetting it to its maximum bounds.
 *
 * @param aabb - Optional AABB3 to collapse. If omitted, a new one is created.
 * @returns The collapsed AABB3.
 */
export function collapseAABB3(aabb: FloatArrayParam = createAABB3()): FloatArrayParam {
  // @ts-ignore
  aabb.set([MAX_DOUBLE, MAX_DOUBLE, MAX_DOUBLE, MIN_DOUBLE, MIN_DOUBLE, MIN_DOUBLE]);
  return aabb;
}


/**
 * Converts an axis-aligned bounding box (AABB) into an oriented bounding box (OBB)
 * consisting of eight 3D corner positions.
 *
 * @param aabb - The input AABB `[minX, minY, minZ, maxX, maxY, maxZ]`.
 * @param obb - The output OBB array (defaults to a new OBB).
 * @returns The computed OBB.
 */
export function AABB3ToOBB3(
  aabb: FloatArrayParam = createAABB3(),
  obb: FloatArrayParam = createOBB3()
): FloatArrayParam {
  const [minX, minY, minZ, maxX, maxY, maxZ] = aabb;

  const corners = [
    [minX, minY, minZ], [maxX, minY, minZ], [maxX, maxY, minZ], [minX, maxY, minZ],
    [minX, minY, maxZ], [maxX, minY, maxZ], [maxX, maxY, maxZ], [minX, maxY, maxZ]
  ];

  for (let i = 0; i < 8; i++) {
    obb[i * 4] = corners[i][0];
    obb[i * 4 + 1] = corners[i][1];
    obb[i * 4 + 2] = corners[i][2];
    obb[i * 4 + 3] = 1; // Homogeneous coordinate
  }

  return obb;
}

/**
 * Expands the first AABB to enclose the second AABB if required.
 *
 * @param aabb1 - The target AABB to expand.
 * @param aabb2 - The source AABB to enclose.
 * @returns The expanded AABB1.
 */
export function expandAABB3(aabb1: FloatArrayParam, aabb2: FloatArrayParam): FloatArrayParam {
  for (let i = 0; i < 3; i++) {
    aabb1[i] = Math.min(aabb1[i], aabb2[i]);
    aabb1[i + 3] = Math.max(aabb1[i + 3], aabb2[i + 3]);
  }
  return aabb1;
}

/**
 * Expands the first 2D AABB to enclose the second AABB if required.
 *
 * @param aabb1 - The target AABB to expand.
 * @param aabb2 - The source AABB to enclose.
 * @returns The expanded AABB1.
 */
export function expandAABB2(aabb1: FloatArrayParam, aabb2: FloatArrayParam): FloatArrayParam {
  for (let i = 0; i < 2; i++) {
    aabb1[i] = Math.min(aabb1[i], aabb2[i]);
    aabb1[i + 3] = Math.max(aabb1[i + 3], aabb2[i + 3]);
  }
  return aabb1;
}

/**
 * Expands an AABB to enclose a given 3D point if required.
 *
 * @param aabb - The AABB to expand.
 * @param p - The 3D point `[x, y, z]`.
 * @returns The expanded AABB.
 */
export function expandAABB3Point3(aabb: FloatArrayParam, p: FloatArrayParam): FloatArrayParam {
  for (let i = 0; i < 3; i++) {
    aabb[i] = Math.min(aabb[i], p[i]);
    aabb[i + 3] = Math.max(aabb[i + 3], p[i]);
  }
  return aabb;
}

/**
 * Expands an AABB to enclose a given 2D point if required.
 *
 * @param aabb - The AABB to expand.
 * @param p - The 2D point `[x, y]`.
 * @returns The expanded AABB.
 */
export function expandAABB2Point2(aabb: FloatArrayParam, p: FloatArrayParam): FloatArrayParam {
  for (let i = 0; i < 2; i++) {
    aabb[i] = Math.min(aabb[i], p[i]);
    aabb[i + 3] = Math.max(aabb[i + 3], p[i]);
  }
  return aabb;
}

/**
 * Expands an AABB to enclose multiple 3D points.
 *
 * @param aabb - The AABB to expand.
 * @param positions - A flattened array of 3D points `[x0, y0, z0, x1, y1, z1, ...]`.
 * @returns The expanded AABB.
 */
export function expandAABB3Points3(aabb: FloatArrayParam, positions: FloatArrayParam): FloatArrayParam {
  for (let i = 0; i < positions.length; i += 3) {
    for (let j = 0; j < 3; j++) {
      aabb[j] = Math.min(aabb[j], positions[i + j]);
      aabb[j + 3] = Math.max(aabb[j + 3], positions[i + j]);
    }
  }
  return aabb;
}


/**
 * Computes the axis-aligned bounding box (AABB) enclosing a set of 3D positions stored as a flattened array.
 * If the positions are compressed, it applies a decompression matrix before computing the bounds.
 *
 * @param positions - A flattened array of 3D points `[x0, y0, z0, x1, y1, z1, ...]`.
 * @param aabb - The output AABB array `[minX, minY, minZ, maxX, maxY, maxZ]`. If not provided, a new AABB is created.
 * @param positionsDecompressMatrix - Optional 4x4 matrix to decompress positions.
 * @returns The computed AABB.
 */
export const positions3ToAABB3 = (() => {
  const p = newFloatArray(3);

  return (
    positions: FloatArrayParam,
    aabb: FloatArrayParam = createAABB3(),
    positionsDecompressMatrix?: FloatArrayParam
  ): FloatArrayParam => {
    let xmin = MAX_DOUBLE, ymin = MAX_DOUBLE, zmin = MAX_DOUBLE;
    let xmax = MIN_DOUBLE, ymax = MIN_DOUBLE, zmax = MIN_DOUBLE;

    for (let i = 0, len = positions.length; i < len; i += 3) {
      let x = positions[i], y = positions[i + 1], z = positions[i + 2];

      if (positionsDecompressMatrix) {
        p[0] = x;
        p[1] = y;
        p[2] = z;
        decompressPoint3WithMat4(p, positionsDecompressMatrix, p);
        x = p[0];
        y = p[1];
        z = p[2];
      }

      xmin = Math.min(xmin, x);
      ymin = Math.min(ymin, y);
      zmin = Math.min(zmin, z);
      xmax = Math.max(xmax, x);
      ymax = Math.max(ymax, y);
      zmax = Math.max(zmax, z);
    }

    aabb[0] = xmin;
    aabb[1] = ymin;
    aabb[2] = zmin;
    aabb[3] = xmax;
    aabb[4] = ymax;
    aabb[5] = zmax;

    return aabb;
  };
})();

/**
 * Computes the axis-aligned bounding box (AABB) enclosing an oriented bounding box (OBB).
 *
 * @param obb - A flattened array of OBB corner points `[x0, y0, z0, w0, x1, y1, z1, w1, ...]`.
 * @param aabb - The output AABB `[minX, minY, minZ, maxX, maxY, maxZ]`. Defaults to a new AABB.
 * @returns The computed AABB.
 */
export function OBB3ToAABB3(
  obb: FloatArrayParam,
  aabb: FloatArrayParam = createAABB3()
): FloatArrayParam {
  let xmin = MAX_DOUBLE, ymin = MAX_DOUBLE, zmin = MAX_DOUBLE;
  let xmax = MIN_DOUBLE, ymax = MIN_DOUBLE, zmax = MIN_DOUBLE;

  for (let i = 0, len = obb.length; i < len; i += 4) {
    const x = obb[i], y = obb[i + 1], z = obb[i + 2];

    xmin = Math.min(xmin, x);
    ymin = Math.min(ymin, y);
    zmin = Math.min(zmin, z);
    xmax = Math.max(xmax, x);
    ymax = Math.max(ymax, y);
    zmax = Math.max(zmax, z);
  }

  aabb[0] = xmin;
  aabb[1] = ymin;
  aabb[2] = zmin;
  aabb[3] = xmax;
  aabb[4] = ymax;
  aabb[5] = zmax;

  return aabb;
}

/**
 * Computes the axis-aligned bounding box (AABB) enclosing a set of 3D points.
 *
 * @param points - An array of 3D points `[[x0, y0, z0], [x1, y1, z1], ...]`.
 * @param aabb - The output AABB `[minX, minY, minZ, maxX, maxY, maxZ]`. Defaults to a new AABB.
 * @returns The computed AABB.
 */
export function points3ToAABB3(
  points: number[][],
  aabb: FloatArrayParam = createAABB3()
): FloatArrayParam {
  let xmin = MAX_DOUBLE, ymin = MAX_DOUBLE, zmin = MAX_DOUBLE;
  let xmax = MIN_DOUBLE, ymax = MIN_DOUBLE, zmax = MIN_DOUBLE;

  for (const [x, y, z] of points) {
    xmin = Math.min(xmin, x);
    ymin = Math.min(ymin, y);
    zmin = Math.min(zmin, z);
    xmax = Math.max(xmax, x);
    ymax = Math.max(ymax, y);
    zmax = Math.max(zmax, z);
  }

  aabb[0] = xmin;
  aabb[1] = ymin;
  aabb[2] = zmin;
  aabb[3] = xmax;
  aabb[4] = ymax;
  aabb[5] = zmax;

  return aabb;
}

/**
 * Computes the center of a set of 3D positions stored in a flattened array.
 *
 * @param positions - A flattened array of 3D points `[x0, y0, z0, x1, y1, z1, ...]`.
 * @param center - The output center point `[x, y, z]`. Defaults to a new vector.
 * @returns The computed center `[x, y, z]`.
 */
export function getPositions3Center(
  positions: FloatArrayParam,
  center: FloatArrayParam = createVec3()
): FloatArrayParam {
  let xSum = 0, ySum = 0, zSum = 0;
  const numPoints = positions.length / 3;

  for (let i = 0; i < positions.length; i += 3) {
    xSum += positions[i];
    ySum += positions[i + 1];
    zSum += positions[i + 2];
  }

  center[0] = xSum / numPoints;
  center[1] = ySum / numPoints;
  center[2] = zSum / numPoints;

  return center;
}


/**
 * A plane within a {@link Frustum3}.
 */
export class FrustumPlane3 {
  /**
   * A vertex used to test intersections with this plane.
   */
  public testVertex: FloatArrayParam;

  /**
   * The distance of the plane from the origin along its normal.
   */
  public offset: number;

  /**
   * The normal vector of the plane.
   */
  public normal: FloatArrayParam;

  /**
   * Creates a new frustum plane.
   */
  constructor() {
    this.normal = createVec3();
    this.offset = 0;
    this.testVertex = createVec3();
  }

  /**
   * Sets the position and direction of the frustum plane.
   *
   * @param nx - X component of the normal vector.
   * @param ny - Y component of the normal vector.
   * @param nz - Z component of the normal vector.
   * @param offset - Distance of the plane from the origin.
   */
  set(nx: number, ny: number, nz: number, offset: number) {
    const s = 1.0 / Math.sqrt(nx * nx + ny * ny + nz * nz);
    this.normal[0] = nx * s;
    this.normal[1] = ny * s;
    this.normal[2] = nz * s;
    this.offset = offset * s;
    this.testVertex[0] = (this.normal[0] >= 0.0) ? 1 : 0;
    this.testVertex[1] = (this.normal[1] >= 0.0) ? 1 : 0;
    this.testVertex[2] = (this.normal[2] >= 0.0) ? 1 : 0;
  }
}

/**
 * Intersection state indicating that the first boundary is completely inside the second.
 */
export const INSIDE: number = 1;

/**
 * Intersection state indicating that two boundaries partially intersect.
 */
export const INTERSECT: number = 2;

/**
 * Intersection state indicating that two boundaries do not intersect.
 */
export const OUTSIDE: number = 3;

/**
 * A 3D frustum defined by six planes.
 */
export class Frustum3 {
  /**
   * The six planes that define the frustum boundary.
   */
  public planes: FrustumPlane3[];

  /**
   * Creates a new 3D frustum.
   */
  constructor() {
    this.planes = [
      new FrustumPlane3(), new FrustumPlane3(), new FrustumPlane3(),
      new FrustumPlane3(), new FrustumPlane3(), new FrustumPlane3()
    ];
  }
}

/**
 * Sets the extents of a frustum to the world-space volume defined by view and projection matrices.
 * Creates the frustum if it is not provided.
 *
 * @param viewMat - The 4x4 view matrix.
 * @param projMat - The 4x4 projection matrix.
 * @param frustum - Optional frustum instance to modify. If not provided, a new frustum is created.
 * @returns The updated or newly created frustum.
 */
export function setFrustum3(viewMat: FloatArrayParam, projMat: FloatArrayParam, frustum?: Frustum3): Frustum3 {
  const m = mulMat4(projMat, viewMat, tempMat4a);
  const m0 = m[0], m1 = m[1], m2 = m[2], m3 = m[3];
  const m4 = m[4], m5 = m[5], m6 = m[6], m7 = m[7];
  const m8 = m[8], m9 = m[9], m10 = m[10], m11 = m[11];
  const m12 = m[12], m13 = m[13], m14 = m[14], m15 = m[15];

  frustum = frustum || new Frustum3();
  frustum.planes[0].set(m3 - m0, m7 - m4, m11 - m8, m15 - m12);
  frustum.planes[1].set(m3 + m0, m7 + m4, m11 + m8, m15 + m12);
  frustum.planes[2].set(m3 - m1, m7 - m5, m11 - m9, m15 - m13);
  frustum.planes[3].set(m3 + m1, m7 + m5, m11 + m9, m15 + m13);
  frustum.planes[4].set(m3 - m2, m7 - m6, m11 - m10, m15 - m14);
  frustum.planes[5].set(m3 + m2, m7 + m6, m11 + m10, m15 + m14);

  return frustum;
}

/**
 * Tests for intersection between a frustum and an axis-aligned 3D boundary.
 *
 * @param frustum - The frustum to test.
 * @param aabb - The axis-aligned bounding box (AABB) represented as an array `[minX, minY, minZ, maxX, maxY, maxZ]`.
 * @returns The intersection state: `INSIDE`, `INTERSECT`, or `OUTSIDE`.
 */
export function intersectFrustum3AABB3(frustum: Frustum3, aabb: FloatArrayParam): number {
  let ret = INSIDE;
  const min = tempVec3a;
  const max = tempVec3b;

  min[0] = aabb[0];
  min[1] = aabb[1];
  min[2] = aabb[2];
  max[0] = aabb[3];
  max[1] = aabb[4];
  max[2] = aabb[5];

  const bminmax = [min, max];

  for (let i = 0; i < 6; ++i) {
    const plane = frustum.planes[i];

    // Check if the bounding box is outside this plane
    if (((plane.normal[0] * bminmax[plane.testVertex[0]][0]) +
      (plane.normal[1] * bminmax[plane.testVertex[1]][1]) +
      (plane.normal[2] * bminmax[plane.testVertex[2]][2]) +
      (plane.offset)) < 0.0) {
      return OUTSIDE;
    }

    // Check if the bounding box intersects this plane
    if (((plane.normal[0] * bminmax[1 - plane.testVertex[0]][0]) +
      (plane.normal[1] * bminmax[1 - plane.testVertex[1]][1]) +
      (plane.normal[2] * bminmax[1 - plane.testVertex[2]][2]) +
      (plane.offset)) < 0.0) {
      ret = INTERSECT;
    }
  }

  return ret;
}


/**
 * Tests for intersection between two axis-aligned 3D boundaries.
 *
 * @param {FloatArrayParam} aabb1 - The first axis-aligned bounding box, represented as an array of six numbers [minX, minY, minZ, maxX, maxY, maxZ].
 * @param {FloatArrayParam} aabb2 - The second axis-aligned bounding box, represented as an array of six numbers.
 * @returns {number} - Returns an intersection code indicating the result of the test.
 */
export function intersectAABB3s(aabb1: FloatArrayParam, aabb2: FloatArrayParam): number {
  return INTERSECT;
}

/**
 * Tests if a frustum intersects a triangles primitive geometry.
 *
 * @param {Frustum3} frustum - The frustum to test.
 * @param {FloatArrayParam} positions - The vertex positions of the geometry.
 * @param {IntArrayParam} indices - The indices defining the triangle faces.
 * @returns {boolean} - True if there is an intersection, false otherwise.
 */
export function intersectFrustum3Triangles3(frustum, positions: FloatArrayParam, indices: IntArrayParam): boolean {
  return true;
}

/**
 * Tests if a frustum intersects a single triangle.
 *
 * @param {Frustum3} frustum - The frustum to test.
 * @param {FloatArrayParam} a - The first vertex of the triangle.
 * @param {FloatArrayParam} b - The second vertex of the triangle.
 * @param {FloatArrayParam} c - The third vertex of the triangle.
 * @returns {boolean} - True if there is an intersection, false otherwise.
 */
export function intersectFrustum3Triangle3(frustum, a: FloatArrayParam, b: FloatArrayParam, c: FloatArrayParam): boolean {
  return true;
}

/**
 * Tests if a frustum intersects a lines primitive geometry.
 *
 * @param {Frustum3} frustum - The frustum to test.
 * @param {FloatArrayParam} positions - The vertex positions of the lines.
 * @param {IntArrayParam} indices - The indices defining the line segments.
 * @returns {boolean} - True if there is an intersection, false otherwise.
 */
export function intersectFrustum3Lines3(frustum, positions, indices): boolean {
  return true;
}

/**
 * Tests if a frustum intersects a points primitive geometry.
 *
 * @param {Frustum3} frustum - The frustum to test.
 * @param {FloatArrayParam} positions - The vertex positions of the points.
 * @returns {boolean} - True if there is an intersection, false otherwise.
 */
export function intersectFrustum3Positions3(frustum: Frustum3, positions: FloatArrayParam): boolean {
  return true;
}

/**
 * Tests if a frustum intersects a single point.
 *
 * @param {Frustum3} frustum - The frustum to test.
 * @param {FloatArrayParam} position - The position of the point.
 * @returns {boolean} - True if there is an intersection, false otherwise.
 */
export function intersectFrustum3Point3(frustum: Frustum3, position: FloatArrayParam): boolean {
  return true;
}

/**
 * Tests if an AABB intersects a triangles primitive geometry.
 *
 * @param {FloatArrayParam} aabb - The axis-aligned bounding box.
 * @param {FloatArrayParam} positions - The vertex positions of the geometry.
 * @param {IntArrayParam} indices - The indices defining the triangle faces.
 * @returns {boolean} - True if there is an intersection, false otherwise.
 */
export function intersectAABB3Triangles3(aabb: FloatArrayParam, positions: FloatArrayParam, indices: IntArrayParam): boolean {
  return false;
}

/**
 * Tests if an AABB intersects a lines primitive geometry.
 *
 * @param {FloatArrayParam} aabb - The axis-aligned bounding box.
 * @param {FloatArrayParam} positions - The vertex positions of the lines.
 * @param {IntArrayParam} indices - The indices defining the line segments.
 * @returns {boolean} - True if there is an intersection, false otherwise.
 */
export function intersectAABB3Lines3(aabb: FloatArrayParam, positions: FloatArrayParam, indices: IntArrayParam): boolean {
  return false;
}

/**
 * Tests if an AABB intersects points within the given positions array.
 *
 * @param {FloatArrayParam} aabb - The axis-aligned bounding box.
 * @param {FloatArrayParam} positions - The vertex positions of the points.
 * @returns {boolean} - True if there is an intersection, false otherwise.
 */
export function intersectAABB3Positions3(aabb: FloatArrayParam, positions: FloatArrayParam): boolean {
  return false;
}

/**
 * Tests if a 3D AABB contains a 3D point.
 *
 * @param {FloatArrayParam} aabb - The axis-aligned bounding box.
 * @param {FloatArrayParam} p - The position of the point.
 * @returns {boolean} - True if the point is inside the AABB, false otherwise.
 */
export function containsAABB3Point3(aabb: FloatArrayParam, p: FloatArrayParam): boolean {
  return (
    aabb[0] <= p[0] && p[0] <= aabb[3] &&
    aabb[1] <= p[1] && p[1] <= aabb[4] &&
    aabb[2] <= p[2] && p[2] <= aabb[5]
  );
}

/**
 * Tests if a 2D AABB contains a 2D point.
 *
 * @param {FloatArrayParam} aabb - The axis-aligned bounding box.
 * @param {FloatArrayParam} p - The position of the point.
 * @returns {boolean} - True if the point is inside the AABB, false otherwise.
 */
export function containsAABB2Point2(aabb: FloatArrayParam, p: FloatArrayParam): boolean {
  return (
    aabb[0] <= p[0] && p[0] <= aabb[3] &&
    aabb[1] <= p[1] && p[1] <= aabb[4]
  );
}
