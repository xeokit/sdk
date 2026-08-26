import type {ProjectionBasis} from "../ProjectionBasis";
import type {FillPolygons} from "../fills/FillPolygons";

/**
 * Result of {@link computeLabelPlacement}. All values live in
 * basis-space (u, v) — projection-plane 2D coordinates.
 *
 * `inscribedRadius` is the largest gap between the placement
 * anchor and any boundary edge of the polygon; the caller sizes
 * the label to a fraction of this radius.
 *
 * `area` is the polygon's signed-area sum across the triangle
 * soup, in basis-space units². Callers can multiply by
 * `world-units-per-(u, v)` (always 1; the projection basis is
 * orthonormal) for a world-space area. Used for the optional
 * "12.4 m²" subtitle and for the min-area cutoff filter.
 */
export interface LabelPlacement {
  u: number;
  v: number;
  inscribedRadius: number;
  area: number;
}

/**
 * Approximate the pole-of-inaccessibility for a triangle-soup
 * polygon, returned in projection-basis (u, v) space.
 *
 * Strategy:
 *
 *   1. Project every position from world space onto the
 *      {@link ProjectionBasis}'s `(right, up)` plane, building
 *      a u/v point list parallel to the original triangle
 *      indices.
 *   2. Walk the triangle list, summing the triangulated area
 *      (shoelace per triangle), and collect every triangle
 *      **edge** into a multiset. Edges shared between two
 *      triangles are interior; edges that appear exactly once
 *      are boundary. The boundary edge set is the polygon
 *      outline regardless of triangulation choice.
 *   3. Grid-sample the polygon's (u, v) AABB. At each sample
 *      point, run the standard winding-number point-in-polygon
 *      test against the boundary edges; if inside, compute the
 *      minimum distance to any boundary edge. The sample with
 *      the largest min-distance is the placement anchor; that
 *      distance is the inscribed radius.
 *
 * This is a coarse-grid approximation of the recursive subdivision used
 * in Mapbox's `polylabel`, accurate to one cell at the chosen grid
 * resolution.
 *
 * Returns `null` when the polygon has no boundary edges (every
 * edge was shared by two triangles — degenerate input) or no
 * grid sample landed inside.
 *
 * @param fills - Triangle soup for one source SceneObject. May
 *   span multiple SceneMeshes; their triangles are concatenated
 *   into a single polygon for placement.
 * @param basis - Projection basis used to flatten world
 *   positions to (u, v).
 * @param gridResolution - Number of grid cells along the longer
 *   side of the polygon's AABB. Default `32`. Increase to push
 *   placement accuracy closer to the inscribed circle's true
 *   centre at the cost of `O(N²)` more samples.
 */
export function computeLabelPlacement(
  fills: ReadonlyArray<FillPolygons>,
  basis: ProjectionBasis,
  gridResolution: number = 32,
): LabelPlacement | null {

  // ── 1. Project all positions to (u, v) and re-index. ──────
  //
  // We index triangle indices into a single concatenated u/v
  // array so we don't have to track which mesh each triangle
  // came from; the per-source-object polygon is the union of
  // every mesh's triangles.
  const r = basis.right, up = basis.up;
  const u: number[] = [];
  const v: number[] = [];
  const tris: number[] = [];

  for (const f of fills) {
    const base = u.length;
    const pos = f.positions;
    for (let i = 0; i < pos.length; i += 3) {
      u.push(pos[i] * r[0] + pos[i + 1] * r[1] + pos[i + 2] * r[2]);
      v.push(pos[i] * up[0] + pos[i + 1] * up[1] + pos[i + 2] * up[2]);
    }
    const idx = f.indices;
    for (let i = 0; i < idx.length; i++) {
      tris.push(base + idx[i]);
    }
  }
  if (tris.length < 3) return null;

  // ── 2. Boundary edge set + area sum. ──────────────────────
  //
  // Edge key: pack the two vertex indices into a single
  // `min * N + max` integer. The map's value is the appearance
  // count; entries ending at 1 are boundary, entries at 2 are
  // interior (anything higher would mean a non-manifold soup,
  // which the marching-squares fill extractor never produces —
  // its rings are simple polygons).
  const vCount = u.length;
  const edgeCount = new Map<number, number>();
  const edgeA: number[] = [];
  const edgeB: number[] = [];
  let area2 = 0;   // 2× signed area, summed shoelace across triangles

  for (let t = 0; t < tris.length; t += 3) {
    const a = tris[t], b = tris[t + 1], c = tris[t + 2];
    area2 += (u[b] - u[a]) * (v[c] - v[a]) - (u[c] - u[a]) * (v[b] - v[a]);
    for (let e = 0; e < 3; e++) {
      const i = e === 0 ? a : e === 1 ? b : c;
      const j = e === 0 ? b : e === 1 ? c : a;
      const lo = Math.min(i, j);
      const hi = Math.max(i, j);
      const key = lo * vCount + hi;
      edgeCount.set(key, (edgeCount.get(key) ?? 0) + 1);
    }
  }
  for (const [key, n] of edgeCount) {
    if (n !== 1) continue;
    edgeA.push(Math.floor(key / vCount));
    edgeB.push(key % vCount);
  }
  if (edgeA.length === 0) return null;
  const area = Math.abs(area2) * 0.5;

  // ── 3. (u, v) AABB. ───────────────────────────────────────
  let uMin = Infinity, uMax = -Infinity, vMin = Infinity, vMax = -Infinity;
  for (let i = 0; i < vCount; i++) {
    if (u[i] < uMin) uMin = u[i];
    if (u[i] > uMax) uMax = u[i];
    if (v[i] < vMin) vMin = v[i];
    if (v[i] > vMax) vMax = v[i];
  }
  const uSpan = uMax - uMin;
  const vSpan = vMax - vMin;
  if (uSpan <= 0 || vSpan <= 0) return null;

  // ── 4. Grid sample, keep the cell with the largest         ─
  //       interior-min-distance to any boundary edge.
  const cellsU = uSpan >= vSpan ? gridResolution : Math.max(1, Math.round(gridResolution * uSpan / vSpan));
  const cellsV = vSpan >= uSpan ? gridResolution : Math.max(1, Math.round(gridResolution * vSpan / uSpan));
  const stepU = uSpan / cellsU;
  const stepV = vSpan / cellsV;

  let bestU = (uMin + uMax) * 0.5;
  let bestV = (vMin + vMax) * 0.5;
  let bestR = -1;

  for (let cy = 0; cy < cellsV; cy++) {
    const sy = vMin + (cy + 0.5) * stepV;
    for (let cx = 0; cx < cellsU; cx++) {
      const sx = uMin + (cx + 0.5) * stepU;
      // Winding-number point-in-polygon. Track signed crossings
      // of horizontal ray (sx → +u, fixed v = sy) against each
      // boundary edge; non-zero winding means inside. Robust
      // on polygons with holes when the soup contains both
      // outer and inner rings (marching-squares emits inner
      // rings with opposite winding from outers).
      let winding = 0;
      let minDist2 = Infinity;
      for (let k = 0; k < edgeA.length; k++) {
        const ax = u[edgeA[k]], ay = v[edgeA[k]];
        const bx = u[edgeB[k]], by = v[edgeB[k]];
        // Crossing test on the horizontal ray at v = sy.
        if ((ay > sy) !== (by > sy)) {
          const xIntersect = ax + (sy - ay) * (bx - ax) / (by - ay);
          if (sx < xIntersect) {
            winding += (by > ay) ? 1 : -1;
          }
        }
        // Min-distance to this edge segment.
        const ex = bx - ax, ey = by - ay;
        const len2 = ex * ex + ey * ey;
        let t = 0;
        if (len2 > 0) {
          t = ((sx - ax) * ex + (sy - ay) * ey) / len2;
          if (t < 0) t = 0; else if (t > 1) t = 1;
        }
        const dx = sx - (ax + t * ex);
        const dy = sy - (ay + t * ey);
        const d2 = dx * dx + dy * dy;
        if (d2 < minDist2) minDist2 = d2;
      }
      if (winding === 0) continue;
      if (minDist2 > bestR * bestR) {
        bestR = Math.sqrt(minDist2);
        bestU = sx;
        bestV = sy;
      }
    }
  }
  if (bestR <= 0) return null;

  return {u: bestU, v: bestV, inscribedRadius: bestR, area};
}
