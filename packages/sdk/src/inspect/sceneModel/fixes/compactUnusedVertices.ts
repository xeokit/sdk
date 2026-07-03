import type {SceneModel} from "../../../model/scene";
import {SDKErrorType, type SDKResult} from "../../../base/core";
import type {Fix, FixApplyResult} from "../Fix";
import {getInspectionIndex} from "../internal/getInspectionIndex";
import type {Issue} from "../Issue";


/**
 * Auto-fix for `GEOMETRY_UNUSED_VERTICES` — compacts
 * `positionsCompressed` / `normalsCompressed` / `uvsCompressed` /
 * `colorsCompressed` to keep only vertex slots referenced by
 * `indices` or `edgeIndices`, and remaps both index arrays through
 * the old-to-new slot map.
 *
 * The geometry's AABB stays put — positions are still quantised
 * against it, and dropping unused outliers can only shrink the
 * actual content, never grow it. Recomputing a tighter AABB would
 * change quantisation and therefore every surviving position;
 * this fix takes the conservative path of leaving AABB alone.
 *
 * Idempotent: returns `{fixed: false}` when every existing vertex
 * slot is already in use.
 */
export const compactUnusedVertices: Fix = {

  codes: ["GEOMETRY_UNUSED_VERTICES"],

  description: "Compact unused vertex slots",

  procedure: [
    "Mark each vertex slot referenced by any triangle or edge",
    "Build a map from old slot to new (compacted) slot",
    "Copy each used vertex's position, normal, and UV into smaller arrays",
    "Re-route the triangle and edge lists through the new slot map",
  ],

  config: {
    enabled: {
      kind: "boolean",
      key: "enableCompactUnusedVertices",
      label: "Compact unused vertex slots",
      default: true,
    },
  },

  apply(issue: Issue, sceneModel: SceneModel): SDKResult<FixApplyResult> {
    const geomId = issue.resourceId;
    if (!geomId) {
      return {
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: `[compactUnusedVertices] issue has no resourceId (geometry id)`,
      };
    }
    const geom = sceneModel.geometries[geomId];
    if (!geom || geom.destroyed) {
      return {ok: true, value: {fixed: false, reason: "target-missing"}};
    }
    if (!geom.positionsCompressed) {
      return {ok: true, value: {fixed: false, reason: "malformed-issue"}};
    }
    const vertCount = (geom.positionsCompressed.length / 3) | 0;
    if (vertCount === 0) return {ok: true, value: {fixed: false, reason: "no-op"}};

    const indices = geom.indices;
    const edgeIndices = geom.edgeIndices;
    // Vertex usage bitmap from the shared inspection index — same
    // walk geometryQuality.GEOMETRY_UNUSED_VERTICES did when
    // flagging this issue.
    const used = getInspectionIndex(sceneModel).vertexUsageMask(geomId);

    let kept = 0;
    for (let v = 0; v < vertCount; v++) if (used[v]) kept++;
    if (kept === vertCount) return {ok: true, value: {fixed: false, reason: "no-op"}};
    if (kept === 0)         return {ok: true, value: {fixed: false, reason: "precondition-failed"}};   // nothing references anything; leave it for triage

    // Build the old→new remap and the compacted attribute arrays. Each
    // compacted array keeps its source attribute's element type: positions /
    // normals are quantised uint16, but UVs are float (RG32F) — allocating
    // them as uint16 would truncate tiling UVs and scramble texture mapping.
    const remap = new Int32Array(vertCount).fill(-1);
    const oldPositions = geom.positionsCompressed;
    const oldNormals = geom.normalsCompressed;
    const oldUVs = geom.uvsCompressed;
    const oldColors = geom.colorsCompressed;
    const sameType = (src: {constructor: any}, length: number): any =>
      new src.constructor(length);
    const newPositions = sameType(oldPositions, kept * 3);
    const newNormals = oldNormals ? sameType(oldNormals, kept * 2) : undefined;
    const newUVs = oldUVs ? sameType(oldUVs, kept * 2) : undefined;
    const newColors = oldColors ? sameType(oldColors, kept * 4) : undefined;
    let w = 0;
    for (let v = 0; v < vertCount; v++) {
      if (!used[v]) continue;
      remap[v] = w;
      newPositions[w * 3]     = oldPositions[v * 3];
      newPositions[w * 3 + 1] = oldPositions[v * 3 + 1];
      newPositions[w * 3 + 2] = oldPositions[v * 3 + 2];
      if (newNormals && oldNormals) {
        newNormals[w * 2]     = oldNormals[v * 2];
        newNormals[w * 2 + 1] = oldNormals[v * 2 + 1];
      }
      if (newUVs && oldUVs) {
        newUVs[w * 2]     = oldUVs[v * 2];
        newUVs[w * 2 + 1] = oldUVs[v * 2 + 1];
      }
      if (newColors && oldColors) {
        newColors[w * 4]     = oldColors[v * 4];
        newColors[w * 4 + 1] = oldColors[v * 4 + 1];
        newColors[w * 4 + 2] = oldColors[v * 4 + 2];
        newColors[w * 4 + 3] = oldColors[v * 4 + 3];
      }
      w++;
    }

    (geom as { positionsCompressed: typeof newPositions }).positionsCompressed = newPositions;
    if (newNormals) (geom as { normalsCompressed: typeof newNormals }).normalsCompressed = newNormals;
    if (newUVs)     (geom as { uvsCompressed: typeof newUVs }).uvsCompressed = newUVs;
    if (newColors)  (geom as { colorsCompressed: typeof newColors }).colorsCompressed = newColors;

    if (indices) {
      const out = new Uint32Array(indices.length);
      for (let i = 0; i < indices.length; i++) out[i] = remap[indices[i]];
      (geom as { indices: typeof out }).indices = out;
    }
    if (edgeIndices) {
      const out = new Uint32Array(edgeIndices.length);
      for (let i = 0; i < edgeIndices.length; i++) out[i] = remap[edgeIndices[i]];
      (geom as { edgeIndices: typeof out }).edgeIndices = out;
    }

    const dropped = vertCount - kept;
    return {ok: true, value: {fixed: true, trace: `'${geomId}': compacted ${dropped.toLocaleString()} unused of ${vertCount.toLocaleString()} vertex slots`}};
  },
};
