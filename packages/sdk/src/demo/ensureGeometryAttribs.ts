import type {SceneModel} from "../scene";
import {generateSmoothNormals} from "../scene/generateSmoothNormals";
import {decompressPositions3WithAABB3, packUVsToFloat32} from "../math/compression";
import {SDKErrorType, type SDKResult} from "../core";
import {SolidPrimitive, SurfacePrimitive, TrianglesPrimitive} from "../constants";
import type {FloatArrayParam} from "../math";


/**
 * Returns the id of a {@link SceneGeometry} that satisfies the
 * caller's attribute requirements:
 *
 *   - **Smooth normals**: synthesised when the source has none and
 *     the primitive is triangle-based (`Triangles` / `Solid` /
 *     `Surface`) with indices.
 *   - **UVs**: copied verbatim from `options.uvs` when supplied,
 *     overriding any UVs the source already had. Use this for
 *     painters that compute their own per-vertex UVs (e.g. heat-map
 *     overlays); pass `undefined` when the source's UVs (or lack of
 *     them) are fine.
 *
 * When the source already meets every requirement, returns the
 * source id unchanged — no work, no allocation. Otherwise creates a
 * sibling SceneGeometry via {@link SceneModel.createGeometryCompressed}
 * and returns its id. The new geometry shares the source's
 * `positionsCompressed`, `indices`, `edgeIndices`, `aabb`, and
 * `origin` — only `normalsCompressed` and/or `uvsCompressed` are
 * fresh, so there's no decompress/recompress round-trip on the
 * heavy buffers.
 *
 * Idempotent: a second call with the same `cloneIdSuffix` finds the
 * already-created sibling and returns its id rather than building a
 * second copy.
 *
 * Use case: callers that re-style {@link "../scene".SceneObject |
 * SceneObjects} at runtime (`applyIFCMaterials`, `applyHeatMapMaterials`)
 * destroy + recreate the meshes with a new material; if the new
 * material needs attributes the source geometry lacks, this helper
 * gives them the id of a usable sibling without ever mutating the
 * original geometry.
 *
 * @param sceneModel  Model owning `sourceId`. The sibling, if any,
 *                    is created in the same model.
 * @param sourceId    Source SceneGeometry id.
 * @param options.uvs Optional fresh UV stream — `2 × vertexCount`
 *                    floats in any range (the shader applies
 *                    `fract` before sampling).
 * @param options.cloneIdSuffix Suffix appended to `sourceId` when a
 *                              sibling needs to be created. Default
 *                              `"__augmented"`. Stable so repeated
 *                              calls share the same sibling.
 *
 * @returns SDKResult holding the geometry id meshes should bind to.
 */
export function ensureGeometryAttribs(
  sceneModel: SceneModel,
  sourceId: string,
  options: { uvs?: FloatArrayParam; cloneIdSuffix?: string } = {},
): SDKResult<string> {

  const source = sceneModel.geometries[sourceId];
  if (!source) {
    return {
      ok: false,
      type: SDKErrorType.InvalidInput,
      error: `[ensureGeometryAttribs] No SceneGeometry '${sourceId}' in SceneModel`,
    };
  }

  const isTri =
    source.primitive === TrianglesPrimitive ||
    source.primitive === SolidPrimitive ||
    source.primitive === SurfacePrimitive;
  const sourceHasNormals = !!source.normalsCompressed
    && (source.normalsCompressed as ArrayLike<number>).length > 0;
  const wantUVs = options.uvs !== undefined;
  const wantNormals = isTri && !sourceHasNormals;

  // Source already covers everything the caller needs — nothing to do.
  if (!wantNormals && !wantUVs) {
    return {ok: true, value: sourceId};
  }

  const suffix = options.cloneIdSuffix ?? "__augmented";
  const newId = `${sourceId}${suffix}`;

  // Idempotent — one sibling per (source, suffix) pair, regardless of
  // call count.
  if (sceneModel.geometries[newId]) {
    return {ok: true, value: newId};
  }

  // Synthesise normals when requested. The function returns
  // octahedral-encoded `Uint16Array` ready to slot into
  // `normalsCompressed`. Returns `null` for fully-degenerate geometry,
  // in which case we leave the normals slot empty and the new sibling
  // will render with shader-derived flat face normals.
  let normalsCompressed = source.normalsCompressed;
  if (wantNormals && source.indices && source.positionsCompressed && source.aabb) {
    // Decompress positions just for the cross-product math; the new
    // geometry reuses the source's `positionsCompressed` directly, so
    // we don't recompress.
    const positions = new Float32Array(source.positionsCompressed.length);
    decompressPositions3WithAABB3(source.positionsCompressed, source.aabb, positions);
    const synth = generateSmoothNormals(positions, source.indices);
    if (synth) normalsCompressed = synth;
  }

  // Pack UVs when supplied. `packUVsToFloat32` is the same routine
  // `compressGeometryParams` uses, so the on-GPU layout matches.
  let uvsCompressed = source.uvsCompressed;
  if (wantUVs) {
    uvsCompressed = packUVsToFloat32(options.uvs!);
  }

  const result = sceneModel.createGeometryCompressed({
    id:                  newId,
    primitive:           source.primitive,
    aabb:                source.aabb,
    positionsCompressed: source.positionsCompressed!,
    indices:             source.indices ?? undefined,
    edgeIndices:         source.edgeIndices ?? undefined,
    normalsCompressed:   normalsCompressed ?? undefined,
    uvsCompressed:       uvsCompressed ?? undefined,
  });
  if (result.ok === false) return result;
  return {ok: true, value: newId};
}
