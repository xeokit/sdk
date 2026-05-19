/**
 * Tiled, BVH-narrowed fill-polygon extraction for the drawing
 * projector.
 *
 * For each (configurable, e.g. 1024-pixel) tile of the effective
 * output buffer:
 *
 *   1. Query the {@link SceneCollisionIndex} for source
 *      SceneObjects whose world AABB intersects the tile's
 *      orthographic slab.
 *   2. Allocate a tile-local depth + owner buffer with a
 *      1-pixel halo on every side (so cells on the tile's edge
 *      can read the first row/column of every neighbour without
 *      tile-to-tile bookkeeping).
 *   3. Rasterise only the candidate objects' triangles into the
 *      tile buffer.
 *   4. For each owner that contributed visible pixels, run
 *      marching squares over the cells *owned* by the tile (TL
 *      pixel in the tile's core, halo provides the right/bottom
 *      neighbours' samples). Emit raw segments in **global
 *      pixel-centre coordinates** — adjacent tiles touch at
 *      identical integer/half-integer midpoints, so global
 *      stitching is exact.
 *   5. Free the tile buffer.
 *
 * After every tile has emitted its segments, a single global pass
 * stitches per-owner segments into closed loops (linking by
 * endpoint), classifies outer-vs-hole rings by signed area,
 * Douglas-Peucker-simplifies each, runs earcut, and lifts the
 * pixel-space vertices to world coordinates on the projection
 * plane.
 *
 * Memory peak: `O(tileSize²)` regardless of effective output
 * resolution. A 16384² effective output with 1024-pixel tiles
 * runs in ~10 MB peak (tile buffer + segment lists), where the
 * untiled extractor would need ~1 GB just for owner+depth.
 *
 * @module demo/systems/drawings/extractFillsTiled
 */
import type {SceneCollisionIndex} from "../../../spatial/collision";
import {
  SolidPrimitive,
  SurfacePrimitive,
  TrianglesPrimitive,
} from "../../../base/constants";
import {earcut} from "../../../formats/cityjson/versions/v1_0/earcut";
import type {FloatArrayParam} from "../../../base/math";
import type {AABB3} from "../../../base/math/boundaries";
import {decompressPositions3WithAABB3} from "../../../base/math/compression";
import {transformPoint3} from "../../../base/math/matrix";
import type {Vec3} from "../../../base/math/vector";
import {
  douglasPeuckerClosed2D,
  pointInPolygon2D,
  polygonSignedArea2D,
} from "../../../base/math/polygon2D";
import type {SceneModel} from "../../../model/scene";

import type {FillPolygons} from "./FillPolygons";
import type {ProjectionBasis} from "../ProjectionBasis";
import type {ExtractFillsTiledParams} from "./ExtractFillsTiledParams";



/** Pixel-space point (continuous, with one integer and one half-integer coord). */
type PixelPt = [number, number];

/** Raw marching-squares output: a directed segment in global pixel coords. */
interface Segment {
  a: PixelPt;
  b: PixelPt;
}


/**
 * Tiled fill extraction. See module docstring for the
 * algorithm; the public contract matches {@link extractFills}'s
 * `FillPolygons[]` so the caller can swap freely between the
 * tiled and untiled paths.
 */
export async function extractFillsTiled(params: ExtractFillsTiledParams): Promise<FillPolygons[]> {
  const sourceModel    = params.sourceModel;
  const basis          = params.basis;
  const aabb           = params.aabb;
  const planeDepth     = params.planeDepth;
  const resolution     = Math.max(16, params.resolution ?? 2048);
  const tileSize       = Math.max(16, params.tileSize   ?? 1024);
  const minPixelArea   = Math.max(0,  params.minPixelArea    ?? 4);
  const simplifyEps    = Math.max(0,  params.simplifyEpsilon ?? 0.25);
  const collisionIndex = params.collisionIndex;
  const yieldFn        = params.yield;
  const cancelled      = params.cancelled;

  // Centroid-clip pre-computation — see buildHLEDepthBuffer for
  // the matching commentary. Per-plane scratch arrays let the
  // per-triangle test fuse to a single multiply-add per plane
  // against the centroid; intersection-of-half-spaces is the
  // standard early-exit loop.
  const clipPlanesIn = params.clipPlanes;
  const planeCount = clipPlanesIn ? clipPlanesIn.length : 0;
  const clipNx = new Float64Array(planeCount);
  const clipNy = new Float64Array(planeCount);
  const clipNz = new Float64Array(planeCount);
  const clipThr = new Float64Array(planeCount);
  for (let i = 0; i < planeCount; i++) {
    const p = clipPlanesIn![i];
    clipNx[i] = p.normal[0];
    clipNy[i] = p.normal[1];
    clipNz[i] = p.normal[2];
    clipThr[i] = p.point[0] * p.normal[0] + p.point[1] * p.normal[1] + p.point[2] * p.normal[2];
  }

  // ── 1. Output dimensions, derived from basis-rotated AABB. ──
  const {uMin, uMax, vMin, vMax} = basisUVExtents(basis, aabb);
  const uSpan = Math.max(1e-9, uMax - uMin);
  const vSpan = Math.max(1e-9, vMax - vMin);
  const aspect = uSpan / vSpan;
  let outWidth: number, outHeight: number;
  if (aspect >= 1) {
    outWidth  = resolution;
    outHeight = Math.max(16, Math.round(resolution / aspect));
  } else {
    outHeight = resolution;
    outWidth  = Math.max(16, Math.round(resolution * aspect));
  }
  const dU = uSpan;
  const dV = vSpan;
  const pxToU = (px: number): number => uMin + (px / outWidth)  * dU;
  const pxToV = (py: number): number => vMin + (py / outHeight) * dV;

  // Basis-space d-extent of the AABB — used for the world-AABB
  // around each tile's slab when querying the BVH.
  const {dMin, dMax} = basisDExtents(basis, aabb);

  // ── 2. Owner registry (mesh.id → integer, mesh.id ↔ object.id). ──
  // Built lazily as tiles rasterise — only meshes that actually
  // contribute pixels end up here, mirroring the untiled extractor.
  const ownerMap       = new Map<string, number>();
  const ownerMeshIds:   string[] = [];
  const ownerObjectIds: string[] = [];

  // ── 3. Per-owner segment accumulators. ──
  const ownerSegments: Segment[][] = [];

  // ── 4. Per-owner total pixel count (across all tiles). Used
  //       for the min-pixel-area filter at stitch time.
  const ownerPixelTotals: number[] = [];

  // Scratch buffers reused across tiles.
  const v0: Vec3 = new Float32Array(3) as unknown as Vec3;
  const v1: Vec3 = new Float32Array(3) as unknown as Vec3;
  const v2: Vec3 = new Float32Array(3) as unknown as Vec3;
  const p0: Vec3 = new Float32Array(3) as unknown as Vec3;
  const p1: Vec3 = new Float32Array(3) as unknown as Vec3;
  const p2: Vec3 = new Float32Array(3) as unknown as Vec3;

  // ── 5. Tile loop. ─────────────────────────────────────────
  const tilesX = Math.ceil(outWidth  / tileSize);
  const tilesY = Math.ceil(outHeight / tileSize);

  for (let ty = 0; ty < tilesY; ty++) {
    for (let tx = 0; tx < tilesX; tx++) {
      const tx0 = tx * tileSize;
      const ty0 = ty * tileSize;
      const tx1 = Math.min(outWidth,  tx0 + tileSize);
      const ty1 = Math.min(outHeight, ty0 + tileSize);
      const coreW = tx1 - tx0;
      const coreH = ty1 - ty0;
      // Extended tile dimensions — 1-pixel halo on every side so
      // marching-squares cells whose corners straddle the tile
      // boundary still find samples in this tile's buffer. The
      // halo pixels are rasterised redundantly by this tile and
      // its neighbour; the duplicated work is <1% for any
      // reasonable tile size and removes all cross-tile
      // bookkeeping.
      const Wt = coreW + 2;
      const Ht = coreH + 2;

      // World AABB enclosing the tile's slab in basis space.
      // Used to narrow candidate objects via the SceneCollisionIndex.
      // Halo extents are included so triangles touching the halo
      // are caught by the query.
      const tileUMin = uMin + ((tx0 - 1) / outWidth)  * dU;
      const tileUMax = uMin + ((tx1 + 1) / outWidth)  * dU;
      const tileVMin = vMin + ((ty0 - 1) / outHeight) * dV;
      const tileVMax = vMin + ((ty1 + 1) / outHeight) * dV;
      const tileWorldAABB = computeTileWorldAABB(basis, tileUMin, tileUMax, tileVMin, tileVMax, dMin, dMax);

      // ── Tile-local buffers. ──
      const depth  = new Float32Array(Wt * Ht).fill(-Infinity);
      const owners = new Int32Array  (Wt * Ht).fill(-1);

      // Pixel-coord scaling for this tile. The tile's coordinate
      // system maps tile-local pixel coord (tx_local, ty_local)
      // to basis-u/v via `uMin + (tx_local + (tx0 - 1)) / outWidth * dU`.
      const sxTile = Wt / (tileUMax - tileUMin);
      const syTile = Ht / (tileVMax - tileVMin);

      // ── Rasterise candidate triangles into the tile buffer. ──
      const meshFilter = params.meshFilter;
      const visitObject = (objectId: string) => {
        const obj = (sourceModel.objects as any)[objectId];
        if (!obj) return;
        for (const mesh of obj.meshes) {
          // Caller-supplied predicate — keeps the fill pass
          // aligned with the HLE depth buffer's mesh set.
          if (meshFilter && !meshFilter(mesh, obj)) continue;
          const geom = mesh.geometry;
          if (!geom || !geom.indices || !geom.positionsCompressed || !geom.aabb) continue;
          if (geom.primitive !== TrianglesPrimitive &&
              geom.primitive !== SolidPrimitive    &&
              geom.primitive !== SurfacePrimitive) continue;
          // Lazy owner assignment — only meshes with rasterisable
          // triangles end up in the owner table.
          let ownerIndex = ownerMap.get(mesh.id);
          if (ownerIndex === undefined) {
            ownerIndex = ownerMeshIds.length;
            ownerMap.set(mesh.id, ownerIndex);
            ownerMeshIds.push(mesh.id);
            ownerObjectIds.push(objectId);
            ownerSegments.push([]);
            ownerPixelTotals.push(0);
          }
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
            if (planeCount > 0) {
              const cx = (p0[0] + p1[0] + p2[0]) * (1 / 3);
              const cy = (p0[1] + p1[1] + p2[1]) * (1 / 3);
              const cz = (p0[2] + p1[2] + p2[2]) * (1 / 3);
              let clipped = false;
              for (let pi = 0; pi < planeCount; pi++) {
                if (cx * clipNx[pi] + cy * clipNy[pi] + cz * clipNz[pi] < clipThr[pi]) {
                  clipped = true;
                  break;
                }
              }
              if (clipped) continue;
            }
            rasteriseTriangleIntoTile(
              basis, p0, p1, p2,
              tileUMin, tileVMin, sxTile, syTile,
              Wt, Ht, depth, owners, ownerIndex,
            );
          }
        }
      };

      if (collisionIndex) {
        collisionIndex.forEachInAABB(tileWorldAABB, visitObject);
      } else {
        // Fall back to a linear walk — same correctness, O(N) per
        // tile instead of O(log N).
        for (const id of Object.keys(sourceModel.objects)) visitObject(id);
      }

      // ── Per-owner marching-squares on this tile. ──
      //
      // Histogram first so we only allocate / walk masks for
      // owners that actually have pixels here. Owned cells are
      // those whose TL pixel sits in the tile's CORE region
      // ((cx, cy) in [1, coreW+1) × [1, coreH+1) in tile-local
      // coords) — cells on the halo are owned by adjacent tiles
      // and would be emitted twice if we processed them here.
      const tileOwnerPixelCounts = new Int32Array(ownerMeshIds.length);
      // Walk only the core region for the pixel histogram —
      // halo pixels would double-count across adjacent tiles.
      for (let y = 1; y < 1 + coreH; y++) {
        let base = y * Wt + 1;
        for (let x = 1; x < 1 + coreW; x++, base++) {
          const own = owners[base];
          if (own >= 0) tileOwnerPixelCounts[own]++;
        }
      }

      const tileMask = new Uint8Array(Wt * Ht);
      for (let ownerIndex = 0; ownerIndex < ownerMeshIds.length; ownerIndex++) {
        const count = tileOwnerPixelCounts[ownerIndex];
        if (count === 0) continue;
        ownerPixelTotals[ownerIndex] += count;
        // Build the binary mask over the FULL tile buffer
        // (core + halo) so cells on the tile boundary see the
        // owner's pixels in the halo when the contour crosses.
        tileMask.fill(0);
        for (let i = 0, len = owners.length; i < len; i++) {
          if (owners[i] === ownerIndex) tileMask[i] = 1;
        }
        emitTileSegments(
          tileMask, Wt, Ht,
          /* owned cell range — TL pixel in core: */
          /* cxMin */ 1, /* cxMax (excl) */ 1 + coreW,
          /* cyMin */ 1, /* cyMax (excl) */ 1 + coreH,
          /* global pixel-coord offset for emitted midpoints: */
          tx0 - 1, ty0 - 1,
          ownerSegments[ownerIndex],
        );
      }

      // Yield to the host between tiles so the progressive
      // drawing paints in as extraction streams through.
      // Cancellation also checked here so a teardown
      // mid-extraction returns promptly with whatever was
      // collected so far (the caller drops the partial result).
      if (yieldFn) await yieldFn();
      if (cancelled && cancelled()) return [];
    }
  }

  // ── 6. Per-owner global stitching + triangulation. ──
  const out: FillPolygons[] = [];
  const r = basis.right, upAxis = basis.up, forward = basis.forward;
  const fx = forward[0] * planeDepth;
  const fy = forward[1] * planeDepth;
  const fz = forward[2] * planeDepth;

  for (let ownerIndex = 0; ownerIndex < ownerMeshIds.length; ownerIndex++) {
    if (ownerPixelTotals[ownerIndex] < minPixelArea) continue;
    const segments = ownerSegments[ownerIndex];
    if (segments.length === 0) continue;

    const loops = stitchSegments(segments);
    if (loops.length === 0) continue;

    // Outer vs hole — see the matching pass in extractFills:
    // marching-squares-with-1-on-the-LEFT walks produce NEGATIVE
    // shoelace area for outer rings of the 1-region in
    // image-y-down coords, POSITIVE for holes.
    const outers: Array<{points: PixelPt[]; area: number}> = [];
    const holes:  Array<{points: PixelPt[]; area: number}> = [];
    for (const raw of loops) {
      const simplified = simplifyEps > 0 ? douglasPeuckerClosed2D(raw, simplifyEps) : raw;
      if (simplified.length < 3) continue;
      const sa = polygonSignedArea2D(simplified);
      if      (sa < 0) outers.push({points: simplified, area: -sa});
      else if (sa > 0) holes .push({points: simplified, area:  sa});
    }
    if (outers.length === 0) continue;

    // Hole → outer assignment by smallest containing outer.
    const holeAssignments: number[][] = outers.map(() => []);
    if (outers.length === 1) {
      for (let h = 0; h < holes.length; h++) holeAssignments[0].push(h);
    } else {
      for (let h = 0; h < holes.length; h++) {
        const probe = holes[h].points[0];
        let bestOuter = -1, bestArea = Infinity;
        for (let o = 0; o < outers.length; o++) {
          if (outers[o].area >= bestArea) continue;
          if (pointInPolygon2D(probe, outers[o].points)) {
            bestOuter = o; bestArea = outers[o].area;
          }
        }
        if (bestOuter >= 0) holeAssignments[bestOuter].push(h);
      }
    }

    // Triangulate each (outer + holes) group and lift to world.
    const positions: number[] = [];
    const indices:   number[] = [];
    for (let o = 0; o < outers.length; o++) {
      const ring = outers[o].points;
      const myHoles = holeAssignments[o];
      const flat: number[] = [];
      const holeIndices: number[] = [];
      for (const p of ring) flat.push(p[0], p[1]);
      for (const hi of myHoles) {
        holeIndices.push(flat.length / 2);
        for (const p of holes[hi].points) flat.push(p[0], p[1]);
      }
      const tris = earcut(flat, holeIndices.length > 0 ? holeIndices : undefined, 2);
      if (tris.length === 0) continue;

      const base = positions.length / 3;
      for (let i = 0; i < flat.length; i += 2) {
        const px = flat[i], py = flat[i + 1];
        const u = pxToU(px);
        const v = pxToV(py);
        positions.push(
          u * r[0] + v * upAxis[0] + fx,
          u * r[1] + v * upAxis[1] + fy,
          u * r[2] + v * upAxis[2] + fz,
        );
      }
      for (let i = 0; i < tris.length; i++) indices.push(base + tris[i]);
    }

    if (indices.length === 0) continue;
    out.push({
      sourceObjectId: ownerObjectIds[ownerIndex],
      sourceMeshId:   ownerMeshIds[ownerIndex],
      positions,
      indices,
    });
  }

  return out;
}


// ─────────────────────────────────────────────────────────────────
// Tile rasterisation
// ─────────────────────────────────────────────────────────────────

/**
 * Rasterise one world-space triangle into the tile-local depth +
 * owner buffer. Mirrors {@link computeHLE.rasterizeTriangle} but
 * inlined here so the tile's u/v origin + scale stay in
 * closure-local consts instead of round-tripping through a
 * buffer struct.
 */
function rasteriseTriangleIntoTile(
  basis: ProjectionBasis,
  p0: ArrayLike<number>,
  p1: ArrayLike<number>,
  p2: ArrayLike<number>,
  tileUMin: number, tileVMin: number,
  sxTile: number, syTile: number,
  Wt: number, Ht: number,
  data: Float32Array, owners: Int32Array,
  ownerIndex: number,
): void {
  const r = basis.right, u_ = basis.up, f = basis.forward;
  const u0 = p0[0] * r[0] + p0[1] * r[1] + p0[2] * r[2];
  const v0 = p0[0] * u_[0] + p0[1] * u_[1] + p0[2] * u_[2];
  const d0 = -(p0[0] * f[0] + p0[1] * f[1] + p0[2] * f[2]);
  const u1 = p1[0] * r[0] + p1[1] * r[1] + p1[2] * r[2];
  const v1 = p1[0] * u_[0] + p1[1] * u_[1] + p1[2] * u_[2];
  const d1 = -(p1[0] * f[0] + p1[1] * f[1] + p1[2] * f[2]);
  const u2 = p2[0] * r[0] + p2[1] * r[1] + p2[2] * r[2];
  const v2 = p2[0] * u_[0] + p2[1] * u_[1] + p2[2] * u_[2];
  const d2 = -(p2[0] * f[0] + p2[1] * f[1] + p2[2] * f[2]);
  const x0 = (u0 - tileUMin) * sxTile;
  const y0 = (v0 - tileVMin) * syTile;
  const x1 = (u1 - tileUMin) * sxTile;
  const y1 = (v1 - tileVMin) * syTile;
  const x2 = (u2 - tileUMin) * sxTile;
  const y2 = (v2 - tileVMin) * syTile;

  const minX = Math.max(0,      Math.floor(Math.min(x0, x1, x2)));
  const maxX = Math.min(Wt - 1, Math.ceil (Math.max(x0, x1, x2)));
  const minY = Math.max(0,      Math.floor(Math.min(y0, y1, y2)));
  const maxY = Math.min(Ht - 1, Math.ceil (Math.max(y0, y1, y2)));
  if (maxX < minX || maxY < minY) return;

  const area = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0);
  if (Math.abs(area) < 1e-9) return;
  const invArea = 1 / area;

  for (let py = minY; py <= maxY; py++) {
    for (let px = minX; px <= maxX; px++) {
      const sxC = px + 0.5;
      const syC = py + 0.5;
      const w0 = ((x1 - sxC) * (y2 - syC) - (x2 - sxC) * (y1 - syC)) * invArea;
      const w1 = ((x2 - sxC) * (y0 - syC) - (x0 - sxC) * (y2 - syC)) * invArea;
      const w2 = 1 - w0 - w1;
      if ((w0 >= 0 && w1 >= 0 && w2 >= 0) ||
          (w0 <= 0 && w1 <= 0 && w2 <= 0)) {
        const depth = w0 * d0 + w1 * d1 + w2 * d2;
        const idx = py * Wt + px;
        if (depth > data[idx]) {
          data[idx] = depth;
          owners[idx] = ownerIndex;
        }
      }
    }
  }
}


// ─────────────────────────────────────────────────────────────────
// Per-tile marching squares — segments only, no stitching
// ─────────────────────────────────────────────────────────────────

/**
 * Walk the cells in [cxMin, cxMax) × [cyMin, cyMax) of `mask` and
 * push directed boundary segments into `out` in GLOBAL pixel-
 * centre coordinates. Coordinates outside `[0, W) × [0, H)` are
 * sampled as `0` so contours close cleanly along the mask edge
 * (the tile's halo extends the sampleable region one pixel
 * beyond the owned-cell range, so halo cells emit segments that
 * link to neighbouring tiles' segments at integer/half-integer
 * midpoints — pixel-perfect global stitching with no float fuzz).
 *
 * Disconnected-saddle convention matches the untiled extractor —
 * see {@link extractFills}'s marching-squares notes for the
 * full case-by-case derivation.
 */
function emitTileSegments(
  mask: Uint8Array, W: number, H: number,
  cxMin: number, cxMax: number,
  cyMin: number, cyMax: number,
  originX: number, originY: number,
  out: Segment[],
): void {
  const sampleAt = (x: number, y: number): number => {
    if (x < 0 || y < 0 || x >= W || y >= H) return 0;
    return mask[y * W + x];
  };
  // Pre-mapping helpers from tile-local cell coords to global
  // pixel-centre coords. Tile-local cell (cx, cy) has TL pixel
  // at tile-local index (cx, cy); the global pixel index is
  // (cx + originX, cy + originY) → centre at
  // (cx + originX + 0.5, cy + originY + 0.5). Midpoints follow
  // the same offset.
  for (let cy = cyMin; cy < cyMax; cy++) {
    for (let cx = cxMin; cx < cxMax; cx++) {
      const tl = sampleAt(cx,     cy);
      const tr = sampleAt(cx + 1, cy);
      const br = sampleAt(cx + 1, cy + 1);
      const bl = sampleAt(cx,     cy + 1);
      const code = (tl << 3) | (tr << 2) | (br << 1) | bl;
      if (code === 0 || code === 15) continue;
      // Midpoints in global pixel-centre coords.
      const gx = cx + originX;
      const gy = cy + originY;
      const T: PixelPt = [gx + 1,   gy + 0.5];
      const R: PixelPt = [gx + 1.5, gy + 1];
      const B: PixelPt = [gx + 1,   gy + 1.5];
      const L: PixelPt = [gx + 0.5, gy + 1];
      switch (code) {
        case 1:  out.push({a: B, b: L}); break;
        case 2:  out.push({a: R, b: B}); break;
        case 3:  out.push({a: R, b: L}); break;
        case 4:  out.push({a: T, b: R}); break;
        case 5:  out.push({a: T, b: R}); out.push({a: B, b: L}); break;
        case 6:  out.push({a: T, b: B}); break;
        case 7:  out.push({a: T, b: L}); break;
        case 8:  out.push({a: L, b: T}); break;
        case 9:  out.push({a: B, b: T}); break;
        case 10: out.push({a: L, b: T}); out.push({a: R, b: B}); break;
        case 11: out.push({a: R, b: T}); break;
        case 12: out.push({a: L, b: R}); break;
        case 13: out.push({a: B, b: R}); break;
        case 14: out.push({a: L, b: B}); break;
      }
    }
  }
}


/**
 * Stitch raw directed segments into closed loops by chaining
 * each segment's `b` endpoint to whichever segment starts at the
 * same point. Endpoint identity is exact — adjacent tiles emit
 * segments whose endpoints land on the same global pixel-centre
 * coords (one of x/y is an integer column boundary, the other a
 * pixel-row centre), so a string-key lookup is unambiguous and
 * float-fuzz-free.
 */
function stitchSegments(segments: Segment[]): PixelPt[][] {
  const used = new Uint8Array(segments.length);
  const byStart = new Map<string, number>();   // key → segment index
  const ptKey = (p: PixelPt): string => `${p[0]},${p[1]}`;
  for (let i = 0; i < segments.length; i++) {
    byStart.set(ptKey(segments[i].a), i);
  }
  const loops: PixelPt[][] = [];
  for (let startIdx = 0; startIdx < segments.length; startIdx++) {
    if (used[startIdx]) continue;
    used[startIdx] = 1;
    const start = segments[startIdx];
    const loop: PixelPt[] = [start.a, start.b];
    let cur = start;
    while (true) {
      const nextIdx = byStart.get(ptKey(cur.b));
      if (nextIdx === undefined) break;
      if (used[nextIdx]) break;
      used[nextIdx] = 1;
      const next = segments[nextIdx];
      const closes = next.b[0] === loop[0][0] && next.b[1] === loop[0][1];
      if (closes) break;
      loop.push(next.b);
      cur = next;
    }
    if (loop.length >= 3) loops.push(loop);
  }
  return loops;
}


// ─────────────────────────────────────────────────────────────────
// Basis / AABB helpers
// ─────────────────────────────────────────────────────────────────

function basisUVExtents(
  basis: ProjectionBasis,
  aabb: FloatArrayParam,
): {uMin: number; uMax: number; vMin: number; vMax: number} {
  const {right, up} = basis;
  const xMin = aabb[0], yMin = aabb[1], zMin = aabb[2];
  const xMax = aabb[3], yMax = aabb[4], zMax = aabb[5];
  let uMin =  Infinity, uMax = -Infinity;
  let vMin =  Infinity, vMax = -Infinity;
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


function basisDExtents(
  basis: ProjectionBasis,
  aabb: FloatArrayParam,
): {dMin: number; dMax: number} {
  const f = basis.forward;
  const xMin = aabb[0], yMin = aabb[1], zMin = aabb[2];
  const xMax = aabb[3], yMax = aabb[4], zMax = aabb[5];
  let dMin = Infinity, dMax = -Infinity;
  for (let i = 0; i < 8; i++) {
    const x = (i & 1) ? xMax : xMin;
    const y = (i & 2) ? yMax : yMin;
    const z = (i & 4) ? zMax : zMin;
    const d = x * f[0] + y * f[1] + z * f[2];
    if (d < dMin) dMin = d;
    if (d > dMax) dMax = d;
  }
  return {dMin, dMax};
}


/**
 * Build the axis-aligned world-space AABB enclosing the
 * basis-space slab `[uMin, uMax] × [vMin, vMax] × [dMin, dMax]`.
 * Used to feed a tile's frustum into `SceneCollisionIndex.forEachInAABB`
 * — over-conservative for oblique bases (at most a √3 factor),
 * exact for axis-aligned bases.
 */
function computeTileWorldAABB(
  basis: ProjectionBasis,
  uMin: number, uMax: number,
  vMin: number, vMax: number,
  dMin: number, dMax: number,
): AABB3 {
  const r = basis.right, up = basis.up, f = basis.forward;
  let xMin =  Infinity, yMin =  Infinity, zMin =  Infinity;
  let xMax = -Infinity, yMax = -Infinity, zMax = -Infinity;
  for (let i = 0; i < 8; i++) {
    const u = (i & 1) ? uMax : uMin;
    const v = (i & 2) ? vMax : vMin;
    const d = (i & 4) ? dMax : dMin;
    const x = u * r[0] + v * up[0] + d * f[0];
    const y = u * r[1] + v * up[1] + d * f[1];
    const z = u * r[2] + v * up[2] + d * f[2];
    if (x < xMin) xMin = x; if (x > xMax) xMax = x;
    if (y < yMin) yMin = y; if (y > yMax) yMax = y;
    if (z < zMin) zMin = z; if (z > zMax) zMax = z;
  }
  const out = new Float64Array(6) as unknown as AABB3;
  out[0] = xMin; out[1] = yMin; out[2] = zMin;
  out[3] = xMax; out[4] = yMax; out[5] = zMax;
  return out;
}
