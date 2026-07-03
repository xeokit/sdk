import type {SceneGeometry} from "../../../model/scene";
import {SDKErrorType, type SDKResult} from "../../../base/core";
import {isTriangleMesh} from "../inspections/util";


/**
 * Internal helper for the SceneModel-inspect fixes pipeline that
 * splits an existing {@link model!scene.SceneGeometry | SceneGeometry}
 * into two new SceneGeometries by partitioning its triangles. The
 * partition is whole-triangle — no plane clipping, no edge cutting,
 * no geometry generated — so each source triangle ends up in exactly
 * one of the two outputs.
 *
 * Per side: the function walks the kept triangles, collects the
 * vertex indices they reference, compacts the vertex data
 * (positions / normals / UVs / colors) to that subset, remaps
 * indices, and lets {@link SceneModel.createGeometry} re-quantise
 * positions and re-encode normals against a fresh tight AABB.
 *
 * The source geometry is left in place — the caller decides whether
 * to destroy it after linking meshes against the two new
 * geometries.
 *
 * @module inspect/sceneModel/internal/splitSceneGeometry
 */


/** Parameters for {@link splitSceneGeometry}. */
export interface SplitSceneGeometryParams {

  /**
   * Source SceneGeometry to split. Must be a triangle-indexed
   * geometry (`indices.length` divisible by 3) that lives in a
   * SceneModel — read via `sceneGeometry.model`.
   */
  sceneGeometry: SceneGeometry;

  /** Id for the first output SceneGeometry. */
  geometryIdA: string;

  /** Id for the second output SceneGeometry. */
  geometryIdB: string;

  /**
   * Triangle predicate. `triIndex` is the source-triangle index
   * (`0 ≤ triIndex < indices.length / 3`). Return `true` to route
   * the triangle to side A; `false` to route to side B.
   *
   * Default: split at the midpoint — first half of triangles → A,
   * second half → B.
   */
  predicate?: (triIndex: number) => boolean;
}


/** Result of {@link splitSceneGeometry}. */
export interface SplitSceneGeometryResult {

  /** First output SceneGeometry — receives triangles where the
   * predicate returned `true`. */
  geometryA: SceneGeometry;

  /** Second output SceneGeometry — receives triangles where the
   * predicate returned `false`. */
  geometryB: SceneGeometry;
}


/**
 * Split a SceneGeometry's triangles into two new SceneGeometries by
 * a per-triangle predicate.
 *
 * Both outputs share the same `primitive` as the source. UVs and
 * normals and colors follow if the source carries them — UVs and
 * colors are sliced to the compacted vertex set as-is; normals are
 * oct-decoded, sliced, and passed back as floats so the SDK
 * re-encodes against the fresh geometry. Edge indices are not
 * propagated (they index the source's vertex range and have no
 * obvious mapping under a partition that may break edges; regenerate
 * edges on the outputs if needed).
 *
 * Errors (`ok: false`) when the source has no indices / positions /
 * AABB / SceneModel, or when the predicate routes all triangles to
 * one side (the empty side can't become a valid SceneGeometry).
 */
export function splitSceneGeometry(
  params: SplitSceneGeometryParams,
): SDKResult<SplitSceneGeometryResult> {
  const src = params.sceneGeometry;
  if (!src) {
    return errInvalid("[splitSceneGeometry] sceneGeometry is required");
  }
  if (!isTriangleMesh(src)) {
    return errInvalid(`[splitSceneGeometry] SceneGeometry '${src.id}' primitive ${src.primitive} is not triangle-indexed`);
  }
  const indices = src.indices;
  if (!indices || indices.length === 0 || indices.length % 3 !== 0) {
    return errInvalid(`[splitSceneGeometry] SceneGeometry '${src.id}' has no triangle indices to split`);
  }
  const positionsCompressed = src.positionsCompressed;
  const aabb = src.aabb;
  if (!positionsCompressed || !aabb) {
    return errInvalid(`[splitSceneGeometry] SceneGeometry '${src.id}' has no positions / AABB`);
  }
  const sceneModel = src.model;
  if (!sceneModel) {
    return errInvalid(`[splitSceneGeometry] SceneGeometry '${src.id}' has no SceneModel`);
  }

  const triCount = (indices.length / 3) | 0;
  const halfCount = (triCount / 2) | 0;
  const predicate = params.predicate ?? ((t: number) => t < halfCount);

  // Whole-triangle partition.
  const trisA: number[] = [];
  const trisB: number[] = [];
  for (let t = 0; t < triCount; t++) {
    (predicate(t) ? trisA : trisB).push(t);
  }
  if (trisA.length === 0 || trisB.length === 0) {
    return errInvalid(
      `[splitSceneGeometry] Predicate routed every triangle to one side (A=${trisA.length}, B=${trisB.length}); ` +
      `both outputs must end up with at least one triangle`,
    );
  }

  // Decompress vertex attributes once; both outputs index into the
  // same float pool. Normals are oct-encoded Uint16 (the SDK's
  // `octEncodeNormalsToU16` format used by SceneGeometry's
  // `normalsCompressed`); decode to flat float vec3s.
  const positions = decompressPositions(positionsCompressed, aabb);
  const normals = src.normalsCompressed ? octDecodeU16(src.normalsCompressed) : null;
  const uvs = src.uvsCompressed ?? null;
  const colors = src.colorsCompressed ?? null;

  const aRes = buildSide(sceneModel, src.primitive, params.geometryIdA, trisA, indices, positions, normals, uvs, colors);
  if (aRes.ok === false) {
    return aRes;
  }
  const bRes = buildSide(sceneModel, src.primitive, params.geometryIdB, trisB, indices, positions, normals, uvs, colors);
  if (bRes.ok === false) {
    return bRes;
  }

  return {
    ok: true,
    value: {
      geometryA: aRes.value,
      geometryB: bRes.value,
    },
  };
}


/**
 * Build one side of the split — collect the vertex indices the
 * given triangle list references, compact the vertex attribute
 * arrays to that subset, remap indices, and call
 * {@link SceneModel.createGeometry}.
 */
function buildSide(
  sceneModel: SceneGeometry["model"],
  primitive: number,
  newId: string,
  tris: number[],
  indices: ArrayLike<number>,
  positions: Float32Array,
  normals: Float32Array | null,
  uvs: ArrayLike<number> | null,
  colors: ArrayLike<number> | null,
): SDKResult<SceneGeometry> {
  const remap = new Map<number, number>();
  const newPositions: number[] = [];
  const newNormals: number[] | null = normals ? [] : null;
  const newUvs: number[] | null = uvs ? [] : null;
  const newColors: number[] | null = colors ? [] : null;
  const newIndices: number[] = [];

  for (const t of tris) {
    for (let k = 0; k < 3; k++) {
      const oldIdx = indices[t * 3 + k];
      let newIdx = remap.get(oldIdx);
      if (newIdx === undefined) {
        newIdx = (newPositions.length / 3) | 0;
        remap.set(oldIdx, newIdx);
        newPositions.push(
          positions[oldIdx * 3],
          positions[oldIdx * 3 + 1],
          positions[oldIdx * 3 + 2],
        );
        if (newNormals && normals) {
          newNormals.push(
            normals[oldIdx * 3],
            normals[oldIdx * 3 + 1],
            normals[oldIdx * 3 + 2],
          );
        }
        if (newUvs && uvs) {
          newUvs.push(
            uvs[oldIdx * 2],
            uvs[oldIdx * 2 + 1],
          );
        }
        if (newColors && colors) {
          newColors.push(
            colors[oldIdx * 4],
            colors[oldIdx * 4 + 1],
            colors[oldIdx * 4 + 2],
            colors[oldIdx * 4 + 3],
          );
        }
      }
      newIndices.push(newIdx);
    }
  }

  return sceneModel.createGeometry({
    id:        newId,
    primitive,
    positions: new Float32Array(newPositions),
    normals:   newNormals ? new Float32Array(newNormals) : undefined,
    uvs:       newUvs ? new Float32Array(newUvs) : undefined,
    colorsCompressed: newColors ? new Uint8Array(newColors) : undefined,
    indices:   newIndices,
  });
}


/**
 * Decompress a Uint16-quantised positions buffer back to floats
 * using the source AABB. Inlined rather than reusing the SDK's
 * `decompressPositions3WithAABB3` because we want a Float32Array
 * specifically (typed loops are tighter than the generic-array
 * variant).
 */
function decompressPositions(
  positionsCompressed: ArrayLike<number>,
  aabb: ArrayLike<number>,
): Float32Array {
  const minX = aabb[0], minY = aabb[1], minZ = aabb[2];
  const rngX = aabb[3] - minX, rngY = aabb[4] - minY, rngZ = aabb[5] - minZ;
  const v = (positionsCompressed.length / 3) | 0;
  const out = new Float32Array(v * 3);
  for (let i = 0; i < v; i++) {
    out[i * 3]     = minX + rngX * (positionsCompressed[i * 3]     / 65535);
    out[i * 3 + 1] = minY + rngY * (positionsCompressed[i * 3 + 1] / 65535);
    out[i * 3 + 2] = minZ + rngZ * (positionsCompressed[i * 3 + 2] / 65535);
  }
  return out;
}


/**
 * Inverse of `octEncodeNormalsToU16` — reads the Uint16 oct-encoded
 * pairs the SDK stores in {@link SceneGeometry.normalsCompressed}
 * and produces a flat `Float32Array` of unit vec3 normals.
 *
 * The SDK's public `decompressNormals` decodes the *Int8* oct format
 * (different range), so this can't reuse it.
 */
function octDecodeU16(enc: ArrayLike<number>): Float32Array {
  const v = (enc.length / 2) | 0;
  const out = new Float32Array(v * 3);
  for (let i = 0; i < v; i++) {
    const fx = (enc[i * 2]     / 32767.5) - 1;
    const fy = (enc[i * 2 + 1] / 32767.5) - 1;
    let nx = fx;
    let ny = fy;
    let nz = 1 - Math.abs(fx) - Math.abs(fy);
    if (nz < 0) {
      const tx = nx;
      nx = (1 - Math.abs(ny)) * (tx >= 0 ? 1 : -1);
      ny = (1 - Math.abs(tx)) * (ny >= 0 ? 1 : -1);
    }
    const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
    const inv = len > 0 ? 1 / len : 1;
    out[i * 3]     = nx * inv;
    out[i * 3 + 1] = ny * inv;
    out[i * 3 + 2] = nz * inv;
  }
  return out;
}


function errInvalid<T>(message: string): SDKResult<T> {
  return {ok: false, type: SDKErrorType.InvalidOperation, error: message};
}
