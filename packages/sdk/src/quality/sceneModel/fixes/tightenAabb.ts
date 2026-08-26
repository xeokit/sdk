import type {SceneModel} from "../../../model/scene";
import {SDKErrorType, type SDKResult} from "../../../base/core";
import type {Fix, FixApplyResult} from "../Fix";
import {finishGeometryMutation, snapshotGeometryMutation} from "../internal/finishGeometryMutation";
import type {Issue} from "../Issue";


/**
 * Auto-fix for `GEOMETRY_AABB_NOT_TIGHT` — re-quantises
 * `positionsCompressed` into a tight AABB so every u16 step
 * resolves a smaller world-space increment. World positions are
 * preserved up to a tiny rounding error introduced by the
 * re-quantisation.
 *
 * Algebra:
 *
 *   - Old encoding: `w = oldMin + oldRange · u_old / 65535`.
 *   - True world bounds: walk `positionsCompressed`, find u16
 *     `[minU, maxU]` per axis, then
 *     `tightMin = oldMin + oldRange · minU / 65535`,
 *     `tightMax = oldMin + oldRange · maxU / 65535`.
 *   - New encoding: `w = tightMin + tightRange · u_new / 65535`.
 *     Substituting and solving:
 *     `u_new = (u_old - minU) · 65535 / (maxU - minU)`.
 *     The arithmetic stays in u16 space — no float decompression
 *     needed.
 *
 * Quality gain scales with how loose the original AABB was. A
 * 1% fill becomes 100% — quantisation step shrinks 100×.
 *
 * Edge case: a collapsed axis (`minU === maxU`) means every
 * vertex sits at the same coordinate on that axis. The fix
 * encodes them all as `0` and the new AABB collapses too, which
 * is consistent and decodes losslessly.
 *
 * Idempotent: re-running on a tight geometry computes
 * `minU = 0`, `maxU = 65535`, scaling factor 1 → no-op. Returns
 * `{fixed: false}` when the geometry is already tight on every
 * axis.
 *
 * Mutates `geom.positionsCompressed` (Uint16Array) and
 * `geom.aabb` (Float32Array) via the typed-cast pattern shared
 * across the geometry-fix family.
 */
export const tightenAabb: Fix = {

  codes: ["GEOMETRY_AABB_NOT_TIGHT"],

  description: "Tighten AABB and re-quantize positions",

  procedure: [
    "Find the actual quantized range used per axis",
    "Shrink the bounding box to fit only that range",
    "Re-quantize each vertex into the tighter bounding box",
    "Replace the geometry's positions and bounding box with the tightened versions",
  ],

  config: {
    enabled: {
      kind: "boolean",
      key: "enableTightenAabb",
      label: "Tighten AABB and re-quantize positions",
      default: true,
    },
  },

  apply(issue: Issue, sceneModel: SceneModel): SDKResult<FixApplyResult> {
    const geomId = issue.resourceId;
    if (!geomId) {
      return {
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: `[tightenAabb] issue has no resourceId (geometry id)`,
      };
    }
    const geom = sceneModel.geometries[geomId];
    if (!geom || geom.destroyed) return {ok: true, value: {fixed: false, reason: "target-missing"}};
    const oldPositions = geom.positionsCompressed;
    const aabb = geom.aabb;
    if (!oldPositions || !aabb || aabb.length < 6) return {ok: true, value: {fixed: false, reason: "malformed-issue"}};

    const len = oldPositions.length;
    if (len === 0) return {ok: true, value: {fixed: false, reason: "no-op"}};

    let minU0 = 65535, minU1 = 65535, minU2 = 65535;
    let maxU0 = 0,     maxU1 = 0,     maxU2 = 0;
    for (let i = 0; i < len; i += 3) {
      const x = oldPositions[i];
      const y = oldPositions[i + 1];
      const z = oldPositions[i + 2];
      if (x < minU0) minU0 = x; if (x > maxU0) maxU0 = x;
      if (y < minU1) minU1 = y; if (y > maxU1) maxU1 = y;
      if (z < minU2) minU2 = z; if (z > maxU2) maxU2 = z;
    }

    const oldMinX = aabb[0], oldMinY = aabb[1], oldMinZ = aabb[2];
    const oldRangeX = aabb[3] - aabb[0];
    const oldRangeY = aabb[4] - aabb[1];
    const oldRangeZ = aabb[5] - aabb[2];

    // Already tight on every non-collapsed axis, and collapsed
    // AABB axes cannot fill any u16 range by definition.
    if (axisAlreadyTight(minU0, maxU0, oldRangeX) &&
        axisAlreadyTight(minU1, maxU1, oldRangeY) &&
        axisAlreadyTight(minU2, maxU2, oldRangeZ)) {
      return {ok: true, value: {fixed: false, reason: "no-op"}};
    }

    const newAABB = new Float32Array(6);
    newAABB[0] = oldMinX + oldRangeX * (minU0 / 65535);
    newAABB[1] = oldMinY + oldRangeY * (minU1 / 65535);
    newAABB[2] = oldMinZ + oldRangeZ * (minU2 / 65535);
    newAABB[3] = oldMinX + oldRangeX * (maxU0 / 65535);
    newAABB[4] = oldMinY + oldRangeY * (maxU1 / 65535);
    newAABB[5] = oldMinZ + oldRangeZ * (maxU2 / 65535);

    // Per-axis scale factor for the u16 re-encoding. A collapsed
    // axis (minU === maxU) gets scale 0 — every position encodes
    // to 0, the new AABB also collapses on that axis, and decode
    // is lossless: the only valid world value on that axis is the
    // collapsed coordinate.
    const rangeU0 = maxU0 - minU0;
    const rangeU1 = maxU1 - minU1;
    const rangeU2 = maxU2 - minU2;
    const scaleU0 = rangeU0 > 0 ? 65535 / rangeU0 : 0;
    const scaleU1 = rangeU1 > 0 ? 65535 / rangeU1 : 0;
    const scaleU2 = rangeU2 > 0 ? 65535 / rangeU2 : 0;

    const newPositions = new Uint16Array(len);
    for (let i = 0; i < len; i += 3) {
      newPositions[i]     = Math.round((oldPositions[i]     - minU0) * scaleU0);
      newPositions[i + 1] = Math.round((oldPositions[i + 1] - minU1) * scaleU1);
      newPositions[i + 2] = Math.round((oldPositions[i + 2] - minU2) * scaleU2);
    }

    const before = snapshotGeometryMutation(geom);
    (geom as { positionsCompressed: typeof newPositions }).positionsCompressed = newPositions;
    (geom as { aabb: typeof newAABB }).aabb = newAABB;
    finishGeometryMutation(geom, before);
    const fillX = (rangeU0 / 65535 * 100) | 0;
    const fillY = (rangeU1 / 65535 * 100) | 0;
    const fillZ = (rangeU2 / 65535 * 100) | 0;
    return {ok: true, value: {fixed: true, trace: `'${geomId}': AABB tightened (was ${fillX}% / ${fillY}% / ${fillZ}% used → 100%)`}};
  },
};


function axisAlreadyTight(minU: number, maxU: number, worldRange: number): boolean {
  return (minU === 0 && maxU === 65535) || (worldRange === 0 && minU === maxU);
}
