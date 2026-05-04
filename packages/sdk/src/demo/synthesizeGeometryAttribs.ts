import type {SceneGeometry} from "../scene";
import type {AABB3} from "../math/boundaries";
import type {IntArrayParam} from "../math";
import {octEncodeNormalsToU16} from "../math/compression";
import {SolidPrimitive, SurfacePrimitive, TrianglesPrimitive} from "../constants";


/**
 * Demo-grade synthesisers for the per-vertex attributes a procedural
 * PBR pipeline needs but that geometry-as-loaded usually lacks —
 * planar UVs (for texture sampling) and area-weighted smooth
 * octahedral normals (for shading).
 *
 * Used by {@link applyIFCMaterials} and
 * {@link demo.materials.MaterialsPalette} to bring IFC / dotBIM-loaded
 * meshes up to the standard a textured PBR painter expects. Geometry
 * fields are declared `readonly` for compile-time safety; readonly
 * is TypeScript-only at runtime so the documented mutation path is
 * a typed cast (`(geom as { uvsCompressed: ... }).uvsCompressed = …`).
 *
 * @module demo/synthesizeGeometryAttribs
 */


/**
 * Generates per-vertex octahedral-encoded smooth normals by computing
 * face normals from the geometry's triangle indices, accumulating
 * them per shared vertex, normalising, and encoding via the SDK's
 * standard `octEncodeNormalsToU16`. Returns `null` when the index
 * count isn't a multiple of 3 (malformed) or all face normals
 * collapse (degenerate geometry).
 *
 * The returned `Uint16Array` is `2 × vertexCount` long and slots
 * straight into `SceneGeometry.normalsCompressed`.
 */
export function generateSmoothNormals(
  positionsCompressed: IntArrayParam,
  indices:             IntArrayParam,
  aabb:                AABB3,
): Uint16Array<any> | null {

  const vertCount = (positionsCompressed.length / 3) | 0;
  const triCount  = (indices.length / 3) | 0;
  if (vertCount === 0 || triCount === 0 || indices.length % 3 !== 0) {
    return null;
  }

  // Decompress positions into a Float32 scratch buffer so cross
  // products operate on world-scale magnitudes.
  const minX = aabb[0], minY = aabb[1], minZ = aabb[2];
  const rngX = aabb[3] - minX, rngY = aabb[4] - minY, rngZ = aabb[5] - minZ;
  const positions = new Float32Array(vertCount * 3);
  for (let i = 0; i < vertCount; i++) {
    positions[i * 3]     = minX + rngX * (positionsCompressed[i * 3]     / 65535);
    positions[i * 3 + 1] = minY + rngY * (positionsCompressed[i * 3 + 1] / 65535);
    positions[i * 3 + 2] = minZ + rngZ * (positionsCompressed[i * 3 + 2] / 65535);
  }

  // Per-vertex normal accumulator (Float32). Each face's normal is
  // weighted by 2 × triangle area (the un-normalised cross product),
  // which is the standard area-weighted-smooth-normals scheme —
  // large triangles dominate small slivers in shared-vertex
  // averages.
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

  // Normalise to unit length. octEncodeNormalsToU16 also re-normalises
  // internally, but doing it here lets us cheaply detect a fully
  // degenerate geometry (all-zero accumulators).
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


/**
 * Generates planar UVs by projecting the decompressed positions onto
 * two of the three AABB axes. The third (dropped) axis is the one
 * that's least useful for the projection — typically the geometry's
 * "thickness" direction.
 *
 * Axis selection:
 *
 *   - **Wall-like** (the world-up axis has substantial extent —
 *     i.e. it's *not* the smallest-extent axis): aligns `V` with the
 *     world-up axis so direction-bearing painters render the same
 *     orientation on every wall regardless of which horizontal axis
 *     the wall is thin along. `U` is the larger of the two
 *     non-vertical axes; the smaller (typically the wall's
 *     thickness) is dropped.
 *   - **Flat-like** (world-up *is* the smallest-extent axis, e.g. a
 *     slab) or no `worldUp` supplied: drops the smallest extent and
 *     projects onto the remaining two in axis order.
 *
 * One UV unit corresponds to `uvScale` metres of geometry — smaller
 * `uvScale` values tile the painted texture more times across the
 * surface.
 */
export function generatePlanarUVs(
  positionsCompressed: IntArrayParam,
  aabb:                AABB3,
  uvScale:             number,
  worldUp?:            ArrayLike<number>,
): Float32Array<any> {

  const exts = [aabb[3] - aabb[0], aabb[4] - aabb[1], aabb[5] - aabb[2]];

  let smallestAxis = 0;
  if (exts[1] < exts[smallestAxis]) smallestAxis = 1;
  if (exts[2] < exts[smallestAxis]) smallestAxis = 2;

  // Resolve the world-up axis index by picking the geometry-local
  // basis component most aligned with the supplied `worldUp` vector.
  let upAxis = -1;
  if (worldUp) {
    const ax = Math.abs(worldUp[0]);
    const ay = Math.abs(worldUp[1]);
    const az = Math.abs(worldUp[2]);
    if      (ax >= ay && ax >= az) upAxis = 0;
    else if (ay >= az)             upAxis = 1;
    else                           upAxis = 2;
  }

  let axisU: number, axisV: number;
  if (upAxis >= 0 && upAxis !== smallestAxis) {
    // Wall-like: align V with vertical so plank/grain textures
    // render the same orientation on every wall. U is the larger of
    // the two horizontal axes.
    axisV = upAxis;
    const other0 = (upAxis + 1) % 3;
    const other1 = (upAxis + 2) % 3;
    axisU = exts[other0] >= exts[other1] ? other0 : other1;
  } else {
    // Flat-like or no world-up info: drop the smallest extent, use
    // the other two in axis order.
    axisU = (smallestAxis + 1) % 3;
    axisV = (smallestAxis + 2) % 3;
  }

  const minU     = aabb[axisU];
  const minV     = aabb[axisV];
  const rangeU   = exts[axisU];
  const rangeV   = exts[axisV];
  const invScale = 1.0 / (uvScale || 1.0);

  const vertCount = positionsCompressed.length / 3;
  const uvs       = new Float32Array(vertCount * 2);

  for (let i = 0; i < vertCount; i++) {
    const cu = positionsCompressed[i * 3 + axisU];
    const cv = positionsCompressed[i * 3 + axisV];
    const wu = minU + rangeU * (cu / 65535);
    const wv = minV + rangeV * (cv / 65535);
    uvs[i * 2]     = wu * invScale;
    uvs[i * 2 + 1] = wv * invScale;
  }

  return uvs;
}


/**
 * Brings a `SceneGeometry` up to the attribute set a procedural PBR
 * painter expects, mutating `geom.uvsCompressed` and
 * `geom.normalsCompressed` in place when missing.
 *
 *   - **UVs** — synthesised via {@link generatePlanarUVs} when the
 *     geometry has none.
 *   - **Normals** — synthesised via {@link generateSmoothNormals}
 *     when the geometry has none AND its primitive is triangle-based
 *     (`Triangles`, `Solid`, or `Surface`) AND it carries indices.
 *     Lines and points keep their lack of normals — there's no
 *     defensible per-vertex normal for them.
 *
 * No-ops when the geometry is missing positions or AABB, or when
 * both attributes are already populated. Returns `true` when at
 * least one attribute was synthesised.
 *
 * @param geom The SceneGeometry to inspect / mutate.
 * @param options.uvScale Metres of geometry per UV unit. Default `1`.
 * @param options.worldUp World-up vector used to align V on
 *   wall-like geometries. Defaults to `[0, 0, 1]`.
 */
export function ensureGeometryAttribs(
  geom: SceneGeometry,
  options: { uvScale?: number; worldUp?: ArrayLike<number> } = {},
): boolean {
  if (!geom.aabb || !geom.positionsCompressed) {
    return false;
  }
  const uvScale = options.uvScale ?? 1.0;
  const worldUp = options.worldUp ?? [0, 0, 1];

  let mutated = false;

  if (!geom.uvsCompressed || (geom.uvsCompressed as ArrayLike<number>).length === 0) {
    const uvs = generatePlanarUVs(geom.positionsCompressed, geom.aabb, uvScale, worldUp);
    (geom as { uvsCompressed: typeof uvs }).uvsCompressed = uvs;
    mutated = true;
  }

  const isTriangleMesh =
    geom.primitive === TrianglesPrimitive ||
    geom.primitive === SolidPrimitive ||
    geom.primitive === SurfacePrimitive;
  const hasNormals = geom.normalsCompressed && (geom.normalsCompressed as ArrayLike<number>).length > 0;

  if (isTriangleMesh && !hasNormals && geom.indices) {
    const normals = generateSmoothNormals(geom.positionsCompressed, geom.indices, geom.aabb);
    if (normals) {
      (geom as { normalsCompressed: typeof normals }).normalsCompressed = normals;
      mutated = true;
    }
  }

  return mutated;
}
