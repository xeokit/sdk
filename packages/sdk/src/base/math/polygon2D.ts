/**
 * 2D polygon geometry primitives — signed area, point-in-polygon
 * ray casting, Douglas-Peucker polyline / loop simplification, and
 * marching-squares contour extraction from a binary raster mask.
 *
 * Lives next to the rest of the math primitives ({@link vector},
 * {@link matrix}, {@link boundaries}, …) — every operation here
 * is pure 2D arithmetic with no scene-graph or rendering
 * dependencies.
 *
 * Two point representations are supported for the signed-area and
 * point-in-polygon helpers:
 *
 *   - **Tuple-array form** (`Point2D = [number, number]`): natural
 *     for marching-squares output and Douglas-Peucker walks, and
 *     for any code that thinks in terms of point objects.
 *   - **Flat-array form** (interleaved `[x0, y0, x1, y1, …]`):
 *     natural for code paths that already pack coordinates into a
 *     single buffer (section-cap loops, GPU-bound vertex streams).
 *
 * The two forms are layout-compatible — pick whichever matches
 * how the caller already stores its points; no copying needed.
 *
 * @module polygon2D
 */

/** A 2D point. Used as the canonical tuple form for inputs and
 *  outputs of the helpers in this module. Mutable so the type
 *  composes freely with caller-owned `[number, number][]`
 *  buffers; the helpers themselves never mutate their inputs. */
export type Point2D = [number, number];


// ─────────────────────────────────────────────────────────────────
// Signed area
// ─────────────────────────────────────────────────────────────────

/**
 * Shoelace-formula signed area of a closed 2D polygon, expressed
 * as a tuple array of vertices in walk order. Sign indicates
 * orientation — **positive** when the polygon is wound CCW (in
 * the usual math y-up convention) or CW (in image y-down
 * convention with the 1-region on the LEFT of the contour walk).
 * Magnitude is the unsigned area.
 *
 * The first vertex does NOT need to be repeated at the end — the
 * loop closes implicitly.
 */
export function polygonSignedArea2D(points: ReadonlyArray<Point2D>): number {
  let area = 0;
  for (let i = 0, n = points.length; i < n; i++) {
    const a = points[i];
    const b = points[(i + 1) % n];
    area += a[0] * b[1] - b[0] * a[1];
  }
  return area * 0.5;
}

/**
 * Flat-array variant of {@link polygonSignedArea2D}. Polygon is
 * stored as `[x0, y0, x1, y1, …]`; the array length must be even.
 * Same sign convention as the tuple variant.
 */
export function polygonSignedArea2DFlat(poly: ArrayLike<number>): number {
  let a = 0;
  const n = (poly.length / 2) | 0;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    a += poly[j * 2] * poly[i * 2 + 1] - poly[i * 2] * poly[j * 2 + 1];
  }
  return a * 0.5;
}


// ─────────────────────────────────────────────────────────────────
// Point-in-polygon
// ─────────────────────────────────────────────────────────────────

/**
 * Classic crossing-number ray-casting point-in-polygon test on a
 * tuple-array polygon. Returns `true` when `p` lies strictly
 * inside the polygon. Behaviour at vertices / along edges is
 * unspecified — callers should keep the test point off the
 * boundary, or use an inflated polygon when grazing inputs are
 * possible.
 *
 * O(n) per query. No early exit; consider a per-polygon bounding-
 * box pre-test if the caller batches many queries against the
 * same ring.
 */
export function pointInPolygon2D(p: Point2D, ring: ReadonlyArray<Point2D>): boolean {
  let inside = false;
  const n = ring.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
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
 * Flat-array variant of {@link pointInPolygon2D}. Polygon is
 * stored as `[x0, y0, x1, y1, …]`. Same semantics.
 */
export function pointInPolygon2DFlat(
  px: number, py: number, poly: ArrayLike<number>,
): boolean {
  let inside = false;
  const n = (poly.length / 2) | 0;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = poly[i * 2],     yi = poly[i * 2 + 1];
    const xj = poly[j * 2],     yj = poly[j * 2 + 1];
    if (((yi > py) !== (yj > py)) &&
        (px < (xj - xi) * (py - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }
  return inside;
}


// ─────────────────────────────────────────────────────────────────
// Polyline / loop simplification (Douglas-Peucker)
// ─────────────────────────────────────────────────────────────────

/**
 * Perpendicular distance from `p` to the (infinite) line through
 * `a` and `b`. Falls back to Euclidean point-to-point distance
 * when `a` and `b` coincide (degenerate segment), so the caller
 * doesn't need to filter those out before measuring.
 */
export function perpDistance2D(p: Point2D, a: Point2D, b: Point2D): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-12) {
    const ex = p[0] - a[0];
    const ey = p[1] - a[1];
    return Math.sqrt(ex * ex + ey * ey);
  }
  const cross = dx * (a[1] - p[1]) - (a[0] - p[0]) * dy;
  return Math.abs(cross) / Math.sqrt(len2);
}

/**
 * Standard recursive Douglas-Peucker simplification of an **open
 * polyline**. Returns a fresh array; never mutates the input.
 *
 * Drops every vertex whose perpendicular distance from the
 * straight chord between the current endpoints is below
 * `epsilon`. Endpoints are always preserved.
 *
 * For a closed loop, see {@link douglasPeuckerClosed2D}, which
 * picks a stable diametric anchor pair instead of starting from
 * an arbitrary vertex.
 */
export function douglasPeuckerOpen2D(
  points: ReadonlyArray<Point2D>, epsilon: number,
): Point2D[] {
  if (points.length < 3) return points.slice();
  const lastIdx = points.length - 1;
  let maxDist = 0;
  let splitIdx = 0;
  const a = points[0];
  const b = points[lastIdx];
  for (let i = 1; i < lastIdx; i++) {
    const d = perpDistance2D(points[i], a, b);
    if (d > maxDist) {
      maxDist = d;
      splitIdx = i;
    }
  }
  if (maxDist > epsilon) {
    const left  = douglasPeuckerOpen2D(points.slice(0, splitIdx + 1), epsilon);
    const right = douglasPeuckerOpen2D(points.slice(splitIdx),       epsilon);
    return left.slice(0, -1).concat(right);
  }
  return [points[0], points[lastIdx]];
}

/**
 * Douglas-Peucker on a closed loop. The standard recursive form
 * needs two fixed endpoints; we pick them as vertex 0 + the
 * vertex farthest from vertex 0, split the loop into two open
 * arcs there, simplify each via {@link douglasPeuckerOpen2D},
 * and stitch the result back into a closed ring.
 *
 * Robust against starting at a collinear vertex, which would
 * otherwise cause a degenerate first segment.
 *
 * Returns the original loop when simplification would leave
 * fewer than three vertices.
 */
export function douglasPeuckerClosed2D(
  loop: ReadonlyArray<Point2D>, epsilon: number,
): Point2D[] {
  if (loop.length < 4) return loop.slice();
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
  const arcA = loop.slice(0, anchorB + 1);
  const arcB = loop.slice(anchorB).concat([loop[0]]);
  const simpA = douglasPeuckerOpen2D(arcA, epsilon);
  const simpB = douglasPeuckerOpen2D(arcB, epsilon);
  const out: Point2D[] = simpA.slice(0, -1).concat(simpB.slice(0, -1));
  return out.length >= 3 ? out : loop.slice();
}


// ─────────────────────────────────────────────────────────────────
// Marching squares
// ─────────────────────────────────────────────────────────────────

/**
 * Marching-squares contour extraction from a binary raster mask.
 * `mask` is a row-major `Uint8Array`-style buffer of length
 * `width * height`, where each cell is `0` (outside) or `1`
 * (inside). Output is one closed loop per connected `1`-region,
 * walked with the 1-region on the LEFT (so under image-y-down
 * coordinates outer rings have **positive** signed area and holes
 * have **negative**).
 *
 * Cells extend one position beyond the mask on every side, so
 * `1` pixels at the buffer edge close their contour against the
 * implicit zero-padded border instead of leaking open.
 *
 * Saddles (cases 5 and 10) use the disconnected convention —
 * each diagonal `1` produces its own contour piece. Avoids
 * spurious merges across sub-pixel saddle points.
 */
export function marchingSquares2D(
  mask: ArrayLike<number>, width: number, height: number,
): Point2D[][] {
  interface Seg { a: Point2D; b: Point2D; used: boolean; }
  const segs: Seg[] = [];
  const byStart = new Map<string, Seg>();

  const sampleAt = (x: number, y: number): number => {
    if (x < 0 || y < 0 || x >= width || y >= height) return 0;
    return mask[y * width + x];
  };

  const key = (p: Point2D): string => `${p[0]},${p[1]}`;
  const addSeg = (a: Point2D, b: Point2D): void => {
    const seg: Seg = {a, b, used: false};
    segs.push(seg);
    byStart.set(key(a), seg);
  };

  for (let cy = -1; cy < height; cy++) {
    for (let cx = -1; cx < width; cx++) {
      const tl = sampleAt(cx,     cy);
      const tr = sampleAt(cx + 1, cy);
      const br = sampleAt(cx + 1, cy + 1);
      const bl = sampleAt(cx,     cy + 1);
      const code = (tl << 3) | (tr << 2) | (br << 1) | bl;
      if (code === 0 || code === 15) continue;

      // Midpoints in pixel-center coords: TL is at (cx+0.5, cy+0.5),
      // BR is at (cx+1.5, cy+1.5); the cell midpoints are the
      // midpoints between adjacent samples.
      const T: Point2D = [cx + 1,   cy + 0.5];
      const R: Point2D = [cx + 1.5, cy + 1];
      const B: Point2D = [cx + 1,   cy + 1.5];
      const L: Point2D = [cx + 0.5, cy + 1];

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
  const loops: Point2D[][] = [];
  for (const start of segs) {
    if (start.used) continue;
    start.used = true;
    const loop: Point2D[] = [start.a, start.b];
    let cur = start;
    while (true) {
      const next = byStart.get(key(cur.b));
      if (!next || next.used) break;
      next.used = true;
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
