import type {FDSXB, FDSObst, FDSHole} from "./types";

/**
 * For each {@link FDSObst}, subtract every {@link FDSHole} that
 * intersects it and return the remainder as a flat list of axis-
 * aligned boxes. Each remainder box carries a reference back to its
 * source obst so the geometry / data builders can attribute it.
 *
 * The decomposition is the canonical "subtract a sub-AABB from an
 * AABB" split — up to 6 axis-aligned remainder boxes per hole-obst
 * intersection (one slab on each face of the hole that isn't flush
 * with the obst's matching face). Repeated for each subsequent hole
 * that intersects any of the remainders.
 *
 * Volumes that collapse to zero (shrink-by-zero) are dropped. An obst
 * fully enclosed by a hole disappears entirely.
 *
 * @internal
 */
export function applyHoles(obsts: readonly FDSObst[], holes: readonly FDSHole[]):
  ReadonlyArray<{obst: FDSObst; index: number; xb: FDSXB}> {

  const out: Array<{obst: FDSObst; index: number; xb: FDSXB}> = [];

  for (const obst of obsts) {
    let remainders: FDSXB[] = [normalise(obst.xb)];
    for (const hole of holes) {
      const h = normalise(hole.xb);
      const next: FDSXB[] = [];
      for (const r of remainders) {
        for (const piece of subtract(r, h)) next.push(piece);
      }
      remainders = next;
      if (remainders.length === 0) break;
    }
    for (let i = 0; i < remainders.length; i++) {
      out.push({obst, index: i, xb: remainders[i]});
    }
  }

  return out;
}

/**
 * Subtract `h` from `r`. Returns the 0–6 remainder boxes that, taken
 * together, equal `r \ h`. The decomposition takes one slab off each
 * face of `r` that lies inside `h` — left/right slab in X, then the
 * Y slabs from the X-clipped remainder, then the Z slabs from the
 * X- and Y-clipped remainder. This yields at most 6 non-overlapping
 * boxes whose union is `r \ h`.
 *
 * No intersection → returns `[r]` unchanged.
 * Full containment → returns `[]`.
 *
 * @internal
 */
export function subtract(r: FDSXB, h: FDSXB): FDSXB[] {
  if (!overlaps(r, h)) return [r];

  // Clip the hole to the receiver — we only care about the part of `h`
  // that actually intersects `r`. Outside that, this is the "no
  // intersection" case caught above.
  const cx1 = Math.max(r[0], h[0]); const cx2 = Math.min(r[1], h[1]);
  const cy1 = Math.max(r[2], h[2]); const cy2 = Math.min(r[3], h[3]);
  const cz1 = Math.max(r[4], h[4]); const cz2 = Math.min(r[5], h[5]);

  // Full enclosure (every face flush or beyond) → empty remainder.
  if (cx1 <= r[0] && cx2 >= r[1] &&
      cy1 <= r[2] && cy2 >= r[3] &&
      cz1 <= r[4] && cz2 >= r[5]) {
    return [];
  }

  const out: FDSXB[] = [];

  // Left slab in X.
  if (cx1 > r[0]) out.push([r[0], cx1, r[2], r[3], r[4], r[5]]);
  // Right slab in X.
  if (cx2 < r[1]) out.push([cx2, r[1], r[2], r[3], r[4], r[5]]);
  // Front slab in Y — restricted to the X-overlap range so we don't
  // double-count the corners.
  if (cy1 > r[2]) out.push([cx1, cx2, r[2], cy1, r[4], r[5]]);
  if (cy2 < r[3]) out.push([cx1, cx2, cy2, r[3], r[4], r[5]]);
  // Bottom slab in Z — restricted to the X- and Y-overlap ranges.
  if (cz1 > r[4]) out.push([cx1, cx2, cy1, cy2, r[4], cz1]);
  if (cz2 < r[5]) out.push([cx1, cx2, cy1, cy2, cz2, r[5]]);

  // Drop any zero-volume remainders (cleaner downstream and protects
  // against tiny floating-point sliver boxes from near-flush holes).
  return out.filter(b => b[1] > b[0] && b[3] > b[2] && b[5] > b[4]);
}

/** Returns true when `a` and `b` share interior volume (strict overlap). */
function overlaps(a: FDSXB, b: FDSXB): boolean {
  return a[0] < b[1] && a[1] > b[0]
      && a[2] < b[3] && a[3] > b[2]
      && a[4] < b[5] && a[5] > b[4];
}

/**
 * Sort the XB axes so min ≤ max on every axis. FDS lets authors pass
 * the bounds in either order; the subtraction logic assumes
 * min-then-max.
 */
function normalise(xb: FDSXB): FDSXB {
  return [
    Math.min(xb[0], xb[1]), Math.max(xb[0], xb[1]),
    Math.min(xb[2], xb[3]), Math.max(xb[2], xb[3]),
    Math.min(xb[4], xb[5]), Math.max(xb[4], xb[5]),
  ];
}
