/**
 * Three-dimensional vector field on a regular grid — the data
 * carrier for streamline visualisations of airflow, fluid flow,
 * wind, or any other velocity-typed field.
 *
 * Layout mirrors {@link VoxelGrid} but with three components per
 * cell instead of one. Cell `(ix, iy, iz)`'s vector lives at
 * `data[(iz * nx * ny + iy * nx + ix) * 3 + 0..2]` = `[vx, vy, vz]`.
 *
 * @module presentations/volumeOverlay
 */

export interface VectorGrid {

  /** Vector samples, row-major over `(x, y, z)`, three floats per
   *  cell `[vx, vy, vz]`. Length = nx · ny · nz · 3. */
  data: Float32Array;

  /** Cell counts along the (x, y, z) axes. */
  resolution: [number, number, number];

  /** World-space minimum corner of the volume bounding box. */
  min: [number, number, number];

  /** World-space maximum corner of the volume bounding box. */
  max: [number, number, number];

  /** Display unit for the magnitude. Examples: `"m/s"`, `"Pa·s⁻¹"`. */
  unit?: string;

  /**
   * Min / max magnitude for colour-mapping. Falls back to a
   * data-driven scan when unset. Lock this for visual comparison
   * across multiple runs.
   */
  magnitudeRange?: [number, number];

  /** Human-readable name. Used by the panel header. */
  name?: string;
}


/**
 * Sample a {@link VectorGrid} at an arbitrary world-space point.
 * Trilinear interpolation per component. Writes into `out` and
 * returns `true` when the sample is inside the grid; returns
 * `false` (leaves `out` zeroed) when outside.
 *
 * `out` should be a length-3 array — caller-allocated so the
 * inner integration loop can reuse it without GC pressure.
 */
export function sampleVectorGrid(
  grid: VectorGrid,
  x: number, y: number, z: number,
  out: [number, number, number] | Float32Array,
): boolean {

  const [nx, ny, nz] = grid.resolution;
  const [minX, minY, minZ] = grid.min;
  const [maxX, maxY, maxZ] = grid.max;

  const fx = ((x - minX) / (maxX - minX)) * (nx - 1);
  const fy = ((y - minY) / (maxY - minY)) * (ny - 1);
  const fz = ((z - minZ) / (maxZ - minZ)) * (nz - 1);

  if (fx < 0 || fy < 0 || fz < 0 || fx > nx - 1 || fy > ny - 1 || fz > nz - 1) {
    out[0] = 0; out[1] = 0; out[2] = 0;
    return false;
  }

  const ix0 = Math.floor(fx), iy0 = Math.floor(fy), iz0 = Math.floor(fz);
  const ix1 = Math.min(ix0 + 1, nx - 1);
  const iy1 = Math.min(iy0 + 1, ny - 1);
  const iz1 = Math.min(iz0 + 1, nz - 1);
  const tx = fx - ix0, ty = fy - iy0, tz = fz - iz0;

  const d = grid.data;
  const stride = nx;
  const slab   = nx * ny;
  const off = (ix: number, iy: number, iz: number) => (iz * slab + iy * stride + ix) * 3;

  // Trilinear interp per component. Inline-expanded for the inner
  // loop because this gets called once per RK4 sub-step on every
  // streamline.
  for (let c = 0; c < 3; c++) {
    const v000 = d[off(ix0, iy0, iz0) + c];
    const v100 = d[off(ix1, iy0, iz0) + c];
    const v010 = d[off(ix0, iy1, iz0) + c];
    const v110 = d[off(ix1, iy1, iz0) + c];
    const v001 = d[off(ix0, iy0, iz1) + c];
    const v101 = d[off(ix1, iy0, iz1) + c];
    const v011 = d[off(ix0, iy1, iz1) + c];
    const v111 = d[off(ix1, iy1, iz1) + c];
    const v00 = v000 * (1 - tx) + v100 * tx;
    const v01 = v001 * (1 - tx) + v101 * tx;
    const v10 = v010 * (1 - tx) + v110 * tx;
    const v11 = v011 * (1 - tx) + v111 * tx;
    const v0 = v00 * (1 - ty) + v10 * ty;
    const v1 = v01 * (1 - ty) + v11 * ty;
    out[c] = v0 * (1 - tz) + v1 * tz;
  }
  return true;
}


/**
 * Compute the data-driven magnitude range of a vector field.
 * Used when {@link VectorGrid.magnitudeRange} isn't supplied.
 */
export function vectorGridMagnitudeRange(grid: VectorGrid): [number, number] {
  let lo = Infinity, hi = -Infinity;
  const d = grid.data;
  for (let i = 0; i < d.length; i += 3) {
    const m = Math.hypot(d[i], d[i + 1], d[i + 2]);
    if (m < lo) lo = m;
    if (m > hi) hi = m;
  }
  if (!Number.isFinite(lo)) lo = 0;
  if (!Number.isFinite(hi)) hi = 0;
  return [lo, hi];
}
