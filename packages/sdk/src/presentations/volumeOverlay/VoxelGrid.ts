/**
 * Three-dimensional scalar field on a regular grid — the canonical
 * data carrier for {@link buildVolumeSlicePlane | volume overlays}.
 *
 * Data layout is row-major over `(x, y, z)` so the slowest-changing
 * axis is `z`. Index of cell `(ix, iy, iz)` is
 * `iz * nx * ny + iy * nx + ix`. This matches the convention used
 * by VTK, NumPy `[z, y, x]` and the OpenFOAM cube-cell ordering.
 *
 * @module presentations/volumeOverlay
 */

export interface VoxelGrid {

  /** Cell values, row-major over `(x, y, z)`. Length = nx · ny · nz. */
  data: Float32Array;

  /** Cell counts along the (x, y, z) axes. */
  resolution: [number, number, number];

  /** World-space minimum corner of the volume bounding box. */
  min: [number, number, number];

  /** World-space maximum corner of the volume bounding box. */
  max: [number, number, number];

  /**
   * Display unit for `data`. Used by the panel's legend and stat
   * readouts. Pure metadata — the renderer is unit-agnostic.
   * Examples: `"°C"`, `"ppm"`, `"dB"`, `"m/s"`, `"lux"`.
   */
  unit?: string;

  /**
   * Min / max of the colormap range. Falls back to the data's
   * actual min / max when not specified. Lock this when you want
   * multiple overlays to be visually comparable.
   */
  valueRange?: [number, number];

  /** Human-readable name for the field. Used by the panel header. */
  name?: string;
}


/**
 * Sample a {@link VoxelGrid} at an arbitrary world-space point.
 * Trilinearly interpolates between the eight surrounding cell
 * centres — same behaviour the GPU's `LINEAR` filtering provides
 * on a `TEXTURE_3D`, so a CPU bake of a slice plane looks identical
 * to a GPU-rendered one at the same resolution.
 *
 * Returns `NaN` for points outside the volume bounding box; callers
 * should test with `Number.isNaN` before using the result.
 */
export function sampleVoxelGrid(
  grid: VoxelGrid,
  x: number, y: number, z: number,
): number {

  const [nx, ny, nz] = grid.resolution;
  const [minX, minY, minZ] = grid.min;
  const [maxX, maxY, maxZ] = grid.max;

  // Map world → grid-cell index in `[0, n-1]` (cell-centred).
  const fx = ((x - minX) / (maxX - minX)) * (nx - 1);
  const fy = ((y - minY) / (maxY - minY)) * (ny - 1);
  const fz = ((z - minZ) / (maxZ - minZ)) * (nz - 1);

  if (fx < 0 || fy < 0 || fz < 0 || fx > nx - 1 || fy > ny - 1 || fz > nz - 1) {
    return NaN;
  }

  // Integer + fractional parts for trilinear weights.
  const ix0 = Math.floor(fx), iy0 = Math.floor(fy), iz0 = Math.floor(fz);
  const ix1 = Math.min(ix0 + 1, nx - 1);
  const iy1 = Math.min(iy0 + 1, ny - 1);
  const iz1 = Math.min(iz0 + 1, nz - 1);
  const tx  = fx - ix0, ty = fy - iy0, tz = fz - iz0;

  const d = grid.data;
  const stride = nx;
  const slab   = nx * ny;
  const idx = (ix: number, iy: number, iz: number) => iz * slab + iy * stride + ix;

  // Eight surrounding cell values.
  const c000 = d[idx(ix0, iy0, iz0)];
  const c100 = d[idx(ix1, iy0, iz0)];
  const c010 = d[idx(ix0, iy1, iz0)];
  const c110 = d[idx(ix1, iy1, iz0)];
  const c001 = d[idx(ix0, iy0, iz1)];
  const c101 = d[idx(ix1, iy0, iz1)];
  const c011 = d[idx(ix0, iy1, iz1)];
  const c111 = d[idx(ix1, iy1, iz1)];

  // Trilinear interpolation: lerp along x, then y, then z.
  const c00 = c000 * (1 - tx) + c100 * tx;
  const c01 = c001 * (1 - tx) + c101 * tx;
  const c10 = c010 * (1 - tx) + c110 * tx;
  const c11 = c011 * (1 - tx) + c111 * tx;
  const c0  = c00  * (1 - ty) + c10  * ty;
  const c1  = c01  * (1 - ty) + c11  * ty;
  return c0 * (1 - tz) + c1 * tz;
}


/**
 * Compute the data-driven min / max of a {@link VoxelGrid}. Useful
 * for setting `valueRange` after loading a field where the range
 * isn't known a priori (sensor field, CFD output without metadata).
 */
export function voxelGridDataRange(grid: VoxelGrid): [number, number] {
  let lo = Infinity, hi = -Infinity;
  const d = grid.data;
  for (let i = 0; i < d.length; i++) {
    const v = d[i];
    if (!Number.isFinite(v)) continue;
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  if (!Number.isFinite(lo)) lo = 0;
  if (!Number.isFinite(hi)) hi = 0;
  return [lo, hi];
}
