import {
  createVec3Float64,
  cross3Vec3,
  normalizeVec3,
  subVec3,
  type Vec3,
  type Vec3Float
} from "../../base/math/vector";
import {createMat4Float64, inverseMat4, transformPoint3, transformVec3} from "../../base/math/matrix";
import type {Mat4} from "../../base/math/matrix";
import {SolidPrimitive, SurfacePrimitive, TrianglesPrimitive} from "../../base/constants";
import type {SceneCollisionIndex} from "./SceneCollisionIndex";
import type {SceneTriangleHit} from "./SceneTriangleHit";
import type {SceneRayTriangleOptions} from "./SceneRayTriangleOptions";


/**
 * Möller-Trumbore parallel-axis epsilon. Below this, the ray is taken to
 * be (effectively) coplanar with the triangle and the test bails out.
 *
 * @internal
 */
const RAY_TRIANGLE_EPSILON = 1e-8;


/**
 * Tolerance on the barycentric `u`, `v` boundary checks. Without this, a
 * ray hitting the shared edge between two adjacent triangles can land a
 * couple of ULPs to the "wrong" side of *both* triangles' bounds — both
 * tests then reject and the surface pick fails. The same tolerance lets
 * grazing rays whose computed barycentric drifts slightly outside `[0,1]`
 * still register as hits.
 *
 * Picked empirically: tight enough that off-triangle rays don't sneak in,
 * loose enough to absorb double-precision round-off across the edge tests.
 * We rank hits by `tHit` afterwards so a stray double-hit on an edge
 * resolves cleanly to whichever of the two triangles is parametrically
 * nearer along the ray.
 *
 * @internal
 */
const RAY_TRIANGLE_BARY_EPSILON = 1e-5;


/**
 * Triangle-precise raycast against the indexed scene.
 *
 * Uses the {@link SceneCollisionIndex} BVH to narrow the candidate set to
 * the objects whose world AABB the ray hits, then runs a Möller-Trumbore
 * triangle intersection on each candidate's mesh geometry. Returns the
 * nearest hit, or `null` if the ray misses every mesh.
 *
 * Triangles are tested in mesh-local space (the ray is transformed once
 * per mesh; vertices are dequantised on the fly). The hit point is
 * mapped back to world space via the mesh's world matrix, so non-uniform
 * scales and shears stay correct.
 *
 * Early-exits as soon as the next AABB-`tEnter` exceeds the best world-space
 * `tHit` found so far — distant candidates can't improve the result.
 *
 * Triangle, solid, and surface primitives are tested; lines and points are
 * skipped (use {@link SceneCollisionIndex.intersectRay} for those, then
 * filter by primitive type).
 *
 * @param collisionIndex BVH index for the Scene.
 * @param origin Ray origin in world space.
 * @param dir Ray direction in world space (need not be normalised — `tHit`
 *   is reported in `dir`-multiples).
 * @returns Nearest triangle hit, or `null` for a miss.
 */
export function intersectSceneRayTriangle(
  collisionIndex: SceneCollisionIndex,
  origin: Vec3,
  dir: Vec3,
  options?: SceneRayTriangleOptions
): SceneTriangleHit | null {

  const tMin = options?.tMin ?? 0;
  const tMax = options?.tMax ?? Infinity;
  const filter = options?.filter;
  const pickSurfaceNormal = options?.pickSurfaceNormal === true;

  const aabbHits = collisionIndex.intersectRay(origin, dir, {tMin, tMax});
  if (aabbHits.length === 0) return null;

  let bestT = Math.min(tMax, Infinity);
  let best: SceneTriangleHit | null = null;

  // Reusable scratch — none of these survive across loop iterations, so
  // we can stamp them inside a single object pool without aliasing risk.
  const invMat = createMat4Float64();
  const localOrigin: Vec3Float = createVec3Float64();
  const localDir:    Vec3Float = createVec3Float64();
  const localHit:    Vec3Float = createVec3Float64();
  const worldHit:    Vec3Float = createVec3Float64();
  const worldV0:     Vec3Float = createVec3Float64();
  const worldV1:     Vec3Float = createVec3Float64();
  const worldV2:     Vec3Float = createVec3Float64();
  const worldEdge1:  Vec3Float = createVec3Float64();
  const worldEdge2:  Vec3Float = createVec3Float64();
  const worldNormal: Vec3Float = createVec3Float64();

  for (let h = 0; h < aabbHits.length; h++) {
    const aabbHit = aabbHits[h];
    // Sorted ascending; once an AABB's tEnter passes the best surface tHit,
    // no later candidate can produce a nearer hit.
    if (aabbHit.tEnter >= bestT) break;

    const sceneObject = collisionIndex.scene.objects[aabbHit.objectId];
    if (!sceneObject) continue;
    if (filter && !filter(aabbHit.objectId)) continue;

    const meshes = sceneObject.meshes;
    for (let m = 0; m < meshes.length; m++) {
      const mesh = meshes[m];
      const geom = mesh.geometry;
      if (!geom) continue;

      // Skip non-triangle primitives — line/point picking is a different
      // operation and would short-circuit a triangle hit we'd rather find.
      const prim = geom.primitive;
      if (prim !== TrianglesPrimitive && prim !== SolidPrimitive && prim !== SurfacePrimitive) {
        continue;
      }
      const positions = geom.positionsCompressed;
      const indices = geom.indices;
      const localAabb = geom.aabb;
      if (!positions || !indices || !localAabb) continue;

      // Bring the ray into the mesh's local frame so the triangle test
      // can operate on dequantised local positions without re-transforming
      // every vertex per ray.
      //
      // The parametric `t` from M-T in this local frame equals the
      // world-space `t` exactly: any affine transform M satisfies
      //   inverse(M) * (origin + t * dir) = inverse(M) * origin + t * inverse(M_linear) * dir
      //                                   = localOrigin + t * localDir
      // so the same physical hit point sits at the same `t` in both
      // frames — no scale conversion needed even with non-uniform scale.
      // We use `localT` directly as `worldT`, avoiding precision loss
      // from `(worldHit - worldOrigin) · worldDir / |worldDir|²` at large
      // scene-vs-eye magnitudes (the cancellation in `worldHit - worldOrigin`
      // could drop several digits of precision and miss far-away surface hits).
      inverseMat4(mesh.worldMatrix as Mat4, invMat);
      transformPoint3(invMat, origin, localOrigin);
      transformVec3(invMat,   dir,    localDir);

      // Dequantisation factors (16-bit positions → local floats).
      const aMinX = localAabb[0], aMinY = localAabb[1], aMinZ = localAabb[2];
      const sX = (localAabb[3] - aMinX) / 65535.0;
      const sY = (localAabb[4] - aMinY) / 65535.0;
      const sZ = (localAabb[5] - aMinZ) / 65535.0;

      const lox = localOrigin[0], loy = localOrigin[1], loz = localOrigin[2];
      const ldx = localDir[0],    ldy = localDir[1],    ldz = localDir[2];

      const triCount = (indices.length / 3) | 0;
      for (let t = 0; t < triCount; t++) {
        const i0 = indices[t * 3 + 0] * 3;
        const i1 = indices[t * 3 + 1] * 3;
        const i2 = indices[t * 3 + 2] * 3;

        // Dequantise inline — three multiplies and three adds per vertex.
        const v0x = aMinX + positions[i0 + 0] * sX;
        const v0y = aMinY + positions[i0 + 1] * sY;
        const v0z = aMinZ + positions[i0 + 2] * sZ;
        const v1x = aMinX + positions[i1 + 0] * sX;
        const v1y = aMinY + positions[i1 + 1] * sY;
        const v1z = aMinZ + positions[i1 + 2] * sZ;
        const v2x = aMinX + positions[i2 + 0] * sX;
        const v2y = aMinY + positions[i2 + 1] * sY;
        const v2z = aMinZ + positions[i2 + 2] * sZ;

        // Möller-Trumbore: cheap parallel-axis test first, then the two
        // barycentric-bound checks, finally the parametric distance.
        const e1x = v1x - v0x, e1y = v1y - v0y, e1z = v1z - v0z;
        const e2x = v2x - v0x, e2y = v2y - v0y, e2z = v2z - v0z;

        const hx = ldy * e2z - ldz * e2y;
        const hy = ldz * e2x - ldx * e2z;
        const hz = ldx * e2y - ldy * e2x;

        const a = e1x * hx + e1y * hy + e1z * hz;
        if (a > -RAY_TRIANGLE_EPSILON && a < RAY_TRIANGLE_EPSILON) continue;

        const f  = 1.0 / a;
        const sx = lox - v0x, sy = loy - v0y, sz = loz - v0z;

        const u = f * (sx * hx + sy * hy + sz * hz);
        if (u < -RAY_TRIANGLE_BARY_EPSILON || u > 1 + RAY_TRIANGLE_BARY_EPSILON) continue;

        const qx = sy * e1z - sz * e1y;
        const qy = sz * e1x - sx * e1z;
        const qz = sx * e1y - sy * e1x;

        const v = f * (ldx * qx + ldy * qy + ldz * qz);
        if (v < -RAY_TRIANGLE_BARY_EPSILON || u + v > 1 + RAY_TRIANGLE_BARY_EPSILON) continue;

        const tHit = f * (e2x * qx + e2y * qy + e2z * qz);
        if (tHit <= RAY_TRIANGLE_EPSILON) continue;
        if (tHit < tMin || tHit > bestT) continue;

        // Compute world-space hit by reconstructing the local hit point
        // and pushing it through the mesh's worldMatrix. We don't compute
        // worldT separately — `tHit` (the local-space parametric t) is
        // already in world ray-parametric units (see proof above).
        localHit[0] = lox + ldx * tHit;
        localHit[1] = loy + ldy * tHit;
        localHit[2] = loz + ldz * tHit;
        transformPoint3(mesh.worldMatrix as Mat4, localHit, worldHit);

        if (pickSurfaceNormal) {
          localHit[0] = v0x; localHit[1] = v0y; localHit[2] = v0z;
          transformPoint3(mesh.worldMatrix as Mat4, localHit, worldV0);
          localHit[0] = v1x; localHit[1] = v1y; localHit[2] = v1z;
          transformPoint3(mesh.worldMatrix as Mat4, localHit, worldV1);
          localHit[0] = v2x; localHit[1] = v2y; localHit[2] = v2z;
          transformPoint3(mesh.worldMatrix as Mat4, localHit, worldV2);

          subVec3(worldV1, worldV0, worldEdge1);
          subVec3(worldV2, worldV0, worldEdge2);
          normalizeVec3(cross3Vec3(worldEdge1, worldEdge2, worldNormal), worldNormal);
        }

        bestT = tHit;
        // Lazy-allocate / reuse the result object only when we find a hit
        // that beats the previous best. Most rays produce at most one hit.
        if (best === null) {
          best = {
            objectId: aabbHit.objectId,
            meshId: mesh.id,
            worldPos: createVec3Float64(),
            worldNormal: pickSurfaceNormal ? createVec3Float64() : null,
            tHit,
            triangleIndex: t
          };
        } else {
          best.objectId = aabbHit.objectId;
          best.meshId = mesh.id;
          best.tHit = tHit;
          best.triangleIndex = t;
        }
        best.worldPos[0] = worldHit[0];
        best.worldPos[1] = worldHit[1];
        best.worldPos[2] = worldHit[2];
        if (pickSurfaceNormal && best.worldNormal) {
          best.worldNormal[0] = worldNormal[0];
          best.worldNormal[1] = worldNormal[1];
          best.worldNormal[2] = worldNormal[2];
        }
      }
    }
  }

  return best;
}
