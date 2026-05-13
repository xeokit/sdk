/**
 * CPU-side hidden-line elimination for the blueprint projector.
 *
 * Rasterises every triangle of every mesh in a SceneModel into
 * an orthographic depth buffer along an arbitrary projection
 * direction. The projection direction is encoded as a
 * {@link ProjectionBasis | basis} (`right`, `up`, `forward`
 * orthonormal triple) so the projector handles both AABB-face
 * presets and oblique / diagonal views with the same code.
 *
 * The depth buffer stores "distance-toward-camera" at each
 * pixel — closer points overwrite farther points. An edge
 * segment is then visible wherever its sampled depth is at or
 * in front of the buffer (within a small tolerance bias).
 *
 * Resolution and sampling rate are tunable. A 2048 × 2048
 * buffer over a 20 m AABB gives ~1 cm per pixel — fine for BIM
 * models. Edges are split at visibility transitions by sampling
 * `samples` points along each segment and walking the runs.
 *
 * @module demo/systems/blueprintProjector/computeHLE
 */
import type {SceneModel} from "../../../scene";
import {
  SolidPrimitive,
  SurfacePrimitive,
  TrianglesPrimitive,
} from "../../../constants";
import type {FloatArrayParam} from "../../../math";
import {decompressPositions3WithAABB3} from "../../../math/compression";
import {transformPoint3} from "../../../math/matrix";
import type {Vec3} from "../../../math/vector";

import type {ProjectionBasis} from "./projectBlueprint";


/**
 * Orthographic depth buffer over the projection plane. Pixels
 * are stored in row-major order. Each cell holds the max
 * "distance-toward-camera" depth seen during rasterisation;
 * cells the rasteriser never touched stay at `-Infinity`.
 *
 * "Distance toward camera" is `-dot(point, basis.forward)` —
 * `basis.forward` points from the camera through the scene, so
 * negating that dot product yields a value that grows as
 * points move toward the camera (the convention the rest of
 * the pipeline reads from).
 *
 * The (uMin, uMax) / (vMin, vMax) extents are in **basis
 * coordinates**: u is `dot(point, basis.right)`, v is
 * `dot(point, basis.up)`. For an axis-aligned basis these
 * collapse to the world-axis extents the old face-based code
 * used; for an oblique basis they're the rotated AABB's
 * extents on the image plane.
 *
 * When the buffer was built with `withOwners`, `owners` is a
 * parallel `width × height` Int32 grid whose cells hold the
 * index into the owner tables of the source {@link SceneMesh}
 * that owns the frontmost triangle at that pixel. Owners are
 * tracked at *source-mesh* granularity so downstream code that
 * emits projected geometry can partition output to mirror the
 * source SceneModel's hierarchy one-to-one. Two parallel index
 * tables map the integer owner back to source identifiers:
 *
 * - {@link HLEDepthBuffer.ownerMeshIds | ownerMeshIds}`[i]`   — source SceneMesh id.
 * - {@link HLEDepthBuffer.ownerObjectIds | ownerObjectIds}`[i]` — id of the SceneObject the mesh belongs to.
 *
 * Cells the rasteriser never touched are `-1`. All three
 * owner-related fields are `null` when owner tracking was
 * disabled.
 */
export interface HLEDepthBuffer {
  width: number;
  height: number;
  /** `width × height` Float32 depth values. */
  data: Float32Array;
  /** Basis-space u extent (right-axis projection of the AABB). */
  uMin: number; uMax: number;
  /** Basis-space v extent (up-axis projection of the AABB). */
  vMin: number; vMax: number;
  /** Projection basis used to build the buffer. */
  basis: ProjectionBasis;
  /**
   * Optional per-pixel owner index, parallel to {@link data}.
   * `-1` means the pixel was never touched by any triangle.
   * Present only when the buffer was built with `withOwners`.
   */
  owners: Int32Array | null;
  /**
   * Owner index → source SceneMesh id. Same length as the
   * number of source SceneMeshes that contributed at least one
   * triangle to the rasteriser.
   */
  ownerMeshIds: string[] | null;
  /**
   * Owner index → id of the source SceneObject the mesh at
   * that index belongs to. Same length as `ownerMeshIds`. Lets
   * the fill extractor partition by SceneObject while keeping
   * per-mesh fidelity inside each object.
   */
  ownerObjectIds: string[] | null;
}


export interface BuildHLEDepthBufferOptions {
  /**
   * Buffer resolution along the longer of (u, v). Default `2048`.
   * Drives both edge-HLE precision and (when paired with
   * `withOwners`) the silhouette fidelity of fill extraction —
   * 2048 gives ~5 mm/pixel on a 10 m model, fine enough that
   * Douglas-Peucker simplification stays sub-mm.
   */
  resolution?: number;
  /**
   * When `true`, also rasterise a per-pixel owner index parallel
   * to the depth buffer — see {@link HLEDepthBuffer.owners}. Used
   * by the fill-polygon extractor to know which source
   * SceneObject owns each pixel; ignored by edge-only HLE.
   * Default `false`.
   */
  withOwners?: boolean;
  /**
   * Optional callback awaited every `yieldEveryObjects` source
   * SceneObjects so the host renderer can paint between
   * batches. Without it the rasteriser runs straight through
   * to completion (the right shape when the caller wants a
   * single atomic build).
   */
  yield?: () => Promise<void>;
  /**
   * How many source SceneObjects to rasterise between
   * `yield()` calls. Default `25`. A 1024² buffer with HLE
   * defaults raster-fills one ~1000-object IFC building at
   * roughly 25 objects per frame on a desktop, so 25 paces the
   * yields to ~one per frame.
   */
  yieldEveryObjects?: number;
  /**
   * Optional check called between yield batches. Return `true`
   * to abort the build; the returned buffer is the partial
   * one (still usable for visualisation but missing
   * unprocessed source objects).
   */
  cancelled?: () => boolean;
  /**
   * Optional cut-away clip plane. When supplied, triangles
   * whose **centroid** satisfies
   * `dot(centroid - clipPoint, clipNormal) < 0` are skipped
   * during rasterisation — i.e. the side `clipNormal` points
   * toward is kept, the opposite side is discarded. Used to
   * render sliced cross-section / cut-away blueprints.
   * `clipNormal` must be unit length.
   */
  clipPoint?:  ArrayLike<number>;
  clipNormal?: ArrayLike<number>;
}


/**
 * Walk every triangle on every mesh of `sourceModel` and
 * rasterise it into the returned depth buffer. The buffer
 * spans the source AABB projected onto the basis's
 * `right`/`up` axes; geometry outside that rotated rect falls
 * outside the buffer and is ignored.
 *
 * @param sourceModel SceneModel whose triangles seed the depth buffer.
 * @param basis Projection basis defining the view direction.
 * @param aabb World-space AABB (`[xMin,yMin,zMin, xMax,yMax,zMax]`)
 *   to bound the buffer. Eight corners of this AABB are
 *   transformed into basis space to derive the buffer's u/v
 *   extents.
 * @param options Tuning knobs.
 */
export async function buildHLEDepthBuffer(
  sourceModel: SceneModel,
  basis: ProjectionBasis,
  aabb: FloatArrayParam,
  options: BuildHLEDepthBufferOptions = {},
): Promise<HLEDepthBuffer> {
  // Basis-space AABB extents — project all 8 world corners
  // onto basis u/v and take min/max. For an axis-aligned basis
  // this matches `aabb[uAxis]` / `aabb[uAxis+3]` (the rotated
  // rect is the AABB rect); for an oblique basis it's the
  // tilted AABB's larger screen footprint.
  const {uMin, uMax, vMin, vMax} = basisAABBExtents(basis, aabb);
  const uSpan = Math.max(1e-9, uMax - uMin);
  const vSpan = Math.max(1e-9, vMax - vMin);

  const resolution = Math.max(16, options.resolution ?? 2048);
  // Keep the buffer roughly isotropic — drive the larger axis
  // at `resolution` pixels and scale the shorter axis to match.
  const aspect = uSpan / vSpan;
  let width: number, height: number;
  if (aspect >= 1) {
    width  = resolution;
    height = Math.max(16, Math.round(resolution / aspect));
  } else {
    height = resolution;
    width  = Math.max(16, Math.round(resolution * aspect));
  }

  const data = new Float32Array(width * height);
  data.fill(-Infinity);

  // Owner tracking is opt-in — it costs a parallel Int32Array
  // and one extra write per rasterised pixel. Skip the allocation
  // entirely when the caller only wants edge HLE.
  const withOwners = options.withOwners === true;
  const owners: Int32Array | null = withOwners ? new Int32Array(width * height) : null;
  if (owners) owners.fill(-1);
  // Two parallel tables — index → SceneMesh id, and index → its
  // SceneObject id. Both grow in lockstep so `ownerMeshIds[i]`
  // and `ownerObjectIds[i]` always describe the same source
  // mesh. `null` when owner tracking is disabled.
  const ownerMeshIds:   string[] | null = withOwners ? [] : null;
  const ownerObjectIds: string[] | null = withOwners ? [] : null;

  const buffer: HLEDepthBuffer = {
    width, height, data,
    uMin, uMax, vMin, vMax,
    basis,
    owners,
    ownerMeshIds,
    ownerObjectIds,
  };

  // Scratch storage for the three transformed triangle vertices
  // in world space, hoisted out of the rasterisation loop.
  const v0: Vec3 = new Float32Array(3) as unknown as Vec3;
  const v1: Vec3 = new Float32Array(3) as unknown as Vec3;
  const v2: Vec3 = new Float32Array(3) as unknown as Vec3;
  const p0: Vec3 = new Float32Array(3) as unknown as Vec3;
  const p1: Vec3 = new Float32Array(3) as unknown as Vec3;
  const p2: Vec3 = new Float32Array(3) as unknown as Vec3;

  const yieldFn           = options.yield;
  const yieldEveryObjects = Math.max(1, options.yieldEveryObjects ?? 25);
  const cancelled         = options.cancelled;
  let objectsSinceYield = 0;

  // Centroid-clip pre-computation. The discard test is
  // `dot(centroid, n) - dot(point, n) < 0`, so cache the
  // right-hand side as a scalar threshold to save a vector
  // subtraction per triangle. When no plane is supplied,
  // `clipActive` stays false and the test is skipped.
  const clipActive = options.clipPoint != null && options.clipNormal != null;
  const clipNx = clipActive ? options.clipNormal![0] : 0;
  const clipNy = clipActive ? options.clipNormal![1] : 0;
  const clipNz = clipActive ? options.clipNormal![2] : 0;
  const clipThreshold = clipActive
    ? options.clipPoint![0] * clipNx + options.clipPoint![1] * clipNy + options.clipPoint![2] * clipNz
    : 0;

  for (const objectId of Object.keys(sourceModel.objects)) {
    const obj = sourceModel.objects[objectId];
    for (const mesh of obj.meshes) {
      const geom = mesh.geometry;
      if (!geom || !geom.indices || !geom.positionsCompressed || !geom.aabb) continue;
      if (geom.primitive !== TrianglesPrimitive &&
          geom.primitive !== SolidPrimitive &&
          geom.primitive !== SurfacePrimitive) continue;
      // Owner index is per source SceneMesh — assigned lazily on
      // the first rasterised triangle so the owner tables only
      // contain meshes that actually contributed pixels. The
      // parallel mesh/object id pair pins the owner to a
      // specific (mesh, object) pair downstream code can use to
      // mirror the source hierarchy in the blueprint.
      let ownerIndex = -1;
      const local = decompressPositions3WithAABB3(
        geom.positionsCompressed as FloatArrayParam,
        geom.aabb,
      );
      const worldMatrix = mesh.worldMatrix;
      const idx = geom.indices;
      for (let i = 0, len = idx.length; i < len; i += 3) {
        const a = idx[i]     * 3;
        const b = idx[i + 1] * 3;
        const c = idx[i + 2] * 3;
        v0[0] = local[a];     v0[1] = local[a + 1]; v0[2] = local[a + 2];
        v1[0] = local[b];     v1[1] = local[b + 1]; v1[2] = local[b + 2];
        v2[0] = local[c];     v2[1] = local[c + 1]; v2[2] = local[c + 2];
        transformPoint3(worldMatrix, v0, p0);
        transformPoint3(worldMatrix, v1, p1);
        transformPoint3(worldMatrix, v2, p2);
        if (clipActive) {
          // Centroid-side test for the clip plane. The
          // boundary is sub-pixel jagged at the cut edge —
          // acceptable at the default 2048+ buffer
          // resolutions where the per-triangle pixel
          // footprint is small anyway.
          const cx = (p0[0] + p1[0] + p2[0]) * (1 / 3);
          const cy = (p0[1] + p1[1] + p2[1]) * (1 / 3);
          const cz = (p0[2] + p1[2] + p2[2]) * (1 / 3);
          if (cx * clipNx + cy * clipNy + cz * clipNz < clipThreshold) continue;
        }
        if (ownerMeshIds && ownerObjectIds && ownerIndex < 0) {
          ownerIndex = ownerMeshIds.length;
          ownerMeshIds.push(mesh.id);
          ownerObjectIds.push(objectId);
        }
        rasterizeTriangle(buffer, p0, p1, p2, ownerIndex);
      }
    }
    if (yieldFn) {
      objectsSinceYield++;
      if (objectsSinceYield >= yieldEveryObjects) {
        objectsSinceYield = 0;
        await yieldFn();
        if (cancelled && cancelled()) return buffer;
      }
    }
  }

  return buffer;
}


/**
 * Project the 8 corners of a world-space AABB into basis
 * coordinates and return the rotated rectangle's u/v extents.
 * The d-axis extent isn't returned here — depth is per-vertex
 * for rasterisation, so the buffer doesn't need its bounds.
 */
export function basisAABBExtents(
  basis: ProjectionBasis,
  aabb: FloatArrayParam,
): {uMin: number; uMax: number; vMin: number; vMax: number} {
  const {right, up} = basis;
  const xMin = aabb[0], yMin = aabb[1], zMin = aabb[2];
  const xMax = aabb[3], yMax = aabb[4], zMax = aabb[5];
  let uMin =  Infinity, uMax = -Infinity;
  let vMin =  Infinity, vMax = -Infinity;
  // Manually unrolled 8-corner walk — small loop, negligible
  // overhead even compared to the rasterisation cost.
  for (let i = 0; i < 8; i++) {
    const x = (i & 1) ? xMax : xMin;
    const y = (i & 2) ? yMax : yMin;
    const z = (i & 4) ? zMax : zMin;
    const u = x * right[0] + y * right[1] + z * right[2];
    const v = x * up[0]    + y * up[1]    + z * up[2];
    if (u < uMin) uMin = u; if (u > uMax) uMax = u;
    if (v < vMin) vMin = v; if (v > vMax) vMax = v;
  }
  return {uMin, uMax, vMin, vMax};
}


/**
 * "Distance toward camera" for a world-space point under
 * `basis` — `-dot(point, basis.forward)`. Larger values are
 * closer to the camera. Matches the convention the depth
 * buffer stores so per-vertex depth fits straight into the
 * max-wins comparison used during rasterisation.
 */
export function basisDepth(basis: ProjectionBasis, point: ArrayLike<number>): number {
  const f = basis.forward;
  return -(point[0] * f[0] + point[1] * f[1] + point[2] * f[2]);
}


/**
 * Test whether a single world-space point would be visible
 * from the projection-direction camera. Returns `true` when
 * the point's depth equals or exceeds the depth-buffer value
 * at its pixel (i.e. the point is at or in front of the
 * recorded surface), within `tolerance` world units of bias.
 */
export function isPointVisible(
  buffer: HLEDepthBuffer,
  point: ArrayLike<number>,
  tolerance: number,
): boolean {
  const r = buffer.basis.right;
  const u_ = buffer.basis.up;
  const u  = point[0] * r[0]  + point[1] * r[1]  + point[2] * r[2];
  const v  = point[0] * u_[0] + point[1] * u_[1] + point[2] * u_[2];
  const px = Math.floor(((u - buffer.uMin) / (buffer.uMax - buffer.uMin)) * buffer.width);
  const py = Math.floor(((v - buffer.vMin) / (buffer.vMax - buffer.vMin)) * buffer.height);
  // Out-of-bounds samples — points outside the source AABB
  // footprint — are conservatively visible. They couldn't
  // have been covered by any rasterised triangle so they
  // can't be occluded.
  if (px < 0 || py < 0 || px >= buffer.width || py >= buffer.height) {
    return true;
  }
  const stored = buffer.data[py * buffer.width + px];
  if (stored === -Infinity) return true;
  return basisDepth(buffer.basis, point) >= stored - tolerance;
}


/**
 * Test an edge against the depth buffer at `samples` evenly
 * spaced parameter values, return the runs of consecutive
 * visible samples as visible sub-segment endpoints in world
 * space. An edge that is fully visible returns one segment
 * equal to itself; a fully hidden edge returns the empty array.
 *
 * The first and last sample are pinned to the edge endpoints
 * so emitted segments don't shrink-by-one-sample at each end.
 */
export function visibleEdgeSegments(
  buffer: HLEDepthBuffer,
  pa: ArrayLike<number>,
  pb: ArrayLike<number>,
  samples: number,
  tolerance: number,
): Array<{a: [number, number, number]; b: [number, number, number]}> {
  if (samples < 2) samples = 2;
  // Build the visibility mask along the edge.
  const visible: boolean[] = new Array(samples);
  const pt = new Float64Array(3);
  for (let i = 0; i < samples; i++) {
    const t = i / (samples - 1);
    pt[0] = pa[0] + (pb[0] - pa[0]) * t;
    pt[1] = pa[1] + (pb[1] - pa[1]) * t;
    pt[2] = pa[2] + (pb[2] - pa[2]) * t;
    visible[i] = isPointVisible(buffer, pt, tolerance);
  }
  // Walk the mask, emitting one segment per visible run. Run
  // boundaries are placed midway between the visible / hidden
  // samples on each side — i.e. at parameter
  // `(i_visible + i_hidden) / 2 / (samples - 1)`, which keeps
  // emitted segments from over- or under-shrinking by half a
  // sample.
  const out: Array<{a: [number, number, number]; b: [number, number, number]}> = [];
  let runStart = -1;
  for (let i = 0; i < samples; i++) {
    if (visible[i] && runStart < 0) {
      runStart = i;
    } else if (!visible[i] && runStart >= 0) {
      out.push(makeSegment(pa, pb, runStart, i - 1, samples));
      runStart = -1;
    }
  }
  if (runStart >= 0) {
    out.push(makeSegment(pa, pb, runStart, samples - 1, samples));
  }
  return out;
}

function makeSegment(
  pa: ArrayLike<number>,
  pb: ArrayLike<number>,
  iStart: number,
  iEnd: number,
  samples: number,
): {a: [number, number, number]; b: [number, number, number]} {
  // Extend the run by half a sample on each side, unless we're
  // already at the edge endpoint. This both reduces visible
  // gaps at occlusion boundaries and keeps the endpoint anchors
  // exact.
  const lastIdx = samples - 1;
  const tStart = iStart === 0      ? 0 : (iStart - 0.5) / lastIdx;
  const tEnd   = iEnd   === lastIdx ? 1 : (iEnd   + 0.5) / lastIdx;
  return {
    a: [
      pa[0] + (pb[0] - pa[0]) * tStart,
      pa[1] + (pb[1] - pa[1]) * tStart,
      pa[2] + (pb[2] - pa[2]) * tStart,
    ],
    b: [
      pa[0] + (pb[0] - pa[0]) * tEnd,
      pa[1] + (pb[1] - pa[1]) * tEnd,
      pa[2] + (pb[2] - pa[2]) * tEnd,
    ],
  };
}


// ─────────────────────────────────────────────────────────────────
// Triangle rasterisation
// ─────────────────────────────────────────────────────────────────

/**
 * Rasterise one world-space triangle into the depth buffer.
 * Vertex positions are projected to basis (u, v) coordinates
 * and to depth-toward-camera before the usual edge-function
 * scanline; depth is linearly interpolated across the triangle
 * from the three vertex depths.
 *
 * Backfaces are kept — the rasteriser doesn't cull. Walls in
 * BIM are routinely modelled as single-sided surfaces facing
 * one way; culling would miss occluding triangles drawn from
 * the unfavourable side.
 */
function rasterizeTriangle(
  buf: HLEDepthBuffer,
  p0: ArrayLike<number>,
  p1: ArrayLike<number>,
  p2: ArrayLike<number>,
  /**
   * Owner index for this triangle's source SceneMesh, or `-1`
   * when the buffer wasn't built with `withOwners`. Written
   * into the buffer's owner grid alongside the depth, but only
   * at pixels that win the depth test — so each cell's owner
   * stays in sync with the depth value the rest of the
   * pipeline reads.
   */
  ownerIndex: number,
): void {
  const {basis, width, height, uMin, uMax, vMin, vMax, data, owners} = buf;
  const r = basis.right, u_ = basis.up, f = basis.forward;
  // Basis-space projection (u, v, depth-toward-camera) for
  // each vertex.
  const u0 = p0[0] * r[0] + p0[1] * r[1] + p0[2] * r[2];
  const v0 = p0[0] * u_[0] + p0[1] * u_[1] + p0[2] * u_[2];
  const d0 = -(p0[0] * f[0] + p0[1] * f[1] + p0[2] * f[2]);
  const u1 = p1[0] * r[0] + p1[1] * r[1] + p1[2] * r[2];
  const v1 = p1[0] * u_[0] + p1[1] * u_[1] + p1[2] * u_[2];
  const d1 = -(p1[0] * f[0] + p1[1] * f[1] + p1[2] * f[2]);
  const u2 = p2[0] * r[0] + p2[1] * r[1] + p2[2] * r[2];
  const v2 = p2[0] * u_[0] + p2[1] * u_[1] + p2[2] * u_[2];
  const d2 = -(p2[0] * f[0] + p2[1] * f[1] + p2[2] * f[2]);
  // Map basis-(u, v) to pixel-(x, y).
  const sx = width  / (uMax - uMin);
  const sy = height / (vMax - vMin);
  const x0 = (u0 - uMin) * sx;
  const y0 = (v0 - vMin) * sy;
  const x1 = (u1 - uMin) * sx;
  const y1 = (v1 - vMin) * sy;
  const x2 = (u2 - uMin) * sx;
  const y2 = (v2 - vMin) * sy;

  // Bounding box.
  const minX = Math.max(0,              Math.floor(Math.min(x0, x1, x2)));
  const maxX = Math.min(width  - 1,     Math.ceil (Math.max(x0, x1, x2)));
  const minY = Math.max(0,              Math.floor(Math.min(y0, y1, y2)));
  const maxY = Math.min(height - 1,     Math.ceil (Math.max(y0, y1, y2)));
  if (maxX < minX || maxY < minY) return;

  // Edge-function area term.
  const area = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0);
  if (Math.abs(area) < 1e-9) return; // degenerate / collinear
  const invArea = 1 / area;

  for (let py = minY; py <= maxY; py++) {
    for (let px = minX; px <= maxX; px++) {
      // Sample at pixel centre.
      const sxC = px + 0.5;
      const syC = py + 0.5;
      // Barycentric weights via edge functions.
      const w0 = ((x1 - sxC) * (y2 - syC) - (x2 - sxC) * (y1 - syC)) * invArea;
      const w1 = ((x2 - sxC) * (y0 - syC) - (x0 - sxC) * (y2 - syC)) * invArea;
      const w2 = 1 - w0 - w1;
      // Inside-test on a signed area is sign-dependent on the
      // triangle's winding. Accept either sign.
      if ((w0 >= 0 && w1 >= 0 && w2 >= 0) ||
          (w0 <= 0 && w1 <= 0 && w2 <= 0)) {
        const depth = w0 * d0 + w1 * d1 + w2 * d2;
        const idx = py * width + px;
        if (depth > data[idx]) {
          data[idx] = depth;
          if (owners) owners[idx] = ownerIndex;
        }
      }
    }
  }
}
