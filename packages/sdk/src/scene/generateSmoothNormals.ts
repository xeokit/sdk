import type {FloatArrayParam, IntArrayParam} from "../math";
import {octEncodeNormalsToU16} from "../math/compression";

/**
 * Synthesises per-vertex octahedral-encoded smooth normals from
 * uncompressed positions and triangle indices.
 *
 * Used by {@link compressGeometryParams} to auto-fill `normalsCompressed`
 * on triangle-based geometry that arrives without normals (typical of
 * IFC, dotBIM, and procedural meshes), so downstream code never needs
 * to mutate a constructed `SceneGeometry` to "add normals later".
 *
 * Returns `null` when:
 *   - the index array length isn't a multiple of 3 (malformed),
 *   - there are no vertices or triangles, or
 *   - every face normal collapses (fully degenerate geometry).
 *
 * The returned `Uint16Array` is `2 × vertexCount` long and slots
 * straight into the `SceneGeometryCompressedParams.normalsCompressed`
 * slot.
 *
 * @param positions  Uncompressed positions, length `3 × vertexCount`.
 * @param indices    Triangle indices, length `3 × triangleCount`.
 *
 * @internal
 */
export function generateSmoothNormals(
  positions: FloatArrayParam,
  indices:   IntArrayParam,
): Uint16Array<any> | null {

  const vertCount = (positions.length / 3) | 0;
  const triCount  = (indices.length   / 3) | 0;
  if (vertCount === 0 || triCount === 0 || indices.length % 3 !== 0) {
    return null;
  }

  // Per-vertex normal accumulator (Float32). Each face's normal is
  // weighted by 2 × triangle area (the un-normalised cross product),
  // which is the standard area-weighted-smooth-normals scheme — large
  // triangles dominate small slivers in shared-vertex averages.
  const acc = new Float32Array(vertCount * 3);
  for (let t = 0; t < triCount; t++) {
    const i0 = indices[t * 3];
    const i1 = indices[t * 3 + 1];
    const i2 = indices[t * 3 + 2];

    const ax  = positions[i0 * 3];
    const ay  = positions[i0 * 3 + 1];
    const az  = positions[i0 * 3 + 2];
    const ex1 = positions[i1 * 3]     - ax;
    const ey1 = positions[i1 * 3 + 1] - ay;
    const ez1 = positions[i1 * 3 + 2] - az;
    const ex2 = positions[i2 * 3]     - ax;
    const ey2 = positions[i2 * 3 + 1] - ay;
    const ez2 = positions[i2 * 3 + 2] - az;
    const nx  = ey1 * ez2 - ez1 * ey2;
    const ny  = ez1 * ex2 - ex1 * ez2;
    const nz  = ex1 * ey2 - ey1 * ex2;

    acc[i0 * 3] += nx;  acc[i0 * 3 + 1] += ny;  acc[i0 * 3 + 2] += nz;
    acc[i1 * 3] += nx;  acc[i1 * 3 + 1] += ny;  acc[i1 * 3 + 2] += nz;
    acc[i2 * 3] += nx;  acc[i2 * 3 + 1] += ny;  acc[i2 * 3 + 2] += nz;
  }

  // Normalise to unit length. `octEncodeNormalsToU16` also re-normalises
  // internally; doing it here lets us cheaply detect a fully degenerate
  // geometry (all-zero accumulators) and bail to flat shading.
  let anyNonZero = false;
  for (let i = 0; i < vertCount; i++) {
    const x = acc[i * 3], y = acc[i * 3 + 1], z = acc[i * 3 + 2];
    const lenSq = x * x + y * y + z * z;
    if (lenSq > 0) {
      anyNonZero = true;
      const inv = 1.0 / Math.sqrt(lenSq);
      acc[i * 3]     = x * inv;
      acc[i * 3 + 1] = y * inv;
      acc[i * 3 + 2] = z * inv;
    } else {
      // Isolated vertex — point along +Y as a safe default.
      acc[i * 3]     = 0;
      acc[i * 3 + 1] = 1;
      acc[i * 3 + 2] = 0;
    }
  }
  if (!anyNonZero) {
    return null;
  }

  return octEncodeNormalsToU16(acc);
}
