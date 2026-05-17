/**
 * Per-source-object filled-polygon extraction for the wireframe
 * projector. Consumes an {@link HLEDepthBuffer} built with
 * `withOwners`, walks the parallel owner buffer once per source
 * SceneObject, traces the binary visibility mask via marching
 * squares, simplifies the contour with Douglas-Peucker, classifies
 * outer-vs-hole topology, and triangulates with earcut. The
 * returned positions live on the projection plane in world space —
 * one filled polygon set per source SceneObject that has at least
 * one frontmost pixel in the depth buffer.
 *
 * Both the wireframe edges and these fills are derived from the
 * same depth buffer, so their pixel-accurate boundaries coincide:
 * the wireframe sits exactly on the fill silhouette, no halo at
 * occlusion edges.
 *
 * @module demo/systems/drawings/extractFills
 */
import {earcut} from "../../../formats/cityjson/versions/v1_0/earcut";

import type {HLEDepthBuffer} from "../hle/HLEDepthBuffer";
import type {FillPolygons} from "./FillPolygons";
import type {ExtractFillsOptions} from "./ExtractFillsOptions";




/**
 * Extract filled-polygon geometry, one per source SceneMesh
 * that contributed at least one frontmost pixel to `buffer`.
 *
 * @param buffer Depth buffer built with `withOwners: true`.
 * @param planeDepth Basis-space d-coordinate of the projection
 *   plane (i.e. `dot(planePoint, buffer.basis.forward)`). The
 *   orchestrator computes this from the AABB extent along
 *   `basis.forward` plus the user-supplied offset, and the
 *   extractor uses it to lift each pixel back to a 3D world
 *   point on the plane.
 * @param options Tuning knobs.
 */
export function extractFills(
  buffer: HLEDepthBuffer,
  planeDepth: number,
  options: ExtractFillsOptions = {},
): FillPolygons[] {
  const owners         = buffer.owners;
  const ownerMeshIds   = buffer.ownerMeshIds;
  const ownerObjectIds = buffer.ownerObjectIds;
  if (!owners || !ownerMeshIds || !ownerObjectIds) {
    throw new Error(
      "[extractFills] HLEDepthBuffer was built without owner tracking. " +
      "Pass `withOwners: true` to buildHLEDepthBuffer.",
    );
  }
  const minPixelArea     = Math.max(0, options.minPixelArea     ?? 4);
  const simplifyEpsilon  = Math.max(0, options.simplifyEpsilon  ?? 0.25);

  const {width: W, height: H, uMin, uMax, vMin, vMax, basis} = buffer;
  const dU = uMax - uMin;
  const dV = vMax - vMin;
  const right   = basis.right;
  const upAxis  = basis.up;
  const forward = basis.forward;
  // Pre-multiply forward by the constant plane-depth — every
  // emitted vertex's depth contribution is the same, so the
  // multiplication only needs doing once per call.
  const fx = forward[0] * planeDepth;
  const fy = forward[1] * planeDepth;
  const fz = forward[2] * planeDepth;

  // Histogram pass — pixel count per owner, so a single pass
  // tells us which owners to bother extracting. Skipping owners
  // under the minimum-area threshold here saves both the
  // per-owner mask allocation and the marching-squares walk.
  const pixelCounts = new Int32Array(ownerMeshIds.length);
  for (let i = 0, len = owners.length; i < len; i++) {
    const owner = owners[i];
    if (owner >= 0) pixelCounts[owner]++;
  }

  const out: FillPolygons[] = [];
  // Scratch mask reused for each owner — Uint8 is plenty for a
  // binary 0/1 buffer and is fast to memset.
  const mask = new Uint8Array(W * H);

  for (let ownerIndex = 0; ownerIndex < ownerMeshIds.length; ownerIndex++) {
    if (pixelCounts[ownerIndex] < minPixelArea) continue;

    mask.fill(0);
    for (let i = 0, len = owners.length; i < len; i++) {
      if (owners[i] === ownerIndex) mask[i] = 1;
    }

    // Trace closed contours along the 0/1 boundary in pixel space.
    const loops = marchingSquares(mask, W, H);
    if (loops.length === 0) continue;

    // Classify each loop as outer (1-region inside) or hole
    // (0-region inside) by signed shoelace area. The marching-
    // squares table walks every ring with the 1-region on the
    // LEFT — in *image-y-down* coordinates (pixel y grows
    // downward), that walk produces a NEGATIVE shoelace area
    // for outer rings of 1-regions and a POSITIVE area for
    // holes. (Same walk in math-y-up convention flips signs, so
    // the more familiar "positive area = CCW = outer" rule is
    // not what applies here.) We store absolute areas so the
    // containment-by-smallest-enclosing-outer pass works
    // sign-agnostically.
    const outers: Array<{points: PixelPt[]; area: number}> = [];
    const holes:  Array<{points: PixelPt[]; area: number}> = [];
    for (const raw of loops) {
      const simplified = simplifyEpsilon > 0
        ? douglasPeuckerClosed(raw, simplifyEpsilon)
        : raw;
      if (simplified.length < 3) continue;
      const signedArea = polygonSignedArea(simplified);
      if (signedArea < 0) outers.push({points: simplified, area: -signedArea});
      else if (signedArea > 0) holes.push({points: simplified, area: signedArea});
    }
    if (outers.length === 0) continue;

    // Group each hole under its smallest containing outer. For
    // a single outer (the common case for BIM objects whose
    // projection is one connected blob), every hole pairs with
    // that outer and the containment test is skipped.
    const holeAssignments: number[][] = outers.map(() => []);
    if (outers.length === 1) {
      for (let h = 0; h < holes.length; h++) holeAssignments[0].push(h);
    } else {
      for (let h = 0; h < holes.length; h++) {
        const probe = holes[h].points[0];
        let bestOuter = -1;
        let bestArea = Infinity;
        for (let o = 0; o < outers.length; o++) {
          if (outers[o].area >= bestArea) continue;
          if (pointInPolygon(probe, outers[o].points)) {
            bestOuter = o;
            bestArea = outers[o].area;
          }
        }
        if (bestOuter >= 0) holeAssignments[bestOuter].push(h);
      }
    }

    // Triangulate each outer + its holes via earcut, mapping
    // pixel coordinates to world coordinates on the projection
    // plane as we build the position buffer.
    const positions: number[] = [];
    const indices:   number[] = [];
    for (let o = 0; o < outers.length; o++) {
      const ring = outers[o].points;
      const myHoles = holeAssignments[o];

      // Flat 2D coords for earcut, in pixel space. World mapping
      // is order-preserving and affine, so triangulating in
      // pixel space and remapping is equivalent to triangulating
      // in world space — and pixel-space avoids the precision
      // tax of the (potentially very large) world coords.
      const flat: number[] = [];
      const holeIndices: number[] = [];
      for (const p of ring) flat.push(p[0], p[1]);
      for (const hi of myHoles) {
        holeIndices.push(flat.length / 2);
        for (const p of holes[hi].points) flat.push(p[0], p[1]);
      }

      const tris = earcut(flat, holeIndices.length > 0 ? holeIndices : undefined, 2);
      if (tris.length === 0) continue;

      // Emit world-space positions. Each pixel (px, py) lifts to
      // basis-space (u, v, planeDepth), then to world via
      // `u*right + v*up + planeDepth*forward`. The depth-axis
      // contribution `planeDepth*forward` is pre-baked into
      // (fx, fy, fz) above so each vertex only pays for the
      // u- and v-axis multiply-adds.
      const base = positions.length / 3;
      for (let i = 0; i < flat.length; i += 2) {
        const px = flat[i];
        const py = flat[i + 1];
        const u = uMin + (px / W) * dU;
        const v = vMin + (py / H) * dV;
        positions.push(
          u * right[0] + v * upAxis[0] + fx,
          u * right[1] + v * upAxis[1] + fy,
          u * right[2] + v * upAxis[2] + fz,
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
// Marching squares — binary mask → list of closed contours
// ─────────────────────────────────────────────────────────────────

type PixelPt = [number, number];

/**
 * Trace the 0/1 boundary of `mask` using marching squares with
 * the disconnected-saddle convention. Returns a list of closed
 * loops, each given as a sequence of pixel-space points with
 * the 1-region consistently on the LEFT (i.e. positive signed
 * area in image-y-down coords).
 *
 * Cells extend one position beyond the mask on every side so
 * "1" pixels at the buffer edge close their contour against
 * the implicit zero-padded border instead of leaking open.
 */
function marchingSquares(mask: Uint8Array, W: number, H: number): PixelPt[][] {
  // Segment store. Each segment knows its endpoints and whether
  // it's been consumed by the stitching pass. We also index
  // segments by their `start` endpoint key, so the stitcher can
  // chase the loop forward in O(1) per hop.
  interface Seg { a: PixelPt; b: PixelPt; used: boolean; }
  const segs: Seg[] = [];
  const byStart = new Map<string, Seg>();

  const sampleAt = (x: number, y: number): number => {
    if (x < 0 || y < 0 || x >= W || y >= H) return 0;
    return mask[y * W + x];
  };

  const key = (p: PixelPt): string => `${p[0]},${p[1]}`;
  const addSeg = (a: PixelPt, b: PixelPt): void => {
    const seg: Seg = {a, b, used: false};
    segs.push(seg);
    byStart.set(key(a), seg);
  };

  // Pixel-center samples — cell (cx, cy) has TL/TR/BR/BL at
  // pixel centers offset by (0.5, 0.5). Iterating cx in
  // [-1, W-1] (inclusive) wraps a zero-padded border around
  // every mask=1 region.
  for (let cy = -1; cy < H; cy++) {
    for (let cx = -1; cx < W; cx++) {
      const tl = sampleAt(cx,     cy);
      const tr = sampleAt(cx + 1, cy);
      const br = sampleAt(cx + 1, cy + 1);
      const bl = sampleAt(cx,     cy + 1);
      const code = (tl << 3) | (tr << 2) | (br << 1) | bl;
      if (code === 0 || code === 15) continue;

      // Midpoints in pixel-center coords: TL is at (cx+0.5, cy+0.5),
      // BR is at (cx+1.5, cy+1.5), so the cell midpoints are
      // these convex midpoints between adjacent samples.
      const T: PixelPt = [cx + 1,   cy + 0.5];
      const R: PixelPt = [cx + 1.5, cy + 1];
      const B: PixelPt = [cx + 1,   cy + 1.5];
      const L: PixelPt = [cx + 0.5, cy + 1];

      // Disconnected-saddle convention for cases 5 and 10: each
      // diagonal "1" gets its own contour piece. Avoids spurious
      // merges across sub-pixel saddle points.
      switch (code) {
        case 1:  addSeg(B, L); break;
        case 2:  addSeg(R, B); break;
        case 3:  addSeg(R, L); break;
        case 4:  addSeg(T, R); break;
        case 5:  addSeg(T, R); addSeg(B, L); break;
        case 6:  addSeg(T, B); break;
        case 7:  addSeg(T, L); break;
        case 8:  addSeg(L, T); break;
        case 9:  addSeg(B, T); break;
        case 10: addSeg(L, T); addSeg(R, B); break;
        case 11: addSeg(R, T); break;
        case 12: addSeg(L, R); break;
        case 13: addSeg(B, R); break;
        case 14: addSeg(L, B); break;
      }
    }
  }

  // Stitch segments end-to-start into closed loops.
  const loops: PixelPt[][] = [];
  for (const start of segs) {
    if (start.used) continue;
    start.used = true;
    const loop: PixelPt[] = [start.a, start.b];
    let cur = start;
    while (true) {
      const next = byStart.get(key(cur.b));
      if (!next || next.used) break;
      next.used = true;
      // The next segment closes the loop iff its end matches
      // the loop's start — in that case we're done without
      // re-emitting the start point. Otherwise we append the
      // segment's end and keep walking.
      const closes =
        next.b[0] === loop[0][0] && next.b[1] === loop[0][1];
      if (closes) break;
      loop.push(next.b);
      cur = next;
    }
    if (loop.length >= 3) loops.push(loop);
  }
  return loops;
}


// ─────────────────────────────────────────────────────────────────
// Polygon utilities
// ─────────────────────────────────────────────────────────────────

/**
 * Signed polygon area in image-y-down coordinates. Positive
 * when the polygon is CCW under that convention (1-region on
 * the LEFT when walking the contour), negative for CW (holes).
 */
function polygonSignedArea(points: PixelPt[]): number {
  let area = 0;
  for (let i = 0, n = points.length; i < n; i++) {
    const a = points[i];
    const b = points[(i + 1) % n];
    area += a[0] * b[1] - b[0] * a[1];
  }
  return area * 0.5;
}


/**
 * Standard ray-casting point-in-polygon test. Used to associate
 * each hole with the outer ring that contains it when an owner
 * projects into multiple disjoint outer blobs.
 */
function pointInPolygon(p: PixelPt, ring: PixelPt[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1];
    const xj = ring[j][0], yj = ring[j][1];
    const intersect =
      ((yi > p[1]) !== (yj > p[1])) &&
      p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}


/**
 * Douglas-Peucker on a closed loop. The standard recursive form
 * needs two fixed endpoints; we pick them as the diametrically
 * opposite pair (the two points furthest apart on the loop),
 * split the loop into two open arcs there, simplify each, and
 * stitch the result back into a closed ring. Robust against
 * starting at a collinear vertex, which would otherwise cause
 * a degenerate first segment.
 */
function douglasPeuckerClosed(loop: PixelPt[], epsilon: number): PixelPt[] {
  if (loop.length < 4) return loop;

  // Pick the two anchor points: vertex 0 + the vertex farthest
  // from vertex 0. This is cheaper than the full pairwise
  // diameter and gives the same robustness — vertex 0 is always
  // a corner of the marching-squares output (it sits at the
  // start of a freshly-stitched contour).
  let anchorB = 0;
  let anchorBDist = 0;
  for (let i = 1; i < loop.length; i++) {
    const dx = loop[i][0] - loop[0][0];
    const dy = loop[i][1] - loop[0][1];
    const d2 = dx * dx + dy * dy;
    if (d2 > anchorBDist) {
      anchorBDist = d2;
      anchorB = i;
    }
  }
  // Two arcs: 0..anchorB and anchorB..end..0.
  const arcA = loop.slice(0, anchorB + 1);
  const arcB = loop.slice(anchorB).concat([loop[0]]);
  const simpA = douglasPeuckerOpen(arcA, epsilon);
  const simpB = douglasPeuckerOpen(arcB, epsilon);
  // Concatenate, dropping the duplicated anchor at arc seam and
  // the duplicated start at the loop seam.
  const out: PixelPt[] = simpA.slice(0, -1).concat(simpB.slice(0, -1));
  return out.length >= 3 ? out : loop;
}


function douglasPeuckerOpen(points: PixelPt[], epsilon: number): PixelPt[] {
  if (points.length < 3) return points.slice();
  const lastIdx = points.length - 1;
  // Walk the polyline once and keep the vertex farthest from
  // the straight chord between the endpoints. The standard
  // recursive structure: split there, simplify the two halves,
  // stitch.
  let maxDist = 0;
  let splitIdx = 0;
  const a = points[0];
  const b = points[lastIdx];
  for (let i = 1; i < lastIdx; i++) {
    const d = perpDistance(points[i], a, b);
    if (d > maxDist) {
      maxDist = d;
      splitIdx = i;
    }
  }
  if (maxDist > epsilon) {
    const left  = douglasPeuckerOpen(points.slice(0, splitIdx + 1), epsilon);
    const right = douglasPeuckerOpen(points.slice(splitIdx),       epsilon);
    return left.slice(0, -1).concat(right);
  }
  return [points[0], points[lastIdx]];
}


/** Perpendicular distance from `p` to the line through `a`-`b`. */
function perpDistance(p: PixelPt, a: PixelPt, b: PixelPt): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-12) {
    // Degenerate segment — fall back to point-to-point distance.
    const ex = p[0] - a[0];
    const ey = p[1] - a[1];
    return Math.sqrt(ex * ex + ey * ey);
  }
  const cross = dx * (a[1] - p[1]) - (a[0] - p[0]) * dy;
  return Math.abs(cross) / Math.sqrt(len2);
}


