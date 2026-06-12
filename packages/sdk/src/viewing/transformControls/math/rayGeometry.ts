import {createMat4Float64, inverseMat4, type Mat4, mulMat4, transformPoint4} from "../../../base/math/matrix";
import {
  addVec3,
  createVec3Float64,
  createVec4Float64,
  dotVec3,
  mulVec3Scalar,
  normalizeVec3,
  subVec3,
  type Vec3,
  type Vec4,
} from "../../../base/math/vector";

/** Intersects a ray with a plane. Returns the hit point, or null if parallel. */
export function rayPlane(origin: Vec3, dir: Vec3, planePoint: Vec3, planeNormal: Vec3): Vec3 | null {
  const denom = dotVec3(dir, planeNormal);
  if (Math.abs(denom) < 1e-8) return null;
  const t = dotVec3(subVec3(planePoint, origin, createVec3Float64()), planeNormal) / denom;
  if (!isFinite(t)) return null;
  return addVec3(origin, mulVec3Scalar(dir, t, createVec3Float64()), createVec3Float64());
}

/** Returns the point on the infinite line closest to the ray, or null if degenerate. */
export function closestPointOnLineToRay(linePoint: Vec3, lineDir: Vec3, rayOrigin: Vec3, rayDir: Vec3): Vec3 | null {
  const u = lineDir;
  const v = rayDir;
  const w0 = subVec3(linePoint, rayOrigin, createVec3Float64());
  const a = dotVec3(u, u);
  const b = dotVec3(u, v);
  const c = dotVec3(v, v);
  const d = dotVec3(u, w0);
  const e = dotVec3(v, w0);
  const denom = a * c - b * b;
  if (Math.abs(denom) < 1e-8) return null;
  const sc = (b * e - c * d) / denom;
  return addVec3(linePoint, mulVec3Scalar(u, sc, createVec3Float64()), createVec3Float64());
}

/** Ray vs axis-aligned box `[minX,minY,minZ,maxX,maxY,maxZ]`. Returns entry distance, or null. */
export function rayAABB(origin: Vec3, dir: Vec3, aabb: number[]): number | null {
  let tmin = -Infinity;
  let tmax = Infinity;
  for (let i = 0; i < 3; i++) {
    const o = origin[i];
    const d = dir[i];
    const lo = aabb[i];
    const hi = aabb[i + 3];
    if (Math.abs(d) < 1e-8) {
      if (o < lo || o > hi) return null;
    } else {
      const t1 = (lo - o) / d;
      const t2 = (hi - o) / d;
      const tNear = Math.min(t1, t2);
      const tFar = Math.max(t1, t2);
      tmin = Math.max(tmin, tNear);
      tmax = Math.min(tmax, tFar);
      if (tmin > tmax) return null;
    }
  }
  return tmin >= 0 ? tmin : (tmax >= 0 ? tmax : null);
}

/**
 * Builds a world-space ray from a canvas position. Unprojects NDC points at the
 * near and far planes through `inverse(proj × view)`, doing the perspective
 * division `transformPoint4`-style code skips — without it the resulting world
 * points are scaled by an arbitrary `1/w` and the ray is junk.
 */
export function canvasPosToRay(
  canvasPos: [number, number],
  width: number,
  height: number,
  projMatrix: Mat4,
  viewMatrix: Mat4,
): {origin: Vec3, dir: Vec3} | null {
  const ndcX = (canvasPos[0] / width) * 2 - 1;
  const ndcY = -(canvasPos[1] / height) * 2 + 1;
  const vp = mulMat4(projMatrix, viewMatrix, createMat4Float64());
  const inv = inverseMat4(vp, createMat4Float64());
  if (!inv) return null;
  const tmp = createVec4Float64();
  transformPoint4(inv, [ndcX, ndcY, -1, 1] as Vec4, tmp);
  if (Math.abs(tmp[3]) < 1e-12) return null;
  const near: Vec3 = [tmp[0] / tmp[3], tmp[1] / tmp[3], tmp[2] / tmp[3]];
  transformPoint4(inv, [ndcX, ndcY, 1, 1] as Vec4, tmp);
  if (Math.abs(tmp[3]) < 1e-12) return null;
  const far: Vec3 = [tmp[0] / tmp[3], tmp[1] / tmp[3], tmp[2] / tmp[3]];
  const dir = normalizeVec3(subVec3(far, near, createVec3Float64()), createVec3Float64());
  return {origin: near, dir};
}
