import type {SceneModel} from "../../scene";
import type {SDKResult} from "../../core";
import {SDKErrorType} from "../../core";
import {generatePlanarUVs} from "../../demo/synthesizeGeometryAttribs";
import type {Fix, FixApplyResult} from "../Fix";
import type {Issue} from "../Issue";


/**
 * Auto-fix for `MATERIAL_TEXTURED_GEOMETRY_NO_UVS`.
 *
 * Reads `context.geometryId` (set by the inspection) and synthesises
 * planar UVs in place via {@link generatePlanarUVs}, projecting the
 * geometry's positions onto the two AABB axes that aren't its
 * thinnest direction. Aligns the V axis with the SceneModel's
 * `coordinateSystem.worldUp` on wall-like geometries so painted
 * textures don't rotate from one wall to the next.
 *
 * Narrow scope by design — only UVs. The sibling
 * {@link addMissingNormals} handles normals; running
 * both fixes is a `applyFixes` orchestration step, not a side-effect
 * of either strategy.
 *
 * Reports `{fixed: false}` (without an error) when the geometry has
 * been destroyed, has no positions / AABB, or already carries UVs —
 * the strategy is idempotent across repeat runs.
 */
export const addMissingUVs: Fix = {

  codes: ["MATERIAL_TEXTURED_GEOMETRY_NO_UVS"],

  description: "Synthesize missing UVs",

  procedure: [
    "Pick the two axes the geometry spans most (drop the thinnest)",
    "Align the V axis with world-up on wall-like geometries",
    "Project each vertex onto those axes to get its UV",
    "Store the new UVs on the geometry",
  ],

  apply(issue: Issue, sceneModel: SceneModel): SDKResult<FixApplyResult> {
    const ctx = issue.context;
    const geomId = (ctx && typeof ctx.geometryId === "string") ? ctx.geometryId : undefined;
    if (!geomId) {
      return {
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: `[addMissingUVs] issue '${issue.code}' has no context.geometryId`,
      };
    }
    const geom = sceneModel.geometries[geomId];
    if (!geom || geom.destroyed) {
      return {ok: true, value: {fixed: false, reason: "target-missing"}};
    }
    if (!geom.positionsCompressed || !geom.aabb) {
      return {ok: true, value: {fixed: false, reason: "malformed-issue"}};
    }
    if (geom.uvsCompressed && (geom.uvsCompressed as ArrayLike<number>).length > 0) {
      return {ok: true, value: {fixed: false, reason: "no-op"}};
    }

    const worldUp: ArrayLike<number> = sceneModel.coordinateSystem
      ? sceneModel.coordinateSystem.worldUp
      : [0, 0, 1];
    const uvs = generatePlanarUVs(geom.positionsCompressed, geom.aabb, 1.0, worldUp);
    (geom as { uvsCompressed: typeof uvs }).uvsCompressed = uvs;
    return {ok: true, value: {fixed: true, trace: `synthesized planar UVs on '${geomId}'`}};
  },
};
