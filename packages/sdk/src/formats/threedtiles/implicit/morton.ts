/**
 * Morton (Z-order) index helpers for 3D Tiles implicit tiling. A tile's index
 * within a subtree level is its Morton index — the per-level child indices
 * (x + 2y [+ 4z]) concatenated from the subtree root down to the tile.
 */

export interface Subdivision {
  /** Children per tile: 4 for QUADTREE, 8 for OCTREE. */
  branch: number;
  /** Spatial dimensions: 2 for QUADTREE, 3 for OCTREE. */
  dims: number;
}

export function subdivisionOf(scheme: string): Subdivision {
  return scheme === "OCTREE" ? {branch: 8, dims: 3} : {branch: 4, dims: 2};
}

/** Count of tiles in levels 0..level-1 of a subtree (the bitstream offset of `level`). */
export function tilesBeforeLevel(branch: number, level: number): number {
  return (Math.pow(branch, level) - 1) / (branch - 1);
}

/** Bit `axis` (0=x, 1=y, 2=z) of a child index. */
export function childAxisBit(childIndex: number, axis: number): number {
  return (childIndex >> axis) & 1;
}
