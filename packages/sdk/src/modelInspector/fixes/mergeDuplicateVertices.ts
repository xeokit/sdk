import type {SceneModel} from "../../scene";
import {SDKErrorType, type SDKResult} from "../../core";
import type {Fix, FixApplyResult} from "../Fix";
import {getInspectionIndex} from "../getInspectionIndex";
import type {Issue} from "../Issue";


/**
 * Auto-fix for `GEOMETRY_DUPLICATE_VERTICES` — coalesces vertex
 * slots that are byte-identical across every populated attribute
 * (positions, normals, UVs) and remaps `indices` / `edgeIndices`
 * to point at the canonical slot.
 *
 * Vertex splitting for genuine seams / crease edges produces
 * *different* normals or UVs on the same position, so those slots
 * fingerprint differently and stay separate. Only truly redundant
 * slots — same position, same normal, same UV — coalesce.
 *
 * Compacted arrays are sized to the canonical-slot count, so this
 * fix also implicitly subsumes {@link compactUnusedVertices}
 * for any vertices that became unused as a side-effect.
 *
 * Idempotent: returns `{fixed: false}` when every vertex slot is
 * already unique under the (positions + normals + UVs) key.
 */
export const mergeDuplicateVertices: Fix = {

  codes: ["GEOMETRY_DUPLICATE_VERTICES"],

  description: "Coalesce duplicate vertices",

  procedure: [
    "Hash each vertex's attribute bytes for fast comparison",
    "Map each duplicate slot onto its first matching slot",
    "Copy each unique vertex's position, normal, and UV into smaller arrays",
    "Re-route the triangle and edge lists through the dedup map",
  ],

  apply(issue: Issue, sceneModel: SceneModel): SDKResult<FixApplyResult> {
    const geomId = issue.resourceId;
    if (!geomId) {
      return {
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: `[mergeDuplicateVertices] issue has no resourceId (geometry id)`,
      };
    }
    const geom = sceneModel.geometries[geomId];
    if (!geom || geom.destroyed) {
      return {ok: true, value: {fixed: false, reason: "target-missing"}};
    }
    const oldPositions = geom.positionsCompressed;
    if (!oldPositions) return {ok: true, value: {fixed: false, reason: "malformed-issue"}};

    const vertCount = (oldPositions.length / 3) | 0;
    if (vertCount === 0) return {ok: true, value: {fixed: false, reason: "no-op"}};

    const oldNormals = geom.normalsCompressed;
    const oldUVs     = geom.uvsCompressed;

    // Canonical-slot map from the shared inspection index — built
    // once per SceneModel and reused across the geometryQuality
    // inspection that flagged this issue.
    const slots = getInspectionIndex(sceneModel).canonicalSlots(geomId);
    if (!slots) return {ok: true, value: {fixed: false, reason: "precondition-failed"}};
    const {canonical, uniqueCount: unique} = slots;
    if (unique === vertCount) return {ok: true, value: {fixed: false, reason: "no-op"}};

    // Old canonical slot → new slot in the compacted array. Two
    // passes: first assign new ids in original-order, then remap.
    const newSlot = new Int32Array(vertCount).fill(-1);
    const newPositions = new Uint16Array(unique * 3);
    const newNormals = oldNormals ? new Uint16Array(unique * 2) : undefined;
    const newUVs = oldUVs ? new Uint16Array(unique * 2) : undefined;
    let w = 0;
    for (let v = 0; v < vertCount; v++) {
      if (canonical[v] !== v) continue;     // not canonical
      newSlot[v] = w;
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
      w++;
    }
    // Resolve every old slot through canonical → newSlot.
    const remap = new Int32Array(vertCount);
    for (let v = 0; v < vertCount; v++) remap[v] = newSlot[canonical[v]];

    (geom as { positionsCompressed: typeof newPositions }).positionsCompressed = newPositions;
    if (newNormals) (geom as { normalsCompressed: typeof newNormals }).normalsCompressed = newNormals;
    if (newUVs)     (geom as { uvsCompressed: typeof newUVs }).uvsCompressed = newUVs;

    const indices = geom.indices;
    if (indices) {
      const out = new Uint32Array(indices.length);
      for (let i = 0; i < indices.length; i++) out[i] = remap[indices[i]];
      (geom as { indices: typeof out }).indices = out;
    }
    const edgeIndices = geom.edgeIndices;
    if (edgeIndices) {
      const out = new Uint32Array(edgeIndices.length);
      for (let i = 0; i < edgeIndices.length; i++) out[i] = remap[edgeIndices[i]];
      (geom as { edgeIndices: typeof out }).edgeIndices = out;
    }

    const merged = vertCount - unique;
    return {ok: true, value: {fixed: true, trace: `'${geomId}': merged ${merged.toLocaleString()} duplicate of ${vertCount.toLocaleString()} vertex slots`}};
  },
};
